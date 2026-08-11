import { z } from 'zod';

import {
  MAX_REFERENCE_IMAGE_BYTES,
  REFERENCE_IMAGE_MIME_TYPES,
} from '@/lib/reference-image-limits';
import { PROTECTED_MEDIA_DESCRIPTOR_VERSION } from '@/lib/protected-media';

export const MAX_IMAGE_GENERATION_REQUEST_BYTES = 30 * 1024 * 1024;
export const MAX_VIDEO_GENERATION_REQUEST_BYTES = 45 * 1024 * 1024;
export const MAX_EDIT_REQUEST_BYTES = 30 * 1024 * 1024;
export const MAX_SINGLE_IMAGE_REQUEST_BYTES = 15 * 1024 * 1024;
export const MAX_STATUS_REQUEST_BYTES = 128 * 1024;
export const MAX_CANCEL_REQUEST_BYTES = 128 * 1024;
export const MAX_PROTECTED_MEDIA_REQUEST_BYTES = 128 * 1024;

const MAX_PROMPT_CHARS = 12_000;
const MAX_NEGATIVE_PROMPT_CHARS = 6_000;
const MAX_API_KEY_CHARS = 65_536;
const MAX_MODEL_ID_CHARS = 512;
const MAX_PROVIDER_ID_CHARS = 128;
const MAX_PROVIDER_JOB_ID_CHARS = 8_192;
const MAX_REMOTE_IMAGE_URL_CHARS = 4_096;
const MAX_DATA_URL_CHARS = Math.ceil((MAX_REFERENCE_IMAGE_BYTES * 4) / 3) + 512;

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const IMAGE_DATA_URL = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i;

export type GenerationRequestErrorCode =
  | 'invalid_content_type'
  | 'request_too_large'
  | 'empty_request'
  | 'invalid_json'
  | 'invalid_request';

export interface GenerationRequestIssue {
  path: string;
  message: string;
}

export class GenerationRequestError extends Error {
  readonly code: GenerationRequestErrorCode;
  readonly status: number;
  readonly issues?: GenerationRequestIssue[];

  constructor(options: {
    code: GenerationRequestErrorCode;
    message: string;
    status: number;
    issues?: GenerationRequestIssue[];
  }) {
    super(options.message);
    this.name = 'GenerationRequestError';
    this.code = options.code;
    this.status = options.status;
    this.issues = options.issues;
  }
}

function safeTrimmedString(max: number) {
  return z.string()
    .max(max)
    .refine((value) => !CONTROL_CHARACTERS.test(value), {
      message: 'Contains unsupported control characters',
    })
    .transform((value) => value.trim());
}

const providerIdSchema = safeTrimmedString(MAX_PROVIDER_ID_CHARS)
  .pipe(z.string().min(1, 'Provider is required'));
const providerNameSchema = safeTrimmedString(MAX_PROVIDER_ID_CHARS)
  .pipe(z.string().min(1, 'Provider name is required'));
const modelIdSchema = safeTrimmedString(MAX_MODEL_ID_CHARS)
  .pipe(z.string().min(1, 'Model is required'));
const promptSchema = safeTrimmedString(MAX_PROMPT_CHARS)
  .pipe(z.string().min(1, 'Prompt is required'));
const negativePromptSchema = safeTrimmedString(MAX_NEGATIVE_PROMPT_CHARS)
  .optional();
const apiKeySchema = z.string()
  .max(MAX_API_KEY_CHARS)
  .refine((value) => value.trim().length > 0, 'API key is required');
const providerJobIdSchema = safeTrimmedString(MAX_PROVIDER_JOB_ID_CHARS)
  .pipe(z.string().min(1, 'Provider job id is required'))
  .refine(
    (value) =>
      !value.includes('://')
      && !value.includes('?')
      && !value.includes('#')
      && !value.startsWith('/')
      && !value.split('/').includes('..'),
    'Provider job id contains unsupported URL syntax',
  );

function estimateBase64Bytes(value: string): number {
  const normalized = value.replace(/\s/g, '');
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
}

