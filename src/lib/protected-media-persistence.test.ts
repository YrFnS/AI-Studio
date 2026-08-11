/// <reference types="bun-types" />

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
