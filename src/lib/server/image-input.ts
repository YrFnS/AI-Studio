import { Buffer } from 'node:buffer';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 15_000;

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
    throw new Error('Local and internal image URLs are not allowed');
  }

  if (isIP(normalized)) {
    if (isPrivateAddress(normalized)) {
      throw new Error('Private or reserved image addresses are not allowed');
    }
    return;
  }

  const addresses = await lookup(normalized, { all: true, verbatim: true });
  if (addresses.length === 0) {
    throw new Error('Image host could not be resolved');
  }

  if (addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('Image host resolves to a private or reserved address');
  }
}

function dataUrlToBlob(value: string): Blob {
  const match = value.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) throw new Error('Invalid image data URL');

  const contentType = match[1] || 'application/octet-stream';
  if (!contentType.startsWith('image/')) {
    throw new Error('Data URL must contain an image');
  }

  const bytes = match[2]
    ? Buffer.from(match[3], 'base64')
    : Buffer.from(decodeURIComponent(match[3]), 'utf8');

  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('Image exceeds the 20MB limit');
  }

  const copy = Uint8Array.from(bytes);
  return new Blob([copy.buffer], { type: contentType });
}

async function readResponseBlob(response: Response): Promise<Blob> {
  const contentType = response.headers.get('content-type')?.split(';')[0].trim()
    || 'application/octet-stream';

  if (!contentType.startsWith('image/') && contentType !== 'application/octet-stream') {
    throw new Error(`Remote URL returned unsupported content type: ${contentType}`);
  }

  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_IMAGE_BYTES) {
    throw new Error('Remote image exceeds the 20MB limit');
  }

  if (!response.body) {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      throw new Error('Remote image exceeds the 20MB limit');
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
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new Error('Remote image exceeds the 20MB limit');
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
    throw new Error('Invalid image URL');
  }

  if (url.protocol !== 'https:') {
    throw new Error('Remote image URLs must use HTTPS');
  }
  if (url.username || url.password) {
    throw new Error('Image URLs with credentials are not allowed');
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
        throw new Error('Remote image redirected too many times');
      }
      const location = response.headers.get('location');
      if (!location) throw new Error('Remote image redirect is missing a location');
      return fetchRemoteImage(new URL(location, url).toString(), redirectCount + 1);
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch remote image: ${response.status}`);
    }

    return readResponseBlob(response);
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveImageBlob(value: string): Promise<Blob> {
  if (!value || typeof value !== 'string') {
    throw new Error('Image URL is required');
  }

  if (value.startsWith('data:')) return dataUrlToBlob(value);
  return fetchRemoteImage(value);
}
