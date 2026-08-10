'use client';

import { generationFetch } from '@/lib/generation-client';
import { getApiKeyForProvider } from '@/lib/idb';
import {
  beginGeneration,
  completeGeneration,
  failGeneration,
  markGenerationProcessing,
  type GenerationDescriptor,
} from '@/lib/generation-persistence';
import {
  GenerationPollingError,
  pollGenerationJob,
  type GenerationPollingPolicy,
  type GenerationStatusPayload,
} from '@/lib/generation-poller';
import type { GenerationQueueItem } from '@/lib/store';

export type GenerationLifecycleState =
  | 'created'
  | 'submitting'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type GenerationLifecycleErrorCode =
  | 'cancelled'
  | 'detached'
  | 'failed'
  | 'invalid-response'
  | 'missing-api-key'
  | 'polling'
  | 'submission';

export class GenerationLifecycleError extends Error {
  readonly code: GenerationLifecycleErrorCode;
  readonly providerJobId?: string;

  constructor(
    message: string,
    options: {
      code: GenerationLifecycleErrorCode;
      providerJobId?: string;
      cause?: unknown;
    },
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'GenerationLifecycleError';
    this.code = options.code;
    this.providerJobId = options.providerJobId;
  }
}

export interface GenerationLifecycleSnapshot {
  generationId: string;
  state: GenerationLifecycleState;
  providerJobId?: string;
  urls?: string[];
  generationIds?: string[];
  error?: string;
  startedAt: number;
  updatedAt: number;
}

export interface GenerationLifecycleResult {
  status: 'completed';
  urls: string[];
  generationIds: string[];
  providerJobId?: string;
  durationMs: number;
  payload: Record<string, unknown>;
}

export type GenerationLifecycleListener = (
  snapshot: GenerationLifecycleSnapshot,
) => void;

export interface GenerationQueuePort {
  add: (item: GenerationQueueItem) => void;
  update: (id: string, updates: Partial<GenerationQueueItem>) => void;
}

export interface GenerationLifecycleQueueConfig {
  port: GenerationQueuePort;
  metadata: Pick<
    GenerationQueueItem,
    'prompt' | 'providerName' | 'providerColor' | 'modelName'
  >;
  /** Existing recovery jobs should normally update instead of enqueueing again. */
  enqueue?: boolean;
}

export interface StartGenerationJobOptions {
  descriptor: GenerationDescriptor;
  endpoint: string;
  body: Record<string, unknown>;
  queue?: GenerationLifecycleQueueConfig;
  pollPolicy?: Partial<GenerationPollingPolicy>;
  signal?: AbortSignal;
}

export interface ResumeGenerationJobOptions {
  descriptor: GenerationDescriptor;
  providerJobId: string;
  apiKey?: string;
  queue?: GenerationLifecycleQueueConfig;
  pollPolicy?: Partial<GenerationPollingPolicy>;
  signal?: AbortSignal;
  /** Keep a job processing when its key is temporarily unavailable. */
  preserveOnMissingApiKey?: boolean;
}

export interface GenerationJobHandle {
  readonly id: string;
  readonly descriptor: GenerationDescriptor;
  readonly result: Promise<GenerationLifecycleResult>;
  cancel: (reason?: string) => Promise<void>;
  subscribe: (listener: GenerationLifecycleListener) => () => void;
  getSnapshot: () => GenerationLifecycleSnapshot;
}

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type PollLike = typeof pollGenerationJob;
type BeginLike = typeof beginGeneration;
type MarkProcessingLike = typeof markGenerationProcessing;
type CompleteLike = typeof completeGeneration;
type FailLike = typeof failGeneration;
type ApiKeyResolver = (providerId: string) => Promise<string | null>;

export interface GenerationLifecycleDependencies {
  fetchImpl: FetchLike;
  pollImpl: PollLike;
  beginImpl: BeginLike;
  markProcessingImpl: MarkProcessingLike;
  completeImpl: CompleteLike;
  failImpl: FailLike;
  getApiKey: ApiKeyResolver;
  now: () => number;
}

