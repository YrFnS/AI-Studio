export type GenerationKind = 'image' | 'video';

const IMAGE_PROVIDERS = new Set([
  'openai',
  'stability',
  'replicate',
  'fal',
  'together',
  'fireworks',
  'ideogram',
  'google-aistudio',
  'huggingface',
  'leonardo',
  'recraft',
  'bfl',
  'aimlapi',
]);

const VIDEO_PROVIDERS = new Set([
  'replicate',
  'fal',
  'runway',
  'luma',
  'google-aistudio',
]);

export function supportsGeneration(
  providerName: string,
  kind: GenerationKind,
): boolean {
  return kind === 'image'
    ? IMAGE_PROVIDERS.has(providerName)
    : VIDEO_PROVIDERS.has(providerName);
}

export function getSupportedGenerationKinds(
  providerName: string,
): GenerationKind[] {
  const kinds: GenerationKind[] = [];
  if (IMAGE_PROVIDERS.has(providerName)) kinds.push('image');
  if (VIDEO_PROVIDERS.has(providerName)) kinds.push('video');
  return kinds;
}
