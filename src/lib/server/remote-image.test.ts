/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import { isPrivateIpAddress } from './remote-image';

describe('isPrivateIpAddress', () => {
  test.each([
    '127.0.0.1',
    '10.0.0.1',
    '172.16.1.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
  ])('blocks %s', (address) => {
    expect(isPrivateIpAddress(address)).toBe(true);
  });

  test.each(['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111'])('allows %s', (address) => {
    expect(isPrivateIpAddress(address)).toBe(false);
  });
});
