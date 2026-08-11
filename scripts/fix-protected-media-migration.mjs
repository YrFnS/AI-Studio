import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function replaceRequired(source, oldValue, newValue, label) {
  if (source.includes(newValue)) return source;
  if (!source.includes(oldValue)) throw new Error(`Could not locate ${label}`);
  return source.replace(oldValue, newValue);
}

async function patchLifecycle() {
  const filePath = path.join(root, 'src/lib/generation-lifecycle.ts');
  let source = await fs.readFile(filePath, 'utf8');
  source = replaceRequired(
    source,
    `  apiKey: string | undefined,\n  signal: AbortSignal,\n`,
    `  apiKey: string | null | undefined,\n  signal: AbortSignal,\n`,
    'nullable protected media API key',
  );
  await fs.writeFile(filePath, source, 'utf8');
}

async function patchLifecycleFixture(relativePath, keyValue) {
  const filePath = path.join(root, relativePath);
  let source = await fs.readFile(filePath, 'utf8');
  source = replaceRequired(
    source,
    `    getApiKey: async () => '${keyValue}',\n    now: () => 2_000,\n`,
    `    getApiKey: async () => '${keyValue}',\n    fetchMediaImpl: async () => new Blob(['media'], { type: 'video/mp4' }),\n    createObjectUrl: () => 'blob:test-media',\n    now: () => 2_000,\n`,
    `protected media defaults in ${relativePath}`,
  );
  await fs.writeFile(filePath, source, 'utf8');
}

async function patchProtectedLifecycleTest() {
  const filePath = path.join(
    root,
    'src/lib/generation-lifecycle-protected-media.test.ts',
  );
  let source = await fs.readFile(filePath, 'utf8');
  source = replaceRequired(
    source,
    `        completed.push([...outputs]);\n`,
    `        completed.push(\n          outputs.filter(\n            (output): output is GenerationOutput =>\n              typeof output === 'string' || output instanceof Blob,\n          ),\n        );\n`,
    'protected lifecycle persisted output narrowing',
  );
  await fs.writeFile(filePath, source, 'utf8');
}

async function patchMediaRoute() {
  const filePath = path.join(root, 'src/app/api/generate/media/route.ts');
  let source = await fs.readFile(filePath, 'utf8');

  source = replaceRequired(
    source,
    `function extractGoogleMediaUrl(data: Record<string, any>): string | null {\n  return data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri\n    || data.response?.generatedVideos?.[0]?.video?.uri\n    || null;\n}\n`,
    `function asRecord(value: unknown): Record<string, unknown> | null {\n  return typeof value === 'object' && value !== null && !Array.isArray(value)\n    ? value as Record<string, unknown>\n    : null;\n}\n\nfunction firstRecord(value: unknown): Record<string, unknown> | null {\n  return Array.isArray(value) ? asRecord(value[0]) : null;\n}\n\nfunction extractGoogleMediaUrl(data: Record<string, unknown>): string | null {\n  const response = asRecord(data.response);\n  const generateVideoResponse = asRecord(response?.generateVideoResponse);\n  const sample = firstRecord(generateVideoResponse?.generatedSamples);\n  const sampleVideo = asRecord(sample?.video);\n  if (typeof sampleVideo?.uri === 'string') return sampleVideo.uri;\n\n  const generatedVideo = firstRecord(response?.generatedVideos);\n  const video = asRecord(generatedVideo?.video);\n  return typeof video?.uri === 'string' ? video.uri : null;\n}\n`,
    'typed Google media extraction',
  );
  source = replaceRequired(
    source,
    `    const operationData = await operation.json() as Record<string, any>;\n`,
    `    const operationData = await operation.json() as Record<string, unknown>;\n`,
    'typed Google operation response',
  );

  await fs.writeFile(filePath, source, 'utf8');
}

async function patchProviderRequest() {
  const filePath = path.join(root, 'src/lib/server/provider-request.ts');
  let source = await fs.readFile(filePath, 'utf8');
  source = source.replace(
    `            } catch (error) {\n              options.finish();\n              controller.error(\n`,
    `            } catch {\n              options.finish();\n              controller.error(\n`,
  );
  await fs.writeFile(filePath, source, 'utf8');
}

await patchLifecycle();
await patchLifecycleFixture('src/lib/generation-lifecycle.test.ts', 'stored-key');
await patchLifecycleFixture('src/lib/generation-lifecycle-images.test.ts', 'key');
await patchProtectedLifecycleTest();
await patchMediaRoute();
await patchProviderRequest();
