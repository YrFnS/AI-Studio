import {
  getGeneration,
  getGenerationMediaAsset,
  getGenerations,
  type GenerationMediaAsset,
  type GenerationRecord,
} from '@/lib/idb';
import type { GenerationCancellationOutcome } from '@/lib/generation-cancellation';
import type { GenerationOperationId } from '@/lib/generation-registry';

export const P0_EVIDENCE_FORMAT = 'ai-studio-p0-evidence' as const;
export const P0_EVIDENCE_VERSION = 1 as const;
export const P0_EVIDENCE_STORAGE_KEY = 'ai-studio-p0-evidence-v1' as const;

export const P0_EVIDENCE_GATES = [
  'immediate-image-single-record',
  'async-image-restart',
  'async-video-restart',
  'protected-media-restart',
  'provider-cancellation',
  'contract-smoke',
] as const;

export type P0EvidenceGate = (typeof P0_EVIDENCE_GATES)[number];
export type P0EvidenceStatus = 'draft' | 'passed' | 'failed';

export interface P0EvidenceCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface P0EvidenceStartSnapshot {
  generationStatus?: GenerationRecord['status'];
  providerJobId?: string;
  generationCreatedAt?: number;
}

export interface P0EvidenceManualAssertions {
  restartConfirmed?: boolean;
  providerAcceptedResult?: boolean;
  providerTerminalConfirmed?: boolean;
  cancellationOutcome?: GenerationCancellationOutcome;
}

export interface P0EvidenceRecord {
  version: typeof P0_EVIDENCE_VERSION;
  id: string;
  gate: P0EvidenceGate;
  status: P0EvidenceStatus;
  providerId?: string;
  providerName?: string;
  modelId?: string;
  operation?: GenerationOperationId;
  generationId?: string;
  startedRuntimeId: string;
  verifiedRuntimeId?: string;
  startSnapshot?: P0EvidenceStartSnapshot;
  manual: P0EvidenceManualAssertions;
  notes?: string;
  checks: P0EvidenceCheck[];
  startedAt: number;
  updatedAt: number;
  verifiedAt?: number;
}

export interface P0EvidencePacket {
  format: typeof P0_EVIDENCE_FORMAT;
  version: typeof P0_EVIDENCE_VERSION;
  app: 'ai-studio';
  exportedAt: string;
  includesApiKeys: false;
  records: P0EvidenceRecord[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    draft: number;
    passedGates: P0EvidenceGate[];
    pendingGates: P0EvidenceGate[];
  };
}

export interface P0EvidenceEvaluationContext {
  currentRuntimeId: string;
  target?: GenerationRecord;
  allGenerations: GenerationRecord[];
  mediaAsset?: GenerationMediaAsset;
}

export interface CreateP0EvidenceCheckpointInput {
  gate: P0EvidenceGate;
  generationId?: string;
  providerId?: string;
  providerName?: string;
  modelId?: string;
  operation?: GenerationOperationId;
  notes?: string;
}

const runtimeId = createOpaqueId('runtime');

