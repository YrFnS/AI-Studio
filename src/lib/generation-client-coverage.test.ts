/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const sourceRoot = path.join(process.cwd(), 'src');
const explicitImport =
  "import { generationFetch as fetch } from '@/lib/generation-client';";
const supportedExtensions = new Set(['.ts', '.tsx']);
const skippedFiles = new Set([
  path.normalize('src/lib/generation-client.ts'),
  path.normalize('src/lib/generation-client.test.ts'),
  path.normalize('src/lib/generation-client-coverage.test.ts'),
  path.normalize('src/lib/generation-poller.ts'),
  path.normalize('src/lib/generation-poller.test.ts'),
  path.normalize('src/components/secure-provider-fetch-bridge.tsx'),
]);

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else if (supportedExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function repositoryPath(filePath: string): string {
  return path.normalize(path.relative(process.cwd(), filePath));
}

describe('explicit generation client coverage', () => {
  test('every browser generation caller imports the explicit client', async () => {
    const files = await walk(sourceRoot);
    const missing: string[] = [];

    for (const filePath of files) {
      const relativePath = repositoryPath(filePath);
      if (relativePath.startsWith(path.normalize('src/app/api/'))) continue;
      if (skippedFiles.has(relativePath)) continue;

      const content = await readFile(filePath, 'utf8');
      if (!content.includes('/api/generate/')) continue;

      const isClientModule =
        content.startsWith("'use client';")
        || content.startsWith('"use client";');
      if (!isClientModule || !content.includes(explicitImport)) {
        missing.push(relativePath);
      }
    }

    expect(missing.sort()).toEqual([]);
  });
});
