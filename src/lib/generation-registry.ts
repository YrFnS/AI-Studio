import { MODELS } from '@/lib/providers-data';
import {
  approvedRegistrationToContract,
  requireApprovedModelRegistration,
} from '@/lib/model-registration';

export const GENERATION_OPERATIONS = [
  'text-to-image',
  'image-to-image',
  'edit',
  'inpaint',
  'variation',
  'upscale',
  'text-to-video',
  'image-to-video',
] as const;

export type GenerationOperationId = (typeof GENERATION_OPERATIONS)[number];

export const GENERATION_ROUTES = [
  'image',
  'video',
  'edit',
  'upscale',
  'variations',
  'img2vid',
] as const;

export type GenerationRouteId = (typeof GENERATION_ROUTES)[number];

export type OperationVerification =
  | 'adapter-implemented'
  | 'contract-reviewed'
  | 'live-verified';

export interface ModelOperationContract {
  operation: GenerationOperationId;
  routes: readonly GenerationRouteId[];
  adapterId: string;
  verification: OperationVerification;
  notes?: string;
}

export interface RegisteredModelOperations {
  providerName: string;
  modelId: string;
  type: 'image' | 'video';
  operations: readonly GenerationOperationId[];
  contracts: readonly ModelOperationContract[];
  displayName?: string;
  description?: string;
}

interface CatalogModel {
  providerName: string;
  modelId: string;
  type: string;
  capabilities?: string;
}

interface ProviderModelLike extends CatalogModel {
  [key: string]: unknown;
}

interface ProviderLike {
  name: string;
  models: ProviderModelLike[];
  [key: string]: unknown;
}

const OPENAI_TEXT_TO_IMAGE = new Set([
  'gpt-image-1',
  'dall-e-3',
]);

const STABILITY_TEXT_TO_IMAGE = new Set([
  'stable-image-ultra',
  'stable-image-core',
  'stable-diffusion-3.5-large',
  'stable-diffusion-3.5-large-turbo',
  'stable-diffusion-3.5-medium',
]);

const STABILITY_IMAGE_TO_IMAGE = new Set([
  'stable-diffusion-3.5-large',
  'stable-diffusion-3.5-large-turbo',
  'stable-diffusion-3.5-medium',
]);

const RECRAFT_TEXT_TO_IMAGE = new Set(['recraft-v3']);

const GENERIC_TEXT_TO_IMAGE_PROVIDERS = new Set([
  'replicate',
  'fal',
  'together',
  'fireworks',
  'ideogram',
  'google-aistudio',
  'huggingface',
  'bfl',
  'aimlapi',
]);

const VIDEO_MODEL_RULES: Record<
  string,
  Record<string, readonly GenerationOperationId[]>
> = {
  replicate: {
    'bytedance/seedance-2.0': ['text-to-video', 'image-to-video'],
  },
  fal: {
    'bytedance/seedance-2.0/text-to-video': ['text-to-video', 'image-to-video'],
    'bytedance/seedance-2.0/fast/text-to-video': ['text-to-video', 'image-to-video'],
  },
  runway: {
    'gen4.5': ['text-to-video', 'image-to-video'],
    'gen4_turbo': ['image-to-video'],
  },
  luma: {
    'ray-2': ['text-to-video', 'image-to-video'],
    'ray-flash-2': ['text-to-video', 'image-to-video'],
  },
  'google-aistudio': {
    'veo-3.1-generate-preview': ['text-to-video', 'image-to-video'],
    'veo-3.1-fast-generate-preview': ['text-to-video', 'image-to-video'],
  },
};

const CONTRACT_REVIEWED_PROVIDERS = new Set([
  'openai',
  'stability',
  'replicate',
  'runway',
  'luma',
]);

const LEGACY_CAPABILITY_BY_OPERATION: Record<GenerationOperationId, string> = {
  'text-to-image': 't2i',
  'image-to-image': 'i2i',
  edit: 'edit',
  inpaint: 'inpaint',
  variation: 'variations',
  upscale: 'upscale',
  'text-to-video': 't2v',
  'image-to-video': 'i2v',
};

function capabilities(model: CatalogModel): ReadonlySet<string> {
  return new Set(
    (model.capabilities || '')
      .split(',')
      .map((capability) => capability.trim().toLowerCase())
      .filter(Boolean),
  );
}

function verificationFor(providerName: string): OperationVerification {
  return CONTRACT_REVIEWED_PROVIDERS.has(providerName)
    ? 'contract-reviewed'
    : 'adapter-implemented';
}

