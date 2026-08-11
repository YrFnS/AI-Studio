import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function replaceRequired(source, oldValue, newValue, label) {
  if (source.includes(newValue)) return source;
  if (!source.includes(oldValue)) throw new Error(`Could not locate ${label}`);
  return source.replace(oldValue, newValue);
}

async function patchEvidence() {
  const filePath = path.join(root, 'src/lib/p0-evidence.ts');
  let source = await fs.readFile(filePath, 'utf8');
  source = replaceRequired(
    source,
    `function duplicateProviderJobCount(
  target: GenerationRecord | undefined,
  allGenerations: readonly GenerationRecord[],
): number {
  if (!target?.providerJobId) return target ? 1 : 0;
  return allGenerations.filter((generation) => (
    generation.providerJobId === target.providerJobId
  )).length;
}
`,
    `function duplicateProviderJobCount(
  target: GenerationRecord | undefined,
  allGenerations: readonly GenerationRecord[],
): number {
  if (!target) return 0;
  if (target.providerJobId) {
    return allGenerations.filter((generation) => (
      generation.providerJobId === target.providerJobId
    )).length;
  }

  // Immediate providers may not return a provider job id. Correlate records
  // created by the same isolated request so batch or duplicate persistence is
  // still visible to the evidence gate.
  return allGenerations.filter((generation) => (
    generation.id === target.id
    || (
      generation.providerJobId === undefined
      && generation.providerId === target.providerId
      && generation.modelId === target.modelId
      && generation.type === target.type
      && generation.prompt === target.prompt
      && generation.parentGenerationId === target.parentGenerationId
      && Math.abs(generation.createdAt - target.createdAt) <= 5_000
    )
  )).length;
}
`,
    'immediate duplicate correlation',
  );
  await fs.writeFile(filePath, source, 'utf8');
}

async function patchEvidenceTest() {
  const filePath = path.join(root, 'src/lib/p0-evidence.test.ts');
  let source = await fs.readFile(filePath, 'utf8');
  source = replaceRequired(
    source,
    `    expect(checks.find((item) => item.id === 'no-duplicate-provider-job')?.passed)
      .toBe(false);
  });
`,
    `    expect(checks.find((item) => item.id === 'no-duplicate-provider-job')?.passed)
      .toBe(false);

    const immediate = generation({ providerJobId: undefined });
    const correlatedDuplicate = generation({
      id: 'img-live-correlated-duplicate',
      providerJobId: undefined,
      createdAt: immediate.createdAt + 1,
    });
    const immediateChecks = evaluateP0EvidenceRecord(
      record(),
      context(immediate, { allGenerations: [immediate, correlatedDuplicate] }),
    );
    expect(immediateChecks.find((item) => item.id === 'no-duplicate-provider-job')?.passed)
      .toBe(false);
  });
`,
    'immediate duplicate correlation test',
  );
  await fs.writeFile(filePath, source, 'utf8');
}

async function patchLintWarning() {
  const filePath = path.join(root, 'src/components/studio/settings.tsx');
  let source = await fs.readFile(filePath, 'utf8');
  source = source.replace(
    `  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
`,
    `  useEffect(() => {
    fetchData();
  }, []);
`,
  );
  await fs.writeFile(filePath, source, 'utf8');
}

await patchEvidence();
await patchEvidenceTest();
await patchLintWarning();
