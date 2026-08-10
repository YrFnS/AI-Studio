'use client';

import {
  createGenerationId,
  type GenerationDescriptor,
} from '@/lib/generation-persistence';

export type GenerationOperation =
  | 'edit'
  | 'inpaint'
  | 'upscale'
  | 'variation'
  | 'improve'
  | 'img2vid';

export interface GenerationOperationModel {
  modelId: string;
  name: string;
  type: string;
  capabilities?: string;
  isDefault?: boolean;
}

export interface GenerationOperationProvider {
  id: string;
  name?: string;
  displayName: string;
  color?: string;
  models: GenerationOperationModel[];
}

export interface GenerationOperationTarget {
  providerId: string;
  providerName: string;
  providerColor: string;
  modelId: string;
  modelName: string;
  type: 'image' | 'video';
}

export interface PrepareGenerationOperationOptions {
  operation: GenerationOperation;
  providers: GenerationOperationProvider[];
  configuredProviderIds: string[];
  preferredProviderId?: string;
  preferredModelId?: string;
  sourceImageUrl: string;
  parentGenerationId?: string;
  prompt?: string;
  negativePrompt?: string;
  mask?: string | null;
  upscaleFactor?: 2 | 4;
  duration?: number;
  aspectRatio?: string;
  allowProviderFallback?: boolean;
}

export interface PreparedGenerationOperation {
  operation: GenerationOperation;
  endpoint: string;
  body: Record<string, unknown>;
  descriptor: GenerationDescriptor;
  target: GenerationOperationTarget;
  successMessage: string;
  processingMessage: string;
}

export type GenerationOperationErrorCode =
  | 'missing-source-image'
  | 'missing-prompt'
  | 'no-configured-provider'
  | 'unsupported-operation';

export class GenerationOperationError extends Error {
  readonly code: GenerationOperationErrorCode;

  constructor(message: string, code: GenerationOperationErrorCode) {
    super(message);
    this.name = 'GenerationOperationError';
    this.code = code;
  }
}

const PROVIDER_PRIORITY: Record<GenerationOperation, readonly string[]> = {
  edit: ['openai', 'stability'],
  inpaint: ['openai', 'stability'],
  upscale: ['stability', 'openai', 'replicate', 'fal'],
  variation: ['openai', 'stability', 'replicate', 'fal'],
  improve: ['openai', 'stability', 'replicate', 'fal'],
  img2vid: ['runway', 'luma', 'fal'],
};

function providerKey(provider: GenerationOperationProvider): string {
  return provider.name || provider.id;
}

function parseCapabilities(model: GenerationOperationModel): Set<string> {
  return new Set(
    (model.capabilities || '')
      .split(',')
      .map((capability) => capability.trim().toLowerCase())
      .filter(Boolean),
  );
}

function modelSupports(
  operation: GenerationOperation,
  provider: GenerationOperationProvider,
  model: GenerationOperationModel,
): boolean {
  const providerName = providerKey(provider);
  const capabilities = parseCapabilities(model);

  if (operation === 'img2vid') {
    return model.type === 'video' && capabilities.has('i2v');
  }

  if (model.type !== 'image') return false;

  if (operation === 'edit' || operation === 'inpaint') {
    if (providerName !== 'openai' && providerName !== 'stability') return false;
    return capabilities.has('edit') || capabilities.has('inpaint');
  }

  if (operation === 'upscale') {
    if (capabilities.has('upscale')) return true;
    // OpenAI's dedicated upscale route uses its edits contract.
    return providerName === 'openai'
      && (capabilities.has('edit') || capabilities.has('i2i'));
  }

  if (operation === 'variation' || operation === 'improve') {
    if (
      capabilities.has('variations')
      || capabilities.has('variation')
      || capabilities.has('i2i')
      || capabilities.has('edit')
    ) {
      return true;
    }

    // The Stability variations adapter uses the SD3 image-to-image contract.
    return providerName === 'stability'
      && model.modelId === 'stable-diffusion-3.5-large';
  }

  return false;
}

function providerIsConfigured(
  provider: GenerationOperationProvider,
  configured: ReadonlySet<string>,
): boolean {
  return configured.has(provider.id) || configured.has(providerKey(provider));
}

function selectCompatibleModel(
  operation: GenerationOperation,
  provider: GenerationOperationProvider,
  preferredModelId?: string,
): GenerationOperationModel | null {
  const compatible = provider.models.filter((model) =>
    modelSupports(operation, provider, model),
  );
  if (compatible.length === 0) return null;

  return compatible.find((model) => model.modelId === preferredModelId)
    || compatible.find((model) => model.isDefault)
    || compatible[0];
}

