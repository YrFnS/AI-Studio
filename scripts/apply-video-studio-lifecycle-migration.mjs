import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const studioPath = path.join(root, 'src/components/studio/video-studio.tsx');
const testPath = path.join(root, 'src/lib/video-studio-lifecycle.test.ts');

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

if (!source.includes(transportImport)) {
  throw new Error('Video Studio is missing the explicit generation transport import');
}
if (!source.includes(lifecycleImport)) {
  source = source.replace(transportImport, `${transportImport}${lifecycleImport}`);
}
if (!source.includes(legacyPersistenceImport)) {
  throw new Error('Video Studio persistence import no longer matches the expected legacy source');
}
source = source.replace(legacyPersistenceImport, lifecyclePersistenceImport);
source = source.replace("import type { GenerationQueueItem } from '@/lib/store';\n", '');

source = source.replace("  const [currentJobId, setCurrentJobId] = useState<string | null>(null);\n", '');
source = source.replace(
  "  const generationRef = useRef<GenerationDescriptor | null>(null);\n",
  "  const videoGenerationHandleRef = useRef<GenerationJobHandle | null>(null);\n  const videoGenerationOwnerRef = useRef<AbortController | null>(null);\n",
);
source = source.replace("  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);\n", '');
source = source.replace("  const queueIdRef = useRef<string | null>(null);\n", '');

const pollingStart = source.indexOf('  // Polling logic — API keys stay in the POST body, never in the URL.');
const autoHideStart = source.indexOf('  // Auto-hide generation info card after 5 seconds', pollingStart);
if (pollingStart < 0 || autoHideStart < 0) {
  throw new Error('Could not locate the legacy Video Studio polling section');
}

const ownerCleanup = `  // Page changes detach local ownership without falsely failing provider work.
  useEffect(() => {
    return () => {
      videoGenerationOwnerRef.current?.abort('Video Studio unmounted');
    };
  }, []);

`;
source = `${source.slice(0, pollingStart)}${ownerCleanup}${source.slice(autoHideStart)}`;

const validationMarker = `    if (!apiKeysHook.hasKey(state.selectedVideoProvider)) {
      toast.error('No API key configured for this provider. Add one in Settings.');
      return;
    }

    setIsVideoGenerating(true);
`;
const validationReplacement = `    if (!apiKeysHook.hasKey(state.selectedVideoProvider)) {
      toast.error('No API key configured for this provider. Add one in Settings.');
      return;
    }

    const activeHandle = videoGenerationHandleRef.current;
    if (
      activeHandle
      && ['submitting', 'processing'].includes(activeHandle.getSnapshot().state)
    ) {
      toast.info('A video generation is already in progress');
      return;
    }

    const owner = new AbortController();
    videoGenerationOwnerRef.current = owner;

    setIsVideoGenerating(true);
`;
if (!source.includes(validationMarker)) {
  throw new Error('Could not locate the Video Studio validation boundary');
}
source = source.replace(validationMarker, validationReplacement);
source = source.replace('    setCurrentJobId(null);\n', '');

const queueStart = source.indexOf('    // Add to generation queue');
const keyboardStart = source.indexOf('  // Keyboard shortcut: generate on trigger', queueStart);
if (queueStart < 0 || keyboardStart < 0) {
  throw new Error('Could not locate the Video Studio generation lifecycle boundaries');
}

