export type GenerationStatusValue = 'processing' | 'completed' | 'failed';

export interface GenerationStatusPayload {
  status: GenerationStatusValue;
  resultUrl?: string;
  urls?: string[];
  error?: string;
  message?: string;
  [key: string]: unknown;
}

export interface GenerationStatusRequest {
  id: string;
  apiKey?: string;
  provider?: string;
  modelId?: string;
}

export type GenerationPollingErrorCode =
  | 'aborted'
  | 'failed'
  | 'invalid-response'
  | 'network'
  | 'timeout';

export class GenerationPollingError extends Error {
  readonly code: GenerationPollingErrorCode;
  readonly transient: boolean;
  readonly status?: number;

  constructor(
    message: string,
    options: {
      code: GenerationPollingErrorCode;
      transient?: boolean;
      status?: number;
    },
  ) {
    super(message);
    this.name = 'GenerationPollingError';
    this.code = options.code;
    this.transient = options.transient ?? false;
    this.status = options.status;
  }
}

export interface GenerationPollingPolicy {
  baseDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  jitterRatio: number;
  maxElapsedMs: number;
  maxConsecutiveErrors: number;
}

export const DEFAULT_GENERATION_POLLING_POLICY: GenerationPollingPolicy = {
  baseDelayMs: 2_500,
  maxDelayMs: 15_000,
  backoffFactor: 1.5,
  jitterRatio: 0.15,
  maxElapsedMs: 30 * 60 * 1000,
  maxConsecutiveErrors: 5,
};

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStatus(value: unknown): value is GenerationStatusValue {
  return value === 'processing' || value === 'completed' || value === 'failed';
}

function normalizeUrls(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const urls = value.filter(
    (item): item is string => typeof item === 'string' && item.length > 0,
  );
  return urls.length > 0 ? urls : undefined;
}

function normalizeStatusPayload(value: unknown): GenerationStatusPayload | null {
  if (!isRecord(value) || !isStatus(value.status)) return null;

  const payload: GenerationStatusPayload = {
    ...value,
    status: value.status,
  };

  const urls = normalizeUrls(value.urls);
  if (urls) payload.urls = urls;
  if (typeof value.resultUrl === 'string' && value.resultUrl.length > 0) {
    payload.resultUrl = value.resultUrl;
  }
  if (typeof value.error === 'string' && value.error.length > 0) {
    payload.error = value.error;
  }
  if (typeof value.message === 'string' && value.message.length > 0) {
    payload.message = value.message;
  }

  return payload;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function requestBody(request: GenerationStatusRequest): Record<string, string> {
  const body: Record<string, string> = { id: request.id };
  if (request.apiKey) body.apiKey = request.apiKey;
  if (request.provider) body.provider = request.provider;
  if (request.modelId) body.modelId = request.modelId;
  return body;
}

export async function requestGenerationStatus(
  request: GenerationStatusRequest,
  options: {
    fetchImpl?: FetchLike;
    signal?: AbortSignal;
  } = {},
): Promise<GenerationStatusPayload> {
  if (!request.id) {
    throw new GenerationPollingError('Generation id is required', {
      code: 'failed',
    });
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;

  try {
    response = await fetchImpl('/api/generate/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ai-studio-poll-client': 'resilient',
      },
      cache: 'no-store',
      signal: options.signal,
      body: JSON.stringify(requestBody(request)),
    });
  } catch (error) {
    if (options.signal?.aborted) {
      throw new GenerationPollingError('Generation polling was cancelled', {
        code: 'aborted',
      });
    }

    throw new GenerationPollingError(
      error instanceof Error ? error.message : 'Generation status request failed',
      { code: 'network', transient: true },
    );
  }

  const rawPayload = await readJson(response);
  const payload = normalizeStatusPayload(rawPayload);

  // A terminal failed payload is useful even when the status route used a
  // non-2xx response (for example, an expired legacy job returning 404).
  if (payload?.status === 'failed') return payload;

  if (!response.ok) {
    const record = isRecord(rawPayload) ? rawPayload : null;
    const message =
      typeof record?.error === 'string'
        ? record.error
        : `Generation status request failed (${response.status})`;
    const transient = response.status === 408
      || response.status === 425
      || response.status === 429
      || response.status >= 500;

    throw new GenerationPollingError(message, {
      code: transient ? 'network' : 'failed',
      transient,
      status: response.status,
    });
  }

  if (!payload) {
    throw new GenerationPollingError(
      'Generation status response was not recognized',
      { code: 'invalid-response', transient: true, status: response.status },
    );
  }

  return payload;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new GenerationPollingError('Generation polling was cancelled', {
      code: 'aborted',
    });
  }
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    throwIfAborted(signal);

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(
        new GenerationPollingError('Generation polling was cancelled', {
          code: 'aborted',
        }),
      );
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function mergePolicy(
  overrides?: Partial<GenerationPollingPolicy>,
): GenerationPollingPolicy {
  return {
    ...DEFAULT_GENERATION_POLLING_POLICY,
    ...overrides,
  };
}

function nextDelay(
  attempt: number,
  policy: GenerationPollingPolicy,
  random: () => number,
): number {
  const raw = Math.min(
    policy.maxDelayMs,
    policy.baseDelayMs * Math.pow(policy.backoffFactor, attempt),
  );
  const jitter = 1 + ((random() * 2) - 1) * policy.jitterRatio;
  return Math.max(0, Math.round(raw * jitter));
}