function contract(
  model: CatalogModel,
  operation: GenerationOperationId,
  routes: readonly GenerationRouteId[],
  adapterId: string,
  notes?: string,
): ModelOperationContract {
  return {
    operation,
    routes,
    adapterId,
    verification: verificationFor(model.providerName),
    notes,
  };
}

function supportsGenericTextToImage(model: CatalogModel): boolean {
  if (!capabilities(model).has('t2i')) return false;
  if (!GENERIC_TEXT_TO_IMAGE_PROVIDERS.has(model.providerName)) return false;

  if (model.providerName === 'replicate') {
    return /^[^/:]+\/[^/:]+$/.test(model.modelId)
      || /^[a-f0-9]{32,}$/i.test(model.modelId)
      || /^[^/:]+\/[^/:]+:[a-f0-9]{32,}$/i.test(model.modelId);
  }

  return true;
}

function videoRoutes(
  providerName: string,
  operation: GenerationOperationId,
): readonly GenerationRouteId[] {
  if (operation === 'text-to-video') return ['video'];

  return ['runway', 'luma', 'fal'].includes(providerName)
    ? ['video', 'img2vid']
    : ['video'];
}

function buildContracts(model: CatalogModel): ModelOperationContract[] {
  const contracts: ModelOperationContract[] = [];

  if (model.type === 'image') {
    if (
      (model.providerName === 'openai' && OPENAI_TEXT_TO_IMAGE.has(model.modelId))
      || (
        model.providerName === 'stability'
        && STABILITY_TEXT_TO_IMAGE.has(model.modelId)
      )
      || (
        model.providerName === 'recraft'
        && RECRAFT_TEXT_TO_IMAGE.has(model.modelId)
      )
      || supportsGenericTextToImage(model)
    ) {
      contracts.push(contract(
        model,
        'text-to-image',
        ['image'],
        `${model.providerName}.text-to-image`,
      ));
    }

    if (
      model.providerName === 'stability'
      && STABILITY_IMAGE_TO_IMAGE.has(model.modelId)
    ) {
      contracts.push(contract(
        model,
        'image-to-image',
        ['image'],
        'stability.sd3-image-to-image',
        'Uses the Stability SD3 image-to-image mode.',
      ));
    }

    if (model.providerName === 'openai' && model.modelId === 'gpt-image-1') {
      contracts.push(
        contract(model, 'edit', ['edit'], 'openai.images-edits'),
        contract(model, 'inpaint', ['edit'], 'openai.images-edits'),
        contract(model, 'variation', ['variations'], 'openai.images-edits'),
      );
    }

    if (
      model.providerName === 'stability'
      && model.modelId === 'stable-image-erase'
    ) {
      contracts.push(contract(
        model,
        'inpaint',
        ['edit'],
        'stability.inpaint',
      ));
    }

    if (
      model.providerName === 'stability'
      && STABILITY_IMAGE_TO_IMAGE.has(model.modelId)
    ) {
      contracts.push(contract(
        model,
        'variation',
        ['variations'],
        'stability.sd3-image-to-image',
      ));
    }

    if (
      model.providerName === 'stability'
      && model.modelId === 'creative-upscale'
    ) {
      contracts.push(contract(
        model,
        'upscale',
        ['upscale'],
        'stability.conservative-upscale',
        'The legacy catalog id is retained for saved selections; the executable adapter uses synchronous conservative upscale.',
      ));
    }
  }

  if (model.type === 'video') {
    const operations = VIDEO_MODEL_RULES[model.providerName]?.[model.modelId] || [];
    for (const operation of operations) {
      contracts.push(contract(
        model,
        operation,
        videoRoutes(model.providerName, operation),
        `${model.providerName}.${operation}`,
      ));
    }
  }

  return contracts;
}

function modelKey(providerName: string, modelId: string): string {
  return `${providerName}::${modelId}`;
}

const CATALOG_MODEL_KEYS = new Set(
  (MODELS as CatalogModel[]).map((model) => modelKey(model.providerName, model.modelId)),
);

const REGISTRY = new Map<string, RegisteredModelOperations>();

for (const model of MODELS as CatalogModel[]) {
  const contracts = buildContracts(model);
  if (contracts.length === 0) continue;

  const operations = [...new Set(contracts.map((item) => item.operation))];
  REGISTRY.set(modelKey(model.providerName, model.modelId), {
    providerName: model.providerName,
    modelId: model.modelId,
    type: model.type === 'video' ? 'video' : 'image',
    operations,
    contracts,
    ...(model.providerName === 'stability' && model.modelId === 'creative-upscale'
      ? {
          displayName: 'Conservative Upscale',
          description: 'Synchronous Stability upscale with conservative detail preservation.',
        }
      : {}),
  });
}

