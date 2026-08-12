/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';

import {
  parseProtectedMediaDescriptor,
  PROTECTED_MEDIA_DESCRIPTOR_VERSION,
} from './protected-media';
import { downloadProtectedMedia } from './protected-media-client';

describe('stateless protected media', () => {
  test('parses credential-free descriptors', () => {
    expect(parseProtectedMediaDescriptor({
      version: PROTECTED_MEDIA_DESCRIPTOR_VERSION,
      providerId: 'google-aistudio',
      providerJobId: 'operations/video-123',
      kind: 'video',
    })).toEqual({
      version: 1,
      providerId: 'google-aistudio',
      providerJobId: 'operations/video-123',
      kind: 'video',
    });
    expect(parseProtectedMediaDescriptor({
      version: 1,
      providerId: 'google-aistudio',
      providerJobId: 'operations/video-123',
      kind: 'video',
      apiKey: 'must-not-be-part-of-the-descriptor',
    })).toEqual({
      version: 1,
      providerId: 'google-aistudio',
      providerJobId: 'operations/video-123',
      kind: 'video',
    });
  });

  test('downloads by POST and never places the key in the URL', async () => {
    let requestUrl = '';
    let requestInit: RequestInit | undefined;
    const blob = await downloadProtectedMedia({
      version: 1,
      providerId: 'google-aistudio',
      providerJobId: 'operations/video-123',
      kind: 'video',
    }, 'secret-key', {
      fetchImpl: async (input, init) => {
        requestUrl = String(input);
        requestInit = init;
        return new Response(new Blob(['video'], { type: 'video/mp4' }), {
          headers: { 'Content-Type': 'video/mp4' },
        });
      },
    });

    expect(requestUrl).toBe('/api/generate/media');
    expect(requestUrl).not.toContain('secret-key');
    expect(requestInit?.method).toBe('POST');
    expect(JSON.parse(String(requestInit?.body))).toMatchObject({
      providerId: 'google-aistudio',
      providerJobId: 'operations/video-123',
      apiKey: 'secret-key',
    });
    expect(blob.type).toBe('video/mp4');
  });
});
