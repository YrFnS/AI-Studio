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
 * Transitional compatibility layer for existing generation clients.
 *
 * It keeps provider keys out of status-query URLs, injects the locally stored
 * key when an older caller omits it, and forwards polling through the secure
 * POST status contract. New generation code should call the POST contract
 * directly, but this bridge protects every current studio surface meanwhile.
 */
export function SecureProviderFetchBridge() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    const legacyJobs = new Map<string, LegacyJobContext>();

    const secureFetch: typeof window.fetch = async (input, init) => {
      const requestUrl = getRequestUrl(input);
      if (!requestUrl || requestUrl.origin !== window.location.origin) {
        return originalFetch(input, init);
      }

      const method = getRequestMethod(input, init);
      const pathname = requestUrl.pathname;

      // Existing pollers still construct a GET URL containing the API key.
      // Intercept it before any network request is made and replace it with a
      // POST body containing only the local job token (or a legacy context).
      if (pathname === '/api/generate/status' && method === 'GET') {
        const id = requestUrl.searchParams.get('id');
        if (!id) return jsonError('Generation id is required', 400);

        const legacyContext = legacyJobs.get(id);
        const response = await originalFetch('/api/generate/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
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

            // New routes return an opaque local token and retain the provider
            // key only in the local server process. Keep context only for older
            // async routes until they are migrated to that registry.
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

    window.fetch = secureFetch;

    return () => {
      if (window.fetch === secureFetch) {
        window.fetch = originalFetch;
      }
    };
  }, []);

  return null;
}
