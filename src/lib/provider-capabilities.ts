import {
  getProviderOperations,
  type GenerationOperationId,
} from '@/lib/generation-registry';

export type GenerationKind = 'image' | 'video';

const IMAGE_OPERATIONS = new Set<GenerationOperationId>([
  'text-to-image',
  'image-to-image',
  'edit',
  'inpaint',
  'variation',
  'upscale',
]);

const VIDEO_OPERATIONS = new Set<GenerationOperationId>([
  'text-to-video',
  'image-to-video',
]);

export function supportsGeneration(
  providerName: string,
  kind: GenerationKind,
): boolean {
  const operations = getProviderOperations(providerName);
  const expected = kind === 'image' ? IMAGE_OPERATIONS : VIDEO_OPERATIONS;
  return operations.some((operation) => expected.has(operation));
}

export function getSupportedGenerationKinds(
  providerName: string,
): GenerationKind[] {
  const kinds: GenerationKind[] = [];
  if (supportsGeneration(providerName, 'image')) kinds.push('image');
  if (supportsGeneration(providerName, 'video')) kinds.push('video');
  return kinds;
}
