/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';

import {
  cancelGenerationRequestSchema,
  GenerationRequestError,
  MAX_CANCEL_REQUEST_BYTES,
  parseGenerationRequest,
} from './generation-request';

function request(body: unknown) {
  return new Request('http://localhost/api/generate/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('generation cancellation request parsing', () => {
  test('accepts a bounded credential-safe cancellation body', async () => {
    const parsed = await parseGenerationRequest(
      request({
        id: 'aistudio-job.token',
        providerId: 'runway',
        modelId: 'gen4.5',
        apiKey: 'runway-key',
      }),
      cancelGenerationRequestSchema,
      MAX_CANCEL_REQUEST_BYTES,
    );

    expect(parsed).toEqual({
      id: 'aistudio-job.token',
      providerId: 'runway',
      modelId: 'gen4.5',
      apiKey: 'runway-key',
    });
  });

  test('requires the provider key needed for remote cancellation', async () => {
    try {
      await parseGenerationRequest(
        request({ id: 'job', providerId: 'replicate' }),
        cancelGenerationRequestSchema,
        MAX_CANCEL_REQUEST_BYTES,
      );
      throw new Error('Expected cancellation parsing to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(GenerationRequestError);
      expect(error).toMatchObject({ code: 'invalid_request', status: 400 });
    }
  });

  test('rejects unknown fields instead of forwarding them to a provider', async () => {
    try {
      await parseGenerationRequest(
        request({
          id: 'job',
          providerId: 'replicate',
          apiKey: 'key',
          forceDeleteAccount: true,
        }),
        cancelGenerationRequestSchema,
        MAX_CANCEL_REQUEST_BYTES,
      );
      throw new Error('Expected cancellation parsing to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(GenerationRequestError);
      expect(error).toMatchObject({ code: 'invalid_request', status: 400 });
    }
  });
});
