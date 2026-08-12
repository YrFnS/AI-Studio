/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';

import {
  ReplicateModelReferenceError,
  buildReplicatePredictionRequest,
} from './replicate';

describe('Replicate prediction request routing', () => {
  test('uses the official-model endpoint for owner/name models', () => {
    expect(buildReplicatePredictionRequest(
      'https://api.replicate.com',
      'black-forest-labs/flux-dev',
      { prompt: 'test' },
    )).toEqual({
      url: 'https://api.replicate.com/v1/models/black-forest-labs/flux-dev/predictions',
      body: { input: { prompt: 'test' } },
    });
  });

  test('uses the version endpoint only for immutable version references', () => {
    const version = 'a'.repeat(64);
    expect(buildReplicatePredictionRequest(
      'https://api.replicate.com/',
      version,
      { prompt: 'test' },
    )).toEqual({
      url: 'https://api.replicate.com/v1/predictions',
      body: {
        version,
        input: { prompt: 'test' },
      },
    });
  });

  test('extracts the immutable version from owner/name:version references', () => {
    const version = 'b'.repeat(64);
    const request = buildReplicatePredictionRequest(
      'https://api.replicate.com',
      `owner/model:${version}`,
      {},
    );

    expect(request.body.version).toBe(version);
    expect(request.url).toEndWith('/v1/predictions');
  });

  test('rejects ambiguous model references', () => {
    expect(() => buildReplicatePredictionRequest(
      'https://api.replicate.com',
      'flux-dev',
      {},
    )).toThrow(ReplicateModelReferenceError);
  });
});
