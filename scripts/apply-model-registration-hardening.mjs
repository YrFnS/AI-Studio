import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function replaceRequired(source, oldValue, newValue, label) {
  if (source.includes(newValue)) return source;
  if (!source.includes(oldValue)) {
    throw new Error(`Could not locate ${label}`);
  }
  return source.replace(oldValue, newValue);
}

async function patchProfiles() {
  const filePath = path.join(root, 'src/lib/model-registration.ts');
  let source = await fs.readFile(filePath, 'utf8');
  source = replaceRequired(
    source,
    `  {
    id: 'openai.images-generations.text-to-image',
    providerName: 'openai',
    type: 'image',
    operation: 'text-to-image',
    route: 'image',
    adapterId: 'openai.text-to-image',
    displayName: 'OpenAI Images · Text to Image',
    description: 'Uses the OpenAI Images generations request shape.',
    modelIdPattern: '^(?:gpt-image|dall-e)-[A-Za-z0-9._-]+$',
    modelIdHint: 'Use an OpenAI image model id beginning with gpt-image- or dall-e-.',
  },
`,
    '',
    'over-broad OpenAI local adapter profile',
  );
  await fs.writeFile(filePath, source, 'utf8');

  const testPath = path.join(root, 'src/lib/model-registration.test.ts');
  let test = await fs.readFile(testPath, 'utf8');
  test = replaceRequired(
    test,
    `    expect(getModelAdapterProfiles({ providerName: 'runway' })).toEqual([]);
`,
    `    expect(getModelAdapterProfiles({ providerName: 'runway' })).toEqual([]);
    expect(getModelAdapterProfiles({ providerName: 'openai' })).toEqual([]);
`,
    'conservative profile test',
  );
  await fs.writeFile(testPath, test, 'utf8');
}

async function patchReviewCandidates() {
  const filePath = path.join(root, 'src/components/studio/model-registration-review.tsx');
  let source = await fs.readFile(filePath, 'utf8');
  source = replaceRequired(
    source,
    `      const nextCandidates = [...candidateMap.values()].sort((a, b) => (
`,
    `      // Keep saved reviews manageable even after a discovered-model cache
      // entry expires. Static catalog entries remain excluded.
      for (const registration of savedRegistrations) {
        if (getRegisteredModel(registration.providerName, registration.modelId)) {
          continue;
        }
        const key = candidateKey(registration.providerName, registration.modelId);
        if (candidateMap.has(key)) continue;
        candidateMap.set(key, {
          key,
          source: registration.source,
          sourceId: registration.sourceId,
          providerId: registration.providerId,
          providerName: registration.providerName,
          providerDisplayName: registration.providerDisplayName,
          modelId: registration.modelId,
          modelName: registration.modelName,
          type: registration.type,
          description: 'Persisted review record; the original discovery cache entry is no longer present.',
        });
      }

      const nextCandidates = [...candidateMap.values()].sort((a, b) => (
`,
    'persisted review candidate fallback',
  );
  await fs.writeFile(filePath, source, 'utf8');
}

async function patchProviderCatalogFallback() {
  const filePath = path.join(root, 'src/lib/generation-client.ts');
  let source = await fs.readFile(filePath, 'utf8');
  source = replaceRequired(
    source,
    `    if (pathname === '/api/providers' && method === 'GET') {
      const response = await fetchImpl(input, init);
      if (!response.ok) return response;
      try {
        const catalog = await response.json() as unknown;
        const decorated = await decorateProviderCatalogWithApprovedRegistrations(catalog);
        const responseHeaders = new Headers(response.headers);
        responseHeaders.set('Content-Type', 'application/json');
        responseHeaders.set('Cache-Control', 'no-store');
        responseHeaders.delete('Content-Length');
        responseHeaders.delete('Content-Encoding');
        return new Response(JSON.stringify(decorated), {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      } catch {
        return failedResponse('Provider catalog could not be decorated with reviewed models');
      }
    }
`,
    `    if (pathname === '/api/providers' && method === 'GET') {
      const response = await fetchImpl(input, init);
      if (!response.ok || typeof indexedDB === 'undefined') return response;
      try {
        const catalog = await response.clone().json() as unknown;
        const decorated = await decorateProviderCatalogWithApprovedRegistrations(catalog);
        const responseHeaders = new Headers(response.headers);
        responseHeaders.set('Content-Type', 'application/json');
        responseHeaders.set('Cache-Control', 'no-store');
        responseHeaders.delete('Content-Length');
        responseHeaders.delete('Content-Encoding');
        return new Response(JSON.stringify(decorated), {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      } catch {
        // Reviewed models are additive. If local review metadata is unavailable,
        // retain the already registry-filtered static catalog rather than
        // breaking every provider selector.
        return response;
      }
    }
`,
    'safe provider catalog fallback',
  );
  await fs.writeFile(filePath, source, 'utf8');
}

