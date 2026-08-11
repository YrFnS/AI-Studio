/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function source(relativePath: string) {
  return readFile(path.join(process.cwd(), relativePath), 'utf8');
}

describe('reviewed custom and discovered model registration ownership', () => {
  test('persists inert candidates and review records in IndexedDB v7', async () => {
    const idb = await source('src/lib/idb.ts');
    expect(idb).toContain('const DB_VERSION = 7');
    expect(idb).toContain("createObjectStore('modelRegistrations'");
    expect(idb).toContain('getApprovedModelRegistrations');
    expect(idb).toContain("registration.source === 'custom'");
  });

  test('Settings exposes an explicit review workflow instead of executable custom models', async () => {
    const settings = await source('src/components/studio/settings.tsx');
    const review = await source('src/components/studio/model-registration-review.tsx');
    expect(settings).toContain('<ModelRegistrationReview />');
    expect(settings).toContain('value="review"');
    expect(settings).toContain('Add Model Candidate');
    expect(review).toContain('Approve local execution');
    expect(review).toContain('Save draft');
    expect(review).toContain('Revoke selector access');
    expect(review).toContain('for (const registration of savedRegistrations)');
    expect(review).toContain('not a live-provider verification');
  });

  test('only approved bounded profiles can decorate executable selectors', async () => {
    const profiles = await source('src/lib/model-registration.ts');
    const client = await source('src/lib/model-registration-client.ts');
    expect(profiles).toContain('approvedModelRegistrationSchema');
    expect(profiles).toContain('requireApprovedModelRegistration');
    expect(profiles).not.toContain('openai.images-generations.text-to-image');
    expect(client).toContain("registration.status === 'approved'");
    expect(client).toContain('Static registry entries remain authoritative');
  });

  test('generation submissions carry review evidence and routes revalidate it', async () => {
    const client = await source('src/lib/generation-client.ts');
    const request = await source('src/lib/server/generation-request.ts');
    const registry = await source('src/lib/generation-registry.ts');
    expect(client).toContain('findApprovedModelRegistration');
    expect(client).toContain('payload.reviewedRegistration = registration');
    expect(client).toContain('return response;');
    expect(request).toContain('approvedModelRegistrationSchema.optional()');
    expect(registry).toContain('requireApprovedModelRegistration(reviewedRegistration');
    expect(registry).toContain('CATALOG_MODEL_KEYS');

    for (const route of [
      'image',
      'video',
      'edit',
      'upscale',
      'variations',
      'img2vid',
    ]) {
      const routeSource = await source(`src/app/api/generate/${route}/route.ts`);
      expect(routeSource).toContain('reviewedRegistration');
      expect(routeSource).toContain('requireModelOperation');
    }
  });

  test('review records are part of normal non-key backup and temporary migration automation is gone', async () => {
    const backup = await source('src/lib/local-backup.ts');
    expect(backup).toContain("'modelRegistrations'");
    expect(backup).not.toContain("'api-keys',");
    expect(existsSync(path.join(process.cwd(), '.github/workflows/apply-model-registration-hardening.yml'))).toBe(false);
    expect(existsSync(path.join(process.cwd(), 'scripts/apply-model-registration-hardening.mjs'))).toBe(false);
  });
});
