'use client';

import * as data from '@/lib/data';
import type { GenerationRecord } from '@/lib/data';

export interface GenerationDescriptor {
  id: string;
  providerId: string;
  providerName: string;
  modelId: string;
  type: 'image' | 'video';
  prompt: string;
  negativePrompt?: string;
  params?: Record<string, unknown>;
  inputImageUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
  parentGenerationId?: string;
  createdAt: number;
}

function safeParams(params?: Record<string, unknown>): string | undefined {
  if (!params) return undefined;
  const { apiKey: _apiKey, ...safe } = params;
  return JSON.stringify(safe);
}

function toRecord(
  descriptor: GenerationDescriptor,
  status: GenerationRecord['status'],
  overrides: Partial<GenerationRecord> = {},
): GenerationRecord {
  return {
    id: descriptor.id,
    providerId: descriptor.providerId,
    providerName: descriptor.providerName,
    modelId: descriptor.modelId,
    type: descriptor.type,
    prompt: descriptor.prompt,
    negativePrompt: descriptor.negativePrompt,
    params: safeParams(descriptor.params),
    inputImageUrl: descriptor.inputImageUrl,
    width: descriptor.width,
    height: descriptor.height,
    duration: descriptor.duration,
    parentGenerationId: descriptor.parentGenerationId,
    status,
    isFavorite: false,
    createdAt: descriptor.createdAt,
    ...overrides,
  };
}

async function persist(record: GenerationRecord): Promise<void> {
  try {
    await data.saveGeneration(record);
  } catch (error) {
    // Generation should still complete even if browser storage is unavailable.
    console.error('Failed to persist generation', error);
  }
}

export function createGenerationId(prefix: 'img' | 'vid' | 'cin' | 'gen' = 'gen'): string {
  const randomPart = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `${prefix}-${Date.now()}-${randomPart}`;
}

export async function beginGeneration(descriptor: GenerationDescriptor): Promise<void> {
  await persist(toRecord(descriptor, 'processing'));
}

export async function markGenerationProcessing(
  descriptor: GenerationDescriptor,
  providerJobId: string,
): Promise<void> {
  await persist(toRecord(descriptor, 'processing', { providerJobId }));
}

export async function completeGeneration(
  descriptor: GenerationDescriptor,
  urls: Array<string | null | undefined>,
  providerJobId?: string,
): Promise<string[]> {
  const validUrls = urls.filter((url): url is string => Boolean(url));
  if (validUrls.length === 0) {
    await failGeneration(descriptor, 'Provider completed without returning a result', providerJobId);
    return [];
  }

  const ids: string[] = [];
  for (const [index, resultUrl] of validUrls.entries()) {
    const id = index === 0 ? descriptor.id : createGenerationId(descriptor.type === 'video' ? 'vid' : 'img');
    const itemDescriptor: GenerationDescriptor = {
      ...descriptor,
      id,
      createdAt: descriptor.createdAt + index,
    };
    await persist(toRecord(itemDescriptor, 'completed', { resultUrl, providerJobId }));
    ids.push(id);
  }
  return ids;
}

export async function failGeneration(
  descriptor: GenerationDescriptor,
  error: string,
  providerJobId?: string,
): Promise<void> {
  await persist(toRecord(descriptor, 'failed', { error, providerJobId }));
}
