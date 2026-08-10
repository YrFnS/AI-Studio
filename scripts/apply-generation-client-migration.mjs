import { promises as fs } from 'node:fs';
import path from 'node:path';

const repositoryRoot = process.cwd();
const sourceRoot = path.join(repositoryRoot, 'src');
const explicitImport = "import { generationFetch as fetch } from '@/lib/generation-client';";
const generationPathPattern = /\/api\/generate\//;
const supportedExtensions = new Set(['.ts', '.tsx']);
const skippedFiles = new Set([
  path.normalize('src/lib/generation-client.ts'),
  path.normalize('src/lib/generation-client.test.ts'),
  path.normalize('src/lib/generation-client-coverage.test.ts'),
  path.normalize('src/lib/generation-poller.ts'),
  path.normalize('src/lib/generation-poller.test.ts'),
  path.normalize('src/components/secure-provider-fetch-bridge.tsx'),
]);

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else if (supportedExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function repositoryPath(filePath) {
  return path.normalize(path.relative(repositoryRoot, filePath));
}

function isClientModule(content) {
  return content.startsWith("'use client';") || content.startsWith('"use client";');
}

function insertExplicitImport(content, filePath) {
  if (content.includes(explicitImport)) return content;
  if (!isClientModule(content)) return content;

  if (/\b(?:const|let|var|function)\s+fetch\b/.test(content)) {
    throw new Error(
      `${repositoryPath(filePath)} declares a local fetch identifier and needs manual migration`,
    );
  }

  const firstLineEnd = content.indexOf('\n');
  if (firstLineEnd < 0) {
    throw new Error(`${repositoryPath(filePath)} has no import insertion point`);
  }

  return `${content.slice(0, firstLineEnd + 1)}\n${explicitImport}\n${content.slice(firstLineEnd + 1)}`;
}

async function migrateGenerationCallers() {
  const sourceFiles = await walk(sourceRoot);
  const migrated = [];

  for (const filePath of sourceFiles) {
    const relativePath = repositoryPath(filePath);
    if (relativePath.startsWith(path.normalize('src/app/api/'))) continue;
    if (skippedFiles.has(relativePath)) continue;

    const content = await fs.readFile(filePath, 'utf8');
    if (!generationPathPattern.test(content)) continue;

    const updated = insertExplicitImport(content, filePath);
    if (updated !== content) {
      await fs.writeFile(filePath, updated, 'utf8');
      migrated.push(relativePath);
    }
  }

  if (migrated.length === 0) {
    throw new Error('No browser generation callers were migrated');
  }

  return migrated;
}

async function removeGlobalBridge() {
  const layoutPath = path.join(sourceRoot, 'app', 'layout.tsx');
  const bridgePath = path.join(
    sourceRoot,
    'components',
    'secure-provider-fetch-bridge.tsx',
  );

  let layout = await fs.readFile(layoutPath, 'utf8');
  const importLine = 'import { SecureProviderFetchBridge } from "@/components/secure-provider-fetch-bridge";\n';
  const mountLine = '        <SecureProviderFetchBridge />\n';

  if (!layout.includes(importLine) || !layout.includes(mountLine)) {
    throw new Error('Root layout no longer contains the expected compatibility bridge');
  }

  layout = layout.replace(importLine, '').replace(mountLine, '');
  await fs.writeFile(layoutPath, layout, 'utf8');
  await fs.rm(bridgePath);
}

const migrated = await migrateGenerationCallers();
await removeGlobalBridge();

console.log('Migrated generation callers to the explicit client:');
for (const file of migrated) console.log(`- ${file}`);
console.log('- src/app/layout.tsx (removed global bridge mount)');
console.log('- src/components/secure-provider-fetch-bridge.tsx (deleted)');
