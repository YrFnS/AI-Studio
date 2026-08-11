/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function source(relativePath: string) {
  return readFile(path.join(process.cwd(), relativePath), 'utf8');
}

describe('P0 product-correctness ownership', () => {
  test('Settings owns real browser backup and restore without placeholder APIs', async () => {
    const content = await source('src/components/studio/settings.tsx');

    expect(content).toContain('createAIStudioBackup');
    expect(content).toContain('restoreAIStudioBackup');
    expect(content).toContain('downloaded media');
    expect(content).not.toContain('/api/settings/export');
    expect(content).not.toContain('/api/settings/import');
    expect(content).not.toContain('never sent to our server');
    expect(existsSync(path.join(
      process.cwd(),
      'src/app/api/settings/export/route.ts',
    ))).toBe(false);
    expect(existsSync(path.join(
      process.cwd(),
      'src/app/api/settings/import/route.ts',
    ))).toBe(false);
  });

  test('the local backup excludes API keys and includes media assets', async () => {
    const content = await source('src/lib/local-backup.ts');

    expect(content).toContain("includesApiKeys: false");
    expect(content).toContain("'mediaAssets'");
    expect(content).not.toContain("'api-keys',");
    expect(content).toContain('serializeBackupMediaAsset');
    expect(content).toContain('restoreAIStudioBackup');
  });

  test('Gallery search is applied before IndexedDB pagination', async () => {
    const gallery = await source('src/components/studio/gallery.tsx');
    const data = await source('src/lib/data.ts');
    const idb = await source('src/lib/idb.ts');

    expect(gallery).toContain('search: debouncedSearchQuery || undefined');
    expect(gallery).toContain('generationRequestRef');
    expect(gallery).toContain('requestId !== generationRequestRef.current');
    expect(gallery).toContain('const filteredGenerations = generations;');
    expect(gallery).not.toContain('generations.filter((g) => g.prompt');
    expect(data).toContain('search: options?.search');
    expect(idb).toContain('matchesGenerationSearch(generation');
  });

  test('documentation records completed product-correctness ownership', async () => {
    const readme = await source('README.md');
    const tracker = await source('docs/P0-RUNTIME-INTEGRITY.md');

    expect(readme).toContain('Versioned local backup');
    expect(readme).toContain('full IndexedDB search');
    expect(tracker).toContain('Replaced the placeholder Settings transfer APIs');
    expect(tracker).not.toContain('Repair Settings export/import');
  });

  test('queue cleanup delegates to active-status semantics', async () => {
    const store = await source('src/lib/store.ts');
    const queue = await source('src/components/studio/generation-queue.tsx');

    expect(store).toContain('keepActiveGenerationQueueItems');
    expect(queue).toContain('isActiveGenerationStatus');
    expect(store).not.toContain(
      "generationQueue.filter((item) => item.status === 'processing')",
    );
  });
});
