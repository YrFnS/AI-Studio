/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';

import {
  P0_EVIDENCE_VERSION,
  createP0EvidencePacket,
  evaluateP0EvidenceRecord,
  summarizeP0Evidence,
  type P0EvidenceEvaluationContext,
  type P0EvidenceRecord,
} from './p0-evidence';
import type { GenerationRecord } from './idb';

function generation(
  overrides: Partial<GenerationRecord> = {},
): GenerationRecord {
  return {
    id: 'img-live-1',
    providerId: 'replicate',
    providerName: 'Replicate',
    modelId: 'owner/model',
    type: 'image',
    prompt: 'Evidence prompt',
    status: 'completed',
    resultUrl: 'https://example.com/result.png',
    providerJobId: 'provider-job-1',
    isFavorite: false,
    createdAt: 100,
    ...overrides,
  };
}

function record(
  overrides: Partial<P0EvidenceRecord> = {},
): P0EvidenceRecord {
  return {
    version: P0_EVIDENCE_VERSION,
    id: 'evidence-1',
    gate: 'immediate-image-single-record',
    status: 'draft',
    providerId: 'replicate',
    providerName: 'Replicate',
    modelId: 'owner/model',
    operation: 'text-to-image',
    generationId: 'img-live-1',
    startedRuntimeId: 'runtime-before',
    startSnapshot: {
      generationStatus: 'processing',
      providerJobId: 'provider-job-1',
      generationCreatedAt: 100,
    },
    manual: {},
    checks: [],
    startedAt: 100,
    updatedAt: 100,
    ...overrides,
  };
}

function context(
  target: GenerationRecord | undefined,
  overrides: Partial<P0EvidenceEvaluationContext> = {},
): P0EvidenceEvaluationContext {
  return {
    currentRuntimeId: 'runtime-after',
    target,
    allGenerations: target ? [target] : [],
    ...overrides,
  };
}

function allPassed(checks: ReturnType<typeof evaluateP0EvidenceRecord>) {
  return checks.length > 0 && checks.every((item) => item.passed);
}

describe('P0 evidence verification', () => {
  test('passes an immediate image only when one durable completed result exists', () => {
    const target = generation();
    expect(allPassed(evaluateP0EvidenceRecord(record(), context(target)))).toBe(true);

    const duplicate = generation({ id: 'img-live-duplicate' });
    const checks = evaluateP0EvidenceRecord(record(), context(target, {
      allGenerations: [target, duplicate],
    }));
    expect(checks.find((item) => item.id === 'no-duplicate-provider-job')?.passed)
      .toBe(false);

    const immediate = generation({ providerJobId: undefined });
    const correlatedDuplicate = generation({
      id: 'img-live-correlated-duplicate',
      providerJobId: undefined,
      createdAt: immediate.createdAt + 1,
    });
    const immediateChecks = evaluateP0EvidenceRecord(
      record(),
      context(immediate, { allGenerations: [immediate, correlatedDuplicate] }),
    );
    expect(immediateChecks.find((item) => item.id === 'no-duplicate-provider-job')?.passed)
      .toBe(false);
  });

  test('requires a processing checkpoint, new runtime, and manual restart confirmation', () => {
    const target = generation({ type: 'video', id: 'vid-live-1' });
    const restart = record({
      gate: 'async-video-restart',
      generationId: 'vid-live-1',
      manual: { restartConfirmed: true },
    });
    expect(allPassed(evaluateP0EvidenceRecord(restart, context(target)))).toBe(true);

    const sameRuntime = evaluateP0EvidenceRecord(restart, context(target, {
      currentRuntimeId: 'runtime-before',
    }));
    expect(sameRuntime.find((item) => item.id === 'new-runtime-session')?.passed)
      .toBe(false);
  });

  test('requires a persisted protected-media Blob and a materialized local URL', () => {
    const target = generation({
      id: 'vid-protected-1',
      type: 'video',
      resultUrl: 'blob:http://localhost/media-1',
      mediaAssetId: 'media:vid-protected-1',
      resultMimeType: 'video/mp4',
      resultSize: 10,
    });
    const protectedRecord = record({
      gate: 'protected-media-restart',
      generationId: target.id,
      manual: { restartConfirmed: true },
    });
    const checks = evaluateP0EvidenceRecord(protectedRecord, context(target, {
      mediaAsset: {
        id: 'media:vid-protected-1',
        generationId: target.id,
        blob: new Blob(['video-data'], { type: 'video/mp4' }),
        mimeType: 'video/mp4',
        size: 10,
        createdAt: 200,
      },
    }));
    expect(allPassed(checks)).toBe(true);
  });

  test('does not pass cancellation without a confirmed provider terminal state', () => {
    const target = generation({
      status: 'failed',
      error: 'Remote cancellation requested and tracking stopped.',
    });
    const cancellation = record({
      gate: 'provider-cancellation',
      manual: {
        cancellationOutcome: 'requested',
        providerTerminalConfirmed: false,
      },
    });
    const checks = evaluateP0EvidenceRecord(cancellation, context(target));
    expect(checks.find((item) => item.id === 'provider-terminal-confirmed')?.passed)
      .toBe(false);
  });

  test('exports a credential-free packet and summarizes missing gates', () => {
    const passed = record({ status: 'passed' });
    const summary = summarizeP0Evidence([passed]);
    expect(summary.passed).toBe(1);
    expect(summary.pendingGates).toContain('async-image-restart');

    const packet = createP0EvidencePacket([passed]);
    expect(packet.includesApiKeys).toBe(false);
    expect(JSON.stringify(packet)).not.toContain('provider-secret');
  });

  test('rejects credential-like material in evidence notes', () => {
    expect(() => createP0EvidencePacket([
      record({ notes: 'Authorization: Bearer hidden-value' }),
    ])).toThrow('must not contain API keys');
  });
});
