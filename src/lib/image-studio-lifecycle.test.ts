/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const studioPath = path.join(
  process.cwd(),
  'src/components/studio/image-studio.tsx',
);

describe('Image Studio generation lifecycle', () => {
  test('uses lifecycle handles instead of a component-owned polling loop', async () => {
    const source = await readFile(studioPath, 'utf8');

    expect(source).toContain('startGenerationJob({');
    expect(source).toContain('handleCancelImageGeneration');
    expect(source).toContain("signal: owner.signal");
    expect(source).not.toContain('const startPolling =');
    expect(source).not.toContain('setCurrentJobId');
    expect(source).not.toContain('generationRef');
    expect(source).not.toContain('queueIdRef');
    expect(source).not.toContain('const queueItem: GenerationQueueItem');
  });
});
