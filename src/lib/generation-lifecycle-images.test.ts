/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';

import {
  createGenerationLifecycleClient,
  type GenerationLifecycleDependencies,
} from './generation-lifecycle';
import type { GenerationDescriptor } from './generation-persistence';

function jsonResponse(payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  });
}

const descriptor: GenerationDescriptor = {
  id: 'img-edit-lifecycle',
  providerId: 'openai',
  providerName: 'OpenAI',
  modelId: 'gpt-image-1',
  type: 'image',
  prompt: 'Replace the masked area',
  createdAt: 1_000,
};

function dependencies(
  overrides: Partial<GenerationLifecycleDependencies> = {},
): GenerationLifecycleDependencies {
  return {
    fetchImpl: async () => jsonResponse({
      status: 'completed',
      images: ['data:image/png;base64,edited'],
    }),
    pollImpl: async () => ({ status: 'completed', urls: [] }),
    beginImpl: async () => {},
    markProcessingImpl: async () => {},
    completeImpl: async (generation) => [generation.id],
    failImpl: async () => {},
    getApiKey: async () => 'key',
    now: () => 2_000,
    ...overrides,
  };
}

describe('generation lifecycle image response compatibility', () => {
  test('persists dedicated edit-route images responses', async () => {
    const completed: string[][] = [];
    const client = createGenerationLifecycleClient(dependencies({
      completeImpl: async (generation, urls) => {
        completed.push([...urls]);
        return [generation.id];
      },
    }));

    const result = await client.start({
      descriptor,
      endpoint: '/api/generate/edit',
      body: {
        providerId: 'openai',
        modelId: 'gpt-image-1',
        prompt: descriptor.prompt,
        image: 'data:image/png;base64,source',
      },
    }).result;

    expect(result.urls).toEqual(['data:image/png;base64,edited']);
    expect(completed).toEqual([['data:image/png;base64,edited']]);
  });
});
