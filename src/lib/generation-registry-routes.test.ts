/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function source(file: string) {
  return readFile(path.join(process.cwd(), file), 'utf8');
}

const routeExpectations: Array<{
  file: string;
  operation: string;
  route: string;
}> = [
  {
    file: 'src/app/api/generate/image/route.ts',
    operation: "inputImageUrl ? 'image-to-image' : 'text-to-image'",
    route: "'image'",
  },
  {
    file: 'src/app/api/generate/video/route.ts',
    operation: "sourceImage ? 'image-to-video' : 'text-to-video'",
    route: "'video'",
  },
  {
    file: 'src/app/api/generate/edit/route.ts',
    operation: "mask ? 'inpaint' : 'edit'",
    route: "'edit'",
  },
  {
    file: 'src/app/api/generate/upscale/route.ts',
    operation: "'upscale'",
    route: "'upscale'",
  },
  {
    file: 'src/app/api/generate/variations/route.ts',
    operation: "'variation'",
    route: "'variations'",
  },
  {
    file: 'src/app/api/generate/img2vid/route.ts',
    operation: "'image-to-video'",
    route: "'img2vid'",
  },
];

describe('generation route registry enforcement', () => {
  for (const expectation of routeExpectations) {
    test(`${expectation.file} requires its model operation contract`, async () => {
      const content = await source(expectation.file);
      expect(content).toContain('requireModelOperation(');
      expect(content).toContain(expectation.operation);
      expect(content).toContain(expectation.route);
      expect(content).toContain('GenerationRegistryError');
    });
  }

  test('the provider endpoint decorates and filters the catalog through the registry', async () => {
    const content = await source('src/app/api/providers/route.ts');
    expect(content).toContain('const providersWithModels = decorateRegisteredProviders(catalog)');
    expect(content).toContain('supportedGenerationKinds: getSupportedGenerationKinds(provider.name)');
  });

  test('generic route fallbacks are no longer exposed as upscale or variation adapters', async () => {
    const upscale = await source('src/app/api/generate/upscale/route.ts');
    const variations = await source('src/app/api/generate/variations/route.ts');

    expect(upscale).not.toContain('upscaleOpenAI');
    expect(upscale).not.toContain('upscaleReplicate');
    expect(upscale).not.toContain('upscaleFal');
    expect(variations).not.toContain('variationReplicate');
    expect(variations).not.toContain('variationFal');
  });

  test('provider adapters use executable model-specific contracts', async () => {
    const handlers = await source('src/app/api/generate/handlers.ts');
    const video = await source('src/app/api/generate/video/route.ts');

    expect(handlers).toContain("formData.append('mode', 'image-to-image')");
    expect(handlers).toContain('submitReplicatePrediction(');
    expect(video).toContain('submitReplicatePrediction(');
    expect(handlers).not.toContain("body: JSON.stringify({ version: params.model, input })");
  });

  test('Image, Video, and Cinema selectors filter by the active registered operation', async () => {
    const image = await source('src/components/studio/image-studio.tsx');
    const video = await source('src/components/studio/video-studio.tsx');
    const cinema = await source('src/components/studio/cinema-studio.tsx');

    expect(image).toContain("const imageOperationCapability = inputImageUrl ? 'i2i' : 't2i'");
    expect(image).toContain(".includes(imageOperationCapability)");
    expect(video).toContain("const videoOperationCapability = requiresImageToVideo ? 'i2v' : 't2v'");
    expect(video).toContain(".includes(videoOperationCapability)");
    expect(cinema).toContain(".split(',').includes('t2i')");

    for (const content of [image, video, cinema]) {
      expect(content).not.toContain('getAllCustomModels');
    }
  });
});
