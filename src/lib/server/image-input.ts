import { Buffer } from 'node:buffer';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import {
  MAX_REFERENCE_IMAGE_BYTES,
  MAX_REFERENCE_IMAGE_LABEL,
} from '@/lib/reference-image-limits';

const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 15_000;

export type ImageInputErrorCode =
  | 'invalid_image_input'
  | 'unsupported_image_type'
  | 'image_too_large'
  | 'unsafe_image_url'
  | 'image_fetch_failed'
  | 'image_fetch_timeout';

export class ImageInputError extends Error {
  readonly code: ImageInputErrorCode;
  readonly status: number;

  constructor(
    code: ImageInputErrorCode,
    message: string,
    status = 400,
  ) {
    super(message);
    this.name = 'ImageInputError';
    this.code = code;
    this.status = status;
  }
}

function parseIpv4(address: string): number[] | null {
  const parts = address.split('.').map((part) => Number(part));
  if (
    parts.length !== 4
    || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return null;
  }
  return parts;
}

function isPrivateIpv4(address: string): boolean {
  const parts = parseIpv4(address);
  if (!parts) return true;

  const [a, b] = parts;
  return (
    a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0];

  if (normalized === '::' || normalized === '::1') return true;
  if (/^f[cd]/.test(normalized)) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith('ff')) return true;

  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mappedIpv4) return isPrivateIpv4(mappedIpv4);

  return false;
}

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

async function assertPublicHostname(hostname: string): Promise<void> {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');

  if (
    normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized.endsWith('.local')
    || normalized.endsWith('.internal')
  ) {
    throw new ImageInputError(
      'unsafe_image_url',
      'Local and internal image URLs are not allowed',
    );
  }

  if (isIP(normalized)) {
    if (isPrivateAddress(normalized)) {
      throw new ImageInputError(
        'unsafe_image_url',
        'Private or reserved image addresses are not allowed',
      );
    }
    return;
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(normalized, { all: true, verbatim: true });
  } catch {
    throw new ImageInputError(
      'image_fetch_failed',
      'Image host could not be resolved',
    );
  }

  if (addresses.length === 0) {
    throw new ImageInputError(
      'image_fetch_failed',
      'Image host could not be resolved',
    );
  }

  if (addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new ImageInputError(
      'unsafe_image_url',
      'Image host resolves to a private or reserved address',
    );
  }
}

function dataUrlToBlob(value: string): Blob {
  const match = value.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);
  if (!match) {
    throw new ImageInputError('invalid_image_input', 'Invalid image data URL');
  }

  const contentType = match[1] || 'application/octet-stream';
  if (!contentType.startsWith('image/')) {
    throw new ImageInputError(
      'unsupported_image_type',
      'Data URL must contain an image',
    );
  }

  let bytes: Buffer;
  try {
    bytes = match[2]
      ? Buffer.from(match[3], 'base64')
      : Buffer.from(decodeURIComponent(match[3]), 'utf8');
  } catch {
    throw new ImageInputError('invalid_image_input', 'Invalid image data URL');
  }

  if (bytes.byteLength > MAX_REFERENCE_IMAGE_BYTES) {
    throw new ImageInputError(
      'image_too_large',
      `Image exceeds the ${MAX_REFERENCE_IMAGE_LABEL} limit`,
      413,
    );
  }

  const copy = Uint8Array.from(bytes);
  return new Blob([copy.buffer], { type: contentType });
}

async function readResponseBlob(response: Response): Promise<Blob> {
  const contentType = response.headers.get('content-type')?.split(';')[0].trim()
    || 'application/octet-stream';

  if (!contentType.startsWith('image/') && contentType !== 'application/octet-stream') {
    throw new ImageInputError(
      'unsupported_image_type',
      `Remote URL returned unsupported content type: ${contentType}`,
    );
  }

  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_REFERENCE_IMAGE_BYTES) {
    throw new ImageInputError(
      'image_too_large',
      `Remote image exceeds the ${MAX_REFERENCE_IMAGE_LABEL} limit`,
      413,
    );
  }

  if (!response.body) {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_REFERENCE_IMAGE_BYTES) {
      throw new ImageInputError(
        'image_too_large',
        `Remote image exceeds the ${MAX_REFERENCE_IMAGE_LABEL} limit`,
        413,
      );
    }
    return new Blob([buffer], { type: contentType });
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    total += value.byteLength;
    if (total > MAX_REFERENCE_IMAGE_BYTES) {
      await reader.cancel();
      throw new ImageInputError(
        'image_too_large',
        `Remote image exceeds the ${MAX_REFERENCE_IMAGE_LABEL} limit`,
        413,
      );
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new Blob([merged.buffer], { type: contentType });
}

async function fetchRemoteImage(value: string, redirectCount = 0): Promise<Blob> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ImageInputError('invalid_image_input', 'Invalid image URL');
  }

  if (url.protocol !== 'https:') {
    throw new ImageInputError(
      'unsafe_image_url',
      'Remote image URLs must use HTTPS',
    );
  }
  if (url.username || url.password) {
    throw new ImageInputError(
      'unsafe_image_url',
      'Image URLs with credentials are not allowed',
    );
  }

  await assertPublicHostname(url.hostname);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Accept: 'image/*,application/octet-stream;q=0.8',
      },
    });

    if (response.status >= 300 && response.status < 400) {
      if (redirectCount >= MAX_REDIRECTS) {
        throw new ImageInputError(
          'image_fetch_failed',
          'Remote image redirected too many times',
        );
      }
      const location = response.headers.get('location');
      if (!location) {
        throw new ImageInputError(
          'image_fetch_failed',
          'Remote image redirect is missing a location',
        );
      }
      return fetchRemoteImage(new URL(location, url).toString(), redirectCount + 1);
    }

    if (!response.ok) {
      throw new ImageInputError(
        'image_fetch_failed',
        `Failed to fetch remote image (${response.status})`,
      );
    }

    return await readResponseBlob(response);
  } catch (error) {
    if (error instanceof ImageInputError) throw error;
    if (controller.signal.aborted) {
      throw new ImageInputError(
        'image_fetch_timeout',
        'Remote image did not respond before the deadline',
        504,
      );
    }
    throw new ImageInputError(
      'image_fetch_failed',
      'Failed to fetch remote image',
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveImageBlob(value: string): Promise<Blob> {
  if (!value || typeof value !== 'string') {
    throw new ImageInputError('invalid_image_input', 'Image URL is required');
  }

  if (value.startsWith('data:')) return dataUrlToBlob(value);
  return fetchRemoteImage(value);
}
