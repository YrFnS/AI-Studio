import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function replaceRequired(source, oldValue, newValue, label) {
  if (source.includes(newValue)) return source;
  if (!source.includes(oldValue)) {
    throw new Error(`Could not locate ${label}`);
  }
  return source.replace(oldValue, newValue);
}

function spliceRequired(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Could not locate ${label}`);
  }
  return source.slice(0, start) + replacement + source.slice(end);
}

async function patchGenerationRequest() {
  const filePath = path.join(root, 'src/lib/server/generation-request.ts');
  let source = await fs.readFile(filePath, 'utf8');

  source = replaceRequired(
    source,
    'export const MAX_STATUS_REQUEST_BYTES = 128 * 1024;\n',
    'export const MAX_STATUS_REQUEST_BYTES = 128 * 1024;\nexport const MAX_CANCEL_REQUEST_BYTES = 128 * 1024;\n',
    'cancel request size',
  );

  source = replaceRequired(
    source,
    `export const statusGenerationRequestSchema = z.object({
  id: z.string().min(1).max(8_192),
  provider: providerNameSchema.optional(),
  modelId: modelIdSchema.optional(),
  apiKey: apiKeySchema.optional(),
}).strict();
`,
    `export const statusGenerationRequestSchema = z.object({
  id: z.string().min(1).max(8_192),
  provider: providerNameSchema.optional(),
  modelId: modelIdSchema.optional(),
  apiKey: apiKeySchema.optional(),
}).strict();

export const cancelGenerationRequestSchema = z.object({
  id: safeTrimmedString(MAX_PROVIDER_JOB_ID_CHARS)
    .pipe(z.string().min(1, 'Generation job id is required')),
  providerId: providerIdSchema,
  modelId: modelIdSchema.optional(),
  apiKey: apiKeySchema,
}).strict();
`,
    'cancel request schema',
  );

  await fs.writeFile(filePath, source, 'utf8');
}

async function patchLifecycle() {
  const filePath = path.join(root, 'src/lib/generation-lifecycle.ts');
  let source = await fs.readFile(filePath, 'utf8');

  source = replaceRequired(
    source,
    `import { generationFetch } from '@/lib/generation-client';
`,
    `import { generationFetch } from '@/lib/generation-client';
import { cancelGenerationJob } from '@/lib/generation-cancel-client';
import {
  localOnlyCancellationResult,
  supportsRemoteGenerationCancellation,
  type GenerationCancellationResult,
} from '@/lib/generation-cancellation';
`,
    'lifecycle cancellation imports',
  );

  source = replaceRequired(
    source,
    `  error?: string;
  startedAt: number;
`,
    `  error?: string;
  remoteCancellation?: GenerationCancellationResult['outcome'];
  remoteCancellationMessage?: string;
  startedAt: number;
`,
    'lifecycle cancellation snapshot fields',
  );

  source = replaceRequired(
    source,
    `  cancel: (reason?: string) => Promise<void>;
`,
    `  cancel: (reason?: string) => Promise<GenerationCancellationResult>;
`,
    'lifecycle cancellation return type',
  );

  source = replaceRequired(
    source,
    `  createObjectUrl: (blob: Blob) => string;
  now: () => number;
`,
    `  createObjectUrl: (blob: Blob) => string;
  cancelImpl?: typeof cancelGenerationJob;
  now: () => number;
`,
    'lifecycle cancellation dependency',
  );

  source = replaceRequired(
    source,
    `    externalSignal: AbortSignal | undefined,
    initialState: 'submitting' | 'processing',
`,
    `    externalSignal: AbortSignal | undefined,
    cancellationApiKey: string | undefined,
    initialState: 'submitting' | 'processing',
`,
    'lifecycle cancellation key parameter',
  );

  source = replaceRequired(
    source,
    `    let failurePromise: Promise<void> | null = null;
`,
    `    let failurePromise: Promise<void> | null = null;
    let cancellationPromise: Promise<GenerationCancellationResult> | null = null;
`,
    'lifecycle cancellation promise',
  );

  const failTerminal = `    const failTerminal = async (
      error: string,
      state: 'failed' | 'cancelled' = 'failed',
      cancellation?: GenerationCancellationResult,
    ): Promise<void> => {
      if (terminal) return failurePromise ?? Promise.resolve();
      if (failurePromise) return failurePromise;
      finalizing = true;
      failurePromise = (async () => {
        await dependencies.failImpl(descriptor, error, providerJobId);
        terminal = true;
        finalizing = false;
        updateQueue({
          status: 'failed',
          detail: error,
          ...(cancellation
            ? { remoteCancellation: cancellation.outcome }
            : {}),
        });
        emit({
          state,
          error,
          providerJobId,
          ...(cancellation
            ? {
                remoteCancellation: cancellation.outcome,
                remoteCancellationMessage: cancellation.message,
              }
            : {}),
        });
      })();
      return failurePromise;
    };

`;
  source = spliceRequired(
    source,
    '    const failTerminal = async (\n',
    '    const setProcessing = async',
    failTerminal,
    'lifecycle terminal failure handling',
  );

  const cancellationResolver = `    const requestRemoteCancellation = async (
      reason: string,
    ): Promise<GenerationCancellationResult> => {
      if (!providerJobId) {
        return localOnlyCancellationResult(
          descriptor.providerId,
          'Generation submission was stopped locally before a provider job id was available.',
        );
      }

      if (!supportsRemoteGenerationCancellation(descriptor.providerId)) {
        return localOnlyCancellationResult(
          descriptor.providerId,
          \`${'${descriptor.providerName}'} does not expose a verified remote cancellation adapter in AI Studio. Tracking stopped locally, but provider work may continue.\`,
        );
      }

      const apiKey = cancellationApiKey
        || await dependencies.getApiKey(descriptor.providerId);
      if (!apiKey) {
        return localOnlyCancellationResult(
          descriptor.providerId,
          'The provider key is unavailable, so AI Studio stopped tracking locally. Provider work may continue until the key is reconnected.',
        );
      }

      try {
        return await (dependencies.cancelImpl ?? cancelGenerationJob)({
          id: providerJobId,
          providerId: descriptor.providerId,
          modelId: descriptor.modelId,
          apiKey,
        });
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : 'Remote cancellation could not be confirmed.';
        return {
          outcome: 'failed',
          providerId: descriptor.providerId,
          remoteAttempted: true,
          message: \`${'${message}'} AI Studio stopped tracking locally; provider work may continue.\`,
        };
      }
    };

`;
  source = replaceRequired(
    source,
    '    const onExternalAbort = () => controller.abort(externalSignal?.reason);\n',
    cancellationResolver
      + '    const onExternalAbort = () => controller.abort(externalSignal?.reason);\n',
    'lifecycle remote cancellation resolver',
  );

  source = replaceRequired(
    source,
    `        const terminalError = cancelReason
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
`,
    `        if (cancelReason) {
          const cancellation = await (
            cancellationPromise
            ?? Promise.resolve(localOnlyCancellationResult(
              descriptor.providerId,
              cancelReason,
            ))
          );
          const terminalError = new GenerationLifecycleError(
            cancellation.message,
            {
              code: 'cancelled',
              providerJobId,
              cause: error,
            },
          );
          await failTerminal(
            cancellation.message,
            'cancelled',
            cancellation,
          );
          throw terminalError;
        }

        await failTerminal(error.message, 'failed');
        throw error;
`,
    'lifecycle cancellation race handling',
  );

  source = replaceRequired(
    source,
    `      cancel: async (reason = 'Generation cancelled by user') => {
        if (terminal || finalizing) return;
        cancelReason = reason;
        controller.abort(reason);
        await failTerminal(reason, 'cancelled');
      },
`,
    `      cancel: async (reason = 'Generation cancelled by user') => {
        if (cancellationPromise) return cancellationPromise;
        if (terminal || finalizing) {
          return {
            outcome: 'already-terminal',
            providerId: descriptor.providerId,
            remoteAttempted: false,
            message: 'Generation already reached a terminal state.',
          };
        }

        cancelReason = reason;
        cancellationPromise = requestRemoteCancellation(reason);
        controller.abort(reason);
        const cancellation = await cancellationPromise;
        await failTerminal(
          cancellation.message,
          'cancelled',
          cancellation,
        );
        return cancellation;
      },
`,
    'lifecycle cancel implementation',
  );

  source = replaceRequired(
    source,
    `      options.queue,
      options.signal,
      'submitting',
`,
    `      options.queue,
      options.signal,
      asString(options.body.apiKey),
      'submitting',
`,
    'start cancellation key',
  );

  source = replaceRequired(
    source,
    `      options.queue,
      options.signal,
      'processing',
`,
    `      options.queue,
      options.signal,
      options.apiKey,
      'processing',
`,
    'resume cancellation key',
  );

  await fs.writeFile(filePath, source, 'utf8');
}

async function patchStore() {
  const filePath = path.join(root, 'src/lib/store.ts');
  let source = await fs.readFile(filePath, 'utf8');

  source = replaceRequired(
    source,
    `import type { AppTab, SavedPrompt, GenerationStatus, GalleryFilterType, GalleryViewMode, TimelineDateFilter } from '@/lib/types';
`,
    `import type { AppTab, SavedPrompt, GenerationStatus, GalleryFilterType, GalleryViewMode, TimelineDateFilter } from '@/lib/types';
import type { GenerationCancellationOutcome } from '@/lib/generation-cancellation';
`,
    'queue cancellation outcome import',
  );

  source = replaceRequired(
    source,
    `  resultUrl?: string;
  createdAt: number;
`,
    `  resultUrl?: string;
  detail?: string;
  remoteCancellation?: GenerationCancellationOutcome;
  createdAt: number;
`,
    'queue cancellation fields',
  );

  await fs.writeFile(filePath, source, 'utf8');
}

async function patchQueue() {
  const filePath = path.join(root, 'src/components/studio/generation-queue.tsx');
  let source = await fs.readFile(filePath, 'utf8');

  source = replaceRequired(
    source,
    `        {/* Progress bar for processing items */}
`,
    `        {item.detail && (
          <p className={\`mt-1.5 text-[10px] leading-relaxed ${'${'}
            item.remoteCancellation === 'requested'
            || item.remoteCancellation === 'already-terminal'
              ? 'text-emerald-300/80'
              : item.status === 'failed'
                ? 'text-red-300/75'
                : 'text-muted-foreground/70'
          }\`}>
            {item.detail}
          </p>
        )}
        {/* Progress bar for processing items */}
`,
    'queue cancellation detail',
  );

  await fs.writeFile(filePath, source, 'utf8');
}

await patchGenerationRequest();
await patchLifecycle();
await patchStore();
await patchQueue();
