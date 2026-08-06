/// <reference types="bun-types" />

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

  test('rejects malformed and legacy identifiers', () => {
    expect(decodeGenerationJobToken('plain-provider-job-id')).toBeNull();
    expect(decodeGenerationJobToken('aistudio-job.not-valid-base64')).toBeNull();
  });
});
