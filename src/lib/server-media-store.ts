import { randomUUID } from 'node:crypto';

export interface ProtectedMediaContext {
  url: string;
  headers: Record<string, string>;
  createdAt: number;
}

type ProtectedMediaRegistryGlobal = typeof globalThis & {
  __aiStudioProtectedMedia?: Map<string, ProtectedMediaContext>;
};

const globalRegistry = globalThis as ProtectedMediaRegistryGlobal;
const protectedMedia =
  globalRegistry.__aiStudioProtectedMedia ??
  new Map<string, ProtectedMediaContext>();

if (!globalRegistry.__aiStudioProtectedMedia) {
  globalRegistry.__aiStudioProtectedMedia = protectedMedia;
}

const MEDIA_TTL_MS = 2 * 60 * 60 * 1000;

function removeExpiredMedia(now = Date.now()): void {
  for (const [token, media] of protectedMedia.entries()) {
    if (now - media.createdAt > MEDIA_TTL_MS) {
      protectedMedia.delete(token);
    }
  }
}

export function registerProtectedMedia(
  media: Omit<ProtectedMediaContext, 'createdAt'>,
): string {
  removeExpiredMedia();

  const token = randomUUID();
  protectedMedia.set(token, {
    ...media,
    createdAt: Date.now(),
  });
  return token;
}

export function getProtectedMedia(
  token: string,
): ProtectedMediaContext | null {
  removeExpiredMedia();
  return protectedMedia.get(token) ?? null;
}