export interface GenerationLifecycleClient {
  start: (options: StartGenerationJobOptions) => GenerationJobHandle;
  resume: (options: ResumeGenerationJobOptions) => GenerationJobHandle;
}

interface SubmissionCompleted {
  kind: 'completed';
  urls: string[];
  payload: Record<string, unknown>;
}

interface SubmissionProcessing {
  kind: 'processing';
  providerJobId: string;
  payload: Record<string, unknown>;
}

type SubmissionResult = SubmissionCompleted | SubmissionProcessing;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0
    ? value
    : undefined;
}

function normalizeUrls(payload: Record<string, unknown>): string[] {
  const urls = Array.isArray(payload.urls)
    ? payload.urls.filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      )
    : [];

  const resultUrl = asString(payload.resultUrl);
  if (urls.length === 0 && resultUrl) urls.push(resultUrl);
  return urls;
}

async function readResponsePayload(response: Response): Promise<Record<string, unknown>> {
  try {
    const payload = await response.json() as unknown;
    return isRecord(payload) ? payload : {};
  } catch {
    return {};
  }
}

async function parseSubmissionResponse(response: Response): Promise<SubmissionResult> {
  const payload = await readResponsePayload(response);
  const error = asString(payload.error);

  if (!response.ok) {
    throw new GenerationLifecycleError(
      error || `Generation submission failed (${response.status})`,
      { code: 'submission' },
    );
  }

  if (payload.status === 'failed') {
    throw new GenerationLifecycleError(error || 'Generation failed', {
      code: 'failed',
    });
  }

  const urls = normalizeUrls(payload);
  if (payload.status === 'completed' && urls.length > 0) {
    return { kind: 'completed', urls, payload };
  }

  const providerJobId = asString(payload.id) || asString(payload.jobId);
  if (payload.status === 'processing' && providerJobId) {
    return { kind: 'processing', providerJobId, payload };
  }

  throw new GenerationLifecycleError(
    'Generation submission response was not recognized',
    { code: 'invalid-response' },
  );
}

function pollingErrorToLifecycle(
  error: unknown,
  providerJobId?: string,
): GenerationLifecycleError {
  if (error instanceof GenerationLifecycleError) return error;
  if (error instanceof GenerationPollingError) {
    const code: GenerationLifecycleErrorCode = error.code === 'aborted'
      ? 'detached'
      : error.code === 'failed'
        ? 'failed'
        : 'polling';
    return new GenerationLifecycleError(error.message, {
      code,
      providerJobId,
      cause: error,
    });
  }
  return new GenerationLifecycleError(
    error instanceof Error ? error.message : 'Generation lifecycle failed',
    { code: 'failed', providerJobId, cause: error },
  );
}

function completedPayload(
  payload: GenerationStatusPayload,
): Record<string, unknown> {
  return { ...payload };
}

