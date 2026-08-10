/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import { createGenerationClient } from './generation-client';

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('explicit generation client', () => {
  test('passes unrelated requests through unchanged', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const client = createGenerationClient({
      fetchImpl: async (input, init) => {
        calls.push({ input, init });
        return jsonResponse({ ok: true });
      },
      getApiKey: async () => null,
    });

    const response = await client.fetch('/api/providers');

    expect(response.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].input).toBe('/api/providers');
    expect(calls[0].init).toBeUndefined();
  });

  test('injects the provider key into generation submissions', async () => {
    let submittedBody: Record<string, unknown> | null = null;
    const client = createGenerationClient({
      fetchImpl: async (_input, init) => {
        submittedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return jsonResponse({ status: 'completed', urls: ['https://example.com/a.png'] });
      },
      getApiKey: async (providerId) =>
        providerId === 'openai' ? 'stored-openai-key' : null,
    });

    await client.fetch('/api/generate/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId: 'openai',
        modelId: 'gpt-image-1',
        prompt: 'test',
      }),
    });

    expect(submittedBody).toMatchObject({
      providerId: 'openai',
      modelId: 'gpt-image-1',
      prompt: 'test',
      apiKey: 'stored-openai-key',
    });
  });

  test('does not overwrite an explicitly supplied key', async () => {
    let submittedBody: Record<string, unknown> | null = null;
    const client = createGenerationClient({
      fetchImpl: async (_input, init) => {
        submittedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return jsonResponse({ status: 'processing', id: 'aistudio-job.token', localJob: true });
      },
      getApiKey: async () => 'stored-key',
    });

    await client.fetch('/api/generate/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId: 'runway',
        modelId: 'gen4.5',
        prompt: 'test',
        apiKey: 'request-key',
      }),
    });

    expect(submittedBody?.apiKey).toBe('request-key');
  });

  test('converts legacy GET polling into a credential-safe POST', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const client = createGenerationClient({
      fetchImpl: async (input, init) => {
        calls.push({ input, init });
        return jsonResponse({ status: 'completed', resultUrl: 'https://example.com/result.png' });
      },
      getApiKey: async () => null,
    });

    const response = await client.fetch(
      '/api/generate/status?id=job-123&apiKey=secret-key&provider=replicate&modelId=owner%2Fmodel',
    );
    const payload = await response.json();

    expect(payload.status).toBe('completed');
    expect(calls).toHaveLength(1);
    expect(calls[0].input).toBe('/api/generate/status');
    expect(String(calls[0].input)).not.toContain('secret-key');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      id: 'job-123',
      apiKey: 'secret-key',
      provider: 'replicate',
      modelId: 'owner/model',
    });
  });

  test('loads a missing polling key from IndexedDB through the resolver', async () => {
    let statusBody: Record<string, unknown> | null = null;
    const client = createGenerationClient({
      fetchImpl: async (_input, init) => {
        statusBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return jsonResponse({ status: 'processing' });
      },
      getApiKey: async (providerId) =>
        providerId === 'fal' ? 'fal-key-from-storage' : null,
    });

    await client.fetch('/api/generate/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'aistudio-job.token',
        provider: 'fal',
        modelId: 'fal-ai/flux/dev',
      }),
    });

    expect(statusBody).toEqual({
      id: 'aistudio-job.token',
      apiKey: 'fal-key-from-storage',
      provider: 'fal',
      modelId: 'fal-ai/flux/dev',
    });
  });

  test('normalizes missing generation ids into terminal failure responses', async () => {
    const client = createGenerationClient({
      fetchImpl: async () => {
        throw new Error('native fetch should not run');
      },
      getApiKey: async () => null,
    });

    const response = await client.fetch('/api/generate/status');
    const payload = await response.json();

    expect(response.ok).toBe(true);
    expect(payload).toEqual({
      status: 'failed',
      error: 'Generation id is required',
    });
  });
});