export class GenerationRegistryError extends Error {
  readonly status = 400;
  readonly code:
    | 'model-not-registered'
    | 'operation-not-supported'
    | 'route-not-supported'
    | 'reviewed-registration-invalid';

  constructor(
    message: string,
    code: GenerationRegistryError['code'],
  ) {
    super(message);
    this.name = 'GenerationRegistryError';
    this.code = code;
  }
}

export function getRegisteredModel(
  providerName: string,
  modelId: string,
): RegisteredModelOperations | null {
  return REGISTRY.get(modelKey(providerName, modelId)) || null;
}

export function getModelOperationContracts(
  providerName: string,
  modelId: string,
): readonly ModelOperationContract[] {
  return getRegisteredModel(providerName, modelId)?.contracts || [];
}

export function getModelOperations(
  providerName: string,
  modelId: string,
): readonly GenerationOperationId[] {
  return getRegisteredModel(providerName, modelId)?.operations || [];
}

export function getProviderOperations(
  providerName: string,
): readonly GenerationOperationId[] {
  const operations = new Set<GenerationOperationId>();
  for (const entry of REGISTRY.values()) {
    if (entry.providerName !== providerName) continue;
    for (const operation of entry.operations) operations.add(operation);
  }
  return [...operations];
}

export function getRegisteredProviderNames(): readonly string[] {
  return [...new Set([...REGISTRY.values()].map((entry) => entry.providerName))];
}

export function supportsModelOperation(
  providerName: string,
  modelId: string,
  operation: GenerationOperationId,
  route?: GenerationRouteId,
): boolean {
  const contract = getModelOperationContracts(providerName, modelId)
    .find((candidate) => candidate.operation === operation);
  if (!contract) return false;
  return route ? contract.routes.includes(route) : true;
}

export function requireModelOperation(
  providerName: string,
  modelId: string,
  operation: GenerationOperationId,
  route?: GenerationRouteId,
  reviewedRegistration?: unknown,
): ModelOperationContract {
  const entry = getRegisteredModel(providerName, modelId);
  if (entry) {
    const contract = entry.contracts.find(
      (candidate) => candidate.operation === operation,
    );
    if (!contract) {
      throw new GenerationRegistryError(
        `${modelId} does not support ${operation} through ${providerName}.`,
        'operation-not-supported',
      );
    }

    if (route && !contract.routes.includes(route)) {
      throw new GenerationRegistryError(
        `${modelId} cannot run ${operation} through the ${route} route.`,
        'route-not-supported',
      );
    }
    return contract;
  }

  // A local review cannot override or broaden a model already present in the
  // shipped catalog. Those changes require a normal source review.
  if (CATALOG_MODEL_KEYS.has(modelKey(providerName, modelId))) {
    throw new GenerationRegistryError(
      `Model ${modelId} is present in the catalog but has no executable ${operation} contract.`,
      'model-not-registered',
    );
  }

  if (!reviewedRegistration || !route) {
    throw new GenerationRegistryError(
      `Model ${modelId} is not registered for executable generation through ${providerName}.`,
      'model-not-registered',
    );
  }

  try {
    const registration = requireApprovedModelRegistration(reviewedRegistration, {
      providerName,
      modelId,
      operation,
      route,
    });
    return approvedRegistrationToContract(registration);
  } catch (error) {
    throw new GenerationRegistryError(
      error instanceof Error
        ? error.message
        : 'The reviewed model registration is invalid.',
      'reviewed-registration-invalid',
    );
  }
}

export function operationsToLegacyCapabilities(
  operations: readonly GenerationOperationId[],
): string {
  return [...new Set(operations.map(
    (operation) => LEGACY_CAPABILITY_BY_OPERATION[operation],
  ))].join(',');
}

export function decorateRegisteredProviders<T extends ProviderLike>(
  providers: readonly T[],
): Array<T & {
  operations: readonly GenerationOperationId[];
  models: Array<ProviderModelLike & {
    operations: readonly GenerationOperationId[];
    operationContracts: readonly ModelOperationContract[];
  }>;
}> {
  return providers.flatMap((provider) => {
    const models = provider.models.flatMap((model) => {
      const entry = getRegisteredModel(provider.name, model.modelId);
      if (!entry) return [];

      return [{
        ...model,
        name: entry.displayName || model.name,
        description: entry.description || model.description,
        capabilities: operationsToLegacyCapabilities(entry.operations),
        operations: entry.operations,
        operationContracts: entry.contracts,
      }];
    });

    if (models.length === 0) return [];

    return [{
      ...provider,
      operations: getProviderOperations(provider.name),
      models,
    }];
  });
}

export function listRegisteredModels(): readonly RegisteredModelOperations[] {
  return [...REGISTRY.values()];
}
