'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import * as data from '@/lib/data';
import { PROVIDERS } from '@/lib/providers-data';
import { useAppStore } from '@/lib/store';

interface GenerationContext {
  localId: string;
  providerId: string;
  providerName: string;
  modelId: string;
  type: 'image' | 'video';
  prompt: string;
  negativePrompt?: string;
  params?: string;
  inputImageUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
  createdAt: number;
}

interface RuntimeBridgeHandle {
  restore: () => void;
}

declare global {
  interface Window {
    __aiStudioRuntimeBridge?: RuntimeBridgeHandle;
  }
}

const GENERATION_PATHS = new Set([
  '/api/generate/image',
  '/api/generate/video',
  '/api/generate/variations',
  '/api/generate/upscale',
  '/api/generate/img2vid',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function getRequestUrl(input: RequestInfo | URL): URL {
  if (typeof input === 'string') return new URL(input, window.location.origin);
  if (input instanceof URL) return new URL(input.toString(), window.location.origin);
  return new URL(input.url, window.location.origin);
}

function getRequestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  return (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
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

    if (input instanceof Request) {
      const contentType = input.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const parsed = await input.clone().json() as unknown;
        return isRecord(parsed) ? parsed : null;
      }
    }
  } catch {
    // The original request still proceeds even when its body is not inspectable.
  }

  return null;
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const parsed = await response.clone().json() as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractUrls(payload: Record<string, unknown>): string[] {
  const urls = Array.isArray(payload.urls)
    ? payload.urls.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : [];

  const single = asString(payload.resultUrl) || asString(payload.url);
  if (single && !urls.includes(single)) urls.unshift(single);

  return urls;
}

function sanitizeParams(body: Record<string, unknown>): string | undefined {
  const sanitized: Record<string, unknown> = { ...body };
  delete sanitized.apiKey;

  for (const key of ['inputImageUrl', 'imageUrl', 'startFrameUrl', 'endFrameUrl', 'outfitImageUrl']) {
    const value = sanitized[key];
    if (typeof value === 'string' && value.startsWith('data:')) {
      sanitized[key] = '[embedded image stored separately]';
    }
  }

  try {
    return JSON.stringify(sanitized);
  } catch {
    return undefined;
  }
}

function buildContext(pathname: string, body: Record<string, unknown>): GenerationContext {
  const providerId = asString(body.providerId) || 'unknown';
  const provider = PROVIDERS.find((item) => item.id === providerId);
  const type: 'image' | 'video' = pathname.endsWith('/video') || pathname.endsWith('/img2vid')
    ? 'video'
    : 'image';

  const fallbackPrompt = pathname.endsWith('/upscale')
    ? 'Upscaled image'
    : pathname.endsWith('/variations')
      ? 'Image variation'
      : type === 'video'
        ? 'Generated video'
        : 'Generated image';

  return {
    localId: crypto.randomUUID(),
    providerId,
    providerName: provider?.displayName || providerId,
    modelId: asString(body.modelId) || 'unknown-model',
    type,
    prompt: asString(body.prompt) || fallbackPrompt,
    negativePrompt: asString(body.negativePrompt),
    params: sanitizeParams(body),
    inputImageUrl:
      asString(body.inputImageUrl)
      || asString(body.imageUrl)
      || asString(body.startFrameUrl),
    width: asNumber(body.width),
    height: asNumber(body.height),
    duration: asNumber(body.duration),
    createdAt: Date.now(),
  };
}

async function saveCompletedResults(
  context: GenerationContext,
  urls: string[],
  providerJobId?: string,
): Promise<void> {
  for (let index = 0; index < urls.length; index += 1) {
    await data.saveGeneration({
      id: index === 0 ? context.localId : crypto.randomUUID(),
      providerId: context.providerId,
      providerName: context.providerName,
      modelId: context.modelId,
      type: context.type,
      prompt: context.prompt,
      negativePrompt: context.negativePrompt,
      params: context.params,
      inputImageUrl: context.inputImageUrl,
      resultUrl: urls[index],
      status: 'completed',
      providerJobId,
      width: context.width,
      height: context.height,
      duration: context.duration,
      isFavorite: false,
      createdAt: context.createdAt + index,
    });
  }
}

async function saveProcessingResult(
  context: GenerationContext,
  providerJobId: string,
): Promise<void> {
  await data.saveGeneration({
    id: context.localId,
    providerId: context.providerId,
    providerName: context.providerName,
    modelId: context.modelId,
    type: context.type,
    prompt: context.prompt,
    negativePrompt: context.negativePrompt,
    params: context.params,
    inputImageUrl: context.inputImageUrl,
    status: 'processing',
    providerJobId,
    width: context.width,
    height: context.height,
    duration: context.duration,
    isFavorite: false,
    createdAt: context.createdAt,
  });
}

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function installRuntimeBridge(): () => void {
  if (window.__aiStudioRuntimeBridge) return () => undefined;

  const originalFetch = window.fetch.bind(window) as typeof window.fetch;
  const activeJobs = new Map<string, GenerationContext>();

  const normalizeGallerySelection = () => {
    const current = useAppStore.getState().gallerySelectedIds;
    if (!Array.isArray(current)) {
      useAppStore.setState({ gallerySelectedIds: [] });
    }
  };

  normalizeGallerySelection();
  const unsubscribe = useAppStore.subscribe(normalizeGallerySelection);

  const wrappedFetch: typeof window.fetch = async (input, init) => {
    const url = getRequestUrl(input);
    const method = getRequestMethod(input, init);

    if (url.pathname === '/api/gallery' && method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return jsonResponse({ error: 'id is required' }, 400);

      try {
        await data.deleteGeneration(id);
        return jsonResponse({ success: true });
      } catch (error) {
        return jsonResponse({
          error: error instanceof Error ? error.message : 'Failed to delete generation',
        }, 500);
      }
    }

    if (url.pathname === '/api/generate/status' && method === 'GET') {
      const id = url.searchParams.get('id');
      const apiKey = url.searchParams.get('apiKey');

      if (id && apiKey) {
        const headers = new Headers(init?.headers);
        headers.set('Content-Type', 'application/json');
        headers.set('x-provider-api-key', apiKey);

        const response = await originalFetch('/api/generate/status', {
          method: 'POST',
          headers,
          cache: 'no-store',
          body: JSON.stringify({
            id,
            provider: url.searchParams.get('provider') || undefined,
            modelId: url.searchParams.get('modelId') || undefined,
          }),
        });

        const payload = await readJsonResponse(response);
        const context = activeJobs.get(id);

        if (payload && context) {
          if (payload.status === 'completed') {
            const urls = extractUrls(payload);
            if (urls.length > 0) {
              await data.updateGeneration(context.localId, {
                resultUrl: urls[0],
                status: 'completed',
              });

              if (urls.length > 1) {
                await saveCompletedResults(
                  { ...context, localId: crypto.randomUUID(), createdAt: Date.now() },
                  urls.slice(1),
                  id,
                );
              }
            }
            activeJobs.delete(id);
          } else if (payload.status === 'failed') {
            await data.updateGeneration(context.localId, {
              status: 'failed',
              error: asString(payload.error) || 'Generation failed',
            });
            activeJobs.delete(id);
          }
        }

        return response;
      }
    }

    const requestBody = GENERATION_PATHS.has(url.pathname) && method === 'POST'
      ? await readJsonRequestBody(input, init)
      : null;

    const response = await originalFetch(input, init);

    if (response.ok && requestBody && GENERATION_PATHS.has(url.pathname)) {
      try {
        const payload = await readJsonResponse(response);
        if (payload) {
          const context = buildContext(url.pathname, requestBody);
          const urls = extractUrls(payload);

          if (payload.status === 'completed' && urls.length > 0) {
            await saveCompletedResults(context, urls);
          } else if (payload.status === 'processing') {
            const providerJobId = asString(payload.id) || asString(payload.jobId);
            if (providerJobId) {
              await saveProcessingResult(context, providerJobId);
              activeJobs.set(providerJobId, context);
            }
          }
        }
      } catch (error) {
        console.error('Failed to persist generation result:', error);
      }
    }

    return response;
  };

  window.fetch = wrappedFetch;

  const restore = () => {
    if (window.fetch === wrappedFetch) window.fetch = originalFetch;
    unsubscribe();
    delete window.__aiStudioRuntimeBridge;
  };

  window.__aiStudioRuntimeBridge = { restore };
  return restore;
}

export function GenerationRuntimeBridge({ children }: { children: ReactNode }) {
  useEffect(() => installRuntimeBridge(), []);
  return children;
}
