/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';

import {
  createGenerationCancellationClient,
  GenerationCancellationError,
} from './generation-cancel-client';

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('explicit generation cancellation client', () => {
  test('keeps credentials in a POST body', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const cancel = createGenerationCancellationClient(async (input, init) => {
      calls.push({ input, init });
      return jsonResponse({
        outcome: 'requested',
        providerId: 'runway',
        remoteAttempted: true,
        message: 'Runway accepted the cancellation request.',
      });
    });

    const result = await cancel({
      id: 'aistudio-job.token',
      providerId: 'runway',
      modelId: 'gen4.5',
      apiKey: 'secret-key',
    });

    expect(result.outcome).toBe('requested');
    expect(calls[0].input).toBe('/api/generate/cancel');
    expect(String(calls[0].input)).not.toContain('secret-key');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      id: 'aistudio-job.token',
      providerId: 'runway',
      modelId: 'gen4.5',
      apiKey: 'secret-key',
    });
  });

  test('surfaces normalized route failures', async () => {
    const cancel = createGenerationCancellationClient(async () =>
      jsonResponse({ error: 'Generation request validation failed' }, 400));

    await expect(cancel({
      id: 'job',
      providerId: 'replicate',
    })).rejects.toBeInstanceOf(GenerationCancellationError);
  });
});
