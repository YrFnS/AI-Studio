/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function source(file: string) {
  return readFile(path.join(process.cwd(), file), 'utf8');
}

describe('cancellation and missing-key recovery ownership', () => {
  test('the cancellation route uses strict parsing and provider adapters', async () => {
    const content = await source('src/app/api/generate/cancel/route.ts');

    expect(content).toContain('cancelGenerationRequestSchema');
    expect(content).toContain('MAX_CANCEL_REQUEST_BYTES');
    expect(content).toContain('decodeGenerationJobToken');
    expect(content).toContain('cancelProviderGeneration');
    expect(content).not.toContain('apiKey=');
  });

  test('the lifecycle coordinates remote cancellation before terminal persistence', async () => {
    const content = await source('src/lib/generation-lifecycle.ts');

    expect(content).toContain('requestRemoteCancellation');
    expect(content).toContain('cancellationPromise');
    expect(content).toContain('remoteCancellationMessage');
    expect(content).toContain('supportsRemoteGenerationCancellation');
    expect(content).toContain("outcome: 'failed'");
  });

  test('missing-key recovery is visible and actionable', async () => {
    const content = await source('src/components/pending-generation-recovery.tsx');

    expect(content).toContain('need a key');
    expect(content).toContain('Open provider settings');
    expect(content).toContain('Retry now');
    expect(content).toContain('Stop tracking');
    expect(content).toContain('providerVersion');
    expect(content).toContain('cancelGenerationJob');
  });

  test('saving or removing a key triggers another recovery scan', async () => {
    const content = await source('src/hooks/use-api-keys.ts');

    expect(content).toContain('notifyProviderKeyChange');
    expect(content).toContain('refreshProviders()');
    expect(content).toContain('ai-studio:api-keys-changed');
  });

  test('the generation queue shows the remote cancellation result', async () => {
    const queue = await source('src/components/studio/generation-queue.tsx');
    const store = await source('src/lib/store.ts');

    expect(store).toContain('remoteCancellation?: GenerationCancellationOutcome');
    expect(store).toContain('detail?: string');
    expect(queue).toContain('item.detail');
    expect(queue).toContain("item.remoteCancellation === 'requested'");
  });
});
