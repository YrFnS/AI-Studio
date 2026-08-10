/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const studioPath = path.join(
  process.cwd(),
  'src/components/studio/cinema-studio.tsx',
);

describe('Cinema Studio generation lifecycle', () => {
  test('uses lifecycle handles instead of component-owned polling', async () => {
    const source = await readFile(studioPath, 'utf8');

    expect(source).toContain('startGenerationJob({');
    expect(source).toContain('handleCancelCinemaGeneration');
    expect(source).toContain('signal: owner.signal');
    expect(source).not.toContain('const startPolling =');
    expect(source).not.toContain('setCurrentJobId');
    expect(source).not.toContain('generationRef');
    expect(source).not.toContain('queueIdRef');
    expect(source).not.toContain('const queueItem: GenerationQueueItem');
  });

  test('does not append the scene preset twice', async () => {
    const source = await readFile(studioPath, 'utf8');

    expect(source).toContain('buildCinemaSuffix(');
    expect(source).not.toContain('freshScenePreset');
    expect(source).not.toContain('sceneSuffix');
    expect(source).toContain("prompt.trim() + ', ' + cinemaSuffix");
  });
});
