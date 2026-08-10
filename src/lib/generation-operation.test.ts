/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';

import {
  GenerationOperationError,
  prepareGenerationOperation,
  resolveGenerationOperationTarget,
  type GenerationOperationProvider,
} from './generation-operation';

const providers: GenerationOperationProvider[] = [
  {
    id: 'openai',
    name: 'openai',
    displayName: 'OpenAI',
    color: '#10a37f',
    models: [
      {
        modelId: 'dall-e-3',
        name: 'DALL-E 3',
        type: 'image',
        capabilities: 't2i',
        isDefault: true,
      },
      {
        modelId: 'gpt-image-1',
        name: 'GPT Image 1',
        type: 'image',
        capabilities: 't2i,i2i,edit,inpaint',
      },
    ],
  },
  {
    id: 'stability',
    name: 'stability',
    displayName: 'Stability AI',
    models: [
      {
        modelId: 'stable-diffusion-3.5-large',
        name: 'SD 3.5 Large',
        type: 'image',
        capabilities: 't2i',
        isDefault: true,
      },
      {
        modelId: 'creative-upscale',
        name: 'Creative Upscale',
        type: 'image',
        capabilities: 'upscale',
      },
      {
        modelId: 'stable-image-erase',
        name: 'Erase/Inpaint',
        type: 'image',
        capabilities: 'inpaint',
      },
    ],
  },
  {
    id: 'runway',
    name: 'runway',
    displayName: 'Runway',
    models: [
      {
        modelId: 'gen4.5',
        name: 'Gen-4.5',
        type: 'video',
        capabilities: 't2v,i2v',
        isDefault: true,
      },
    ],
  },
  {
    id: 'fal',
    name: 'fal',
    displayName: 'Fal.ai',
    models: [
      {
        modelId: 'fal-ai/flux/dev',
        name: 'FLUX Dev',
        type: 'image',
        capabilities: 't2i',
        isDefault: true,
      },
      {
        modelId: 'bytedance/seedance-2.0/text-to-video',
        name: 'Seedance 2.0',
        type: 'video',
        capabilities: 't2v,i2v',
      },
    ],
  },
];

describe('generation operation routing', () => {
  test('replaces an incompatible preferred image model within the same provider', () => {
    const target = resolveGenerationOperationTarget({
      operation: 'inpaint',
      providers,
      configuredProviderIds: ['openai'],
      preferredProviderId: 'openai',
      preferredModelId: 'dall-e-3',
      allowProviderFallback: false,
    });

    expect(target).toMatchObject({
      providerId: 'openai',
      modelId: 'gpt-image-1',
      type: 'image',
    });
  });

  test('selects a configured image-to-video provider instead of reusing an image model', () => {
    const target = resolveGenerationOperationTarget({
      operation: 'img2vid',
      providers,
      configuredProviderIds: ['openai', 'runway'],
      preferredProviderId: 'openai',
      preferredModelId: 'gpt-image-1',
      allowProviderFallback: true,
    });

    expect(target).toMatchObject({
      providerId: 'runway',
      modelId: 'gen4.5',
      type: 'video',
    });
  });

  test('uses an operation-specific upscale model', () => {
    const prepared = prepareGenerationOperation({
      operation: 'upscale',
      providers,
      configuredProviderIds: ['stability'],
      preferredProviderId: 'stability',
      preferredModelId: 'stable-diffusion-3.5-large',
      sourceImageUrl: 'data:image/png;base64,source',
      parentGenerationId: 'img-parent',
    });

    expect(prepared.endpoint).toBe('/api/generate/upscale');
    expect(prepared.target.modelId).toBe('creative-upscale');
    expect(prepared.body).toMatchObject({
      providerId: 'stability',
      modelId: 'creative-upscale',
      imageUrl: 'data:image/png;base64,source',
      upscaleFactor: 2,
    });
    expect(prepared.descriptor.parentGenerationId).toBe('img-parent');
    expect(prepared.descriptor.params).toMatchObject({ action: 'upscale' });
    expect(prepared.body.apiKey).toBeUndefined();
  });

  test('builds edit requests for the dedicated edit route without credentials', () => {
    const prepared = prepareGenerationOperation({
      operation: 'inpaint',
      providers,
      configuredProviderIds: ['openai'],
      preferredProviderId: 'openai',
      preferredModelId: 'gpt-image-1',
      sourceImageUrl: 'data:image/png;base64,image',
      mask: 'data:image/png;base64,mask',
      prompt: 'Replace the sky with soft clouds',
      allowProviderFallback: false,
    });

    expect(prepared.endpoint).toBe('/api/generate/edit');
    expect(prepared.body).toEqual({
      providerId: 'openai',
      modelId: 'gpt-image-1',
      prompt: 'Replace the sky with soft clouds',
      image: 'data:image/png;base64,image',
      mask: 'data:image/png;base64,mask',
      negativePrompt: undefined,
    });
    expect(JSON.stringify(prepared.body)).not.toContain('apiKey');
  });

  test('fails clearly when no connected provider supports the action', () => {
    expect(() => resolveGenerationOperationTarget({
      operation: 'img2vid',
      providers,
      configuredProviderIds: ['openai'],
      preferredProviderId: 'openai',
      preferredModelId: 'gpt-image-1',
      allowProviderFallback: true,
    })).toThrow(GenerationOperationError);
  });
});
