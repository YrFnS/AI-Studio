'use client';

import { useEffect } from 'react';

import {
  createGenerationStatusCoordinator,
  type GenerationStatusRequest,
} from '@/lib/generation-poller';
import { getApiKeyForProvider } from '@/lib/idb';

interface LegacyJobContext {
  provider: string;
  modelId?: string;
  apiKey: string;
}

function getRequestUrl(input: RequestInfo | URL): URL | null {
  try {
    const value =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    return new URL(value, window.location.origin);
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
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    }

    if (typeof Request !== 'undefined' && input instanceof Request) {
      const contentType = input.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const parsed = await input.clone().json() as unknown;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? parsed as Record<string, unknown>
          : null;
      }
    }
  } catch {
    // Leave malformed request handling to the original route.
  }

  return null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0
    ? value
    : undefined;
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

/**
 * Transitional compatibility layer for generation callers that have not yet
 * migrated to the explicit resilient polling client.
 *
 * All existing studios now share the same retry, backoff, timeout, and terminal
 * error policy through this bridge. Newly migrated callers mark their POST with
 * `x-ai-studio-poll-client: resilient` and bypass the compatibility coordinator
 * because they already own their polling loop directly.
 */
export function SecureProviderFetchBridge() {
  useEffect(() => {
    const nativeFetch = window.fetch;
    const originalFetch = nativeFetch.bind(window);
    const legacyJobs = new Map<string, LegacyJobContext>();
    const statusCoordinator = createGenerationStatusCoordinator();

    const finishLegacyJob = async (id: string, response: Response) => {
      try {
        const data = await response.clone().json();
        if (data.status === 'completed' || data.status === 'failed') {
          legacyJobs.delete(id);
        }
      } catch {
        // The original caller handles malformed responses.
      }
      return response;
    };

    const secureFetchImplementation = async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      const requestUrl = getRequestUrl(input);
      if (!requestUrl || requestUrl.origin !== window.location.origin) {
        return originalFetch(input, init);
      }

      const method = getRequestMethod(input, init);
      const pathname = requestUrl.pathname;
      const headers = getRequestHeaders(input, init);

      if (pathname === '/api/generate/status') {
        // The shared poller already applies its own retry policy. Passing these
        // requests through avoids stacking two independent backoff loops.
        if (headers.get('x-ai-studio-poll-client') === 'resilient') {
          return originalFetch(input, init);
        }

        if (method === 'GET') {
          const id = requestUrl.searchParams.get('id');
          if (!id) return failedResponse('Generation id is required');

          const legacyContext = legacyJobs.get(id);
          const request: GenerationStatusRequest = {
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
          };

          const response = await statusCoordinator.check(
            request,
            originalFetch,
          );
          return finishLegacyJob(id, response);
        }

        if (method === 'POST') {
          const body = await readJsonRequestBody(input, init);
          if (!body) {
            return failedResponse('Generation status body must be valid JSON');
          }

          const request = statusRequestFromBody(body);
          if (!request) return failedResponse('Generation id is required');

          const response = await statusCoordinator.check(
            request,
            originalFetch,
          );
          return finishLegacyJob(request.id, response);
        }
      }

      const isGenerationRequest =
        method === 'POST'
        && pathname.startsWith('/api/generate/')
        && pathname !== '/api/generate/status';

      if (isGenerationRequest && typeof init?.body === 'string') {
        try {
          const payload = JSON.parse(init.body) as Record<string, unknown>;
          const providerId =
            typeof payload.providerId === 'string'
              ? payload.providerId
              : typeof payload.provider === 'string'
                ? payload.provider
                : '';

          if (providerId && typeof payload.apiKey !== 'string') {
            const storedKey = await getApiKeyForProvider(providerId);
            if (storedKey) payload.apiKey = storedKey;
          }

          const response = await originalFetch(input, {
            ...init,
            body: JSON.stringify(payload),
          });

          try {
            const data = await response.clone().json();
            const jobId =
              typeof data.id === 'string'
                ? data.id
                : typeof data.jobId === 'string'
                  ? data.jobId
                  : null;

            // Keep context only for older routes that return a raw provider job
            // id. Stateless local jobs encode provider metadata in the token.
            if (
              data.status === 'processing'
              && jobId
              && data.localJob !== true
              && providerId
              && typeof payload.apiKey === 'string'
            ) {
              legacyJobs.set(jobId, {
                provider: providerId,
                modelId:
                  typeof payload.modelId === 'string'
                    ? payload.modelId
                    : undefined,
                apiKey: payload.apiKey,
              });
            }
          } catch {
            // Leave response parsing to the original caller.
          }

          return response;
        } catch {
          // Non-JSON generation requests pass through unchanged.
        }
      }

      return originalFetch(input, init);
    };

    const secureFetch = Object.assign(secureFetchImplementation, {
      preconnect: typeof nativeFetch.preconnect === 'function'
        ? nativeFetch.preconnect.bind(nativeFetch)
        : () => undefined,
    }) as typeof window.fetch;

    window.fetch = secureFetch;

    return () => {
      statusCoordinator.clearAll();
      legacyJobs.clear();
      if (window.fetch === secureFetch) {
        window.fetch = originalFetch;
      }
    };
  }, []);

  return null;
}
