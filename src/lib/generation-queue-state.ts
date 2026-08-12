import type { GenerationStatus } from '@/lib/types';

export function isActiveGenerationStatus(status: GenerationStatus): boolean {
  return status === 'pending' || status === 'processing';
}

export function keepActiveGenerationQueueItems<
  T extends { status: GenerationStatus },
>(items: readonly T[]): T[] {
  return items.filter((item) => isActiveGenerationStatus(item.status));
}
