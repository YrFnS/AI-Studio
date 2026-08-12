/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function source(file: string) {
  return readFile(path.join(process.cwd(), file), 'utf8');
}

describe('derived generation lifecycle ownership', () => {
  test('Image Studio derived actions use typed lifecycle handles', async () => {
    const content = await source('src/components/studio/image-studio.tsx');

    expect(content).toContain('prepareGenerationOperation({');
    expect(content).toContain('handleCancelPostGenAction');
    expect(content).toContain('postGenHandleRef');
    expect(content).not.toContain('postGenPollRef');
    expect(content).not.toContain('postGenPollCountRef');
    expect(content).not.toContain('await beginGeneration(derivedGeneration)');
    expect(content).not.toContain('await markGenerationProcessing(derivedGeneration');
    expect(content).not.toContain("!['runway', 'luma', 'fal', 'replicate', 'seedance'].includes(selectedImageProvider)");
  });

  test('both editor surfaces share the editor lifecycle hook', async () => {
    const editor = await source('src/components/studio/image-editor.tsx');
    const panel = await source('src/components/studio/image-editor-panel.tsx');

    for (const content of [editor, panel]) {
      expect(content).toContain('useEditorGeneration({');
      expect(content).toContain('cancelOperation');
      expect(content).not.toContain('/api/generate/status?id=');
      expect(content).not.toContain("fetch('/api/generate/image'");
      expect(content).not.toContain("type: 'upscale'");
      expect(content).not.toContain("type: 'variation'");
      expect(content).not.toContain('setInterval(async () =>');
    }
  });

  test('the reusable post-generation hook has no local polling loop', async () => {
    const content = await source('src/components/studio/use-post-gen-actions.ts');

    expect(content).toContain('startGenerationJob({');
    expect(content).toContain('prepareGenerationOperation({');
    expect(content).toContain('cancelPostGenAction');
    expect(content).not.toContain('postGenPollRef');
    expect(content).not.toContain('/api/generate/status?id=');
    expect(content).not.toContain('setInterval(async () =>');
  });

  test('unsupported edit providers are rejected instead of receiving OpenAI payloads', async () => {
    const content = await source('src/app/api/generate/edit/route.ts');

    expect(content).toContain('Image editing is not supported for');
    expect(content).not.toContain('default: result = await editOpenAI');
  });
});
