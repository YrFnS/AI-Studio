export const PROVIDER_SUBMISSION_TIMEOUT_MS = 120_000;
export const PROVIDER_STATUS_TIMEOUT_MS = 20_000;
export const MAX_PROVIDER_ERROR_BYTES = 8 * 1024;

type FetchInput = Parameters<typeof globalThis.fetch>[0];

export type ProviderRequestErrorCode =
  | 'provider_auth_failed'
  | 'provider_rate_limited'
  | 'provider_rejected_request'
  | 'provider_unavailable'
  | 'provider_timeout'
  | 'provider_network_error'
  | 'provider_invalid_response';

export class ProviderRequestError extends Error {
  readonly provider: string;
  readonly code: ProviderRequestErrorCode;
  readonly status: number;
  readonly providerStatus?: number;
  readonly retryable: boolean;
  readonly details?: string;

  constructor(options: {
    provider: string;
    code: ProviderRequestErrorCode;
    message: string;
    status: number;
    retryable: boolean;
    providerStatus?: number;
    details?: string;
  }) {
    super(options.message);
    this.name = 'ProviderRequestError';
    this.provider = options.provider;
    this.code = options.code;
    this.status = options.status;
    this.providerStatus = options.providerStatus;
    this.retryable = options.retryable;
    this.details = options.details;
  }
}

export interface ProviderFetchOptions {
  timeoutMs?: number;
  maxErrorBytes?: number;
}

function isFetchInput(value: unknown): value is FetchInput {
  return typeof value === 'string'
    || value instanceof URL
    || (typeof Request !== 'undefined' && value instanceof Request);
}

function inferProvider(input: FetchInput): string {
  const rawUrl = input instanceof Request
    ? input.url
    : input instanceof URL
      ? input.toString()
      : String(input);

  let hostname: string;
  try {
    hostname = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return 'AI provider';
  }

  const providers: Array<[string, string]> = [
    ['api.openai.com', 'OpenAI'],
    ['api.stability.ai', 'Stability AI'],
    ['api.replicate.com', 'Replicate'],
    ['queue.fal.run', 'Fal.ai'],
    ['api.together.xyz', 'Together AI'],
    ['api.fireworks.ai', 'Fireworks AI'],
    ['api.ideogram.ai', 'Ideogram'],
    ['api-inference.huggingface.co', 'Hugging Face'],
    ['generativelanguage.googleapis.com', 'Google AI Studio'],
    ['cloud.leonardo.ai', 'Leonardo'],
    ['api.recraft.ai', 'Recraft'],
    ['api.bfl.ml', 'Black Forest Labs'],
    ['api.aimlapi.com', 'AI/ML API'],
    ['api.dev.runwayml.com', 'Runway'],
    ['api.lumalabs.ai', 'Luma AI'],
  ];

  return providers.find(([domain]) => hostname === domain || hostname.endsWith(`.${domain}`))?.[1]
    || 'AI provider';
}

function combineAbortSignals(
  timeoutSignal: AbortSignal,
  externalSignal?: AbortSignal | null,
): AbortSignal {
  if (!externalSignal) return timeoutSignal;

  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([timeoutSignal, externalSignal]);
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  timeoutSignal.addEventListener('abort', abort, { once: true });
  externalSignal.addEventListener('abort', abort, { once: true });
  return controller.signal;
}

async function readLimitedText(
  response: Response,
  maxBytes: number,
): Promise<string> {
  if (!response.body) {
    return (await response.text()).slice(0, maxBytes);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let output = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    const previousTotal = total;
    total += value.byteLength;
    if (total > maxBytes) {
      const remaining = Math.max(0, maxBytes - previousTotal);
      output += decoder.decode(value.subarray(0, remaining), { stream: true });
      await reader.cancel();
      break;
    }

    output += decoder.decode(value, { stream: true });
  }

  output += decoder.decode();
  return output.trim();
}

function normalizedProviderFailure(
  provider: string,
  providerStatus: number,
  details?: string,
): ProviderRequestError {
  if (providerStatus === 401 || providerStatus === 403) {
    return new ProviderRequestError({
      provider,
      code: 'provider_auth_failed',
      message: `${provider} rejected the API key or account permissions.`,
      status: 401,
      providerStatus,
      retryable: false,
      details,
    });
  }

  if (providerStatus === 429) {
    return new ProviderRequestError({
      provider,
      code: 'provider_rate_limited',
      message: `${provider} rate limit or quota was reached.`,
      status: 429,
      providerStatus,
      retryable: true,
      details,
    });
  }

  if ([400, 404, 409, 413, 415, 422].includes(providerStatus)) {
    return new ProviderRequestError({
      provider,
      code: 'provider_rejected_request',
      message: `${provider} rejected the generation request. Check the selected model and parameters.`,
      status: 400,
      providerStatus,
      retryable: false,
      details,
    });
  }

  return new ProviderRequestError({
    provider,
    code: 'provider_unavailable',
    message: `${provider} is temporarily unavailable.`,
    status: 502,
    providerStatus,
    retryable: true,
    details,
  });
}

