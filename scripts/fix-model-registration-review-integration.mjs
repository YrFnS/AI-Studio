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

async function patchGenerationClient() {
  const filePath = path.join(root, 'src/lib/generation-client.ts');
  let source = await fs.readFile(filePath, 'utf8');
  source = replaceRequired(
    source,
    `          && registrationContext
          && !isRecord(payload.reviewedRegistration)
`,
    `          && registrationContext
          && typeof indexedDB !== 'undefined'
          && !isRecord(payload.reviewedRegistration)
`,
    'browser-only reviewed registration lookup',
  );
  await fs.writeFile(filePath, source, 'utf8');
}

async function patchCoverage() {
  const filePath = path.join(root, 'src/lib/generation-client-coverage.test.ts');
  let source = await fs.readFile(filePath, 'utf8');
  source = replaceRequired(
    source,
    `  path.normalize('src/lib/generation-operation.test.ts'),
`,
    `  path.normalize('src/lib/generation-operation.test.ts'),
  // Pure IndexedDB registration/catalog helper; it returns route strings but
  // does not perform generation network requests itself.
  path.normalize('src/lib/model-registration-client.ts'),
`,
    'reviewed registration coverage exemption',
  );
  await fs.writeFile(filePath, source, 'utf8');
}

async function patchProtectedMediaVersionAssertion() {
  const filePath = path.join(root, 'src/lib/protected-media-persistence.test.ts');
  let source = await fs.readFile(filePath, 'utf8');
  source = replaceRequired(
    source,
    `    expect(idb).toContain("const DB_VERSION = 6");
`,
    `    expect(idb).toContain("const DB_VERSION = 7");
`,
    'IndexedDB version assertion',
  );
  await fs.writeFile(filePath, source, 'utf8');
}

await patchGenerationClient();
await patchCoverage();
await patchProtectedMediaVersionAssertion();
