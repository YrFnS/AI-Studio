/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import { isPrivateAddress, resolveImageBlob } from './image-input';

describe('image input validation', () => {
  test('blocks private and reserved addresses', () => {
    expect(isPrivateAddress('127.0.0.1')).toBe(true);
    expect(isPrivateAddress('10.20.30.40')).toBe(true);
    expect(isPrivateAddress('192.168.1.1')).toBe(true);
    expect(isPrivateAddress('169.254.169.254')).toBe(true);
    expect(isPrivateAddress('::1')).toBe(true);
    expect(isPrivateAddress('fd00::1')).toBe(true);
  });

  test('allows public IP address ranges', () => {
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
    expect(isPrivateAddress('1.1.1.1')).toBe(false);
    expect(isPrivateAddress('2001:4860:4860::8888')).toBe(false);
  });

  test('accepts image data URLs and rejects non-images', async () => {
    const blob = await resolveImageBlob('data:image/png;base64,iVBORw0KGgo=');
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);

    await expect(
      resolveImageBlob('data:text/plain;base64,aGVsbG8='),
    ).rejects.toThrow('Data URL must contain an image');
  });
});
