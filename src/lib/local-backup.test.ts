/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';

import {
  AI_STUDIO_BACKUP_FORMAT,
  AI_STUDIO_BACKUP_VERSION,
  deserializeBackupMediaAsset,
  formatByteSize,
  parseAIStudioBackupText,
  serializeBackupMediaAsset,
  validateAIStudioBackupDocument,
  type AIStudioLocalBackup,
} from './local-backup';

function emptyBackup(): AIStudioLocalBackup {
  return {
    format: AI_STUDIO_BACKUP_FORMAT,
    version: AI_STUDIO_BACKUP_VERSION,
    app: 'ai-studio',
    exportedAt: '2026-08-11T00:00:00.000Z',
    databaseVersion: 6,
    includesApiKeys: false,
    stores: {
      referenceImages: [],
      generations: [],
      prompts: [],
      collections: [],
      collectionItems: [],
      customModels: [],
      discoveredModels: [],
      mediaAssets: [],
    },
    localStorage: {},
    summary: { totalRecords: 0, mediaAssets: 0, mediaBytes: 0 },
  };
}

describe('AI Studio local backups', () => {
  test('accepts a versioned backup and recomputes its summary', () => {
    const backup = emptyBackup();
    backup.stores.generations.push({
      id: 'img-1',
      prompt: 'A test image',
    });

    const parsed = validateAIStudioBackupDocument(backup);

    expect(parsed.includesApiKeys).toBe(false);
    expect(parsed.summary).toEqual({
      totalRecords: 1,
      mediaAssets: 0,
      mediaBytes: 0,
    });
  });

  test('rejects backups that contain API keys', () => {
    const backup = emptyBackup() as AIStudioLocalBackup & {
      stores: AIStudioLocalBackup['stores'] & {
        'api-keys'?: unknown[];
      };
    };
    backup.stores['api-keys'] = [{ providerId: 'openai', key: 'secret' }];

    expect(() => validateAIStudioBackupDocument(backup)).toThrow(
      'unexpectedly contains API keys',
    );
  });

  test('round-trips a generated media Blob', async () => {
    const serialized = await serializeBackupMediaAsset({
      id: 'media:vid-1',
      generationId: 'vid-1',
      blob: new Blob(['video-bytes'], { type: 'video/mp4' }),
      mimeType: 'video/mp4',
      size: 11,
      createdAt: 100,
    });
    const restored = deserializeBackupMediaAsset(serialized);

    expect(serialized.base64).not.toContain('video-bytes');
    expect(restored.id).toBe('media:vid-1');
    expect(restored.generationId).toBe('vid-1');
    expect(restored.mimeType).toBe('video/mp4');
    expect(await restored.blob.text()).toBe('video-bytes');
  });

  test('rejects non-image and non-video backup media', () => {
    expect(() => deserializeBackupMediaAsset({
      id: 'media:html',
      generationId: 'html',
      mimeType: 'text/html',
      size: 4,
      createdAt: 100,
      base64: btoa('test'),
    })).toThrow('image or video MIME type');
  });

  test('rejects media whose declared size does not match its payload', () => {
    expect(() => deserializeBackupMediaAsset({
      id: 'media:bad',
      generationId: 'bad',
      mimeType: 'video/mp4',
      size: 999,
      createdAt: 100,
      base64: btoa('small'),
    })).toThrow('failed its size check');
  });

  test('parses JSON and formats transfer sizes', () => {
    expect(parseAIStudioBackupText(JSON.stringify(emptyBackup())).format)
      .toBe(AI_STUDIO_BACKUP_FORMAT);
    expect(formatByteSize(1_572_864)).toBe('1.5 MB');
  });
});
