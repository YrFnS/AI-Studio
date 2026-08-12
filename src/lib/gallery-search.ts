export interface SearchableGeneration {
  prompt: string;
  negativePrompt?: string | null;
  providerId?: string | null;
  providerName?: string | null;
  modelId?: string | null;
  type?: string | null;
  status?: string | null;
}

export function matchesGenerationSearch(
  generation: SearchableGeneration,
  query: string,
): boolean {
  const terms = query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (terms.length === 0) return true;

  const searchable = [
    generation.prompt,
    generation.negativePrompt,
    generation.providerId,
    generation.providerName,
    generation.modelId,
    generation.type,
    generation.status,
  ]
    .filter((value): value is string => typeof value === 'string')
    .join('\n')
    .toLocaleLowerCase();

  return terms.every((term) => searchable.includes(term));
}
