/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
} from './security-headers';

describe('security headers', () => {
  test('builds a restrictive production CSP', () => {
    const policy = buildContentSecurityPolicy('production');

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).toContain('upgrade-insecure-requests');
    expect(policy).not.toContain("'unsafe-eval'");
  });

  test('allows the development evaluator only in development', () => {
    const policy = buildContentSecurityPolicy('development');

    expect(policy).toContain("'unsafe-eval'");
    expect(policy).toContain('http:');
    expect(policy).toContain('ws:');
    expect(policy).not.toContain('upgrade-insecure-requests');
  });

  test('adds transport and browser hardening headers in production', () => {
    const headers = new Map(
      buildSecurityHeaders('production').map((header) => [
        header.key,
        header.value,
      ]),
    );

    expect(headers.get('Strict-Transport-Security')).toContain('max-age=63072000');
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Permissions-Policy')).toContain('camera=()');
    expect(headers.get('Content-Security-Policy')).toContain("frame-src 'none'");
  });

  test('wires the shared policy into Next.js and hides the framework header', async () => {
    const config = await readFile(
      path.join(process.cwd(), 'next.config.ts'),
      'utf8',
    );

    expect(config).toContain('buildSecurityHeaders()');
    expect(config).toContain('poweredByHeader: false');
    expect(config).toContain("source: '/:path*'");
  });
});
