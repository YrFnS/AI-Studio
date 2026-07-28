import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;

export function isPrivateIpAddress(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0];

  if (normalized.startsWith('::ffff:')) {
    return isPrivateIpAddress(normalized.slice('::ffff:'.length));
  }

  if (isIP(normalized) === 4) {
    const parts = normalized.split('.').map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }

  if (isIP(normalized) === 6) {
    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      /^fe[89ab]/.test(normalized) ||
      normalized.startsWith('2001:db8:')
    );
  }

  return true;
}

async function assertPublicHost(hostname: string): Promise<void> {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized.endsWith('.local')) {
    throw new Error('Local image URLs are not allowed');
  }

  if (isIP(normalized)) {
    if (isPrivateIpAddress(normalized)) throw new Error('Private network image URLs are not allowed');
    return;
  }

  const addresses = await lookup(normalized, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateIpAddress(address))) {
    throw new Error('Image URL resolves to a private or unavailable address');
  }
}

function dataUrlToBlob(dataUrl: string, maxBytes: number): Blob {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!match) throw new Error('Invalid image data URL');
  const bytes = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (bytes.byteLength > maxBytes) throw new Error('Image exceeds the 20MB limit');
  return new Blob([new Uint8Array(bytes)], { type: match[1] });
}

async function fetchRemoteImage(
  url: URL,
  maxBytes: number,
  timeoutMs: number,
  redirectCount = 0,
): Promise<Blob> {
  if (url.protocol !== 'https:') throw new Error('Only HTTPS image URLs are allowed');
  if (url.username || url.password) throw new Error('Image URLs with embedded credentials are not allowed');
  await assertPublicHost(url.hostname);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: controller.signal,
      headers: { Accept: 'image/*,application/octet-stream;q=0.5' },
    });

    if (response.status >= 300 && response.status < 400) {
      if (redirectCount >= MAX_REDIRECTS) throw new Error('Too many image URL redirects');
      const location = response.headers.get('location');
      if (!location) throw new Error('Image redirect is missing a location');
      return fetchRemoteImage(new URL(location, url), maxBytes, timeoutMs, redirectCount + 1);
    }

    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);

    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > maxBytes) throw new Error('Image exceeds the 20MB limit');

    const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (contentType && !contentType.startsWith('image/') && contentType !== 'application/octet-stream') {
      throw new Error('Remote URL did not return an image');
    }

    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > maxBytes) throw new Error('Image exceeds the 20MB limit');
    return new Blob([bytes], { type: contentType || 'application/octet-stream' });
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveImageBlob(
  imageUrl: string,
  options: { maxBytes?: number; timeoutMs?: number } = {},
): Promise<Blob> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (imageUrl.startsWith('data:')) return dataUrlToBlob(imageUrl, maxBytes);

  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    throw new Error('Invalid image URL');
  }
  return fetchRemoteImage(parsed, maxBytes, timeoutMs);
}
