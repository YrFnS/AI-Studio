'use client';

import { generationFetch } from '@/lib/generation-client';
import type { ProtectedMediaDescriptor } from '@/lib/protected-media';

export const MAX_PROTECTED_MEDIA_BYTES = 512 * 1024 * 1024;

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export class ProtectedMediaDownloadError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ProtectedMediaDownloadError';
    this.status = status;
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { error?: unknown };
    if (typeof payload.error === 'string' && payload.error.length > 0) {
      return payload.error;
    }
  } catch {
    // The route may have failed before it could produce JSON.
  }
  return `Protected media download failed (${response.status})`;
}

export async function downloadProtectedMedia(
  descriptor: ProtectedMediaDescriptor,
  apiKey: string,
  options: {
    fetchImpl?: FetchLike;
    signal?: AbortSignal;
  } = {},
): Promise<Blob> {
  const fetchImpl = options.fetchImpl ?? generationFetch;
  const response = await fetchImpl('/api/generate/media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    signal: options.signal,
    body: JSON.stringify({
      ...descriptor,
      apiKey,
    }),
  });

  if (!response.ok) {
    throw new ProtectedMediaDownloadError(
      await readError(response),
      response.status,
    );
  }

  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_PROTECTED_MEDIA_BYTES) {
    throw new ProtectedMediaDownloadError(
      'Protected media exceeds the 512MB local storage limit',
      413,
    );
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new ProtectedMediaDownloadError('Provider returned an empty media file');
  }
  if (blob.size > MAX_PROTECTED_MEDIA_BYTES) {
    throw new ProtectedMediaDownloadError(
      'Protected media exceeds the 512MB local storage limit',
      413,
    );
  }
  if (
    blob.type
    && !blob.type.startsWith('video/')
    && !blob.type.startsWith('image/')
    && blob.type !== 'application/octet-stream'
  ) {
    throw new ProtectedMediaDownloadError(
      `Provider returned unsupported media type: ${blob.type}`,
    );
  }

  return blob;
}
