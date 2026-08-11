import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function replaceRequired(source, oldValue, newValue, label) {
  if (source.includes(newValue)) return source;
  if (!source.includes(oldValue)) throw new Error(`Could not locate ${label}`);
  return source.replace(oldValue, newValue);
}

function spliceRequired(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Could not locate ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

async function patchGenerationRequest() {
  const filePath = path.join(root, 'src/lib/server/generation-request.ts');
  let source = await fs.readFile(filePath, 'utf8');

  source = replaceRequired(
    source,
    `} from '@/lib/reference-image-limits';\n`,
    `} from '@/lib/reference-image-limits';\nimport { PROTECTED_MEDIA_DESCRIPTOR_VERSION } from '@/lib/protected-media';\n`,
    'protected media request import',
  );
  source = replaceRequired(
    source,
    `export const MAX_STATUS_REQUEST_BYTES = 128 * 1024;\n`,
    `export const MAX_STATUS_REQUEST_BYTES = 128 * 1024;\nexport const MAX_PROTECTED_MEDIA_REQUEST_BYTES = 128 * 1024;\n`,
    'protected media request size',
  );
  source = replaceRequired(
    source,
    `const MAX_PROVIDER_ID_CHARS = 128;\n`,
    `const MAX_PROVIDER_ID_CHARS = 128;\nconst MAX_PROVIDER_JOB_ID_CHARS = 8_192;\n`,
    'provider job id bound',
  );
  source = replaceRequired(
    source,
    `const apiKeySchema = z.string()\n  .max(MAX_API_KEY_CHARS)\n  .refine((value) => value.trim().length > 0, 'API key is required');\n`,
    `const apiKeySchema = z.string()\n  .max(MAX_API_KEY_CHARS)\n  .refine((value) => value.trim().length > 0, 'API key is required');\nconst providerJobIdSchema = safeTrimmedString(MAX_PROVIDER_JOB_ID_CHARS)\n  .pipe(z.string().min(1, 'Provider job id is required'))\n  .refine(\n    (value) =>\n      !value.includes('://')\n      && !value.includes('?')\n      && !value.includes('#')\n      && !value.startsWith('/')\n      && !value.split('/').includes('..'),\n    'Provider job id contains unsupported URL syntax',\n  );\n`,
    'provider job id schema',
  );
  source = replaceRequired(
    source,
    `export const statusGenerationRequestSchema = z.object({\n  id: z.string().min(1).max(8_192),\n  provider: providerNameSchema.optional(),\n  modelId: modelIdSchema.optional(),\n  apiKey: apiKeySchema.optional(),\n}).strict();\n`,
    `export const statusGenerationRequestSchema = z.object({\n  id: z.string().min(1).max(8_192),\n  provider: providerNameSchema.optional(),\n  modelId: modelIdSchema.optional(),\n  apiKey: apiKeySchema.optional(),\n}).strict();\n\nexport const protectedMediaRequestSchema = z.object({\n  version: z.literal(PROTECTED_MEDIA_DESCRIPTOR_VERSION),\n  providerId: z.enum(['google', 'google-aistudio']),\n  providerJobId: providerJobIdSchema,\n  kind: z.enum(['video', 'image']),\n  apiKey: apiKeySchema,\n}).strict();\n`,
    'protected media schema',
  );

  await fs.writeFile(filePath, source, 'utf8');
}

async function patchProviderRequest() {
  const filePath = path.join(root, 'src/lib/server/provider-request.ts');
  let source = await fs.readFile(filePath, 'utf8');
  if (source.includes('let wrappedBody: ReadableStream<Uint8Array> | null | undefined;')) return;

  const replacement = `function wrapResponse(\n  response: Response,\n  options: {\n    finish: () => void;\n    didTimeout: () => boolean;\n    provider: string;\n  },\n): Response {\n  let wrappedBody: ReadableStream<Uint8Array> | null | undefined;\n\n  return new Proxy(response, {\n    get(target, property) {\n      const value = Reflect.get(target, property, target);\n\n      if (property === 'body') {\n        if (value === null) {\n          options.finish();\n          return null;\n        }\n        if (wrappedBody !== undefined) return wrappedBody;\n\n        const reader = (value as ReadableStream<Uint8Array>).getReader();\n        wrappedBody = new ReadableStream<Uint8Array>({\n          async pull(controller) {\n            try {\n              const chunk = await reader.read();\n              if (chunk.done) {\n                options.finish();\n                controller.close();\n                return;\n              }\n              if (chunk.value) controller.enqueue(chunk.value);\n            } catch (error) {\n              options.finish();\n              controller.error(\n                options.didTimeout()\n                  ? timeoutError(options.provider)\n                  : invalidResponseError(options.provider),\n              );\n            }\n          },\n          async cancel(reason) {\n            options.finish();\n            await reader.cancel(reason);\n          },\n        });\n        return wrappedBody;\n      }\n\n      if (BODY_METHODS.has(property) && typeof value === 'function') {\n        return async (...args: unknown[]) => {\n          try {\n            return await value.apply(target, args);\n          } catch (error) {\n            if (error instanceof ProviderRequestError) throw error;\n            if (options.didTimeout()) throw timeoutError(options.provider);\n            throw invalidResponseError(options.provider);\n          } finally {\n            options.finish();\n          }\n        };\n      }\n\n      return typeof value === 'function' ? value.bind(target) : value;\n    },\n  });\n}\n\n`;

  source = spliceRequired(
    source,
    'function wrapResponse(\n',
    'export function providerFetch(\n',
    replacement,
    'provider response wrapper',
  );
  await fs.writeFile(filePath, source, 'utf8');
}

async function patchStatusRoute() {
  const filePath = path.join(root, 'src/app/api/generate/status/route.ts');
  let source = await fs.readFile(filePath, 'utf8');

  source = source.replace(
    "import { registerProtectedMedia } from '@/lib/server-media-store';\n",
    "import { PROTECTED_MEDIA_DESCRIPTOR_VERSION } from '@/lib/protected-media';\n",
  );
  source = replaceRequired(
    source,
    `        const mediaToken = registerProtectedMedia({\n          url: providerMediaUrl,\n          headers: { 'x-goog-api-key': apiKey },\n        });\n        const resultUrl = \`/api/generate/media/\${mediaToken}\`;\n        return { status: 'completed', resultUrl, urls: [resultUrl] };\n`,
    `        return {\n          status: 'completed',\n          protectedMedia: {\n            version: PROTECTED_MEDIA_DESCRIPTOR_VERSION,\n            providerId: provider,\n            providerJobId,\n            kind: 'video',\n          },\n        };\n`,
    'Google protected media completion',
  );
  await fs.writeFile(filePath, source, 'utf8');
}

async function writeMediaRoute() {
  const routeDir = path.join(root, 'src/app/api/generate/media');
  await fs.mkdir(routeDir, { recursive: true });
  await fs.writeFile(path.join(routeDir, 'route.ts'), `import { NextRequest } from 'next/server';

import { MAX_PROTECTED_MEDIA_BYTES } from '@/lib/protected-media';
import {
  MAX_PROTECTED_MEDIA_REQUEST_BYTES,
  parseGenerationRequest,
  protectedMediaRequestSchema,
} from '@/lib/server/generation-request';
import {
  generationErrorResponse,
  noStoreJson,
} from '@/lib/server/generation-response';
import {
  providerFetch,
  PROVIDER_STATUS_TIMEOUT_MS,
} from '@/lib/server/provider-request';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MEDIA_DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;
const GOOGLE_MEDIA_HOSTS = [
  'generativelanguage.googleapis.com',
  'googleapis.com',
  'googleusercontent.com',
];

function extractGoogleMediaUrl(data: Record<string, any>): string | null {
  return data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
    || data.response?.generatedVideos?.[0]?.video?.uri
    || null;
}

function assertGoogleMediaUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Google returned an invalid protected media URL');
  }
  const hostname = url.hostname.toLowerCase();
  if (!GOOGLE_MEDIA_HOSTS.some(
    (domain) => hostname === domain || hostname.endsWith(\`.\${domain}\`),
  )) {
    throw new Error('Google returned an untrusted protected media host');
  }
  return url;
}

function limitStream(
  source: ReadableStream<Uint8Array>,
  maxBytes: number,
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  let total = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (chunk.done) {
          controller.close();
          return;
        }
        if (!chunk.value) return;

        total += chunk.value.byteLength;
        if (total > maxBytes) {
          await reader.cancel('Protected media exceeded the local size limit');
          controller.error(new Error('Protected media exceeds the 512MB limit'));
          return;
        }
        controller.enqueue(chunk.value);
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseGenerationRequest(
      req,
      protectedMediaRequestSchema,
      MAX_PROTECTED_MEDIA_REQUEST_BYTES,
    );

    const operation = await providerFetch(
      'Google AI Studio',
      \`https://generativelanguage.googleapis.com/v1beta/\${body.providerJobId}\`,
      {
        headers: { 'x-goog-api-key': body.apiKey },
        cache: 'no-store',
      },
      { timeoutMs: PROVIDER_STATUS_TIMEOUT_MS },
    );
    const operationData = await operation.json() as Record<string, any>;

    if (!operationData.done) {
      return noStoreJson({
        error: 'Protected media is not ready yet',
        code: 'media_not_ready',
      }, 409);
    }
    if (operationData.error) {
      return noStoreJson({
        error: 'The provider could not prepare the protected media',
        code: 'provider_media_failed',
      }, 400);
    }

    const mediaValue = extractGoogleMediaUrl(operationData);
    if (!mediaValue) {
      return noStoreJson({
        error: 'The provider completed without a protected media URL',
        code: 'provider_media_missing',
      }, 502);
    }

    const mediaUrl = assertGoogleMediaUrl(mediaValue);
    const upstream = await providerFetch(
      'Google AI Studio media',
      mediaUrl,
      {
        headers: {
          'x-goog-api-key': body.apiKey,
          Accept: body.kind === 'video' ? 'video/*,application/octet-stream' : 'image/*',
        },
        cache: 'no-store',
      },
      { timeoutMs: MEDIA_DOWNLOAD_TIMEOUT_MS },
    );

    const declaredLength = Number(upstream.headers.get('content-length') || 0);
    if (declaredLength > MAX_PROTECTED_MEDIA_BYTES) {
      return noStoreJson({
        error: 'Protected media exceeds the 512MB local storage limit',
        code: 'media_too_large',
      }, 413);
    }

    const contentType = upstream.headers.get('content-type')
      ?.split(';')[0]
      .trim()
      .toLowerCase()
      || 'application/octet-stream';
    if (
      !contentType.startsWith('video/')
      && !contentType.startsWith('image/')
      && contentType !== 'application/octet-stream'
    ) {
      return noStoreJson({
        error: 'Provider returned an unsupported protected media type',
        code: 'invalid_media_type',
      }, 502);
    }
    if (!upstream.body) {
      return noStoreJson({
        error: 'Provider returned an empty protected media response',
        code: 'empty_media_response',
      }, 502);
    }

    const headers = new Headers({
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline',
      'Content-Type': contentType,
      'Cross-Origin-Resource-Policy': 'same-origin',
    });
    if (declaredLength > 0) headers.set('Content-Length', String(declaredLength));

    return new Response(
      limitStream(upstream.body, MAX_PROTECTED_MEDIA_BYTES),
      { status: 200, headers },
    );
  } catch (error) {
    return generationErrorResponse(error, {
      logLabel: 'Protected media download error',
      fallbackMessage: 'Failed to download protected media',
    });
  }
}
`, 'utf8');
}

async function writeGenerationPersistence() {
  const filePath = path.join(root, 'src/lib/generation-persistence.ts');
  await fs.writeFile(filePath, `'use client';

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
  return \`${'${prefix}'}-${'${Date.now()}'}-${'${randomPart}'}\`;
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
`, 'utf8');
}

async function patchDataLayer() {
  const filePath = path.join(root, 'src/lib/data.ts');
  let source = await fs.readFile(filePath, 'utf8');
  source = replaceRequired(
    source,
    `export async function saveGeneration(gen: GenerationRecord) {\n  return idb.saveGeneration(gen);\n}\n`,
    `export async function saveGeneration(gen: GenerationRecord) {\n  return idb.saveGeneration(gen);\n}\n\nexport async function saveGenerationMediaAsset(\n  generationId: string,\n  blob: Blob,\n) {\n  return idb.saveGenerationMediaAsset(generationId, blob);\n}\n`,
    'data media asset wrapper',
  );
  await fs.writeFile(filePath, source, 'utf8');
}

async function patchIdb() {
  const filePath = path.join(root, 'src/lib/idb.ts');
  let source = await fs.readFile(filePath, 'utf8');
  source = source.replace("const DB_VERSION = 5;", "const DB_VERSION = 6;");

  source = replaceRequired(
    source,
    `      if (!db.objectStoreNames.contains('discoveredModels')) {\n        const discStore = db.createObjectStore('discoveredModels', { keyPath: 'id' });\n        discStore.createIndex('providerName', 'providerName', { unique: false });\n      }\n`,
    `      if (!db.objectStoreNames.contains('discoveredModels')) {\n        const discStore = db.createObjectStore('discoveredModels', { keyPath: 'id' });\n        discStore.createIndex('providerName', 'providerName', { unique: false });\n      }\n      // v6: generated protected media blobs\n      if (!db.objectStoreNames.contains('mediaAssets')) {\n        const mediaStore = db.createObjectStore('mediaAssets', { keyPath: 'id' });\n        mediaStore.createIndex('generationId', 'generationId', { unique: true });\n        mediaStore.createIndex('createdAt', 'createdAt', { unique: false });\n      }\n`,
    'media asset store upgrade',
  );

  source = replaceRequired(
    source,
    `export interface GenerationRecord {\n`,
    `export interface GenerationMediaAsset {\n  id: string;\n  generationId: string;\n  blob: Blob;\n  mimeType: string;\n  size: number;\n  createdAt: number;\n}\n\nconst mediaObjectUrls = new Map<string, string>();\n\nfunction revokeGenerationMediaUrl(assetId: string): void {\n  const url = mediaObjectUrls.get(assetId);\n  if (url && typeof URL !== 'undefined') URL.revokeObjectURL(url);\n  mediaObjectUrls.delete(assetId);\n}\n\nexport async function saveGenerationMediaAsset(\n  generationId: string,\n  blob: Blob,\n): Promise<GenerationMediaAsset> {\n  const asset: GenerationMediaAsset = {\n    id: \`media:\${generationId}\`,\n    generationId,\n    blob,\n    mimeType: blob.type || 'application/octet-stream',\n    size: blob.size,\n    createdAt: Date.now(),\n  };\n  revokeGenerationMediaUrl(asset.id);\n  const { transaction, stores } = await tx('mediaAssets', 'readwrite');\n  stores.mediaAssets.put(asset);\n  await txComplete(transaction);\n  return asset;\n}\n\nexport async function getGenerationMediaAsset(\n  assetId: string,\n): Promise<GenerationMediaAsset | undefined> {\n  const { stores } = await tx('mediaAssets');\n  return reqToPromise(stores.mediaAssets.get(assetId));\n}\n\nasync function materializeGenerationMedia(\n  record: GenerationRecord,\n): Promise<GenerationRecord> {\n  if (!record.mediaAssetId) return record;\n  const cached = mediaObjectUrls.get(record.mediaAssetId);\n  if (cached) return { ...record, resultUrl: cached };\n\n  const asset = await getGenerationMediaAsset(record.mediaAssetId);\n  if (!asset) return record;\n  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {\n    return record;\n  }\n\n  const resultUrl = URL.createObjectURL(asset.blob);\n  mediaObjectUrls.set(asset.id, resultUrl);\n  return {\n    ...record,\n    resultUrl,\n    resultMimeType: asset.mimeType,\n    resultSize: asset.size,\n  };\n}\n\nexport interface GenerationRecord {\n`,
    'generation media asset helpers',
  );

  source = replaceRequired(
    source,
    `  resultData?: string;\n  thumbnailUrl?: string;\n`,
    `  resultData?: string;\n  mediaAssetId?: string;\n  resultMimeType?: string;\n  resultSize?: number;\n  thumbnailUrl?: string;\n`,
    'generation media fields',
  );

  source = replaceRequired(
    source,
    `export async function getGeneration(id: string): Promise<GenerationRecord | undefined> {\n  const { stores } = await tx('generations');\n  return reqToPromise(stores['generations'].get(id));\n}\n`,
    `export async function getGeneration(id: string): Promise<GenerationRecord | undefined> {\n  const { stores } = await tx('generations');\n  const record = await reqToPromise<GenerationRecord | undefined>(\n    stores.generations.get(id),\n  );\n  return record ? materializeGenerationMedia(record) : undefined;\n}\n`,
    'materialized single generation',
  );

  source = replaceRequired(
    source,
    `export async function deleteGeneration(id: string): Promise<void> {\n  const { transaction, stores } = await tx(['generations', 'collectionItems'], 'readwrite');\n  stores['generations'].delete(id);\n`,
    `export async function deleteGeneration(id: string): Promise<void> {\n  const assetId = \`media:\${id}\`;\n  revokeGenerationMediaUrl(assetId);\n  const { transaction, stores } = await tx(\n    ['generations', 'collectionItems', 'mediaAssets'],\n    'readwrite',\n  );\n  stores.generations.delete(id);\n  stores.mediaAssets.delete(assetId);\n`,
    'generation media deletion',
  );

  source = replaceRequired(
    source,
    `export async function clearAllGenerations(): Promise<void> {\n  const { transaction, stores } = await tx(['generations', 'collectionItems'], 'readwrite');\n  stores['generations'].clear();\n  stores['collectionItems'].clear();\n  await txComplete(transaction);\n}\n`,
    `export async function clearAllGenerations(): Promise<void> {\n  for (const assetId of mediaObjectUrls.keys()) revokeGenerationMediaUrl(assetId);\n  const { transaction, stores } = await tx(\n    ['generations', 'collectionItems', 'mediaAssets'],\n    'readwrite',\n  );\n  stores.generations.clear();\n  stores.collectionItems.clear();\n  stores.mediaAssets.clear();\n  await txComplete(transaction);\n}\n`,
    'generation media clearing',
  );

  source = replaceRequired(
    source,
    `  filtered = filtered.slice(offset, offset + limit);\n\n  return { generations: filtered, total };\n`,
    `  filtered = filtered.slice(offset, offset + limit);\n  const generations = await Promise.all(\n    filtered.map(materializeGenerationMedia),\n  );\n\n  return { generations, total };\n`,
    'generation media page materialization',
  );

  source = replaceRequired(
    source,
    `  return filtered;\n}\n\nexport async function getStats()`,
    `  return Promise.all(filtered.map(materializeGenerationMedia));\n}\n\nexport async function getStats()`,
    'timeline media materialization',
  );

  await fs.writeFile(filePath, source, 'utf8');
}

async function patchLifecycle() {
  const filePath = path.join(root, 'src/lib/generation-lifecycle.ts');
  let source = await fs.readFile(filePath, 'utf8');

  source = replaceRequired(
    source,
    `import { generationFetch } from '@/lib/generation-client';\n`,
    `import { generationFetch } from '@/lib/generation-client';\nimport { downloadProtectedMedia } from '@/lib/protected-media-client';\nimport { parseProtectedMediaDescriptor } from '@/lib/protected-media';\n`,
    'protected media lifecycle imports',
  );
  source = replaceRequired(
    source,
    `  type GenerationDescriptor,\n} from '@/lib/generation-persistence';\n`,
    `  type GenerationDescriptor,\n  type GenerationOutput,\n} from '@/lib/generation-persistence';\n`,
    'generation output lifecycle type',
  );
  source = replaceRequired(
    source,
    `  getApiKey: ApiKeyResolver;\n  now: () => number;\n`,
    `  getApiKey: ApiKeyResolver;\n  fetchMediaImpl: typeof downloadProtectedMedia;\n  createObjectUrl: (blob: Blob) => string;\n  now: () => number;\n`,
    'protected media lifecycle dependencies',
  );
  source = replaceRequired(
    source,
    `interface SubmissionCompleted {\n  kind: 'completed';\n  urls: string[];\n  payload: Record<string, unknown>;\n}\n`,
    `interface SubmissionCompleted {\n  kind: 'completed';\n  payload: Record<string, unknown>;\n}\n`,
    'completed submission shape',
  );
  source = replaceRequired(
    source,
    `  const urls = normalizeUrls(payload);\n  if (payload.status === 'completed' && urls.length > 0) {\n    return { kind: 'completed', urls, payload };\n  }\n`,
    `  const urls = normalizeUrls(payload);\n  const protectedMedia = parseProtectedMediaDescriptor(payload.protectedMedia);\n  if (payload.status === 'completed' && (urls.length > 0 || protectedMedia)) {\n    return { kind: 'completed', payload };\n  }\n`,
    'completed protected media submission parsing',
  );
  source = replaceRequired(
    source,
    `function completedPayload(\n  payload: GenerationStatusPayload,\n): Record<string, unknown> {\n  return { ...payload };\n}\n`,
    `function completedPayload(\n  payload: GenerationStatusPayload,\n): Record<string, unknown> {\n  return { ...payload };\n}\n\nasync function resolveCompletedOutputs(\n  payload: Record<string, unknown>,\n  apiKey: string | undefined,\n  signal: AbortSignal,\n  dependencies: GenerationLifecycleDependencies,\n): Promise<GenerationOutput[]> {\n  const urls = normalizeUrls(payload);\n  if (urls.length > 0) return urls;\n\n  const protectedMedia = parseProtectedMediaDescriptor(payload.protectedMedia);\n  if (!protectedMedia) return [];\n  if (!apiKey) {\n    throw new GenerationLifecycleError(\n      'No API key is available to download protected media',\n      { code: 'missing-api-key' },\n    );\n  }\n\n  const blob = await dependencies.fetchMediaImpl(\n    protectedMedia,\n    apiKey,\n    { fetchImpl: dependencies.fetchImpl, signal },\n  );\n  return [blob];\n}\n`,
    'protected media output resolver',
  );
  source = replaceRequired(
    source,
    `    failImpl: failGeneration,\n    getApiKey: getApiKeyForProvider,\n    now: Date.now,\n`,
    `    failImpl: failGeneration,\n    getApiKey: getApiKeyForProvider,\n    fetchMediaImpl: downloadProtectedMedia,\n    createObjectUrl: (blob) => URL.createObjectURL(blob),\n    now: Date.now,\n`,
    'protected media lifecycle defaults',
  );
  source = replaceRequired(
    source,
    `      complete: (\n        urls: string[],\n        payload: Record<string, unknown>,\n        providerJobId?: string,\n      ) => Promise<GenerationLifecycleResult>;\n`,
    `      complete: (\n        outputs: GenerationOutput[],\n        payload: Record<string, unknown>,\n        providerJobId?: string,\n      ) => Promise<GenerationLifecycleResult>;\n`,
    'lifecycle complete execution signature',
  );

  const completeReplacement = `    const complete = async (\n      outputs: GenerationOutput[],\n      payload: Record<string, unknown>,\n      jobId?: string,\n    ): Promise<GenerationLifecycleResult> => {\n      if (outputs.length === 0) {\n        throw new GenerationLifecycleError(\n          'Provider completed without returning a result',\n          { code: 'invalid-response', providerJobId: jobId || providerJobId },\n        );\n      }\n      if (terminal || finalizing) {\n        throw new GenerationLifecycleError(\n          'Generation already reached a terminal state',\n          { code: 'failed', providerJobId },\n        );\n      }\n      finalizing = true;\n      if (jobId) providerJobId = jobId;\n      const generationIds = await dependencies.completeImpl(\n        descriptor,\n        outputs,\n        providerJobId,\n      );\n      if (generationIds.length === 0) {\n        finalizing = false;\n        throw new GenerationLifecycleError(\n          'Generation results could not be persisted',\n          { code: 'failed', providerJobId },\n        );\n      }\n\n      const urls = outputs.map((output) =>\n        typeof output === 'string'\n          ? output\n          : dependencies.createObjectUrl(output),\n      );\n      terminal = true;\n      finalizing = false;\n      updateQueue({ status: 'completed', resultUrl: urls[0] });\n      emit({\n        state: 'completed',\n        providerJobId,\n        urls,\n        generationIds,\n        error: undefined,\n      });\n      return {\n        status: 'completed',\n        urls,\n        generationIds,\n        providerJobId,\n        durationMs: Math.max(0, dependencies.now() - descriptor.createdAt),\n        payload,\n      };\n    };\n\n`;
  source = spliceRequired(
    source,
    '    const complete = async (\n',
    '    const onExternalAbort = () =>',
    completeReplacement,
    'lifecycle completion implementation',
  );

  source = replaceRequired(
    source,
    `        const submission = await parseSubmissionResponse(response);\n\n        if (submission.kind === 'completed') {\n          return complete(submission.urls, submission.payload);\n        }\n\n        await setProcessing(submission.providerJobId);\n        const explicitKey = asString(options.body.apiKey);\n        const apiKey = explicitKey\n          || await dependencies.getApiKey(descriptor.providerId);\n`,
    `        const submission = await parseSubmissionResponse(response);\n        const explicitKey = asString(options.body.apiKey);\n\n        if (submission.kind === 'completed') {\n          const needsKey = Boolean(\n            parseProtectedMediaDescriptor(submission.payload.protectedMedia),\n          );\n          const apiKey = needsKey\n            ? explicitKey || await dependencies.getApiKey(descriptor.providerId)\n            : explicitKey;\n          const outputs = await resolveCompletedOutputs(\n            submission.payload,\n            apiKey,\n            signal,\n            dependencies,\n          );\n          return complete(outputs, submission.payload);\n        }\n\n        await setProcessing(submission.providerJobId);\n        const apiKey = explicitKey\n          || await dependencies.getApiKey(descriptor.providerId);\n`,
    'protected media immediate lifecycle completion',
  );
  source = replaceRequired(
    source,
    `        const normalizedPayload = completedPayload(payload);\n        return complete(\n          normalizeUrls(normalizedPayload),\n          normalizedPayload,\n          submission.providerJobId,\n        );\n`,
    `        const normalizedPayload = completedPayload(payload);\n        const outputs = await resolveCompletedOutputs(\n          normalizedPayload,\n          apiKey,\n          signal,\n          dependencies,\n        );\n        return complete(\n          outputs,\n          normalizedPayload,\n          submission.providerJobId,\n        );\n`,
    'protected media async lifecycle completion',
  );
  source = replaceRequired(
    source,
    `        const normalizedPayload = completedPayload(payload);\n        return complete(\n          normalizeUrls(normalizedPayload),\n          normalizedPayload,\n          providerJobId,\n        );\n`,
    `        const normalizedPayload = completedPayload(payload);\n        const outputs = await resolveCompletedOutputs(\n          normalizedPayload,\n          apiKey,\n          signal,\n          dependencies,\n        );\n        return complete(\n          outputs,\n          normalizedPayload,\n          providerJobId,\n        );\n`,
    'protected media recovery lifecycle completion',
  );

  await fs.writeFile(filePath, source, 'utf8');
}

async function removeLegacyMediaStore() {
  await fs.rm(path.join(root, 'src/lib/server-media-store.ts'), { force: true });
  await fs.rm(
    path.join(root, 'src/app/api/generate/media/[token]'),
    { recursive: true, force: true },
  );
}

async function writeTests() {
  await fs.writeFile(path.join(root, 'src/lib/protected-media.test.ts'), `/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';

import {
  parseProtectedMediaDescriptor,
  PROTECTED_MEDIA_DESCRIPTOR_VERSION,
} from './protected-media';
import { downloadProtectedMedia } from './protected-media-client';

describe('stateless protected media', () => {
  test('parses credential-free descriptors', () => {
    expect(parseProtectedMediaDescriptor({
      version: PROTECTED_MEDIA_DESCRIPTOR_VERSION,
      providerId: 'google-aistudio',
      providerJobId: 'operations/video-123',
      kind: 'video',
    })).toEqual({
      version: 1,
      providerId: 'google-aistudio',
      providerJobId: 'operations/video-123',
      kind: 'video',
    });
    expect(parseProtectedMediaDescriptor({
      version: 1,
      providerId: 'google-aistudio',
      providerJobId: 'operations/video-123',
      kind: 'video',
      apiKey: 'must-not-be-part-of-the-descriptor',
    })).toEqual({
      version: 1,
      providerId: 'google-aistudio',
      providerJobId: 'operations/video-123',
      kind: 'video',
    });
  });

  test('downloads by POST and never places the key in the URL', async () => {
    let requestUrl = '';
    let requestInit: RequestInit | undefined;
    const blob = await downloadProtectedMedia({
      version: 1,
      providerId: 'google-aistudio',
      providerJobId: 'operations/video-123',
      kind: 'video',
    }, 'secret-key', {
      fetchImpl: async (input, init) => {
        requestUrl = String(input);
        requestInit = init;
        return new Response(new Blob(['video'], { type: 'video/mp4' }), {
          headers: { 'Content-Type': 'video/mp4' },
        });
      },
    });

    expect(requestUrl).toBe('/api/generate/media');
    expect(requestUrl).not.toContain('secret-key');
    expect(requestInit?.method).toBe('POST');
    expect(JSON.parse(String(requestInit?.body))).toMatchObject({
      providerId: 'google-aistudio',
      providerJobId: 'operations/video-123',
      apiKey: 'secret-key',
    });
    expect(blob.type).toBe('video/mp4');
  });
});
`, 'utf8');

  await fs.writeFile(path.join(root, 'src/lib/generation-lifecycle-protected-media.test.ts'), `/// <reference types="bun-types" />

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
        completed.push([...outputs]);
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
`, 'utf8');

  await fs.writeFile(path.join(root, 'src/lib/protected-media-persistence.test.ts'), `/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function source(file) {
  return readFile(path.join(process.cwd(), file), 'utf8');
}

describe('protected media persistence ownership', () => {
  test('removes process-memory media tokens', async () => {
    const status = await source('src/app/api/generate/status/route.ts');
    expect(status).toContain('protectedMedia:');
    expect(status).not.toContain('registerProtectedMedia');

    await expect(source('src/lib/server-media-store.ts')).rejects.toBeTruthy();
    await expect(source('src/app/api/generate/media/[token]/route.ts')).rejects.toBeTruthy();
  });

  test('stores generated media separately from generation metadata', async () => {
    const idb = await source('src/lib/idb.ts');
    const persistence = await source('src/lib/generation-persistence.ts');

    expect(idb).toContain("const DB_VERSION = 6");
    expect(idb).toContain("createObjectStore('mediaAssets'");
    expect(idb).toContain('materializeGenerationMedia');
    expect(idb).toContain('URL.createObjectURL(asset.blob)');
    expect(persistence).toContain('saveGenerationMediaAsset(id, output)');
    expect(persistence).toContain('mediaAssetId: asset.id');
  });

  test('media is fetched through a bounded POST route', async () => {
    const route = await source('src/app/api/generate/media/route.ts');
    expect(route).toContain('export async function POST');
    expect(route).toContain('protectedMediaRequestSchema');
    expect(route).toContain('MAX_PROTECTED_MEDIA_BYTES');
    expect(route).toContain("'x-goog-api-key': body.apiKey");
    expect(route).not.toContain('export async function GET');
  });
});
`, 'utf8');
}

await patchGenerationRequest();
await patchProviderRequest();
await patchStatusRoute();
await writeMediaRoute();
await writeGenerationPersistence();
await patchDataLayer();
await patchIdb();
await patchLifecycle();
await removeLegacyMediaStore();
await writeTests();
