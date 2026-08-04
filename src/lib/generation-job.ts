import { Buffer } from 'node:buffer';

export type GenerationJobKind = 'image' | 'video';

export interface GenerationJobToken {
  version: 1;
  providerId: string;
  modelId?: string;
  jobId: string;
  kind: GenerationJobKind;
}

const TOKEN_PREFIX = 'aistudio-job.';
const MAX_TOKEN_LENGTH = 16_384;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function encodeGenerationJobToken(
  input: Omit<GenerationJobToken, 'version'>,
): string {
  if (!isNonEmptyString(input.providerId)) {
    throw new Error('providerId is required to encode a generation job');
  }
  if (!isNonEmptyString(input.jobId)) {
    throw new Error('jobId is required to encode a generation job');
  }
  if (input.kind !== 'image' && input.kind !== 'video') {
    throw new Error('kind must be image or video');
  }

  const payload: GenerationJobToken = {
    version: 1,
    providerId: input.providerId,
    modelId: isNonEmptyString(input.modelId) ? input.modelId : undefined,
    jobId: input.jobId,
    kind: input.kind,
  };

  return `${TOKEN_PREFIX}${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')}`;
}

export function decodeGenerationJobToken(value: string): GenerationJobToken | null {
  if (
    !isNonEmptyString(value)
    || !value.startsWith(TOKEN_PREFIX)
    || value.length > MAX_TOKEN_LENGTH
  ) {
    return null;
  }

  try {
    const encoded = value.slice(TOKEN_PREFIX.length);
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as Partial<GenerationJobToken>;

    if (
      parsed.version !== 1
      || !isNonEmptyString(parsed.providerId)
      || !isNonEmptyString(parsed.jobId)
      || (parsed.kind !== 'image' && parsed.kind !== 'video')
      || (parsed.modelId !== undefined && !isNonEmptyString(parsed.modelId))
    ) {
      return null;
    }

    return {
      version: 1,
      providerId: parsed.providerId,
      modelId: parsed.modelId,
      jobId: parsed.jobId,
      kind: parsed.kind,
    };
  } catch {
    return null;
  }
}
