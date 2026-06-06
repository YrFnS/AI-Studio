// ---------------------------------------------------------------------------
// Types for Model Compare
// ---------------------------------------------------------------------------

import type { Provider, ProviderModel } from '@/components/studio/image-studio-types';

export type { Provider, ProviderModel };

export interface CompareResult {
  slotIndex: number;
  status: 'idle' | 'generating' | 'completed' | 'failed';
  resultUrl: string | null;
  error: string | null;
  cost: string | null;
  providerName: string;
  modelName: string;
  providerColor: string;
  jobId?: string;
}

export interface CompareSlot {
  providerId: string;
  modelId: string;
}