function timeoutError(provider: string): ProviderRequestError {
  return new ProviderRequestError({
    provider,
    code: 'provider_timeout',
    message: `${provider} did not respond before the request deadline.`,
    status: 504,
    retryable: true,
  });
}

function networkError(provider: string): ProviderRequestError {
  return new ProviderRequestError({
    provider,
    code: 'provider_network_error',
    message: `Could not reach ${provider}.`,
    status: 502,
    retryable: true,
  });
}

function invalidResponseError(provider: string): ProviderRequestError {
  return new ProviderRequestError({
    provider,
    code: 'provider_invalid_response',
    message: `${provider} returned an unreadable response.`,
    status: 502,
    retryable: true,
  });
}

const BODY_METHODS = new Set<PropertyKey>([
  'arrayBuffer',
  'blob',
  'formData',
  'json',
  'text',
]);

function wrapResponse(
  response: Response,
  options: {
    finish: () => void;
    didTimeout: () => boolean;
    provider: string;
  },
): Response {
  let wrappedBody: ReadableStream<Uint8Array> | null | undefined;

  return new Proxy(response, {
    get(target, property) {
      const value = Reflect.get(target, property, target);

      if (property === 'body') {
        if (value === null) {
          options.finish();
          return null;
        }
        if (wrappedBody !== undefined) return wrappedBody;

        const reader = (value as ReadableStream<Uint8Array>).getReader();
        wrappedBody = new ReadableStream<Uint8Array>({
          async pull(controller) {
            try {
              const chunk = await reader.read();
              if (chunk.done) {
                options.finish();
                controller.close();
                return;
              }
              if (chunk.value) controller.enqueue(chunk.value);
            } catch {
              options.finish();
              controller.error(
                options.didTimeout()
                  ? timeoutError(options.provider)
                  : invalidResponseError(options.provider),
              );
            }
          },
          async cancel(reason) {
            options.finish();
            await reader.cancel(reason);
          },
        });
        return wrappedBody;
      }

      if (BODY_METHODS.has(property) && typeof value === 'function') {
        return async (...args: unknown[]) => {
          try {
            return await value.apply(target, args);
          } catch (error) {
            if (error instanceof ProviderRequestError) throw error;
            if (options.didTimeout()) throw timeoutError(options.provider);
            throw invalidResponseError(options.provider);
          } finally {
            options.finish();
          }
        };
      }

      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

export function providerFetch(
  input: FetchInput,
  init?: RequestInit,
  options?: ProviderFetchOptions,
): Promise<Response>;
export function providerFetch(
  provider: string,
  input: FetchInput,
  init?: RequestInit,
  options?: ProviderFetchOptions,
): Promise<Response>;
export async function providerFetch(
  providerOrInput: string | FetchInput,
  inputOrInit?: FetchInput | RequestInit,
  initOrOptions?: RequestInit | ProviderFetchOptions,
  explicitOptions?: ProviderFetchOptions,
): Promise<Response> {
  const hasExplicitProvider = typeof providerOrInput === 'string'
    && isFetchInput(inputOrInit);

  const input = (hasExplicitProvider ? inputOrInit : providerOrInput) as FetchInput;
  const provider = hasExplicitProvider
    ? providerOrInput as string
    : inferProvider(input);
  const init = (hasExplicitProvider ? initOrOptions : inputOrInit) as RequestInit | undefined;
  const options = (hasExplicitProvider ? explicitOptions : initOrOptions) as ProviderFetchOptions | undefined;

  const timeoutMs = options?.timeoutMs ?? PROVIDER_SUBMISSION_TIMEOUT_MS;
  const maxErrorBytes = options?.maxErrorBytes ?? MAX_PROVIDER_ERROR_BYTES;
  const timeoutController = new AbortController();
  let timedOut = false;
  let finished = false;

  const timer = setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, timeoutMs);

  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
  };

  try {
    const response = await globalThis.fetch(input, {
      ...(init || {}),
      signal: combineAbortSignals(timeoutController.signal, init?.signal),
    });

    if (!response.ok) {
      const details = await readLimitedText(response, maxErrorBytes);
      finish();
      throw normalizedProviderFailure(
        provider,
        response.status,
        details || undefined,
      );
    }

    return wrapResponse(response, {
      finish,
      didTimeout: () => timedOut,
      provider,
    });
  } catch (error) {
    finish();
    if (error instanceof ProviderRequestError) throw error;
    if (timedOut) throw timeoutError(provider);
    throw networkError(provider);
  }
}
