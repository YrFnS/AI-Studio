/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';

import {
  isActiveGenerationStatus,
  keepActiveGenerationQueueItems,
} from './generation-queue-state';

describe('generation queue cleanup', () => {
  test('treats pending and processing work as active', () => {
    expect(isActiveGenerationStatus('pending')).toBe(true);
    expect(isActiveGenerationStatus('processing')).toBe(true);
    expect(isActiveGenerationStatus('completed')).toBe(false);
    expect(isActiveGenerationStatus('failed')).toBe(false);
  });

  test('clears only terminal items', () => {
    const items = [
      { id: 'pending', status: 'pending' as const },
      { id: 'processing', status: 'processing' as const },
      { id: 'completed', status: 'completed' as const },
      { id: 'failed', status: 'failed' as const },
    ];

    expect(keepActiveGenerationQueueItems(items).map((item) => item.id))
      .toEqual(['pending', 'processing']);
  });
});
