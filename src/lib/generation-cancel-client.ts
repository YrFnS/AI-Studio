'use client';

import { generationFetch as fetch } from '@/lib/generation-client';
import type {
  GenerationCancellationRequest,
  GenerationCancellationResult,
} from '@/lib/generation-cancellation';

export class GenerationCancellationError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'GenerationCancellationError';
    this.status = status;
  }
}

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readPayload(response: Response): Promise<Record<string, unknown>> {
  try {
    const payload = await response.json() as unknown;
    return isRecord(payload) ? payload : {};
  } catch {
    return {};
  }
}

export function createGenerationCancellationClient(
  fetchImpl: FetchLike = fetch,
) {
  return async function cancelGenerationJob(
    request: GenerationCancellationRequest,
  ): Promise<GenerationCancellationResult> {
    const response = await fetchImpl('/api/generate/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(request),
    });
    const payload = await readPayload(response);

    if (!response.ok) {
      throw new GenerationCancellationError(
        typeof payload.error === 'string'
          ? payload.error
          : `Generation cancellation failed (${response.status})`,
        response.status,
      );
    }

    if (
      typeof payload.outcome !== 'string'
      || typeof payload.providerId !== 'string'
      || typeof payload.remoteAttempted !== 'boolean'
      || typeof payload.message !== 'string'
    ) {
      throw new GenerationCancellationError(
        'Generation cancellation response was not recognized',
      );
    }

    return payload as unknown as GenerationCancellationResult;
  };
}

export const cancelGenerationJob = createGenerationCancellationClient();
