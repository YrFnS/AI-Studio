/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';

import {
  GenerationRegistryError,
  decorateRegisteredProviders,
  getModelOperations,
  listRegisteredModels,
  requireModelOperation,
  supportsModelOperation,
} from './generation-registry';

describe('authoritative generation registry', () => {
  test('registers operations at provider and model granularity', () => {
    expect(getModelOperations('openai', 'gpt-image-1')).toEqual([
      'text-to-image',
      'edit',
      'inpaint',
      'variation',
    ]);
    expect(getModelOperations('openai', 'dall-e-3')).toEqual([
      'text-to-image',
    ]);
    expect(getModelOperations('runway', 'gen4_turbo')).toEqual([
      'image-to-video',
    ]);
  });

  test('does not expose catalog claims without an executable route contract', () => {
    expect(getModelOperations('openai', 'chatgpt-4o-image')).toEqual([]);
    expect(getModelOperations('google-vertex', 'imagen-4.0-generate-001')).toEqual([]);
    expect(getModelOperations('replicate', 'black-forest-labs/flux-kontext-pro'))
      .not.toContain('edit');
    expect(getModelOperations('fal', 'fal-ai/flux-kontext-pro'))
      .not.toContain('edit');
    expect(getModelOperations('leonardo', 'phoenix')).toEqual([]);
  });

  test('requires both operation and route ownership', () => {
    expect(requireModelOperation(
      'runway',
      'gen4.5',
      'image-to-video',
      'img2vid',
    )).toMatchObject({
      adapterId: 'runway.image-to-video',
      verification: 'contract-reviewed',
    });

    expect(() => requireModelOperation(
      'replicate',
      'bytedance/seedance-2.0',
      'image-to-video',
      'img2vid',
    )).toThrow(GenerationRegistryError);
  });

  test('limits upscale and variation to implemented model contracts', () => {
    expect(supportsModelOperation(
      'stability',
      'creative-upscale',
      'upscale',
      'upscale',
    )).toBe(true);
    expect(supportsModelOperation(
      'openai',
      'gpt-image-1',
      'upscale',
      'upscale',
    )).toBe(false);
    expect(supportsModelOperation(
      'replicate',
      'black-forest-labs/flux-dev',
      'variation',
      'variations',
    )).toBe(false);
  });

  test('decorates API providers and removes unregistered models and providers', () => {
    const providers = decorateRegisteredProviders([
      {
        name: 'openai',
        displayName: 'OpenAI',
        models: [
          {
            providerName: 'openai',
            modelId: 'gpt-image-1',
            name: 'GPT Image 1',
            type: 'image',
            capabilities: 't2i,i2i,edit,inpaint',
          },
          {
            providerName: 'openai',
            modelId: 'chatgpt-4o-image',
            name: 'ChatGPT 4o Image',
            type: 'image',
            capabilities: 't2i,edit',
          },
        ],
      },
      {
        name: 'google-vertex',
        displayName: 'Google Vertex',
        models: [{
          providerName: 'google-vertex',
          modelId: 'imagen-4.0-generate-001',
          name: 'Imagen 4',
          type: 'image',
          capabilities: 't2i',
        }],
      },
    ]);

    expect(providers).toHaveLength(1);
    expect(providers[0].models).toHaveLength(1);
    expect(providers[0].models[0]).toMatchObject({
      modelId: 'gpt-image-1',
      capabilities: 't2i,edit,inpaint,variations',
      operations: ['text-to-image', 'edit', 'inpaint', 'variation'],
    });
  });

  test('every exposed contract has route and adapter ownership', () => {
    const models = listRegisteredModels();
    expect(models.length).toBeGreaterThan(0);

    for (const model of models) {
      expect(model.contracts.length).toBeGreaterThan(0);
      for (const contract of model.contracts) {
        expect(contract.adapterId.length).toBeGreaterThan(0);
        expect(contract.routes.length).toBeGreaterThan(0);
        expect(contract.verification).not.toBe('live-verified');
      }
    }
  });
});
