import {
  type GenerationCancellationResult,
  supportsRemoteGenerationCancellation,
} from '@/lib/generation-cancellation';
import {
  providerFetch,
  PROVIDER_STATUS_TIMEOUT_MS,
  ProviderRequestError,
} from '@/lib/server/provider-request';

export interface ProviderGenerationCancellationContext {
  providerId: string;
  providerJobId: string;
  modelId?: string;
  apiKey: string;
}

type ProviderFetchLike = (
  provider: string,
  input: Parameters<typeof globalThis.fetch>[0],
  init?: RequestInit,
  options?: { timeoutMs?: number; maxErrorBytes?: number },
) => Promise<Response>;

function result(
  providerId: string,
  outcome: GenerationCancellationResult['outcome'],
  message: string,
  remoteAttempted = true,
): GenerationCancellationResult {
  return { providerId, outcome, message, remoteAttempted };
}

function alreadyTerminal(
  providerId: string,
  error: unknown,
): GenerationCancellationResult | null {
  if (!(error instanceof ProviderRequestError)) return null;
  if (![400, 404, 409, 410, 422].includes(error.providerStatus || 0)) {
    return null;
  }

  return result(
    providerId,
    'already-terminal',
    'The provider job had already completed, been cancelled, or was no longer available.',
  );
}

export function createProviderGenerationCanceller(
  fetchImpl: ProviderFetchLike = providerFetch,
) {
  const send = async (
    provider: string,
    input: Parameters<typeof globalThis.fetch>[0],
    init: RequestInit,
  ): Promise<void> => {
    const response = await fetchImpl(
      provider,
      input,
      init,
      { timeoutMs: PROVIDER_STATUS_TIMEOUT_MS },
    );
    // Consume even an empty success response so the shared provider transport
    // can release its deadline timer immediately.
    await response.arrayBuffer();
  };

  return async function cancelProviderGeneration(
    context: ProviderGenerationCancellationContext,
  ): Promise<GenerationCancellationResult> {
    const { providerId, providerJobId, modelId, apiKey } = context;

    if (!supportsRemoteGenerationCancellation(providerId)) {
      return result(
        providerId,
        'unsupported',
        `${providerId} does not expose a verified remote cancellation adapter in AI Studio. The local lifecycle was stopped, but provider work may continue.`,
        false,
      );
    }

    try {
      switch (providerId) {
        case 'replicate':
          await send(
            'Replicate',
            `https://api.replicate.com/v1/predictions/${encodeURIComponent(providerJobId)}/cancel`,
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${apiKey}` },
              cache: 'no-store',
            },
          );
          return result(
            providerId,
            'requested',
            'Replicate accepted the prediction cancellation request.',
          );

        case 'fal': {
          if (!modelId) {
            return result(
              providerId,
              'unsupported',
              'Fal cancellation needs the original model identifier. The local lifecycle was stopped, but provider work may continue.',
              false,
            );
          }
          await send(
            'Fal.ai',
            `https://queue.fal.run/${modelId}/requests/${encodeURIComponent(providerJobId)}/cancel`,
            {
              method: 'POST',
              headers: { Authorization: `Key ${apiKey}` },
              cache: 'no-store',
            },
          );
          return result(
            providerId,
            'requested',
            'Fal accepted the queue cancellation request.',
          );
        }

        case 'runway':
          await send(
            'Runway',
            `https://api.dev.runwayml.com/v1/tasks/${encodeURIComponent(providerJobId)}`,
            {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'X-Runway-Version': '2024-11-06',
              },
              cache: 'no-store',
            },
          );
          return result(
            providerId,
            'requested',
            'Runway accepted the task cancellation request.',
          );

        case 'luma':
          await send(
            'Luma AI',
            `https://api.lumalabs.ai/dream-machine/v1/generations/${encodeURIComponent(providerJobId)}`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${apiKey}` },
              cache: 'no-store',
            },
          );
          return result(
            providerId,
            'requested',
            'Luma accepted the generation deletion request. Whether in-progress compute stops immediately depends on the provider state.',
          );
      }
    } catch (error) {
      const terminal = alreadyTerminal(providerId, error);
      if (terminal) return terminal;
      throw error;
    }
  };
}

export const cancelProviderGeneration = createProviderGenerationCanceller();
