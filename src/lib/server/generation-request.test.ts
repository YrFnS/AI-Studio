/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';

import {
  MAX_REFERENCE_IMAGE_BYTES,
  validateReferenceImageFile,
} from '../reference-image-limits';
import {
  GenerationRequestError,
  imageGenerationRequestSchema,
  MAX_IMAGE_GENERATION_REQUEST_BYTES,
  parseGenerationRequest,
  videoGenerationRequestSchema,
} from './generation-request';

function jsonRequest(body: unknown, contentType = 'application/json') {
  return new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: JSON.stringify(body),
  });
}

async function requestError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected request parsing to fail');
}

describe('generation request parsing', () => {
  test('parses and trims a valid image request', async () => {
    const parsed = await parseGenerationRequest(
      jsonRequest({
        providerId: 'openai',
        modelId: 'gpt-image-1',
        prompt: '  Draw a lighthouse at dusk  ',
        aspectRatio: '1:1',
        batchSize: 1,
        apiKey: 'test-key',
      }),
      imageGenerationRequestSchema,
      MAX_IMAGE_GENERATION_REQUEST_BYTES,
    );

    expect(parsed).toMatchObject({
      providerId: 'openai',
      modelId: 'gpt-image-1',
      prompt: 'Draw a lighthouse at dusk',
      batchSize: 1,
    });
  });

  test('rejects unknown fields instead of forwarding them to adapters', async () => {
    const error = await requestError(parseGenerationRequest(
      jsonRequest({
        providerId: 'openai',
        modelId: 'gpt-image-1',
        prompt: 'Draw a lighthouse',
        apiKey: 'test-key',
        unsupportedProviderFlag: true,
      }),
      imageGenerationRequestSchema,
      MAX_IMAGE_GENERATION_REQUEST_BYTES,
    ));

    expect(error).toBeInstanceOf(GenerationRequestError);
    expect(error).toMatchObject({ code: 'invalid_request', status: 400 });
  });

  test('rejects malformed JSON', async () => {
    const request = new Request('http://localhost/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{broken',
    });
    const error = await requestError(parseGenerationRequest(
      request,
      imageGenerationRequestSchema,
      MAX_IMAGE_GENERATION_REQUEST_BYTES,
    ));

    expect(error).toMatchObject({ code: 'invalid_json', status: 400 });
  });

  test('rejects an oversized body before JSON parsing', async () => {
    const error = await requestError(parseGenerationRequest(
      jsonRequest({ value: 'x'.repeat(128) }),
      imageGenerationRequestSchema,
      32,
    ));

    expect(error).toMatchObject({ code: 'request_too_large', status: 413 });
  });

  test('rejects non-JSON generation requests', async () => {
    const error = await requestError(parseGenerationRequest(
      jsonRequest({ providerId: 'openai' }, 'text/plain'),
      imageGenerationRequestSchema,
      MAX_IMAGE_GENERATION_REQUEST_BYTES,
    ));

    expect(error).toMatchObject({ code: 'invalid_content_type', status: 415 });
  });

  test('rejects insecure remote image inputs', async () => {
    const error = await requestError(parseGenerationRequest(
      jsonRequest({
        providerId: 'stability',
        modelId: 'stable-diffusion-3.5-large',
        prompt: 'Transform this image',
        inputImageUrl: 'http://example.com/source.png',
        apiKey: 'test-key',
      }),
      imageGenerationRequestSchema,
      MAX_IMAGE_GENERATION_REQUEST_BYTES,
    ));

    expect(error).toMatchObject({ code: 'invalid_request', status: 400 });
  });

  test('coerces a bounded video duration', async () => {
    const parsed = await parseGenerationRequest(
      jsonRequest({
        providerId: 'runway',
        modelId: 'gen4.5',
        prompt: 'A slow cinematic dolly shot',
        duration: '10',
        aspectRatio: '16:9',
        apiKey: 'test-key',
      }),
      videoGenerationRequestSchema,
      MAX_IMAGE_GENERATION_REQUEST_BYTES,
    );

    expect(parsed.duration).toBe(10);
  });
});

describe('reference image limits', () => {
  test('rejects unsupported file types before FileReader conversion', () => {
    expect(validateReferenceImageFile({
      type: 'application/pdf',
      size: 1024,
    })).toContain('Unsupported image type');
  });

  test('rejects files larger than ten megabytes', () => {
    expect(validateReferenceImageFile({
      type: 'image/png',
      size: MAX_REFERENCE_IMAGE_BYTES + 1,
    })).toContain('10MB');
  });

  test('accepts a supported image within the limit', () => {
    expect(validateReferenceImageFile({
      type: 'image/webp',
      size: MAX_REFERENCE_IMAGE_BYTES,
    })).toBeNull();
  });
});
