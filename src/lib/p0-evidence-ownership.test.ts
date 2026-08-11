/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function source(relativePath: string) {
  return readFile(path.join(process.cwd(), relativePath), 'utf8');
}

describe('P0 evidence lab ownership', () => {
  test('Settings exposes the credential-free evidence workflow', async () => {
    const settings = await source('src/components/studio/settings.tsx');
    const store = await source('src/lib/store.ts');

    expect(settings).toContain("value=\"evidence\"");
    expect(settings).toContain('<P0EvidenceLab />');
    expect(settings).toContain("'providers' | 'models' | 'review' | 'evidence' | 'transfer'");
    expect(store).toContain("'providers' | 'models' | 'review' | 'evidence' | 'transfer'");
  });

  test('normal local backup keeps evidence but never provider keys', async () => {
    const backup = await source('src/lib/local-backup.ts');
    expect(backup).toContain("'ai-studio-p0-evidence-v1'");
    expect(backup).not.toContain("'api-keys',");
  });

  test('the runbook and implementation reject credential material', async () => {
    const evidence = await source('src/lib/p0-evidence.ts');
    const runbook = await source('docs/P0-LIVE-EVIDENCE-RUNBOOK.md');

    expect(evidence).toContain('includesApiKeys: false');
    expect(evidence).toContain('Evidence notes must not contain API keys');
    expect(runbook).toContain('Never paste provider keys');
    expect(runbook).toContain('Settings → **Evidence**');
  });

  test('temporary evidence migration automation is removed', () => {
    expect(existsSync(path.join(
      process.cwd(),
      '.github/workflows/apply-p0-evidence-lab.yml',
    ))).toBe(false);
    expect(existsSync(path.join(
      process.cwd(),
      'scripts/apply-p0-evidence-lab.mjs',
    ))).toBe(false);
  });
});
