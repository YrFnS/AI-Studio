'use client';

import { getApiKeyForProvider } from '@/lib/idb';
import {
  createGenerationStatusCoordinator,
  type GenerationStatusRequest,
} from '@/lib/generation-poller';
import {
  decorateProviderCatalogWithApprovedRegistrations,
  findApprovedModelRegistration,
  resolveGenerationRequestRegistrationContext,
} from '@/lib/model-registration-client';

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type ApiKeyResolver = (providerId: string) => Promise<string | null>;

interface LegacyJobContext {
  provider: string;
  modelId?: string;
  apiKey: string;
}

export interface GenerationClientDependencies {
  fetchImpl: FetchLike;
  getApiKey: ApiKeyResolver;
}

export interface GenerationClient {
  fetch: typeof globalThis.fetch;
  clear: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0
    ? value
    : undefined;
}

function getRequestUrl(input: RequestInfo | URL): URL | null {
  try {
    const value =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const base = typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost';
    return new URL(value, base);
  } catch {
    return null;
  }
}

function getRequestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.method.toUpperCase();
  }
  return 'GET';
}

function getRequestHeaders(
  input: RequestInfo | URL,
  init?: RequestInit,
): Headers {
  if (init?.headers) return new Headers(init.headers);
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return new Headers(input.headers);
  }
  return new Headers();
}

async function readJsonRequestBody(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Record<string, unknown> | null> {
  try {
    if (typeof init?.body === 'string') {
      const parsed = JSON.parse(init.body) as unknown;
      return isRecord(parsed) ? parsed : null;
    }

    if (typeof Request !== 'undefined' && input instanceof Request) {
      const contentType = input.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const parsed = await input.clone().json() as unknown;
        return isRecord(parsed) ? parsed : null;
      }
    }
  } catch {
    // The target route remains responsible for malformed request bodies.
  }

  return null;
}

function failedResponse(message: string): Response {
  return new Response(
    JSON.stringify({ status: 'failed', error: message }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    },
  );
}

function statusRequestFromBody(
  body: Record<string, unknown>,
): GenerationStatusRequest | null {
  const id = asString(body.id);
  if (!id) return null;

  return {
    id,
    apiKey: asString(body.apiKey),
    provider: asString(body.provider),
    modelId: asString(body.modelId),
  };
}

async function ensureStatusApiKey(
  request: GenerationStatusRequest,
  getApiKey: ApiKeyResolver,
): Promise<GenerationStatusRequest> {
  if (request.apiKey || !request.provider) return request;

  const apiKey = await getApiKey(request.provider);
  return apiKey ? { ...request, apiKey } : request;
}

/**
 * Creates an explicit client for browser generation calls.
 *
 * Importers intentionally bind this client's `fetch` as their local `fetch`
 * identifier. Non-generation traffic passes through untouched, while generation
 * submissions receive the matching IndexedDB key and status calls share one
 * bounded coordinator. Nothing mutates `window.fetch` globally.
 */
