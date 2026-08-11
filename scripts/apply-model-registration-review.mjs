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

function replaceRange(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Could not locate ${label}`);
  }
  return source.slice(0, start) + replacement + source.slice(end);
}

function insertSchemaField(source, schemaName) {
  const startMarker = `export const ${schemaName}`;
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`Could not locate ${schemaName}`);
  const next = source.indexOf('\nexport const ', start + startMarker.length);
  const end = next < 0 ? source.length : next;
  const block = source.slice(start, end);
  if (block.includes('reviewedRegistration:')) return source;
  if (!block.includes('  apiKey: apiKeySchema,')) {
    throw new Error(`Could not locate API key field in ${schemaName}`);
  }
  const patched = block.replace(
    '  apiKey: apiKeySchema,',
    '  reviewedRegistration: approvedModelRegistrationSchema.optional(),\n  apiKey: apiKeySchema,',
  );
  return source.slice(0, start) + patched + source.slice(end);
}

async function patchIdb() {
  const filePath = path.join(root, 'src/lib/idb.ts');
  let source = await fs.readFile(filePath, 'utf8');
  source = replaceRequired(
    source,
    "import { matchesGenerationSearch } from '@/lib/gallery-search';\n",
    "import { matchesGenerationSearch } from '@/lib/gallery-search';\nimport type { ModelRegistrationRecord } from '@/lib/model-registration';\n",
    'IDB model registration import',
  );
  source = replaceRequired(
    source,
    'const DB_VERSION = 6;',
    'const DB_VERSION = 7;',
    'IDB version 7',
  );
  source = replaceRequired(
    source,
    `      // v6: generated protected media blobs
      if (!db.objectStoreNames.contains('mediaAssets')) {
        const mediaStore = db.createObjectStore('mediaAssets', { keyPath: 'id' });
        mediaStore.createIndex('generationId', 'generationId', { unique: true });
        mediaStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
`,
    `      // v6: generated protected media blobs
      if (!db.objectStoreNames.contains('mediaAssets')) {
        const mediaStore = db.createObjectStore('mediaAssets', { keyPath: 'id' });
        mediaStore.createIndex('generationId', 'generationId', { unique: true });
        mediaStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      // v7: locally reviewed custom/discovered model contracts
      if (!db.objectStoreNames.contains('modelRegistrations')) {
        const registrationStore = db.createObjectStore('modelRegistrations', { keyPath: 'id' });
        registrationStore.createIndex('sourceId', 'sourceId', { unique: false });
        registrationStore.createIndex('providerName', 'providerName', { unique: false });
        registrationStore.createIndex('modelId', 'modelId', { unique: false });
        registrationStore.createIndex('status', 'status', { unique: false });
        registrationStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
`,
    'IDB registration store',
  );

  source = replaceRequired(
    source,
    `export async function deleteCustomModel(id: string): Promise<void> {
  const { transaction, stores } = await tx('customModels', 'readwrite');
  stores['customModels'].delete(id);
  await txComplete(transaction);
}

export async function clearAllCustomModels(): Promise<void> {
  const { transaction, stores } = await tx('customModels', 'readwrite');
  stores['customModels'].clear();
  await txComplete(transaction);
}
`,
    `export async function deleteCustomModel(id: string): Promise<void> {
  const { transaction, stores } = await tx(
    ['customModels', 'modelRegistrations'],
    'readwrite',
  );
  stores.customModels.delete(id);
  const registrations = await reqToPromise<ModelRegistrationRecord[]>(
    stores.modelRegistrations.index('sourceId').getAll(id),
  );
  for (const registration of registrations) {
    stores.modelRegistrations.delete(registration.id);
  }
  await txComplete(transaction);
}

export async function clearAllCustomModels(): Promise<void> {
  const { transaction, stores } = await tx(
    ['customModels', 'modelRegistrations'],
    'readwrite',
  );
  stores.customModels.clear();
  const registrations = await reqToPromise<ModelRegistrationRecord[]>(
    stores.modelRegistrations.getAll(),
  );
  for (const registration of registrations) {
    if (registration.source === 'custom') {
      stores.modelRegistrations.delete(registration.id);
    }
  }
  await txComplete(transaction);
}
`,
    'custom model registration cleanup',
  );

  source = replaceRequired(
    source,
    `// ===========================================================================
// Discovered Models Cache (dynamic models fetched from provider APIs)
// ===========================================================================
`,
    `// ===========================================================================
// Reviewed Model Registrations
// ===========================================================================

export type { ModelRegistrationRecord };

export async function saveModelRegistration(
  registration: ModelRegistrationRecord,
): Promise<void> {
  const { transaction, stores } = await tx('modelRegistrations', 'readwrite');
  stores.modelRegistrations.put(registration);
  await txComplete(transaction);
}

export async function getModelRegistration(
  id: string,
): Promise<ModelRegistrationRecord | undefined> {
  const { stores } = await tx('modelRegistrations');
  return reqToPromise(stores.modelRegistrations.get(id));
}

export async function getAllModelRegistrations(): Promise<ModelRegistrationRecord[]> {
  const { stores } = await tx('modelRegistrations');
  const registrations = await reqToPromise<ModelRegistrationRecord[]>(
    stores.modelRegistrations.getAll(),
  );
  return registrations.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getApprovedModelRegistrations(): Promise<ModelRegistrationRecord[]> {
  const { stores } = await tx('modelRegistrations');
  const approved = await reqToPromise<ModelRegistrationRecord[]>(
    stores.modelRegistrations.index('status').getAll('approved'),
  );
  return approved.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteModelRegistration(id: string): Promise<void> {
  const { transaction, stores } = await tx('modelRegistrations', 'readwrite');
  stores.modelRegistrations.delete(id);
  await txComplete(transaction);
}

export async function clearAllModelRegistrations(): Promise<void> {
  const { transaction, stores } = await tx('modelRegistrations', 'readwrite');
  stores.modelRegistrations.clear();
  await txComplete(transaction);
}

// ===========================================================================
// Discovered Models Cache (dynamic models fetched from provider APIs)
// ===========================================================================
`,
    'reviewed registration persistence functions',
  );
  await fs.writeFile(filePath, source, 'utf8');
}

async function patchBackup() {
  const filePath = path.join(root, 'src/lib/local-backup.ts');
  let source = await fs.readFile(filePath, 'utf8');
  source = replaceRequired(
    source,
    "  'discoveredModels',\n  'mediaAssets',",
    "  'discoveredModels',\n  'modelRegistrations',\n  'mediaAssets',",
    'backup registration store',
  );
  source = replaceRequired(
    source,
    '  discoveredModels: Record<string, unknown>[];\n  mediaAssets: BackupMediaAsset[];',
    '  discoveredModels: Record<string, unknown>[];\n  modelRegistrations: Record<string, unknown>[];\n  mediaAssets: BackupMediaAsset[];',
    'backup registration store type',
  );
  await fs.writeFile(filePath, source, 'utf8');

  const testPath = path.join(root, 'src/lib/local-backup.test.ts');
  let test = await fs.readFile(testPath, 'utf8');
  test = replaceRequired(test, 'databaseVersion: 6,', 'databaseVersion: 7,', 'backup test database version');
  test = replaceRequired(
    test,
    '      discoveredModels: [],\n      mediaAssets: [],',
    '      discoveredModels: [],\n      modelRegistrations: [],\n      mediaAssets: [],',
    'backup test registration store',
  );
  await fs.writeFile(testPath, test, 'utf8');
}

async function patchRegistry() {
  const filePath = path.join(root, 'src/lib/generation-registry.ts');
  let source = await fs.readFile(filePath, 'utf8');
  source = replaceRequired(
    source,
    "import { MODELS } from '@/lib/providers-data';\n",
    "import { MODELS } from '@/lib/providers-data';\nimport {\n  approvedRegistrationToContract,\n  requireApprovedModelRegistration,\n} from '@/lib/model-registration';\n",
    'generation registry registration import',
  );
  source = replaceRequired(
    source,
    `function modelKey(providerName: string, modelId: string): string {
  return \`${'${providerName}'}::${'${modelId}'}\`;
}

const REGISTRY = new Map<string, RegisteredModelOperations>();
`,
    `function modelKey(providerName: string, modelId: string): string {
  return \`${'${providerName}'}::${'${modelId}'}\`;
}

const CATALOG_MODEL_KEYS = new Set(
  (MODELS as CatalogModel[]).map((model) => modelKey(model.providerName, model.modelId)),
);

const REGISTRY = new Map<string, RegisteredModelOperations>();
`,
    'static catalog model key set',
  );
  source = replaceRequired(
    source,
    `    | 'model-not-registered'
    | 'operation-not-supported'
    | 'route-not-supported';
`,
    `    | 'model-not-registered'
    | 'operation-not-supported'
    | 'route-not-supported'
    | 'reviewed-registration-invalid';
`,
    'generation registry reviewed error code',
  );

  const requireFunction = `export function requireModelOperation(
  providerName: string,
  modelId: string,
  operation: GenerationOperationId,
  route?: GenerationRouteId,
  reviewedRegistration?: unknown,
): ModelOperationContract {
  const entry = getRegisteredModel(providerName, modelId);
  if (entry) {
    const contract = entry.contracts.find(
      (candidate) => candidate.operation === operation,
    );
    if (!contract) {
      throw new GenerationRegistryError(
        \`${'${modelId}'} does not support ${'${operation}'} through ${'${providerName}'}.\`,
        'operation-not-supported',
      );
    }

    if (route && !contract.routes.includes(route)) {
      throw new GenerationRegistryError(
        \`${'${modelId}'} cannot run ${'${operation}'} through the ${'${route}'} route.\`,
        'route-not-supported',
      );
    }
    return contract;
  }

  // A local review cannot override or broaden a model already present in the
  // shipped catalog. Those changes require a normal source review.
  if (CATALOG_MODEL_KEYS.has(modelKey(providerName, modelId))) {
    throw new GenerationRegistryError(
      \`Model ${'${modelId}'} is present in the catalog but has no executable ${'${operation}'} contract.\`,
      'model-not-registered',
    );
  }

  if (!reviewedRegistration || !route) {
    throw new GenerationRegistryError(
      \`Model ${'${modelId}'} is not registered for executable generation through ${'${providerName}'}.\`,
      'model-not-registered',
    );
  }

  try {
    const registration = requireApprovedModelRegistration(reviewedRegistration, {
      providerName,
      modelId,
      operation,
      route,
    });
    return approvedRegistrationToContract(registration);
  } catch (error) {
    throw new GenerationRegistryError(
      error instanceof Error
        ? error.message
        : 'The reviewed model registration is invalid.',
      'reviewed-registration-invalid',
    );
  }
}

`;
  source = replaceRange(
    source,
    'export function requireModelOperation(\n',
    'export function operationsToLegacyCapabilities(',
    requireFunction,
    'dynamic requireModelOperation implementation',
  );
  await fs.writeFile(filePath, source, 'utf8');
}

async function patchRequestSchemas() {
  const filePath = path.join(root, 'src/lib/server/generation-request.ts');
  let source = await fs.readFile(filePath, 'utf8');
  source = replaceRequired(
    source,
    "import { z } from 'zod';\n",
    "import { z } from 'zod';\n\nimport { approvedModelRegistrationSchema } from '@/lib/model-registration';\n",
    'generation request registration schema import',
  );
  for (const schemaName of [
    'imageGenerationRequestSchema',
    'videoGenerationRequestSchema',
    'editGenerationRequestSchema',
    'upscaleGenerationRequestSchema',
    'variationGenerationRequestSchema',
    'imageToVideoGenerationRequestSchema',
  ]) {
    source = insertSchemaField(source, schemaName);
  }
  await fs.writeFile(filePath, source, 'utf8');
}

async function patchRoutes() {
  const routes = [
    {
      path: 'src/app/api/generate/image/route.ts',
      destructure: '      hiresDenoise,\n      apiKey,',
      destructureNext: '      hiresDenoise,\n      reviewedRegistration,\n      apiKey,',
      call: `      inputImageUrl ? 'image-to-image' : 'text-to-image',
      'image',
    );`,
      callNext: `      inputImageUrl ? 'image-to-image' : 'text-to-image',
      'image',
      reviewedRegistration,
    );`,
    },
    {
      path: 'src/app/api/generate/video/route.ts',
      destructure: '      endFrameUrl,\n      apiKey,',
      destructureNext: '      endFrameUrl,\n      reviewedRegistration,\n      apiKey,',
      call: `      sourceImage ? 'image-to-video' : 'text-to-video',
      'video',
    );`,
      callNext: `      sourceImage ? 'image-to-video' : 'text-to-video',
      'video',
      reviewedRegistration,
    );`,
    },
    {
      path: 'src/app/api/generate/edit/route.ts',
      destructure: '      negativePrompt,\n      apiKey,',
      destructureNext: '      negativePrompt,\n      reviewedRegistration,\n      apiKey,',
      call: `      mask ? 'inpaint' : 'edit',
      'edit',
    );`,
      callNext: `      mask ? 'inpaint' : 'edit',
      'edit',
      reviewedRegistration,
    );`,
    },
    {
      path: 'src/app/api/generate/upscale/route.ts',
      destructure: '      negativePrompt,\n      apiKey,',
      destructureNext: '      negativePrompt,\n      reviewedRegistration,\n      apiKey,',
      call: "    requireModelOperation(provider.name, modelId, 'upscale', 'upscale');",
      callNext: "    requireModelOperation(provider.name, modelId, 'upscale', 'upscale', reviewedRegistration);",
    },
    {
      path: 'src/app/api/generate/variations/route.ts',
      destructure: '      negativePrompt,\n      apiKey,',
      destructureNext: '      negativePrompt,\n      reviewedRegistration,\n      apiKey,',
      call: "    requireModelOperation(provider.name, modelId, 'variation', 'variations');",
      callNext: "    requireModelOperation(provider.name, modelId, 'variation', 'variations', reviewedRegistration);",
    },
    {
      path: 'src/app/api/generate/img2vid/route.ts',
      destructure: '      prompt,\n      apiKey,',
      destructureNext: '      prompt,\n      reviewedRegistration,\n      apiKey,',
      call: `      'image-to-video',
      'img2vid',
    );`,
      callNext: `      'image-to-video',
      'img2vid',
      reviewedRegistration,
    );`,
    },
  ];

  for (const route of routes) {
    const filePath = path.join(root, route.path);
    let source = await fs.readFile(filePath, 'utf8');
    source = replaceRequired(source, route.destructure, route.destructureNext, `${route.path} registration destructure`);
    source = replaceRequired(source, route.call, route.callNext, `${route.path} registry enforcement`);
    await fs.writeFile(filePath, source, 'utf8');
  }
}

async function patchGenerationClient() {
  const filePath = path.join(root, 'src/lib/generation-client.ts');
  let source = await fs.readFile(filePath, 'utf8');
  source = replaceRequired(
    source,
    `import {
  createGenerationStatusCoordinator,
  type GenerationStatusRequest,
} from '@/lib/generation-poller';
`,
    `import {
  createGenerationStatusCoordinator,
  type GenerationStatusRequest,
} from '@/lib/generation-poller';
import {
  decorateProviderCatalogWithApprovedRegistrations,
  findApprovedModelRegistration,
  resolveGenerationRequestRegistrationContext,
} from '@/lib/model-registration-client';
`,
    'generation client registration imports',
  );

  source = replaceRequired(
    source,
    `    const headers = getRequestHeaders(input, init);

    if (pathname === '/api/generate/status') {
`,
    `    const headers = getRequestHeaders(input, init);

    if (pathname === '/api/providers' && method === 'GET') {
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

    if (pathname === '/api/generate/status') {
`,
    'generation client provider catalog decoration',
  );

  source = replaceRequired(
    source,
    `        const providerId =
          asString(payload.providerId)
          || asString(payload.provider)
          || '';

        if (providerId && !asString(payload.apiKey)) {
`,
    `        const providerId =
          asString(payload.providerId)
          || asString(payload.provider)
          || '';
        const modelId = asString(payload.modelId);
        const registrationContext = resolveGenerationRequestRegistrationContext(
          pathname,
          payload,
        );

        if (
          providerId
          && modelId
          && registrationContext
          && !isRecord(payload.reviewedRegistration)
        ) {
          const registration = await findApprovedModelRegistration({
            providerId,
            modelId,
            ...registrationContext,
          });
          if (registration) payload.reviewedRegistration = registration;
        }

        if (providerId && !asString(payload.apiKey)) {
`,
    'generation client reviewed registration injection',
  );
  await fs.writeFile(filePath, source, 'utf8');
}

async function patchSettings() {
  const storePath = path.join(root, 'src/lib/store.ts');
  let store = await fs.readFile(storePath, 'utf8');
  store = store.replaceAll(
    "'providers' | 'models' | 'transfer'",
    "'providers' | 'models' | 'review' | 'transfer'",
  );
  await fs.writeFile(storePath, store, 'utf8');

  const filePath = path.join(root, 'src/components/studio/settings.tsx');
  let source = await fs.readFile(filePath, 'utf8');
  source = replaceRequired(
    source,
    "import { useApiKeys } from '@/hooks/use-api-keys';\n",
    "import { useApiKeys } from '@/hooks/use-api-keys';\nimport { ModelRegistrationReview } from '@/components/studio/model-registration-review';\n",
    'Settings review component import',
  );
  source = source.replaceAll('Add Custom Model', 'Add Model Candidate');
  source = replaceRequired(
    source,
    'Add a new model to a provider. Make sure the model ID matches the API identifier.',
    'Save a non-executable model candidate. It must pass the Registration Review workflow before it can appear in generation selectors.',
    'custom model candidate description',
  );
  source = replaceRequired(
    source,
    'toast.success(`Model "${formName}" added successfully`);',
    'toast.success(`Model candidate "${formName}" saved for review`);',
    'custom model candidate toast',
  );
  source = replaceRequired(
    source,
    '                Add Model\n',
    '                Save Candidate\n',
    'custom model candidate button',
  );
  source = replaceRequired(
    source,
    '                    Type and capabilities are auto-detected from the provider and model ID.',
    '                    Type and capabilities are candidate metadata only; executable operations are granted by reviewed adapter profiles.',
    'candidate capability explanation',
  );
  source = replaceRequired(
    source,
    `              <TabsTrigger
                value="transfer"
`,
    `              <TabsTrigger
                value="review"
                className="rounded-lg gap-2 data-[state=active]:bg-[#d9ff00]/10 data-[state=active]:text-[#d9ff00] data-[state=active]:shadow-none px-4 transition-all duration-200"
              >
                <Shield className="h-4 w-4" />
                Review
              </TabsTrigger>
              <TabsTrigger
                value="transfer"
`,
    'Settings review tab trigger',
  );
  source = replaceRequired(
    source,
    `            <TabsContent value="transfer" className="mt-6">
`,
    `            <TabsContent value="review" className="mt-6">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ModelRegistrationReview />
              </motion.div>
            </TabsContent>

            <TabsContent value="transfer" className="mt-6">
`,
    'Settings review tab content',
  );
  source = source.replaceAll(
    "v as 'providers' | 'models' | 'transfer'",
    "v as 'providers' | 'models' | 'review' | 'transfer'",
  );
  await fs.writeFile(filePath, source, 'utf8');
}

await patchIdb();
await patchBackup();
await patchRegistry();
await patchRequestSchemas();
await patchRoutes();
await patchGenerationClient();
await patchSettings();
