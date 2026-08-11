'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Loader2,
  RefreshCw,
  Settings,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cancelGenerationJob } from '@/lib/generation-cancel-client';
import {
  getApiKeyForProvider,
  getGenerations,
  updateGeneration,
  type GenerationRecord,
} from '@/lib/idb';
import {
  GenerationLifecycleError,
  resumeGenerationJob,
} from '@/lib/generation-lifecycle';
import type { GenerationDescriptor } from '@/lib/generation-persistence';
import { useAppStore } from '@/lib/store';

const MAX_RECOVERY_JOBS = 20;
const RECOVERY_CONCURRENCY = 3;
const MISSING_KEY_MESSAGE =
  'Reconnect this provider to resume or remotely cancel the interrupted generation.';

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

function shortPrompt(prompt: string): string {
  return prompt.length > 72 ? `${prompt.slice(0, 72)}…` : prompt;
}

export function PendingGenerationRecovery() {
  const providerVersion = useAppStore((state) => state.providerVersion);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const setSettingsTab = useAppStore((state) => state.setSettingsTab);

  const mountedAtRef = useRef(Date.now());
  const [blocked, setBlocked] = useState<GenerationRecord[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [stoppingIds, setStoppingIds] = useState<Set<string>>(new Set());

  const openProviderSettings = useCallback(() => {
    setSettingsTab('providers');
    setActiveTab('settings');
  }, [setActiveTab, setSettingsTab]);

  const retryRecovery = useCallback(() => {
    setRetryNonce((value) => value + 1);
  }, []);

  const stopTracking = useCallback(async (record: GenerationRecord) => {
    if (!record.providerJobId || stoppingIds.has(record.id)) return;

    setStoppingIds((current) => new Set(current).add(record.id));
    try {
      const apiKey = await getApiKeyForProvider(record.providerId);
      let message =
        'AI Studio stopped tracking this job locally. The provider job may continue because its API key is unavailable.';
      let remoteStopped = false;

      if (apiKey) {
        try {
          const result = await cancelGenerationJob({
            id: record.providerJobId,
            providerId: record.providerId,
            modelId: record.modelId,
            apiKey,
          });
          message = result.message;
          remoteStopped =
            result.outcome === 'requested'
            || result.outcome === 'already-terminal';
        } catch (error) {
          message = error instanceof Error
            ? `${error.message} AI Studio stopped tracking the job locally; provider work may continue.`
            : 'Remote cancellation failed. AI Studio stopped tracking the job locally; provider work may continue.';
        }
      }

      await updateGeneration(record.id, {
        status: 'failed',
        error: message,
      });
      setBlocked((current) => current.filter((item) => item.id !== record.id));

      if (remoteStopped) toast.success(message);
      else toast.warning(message);
    } finally {
      setStoppingIds((current) => {
        const next = new Set(current);
        next.delete(record.id);
        return next;
      });
    }
  }, [stoppingIds]);

  useEffect(() => {
    const controller = new AbortController();
    let recoveredCount = 0;
    let failedCount = 0;

    const recover = async (
      record: GenerationRecord,
      apiKey: string,
    ) => {
      if (!record.providerJobId || controller.signal.aborted) return;

      const handle = resumeGenerationJob({
        descriptor: toDescriptor(record),
        providerJobId: record.providerJobId,
        apiKey,
        signal: controller.signal,
        preserveOnMissingApiKey: true,
        pollPolicy: {
          maxElapsedMs: recoveryTimeout(record),
          maxConsecutiveErrors: 6,
        },
      });

      try {
        const result = await handle.result;
        if (result.generationIds.length > 0) recoveredCount += 1;
      } catch (error) {
        if (error instanceof GenerationLifecycleError) {
          if (error.code === 'detached') return;
          if (error.code === 'missing-api-key') {
            await updateGeneration(record.id, { error: MISSING_KEY_MESSAGE });
            setBlocked((current) => {
              if (current.some((item) => item.id === record.id)) return current;
              return [...current, record];
            });
            return;
          }
        }
        failedCount += 1;
      }
    };

    const startRecovery = async () => {
      await new Promise<void>((resolve) => {
        const idleWindow = window as typeof window & {
          requestIdleCallback?: (callback: () => void) => number;
        };
        if (typeof idleWindow.requestIdleCallback === 'function') {
          idleWindow.requestIdleCallback(() => resolve());
        } else {
          setTimeout(resolve, 500);
        }
      });

      if (controller.signal.aborted) return;
      setScanning(true);

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
              && record.createdAt < mountedAtRef.current,
          )
          .slice(0, MAX_RECOVERY_JOBS);

        const blockedRecords: GenerationRecord[] = [];
        const recoverable: Array<{ record: GenerationRecord; apiKey: string }> = [];

        for (const record of interrupted) {
          const apiKey = await getApiKeyForProvider(record.providerId);
          if (apiKey) {
            await updateGeneration(record.id, { error: undefined });
            recoverable.push({ record, apiKey });
          } else {
            await updateGeneration(record.id, { error: MISSING_KEY_MESSAGE });
            blockedRecords.push(record);
          }
        }

        if (!controller.signal.aborted) setBlocked(blockedRecords);

        await runWithConcurrency(
          recoverable,
          ({ record, apiKey }) => recover(record, apiKey),
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
      } finally {
        if (!controller.signal.aborted) setScanning(false);
      }
    };

    void startRecovery();
    return () => controller.abort();
  }, [providerVersion, retryNonce]);

  if (blocked.length === 0) return null;

  return (
    <div className="fixed bottom-20 left-4 z-[70] w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-amber-400/25 bg-[#11100c]/95 shadow-2xl shadow-black/40 backdrop-blur-xl">
      <div className="flex items-start gap-3 p-3.5">
        <div className="mt-0.5 rounded-lg bg-amber-400/10 p-2 text-amber-300">
          <KeyRound className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              {blocked.length} interrupted generation{blocked.length === 1 ? '' : 's'} need a key
            </p>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Reconnect the provider to resume polling or remotely cancel supported jobs. Without the key, AI Studio can only stop tracking locally.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={openProviderSettings} className="h-8">
              <Settings className="mr-1.5 h-3.5 w-3.5" />
              Open provider settings
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={retryRecovery}
              disabled={scanning}
              className="h-8"
            >
              {scanning
                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              Retry now
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpanded((value) => !value)}
              className="h-8 text-muted-foreground"
            >
              {expanded
                ? <ChevronUp className="mr-1 h-3.5 w-3.5" />
                : <ChevronDown className="mr-1 h-3.5 w-3.5" />}
              {expanded ? 'Hide jobs' : 'Show jobs'}
            </Button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="max-h-64 space-y-2 overflow-y-auto border-t border-white/[0.07] p-3 custom-scrollbar">
          {blocked.map((record) => {
            const stopping = stoppingIds.has(record.id);
            return (
              <div
                key={record.id}
                className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">
                      {record.providerName || record.providerId}
                      <span className="mx-1.5 text-muted-foreground/40">•</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {record.modelId}
                      </span>
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      {shortPrompt(record.prompt)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={stopping}
                    onClick={() => void stopTracking(record)}
                    className="h-7 shrink-0 px-2 text-[10px] text-red-300 hover:bg-red-500/10 hover:text-red-200"
                  >
                    {stopping
                      ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      : <XCircle className="mr-1 h-3 w-3" />}
                    Stop tracking
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
