/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';

import { ProviderRequestError } from './provider-request';
import { createProviderGenerationCanceller } from './generation-cancel';

type FetchCall = {
  provider: string;
  input: Parameters<typeof globalThis.fetch>[0];
  init?: RequestInit;
};

function successfulCanceller(calls: FetchCall[]) {
  return createProviderGenerationCanceller(async (provider, input, init) => {
    calls.push({ provider, input, init });
    return new Response(null, { status: 204 });
  });
}

describe('provider generation cancellation', () => {
  test('cancels Replicate predictions through the documented endpoint', async () => {
    const calls: FetchCall[] = [];
    const cancel = successfulCanceller(calls);

    const result = await cancel({
      providerId: 'replicate',
      providerJobId: 'prediction-123',
      apiKey: 'replicate-key',
    });

    expect(result).toMatchObject({
      outcome: 'requested',
      providerId: 'replicate',
      remoteAttempted: true,
    });
    expect(String(calls[0].input)).toBe(
      'https://api.replicate.com/v1/predictions/prediction-123/cancel',
    );
    expect(calls[0].init?.method).toBe('POST');
    expect(new Headers(calls[0].init?.headers).get('authorization')).toBe(
      'Bearer replicate-key',
    );
  });

  test('cancels Fal queue requests with the original model id', async () => {
    const calls: FetchCall[] = [];
    const cancel = successfulCanceller(calls);

    await cancel({
      providerId: 'fal',
      providerJobId: 'request-123',
      modelId: 'bytedance/seedance-2.0/text-to-video',
      apiKey: 'fal-key',
    });

    expect(String(calls[0].input)).toBe(
      'https://queue.fal.run/bytedance/seedance-2.0/text-to-video/requests/request-123/cancel',
    );
    expect(calls[0].init?.method).toBe('POST');
    expect(new Headers(calls[0].init?.headers).get('authorization')).toBe(
      'Key fal-key',
    );
  });

  test('uses DELETE for Runway task cancellation', async () => {
    const calls: FetchCall[] = [];
    const cancel = successfulCanceller(calls);

    await cancel({
      providerId: 'runway',
      providerJobId: 'task-123',
      apiKey: 'runway-key',
    });

    expect(String(calls[0].input)).toBe(
      'https://api.dev.runwayml.com/v1/tasks/task-123',
    );
    expect(calls[0].init?.method).toBe('DELETE');
    expect(new Headers(calls[0].init?.headers).get('x-runway-version')).toBe(
      '2024-11-06',
    );
  });

  test('uses Luma generation deletion as the provider stop request', async () => {
    const calls: FetchCall[] = [];
    const cancel = successfulCanceller(calls);

    const result = await cancel({
      providerId: 'luma',
      providerJobId: 'generation-123',
      apiKey: 'luma-key',
    });

    expect(String(calls[0].input)).toBe(
      'https://api.lumalabs.ai/dream-machine/v1/generations/generation-123',
    );
    expect(calls[0].init?.method).toBe('DELETE');
    expect(result.message).toContain('deletion request');
  });

  test('does not contact providers without a verified cancellation adapter', async () => {
    const calls: FetchCall[] = [];
    const cancel = successfulCanceller(calls);

    const result = await cancel({
      providerId: 'google-aistudio',
      providerJobId: 'operations/123',
      apiKey: 'google-key',
    });

    expect(result).toMatchObject({
      outcome: 'unsupported',
      remoteAttempted: false,
    });
    expect(calls).toHaveLength(0);
  });

  test('treats an already terminal provider job as idempotent success', async () => {
    const cancel = createProviderGenerationCanceller(async () => {
      throw new ProviderRequestError({
        provider: 'Replicate',
        code: 'provider_rejected_request',
        message: 'Replicate rejected the request.',
        status: 400,
        providerStatus: 404,
        retryable: false,
      });
    });

    const result = await cancel({
      providerId: 'replicate',
      providerJobId: 'missing',
      apiKey: 'key',
    });

    expect(result.outcome).toBe('already-terminal');
    expect(result.remoteAttempted).toBe(true);
  });
});