function createOpaqueId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `${prefix}-${Date.now()}-${random}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function containsCredentialLikeText(value: string): boolean {
  const patterns = [
    /\bsk-[A-Za-z0-9_-]{16,}\b/,
    /\br8_[A-Za-z0-9_-]{10,}\b/,
    /\bhf_[A-Za-z0-9_-]{10,}\b/,
    /\bAIza[A-Za-z0-9_-]{20,}\b/,
    /\bAuthorization\s*:/i,
    /["']?apiKey["']?\s*[:=]/i,
  ];
  return patterns.some((pattern) => pattern.test(value));
}

function assertSafeNotes(notes?: string): void {
  if (notes && containsCredentialLikeText(notes)) {
    throw new Error('Evidence notes must not contain API keys or authorization headers.');
  }
}

function resultExists(generation: GenerationRecord | undefined): boolean {
  return Boolean(
    generation?.resultUrl
    || generation?.resultData
    || generation?.mediaAssetId,
  );
}

function duplicateProviderJobCount(
  target: GenerationRecord | undefined,
  allGenerations: readonly GenerationRecord[],
): number {
  if (!target?.providerJobId) return target ? 1 : 0;
  return allGenerations.filter((generation) => (
    generation.providerJobId === target.providerJobId
  )).length;
}

function check(
  id: string,
  label: string,
  passed: boolean,
  detail: string,
): P0EvidenceCheck {
  return { id, label, passed, detail };
}

function baseChecks(
  record: P0EvidenceRecord,
  context: P0EvidenceEvaluationContext,
): P0EvidenceCheck[] {
  const { target, allGenerations } = context;
  const duplicateCount = duplicateProviderJobCount(target, allGenerations);
  return [
    check(
      'generation-exists',
      'Generation record exists',
      Boolean(target),
      target
        ? `Found ${target.id} with status ${target.status}.`
        : `No generation record was found for ${record.generationId || 'the selected id'}.`,
    ),
    check(
      'provider-model-match',
      'Provider and model match the checkpoint',
      Boolean(target)
        && (!record.providerId || target?.providerId === record.providerId)
        && (!record.modelId || target?.modelId === record.modelId),
      target
        ? `${target.providerId} · ${target.modelId}`
        : 'Provider and model could not be inspected.',
    ),
    check(
      'no-duplicate-provider-job',
      'Provider job produced no duplicate durable records',
      duplicateCount <= 1,
      target?.providerJobId
        ? `${duplicateCount} record(s) reference provider job ${target.providerJobId}.`
        : 'The generation completed without a provider job id or has one durable record.',
    ),
  ];
}

function restartChecks(
  record: P0EvidenceRecord,
  context: P0EvidenceEvaluationContext,
  expectedType: 'image' | 'video',
): P0EvidenceCheck[] {
  const { target, currentRuntimeId } = context;
  return [
    check(
      'checkpoint-was-processing',
      'Checkpoint was captured while the job was processing',
      record.startSnapshot?.generationStatus === 'processing',
      record.startSnapshot?.generationStatus
        ? `Checkpoint status: ${record.startSnapshot.generationStatus}.`
        : 'No processing checkpoint was captured.',
    ),
    check(
      'new-runtime-session',
      'Verification happened in a new browser runtime session',
      record.startedRuntimeId !== currentRuntimeId,
      record.startedRuntimeId !== currentRuntimeId
        ? 'The evidence survived a page/runtime reload.'
        : 'Reload the page after restarting the local server before verification.',
    ),
    check(
      'restart-confirmed',
      'Local server restart was manually confirmed',
      record.manual.restartConfirmed === true,
      record.manual.restartConfirmed
        ? 'The operator confirmed the local server was restarted.'
        : 'Confirm the server restart in the evidence record.',
    ),
    check(
      'expected-media-type',
      `Generation remained a ${expectedType} job`,
      target?.type === expectedType,
      target ? `Stored type: ${target.type}.` : 'Generation type is unavailable.',
    ),
    check(
      'completed-after-restart',
      'The same durable generation completed after restart',
      target?.status === 'completed' && resultExists(target),
      target
        ? `Final status: ${target.status}; result present: ${resultExists(target)}.`
        : 'The generation is unavailable.',
    ),
    check(
      'provider-job-stable',
      'Provider job identity stayed stable across recovery',
      Boolean(target)
        && Boolean(record.startSnapshot?.providerJobId)
        && target?.providerJobId === record.startSnapshot?.providerJobId,
      target?.providerJobId
        ? `Provider job: ${target.providerJobId}.`
        : 'No provider job id is available for comparison.',
    ),
  ];
}

export function getP0RuntimeId(): string {
  return runtimeId;
}

export function evaluateP0EvidenceRecord(
  record: P0EvidenceRecord,
  context: P0EvidenceEvaluationContext,
): P0EvidenceCheck[] {
  const { target, mediaAsset } = context;
  const checks = baseChecks(record, context);

  switch (record.gate) {
    case 'immediate-image-single-record':
      checks.push(
        check(
          'image-completed',
          'Immediate image completed with a durable result',
          target?.type === 'image'
            && target.status === 'completed'
            && resultExists(target),
          target
            ? `Type ${target.type}; status ${target.status}; result present ${resultExists(target)}.`
            : 'The image generation is unavailable.',
        ),
      );
      break;

    case 'async-image-restart':
      checks.push(...restartChecks(record, context, 'image'));
      break;

    case 'async-video-restart':
      checks.push(...restartChecks(record, context, 'video'));
      break;

    case 'protected-media-restart':
      checks.push(
        ...restartChecks(record, context, 'video'),
        check(
          'media-asset-linked',
          'Generation references a local protected-media asset',
          Boolean(target?.mediaAssetId),
          target?.mediaAssetId
            ? `Media asset id: ${target.mediaAssetId}.`
            : 'No media asset id is stored on the generation.',
        ),
        check(
          'media-asset-present',
          'Protected media Blob exists in IndexedDB',
          Boolean(mediaAsset?.blob?.size),
          mediaAsset
            ? `${mediaAsset.mimeType}, ${mediaAsset.size} bytes.`
            : 'The protected-media asset could not be loaded.',
        ),
        check(
          'materialized-local-url',
          'Gallery materialized a local Blob URL',
          Boolean(target?.resultUrl?.startsWith('blob:')),
          target?.resultUrl?.startsWith('blob:')
            ? 'A session-scoped Blob URL was recreated from IndexedDB.'
            : 'No local Blob URL was materialized.',
        ),
      );
      break;

    case 'provider-cancellation': {
      const outcome = record.manual.cancellationOutcome;
      checks.push(
        check(
          'cancelled-terminal-record',
          'Cancelled job reached a terminal local record',
          target?.status === 'failed'
            && /cancel|tracking stopped|terminal/i.test(target.error || ''),
          target
            ? `Status ${target.status}; message: ${target.error || 'none'}.`
            : 'The cancelled generation is unavailable.',
        ),
        check(
          'remote-cancel-outcome',
          'Remote cancellation returned a supported terminal outcome',
          outcome === 'requested' || outcome === 'already-terminal',
          outcome
            ? `Recorded cancellation outcome: ${outcome}.`
            : 'No cancellation outcome has been recorded.',
        ),
        check(
          'provider-terminal-confirmed',
          'Provider job termination was manually confirmed',
          record.manual.providerTerminalConfirmed === true,
          record.manual.providerTerminalConfirmed
            ? 'The provider dashboard or status endpoint confirmed the job stopped or was already terminal.'
            : 'Confirm the provider-side terminal state before passing this gate.',
        ),
      );
      break;
    }

    case 'contract-smoke':
      checks.push(
        check(
          'contract-result',
          'Reviewed provider/model contract returned a durable result',
          target?.status === 'completed' && resultExists(target),
          target
            ? `Status ${target.status}; result present ${resultExists(target)}.`
            : 'The generation is unavailable.',
        ),
        check(
          'provider-accepted-contract',
          'Provider accepted the documented request contract',
          record.manual.providerAcceptedResult === true,
          record.manual.providerAcceptedResult
            ? 'The operator confirmed the provider accepted the request and returned the expected media kind.'
            : 'Confirm the live provider response before passing this gate.',
        ),
      );
      break;
  }

  return checks;
}

export async function createP0EvidenceCheckpoint(
  input: CreateP0EvidenceCheckpointInput,
): Promise<P0EvidenceRecord> {
  assertSafeNotes(input.notes);
  const generation = input.generationId
    ? await getGeneration(input.generationId)
    : undefined;
  const now = Date.now();

  return {
    version: P0_EVIDENCE_VERSION,
    id: createOpaqueId('evidence'),
    gate: input.gate,
    status: 'draft',
    providerId: input.providerId || generation?.providerId,
    providerName: input.providerName || generation?.providerName,
    modelId: input.modelId || generation?.modelId,
    operation: input.operation,
    generationId: input.generationId,
    startedRuntimeId: runtimeId,
    startSnapshot: generation
      ? {
          generationStatus: generation.status,
          providerJobId: generation.providerJobId,
          generationCreatedAt: generation.createdAt,
        }
      : undefined,
    manual: {},
    notes: input.notes?.trim() || undefined,
    checks: [],
    startedAt: now,
    updatedAt: now,
  };
}

export async function verifyP0EvidenceRecord(
  record: P0EvidenceRecord,
): Promise<P0EvidenceRecord> {
  assertSafeNotes(record.notes);
  const { generations } = await getGenerations({
    limit: Number.MAX_SAFE_INTEGER,
    offset: 0,
  });
  const target = record.generationId
    ? generations.find((generation) => generation.id === record.generationId)
      || await getGeneration(record.generationId)
    : undefined;
  const mediaAsset = target?.mediaAssetId
    ? await getGenerationMediaAsset(target.mediaAssetId)
    : undefined;
  const checks = evaluateP0EvidenceRecord(record, {
    currentRuntimeId: runtimeId,
    target,
    allGenerations: generations,
    mediaAsset,
  });
  const now = Date.now();
  return {
    ...record,
    status: checks.length > 0 && checks.every((item) => item.passed)
      ? 'passed'
      : 'failed',
    checks,
    verifiedRuntimeId: runtimeId,
    verifiedAt: now,
    updatedAt: now,
  };
}

export function loadP0EvidenceRecords(): P0EvidenceRecord[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(P0_EVIDENCE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is P0EvidenceRecord => (
      isRecord(value)
      && value.version === P0_EVIDENCE_VERSION
      && P0_EVIDENCE_GATES.includes(value.gate as P0EvidenceGate)
      && typeof value.id === 'string'
      && typeof value.startedAt === 'number'
    ));
  } catch {
    return [];
  }
}

export function saveP0EvidenceRecords(records: readonly P0EvidenceRecord[]): void {
  if (typeof localStorage === 'undefined') return;
  for (const record of records) assertSafeNotes(record.notes);
  localStorage.setItem(P0_EVIDENCE_STORAGE_KEY, JSON.stringify(records));
}

export function summarizeP0Evidence(
  records: readonly P0EvidenceRecord[],
): P0EvidencePacket['summary'] {
  const passedGates = [...new Set(
    records
      .filter((record) => record.status === 'passed')
      .map((record) => record.gate),
  )];
  return {
    total: records.length,
    passed: records.filter((record) => record.status === 'passed').length,
    failed: records.filter((record) => record.status === 'failed').length,
    draft: records.filter((record) => record.status === 'draft').length,
    passedGates,
    pendingGates: P0_EVIDENCE_GATES.filter((gate) => !passedGates.includes(gate)),
  };
}

export function createP0EvidencePacket(
  records: readonly P0EvidenceRecord[],
): P0EvidencePacket {
  for (const record of records) assertSafeNotes(record.notes);
  const packet: P0EvidencePacket = {
    format: P0_EVIDENCE_FORMAT,
    version: P0_EVIDENCE_VERSION,
    app: 'ai-studio',
    exportedAt: new Date().toISOString(),
    includesApiKeys: false,
    records: records.map((record) => ({ ...record })),
    summary: summarizeP0Evidence(records),
  };
  const serialized = JSON.stringify(packet);
  if (containsCredentialLikeText(serialized)) {
    throw new Error('The evidence packet appears to contain credential material.');
  }
  return packet;
}

export function downloadP0EvidencePacket(
  records: readonly P0EvidenceRecord[],
): void {
  if (typeof document === 'undefined') return;
  const packet = createP0EvidencePacket(records);
  const blob = new Blob([JSON.stringify(packet, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `ai-studio-p0-evidence-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
