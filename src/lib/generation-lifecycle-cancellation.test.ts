/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';

import {
  createGenerationLifecycleClient,
  type GenerationLifecycleSnapshot,
} from './generation-lifecycle';
import { GenerationPollingError } from './generation-poller';
import type { GenerationDescriptor } from './generation-persistence';

function processingResponse(id = 'aistudio-job.provider-token') {
  return new Response(JSON.stringify({
    status: 'processing',
    id,
    jobId: id,
    localJob: true,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function descriptor(providerId = 'runway'): GenerationDescriptor {
  return {
    id: 'vid-cancel-test',
    providerId,
    providerName: providerId === 'runway' ? 'Runway' : 'Google AI Studio',
    modelId: providerId === 'runway' ? 'gen4.5' : 'veo-3.1-generate-preview',
    type: 'video',
    prompt: 'A cancellation test video',
    createdAt: 1_000,
  };
}

function abortingPoll(signal?: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const fail = () => reject(new GenerationPollingError(
      'Generation polling was cancelled',
      { code: 'aborted' },
    ));
    if (signal?.aborted) fail();
    else signal?.addEventListener('abort', fail, { once: true });
  });
}

describe('generation lifecycle remote cancellation', () => {
  test('attempts remote cancellation exactly once and persists its outcome', async () => {
    let markedResolve: (() => void) | undefined;
    const marked = new Promise<void>((resolve) => { markedResolve = resolve; });
    const cancelled: Record<string, unknown>[] = [];
    const failures: string[] = [];
    const snapshots: GenerationLifecycleSnapshot[] = [];

    const client = createGenerationLifecycleClient({
      fetchImpl: async () => processingResponse(),
      pollImpl: async (_request, options) => abortingPoll(options.signal),
      beginImpl: async () => {},
      markProcessingImpl: async () => { markedResolve?.(); },
      completeImpl: async () => [],
      failImpl: async (_generation, error) => { failures.push(error); },
      getApiKey: async () => 'runway-key',
      cancelImpl: async (request) => {
        cancelled.push({ ...request });
        return {
          outcome: 'requested',
          providerId: 'runway',
          remoteAttempted: true,
          message: 'Runway accepted the task cancellation request.',
        };
      },
      now: () => 2_000,
    });

    const handle = client.start({
      descriptor: descriptor(),
      endpoint: '/api/generate/video',
      body: {
        providerId: 'runway',
        modelId: 'gen4.5',
        prompt: 'A cancellation test video',
      },
    });
    handle.subscribe((snapshot) => snapshots.push(snapshot));

    await marked;
    const first = handle.cancel();
    const second = handle.cancel();
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult).toEqual(secondResult);
    expect(cancelled).toEqual([{
      id: 'aistudio-job.provider-token',
      providerId: 'runway',
      modelId: 'gen4.5',
      apiKey: 'runway-key',
    }]);
    expect(failures).toEqual(['Runway accepted the task cancellation request.']);
    expect(handle.getSnapshot()).toMatchObject({
      state: 'cancelled',
      remoteCancellation: 'requested',
      remoteCancellationMessage: 'Runway accepted the task cancellation request.',
    });
    expect(snapshots.some((snapshot) => snapshot.remoteCancellation === 'requested')).toBe(true);
    await expect(handle.result).rejects.toMatchObject({ code: 'cancelled' });
  });

  test('stops locally without contacting providers lacking a verified adapter', async () => {
    let markedResolve: (() => void) | undefined;
    const marked = new Promise<void>((resolve) => { markedResolve = resolve; });
    let remoteCalls = 0;

    const client = createGenerationLifecycleClient({
      fetchImpl: async () => processingResponse(),
      pollImpl: async (_request, options) => abortingPoll(options.signal),
      beginImpl: async () => {},
      markProcessingImpl: async () => { markedResolve?.(); },
      completeImpl: async () => [],
      failImpl: async () => {},
      getApiKey: async () => 'google-key',
      cancelImpl: async () => {
        remoteCalls += 1;
        throw new Error('should not run');
      },
      now: () => 2_000,
    });

    const handle = client.start({
      descriptor: descriptor('google-aistudio'),
      endpoint: '/api/generate/video',
      body: {
        providerId: 'google-aistudio',
        modelId: 'veo-3.1-generate-preview',
        prompt: 'A cancellation test video',
      },
    });

    await marked;
    const result = await handle.cancel();

    expect(result.outcome).toBe('local-only');
    expect(result.remoteAttempted).toBe(false);
    expect(remoteCalls).toBe(0);
    await expect(handle.result).rejects.toMatchObject({ code: 'cancelled' });
  });
});
