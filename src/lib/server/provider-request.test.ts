/// <reference types="bun-types" />

import { afterEach, describe, expect, test } from 'bun:test';

import {
  providerFetch,
  ProviderRequestError,
} from './provider-request';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

async function rejected(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected provider request to fail');
}

describe('providerFetch', () => {
  test('normalizes authentication failures without exposing provider bodies', async () => {
    globalThis.fetch = (async () => new Response(
      'secret upstream account detail',
      { status: 401 },
    )) as typeof fetch;

    const error = await rejected(providerFetch(
      'OpenAI',
      'https://api.openai.com/v1/images/generations',
      { method: 'POST' },
    ));

    expect(error).toBeInstanceOf(ProviderRequestError);
    expect(error).toMatchObject({
      code: 'provider_auth_failed',
      provider: 'OpenAI',
      providerStatus: 401,
      retryable: false,
      status: 401,
    });
    expect((error as Error).message).not.toContain('secret upstream');
    expect((error as ProviderRequestError).details).toContain('secret upstream');
  });

  test('marks quota and rate-limit failures as retryable', async () => {
    globalThis.fetch = (async () => new Response('quota exceeded', {
      status: 429,
    })) as typeof fetch;

    const error = await rejected(providerFetch(
      'Fal.ai',
      'https://queue.fal.run/model',
    ));

    expect(error).toMatchObject({
      code: 'provider_rate_limited',
      retryable: true,
      status: 429,
    });
  });

  test('infers a provider label from a known endpoint', async () => {
    globalThis.fetch = (async () => new Response('denied', {
      status: 403,
    })) as typeof fetch;

    const error = await rejected(providerFetch(
      'https://api.openai.com/v1/images/generations',
    ));

    expect(error).toMatchObject({ provider: 'OpenAI' });
  });

  test('turns an aborted deadline into a normalized timeout', async () => {
    globalThis.fetch = ((_input, init) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      const abort = () => reject(new Error('aborted'));
      if (signal?.aborted) abort();
      else signal?.addEventListener('abort', abort, { once: true });
    })) as typeof fetch;

    const error = await rejected(providerFetch(
      'Runway',
      'https://api.dev.runwayml.com/v1/text_to_video',
      {},
      { timeoutMs: 5 },
    ));

    expect(error).toMatchObject({
      code: 'provider_timeout',
      provider: 'Runway',
      retryable: true,
      status: 504,
    });
  });

  test('normalizes unreadable success responses', async () => {
    globalThis.fetch = (async () => new Response('not-json', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;

    const response = await providerFetch(
      'Replicate',
      'https://api.replicate.com/v1/predictions',
    );
    const error = await rejected(response.json());

    expect(error).toMatchObject({
      code: 'provider_invalid_response',
      provider: 'Replicate',
      retryable: true,
      status: 502,
    });
  });
});