const newTail = `    const generationStartTime = Date.now();
    const generationId = createGenerationId('vid');
    const generation: GenerationDescriptor = {
      id: generationId,
      providerId: state.selectedVideoProvider,
      providerName: provData?.displayName || state.selectedVideoProvider,
      modelId: state.selectedVideoModel,
      type: 'video',
      prompt: enhancedPrompt,
      inputImageUrl: referenceImageUrl || state.videoStartFrameUrl || undefined,
      duration: state.videoDuration,
      params: {
        aspectRatio: state.videoAspectRatio,
        style: state.videoStyle,
        cameraMotion: state.videoCameraMotion,
        mood: state.videoMood,
        startFrameUrl: state.videoStartFrameUrl || undefined,
        endFrameUrl: state.videoEndFrameUrl || undefined,
      },
      createdAt: generationStartTime,
    };
    setLatestGenerationId(null);

    const body: Record<string, unknown> = {
      providerId: state.selectedVideoProvider,
      modelId: state.selectedVideoModel,
      prompt: enhancedPrompt,
      duration: state.videoDuration,
      aspectRatio: state.videoAspectRatio,
      imageUrl: referenceImageUrl || undefined,
      startFrameUrl: state.videoStartFrameUrl || undefined,
      endFrameUrl: state.videoEndFrameUrl || undefined,
    };

    const handle = startGenerationJob({
      descriptor: generation,
      endpoint: '/api/generate/video',
      body,
      queue: {
        port: {
          add: addToQueue,
          update: updateQueueItem,
        },
        metadata: {
          prompt: enhancedPrompt,
          providerName: provData?.displayName || state.selectedVideoProvider,
          providerColor: provData?.color || '#888',
          modelName:
            vModels.find((model) => model.modelId === state.selectedVideoModel)?.name
            || state.selectedVideoModel,
        },
      },
      signal: owner.signal,
      pollPolicy: {
        maxElapsedMs: 45 * 60 * 1000,
        maxConsecutiveErrors: 6,
      },
    });
    videoGenerationHandleRef.current = handle;

    let processingNotified = false;
    const unsubscribe = handle.subscribe((snapshot) => {
      if (
        !owner.signal.aborted
        && snapshot.state === 'processing'
        && !processingNotified
      ) {
        processingNotified = true;
        toast.info('Video generation in progress… This may take a few minutes.');
      }
    });

    try {
      const result = await handle.result;
      if (owner.signal.aborted) return;

      setLatestResult(result.urls[0] || null);
      setLatestGenerationId(result.generationIds[0] || null);
      setIsPlaying(false);
      setVideoProgress(0);
      setShowGenInfo(true);
      toast.success('Video generated successfully!');
    } catch (error) {
      if (owner.signal.aborted) return;
      if (
        error instanceof GenerationLifecycleError
        && (error.code === 'detached' || error.code === 'cancelled')
      ) {
        return;
      }
      toast.error(error instanceof Error ? error.message : 'Video generation failed');
    } finally {
      unsubscribe();
      if (videoGenerationHandleRef.current === handle) {
        videoGenerationHandleRef.current = null;
      }
      if (videoGenerationOwnerRef.current === owner) {
        videoGenerationOwnerRef.current = null;
      }
      if (!owner.signal.aborted) setIsVideoGenerating(false);
    }
  }, [
    providers,
    referenceImageUrl,
    apiKeysHook,
    setIsVideoGenerating,
    setLatestResult,
    addToQueue,
    updateQueueItem,
  ]);

  const handleCancelVideoGeneration = useCallback(async () => {
    const handle = videoGenerationHandleRef.current;
    const owner = videoGenerationOwnerRef.current;

    if (handle) {
      await handle.cancel('Video generation cancelled by user');
    } else {
      owner?.abort('Video generation cancelled by user');
    }

    setIsVideoGenerating(false);
    toast.info('Video generation cancelled');
  }, [setIsVideoGenerating]);

`;
source = `${source.slice(0, queueStart)}${newTail}${source.slice(keyboardStart)}`;

const pollingLabel = `                <p className="text-[10px] text-muted-foreground/60">
                  Polling for results every 5 seconds…
                </p>
`;
if (!source.includes(pollingLabel)) {
  throw new Error('Could not locate the Video Studio loading status label');
}
source = source.replace(
  pollingLabel,
  `                <p className="text-[10px] text-muted-foreground/60">
                  The job remains recoverable if you navigate away or restart the local app.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancelVideoGeneration}
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
  'await beginGeneration(generation)',
  'await markGenerationProcessing(generation',
]) {
  if (source.includes(legacyIdentifier)) {
    throw new Error(`Legacy Video Studio lifecycle identifier remains: ${legacyIdentifier}`);
  }
}

await fs.writeFile(studioPath, source, 'utf8');

const testSource = `/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const studioPath = path.join(
  process.cwd(),
  'src/components/studio/video-studio.tsx',
);

describe('Video Studio generation lifecycle', () => {
  test('uses lifecycle handles instead of a component-owned polling loop', async () => {
    const source = await readFile(studioPath, 'utf8');

    expect(source).toContain('startGenerationJob({');
    expect(source).toContain('handleCancelVideoGeneration');
    expect(source).toContain('signal: owner.signal');
    expect(source).not.toContain('const startPolling =');
    expect(source).not.toContain('setCurrentJobId');
    expect(source).not.toContain('generationRef');
    expect(source).not.toContain('queueIdRef');
    expect(source).not.toContain('const queueItem: GenerationQueueItem');
  });
});
`;
await fs.writeFile(testPath, testSource, 'utf8');

console.log('Migrated Video Studio primary generation to typed lifecycle handles.');
