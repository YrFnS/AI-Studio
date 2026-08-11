export const REMOTE_GENERATION_CANCELLATION_PROVIDERS = [
  'replicate',
  'fal',
  'runway',
  'luma',
] as const;

export type RemoteGenerationCancellationProvider =
  (typeof REMOTE_GENERATION_CANCELLATION_PROVIDERS)[number];

export type GenerationCancellationOutcome =
  | 'requested'
  | 'already-terminal'
  | 'unsupported'
  | 'local-only'
  | 'failed';

export interface GenerationCancellationRequest {
  id: string;
  providerId: string;
  modelId?: string;
}

export interface GenerationCancellationResult {
  outcome: GenerationCancellationOutcome;
  providerId: string;
  remoteAttempted: boolean;
  message: string;
}

export function supportsRemoteGenerationCancellation(
  providerId: string,
): providerId is RemoteGenerationCancellationProvider {
  return (REMOTE_GENERATION_CANCELLATION_PROVIDERS as readonly string[])
    .includes(providerId);
}

export function localOnlyCancellationResult(
  providerId: string,
  message = 'Generation tracking stopped locally. The provider job may continue.',
): GenerationCancellationResult {
  return {
    outcome: 'local-only',
    providerId,
    remoteAttempted: false,
    message,
  };
}