export const generationImageInputSchema = z.string()
  .min(1, 'Image input is required')
  .superRefine((value, context) => {
    if (value.startsWith('data:')) {
      if (value.length > MAX_DATA_URL_CHARS) {
        context.addIssue({
          code: 'custom',
          message: 'Image exceeds the 10MB limit',
        });
        return;
      }

      const match = value.match(IMAGE_DATA_URL);
      if (!match) {
        context.addIssue({
          code: 'custom',
          message: 'Image must be a base64 image data URL',
        });
        return;
      }

      if (!REFERENCE_IMAGE_MIME_TYPES.includes(
        match[1].toLowerCase() as (typeof REFERENCE_IMAGE_MIME_TYPES)[number],
      )) {
        context.addIssue({
          code: 'custom',
          message: 'Unsupported image type. Use PNG, JPEG, WebP, or GIF',
        });
        return;
      }

      if (estimateBase64Bytes(match[2]) > MAX_REFERENCE_IMAGE_BYTES) {
        context.addIssue({
          code: 'custom',
          message: 'Image exceeds the 10MB limit',
        });
      }
      return;
    }

    if (value.length > MAX_REMOTE_IMAGE_URL_CHARS) {
      context.addIssue({
        code: 'custom',
        message: 'Image URL is too long',
      });
      return;
    }

    try {
      const url = new URL(value);
      if (url.protocol !== 'https:') {
        context.addIssue({
          code: 'custom',
          message: 'Remote image URLs must use HTTPS',
        });
      }
      if (url.username || url.password) {
        context.addIssue({
          code: 'custom',
          message: 'Image URLs cannot contain credentials',
        });
      }
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'Image input must be an HTTPS URL or image data URL',
      });
    }
  });

const optionalImageInputSchema = generationImageInputSchema.optional();
const aspectRatioSchema = z.enum([
  '1:1',
  '16:9',
  '9:16',
  '4:3',
  '3:4',
  '3:2',
  '2:3',
  'landscape',
  'portrait',
]).optional();
const outputFormatSchema = z.enum(['png', 'jpeg', 'jpg', 'webp']).optional();
const boundedLabelSchema = safeTrimmedString(128).optional();
const boundedStyleSchema = safeTrimmedString(512).optional();
const imageDimensionSchema = z.number().int().min(64).max(4096).optional();
const seedSchema = z.number().int().min(0).max(4_294_967_295).optional();

export const imageGenerationRequestSchema = z.object({
  providerId: providerIdSchema,
  modelId: modelIdSchema,
  prompt: promptSchema,
  negativePrompt: negativePromptSchema,
  aspectRatio: aspectRatioSchema,
  quality: boundedLabelSchema,
  steps: z.number().int().min(1).max(150).optional(),
  guidance: z.number().finite().min(0).max(30).optional(),
  seed: seedSchema,
  batchSize: z.number().int().min(1).max(4).optional(),
  inputImageUrl: optionalImageInputSchema,
  outfitImageUrl: optionalImageInputSchema,
  style: boundedStyleSchema,
  width: imageDimensionSchema,
  height: imageDimensionSchema,
  size: z.string().max(32).regex(/^\d{2,4}x\d{2,4}$/).optional(),
  output_format: outputFormatSchema,
  strength: z.number().finite().min(0).max(1).optional(),
  sampler: boundedLabelSchema,
  magicPrompt: z.boolean().optional(),
  styleType: boundedLabelSchema,
  renderingSpeed: boundedLabelSchema,
  clipGuidance: boundedLabelSchema,
  tileable: z.boolean().optional(),
  photoReal: z.boolean().optional(),
  alchemy: z.boolean().optional(),
  safetyFilter: z.boolean().optional(),
  scheduler: boundedLabelSchema,
  clipSkip: z.number().int().min(1).max(12).optional(),
  lighting: boundedLabelSchema,
  colorMood: boundedLabelSchema,
  cameraShot: boundedLabelSchema,
  hiresFix: z.boolean().optional(),
  hiresScale: z.number().finite().min(1).max(4).optional(),
  hiresSteps: z.number().int().min(1).max(100).optional(),
  hiresDenoise: z.number().finite().min(0).max(1).optional(),
  apiKey: apiKeySchema,
}).strict();

export const videoGenerationRequestSchema = z.object({
  providerId: providerIdSchema,
  modelId: modelIdSchema,
  prompt: promptSchema,
  duration: z.coerce.number().int().min(2).max(15).default(5),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3', '3:4']).default('16:9'),
  imageUrl: optionalImageInputSchema,
  startFrameUrl: optionalImageInputSchema,
  endFrameUrl: optionalImageInputSchema,
  apiKey: apiKeySchema,
}).strict().superRefine((value, context) => {
  if (value.endFrameUrl && !value.startFrameUrl && !value.imageUrl) {
    context.addIssue({
      code: 'custom',
      path: ['endFrameUrl'],
      message: 'An end frame requires a starting image',
    });
  }
});

