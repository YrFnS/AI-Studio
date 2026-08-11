'use client';

import * as data from '@/lib/data';
import type { GenerationRecord } from '@/lib/data';

export type GenerationOutput = string | Blob;

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

function isValidOutput(value: GenerationOutput | null | undefined): value is GenerationOutput {
  return typeof value === 'string'
    ? value.length > 0
    : value instanceof Blob && value.size > 0;
}

export async function completeGeneration(
  descriptor: GenerationDescriptor,
  outputs: Array<GenerationOutput | null | undefined>,
  providerJobId?: string,
): Promise<string[]> {
  const validOutputs = outputs.filter(isValidOutput);
  if (validOutputs.length === 0) {
    await failGeneration(descriptor, 'Provider completed without returning a result', providerJobId);
    return [];
  }

  const ids: string[] = [];
  for (const [index, output] of validOutputs.entries()) {
    const id = index === 0
      ? descriptor.id
      : createGenerationId(descriptor.type === 'video' ? 'vid' : 'img');
    const itemDescriptor: GenerationDescriptor = {
      ...descriptor,
      id,
      createdAt: descriptor.createdAt + index,
    };

    if (typeof output === 'string') {
      await persist(toRecord(itemDescriptor, 'completed', {
        resultUrl: output,
        providerJobId,
      }));
      ids.push(id);
      continue;
    }

    try {
      const asset = await data.saveGenerationMediaAsset(id, output);
      await persist(toRecord(itemDescriptor, 'completed', {
        mediaAssetId: asset.id,
        resultMimeType: asset.mimeType,
        resultSize: asset.size,
        providerJobId,
      }));
      ids.push(id);
    } catch (error) {
      console.error('Failed to persist protected generation media', error);
      await failGeneration(
        itemDescriptor,
        'Protected media could not be stored locally',
        providerJobId,
      );
    }
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
