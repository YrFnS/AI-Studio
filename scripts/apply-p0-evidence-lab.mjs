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

function replaceAllRequired(source, oldValue, newValue, label, minimum = 1) {
  if (!source.includes(oldValue)) {
    if (source.includes(newValue)) return source;
    throw new Error(`Could not locate ${label}`);
  }
  const count = source.split(oldValue).length - 1;
  if (count < minimum) {
    throw new Error(`Expected at least ${minimum} occurrences of ${label}, found ${count}`);
  }
  return source.split(oldValue).join(newValue);
}

async function patchStore() {
  const filePath = path.join(root, 'src/lib/store.ts');
  let source = await fs.readFile(filePath, 'utf8');
  source = replaceAllRequired(
    source,
    "'providers' | 'models' | 'review' | 'transfer'",
    "'providers' | 'models' | 'review' | 'evidence' | 'transfer'",
    'Settings tab union',
    2,
  );
  await fs.writeFile(filePath, source, 'utf8');
}

async function patchSettings() {
  const filePath = path.join(root, 'src/components/studio/settings.tsx');
  let source = await fs.readFile(filePath, 'utf8');

  source = replaceRequired(
    source,
    `  Pencil,
  Telescope,
} from 'lucide-react';`,
    `  Pencil,
  Telescope,
  ClipboardCheck,
} from 'lucide-react';`,
    'Settings evidence icon import',
  );
  source = replaceRequired(
    source,
    "import { ModelRegistrationReview } from '@/components/studio/model-registration-review';\n",
    "import { ModelRegistrationReview } from '@/components/studio/model-registration-review';\nimport { P0EvidenceLab } from '@/components/studio/p0-evidence-lab';\n",
    'P0 evidence component import',
  );
  source = replaceRequired(
    source,
    '                Configure API keys, manage models, and transfer settings',
    '                Configure API keys, review model contracts, capture P0 evidence, and transfer local data',
    'Settings page description',
  );
  source = replaceRequired(
    source,
    "onValueChange={(v) => setSettingsTab(v as 'providers' | 'models' | 'review' | 'transfer')}",
    "onValueChange={(v) => setSettingsTab(v as 'providers' | 'models' | 'review' | 'evidence' | 'transfer')}",
    'Settings tab cast',
  );

  const transferTrigger = `              <TabsTrigger
                value="transfer"
                className="rounded-lg gap-2 data-[state=active]:bg-[#d9ff00]/10 data-[state=active]:text-[#d9ff00] data-[state=active]:shadow-none px-4 transition-all duration-200"
              >
                <Download className="h-4 w-4" />
                Transfer
              </TabsTrigger>`;
  const evidenceTrigger = `              <TabsTrigger
                value="evidence"
                className="rounded-lg gap-2 data-[state=active]:bg-[#d9ff00]/10 data-[state=active]:text-[#d9ff00] data-[state=active]:shadow-none px-4 transition-all duration-200"
              >
                <ClipboardCheck className="h-4 w-4" />
                Evidence
              </TabsTrigger>
${transferTrigger}`;
  source = replaceRequired(
    source,
    transferTrigger,
    evidenceTrigger,
    'Settings evidence tab trigger',
  );

  const transferContent = `            <TabsContent value="transfer" className="mt-6">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ExportImportSection />
              </motion.div>
            </TabsContent>`;
  const evidenceContent = `            <TabsContent value="evidence" className="mt-6">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
              >
                <P0EvidenceLab />
              </motion.div>
            </TabsContent>

${transferContent}`;
  source = replaceRequired(
    source,
    transferContent,
    evidenceContent,
    'Settings evidence tab content',
  );

  await fs.writeFile(filePath, source, 'utf8');
}

async function patchEvidenceComponent() {
  const filePath = path.join(root, 'src/components/studio/p0-evidence-lab.tsx');
  let source = await fs.readFile(filePath, 'utf8');
  source = source.replace("import { Input } from '@/components/ui/input';\n", '');
  await fs.writeFile(filePath, source, 'utf8');
}

async function patchBackup() {
  const filePath = path.join(root, 'src/lib/local-backup.ts');
  let source = await fs.readFile(filePath, 'utf8');
  source = replaceRequired(
    source,
    `const LOCAL_STORAGE_KEYS = [
  'ai-studio-prompt-history',
  'ai-studio-demo-data-v2',
] as const;`,
    `const LOCAL_STORAGE_KEYS = [
  'ai-studio-prompt-history',
  'ai-studio-demo-data-v2',
  'ai-studio-p0-evidence-v1',
] as const;`,
    'P0 evidence backup key',
  );
  await fs.writeFile(filePath, source, 'utf8');
}

