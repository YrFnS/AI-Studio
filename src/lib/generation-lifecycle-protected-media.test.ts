/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';

import { createGenerationLifecycleClient } from './generation-lifecycle';
import type { GenerationDescriptor, GenerationOutput } from './generation-persistence';

const descriptor: GenerationDescriptor = {
  id: 'vid-protected',
  providerId: 'google-aistudio',
  providerName: 'Google AI Studio',
  modelId: 'veo-3.1-generate-preview',
  type: 'video',
  prompt: 'A slow cinematic orbit',
  createdAt: 1_000,
};

describe('protected media lifecycle', () => {
  test('downloads, persists, and exposes a local object URL', async () => {
    const completed: GenerationOutput[][] = [];
    const mediaBlob = new Blob(['video'], { type: 'video/mp4' });
    const client = createGenerationLifecycleClient({
      fetchImpl: async () => new Response(JSON.stringify({
        status: 'processing',
        id: 'aistudio-job.token',
      }), { headers: { 'Content-Type': 'application/json' } }),
      pollImpl: async () => ({
        status: 'completed',
        protectedMedia: {
          version: 1,
          providerId: 'google-aistudio',
          providerJobId: 'operations/video-123',
          kind: 'video',
        },
      }),
      beginImpl: async () => {},
      markProcessingImpl: async () => {},
      completeImpl: async (generation, outputs) => {
        completed.push(
          outputs.filter(
            (output): output is GenerationOutput =>
              typeof output === 'string' || output instanceof Blob,
          ),
        );
        return [generation.id];
      },
      failImpl: async () => {},
      getApiKey: async () => 'secret-key',
      fetchMediaImpl: async () => mediaBlob,
      createObjectUrl: () => 'blob:local-protected-video',
      now: () => 2_000,
    });

    const result = await client.start({
      descriptor,
      endpoint: '/api/generate/video',
      body: {
        providerId: descriptor.providerId,
        modelId: descriptor.modelId,
        prompt: descriptor.prompt,
      },
    }).result;

    expect(completed).toHaveLength(1);
    expect(completed[0][0]).toBe(mediaBlob);
    expect(result.urls).toEqual(['blob:local-protected-video']);
    expect(result.generationIds).toEqual(['vid-protected']);
  });
});
