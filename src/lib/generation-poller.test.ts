/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import {
  GenerationPollingError,
  createGenerationStatusCoordinator,
  pollGenerationJob,
  requestGenerationStatus,
} from './generation-poller';

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('requestGenerationStatus', () => {
  test('uses POST and keeps credentials out of the URL', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    const payload = await requestGenerationStatus(
      {
        id: 'aistudio-job.test',
        provider: 'replicate',
        modelId: 'owner/model',
        apiKey: 'secret-key',
      },
      {
        fetchImpl: async (input, init) => {
          capturedUrl = String(input);
          capturedInit = init;
          return jsonResponse({ status: 'processing' });
        },
      },
    );

    expect(payload.status).toBe('processing');
    expect(capturedUrl).toBe('/api/generate/status');
    expect(capturedUrl).not.toContain('secret-key');
    expect(capturedInit?.method).toBe('POST');
    expect(capturedInit?.headers).toMatchObject({
      'x-ai-studio-poll-client': 'resilient',
    });
    expect(JSON.parse(String(capturedInit?.body))).toEqual({
      id: 'aistudio-job.test',
      apiKey: 'secret-key',
      provider: 'replicate',
      modelId: 'owner/model',
    });
  });

  test('accepts a terminal failed payload from a non-2xx response', async () => {
    const payload = await requestGenerationStatus(
      { id: 'expired-job' },
      {
        fetchImpl: async () => jsonResponse(
          { status: 'failed', error: 'Generation job expired' },
          404,
        ),
      },
    );

    expect(payload).toEqual({
      status: 'failed',
      error: 'Generation job expired',
    });
  });
});

describe('pollGenerationJob', () => {
  test('recovers from transient errors and completes', async () => {
    let requestCount = 0;
    let currentTime = 0;
    const delays: number[] = [];

    const result = await pollGenerationJob(
      { id: 'job-1', apiKey: 'key' },
      {
        fetchImpl: async () => {
          requestCount += 1;
          if (requestCount === 1) {
            return jsonResponse({ error: 'temporary outage' }, 502);
          }
          if (requestCount === 2) {
            return jsonResponse({ status: 'processing' });
          }
          return jsonResponse({
            status: 'completed',
            resultUrl: 'https://example.com/result.png',
          });
        },
        now: () => currentTime,
        random: () => 0.5,
        sleep: async (ms) => {
          delays.push(ms);
          currentTime += ms;
        },
        policy: {
          baseDelayMs: 100,
          maxDelayMs: 1_000,
          jitterRatio: 0,
          maxElapsedMs: 10_000,
          maxConsecutiveErrors: 2,
        },
      },
    );

    expect(result.status).toBe('completed');
    expect(result.resultUrl).toBe('https://example.com/result.png');
    expect(requestCount).toBe(3);
    expect(delays).toEqual([100, 150]);
  });

  test('stops after repeated transport errors', async () => {
    let currentTime = 0;

    await expect(
      pollGenerationJob(
        { id: 'job-2' },
        {
          fetchImpl: async () => {
            throw new Error('offline');
          },
          now: () => currentTime,
          random: () => 0.5,
          sleep: async (ms) => {
            currentTime += ms;
          },
          policy: {
            baseDelayMs: 10,
            maxDelayMs: 10,
            jitterRatio: 0,
            maxElapsedMs: 1_000,
            maxConsecutiveErrors: 1,
          },
        },
      ),
    ).rejects.toMatchObject({
      code: 'network',
    });
  });

  test('honors cancellation', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      pollGenerationJob(
        { id: 'job-3' },
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({
      code: 'aborted',
    });
  });

  test('uses the original job start when enforcing timeout', async () => {
    await expect(
      pollGenerationJob(
        { id: 'old-job' },
        {
          startedAtMs: 0,
          now: () => 1_001,
          policy: { maxElapsedMs: 1_000 },
        },
      ),
    ).rejects.toMatchObject({
      code: 'timeout',
    });
  });
});

describe('createGenerationStatusCoordinator', () => {
  test('throttles fixed-interval callers with backoff', async () => {
    let currentTime = 0;
    let requests = 0;
    const coordinator = createGenerationStatusCoordinator({
      now: () => currentTime,
      random: () => 0.5,
      policy: {
        baseDelayMs: 1_000,
        maxDelayMs: 10_000,
        jitterRatio: 0,
      },
    });

    const fetchImpl = async () => {
      requests += 1;
      return requests === 1
        ? jsonResponse({ status: 'processing' })
        : jsonResponse({
            status: 'completed',
            resultUrl: 'https://example.com/video.mp4',
          });
    };

    const first = await coordinator.check({ id: 'job-4' }, fetchImpl);
    expect(await first.json()).toMatchObject({ status: 'processing' });
    expect(requests).toBe(1);

    currentTime = 500;
    const cached = await coordinator.check({ id: 'job-4' }, fetchImpl);
    expect(await cached.json()).toMatchObject({ status: 'processing' });
    expect(requests).toBe(1);

    currentTime = 1_000;
    const completed = await coordinator.check({ id: 'job-4' }, fetchImpl);
    expect(await completed.json()).toMatchObject({ status: 'completed' });
    expect(requests).toBe(2);
  });

  test('normalizes permanent failures so legacy callers terminate', async () => {
    const coordinator = createGenerationStatusCoordinator();
    const response = await coordinator.check(
      { id: 'job-5' },
      async () => jsonResponse(
        { status: 'failed', error: 'Provider rejected the job' },
        404,
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'failed',
      error: 'Provider rejected the job',
    });
  });

  test('turns repeated transient failures into a terminal response', async () => {
    let currentTime = 0;
    const coordinator = createGenerationStatusCoordinator({
      now: () => currentTime,
      random: () => 0.5,
      policy: {
        baseDelayMs: 10,
        maxDelayMs: 10,
        jitterRatio: 0,
        maxConsecutiveErrors: 1,
      },
    });

    const fetchImpl = async () => {
      throw new GenerationPollingError('offline', {
        code: 'network',
        transient: true,
      });
    };

    const retrying = await coordinator.check({ id: 'job-6' }, fetchImpl);
    expect(await retrying.json()).toMatchObject({ status: 'processing' });

    currentTime = 10;
    const failed = await coordinator.check({ id: 'job-6' }, fetchImpl);
    expect(await failed.json()).toMatchObject({
      status: 'failed',
      error: 'Generation status could not be reached after repeated retries',
    });
  });
});
