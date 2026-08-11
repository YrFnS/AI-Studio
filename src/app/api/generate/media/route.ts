import { NextRequest } from 'next/server';

import { MAX_PROTECTED_MEDIA_BYTES } from '@/lib/protected-media';
import {
  MAX_PROTECTED_MEDIA_REQUEST_BYTES,
  parseGenerationRequest,
  protectedMediaRequestSchema,
} from '@/lib/server/generation-request';
import {
  generationErrorResponse,
  noStoreJson,
} from '@/lib/server/generation-response';
import {
  providerFetch,
  PROVIDER_STATUS_TIMEOUT_MS,
} from '@/lib/server/provider-request';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MEDIA_DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;
const GOOGLE_MEDIA_HOSTS = [
  'generativelanguage.googleapis.com',
  'googleapis.com',
  'googleusercontent.com',
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function firstRecord(value: unknown): Record<string, unknown> | null {
  return Array.isArray(value) ? asRecord(value[0]) : null;
}

function extractGoogleMediaUrl(data: Record<string, unknown>): string | null {
  const response = asRecord(data.response);
  const generateVideoResponse = asRecord(response?.generateVideoResponse);
  const sample = firstRecord(generateVideoResponse?.generatedSamples);
  const sampleVideo = asRecord(sample?.video);
  if (typeof sampleVideo?.uri === 'string') return sampleVideo.uri;

  const generatedVideo = firstRecord(response?.generatedVideos);
  const video = asRecord(generatedVideo?.video);
  return typeof video?.uri === 'string' ? video.uri : null;
}

function assertGoogleMediaUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Google returned an invalid protected media URL');
  }
  const hostname = url.hostname.toLowerCase();
  if (!GOOGLE_MEDIA_HOSTS.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  )) {
    throw new Error('Google returned an untrusted protected media host');
  }
  return url;
}

function limitStream(
  source: ReadableStream<Uint8Array>,
  maxBytes: number,
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  let total = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (chunk.done) {
          controller.close();
          return;
        }
        if (!chunk.value) return;

        total += chunk.value.byteLength;
        if (total > maxBytes) {
          await reader.cancel('Protected media exceeded the local size limit');
          controller.error(new Error('Protected media exceeds the 512MB limit'));
          return;
        }
        controller.enqueue(chunk.value);
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseGenerationRequest(
      req,
      protectedMediaRequestSchema,
      MAX_PROTECTED_MEDIA_REQUEST_BYTES,
    );

    const operation = await providerFetch(
      'Google AI Studio',
      `https://generativelanguage.googleapis.com/v1beta/${body.providerJobId}`,
      {
        headers: { 'x-goog-api-key': body.apiKey },
        cache: 'no-store',
      },
      { timeoutMs: PROVIDER_STATUS_TIMEOUT_MS },
    );
    const operationData = await operation.json() as Record<string, unknown>;

    if (!operationData.done) {
      return noStoreJson({
        error: 'Protected media is not ready yet',
        code: 'media_not_ready',
      }, 409);
    }
    if (operationData.error) {
      return noStoreJson({
        error: 'The provider could not prepare the protected media',
        code: 'provider_media_failed',
      }, 400);
    }

    const mediaValue = extractGoogleMediaUrl(operationData);
    if (!mediaValue) {
      return noStoreJson({
        error: 'The provider completed without a protected media URL',
        code: 'provider_media_missing',
      }, 502);
    }

    const mediaUrl = assertGoogleMediaUrl(mediaValue);
    const upstream = await providerFetch(
      'Google AI Studio media',
      mediaUrl,
      {
        headers: {
          'x-goog-api-key': body.apiKey,
          Accept: body.kind === 'video' ? 'video/*,application/octet-stream' : 'image/*',
        },
        cache: 'no-store',
      },
      { timeoutMs: MEDIA_DOWNLOAD_TIMEOUT_MS },
    );

    const declaredLength = Number(upstream.headers.get('content-length') || 0);
    if (declaredLength > MAX_PROTECTED_MEDIA_BYTES) {
      return noStoreJson({
        error: 'Protected media exceeds the 512MB local storage limit',
        code: 'media_too_large',
      }, 413);
    }

    const contentType = upstream.headers.get('content-type')
      ?.split(';')[0]
      .trim()
      .toLowerCase()
      || 'application/octet-stream';
    if (
      !contentType.startsWith('video/')
      && !contentType.startsWith('image/')
      && contentType !== 'application/octet-stream'
    ) {
      return noStoreJson({
        error: 'Provider returned an unsupported protected media type',
        code: 'invalid_media_type',
      }, 502);
    }
    if (!upstream.body) {
      return noStoreJson({
        error: 'Provider returned an empty protected media response',
        code: 'empty_media_response',
      }, 502);
    }

    const headers = new Headers({
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline',
      'Content-Type': contentType,
      'Cross-Origin-Resource-Policy': 'same-origin',
    });
    if (declaredLength > 0) headers.set('Content-Length', String(declaredLength));

    return new Response(
      limitStream(upstream.body, MAX_PROTECTED_MEDIA_BYTES),
      { status: 200, headers },
    );
  } catch (error) {
    return generationErrorResponse(error, {
      logLabel: 'Protected media download error',
      fallbackMessage: 'Failed to download protected media',
    });
  }
}