export const editGenerationRequestSchema = z.object({
  providerId: providerIdSchema.optional(),
  providerName: providerNameSchema.optional(),
  modelId: modelIdSchema,
  prompt: promptSchema,
  image: generationImageInputSchema,
  mask: optionalImageInputSchema,
  size: z.string().max(32).regex(/^\d{2,4}x\d{2,4}$/).optional(),
  quality: boundedLabelSchema,
  n: z.number().int().min(1).max(4).optional(),
  negativePrompt: negativePromptSchema,
  apiKey: apiKeySchema,
}).strict().superRefine((value, context) => {
  if (!value.providerId && !value.providerName) {
    context.addIssue({
      code: 'custom',
      path: ['providerId'],
      message: 'Provider is required',
    });
  }
});

export const upscaleGenerationRequestSchema = z.object({
  providerId: providerIdSchema,
  modelId: modelIdSchema,
  imageUrl: generationImageInputSchema,
  prompt: safeTrimmedString(MAX_PROMPT_CHARS).optional(),
  negativePrompt: negativePromptSchema,
  apiKey: apiKeySchema,
  upscaleFactor: z.union([z.literal(2), z.literal(4)]).default(2),
}).strict();

export const variationGenerationRequestSchema = z.object({
  providerId: providerIdSchema,
  modelId: modelIdSchema,
  imageUrl: generationImageInputSchema,
  prompt: promptSchema,
  negativePrompt: negativePromptSchema,
  apiKey: apiKeySchema,
  variationStrength: z.number().finite().min(0.3).max(1).default(0.7),
  seed: seedSchema,
}).strict();

export const imageToVideoGenerationRequestSchema = z.object({
  providerId: providerIdSchema,
  modelId: modelIdSchema,
  imageUrl: generationImageInputSchema,
  prompt: promptSchema,
  apiKey: apiKeySchema,
  duration: z.coerce.number().int().min(3).max(15).default(5),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3', '3:4']).default('16:9'),
}).strict();

export const statusGenerationRequestSchema = z.object({
  id: z.string().min(1).max(8_192),
  provider: providerNameSchema.optional(),
  modelId: modelIdSchema.optional(),
  apiKey: apiKeySchema.optional(),
}).strict();

export const cancelGenerationRequestSchema = z.object({
  id: safeTrimmedString(MAX_PROVIDER_JOB_ID_CHARS)
    .pipe(z.string().min(1, 'Generation job id is required')),
  providerId: providerIdSchema,
  modelId: modelIdSchema.optional(),
  apiKey: apiKeySchema,
}).strict();

export const protectedMediaRequestSchema = z.object({
  version: z.literal(PROTECTED_MEDIA_DESCRIPTOR_VERSION),
  providerId: z.enum(['google', 'google-aistudio']),
  providerJobId: providerJobIdSchema,
  kind: z.enum(['video', 'image']),
  apiKey: apiKeySchema,
}).strict();

async function readRequestBody(
  request: Request,
  maxBytes: number,
): Promise<string> {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new GenerationRequestError({
      code: 'request_too_large',
      message: 'Request body exceeds the allowed size',
      status: 413,
    });
  }

  if (!request.body) {
    throw new GenerationRequestError({
      code: 'empty_request',
      message: 'Request body is required',
      status: 400,
    });
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new GenerationRequestError({
        code: 'request_too_large',
        message: 'Request body exceeds the allowed size',
        status: 413,
      });
    }
    chunks.push(value);
  }

  if (total === 0) {
    throw new GenerationRequestError({
      code: 'empty_request',
      message: 'Request body is required',
      status: 400,
    });
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(merged);
}

export async function parseGenerationRequest<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes: number,
): Promise<T> {
  const contentType = request.headers.get('content-type')
    ?.split(';')[0]
    .trim()
    .toLowerCase();

  if (contentType && contentType !== 'application/json') {
    throw new GenerationRequestError({
      code: 'invalid_content_type',
      message: 'Generation requests must use application/json',
      status: 415,
    });
  }

  const text = await readRequestBody(request, maxBytes);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new GenerationRequestError({
      code: 'invalid_json',
      message: 'Request body must contain valid JSON',
      status: 400,
    });
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    throw new GenerationRequestError({
      code: 'invalid_request',
      message: 'Generation request validation failed',
      status: 400,
      issues: result.error.issues.slice(0, 20).map((issue) => ({
        path: issue.path.join('.') || 'request',
        message: issue.message,
      })),
    });
  }

  return result.data;
}