async function patchPackage() {
  const filePath = path.join(root, 'package.json');
  let source = await fs.readFile(filePath, 'utf8');
  source = replaceRequired(
    source,
    '    "test": "bun test",\n    "lint": "eslint .",',
    '    "test": "bun test",\n    "evidence:check": "bun test src/lib/p0-evidence.test.ts src/lib/p0-evidence-ownership.test.ts",\n    "lint": "eslint .",',
    'P0 evidence package script',
  );
  await fs.writeFile(filePath, source, 'utf8');
}

async function patchReadme() {
  const filePath = path.join(root, 'README.md');
  let source = await fs.readFile(filePath, 'utf8');
  source = replaceRequired(
    source,
    '- **Reviewed model registration** — custom and discovered definitions remain inert until mapped to a bounded adapter profile, documented, acknowledged, and locally approved; routes revalidate the approval on every request.\n',
    '- **Reviewed model registration** — custom and discovered definitions remain inert until mapped to a bounded adapter profile, documented, acknowledged, and locally approved; routes revalidate the approval on every request.\n- **P0 evidence lab** — Settings captures credential-free live-test checkpoints, inspects durable IndexedDB outcomes, verifies duplicate-free recovery, and exports reviewable evidence packets.\n',
    'README evidence architecture bullet',
  );
  source = replaceRequired(
    source,
    '- **Custom and discovered model review** — save inert candidates, review provider documentation, approve bounded adapter contracts, and revoke selector access at any time\n',
    '- **Custom and discovered model review** — save inert candidates, review provider documentation, approve bounded adapter contracts, and revoke selector access at any time\n- **Live evidence lab** — record immediate results, restart recovery, protected media, provider cancellation, and contract smoke tests without exporting keys\n',
    'README evidence feature bullet',
  );
  source = replaceRequired(
    source,
    '## Local backup and restore\n',
    `## P0 live evidence

Settings → Evidence creates local checkpoints tied to durable generation IDs. It can verify completed media, duplicate provider-job records, restart-session changes, protected-media Blob persistence, and local Blob URL recreation. Provider-side facts that the browser cannot observe require an explicit operator confirmation.

Evidence records are stored under the local \`ai-studio-p0-evidence-v1\` key, included in normal non-key backups, and exportable as a separate JSON packet declaring \`includesApiKeys: false\`. Notes that resemble API keys or authorization headers are rejected.

The complete operator procedure is documented in [docs/P0-LIVE-EVIDENCE-RUNBOOK.md](docs/P0-LIVE-EVIDENCE-RUNBOOK.md). A passing evidence record supports review but does not automatically promote a source contract to \`live-verified\`.

## Local backup and restore
`,
    'README P0 evidence section',
  );
  await fs.writeFile(filePath, source, 'utf8');
}

async function patchTracker() {
  const filePath = path.join(root, 'docs/P0-RUNTIME-INTEGRITY.md');
  let source = await fs.readFile(filePath, 'utf8');
  source = replaceRequired(
    source,
    '### Regression coverage\n',
    `### Live evidence capture and audit readiness

- Added Settings → Evidence as a credential-free checkpoint and verification workspace.
- Evidence records bind to durable generation IDs and retain the provider job ID and status captured before restart.
- Automatic checks cover completed result presence, provider/model matching, duplicate provider-job records, processing checkpoints, runtime reloads, protected-media Blob persistence, and local Blob URL recreation.
- Server restarts, live provider acceptance, and provider-side terminal cancellation require explicit operator confirmation rather than being inferred.
- Cancellation gates pass only for remotely requested or already-terminal outcomes with provider-side confirmation; local-only and failed outcomes remain diagnostic evidence.
- Evidence exports declare \`includesApiKeys: false\` and reject notes resembling API keys or authorization headers.
- P0 evidence records are included in the normal non-key local backup.
- Added \`docs/P0-LIVE-EVIDENCE-RUNBOOK.md\` with the exact immediate-image, restart-recovery, protected-media, cancellation, contract-smoke, export, and promotion procedure.

### Regression coverage
`,
    'P0 evidence tracker section',
  );
  source = replaceRequired(
    source,
    '- registry, route, reviewed-registration profile, selector decoration, and server revalidation ownership,\n',
    '- registry, route, reviewed-registration profile, selector decoration, and server revalidation ownership,\n- credential-free evidence packet, restart-checkpoint, duplicate-record, protected-media, and cancellation-confirmation ownership,\n',
    'P0 evidence regression bullet',
  );
  await fs.writeFile(filePath, source, 'utf8');
}

await patchStore();
await patchSettings();
await patchEvidenceComponent();
await patchBackup();
await patchPackage();
await patchReadme();
await patchTracker();
