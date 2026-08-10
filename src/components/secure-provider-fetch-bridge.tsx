'use client';

import { useEffect } from 'react';

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

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Transitional compatibility layer for generation callers that have not yet
 * migrated to the explicit generation client.
 *
 * The bridge injects locally stored provider keys into generation requests and
 * converts legacy GET status calls into POST requests before they reach the
 * network. Stateless job tokens contain provider job metadata but never contain
 * provider credentials, so legacy pollers must forward their locally held key
 * in the POST body.
 */
export function SecureProviderFetchBridge() {
  useEffect(() => {
    const nativeFetch = window.fetch;
    const originalFetch = nativeFetch.bind(window);
    const legacyJobs = new Map<string, LegacyJobContext>();

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

      // Some older callers still construct a GET URL containing the API key.
      // This URL is intercepted in memory; the native network request is a POST
      // and therefore does not expose the key in request URLs or proxy logs.
      if (pathname === '/api/generate/status' && method === 'GET') {
        const id = requestUrl.searchParams.get('id');
        if (!id) return jsonError('Generation id is required', 400);

        const legacyContext = legacyJobs.get(id);
        const queryApiKey = requestUrl.searchParams.get('apiKey') || undefined;
        const queryProvider = requestUrl.searchParams.get('provider') || undefined;
        const queryModelId = requestUrl.searchParams.get('modelId') || undefined;

        const response = await originalFetch('/api/generate/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            ...(queryProvider ? { provider: queryProvider } : {}),
            ...(queryModelId ? { modelId: queryModelId } : {}),
            ...(queryApiKey ? { apiKey: queryApiKey } : {}),
            ...(legacyContext ?? {}),
          }),
        });

        try {
          const data = await response.clone().json();
          if (data.status === 'completed' || data.status === 'failed') {
            legacyJobs.delete(id);
          }
        } catch {
          // The caller will handle malformed responses.
        }

        return response;
      }

      const isGenerationRequest =
        method === 'POST' &&
        pathname.startsWith('/api/generate/') &&
        pathname !== '/api/generate/status';

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

            // Keep provider context only for older routes that still return a
            // raw provider job id. Stateless local jobs encode this metadata in
            // their token and need only the locally stored key during polling.
            if (
              data.status === 'processing' &&
              jobId &&
              data.localJob !== true &&
              providerId &&
              typeof payload.apiKey === 'string'
            ) {
              legacyJobs.set(jobId, {
                provider: providerId,
                modelId:
                  typeof payload.modelId === 'string' ? payload.modelId : undefined,
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
      if (window.fetch === secureFetch) {
        window.fetch = originalFetch;
      }
    };
  }, []);

  return null;
}
