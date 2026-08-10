import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const studioPath = path.join(root, 'src/components/studio/cinema-studio.tsx');
const testPath = path.join(root, 'src/lib/cinema-studio-lifecycle.test.ts');

let source = await fs.readFile(studioPath, 'utf8');

const transportImport = "import { generationFetch as fetch } from '@/lib/generation-client';\n";
const lifecycleImport = `import {
  GenerationLifecycleError,
  startGenerationJob,
  type GenerationJobHandle,
} from '@/lib/generation-lifecycle';
`;
const legacyPersistenceImport = "import { beginGeneration, completeGeneration, failGeneration, markGenerationProcessing, type GenerationDescriptor } from '@/lib/generation-persistence';\n";
const lifecyclePersistenceImport = "import { createGenerationId, type GenerationDescriptor } from '@/lib/generation-persistence';\n";
const queueTypeImport = "import type { GenerationQueueItem } from '@/lib/store';\n";

if (!source.includes(transportImport)) {
  throw new Error('Cinema Studio is missing the explicit generation transport import');
}
if (source.includes(lifecycleImport)) {
  throw new Error('Cinema Studio lifecycle migration has already been applied');
}
if (!source.includes(legacyPersistenceImport)) {
  throw new Error('Cinema Studio legacy persistence import was not found');
}

source = source.replace(
  transportImport,
  `${transportImport}${lifecycleImport}\n`,
);
source = source.replace(legacyPersistenceImport, lifecyclePersistenceImport);
source = source.replace(queueTypeImport, '');

const legacyState = `  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [latestGenerationId, setLatestGenerationId] = useState<string | null>(null);
  const generationRef = useRef<GenerationDescriptor | null>(null);
`;
const lifecycleState = `  const [latestGenerationId, setLatestGenerationId] = useState<string | null>(null);
  const cinemaGenerationHandleRef = useRef<GenerationJobHandle | null>(null);
  const cinemaGenerationOwnerRef = useRef<AbortController | null>(null);
`;
if (!source.includes(legacyState)) {
  throw new Error('Cinema Studio legacy job state was not found');
}
source = source.replace(legacyState, lifecycleState);
source = source.replace(
  "  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);\n",
  '',
);
source = source.replace(
  "  const queueIdRef = useRef<string | null>(null);\n",
  '',
);

const pollingStart = source.indexOf(
  '  // Polling logic — API keys stay in the POST body, never in the URL.\n',
);
const loadingStart = source.indexOf(
  '  // Loading state: start timer & rotate messages\n',
  pollingStart,
);
if (pollingStart < 0 || loadingStart < 0) {
  throw new Error('Could not locate Cinema Studio polling block');
}

const ownerCleanup = `  // Page changes detach local ownership without falsely failing provider work.
  useEffect(() => {
    return () => {
      cinemaGenerationOwnerRef.current?.abort('Cinema Studio unmounted');
    };
  }, []);

`;
source = `${source.slice(0, pollingStart)}${ownerCleanup}${source.slice(loadingStart)}`;

const generateStart = source.indexOf('  // Generate handler\n');
const keyboardStart = source.indexOf(
  '  // Keyboard shortcut: generate on trigger\n',
  generateStart,
);
if (generateStart < 0 || keyboardStart < 0) {
  throw new Error('Could not locate Cinema Studio generation handler');
}

