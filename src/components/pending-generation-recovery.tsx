'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

import {
  getApiKeyForProvider,
  getGenerations,
  updateGeneration,
  type GenerationRecord,
} from '@/lib/idb';
import {
  completeGeneration,
  failGeneration,
  type GenerationDescriptor,
} from '@/lib/generation-persistence';
import {
  GenerationPollingError,
  pollGenerationJob,
} from '@/lib/generation-poller';

const MAX_RECOVERY_JOBS = 20;
const RECOVERY_CONCURRENCY = 3;

function toDescriptor(record: GenerationRecord): GenerationDescriptor {
  let params: Record<string, unknown> | undefined;
  if (record.params) {
    try {
      params = JSON.parse(record.params) as Record<string, unknown>;
    } catch {
      params = undefined;
    }
  }

  return {
    id: record.id,
    providerId: record.providerId,
    providerName: record.providerName,
    modelId: record.modelId,
    type: record.type,
    prompt: record.prompt,
    negativePrompt: record.negativePrompt,
    params,
    inputImageUrl: record.inputImageUrl,
    width: record.width,
    height: record.height,
    duration: record.duration,
    parentGenerationId: record.parentGenerationId,
    createdAt: record.createdAt,
  };
}

async function runWithConcurrency<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency: number,
): Promise<void> {
  let nextIndex = 0;

  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        await worker(items[index]);
      }
    },
  );

  await Promise.allSettled(runners);
}

function recoveryTimeout(record: GenerationRecord): number {
  return record.type === 'video'
    ? 45 * 60 * 1000
    : 25 * 60 * 1000;
}

export function PendingGenerationRecovery() {
  useEffect(() => {
    const controller = new AbortController();
    const mountedAt = Date.now();
    let recoveredCount = 0;
    let failedCount = 0;

    const recover = async (record: GenerationRecord) => {
      if (!record.providerJobId || controller.signal.aborted) return;

      const apiKey = await getApiKeyForProvider(record.providerId);
      if (!apiKey) {
        await updateGeneration(record.id, {
          error: 'Reconnect this provider to resume the interrupted generation.',
        });
        return;
      }

      const descriptor = toDescriptor(record);

      try {
        const payload = await pollGenerationJob(
          {
            id: record.providerJobId,
            apiKey,
            provider: record.providerId,
            modelId: record.modelId,
          },
          {
            signal: controller.signal,
            startedAtMs: record.createdAt,
            policy: {
              maxElapsedMs: recoveryTimeout(record),
              maxConsecutiveErrors: 6,
            },
          },
        );

        const urls = payload.urls?.length
          ? payload.urls
          : payload.resultUrl
            ? [payload.resultUrl]
            : [];
        const ids = await completeGeneration(
          descriptor,
          urls,
          record.providerJobId,
        );
        if (ids.length > 0) recoveredCount += 1;
      } catch (error) {
        if (
          error instanceof GenerationPollingError
          && error.code === 'aborted'
        ) {
          return;
        }

        const message = error instanceof Error
          ? error.message
          : 'Interrupted generation could not be recovered';
        await failGeneration(descriptor, message, record.providerJobId);
        failedCount += 1;
      }
    };

    const startRecovery = async () => {
      // Let the current page initialize before looking for work left by a
      // previous page session. Jobs created after this mount are owned by their
      // active studio and are intentionally excluded from this one-time scan.
      await new Promise<void>((resolve) => {
        const idleWindow = window as typeof window & {
          requestIdleCallback?: (callback: () => void) => number;
        };
        if (typeof idleWindow.requestIdleCallback === 'function') {
          idleWindow.requestIdleCallback(() => resolve());
        } else {
          setTimeout(resolve, 1_000);
        }
      });

      if (controller.signal.aborted) return;

      try {
        const { generations } = await getGenerations({
          limit: Number.MAX_SAFE_INTEGER,
          orderBy: 'asc',
        });
        const interrupted = generations
          .filter(
            (record) =>
              record.status === 'processing'
              && Boolean(record.providerJobId)
              && record.createdAt < mountedAt,
          )
          .slice(0, MAX_RECOVERY_JOBS);

        if (interrupted.length === 0) return;

        await runWithConcurrency(
          interrupted,
          recover,
          RECOVERY_CONCURRENCY,
        );

        if (controller.signal.aborted) return;
        if (recoveredCount > 0) {
          toast.success(
            `${recoveredCount} interrupted generation${recoveredCount === 1 ? '' : 's'} recovered`,
          );
        }
        if (failedCount > 0) {
          toast.error(
            `${failedCount} interrupted generation${failedCount === 1 ? '' : 's'} could not be recovered`,
          );
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Failed to recover pending generations', error);
        }
      }
    };

    void startRecovery();

    return () => controller.abort();
  }, []);

  return null;
}
