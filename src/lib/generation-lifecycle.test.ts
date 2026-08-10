/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import {
  createGenerationLifecycleClient,
  GenerationLifecycleError,
  type GenerationLifecycleDependencies,
  type GenerationLifecycleSnapshot,
} from './generation-lifecycle';
import { GenerationPollingError } from './generation-poller';
import type { GenerationDescriptor } from './generation-persistence';
import type { GenerationQueueItem } from './store';

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function descriptor(overrides: Partial<GenerationDescriptor> = {}): GenerationDescriptor {
  return {
    id: 'img-lifecycle-1',
    providerId: 'replicate',
    providerName: 'Replicate',
    modelId: 'owner/model:version',
    type: 'image',
    prompt: 'A lifecycle test image',
    createdAt: 1_000,
    ...overrides,
  };
}

function dependencies(
  overrides: Partial<GenerationLifecycleDependencies> = {},
): GenerationLifecycleDependencies {
  return {
    fetchImpl: async () => jsonResponse({
      status: 'completed',
      urls: ['https://example.com/result.png'],
    }),
    pollImpl: async () => ({
      status: 'completed',
      urls: ['https://example.com/polled.png'],
    }),
    beginImpl: async () => {},
    markProcessingImpl: async () => {},
    completeImpl: async (generation) => [generation.id],
    failImpl: async () => {},
    getApiKey: async () => 'stored-key',
    now: () => 2_000,
    ...overrides,
  };
}

