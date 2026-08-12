/// <reference types="bun-types" />

import { Buffer } from 'node:buffer';
import { describe, expect, test } from 'bun:test';
import {
  decodeGenerationJobToken,
  encodeGenerationJobToken,
} from './generation-job';

describe('generation job tokens', () => {
  test('round-trips provider job metadata', () => {
    const token = encodeGenerationJobToken({
      providerId: 'fal',
      modelId: 'fal-ai/flux/dev',
      jobId: 'request/with/slashes',
      kind: 'image',
    });

    expect(decodeGenerationJobToken(token)).toEqual({
      version: 1,
      providerId: 'fal',
      modelId: 'fal-ai/flux/dev',
      jobId: 'request/with/slashes',
      kind: 'image',
    });
  });

  test('supports video operation names without server state', () => {
    const token = encodeGenerationJobToken({
      providerId: 'google-aistudio',
      modelId: 'veo-3.1-generate-preview',
      jobId: 'operations/video-job-123',
      kind: 'video',
    });

    expect(decodeGenerationJobToken(token)).toMatchObject({
      providerId: 'google-aistudio',
      modelId: 'veo-3.1-generate-preview',
      jobId: 'operations/video-job-123',
      kind: 'video',
    });
  });

  test('never serializes extra credential fields', () => {
    const input = {
      providerId: 'replicate',
      modelId: 'owner/model',
      jobId: 'prediction-id',
      kind: 'image' as const,
      apiKey: 'super-secret-provider-key',
    };
    const token = encodeGenerationJobToken(input);
    const encoded = token.slice('aistudio-job.'.length);
    const rawPayload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as Record<string, unknown>;

    expect(rawPayload.apiKey).toBeUndefined();
    expect(rawPayload).toEqual({
      version: 1,
      providerId: 'replicate',
      modelId: 'owner/model',
      jobId: 'prediction-id',
      kind: 'image',
    });
  });

  test('rejects malformed, legacy, and oversized identifiers', () => {
    expect(decodeGenerationJobToken('plain-provider-job-id')).toBeNull();
    expect(decodeGenerationJobToken('aistudio-job.not-valid-base64')).toBeNull();
    expect(
      decodeGenerationJobToken(`aistudio-job.${'a'.repeat(16_385)}`),
    ).toBeNull();
  });
});