export function createGenerationLifecycleClient(
  overrides: Partial<GenerationLifecycleDependencies> = {},
): GenerationLifecycleClient {
  const dependencies: GenerationLifecycleDependencies = {
    fetchImpl: generationFetch,
    pollImpl: pollGenerationJob,
    beginImpl: beginGeneration,
    markProcessingImpl: markGenerationProcessing,
    completeImpl: completeGeneration,
    failImpl: failGeneration,
    getApiKey: getApiKeyForProvider,
    now: Date.now,
    ...overrides,
  };

  const createHandle = (
    descriptor: GenerationDescriptor,
    queue: GenerationLifecycleQueueConfig | undefined,
    externalSignal: AbortSignal | undefined,
    execute: (context: {
      signal: AbortSignal;
      setProcessing: (providerJobId: string) => Promise<void>;
      complete: (
        urls: string[],
        payload: Record<string, unknown>,
        providerJobId?: string,
      ) => Promise<GenerationLifecycleResult>;
      getProviderJobId: () => string | undefined;
    }) => Promise<GenerationLifecycleResult>,
  ): GenerationJobHandle => {
    const controller = new AbortController();
    const listeners = new Set<GenerationLifecycleListener>();
    let providerJobId: string | undefined;
    let cancelReason: string | null = null;
    let terminal = false;
    let finalizing = false;
    let failurePromise: Promise<void> | null = null;
    let snapshot: GenerationLifecycleSnapshot = {
      generationId: descriptor.id,
      state: 'created',
      startedAt: descriptor.createdAt,
      updatedAt: dependencies.now(),
    };

    const emit = (patch: Partial<GenerationLifecycleSnapshot>) => {
      snapshot = {
        ...snapshot,
        ...patch,
        generationId: descriptor.id,
        updatedAt: dependencies.now(),
      };
      for (const listener of listeners) listener({ ...snapshot });
    };

    const updateQueue = (updates: Partial<GenerationQueueItem>) => {
      queue?.port.update(descriptor.id, updates);
    };

    const failTerminal = async (
      error: string,
      state: 'failed' | 'cancelled' = 'failed',
    ): Promise<void> => {
      if (terminal) return failurePromise ?? Promise.resolve();
      if (failurePromise) return failurePromise;
      finalizing = true;
      failurePromise = (async () => {
        await dependencies.failImpl(descriptor, error, providerJobId);
        terminal = true;
        finalizing = false;
        updateQueue({ status: 'failed' });
        emit({ state, error, providerJobId });
      })();
      return failurePromise;
    };

    const setProcessing = async (jobId: string) => {
      providerJobId = jobId;
      await dependencies.markProcessingImpl(descriptor, jobId);
      emit({ state: 'processing', providerJobId: jobId, error: undefined });
    };

    const complete = async (
      urls: string[],
      payload: Record<string, unknown>,
      jobId?: string,
    ): Promise<GenerationLifecycleResult> => {
      if (terminal || finalizing) {
        throw new GenerationLifecycleError(
          'Generation already reached a terminal state',
          { code: 'failed', providerJobId },
        );
      }
      finalizing = true;
      if (jobId) providerJobId = jobId;
      const generationIds = await dependencies.completeImpl(
        descriptor,
        urls,
        providerJobId,
      );
      if (generationIds.length === 0) {
        finalizing = false;
        throw new GenerationLifecycleError(
          'Provider completed without returning a result',
          { code: 'invalid-response', providerJobId },
        );
      }
      terminal = true;
      finalizing = false;
      updateQueue({ status: 'completed', resultUrl: urls[0] });
      emit({
        state: 'completed',
        providerJobId,
        urls,
        generationIds,
        error: undefined,
      });
      return {
        status: 'completed',
        urls,
        generationIds,
        providerJobId,
        durationMs: Math.max(0, dependencies.now() - descriptor.createdAt),
        payload,
      };
    };

    const onExternalAbort = () => controller.abort(externalSignal?.reason);
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort(externalSignal.reason);
      else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    if (queue?.enqueue !== false) {
      queue?.port.add({
        id: descriptor.id,
        ...queue.metadata,
        status: 'processing',
        createdAt: descriptor.createdAt,
      });
    } else {
      updateQueue({ status: 'processing' });
    }

    const result = (async () => {
      try {
        return await execute({
          signal: controller.signal,
          setProcessing,
          complete,
          getProviderJobId: () => providerJobId,
        });
      } catch (rawError) {
        const error = pollingErrorToLifecycle(rawError, providerJobId);
        if (controller.signal.aborted && cancelReason === null) {
          throw new GenerationLifecycleError(
            'Generation lifecycle detached from this page',
            { code: 'detached', providerJobId, cause: error },
          );
        }

        const terminalError = cancelReason
          ? new GenerationLifecycleError(cancelReason, {
              code: 'cancelled',
              providerJobId,
              cause: error,
            })
          : error;
        await failTerminal(
          terminalError.message,
          terminalError.code === 'cancelled' ? 'cancelled' : 'failed',
        );
        throw terminalError;
      } finally {
        externalSignal?.removeEventListener('abort', onExternalAbort);
      }
    })();

    return {
      id: descriptor.id,
      descriptor,
      result,
      cancel: async (reason = 'Generation cancelled by user') => {
        if (terminal || finalizing) return;
        cancelReason = reason;
        controller.abort(reason);
        await failTerminal(reason, 'cancelled');
      },
      subscribe: (listener) => {
        listeners.add(listener);
        listener({ ...snapshot });
        return () => listeners.delete(listener);
      },
      getSnapshot: () => ({ ...snapshot }),
    };
  };

  const start = (options: StartGenerationJobOptions): GenerationJobHandle => {
    const { descriptor } = options;
    return createHandle(
      descriptor,
      options.queue,
      options.signal,
      async ({ signal, setProcessing, complete }) => {
        emitStartStatePlaceholder();
        await dependencies.beginImpl(descriptor);

        const response = await dependencies.fetchImpl(options.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(options.body),
          signal,
        });
        const submission = await parseSubmissionResponse(response);

        if (submission.kind === 'completed') {
          return complete(submission.urls, submission.payload);
        }

        await setProcessing(submission.providerJobId);
        const explicitKey = asString(options.body.apiKey);
        const apiKey = explicitKey
          || await dependencies.getApiKey(descriptor.providerId);
        if (!apiKey) {
          throw new GenerationLifecycleError(
            'No API key is available to poll this generation',
            {
              code: 'missing-api-key',
              providerJobId: submission.providerJobId,
            },
          );
        }

        const payload = await dependencies.pollImpl(
          {
            id: submission.providerJobId,
            apiKey,
            provider: descriptor.providerId,
            modelId: descriptor.modelId,
          },
          {
            fetchImpl: dependencies.fetchImpl,
            signal,
            startedAtMs: descriptor.createdAt,
            policy: options.pollPolicy,
          },
        );
        const urls = normalizeUrls(completedPayload(payload));
        return complete(
          urls,
          completedPayload(payload),
          submission.providerJobId,
        );
      },
    );
  };

  const resume = (options: ResumeGenerationJobOptions): GenerationJobHandle => {
    const { descriptor, providerJobId } = options;
    return createHandle(
      descriptor,
      options.queue,
      options.signal,
      async ({ signal, setProcessing, complete }) => {
        await setProcessing(providerJobId);
        const apiKey = options.apiKey
          || await dependencies.getApiKey(descriptor.providerId);
        if (!apiKey) {
          const error = new GenerationLifecycleError(
            'Reconnect this provider to resume the interrupted generation.',
            { code: 'missing-api-key', providerJobId },
          );
          if (options.preserveOnMissingApiKey !== false) throw error;
          throw error;
        }

        const payload = await dependencies.pollImpl(
          {
            id: providerJobId,
            apiKey,
            provider: descriptor.providerId,
            modelId: descriptor.modelId,
          },
          {
            fetchImpl: dependencies.fetchImpl,
            signal,
            startedAtMs: descriptor.createdAt,
            policy: options.pollPolicy,
          },
        );
        const normalizedPayload = completedPayload(payload);
        return complete(
          normalizeUrls(normalizedPayload),
          normalizedPayload,
          providerJobId,
        );
      },
    );
  };

  // The closure is replaced per-handle before submission through subscribe.
  // This no-op keeps the start executor free from lifecycle implementation details.
  function emitStartStatePlaceholder(): void {}

  return { start, resume };
}

const defaultLifecycleClient = createGenerationLifecycleClient();

export const startGenerationJob = defaultLifecycleClient.start;
export const resumeGenerationJob = defaultLifecycleClient.resume;