export function resolveGenerationOperationTarget(
  options: Pick<
    PrepareGenerationOperationOptions,
    | 'operation'
    | 'providers'
    | 'configuredProviderIds'
    | 'preferredProviderId'
    | 'preferredModelId'
    | 'allowProviderFallback'
  >,
): GenerationOperationTarget {
  const configured = new Set(options.configuredProviderIds);
  const priorities = PROVIDER_PRIORITY[options.operation];
  const preferredProvider = options.preferredProviderId
    ? options.providers.find((provider) =>
        provider.id === options.preferredProviderId
        || providerKey(provider) === options.preferredProviderId,
      )
    : undefined;

  const candidates: GenerationOperationProvider[] = [];
  if (preferredProvider) candidates.push(preferredProvider);

  if (options.allowProviderFallback !== false) {
    for (const providerName of priorities) {
      const provider = options.providers.find((candidate) =>
        providerKey(candidate) === providerName,
      );
      if (provider && !candidates.includes(provider)) candidates.push(provider);
    }
  }

  for (const provider of candidates) {
    const name = providerKey(provider);
    if (!priorities.includes(name)) continue;
    if (!providerIsConfigured(provider, configured)) continue;

    const model = selectCompatibleModel(
      options.operation,
      provider,
      provider === preferredProvider ? options.preferredModelId : undefined,
    );
    if (!model) continue;

    return {
      providerId: provider.id,
      providerName: provider.displayName,
      providerColor: provider.color || '#888',
      modelId: model.modelId,
      modelName: model.name,
      type: options.operation === 'img2vid' ? 'video' : 'image',
    };
  }

  if (configured.size === 0) {
    throw new GenerationOperationError(
      'Connect a provider before running this action.',
      'no-configured-provider',
    );
  }

  const operationLabel = options.operation === 'img2vid'
    ? 'image-to-video'
    : options.operation;
  throw new GenerationOperationError(
    `No connected provider has a verified ${operationLabel} model. Choose a compatible provider/model in Settings.`,
    'unsupported-operation',
  );
}

function operationCopy(operation: GenerationOperation): {
  prompt: string;
  successMessage: string;
  processingMessage: string;
} {
  switch (operation) {
    case 'edit':
    case 'inpaint':
      return {
        prompt: 'Edit the selected area while preserving the rest of the image',
        successMessage: 'Image edit completed and saved to the Gallery.',
        processingMessage: 'Image edit in progress…',
      };
    case 'upscale':
      return {
        prompt: 'Upscale this image, enhance details, and preserve its composition',
        successMessage: 'Upscaled image saved to the Gallery.',
        processingMessage: 'Upscale in progress…',
      };
    case 'variation':
      return {
        prompt: 'Generate a variation of this image',
        successMessage: 'Image variation saved to the Gallery.',
        processingMessage: 'Variation in progress…',
      };
    case 'improve':
      return {
        prompt: 'Enhance image quality, details, clarity, and resolution while preserving the composition',
        successMessage: 'Improved image saved to the Gallery.',
        processingMessage: 'Image improvement in progress…',
      };
    case 'img2vid':
      return {
        prompt: 'Animate this image with natural cinematic motion',
        successMessage: 'Generated video saved to the Gallery.',
        processingMessage: 'Image-to-video generation in progress…',
      };
  }
}

export function prepareGenerationOperation(
  options: PrepareGenerationOperationOptions,
): PreparedGenerationOperation {
  if (!options.sourceImageUrl) {
    throw new GenerationOperationError(
      'A source image is required for this action.',
      'missing-source-image',
    );
  }

  if (
    (options.operation === 'edit' || options.operation === 'inpaint')
    && !options.prompt?.trim()
  ) {
    throw new GenerationOperationError(
      'Enter an editing prompt before running this action.',
      'missing-prompt',
    );
  }

  const target = resolveGenerationOperationTarget(options);
  const copy = operationCopy(options.operation);
  const prompt = options.prompt?.trim() || copy.prompt;
  const negativePrompt = options.negativePrompt?.trim() || undefined;

  let endpoint: string;
  let body: Record<string, unknown>;

  switch (options.operation) {
    case 'edit':
    case 'inpaint':
      endpoint = '/api/generate/edit';
      body = {
        providerId: target.providerId,
        modelId: target.modelId,
        prompt,
        image: options.sourceImageUrl,
        mask: options.mask || undefined,
        negativePrompt,
      };
      break;
    case 'upscale':
      endpoint = '/api/generate/upscale';
      body = {
        providerId: target.providerId,
        modelId: target.modelId,
        imageUrl: options.sourceImageUrl,
        prompt,
        negativePrompt,
        upscaleFactor: options.upscaleFactor || 2,
      };
      break;
    case 'variation':
    case 'improve':
      endpoint = '/api/generate/variations';
      body = {
        providerId: target.providerId,
        modelId: target.modelId,
        imageUrl: options.sourceImageUrl,
        prompt,
        negativePrompt,
        variationStrength: options.operation === 'improve' ? 0.4 : 0.7,
      };
      break;
    case 'img2vid':
      endpoint = '/api/generate/img2vid';
      body = {
        providerId: target.providerId,
        modelId: target.modelId,
        imageUrl: options.sourceImageUrl,
        prompt,
        duration: options.duration || 5,
        aspectRatio: options.aspectRatio || '16:9',
      };
      break;
  }

  const descriptor: GenerationDescriptor = {
    id: createGenerationId(target.type === 'video' ? 'vid' : 'img'),
    providerId: target.providerId,
    providerName: target.providerName,
    modelId: target.modelId,
    type: target.type,
    prompt,
    negativePrompt,
    inputImageUrl: options.sourceImageUrl,
    parentGenerationId: options.parentGenerationId,
    duration: target.type === 'video' ? options.duration || 5 : undefined,
    params: {
      action: options.operation,
      sourceProviderId: options.preferredProviderId,
      sourceModelId: options.preferredModelId,
      targetProviderId: target.providerId,
      targetModelId: target.modelId,
      upscaleFactor: options.upscaleFactor,
      aspectRatio: options.aspectRatio,
    },
    createdAt: Date.now(),
  };

  return {
    operation: options.operation,
    endpoint,
    body,
    descriptor,
    target,
    successMessage: copy.successMessage,
    processingMessage: copy.processingMessage,
  };
}