async function writeIntegrationGuard() {
  const filePath = path.join(root, 'src/lib/model-registration-flow.test.ts');
  await fs.writeFile(filePath, `/// <reference types="bun-types" />

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
      const routeSource = await source(\`src/app/api/generate/\${route}/route.ts\`);
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
`, 'utf8');
}

async function patchDocumentation() {
  const readmePath = path.join(root, 'README.md');
  let readme = await fs.readFile(readmePath, 'utf8');
  readme = replaceRequired(
    readme,
    '- **Authoritative operation registry** — every executable provider/model/operation combination declares its owning route, adapter, and verification level. Raw catalog capability labels cannot make a model executable.\n',
    '- **Authoritative operation registry** — every executable provider/model/operation combination declares its owning route, adapter, and verification level. Raw catalog capability labels cannot make a model executable.\n- **Reviewed model registration** — custom and discovered definitions remain inert until mapped to a bounded adapter profile, documented, acknowledged, and locally approved; routes revalidate the approval on every request.\n',
    'README reviewed registration architecture',
  );
  readme = replaceRequired(
    readme,
    '- **Custom and discovered model definitions** — save local definitions for review; they are not executable until an operation contract is registered\n',
    '- **Custom and discovered model review** — save inert candidates, review provider documentation, approve bounded adapter contracts, and revoke selector access at any time\n',
    'README reviewed registration feature',
  );
  readme = replaceRequired(
    readme,
    '- Custom model definitions and cached model discovery results\n',
    '- Custom model definitions, cached model discovery results, and locally reviewed execution contracts\n',
    'README reviewed registration storage',
  );
  readme = replaceRequired(
    readme,
    `No contract is promoted to \`live-verified\` without manual evidence.

For editing and derived actions`,
    `No contract is promoted to \`live-verified\` without manual evidence.

## Reviewed custom and discovered models

Settings → Review turns custom or provider-discovered metadata into an executable local contract only through an explicit review:

1. The model remains a non-executable candidate by default.
2. The user selects a source-defined adapter profile with fixed provider, operation, route, request shape, and model-ID rule.
3. Approval requires an HTTPS provider-documentation URL, meaningful contract notes, and an explicit acknowledgement.
4. Approved registrations are stored in IndexedDB and included in normal non-key backups.
5. The explicit generation client adds the approved registration only to the matching provider/model/operation request.
6. The server validates the full registration, profile, model ID, operation, and route before contacting the provider.
7. Static catalog entries cannot be shadowed or broadened by local approval, and revoked or draft registrations never appear in generation selectors.

A local approval is recorded as \`contract-reviewed\`; it is not \`live-verified\`. Providers without a bounded source-defined profile remain metadata-only until a developer implements and tests one.

For editing and derived actions`,
    'README reviewed registration section',
  );
  readme = replaceRequired(
    readme,
    'Settings → Transfer exports a versioned JSON backup directly in the browser. It includes non-key IndexedDB metadata, prompts, collections, reference images, custom and discovered model definitions, and downloaded media Blobs encoded for transfer.',
    'Settings → Transfer exports a versioned JSON backup directly in the browser. It includes non-key IndexedDB metadata, prompts, collections, reference images, custom and discovered model definitions, reviewed model registrations, and downloaded media Blobs encoded for transfer.',
    'README reviewed registration backup',
  );
  readme = replaceRequired(
    readme,
    'Custom or dynamically discovered models are never merged directly into Image, Video, or Cinema generation selectors. A reviewed registry entry and executable adapter are required first.',
    'Custom or dynamically discovered models are never merged directly into Image, Video, or Cinema generation selectors. Settings → Review can approve only source-defined bounded adapter profiles; every request carries the matching approval for server revalidation. Models without a safe profile remain metadata-only.',
    'README reviewed registration provider support',
  );
  readme = replaceRequired(
    readme,
    '│   ├── studio/                   # Studios, editors, lifecycle hooks, gallery, and settings\n',
    '│   ├── studio/                   # Studios, editors, lifecycle hooks, gallery, settings, and model review\n',
    'README component structure',
  );
  readme = replaceRequired(
    readme,
    '    ├── generation-registry.ts    # Provider/model/operation/route/adapter source of truth\n',
    '    ├── generation-registry.ts    # Provider/model/operation/route/adapter source of truth\n    ├── model-registration.ts       # Bounded review profiles and server approval validation\n    ├── model-registration-client.ts # IndexedDB approval lookup and selector decoration\n',
    'README model registration structure',
  );
  await fs.writeFile(readmePath, readme, 'utf8');

  const trackerPath = path.join(root, 'docs/P0-RUNTIME-INTEGRITY.md');
  let tracker = await fs.readFile(trackerPath, 'utf8');
  tracker = replaceRequired(
    tracker,
    `- Arbitrary custom or discovered models cannot bypass registry review.
- No contract is labeled \`live-verified\` without an owner-key smoke test.
`,
    `- Arbitrary custom or discovered models cannot bypass registry review.
- IndexedDB version 7 stores draft, approved, revoked, and rejected local model-registration records.
- Settings → Review keeps custom and discovered definitions inert until they are mapped to a source-defined bounded adapter profile.
- Approval requires an HTTPS documentation URL, meaningful review notes, and explicit acknowledgement; it records \`contract-reviewed\`, never automatic live verification.
- The explicit generation client exposes only approved registrations and attaches the matching evidence to the exact provider/model/operation request.
- Generation routes revalidate the registration, adapter profile, model-ID rule, operation, and route before provider contact.
- Static catalog entries cannot be shadowed or broadened by local approval, and providers without a bounded profile remain metadata-only.
- Approved records remain manageable after discovery-cache expiry and can be revoked from selector access.
- No contract is labeled \`live-verified\` without an owner-key smoke test.
`,
    'tracker reviewed registration completion',
  );
  tracker = replaceRequired(
    tracker,
    '- Backups include generations, prompts, collections, collection membership, reference images, custom/discovered model definitions, and downloaded IndexedDB media assets.\n',
    '- Backups include generations, prompts, collections, collection membership, reference images, custom/discovered model definitions, reviewed model registrations, and downloaded IndexedDB media assets.\n',
    'tracker registration backup',
  );
  tracker = replaceRequired(
    tracker,
    '- registry and route ownership,\n',
    '- registry, route, reviewed-registration profile, selector decoration, and server revalidation ownership,\n',
    'tracker registration test coverage',
  );
  tracker = replaceRequired(
    tracker,
    `### Live contract verification and extension workflow

- Run owner-supplied-key smoke tests for every registered provider/model/operation.
- Promote only evidenced contracts to \`live-verified\`.
- Hide or repair contracts that fail live verification.
- Define the reviewed workflow by which custom and discovered models can become executable without bypassing the registry.
- Run real provider-side cancellation checks for Replicate, fal, Runway, and Luma; automated tests currently verify the documented HTTP contracts without spending provider credits.
`,
    `### Live contract verification

- Run owner-supplied-key smoke tests for every registered provider/model/operation, including locally approved contracts selected for real use.
- Promote only evidenced contracts to \`live-verified\`.
- Hide, revoke, or repair contracts that fail live verification.
- Run real provider-side cancellation checks for Replicate, fal, Runway, and Luma; automated tests currently verify the documented HTTP contracts without spending provider credits.
`,
    'tracker remaining live verification scope',
  );
  await fs.writeFile(trackerPath, tracker, 'utf8');
}

await patchProfiles();
await patchReviewCandidates();
await patchProviderCatalogFallback();
await writeIntegrationGuard();
await patchDocumentation();