const lifecycleHandler = `  // Generate handler
  const handleGenerate = useCallback(async () => {
    if (!selectedProvider) {
      toast.error('Please select a provider');
      return;
    }
    if (!selectedModel) {
      toast.error('Please select a model');
      return;
    }
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }
    if (!hasApiKey) {
      toast.error('No API key configured for this provider. Add one in Settings.');
      return;
    }

    const activeHandle = cinemaGenerationHandleRef.current;
    if (
      activeHandle
      && ['submitting', 'processing'].includes(activeHandle.getSnapshot().state)
    ) {
      toast.info('A cinema generation is already in progress');
      return;
    }

    const owner = new AbortController();
    cinemaGenerationOwnerRef.current = owner;

    // buildCinemaSuffix already includes the active scene preset. Appending it
    // again here previously duplicated the scene direction in provider prompts.
    const finalPrompt = cinemaSuffix.length > 0
      ? prompt.trim() + ', ' + cinemaSuffix
      : prompt.trim();

    setIsCinemaGenerating(true);
    setLatestResult(null);
    setLatestGenerationId(null);
    setShowGenInfo(true);

    const generationStartTime = Date.now();
    const generation: GenerationDescriptor = {
      id: createGenerationId('cin'),
      providerId: selectedProvider,
      providerName: selectedProviderData?.displayName || selectedProvider,
      modelId: selectedModel,
      type: 'image',
      prompt: finalPrompt,
      negativePrompt: negativePrompt.trim() || undefined,
      params: {
        aspectRatio,
        batchSize,
        camera: cinemaCamera,
        lens: cinemaLens,
        focalLength: cinemaFocalLength,
        aperture: cinemaAperture,
        filmStock: cinemaFilmStock,
        colorGrade: cinemaColorGrade,
        lighting: cinemaLighting,
        scenePreset: cinemaScenePreset,
      },
      createdAt: generationStartTime,
    };

    const body: Record<string, unknown> = {
      providerId: selectedProvider,
      modelId: selectedModel,
      prompt: finalPrompt,
      negativePrompt: negativePrompt.trim() || undefined,
      aspectRatio,
      batchSize,
    };

    const handle = startGenerationJob({
      descriptor: generation,
      endpoint: '/api/generate/image',
      body,
      queue: {
        port: {
          add: addToQueue,
          update: updateQueueItem,
        },
        metadata: {
          prompt: prompt.trim(),
          providerName: selectedProviderData?.displayName || selectedProvider,
          providerColor: selectedProviderData?.color || '#F59E0B',
          modelName:
            imageModels.find((model) => model.modelId === selectedModel)?.name
            || selectedModel,
        },
      },
      signal: owner.signal,
      pollPolicy: {
        maxElapsedMs: 30 * 60 * 1000,
        maxConsecutiveErrors: 6,
      },
    });
    cinemaGenerationHandleRef.current = handle;

    let processingNotified = false;
    const unsubscribe = handle.subscribe((snapshot) => {
      if (
        !owner.signal.aborted
        && snapshot.state === 'processing'
        && !processingNotified
      ) {
        processingNotified = true;
        toast.info('Cinema generation in progress…');
      }
    });

    try {
      const result = await handle.result;
      if (owner.signal.aborted) return;

      setLatestResult(result.urls[0] || null);
      setLatestGenerationId(result.generationIds[0] || null);
      setShowGenInfo(true);
      toast.success(
        result.urls.length > 1
          ? String(result.urls.length) + ' cinematic images generated successfully!'
          : 'Cinematic image generated successfully!',
      );
    } catch (error) {
      if (owner.signal.aborted) return;
      if (
        error instanceof GenerationLifecycleError
        && (error.code === 'detached' || error.code === 'cancelled')
      ) {
        return;
      }
      toast.error(error instanceof Error ? error.message : 'Generation failed');
    } finally {
      unsubscribe();
      if (cinemaGenerationHandleRef.current === handle) {
        cinemaGenerationHandleRef.current = null;
      }
      if (cinemaGenerationOwnerRef.current === owner) {
        cinemaGenerationOwnerRef.current = null;
      }
      if (!owner.signal.aborted) setIsCinemaGenerating(false);
    }
  }, [
    selectedProvider,
    selectedModel,
    prompt,
    negativePrompt,
    aspectRatio,
    batchSize,
    hasApiKey,
    cinemaSuffix,
    cinemaCamera,
    cinemaLens,
    cinemaFocalLength,
    cinemaAperture,
    cinemaFilmStock,
    cinemaColorGrade,
    cinemaLighting,
    cinemaScenePreset,
    selectedProviderData,
    imageModels,
    setIsCinemaGenerating,
    setLatestResult,
    addToQueue,
    updateQueueItem,
  ]);

  const handleCancelCinemaGeneration = useCallback(async () => {
    const handle = cinemaGenerationHandleRef.current;
    const owner = cinemaGenerationOwnerRef.current;

    if (handle) {
      await handle.cancel('Cinema generation cancelled by user');
    } else {
      owner?.abort('Cinema generation cancelled by user');
    }

    setIsCinemaGenerating(false);
    toast.info('Cinema generation cancelled');
  }, [setIsCinemaGenerating]);

`;
source = `${source.slice(0, generateStart)}${lifecycleHandler}${source.slice(keyboardStart)}`;

const elapsedMarker = `                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/50">
                    <Clock className="h-3 w-3" />
                    <span>{genElapsed}s elapsed</span>
                  </div>
`;
if (!source.includes(elapsedMarker)) {
  throw new Error('Could not locate the Cinema Studio loading timer');
}
source = source.replace(
  elapsedMarker,
  `${elapsedMarker}
                  <p className="text-[10px] text-muted-foreground/60">
                    The job remains recoverable if you navigate away or restart the local app.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCancelCinemaGeneration}
                    className="border-border/60 bg-surface/80 text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="mr-1.5 h-3.5 w-3.5" />
                    Cancel generation
                  </Button>
`,
);

for (const legacyIdentifier of [
  'const startPolling =',
  'setCurrentJobId',
  'generationRef',
  'queueIdRef',
  'pollRef',
  'const queueItem: GenerationQueueItem',
  'freshScenePreset',
  'sceneSuffix',
]) {
  if (source.includes(legacyIdentifier)) {
    throw new Error(`Legacy Cinema Studio lifecycle identifier remains: ${legacyIdentifier}`);
  }
}

const testSource = `/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const studioPath = path.join(
  process.cwd(),
  'src/components/studio/cinema-studio.tsx',
);

describe('Cinema Studio generation lifecycle', () => {
  test('uses lifecycle handles instead of component-owned polling', async () => {
    const source = await readFile(studioPath, 'utf8');

    expect(source).toContain('startGenerationJob({');
    expect(source).toContain('handleCancelCinemaGeneration');
    expect(source).toContain('signal: owner.signal');
    expect(source).not.toContain('const startPolling =');
    expect(source).not.toContain('setCurrentJobId');
    expect(source).not.toContain('generationRef');
    expect(source).not.toContain('queueIdRef');
    expect(source).not.toContain('const queueItem: GenerationQueueItem');
  });

  test('does not append the scene preset twice', async () => {
    const source = await readFile(studioPath, 'utf8');

    expect(source).toContain('buildCinemaSuffix(');
    expect(source).not.toContain('freshScenePreset');
    expect(source).not.toContain('sceneSuffix');
    expect(source).toContain("prompt.trim() + ', ' + cinemaSuffix");
  });
});
`;

await fs.writeFile(studioPath, source, 'utf8');
await fs.writeFile(testPath, testSource, 'utf8');
