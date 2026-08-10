/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function source(file: string) {
  return readFile(path.join(process.cwd(), file), 'utf8');
}

const generationRoutes = [
  'src/app/api/generate/image/route.ts',
  'src/app/api/generate/video/route.ts',
  'src/app/api/generate/edit/route.ts',
  'src/app/api/generate/upscale/route.ts',
  'src/app/api/generate/variations/route.ts',
  'src/app/api/generate/img2vid/route.ts',
  'src/app/api/generate/status/route.ts',
];

const providerCallers = [
  'src/app/api/generate/handlers.ts',
  'src/app/api/generate/video/route.ts',
  'src/app/api/generate/edit/route.ts',
  'src/app/api/generate/upscale/route.ts',
  'src/app/api/generate/variations/route.ts',
  'src/app/api/generate/img2vid/route.ts',
  'src/app/api/generate/status/route.ts',
  'src/lib/server/replicate.ts',
];

describe('generation route safety ownership', () => {
  for (const file of generationRoutes) {
    test(`${file} uses bounded parsing and normalized errors`, async () => {
      const content = await source(file);
      expect(content).toContain('parseGenerationRequest(');
      expect(content).toContain('generationErrorResponse(');
      expect(content).not.toContain('error instanceof Error ? error.message');
    });
  }

  for (const file of providerCallers) {
    test(`${file} uses the bounded provider transport`, async () => {
      const content = await source(file);
      expect(content).toContain('providerFetch as fetch');
    });
  }

  test('edit inputs use the shared SSRF and size-safe image loader', async () => {
    const content = await source('src/app/api/generate/edit/route.ts');
    expect(content).toContain('resolveImageBlob(params.image)');
    expect(content).toContain('await resolveImageBlob(params.mask)');
    expect(content).not.toContain('base64ToBlob');
  });

  test('browser upload flows validate files before FileReader conversion', async () => {
    const imageUpload = await source('src/components/studio/image-upload.tsx');
    const videoStudio = await source('src/components/studio/video-studio.tsx');
    const imageStudio = await source('src/components/studio/image-studio.tsx');

    expect(imageUpload).toContain('validateReferenceImageFile(file)');
    expect(imageUpload).not.toContain('20 * 1024 * 1024');
    expect(videoStudio).toContain('validateReferenceImageFile(file)');
    expect(imageStudio.match(/validateReferenceImageFile\(file\)/g)?.length).toBe(2);
  });

  test('the upload route enforces the shared binary limit before base64 conversion', async () => {
    const content = await source('src/app/api/upload/route.ts');
    expect(content).toContain('MAX_REFERENCE_IMAGE_BYTES');
    expect(content).toContain('file.size > MAX_REFERENCE_IMAGE_BYTES');
    expect(content.indexOf('file.size > MAX_REFERENCE_IMAGE_BYTES'))
      .toBeLessThan(content.indexOf('file.arrayBuffer()'));
  });
});
