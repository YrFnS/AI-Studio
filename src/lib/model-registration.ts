import { z } from 'zod';

import type {
  GenerationOperationId,
  GenerationRouteId,
  ModelOperationContract,
  OperationVerification,
} from '@/lib/generation-registry';

export const MODEL_REGISTRATION_VERSION = 1 as const;

export const MODEL_REGISTRATION_SOURCES = ['custom', 'discovered'] as const;
export type ModelRegistrationSource = (typeof MODEL_REGISTRATION_SOURCES)[number];

export const MODEL_REGISTRATION_STATUSES = [
  'draft',
  'approved',
  'revoked',
  'rejected',
] as const;
export type ModelRegistrationStatus = (typeof MODEL_REGISTRATION_STATUSES)[number];

export interface ModelAdapterProfile {
  id: string;
  providerName: string;
  type: 'image' | 'video';
  operation: GenerationOperationId;
  route: GenerationRouteId;
  adapterId: string;
  displayName: string;
  description: string;
  modelIdPattern: string;
  modelIdHint: string;
}

export interface ModelRegistrationLiveEvidence {
  status: 'passed' | 'failed';
  testedAt: number;
  notes: string;
}

export interface ModelRegistrationRecord {
  version: typeof MODEL_REGISTRATION_VERSION;
  id: string;
  source: ModelRegistrationSource;
  sourceId: string;
  providerId: string;
  providerName: string;
  providerDisplayName: string;
  modelId: string;
  modelName: string;
  type: 'image' | 'video';
  profileId: string;
  operation: GenerationOperationId;
  route: GenerationRouteId;
  adapterId: string;
  status: ModelRegistrationStatus;
  verification: Exclude<OperationVerification, 'adapter-implemented'>;
  docsUrl?: string;
  reviewNotes?: string;
  reviewerAcknowledged: boolean;
  liveEvidence?: ModelRegistrationLiveEvidence;
  reviewedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type ApprovedModelRegistration = ModelRegistrationRecord & {
  status: 'approved';
  docsUrl: string;
  reviewNotes: string;
  reviewerAcknowledged: true;
  reviewedAt: number;
};

const OPERATIONS = [
  'text-to-image',
  'image-to-image',
  'edit',
  'inpaint',
  'variation',
  'upscale',
  'text-to-video',
  'image-to-video',
] as const;

const ROUTES = [
  'image',
  'video',
  'edit',
  'upscale',
  'variations',
  'img2vid',
] as const;

const SAFE_ID = /^[A-Za-z0-9._:/-]+$/;
const REPLICATE_MODEL = /^(?:[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+(?::[a-f0-9]{32,})?|[a-f0-9]{32,})$/i;

export const MODEL_ADAPTER_PROFILES: readonly ModelAdapterProfile[] = [
  {
    id: 'openai.images-generations.text-to-image',
    providerName: 'openai',
    type: 'image',
    operation: 'text-to-image',
    route: 'image',
    adapterId: 'openai.text-to-image',
    displayName: 'OpenAI Images · Text to Image',
    description: 'Uses the OpenAI Images generations request shape.',
    modelIdPattern: '^(?:gpt-image|dall-e)-[A-Za-z0-9._-]+$',
    modelIdHint: 'Use an OpenAI image model id beginning with gpt-image- or dall-e-.',
  },
  {
    id: 'replicate.prediction.text-to-image',
    providerName: 'replicate',
    type: 'image',
    operation: 'text-to-image',
    route: 'image',
    adapterId: 'replicate.text-to-image',
    displayName: 'Replicate Prediction · Text to Image',
    description: 'Uses the shared Replicate prediction input containing prompt and common image parameters.',
    modelIdPattern: REPLICATE_MODEL.source,
    modelIdHint: 'Use owner/model, an immutable version hash, or owner/model:version.',
  },
  {
    id: 'replicate.prediction.image-to-image',
    providerName: 'replicate',
    type: 'image',
    operation: 'image-to-image',
    route: 'image',
    adapterId: 'replicate.image-to-image',
    displayName: 'Replicate Prediction · Image to Image',
    description: 'Uses the shared Replicate prediction input with image and strength fields. Approve only when the model documentation accepts those names.',
    modelIdPattern: REPLICATE_MODEL.source,
    modelIdHint: 'Use owner/model, an immutable version hash, or owner/model:version.',
  },
  {
    id: 'fal.queue.text-to-image',
    providerName: 'fal',
    type: 'image',
    operation: 'text-to-image',
    route: 'image',
    adapterId: 'fal.text-to-image',
    displayName: 'fal Queue · Text to Image',
    description: 'Uses the fal queue request shape with prompt and common image parameters.',
    modelIdPattern: '^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+$',
    modelIdHint: 'Use the fal endpoint path, for example owner/model or owner/model/variant.',
  },
  {
    id: 'fal.queue.image-to-image',
    providerName: 'fal',
    type: 'image',
    operation: 'image-to-image',
    route: 'image',
    adapterId: 'fal.image-to-image',
    displayName: 'fal Queue · Image to Image',
    description: 'Uses image_url and strength in the fal queue request. Approve only when the provider documentation confirms those fields.',
    modelIdPattern: '^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+$',
    modelIdHint: 'Use the fal endpoint path, for example owner/model or owner/model/variant.',
  },
  {
    id: 'together.images-generations.text-to-image',
    providerName: 'together',
    type: 'image',
    operation: 'text-to-image',
    route: 'image',
    adapterId: 'together.text-to-image',
    displayName: 'Together Images · Text to Image',
    description: 'Uses Together’s OpenAI-compatible images generation request.',
    modelIdPattern: '^[A-Za-z0-9._:/-]+$',
    modelIdHint: 'Use the exact Together model id shown in its API documentation.',
  },
  {
    id: 'fireworks.images-generations.text-to-image',
    providerName: 'fireworks',
    type: 'image',
    operation: 'text-to-image',
    route: 'image',
    adapterId: 'fireworks.text-to-image',
    displayName: 'Fireworks Images · Text to Image',
    description: 'Uses the Fireworks images generation request with prompt and common diffusion parameters.',
    modelIdPattern: '^[A-Za-z0-9._:/-]+$',
    modelIdHint: 'Use the exact Fireworks model id shown in its API documentation.',
  },
  {
    id: 'ideogram.generate.text-to-image',
    providerName: 'ideogram',
    type: 'image',
    operation: 'text-to-image',
    route: 'image',
    adapterId: 'ideogram.text-to-image',
    displayName: 'Ideogram Generate · Text to Image',
    description: 'Uses the Ideogram generate request and passes the reviewed model id.',
    modelIdPattern: '^[A-Za-z0-9._-]+$',
    modelIdHint: 'Use the exact Ideogram model enum value from its API documentation.',
  },
  {
    id: 'huggingface.inference.text-to-image',
    providerName: 'huggingface',
    type: 'image',
    operation: 'text-to-image',
    route: 'image',
    adapterId: 'huggingface.text-to-image',
    displayName: 'Hugging Face Inference · Text to Image',
    description: 'Uses the Hugging Face model inference endpoint with inputs and common diffusion parameters.',
    modelIdPattern: '^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$',
    modelIdHint: 'Use a Hugging Face owner/model repository id.',
  },
  {
    id: 'aimlapi.images-generations.text-to-image',
    providerName: 'aimlapi',
    type: 'image',
    operation: 'text-to-image',
    route: 'image',
    adapterId: 'aimlapi.text-to-image',
    displayName: 'AI/ML API Images · Text to Image',
    description: 'Uses the AI/ML API OpenAI-compatible images generation request.',
    modelIdPattern: '^[A-Za-z0-9._:/-]+$',
    modelIdHint: 'Use the exact AI/ML API model id from its documentation.',
  },
  {
    id: 'google-aistudio.image-generation.text-to-image',
    providerName: 'google-aistudio',
    type: 'image',
    operation: 'text-to-image',
    route: 'image',
    adapterId: 'google-aistudio.text-to-image',
    displayName: 'Google AI Studio Image Generation · Text to Image',
    description: 'Uses Gemini generateContent for gemini-* models or predict for imagen-* models.',
    modelIdPattern: '^(?:gemini|imagen)-[A-Za-z0-9._-]+$',
    modelIdHint: 'Use a Google image model id beginning with gemini- or imagen-.',
  },
  {
    id: 'bfl.model-endpoint.text-to-image',
    providerName: 'bfl',
    type: 'image',
    operation: 'text-to-image',
    route: 'image',
    adapterId: 'bfl.text-to-image',
    displayName: 'Black Forest Labs Model Endpoint · Text to Image',
    description: 'Uses the BFL model-specific endpoint with the reviewed model id.',
    modelIdPattern: '^flux-[A-Za-z0-9._-]+$',
    modelIdHint: 'Use a BFL model id beginning with flux-.',
  },
] as const;

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function safeModelId(value: string): boolean {
  return value.length > 0
    && value.length <= 512
    && SAFE_ID.test(value)
    && !value.includes('..')
    && !value.includes('://')
    && !value.includes('?')
    && !value.includes('#')
    && !value.startsWith('/');
}

export function getModelAdapterProfile(
  profileId: string,
): ModelAdapterProfile | null {
  return MODEL_ADAPTER_PROFILES.find((profile) => profile.id === profileId) || null;
}

export function getModelAdapterProfiles(options?: {
  providerName?: string;
  type?: 'image' | 'video';
}): readonly ModelAdapterProfile[] {
  return MODEL_ADAPTER_PROFILES.filter((profile) => (
    (!options?.providerName || profile.providerName === options.providerName)
    && (!options?.type || profile.type === options.type)
  ));
}

export function validateModelIdForProfile(
  profile: ModelAdapterProfile,
  modelId: string,
): string | null {
  const value = modelId.trim();
  if (!safeModelId(value)) {
    return 'Model id contains unsupported URL syntax or characters.';
  }
  const pattern = new RegExp(profile.modelIdPattern, 'i');
  return pattern.test(value) ? null : profile.modelIdHint;
}

export function createModelRegistrationId(
  profileId: string,
  modelId: string,
): string {
  return `registration:${profileId}:${modelId}`;
}

export function createDraftModelRegistration(input: {
  source: ModelRegistrationSource;
  sourceId: string;
  providerId: string;
  providerName: string;
  providerDisplayName: string;
  modelId: string;
  modelName: string;
  type: 'image' | 'video';
  profileId: string;
  docsUrl?: string;
  reviewNotes?: string;
  existing?: ModelRegistrationRecord;
  now?: number;
}): ModelRegistrationRecord {
  const profile = getModelAdapterProfile(input.profileId);
  if (!profile) throw new Error('The selected adapter profile is not registered.');
  if (profile.providerName !== input.providerName || profile.type !== input.type) {
    throw new Error('The selected adapter profile does not match this provider and model type.');
  }
  const modelError = validateModelIdForProfile(profile, input.modelId);
  if (modelError) throw new Error(modelError);

  const now = input.now ?? Date.now();
  return {
    version: MODEL_REGISTRATION_VERSION,
    id: createModelRegistrationId(profile.id, input.modelId.trim()),
    source: input.source,
    sourceId: input.sourceId,
    providerId: input.providerId,
    providerName: input.providerName,
    providerDisplayName: input.providerDisplayName,
    modelId: input.modelId.trim(),
    modelName: input.modelName.trim(),
    type: input.type,
    profileId: profile.id,
    operation: profile.operation,
    route: profile.route,
    adapterId: profile.adapterId,
    status: 'draft',
    verification: 'contract-reviewed',
    docsUrl: input.docsUrl?.trim() || undefined,
    reviewNotes: input.reviewNotes?.trim() || undefined,
    reviewerAcknowledged: false,
    createdAt: input.existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function approveModelRegistration(
  record: ModelRegistrationRecord,
  evidence: {
    docsUrl: string;
    reviewNotes: string;
    reviewerAcknowledged: boolean;
    now?: number;
  },
): ApprovedModelRegistration {
  const profile = getModelAdapterProfile(record.profileId);
  if (!profile) throw new Error('The selected adapter profile is no longer registered.');
  const modelError = validateModelIdForProfile(profile, record.modelId);
  if (modelError) throw new Error(modelError);

  const docsUrl = evidence.docsUrl.trim();
  const reviewNotes = evidence.reviewNotes.trim();
  if (!isHttpsUrl(docsUrl)) {
    throw new Error('Add the HTTPS provider documentation URL used for this review.');
  }
  if (reviewNotes.length < 20) {
    throw new Error('Add at least 20 characters describing the request and response contract you reviewed.');
  }
  if (!evidence.reviewerAcknowledged) {
    throw new Error('Confirm that the provider documentation matches the selected adapter profile.');
  }

  const now = evidence.now ?? Date.now();
  return {
    ...record,
    status: 'approved',
    verification: 'contract-reviewed',
    docsUrl,
    reviewNotes,
    reviewerAcknowledged: true,
    reviewedAt: now,
    updatedAt: now,
  };
}

const liveEvidenceSchema = z.object({
  status: z.enum(['passed', 'failed']),
  testedAt: z.number().int().positive(),
  notes: z.string().trim().min(10).max(4_000),
}).strict();

export const approvedModelRegistrationSchema = z.object({
  version: z.literal(MODEL_REGISTRATION_VERSION),
  id: z.string().trim().min(1).max(1_024),
  source: z.enum(MODEL_REGISTRATION_SOURCES),
  sourceId: z.string().trim().min(1).max(1_024),
  providerId: z.string().trim().min(1).max(128),
  providerName: z.string().trim().min(1).max(128),
  providerDisplayName: z.string().trim().min(1).max(256),
  modelId: z.string().trim().min(1).max(512),
  modelName: z.string().trim().min(1).max(256),
  type: z.enum(['image', 'video']),
  profileId: z.string().trim().min(1).max(256),
  operation: z.enum(OPERATIONS),
  route: z.enum(ROUTES),
  adapterId: z.string().trim().min(1).max(256),
  status: z.literal('approved'),
  verification: z.enum(['contract-reviewed', 'live-verified']),
  docsUrl: z.string().url().refine((value) => value.startsWith('https://'), {
    message: 'Documentation URL must use HTTPS',
  }),
  reviewNotes: z.string().trim().min(20).max(4_000),
  reviewerAcknowledged: z.literal(true),
  liveEvidence: liveEvidenceSchema.optional(),
  reviewedAt: z.number().int().positive(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
}).strict().superRefine((value, context) => {
  if (
    value.verification === 'live-verified'
    && value.liveEvidence?.status !== 'passed'
  ) {
    context.addIssue({
      code: 'custom',
      path: ['liveEvidence'],
      message: 'Live verification requires recorded passing evidence',
    });
  }
});

export function requireApprovedModelRegistration(
  value: unknown,
  expected: {
    providerName: string;
    modelId: string;
    operation: GenerationOperationId;
    route: GenerationRouteId;
  },
): ApprovedModelRegistration {
  const parsed = approvedModelRegistrationSchema.parse(value) as ApprovedModelRegistration;
  const profile = getModelAdapterProfile(parsed.profileId);
  if (!profile) throw new Error('The reviewed model adapter profile is not registered.');

  if (
    parsed.providerName !== expected.providerName
    || parsed.providerId !== expected.providerName
    || parsed.modelId !== expected.modelId
    || parsed.operation !== expected.operation
    || parsed.route !== expected.route
  ) {
    throw new Error('The reviewed model registration does not match this generation request.');
  }

  if (
    profile.providerName !== parsed.providerName
    || profile.type !== parsed.type
    || profile.operation !== parsed.operation
    || profile.route !== parsed.route
    || profile.adapterId !== parsed.adapterId
  ) {
    throw new Error('The reviewed model registration no longer matches its adapter profile.');
  }

  const modelError = validateModelIdForProfile(profile, parsed.modelId);
  if (modelError) throw new Error(modelError);
  return parsed;
}

export function approvedRegistrationToContract(
  registration: ApprovedModelRegistration,
): ModelOperationContract {
  return {
    operation: registration.operation,
    routes: [registration.route],
    adapterId: registration.adapterId,
    verification: registration.verification,
    notes: `Locally reviewed registration ${registration.id}. ${registration.reviewNotes}`,
  };
}