describe('typed generation lifecycle', () => {
  test('owns immediate submit, persistence, queue, and completion', async () => {
    const calls: string[] = [];
    const added: GenerationQueueItem[] = [];
    const updated: Array<{ id: string; updates: Partial<GenerationQueueItem> }> = [];
    const snapshots: GenerationLifecycleSnapshot[] = [];

    const client = createGenerationLifecycleClient(dependencies({
      beginImpl: async () => { calls.push('begin'); },
      completeImpl: async (generation, urls, providerJobId) => {
        calls.push(`complete:${urls[0]}:${providerJobId || 'direct'}`);
        return [generation.id];
      },
    }));

    const handle = client.start({
      descriptor: descriptor(),
      endpoint: '/api/generate/image',
      body: {
        providerId: 'replicate',
        modelId: 'owner/model:version',
        prompt: 'A lifecycle test image',
      },
      queue: {
        port: {
          add: (item) => added.push(item),
          update: (id, updates) => updated.push({ id, updates }),
        },
        metadata: {
          prompt: 'A lifecycle test image',
          providerName: 'Replicate',
          providerColor: '#000000',
          modelName: 'Test model',
        },
      },
    });
    handle.subscribe((snapshot) => snapshots.push(snapshot));

    const result = await handle.result;

    expect(result).toMatchObject({
      status: 'completed',
      urls: ['https://example.com/result.png'],
      generationIds: ['img-lifecycle-1'],
      durationMs: 1_000,
    });
    expect(calls).toEqual([
      'begin',
      'complete:https://example.com/result.png:direct',
    ]);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      id: 'img-lifecycle-1',
      status: 'processing',
    });
    expect(updated.at(-1)).toEqual({
      id: 'img-lifecycle-1',
      updates: {
        status: 'completed',
        resultUrl: 'https://example.com/result.png',
      },
    });
    expect(snapshots.map((snapshot) => snapshot.state)).toContain('submitting');
    expect(handle.getSnapshot().state).toBe('completed');
  });

  test('marks async jobs, resolves the key, polls, and completes once', async () => {
    const marked: string[] = [];
    const polled: Array<Record<string, unknown>> = [];
    const completed: Array<{ urls: string[]; providerJobId?: string }> = [];

    const client = createGenerationLifecycleClient(dependencies({
      fetchImpl: async () => jsonResponse({
        status: 'processing',
        id: 'aistudio-job.async-token',
      }),
      markProcessingImpl: async (_generation, providerJobId) => {
        marked.push(providerJobId);
      },
      getApiKey: async (providerId) => {
        expect(providerId).toBe('replicate');
        return 'replicate-key';
      },
      pollImpl: async (request) => {
        polled.push({ ...request });
        return {
          status: 'completed',
          resultUrl: 'https://example.com/async.png',
        };
      },
      completeImpl: async (generation, urls, providerJobId) => {
        completed.push({
          urls: urls.filter((url): url is string => Boolean(url)),
          providerJobId,
        });
        return [generation.id];
      },
    }));

    const result = await client.start({
      descriptor: descriptor(),
      endpoint: '/api/generate/image',
      body: {
        providerId: 'replicate',
        modelId: 'owner/model:version',
        prompt: 'async image',
      },
    }).result;

    expect(marked).toEqual(['aistudio-job.async-token']);
    expect(polled).toEqual([{
      id: 'aistudio-job.async-token',
      apiKey: 'replicate-key',
      provider: 'replicate',
      modelId: 'owner/model:version',
    }]);
    expect(completed).toEqual([{
      urls: ['https://example.com/async.png'],
      providerJobId: 'aistudio-job.async-token',
    }]);
    expect(result.providerJobId).toBe('aistudio-job.async-token');
  });

  test('persists submission failures and terminates the queue', async () => {
    const failures: string[] = [];
    const updates: Partial<GenerationQueueItem>[] = [];
    const client = createGenerationLifecycleClient(dependencies({
      fetchImpl: async () => jsonResponse({ error: 'Provider rejected request' }, 400),
      failImpl: async (_generation, error) => { failures.push(error); },
    }));

    const handle = client.start({
      descriptor: descriptor(),
      endpoint: '/api/generate/image',
      body: { providerId: 'replicate', prompt: 'bad request' },
      queue: {
        port: {
          add: () => {},
          update: (_id, patch) => updates.push(patch),
        },
        metadata: {
          prompt: 'bad request',
          providerName: 'Replicate',
          providerColor: '#000000',
          modelName: 'Test model',
        },
      },
    });

    await expect(handle.result).rejects.toMatchObject({
      code: 'submission',
      message: 'Provider rejected request',
    });
    expect(failures).toEqual(['Provider rejected request']);
    expect(updates.at(-1)).toEqual({ status: 'failed' });
    expect(handle.getSnapshot()).toMatchObject({
      state: 'failed',
      error: 'Provider rejected request',
    });
  });

  test('supports user cancellation without duplicate terminal persistence', async () => {
    let startPolling: (() => void) | null = null;
    const pollingStarted = new Promise<void>((resolve) => { startPolling = resolve; });
    const failures: string[] = [];

    const client = createGenerationLifecycleClient(dependencies({
      fetchImpl: async () => jsonResponse({
        status: 'processing',
        id: 'aistudio-job.cancel-token',
      }),
      pollImpl: async (_request, options) => {
        startPolling?.();
        return await new Promise((_, reject) => {
          options?.signal?.addEventListener('abort', () => {
            reject(new GenerationPollingError('Generation polling was cancelled', {
              code: 'aborted',
            }));
          }, { once: true });
        });
      },
      failImpl: async (_generation, error) => { failures.push(error); },
    }));

    const handle = client.start({
      descriptor: descriptor(),
      endpoint: '/api/generate/image',
      body: { providerId: 'replicate', prompt: 'cancel me' },
    });

    await pollingStarted;
    await handle.cancel('Cancelled from the comparison dialog');
    await expect(handle.result).rejects.toBeInstanceOf(GenerationLifecycleError);

    expect(failures).toEqual(['Cancelled from the comparison dialog']);
    expect(handle.getSnapshot()).toMatchObject({
      state: 'cancelled',
      error: 'Cancelled from the comparison dialog',
    });
  });

  test('preserves interrupted jobs when the provider key is missing', async () => {
    const failures: string[] = [];
    const client = createGenerationLifecycleClient(dependencies({
      getApiKey: async () => null,
      failImpl: async (_generation, error) => { failures.push(error); },
    }));

    const handle = client.resume({
      descriptor: descriptor(),
      providerJobId: 'aistudio-job.resume-token',
      preserveOnMissingApiKey: true,
    });

    await expect(handle.result).rejects.toMatchObject({
      code: 'missing-api-key',
    });
    expect(failures).toEqual([]);
    expect(handle.getSnapshot()).toMatchObject({
      state: 'processing',
      providerJobId: 'aistudio-job.resume-token',
      error: 'Reconnect this provider to resume the interrupted generation.',
    });
  });
});