export async function pollGenerationJob(
  request: GenerationStatusRequest,
  options: {
    fetchImpl?: FetchLike;
    signal?: AbortSignal;
    startedAtMs?: number;
    policy?: Partial<GenerationPollingPolicy>;
    now?: () => number;
    random?: () => number;
    sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
    onUpdate?: (payload: GenerationStatusPayload) => void;
    onTransientError?: (
      error: GenerationPollingError,
      consecutiveErrors: number,
    ) => void;
  } = {},
): Promise<GenerationStatusPayload> {
  const policy = mergePolicy(options.policy);
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? defaultSleep;
  const startedAt = options.startedAtMs ?? now();
  let attempt = 0;
  let consecutiveErrors = 0;

  while (true) {
    throwIfAborted(options.signal);

    if (now() - startedAt >= policy.maxElapsedMs) {
      throw new GenerationPollingError('Generation polling timed out', {
        code: 'timeout',
      });
    }

    try {
      const payload = await requestGenerationStatus(request, {
        fetchImpl: options.fetchImpl,
        signal: options.signal,
      });
      consecutiveErrors = 0;
      options.onUpdate?.(payload);

      if (payload.status === 'completed') return payload;
      if (payload.status === 'failed') {
        throw new GenerationPollingError(
          payload.error || 'Generation failed',
          { code: 'failed' },
        );
      }
    } catch (error) {
      if (error instanceof GenerationPollingError) {
        if (!error.transient || error.code === 'aborted') throw error;
        consecutiveErrors += 1;
        options.onTransientError?.(error, consecutiveErrors);
      } else {
        consecutiveErrors += 1;
        options.onTransientError?.(
          new GenerationPollingError(
            error instanceof Error ? error.message : 'Generation polling failed',
            { code: 'network', transient: true },
          ),
          consecutiveErrors,
        );
      }

      if (consecutiveErrors > policy.maxConsecutiveErrors) {
        throw new GenerationPollingError(
          'Generation status could not be reached after repeated retries',
          { code: 'network' },
        );
      }
    }

    const remaining = policy.maxElapsedMs - (now() - startedAt);
    if (remaining <= 0) {
      throw new GenerationPollingError('Generation polling timed out', {
        code: 'timeout',
      });
    }

    const delay = Math.min(nextDelay(attempt, policy, random), remaining);
    attempt += 1;
    await sleep(delay, options.signal);
  }
}

function jsonResponse(payload: GenerationStatusPayload): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

interface CoordinatorSession {
  startedAt: number;
  nextAllowedAt: number;
  attempt: number;
  consecutiveErrors: number;
  lastPayload: GenerationStatusPayload;
}

/**
 * Coordinates fixed-interval legacy pollers through one resilient policy.
 * Callers may continue asking every few seconds, while this coordinator
 * throttles provider status traffic, retries transient failures, and converts
 * terminal conditions into a normal `{ status: 'failed' }` response.
 */
export function createGenerationStatusCoordinator(
  options: {
    policy?: Partial<GenerationPollingPolicy>;
    now?: () => number;
    random?: () => number;
  } = {},
) {
  const policy = mergePolicy(options.policy);
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const sessions = new Map<string, CoordinatorSession>();

  const clear = (id: string) => sessions.delete(id);

  const check = async (
    request: GenerationStatusRequest,
    fetchImpl: FetchLike,
  ): Promise<Response> => {
    if (!request.id) {
      return jsonResponse({
        status: 'failed',
        error: 'Generation id is required',
      });
    }

    const currentTime = now();
    const session = sessions.get(request.id) ?? {
      startedAt: currentTime,
      nextAllowedAt: 0,
      attempt: 0,
      consecutiveErrors: 0,
      lastPayload: { status: 'processing' as const },
    };
    sessions.set(request.id, session);

    if (currentTime - session.startedAt >= policy.maxElapsedMs) {
      clear(request.id);
      return jsonResponse({
        status: 'failed',
        error: 'Generation polling timed out',
      });
    }

    if (currentTime < session.nextAllowedAt) {
      return jsonResponse(session.lastPayload);
    }

    try {
      const payload = await requestGenerationStatus(request, { fetchImpl });
      session.consecutiveErrors = 0;
      session.lastPayload = payload;

      if (payload.status === 'completed' || payload.status === 'failed') {
        clear(request.id);
        return jsonResponse(payload);
      }

      session.nextAllowedAt = currentTime
        + nextDelay(session.attempt, policy, random);
      session.attempt += 1;
      return jsonResponse(payload);
    } catch (error) {
      const pollingError = error instanceof GenerationPollingError
        ? error
        : new GenerationPollingError(
            error instanceof Error ? error.message : 'Generation polling failed',
            { code: 'network', transient: true },
          );

      if (!pollingError.transient) {
        clear(request.id);
        return jsonResponse({
          status: 'failed',
          error: pollingError.message,
        });
      }

      session.consecutiveErrors += 1;
      if (session.consecutiveErrors > policy.maxConsecutiveErrors) {
        clear(request.id);
        return jsonResponse({
          status: 'failed',
          error: 'Generation status could not be reached after repeated retries',
        });
      }

      session.lastPayload = {
        status: 'processing',
        message: 'Status service temporarily unavailable; retrying automatically',
      };
      session.nextAllowedAt = currentTime
        + nextDelay(session.attempt, policy, random);
      session.attempt += 1;
      return jsonResponse(session.lastPayload);
    }
  };

  return {
    check,
    clear,
    clearAll: () => sessions.clear(),
  };
}