export function createGenerationClient(
  dependencies: GenerationClientDependencies,
): GenerationClient {
  const { fetchImpl, getApiKey } = dependencies;
  const legacyJobs = new Map<string, LegacyJobContext>();
  const statusCoordinator = createGenerationStatusCoordinator();

  const finishLegacyJob = async (id: string, response: Response) => {
    try {
      const data = await response.clone().json() as Record<string, unknown>;
      if (data.status === 'completed' || data.status === 'failed') {
        legacyJobs.delete(id);
      }
    } catch {
      // The original caller handles malformed responses.
    }
    return response;
  };

  const explicitFetch: FetchLike = async (input, init) => {
    const requestUrl = getRequestUrl(input);
    if (!requestUrl) return fetchImpl(input, init);

    const isSameOrigin = typeof window === 'undefined'
      || requestUrl.origin === window.location.origin;
    if (!isSameOrigin) return fetchImpl(input, init);

    const method = getRequestMethod(input, init);
    const pathname = requestUrl.pathname;
    const headers = getRequestHeaders(input, init);

    if (pathname === '/api/providers' && method === 'GET') {
      const response = await fetchImpl(input, init);
      if (!response.ok || typeof indexedDB === 'undefined') return response;
      try {
        const catalog = await response.clone().json() as unknown;
        const decorated = await decorateProviderCatalogWithApprovedRegistrations(catalog);
        const responseHeaders = new Headers(response.headers);
        responseHeaders.set('Content-Type', 'application/json');
        responseHeaders.set('Cache-Control', 'no-store');
        responseHeaders.delete('Content-Length');
        responseHeaders.delete('Content-Encoding');
        return new Response(JSON.stringify(decorated), {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      } catch {
        // Reviewed models are additive. If local review metadata is unavailable,
        // retain the already registry-filtered static catalog rather than
        // breaking every provider selector.
        return response;
      }
    }

    if (pathname === '/api/generate/status') {
      // The shared async poller owns its complete loop and marks these requests
      // so the per-call coordinator does not add another layer of backoff.
      if (headers.get('x-ai-studio-poll-client') === 'resilient') {
        return fetchImpl(input, init);
      }

      if (method === 'GET') {
        const id = requestUrl.searchParams.get('id');
        if (!id) return failedResponse('Generation id is required');

        const legacyContext = legacyJobs.get(id);
        const request = await ensureStatusApiKey(
          {
            id,
            apiKey:
              requestUrl.searchParams.get('apiKey')
              || legacyContext?.apiKey,
            provider:
              requestUrl.searchParams.get('provider')
              || legacyContext?.provider,
            modelId:
              requestUrl.searchParams.get('modelId')
              || legacyContext?.modelId,
          },
          getApiKey,
        );

        const response = await statusCoordinator.check(request, fetchImpl);
        return finishLegacyJob(id, response);
      }

      if (method === 'POST') {
        const body = await readJsonRequestBody(input, init);
        if (!body) {
          return failedResponse('Generation status body must be valid JSON');
        }

        const parsedRequest = statusRequestFromBody(body);
        if (!parsedRequest) return failedResponse('Generation id is required');

        const request = await ensureStatusApiKey(parsedRequest, getApiKey);
        const response = await statusCoordinator.check(request, fetchImpl);
        return finishLegacyJob(request.id, response);
      }
    }

    const isGenerationRequest =
      method === 'POST'
      && pathname.startsWith('/api/generate/')
      && pathname !== '/api/generate/status';

    if (isGenerationRequest) {
      const payload = await readJsonRequestBody(input, init);
      if (payload) {
        const providerId =
          asString(payload.providerId)
          || asString(payload.provider)
          || '';
        const modelId = asString(payload.modelId);
        const registrationContext = resolveGenerationRequestRegistrationContext(
          pathname,
          payload,
        );

        if (
          providerId
          && modelId
          && registrationContext
          && typeof indexedDB !== 'undefined'
          && !isRecord(payload.reviewedRegistration)
        ) {
          const registration = await findApprovedModelRegistration({
            providerId,
            modelId,
            ...registrationContext,
          });
          if (registration) payload.reviewedRegistration = registration;
        }

        if (providerId && !asString(payload.apiKey)) {
          const storedKey = await getApiKey(providerId);
          if (storedKey) payload.apiKey = storedKey;
        }

        const requestHeaders = getRequestHeaders(input, init);
        if (!requestHeaders.has('Content-Type')) {
          requestHeaders.set('Content-Type', 'application/json');
        }

        const response = await fetchImpl(input, {
          ...init,
          headers: requestHeaders,
          body: JSON.stringify(payload),
        });

        // Protected media is a potentially large binary stream. It must pass
        // through without cloning or attempting JSON inspection.
        if (pathname === '/api/generate/media') return response;

        try {
          const data = await response.clone().json() as Record<string, unknown>;
          const jobId = asString(data.id) || asString(data.jobId);

          // Compatibility for any route that still returns a raw provider job
          // id. Current migrated routes return credential-free stateless tokens.
          if (
            data.status === 'processing'
            && jobId
            && data.localJob !== true
            && providerId
            && asString(payload.apiKey)
          ) {
            legacyJobs.set(jobId, {
              provider: providerId,
              modelId: asString(payload.modelId),
              apiKey: asString(payload.apiKey)!,
            });
          }
        } catch {
          // Leave response parsing to the original caller.
        }

        return response;
      }
    }

    return fetchImpl(input, init);
  };

  const nativePreconnect = (globalThis.fetch as typeof globalThis.fetch & {
    preconnect?: (url: string, options?: unknown) => void;
  }).preconnect;

  const clientFetch = Object.assign(explicitFetch, {
    preconnect: typeof nativePreconnect === 'function'
      ? nativePreconnect.bind(globalThis.fetch)
      : () => undefined,
  }) as typeof globalThis.fetch;

  return {
    fetch: clientFetch,
    clear: () => {
      statusCoordinator.clearAll();
      legacyJobs.clear();
    },
  };
}

const defaultClient = createGenerationClient({
  fetchImpl: (input, init) => globalThis.fetch(input, init),
  getApiKey: getApiKeyForProvider,
});

export const generationFetch = defaultClient.fetch;
export const resetGenerationClient = defaultClient.clear;
