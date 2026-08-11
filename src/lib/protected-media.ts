export const PROTECTED_MEDIA_DESCRIPTOR_VERSION = 1 as const;

export type ProtectedMediaKind = 'video' | 'image';

export interface ProtectedMediaDescriptor {
  version: typeof PROTECTED_MEDIA_DESCRIPTOR_VERSION;
  providerId: string;
  providerJobId: string;
  kind: ProtectedMediaKind;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseProtectedMediaDescriptor(
  value: unknown,
): ProtectedMediaDescriptor | null {
  if (!isRecord(value)) return null;
  if (value.version !== PROTECTED_MEDIA_DESCRIPTOR_VERSION) return null;
  if (value.kind !== 'video' && value.kind !== 'image') return null;
  if (typeof value.providerId !== 'string' || value.providerId.length === 0) {
    return null;
  }
  if (
    typeof value.providerJobId !== 'string'
    || value.providerJobId.length === 0
  ) {
    return null;
  }

  return {
    version: PROTECTED_MEDIA_DESCRIPTOR_VERSION,
    providerId: value.providerId,
    providerJobId: value.providerJobId,
    kind: value.kind,
  };
}
