import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const studioPath = path.join(root, 'src/components/studio/image-studio.tsx');
const testPath = path.join(root, 'src/lib/image-studio-lifecycle.test.ts');

let source = await fs.readFile(studioPath, 'utf8');

const transportImport = "import { generationFetch as fetch } from '@/lib/generation-client';\n";
const lifecycleImport = `import {
  GenerationLifecycleError,
  startGenerationJob,
  type GenerationJobHandle,
} from '@/lib/generation-lifecycle';
`;

if (!source.includes(transportImport)) {
  throw new Error('Image Studio is missing the explicit generation transport import');
}
if (source.includes("startGenerationJob")) {
  throw new Error('Image Studio already appears to use the generation lifecycle');
}
source = source.replace(transportImport, `${transportImport}${lifecycleImport}`);

source = source.replace("import type { GenerationQueueItem } from '@/lib/store';\n", '');

const resultIdsLine = "  const [generationResultIds, setGenerationResultIds] = useState<string[]>([]);\n";
if (!source.includes(resultIdsLine)) {
  throw new Error('Could not find Image Studio result-id state');
}
source = source.replace(
  resultIdsLine,
  `${resultIdsLine}  const imageGenerationHandleRef = useRef<GenerationJobHandle | null>(null);\n  const imageGenerationOwnerRef = useRef<AbortController | null>(null);\n`,
);

for (const declaration of [
  "  const [currentJobId, setCurrentJobId] = useState<string | null>(null);\n",
  "  const generationRef = useRef<GenerationDescriptor | null>(null);\n",
  "  const queueIdRef = useRef<string | null>(null);\n",
  "  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);\n",
]) {
  if (!source.includes(declaration)) {
    throw new Error(`Could not find expected legacy declaration: ${declaration.trim()}`);
  }
  source = source.replace(declaration, '');
}

const pollingMarker = '  // Polling logic — API keys stay in the POST body, never in the URL.\n';
const generateMarker = '  // Generate handler -------------------------------------------------------\n';
const historyMarker = '    // Save to prompt history\n';
const keyboardMarker = '  // Keyboard shortcut: generate on trigger\n';

const pollingStart = source.indexOf(pollingMarker);
const generateStart = source.indexOf(generateMarker, pollingStart);
const historyStart = source.indexOf(historyMarker, generateStart);
const keyboardStart = source.indexOf(keyboardMarker, historyStart);

if ([pollingStart, generateStart, historyStart, keyboardStart].some((index) => index < 0)) {
  throw new Error('Could not locate the legacy Image Studio lifecycle block');
}

let generatePrefix = source.slice(generateStart, historyStart);

const modelGuard = `    if (!selectedImageModel) {
      toast.error('Please select a model');
      return;
    }
`;
if (!generatePrefix.includes(modelGuard)) {
  throw new Error('Could not find model guard in Image Studio generation handler');
}
generatePrefix = generatePrefix.replace(
  modelGuard,
  `${modelGuard}
    const activeHandle = imageGenerationHandleRef.current;
    if (
      activeHandle
      && ['submitting', 'processing'].includes(activeHandle.getSnapshot().state)
    ) {
      toast.info('An image generation is already in progress');
      return;
    }
`,
);

const keyGuard = `    if (!hasApiKey) {
      toast.error('No API key configured for this provider. Add one in Settings.');
      return;
    }
`;
if (!generatePrefix.includes(keyGuard)) {
  throw new Error('Could not find API-key guard in Image Studio generation handler');
}
generatePrefix = generatePrefix.replace(
  keyGuard,
  `${keyGuard}
    const owner = new AbortController();
    imageGenerationOwnerRef.current = owner;
`,
);

generatePrefix = generatePrefix.replace(
  "          body: JSON.stringify({ prompt: basePrompt, type: 'enhance' }),\n",
  "          body: JSON.stringify({ prompt: basePrompt, type: 'enhance' }),\n          signal: owner.signal,\n",
);

generatePrefix = generatePrefix.replace(
  `      } catch {
        // If enhancement fails, proceed with original prompt
        toast.info('Auto-enhance failed, using original prompt');
      }
`,
  `      } catch {
        if (owner.signal.aborted) return;
        // If enhancement fails, proceed with original prompt
        toast.info('Auto-enhance failed, using original prompt');
      }
`,
);

const newTail = `    // Save to prompt history
    addPromptToHistory(currentPrompt.trim());

    // Save the final prompt for the Copy Prompt button
    setLastGeneratedPrompt(finalPrompt);

    setIsImageGenerating(true);
    setLatestResult(null);
    setGenerationResults([]);
    setSelectedResultIndex(0);
    setGenerationDuration(null);

    const generationStartTime = Date.now();
    const generationId = createGenerationId('img');
    const dimensions = RESOLUTION_MAP[currentAspectRatio]?.[currentResolutionTier]
      ?? RESOLUTION_MAP['1:1']['hd'];
    const generation: GenerationDescriptor = {
      id: generationId,
      providerId: selectedImageProvider,
      providerName: selectedProviderData?.displayName || selectedImageProvider,
      modelId: selectedImageModel,
      type: 'image',
      prompt: finalPrompt,
      negativePrompt: finalNegPrompt || undefined,
      inputImageUrl: currentInputImageUrl || undefined,
      width: dimensions.width,
      height: dimensions.height,
      params: {
        aspectRatio: currentAspectRatio,
        resolutionTier: currentResolutionTier,
        quality: currentQuality,
        format: currentFormat,
        steps: currentSteps,
        guidance: currentGuidance,
        seed: currentSeed,
        batchSize: currentBatchSize,
        strength: currentStrength,
        sampler: currentSampler,
      },
      createdAt: generationStartTime,
    };
    setGenerationResultIds([]);

    const computedSize = \\`${'${dimensions.width}'}x${'${dimensions.height}'}\\`;
    const isSDProvider = [
      'stability',
      'replicate',
      'fal',
      'together',
      'fireworks',
      'huggingface',
    ].includes(selectedImageProvider);

    const body: Record<string, unknown> = {
      providerId: selectedImageProvider,
      modelId: selectedImageModel,
      prompt: finalPrompt,
      negativePrompt: finalNegPrompt || undefined,
      aspectRatio: currentAspectRatio,
      quality: currentQuality,
      size: computedSize,
      width: dimensions.width,
      height: dimensions.height,
      output_format: currentFormat !== 'png' ? currentFormat : undefined,
      steps: currentSteps,
      guidance: currentGuidance,
      seed: currentSeed ?? undefined,
      batchSize: currentBatchSize,
      inputImageUrl: currentInputImageUrl || undefined,
      strength: currentInputImageUrl ? currentStrength : undefined,
      sampler: isSDProvider ? currentSampler : undefined,
      magicPrompt: selectedImageProvider === 'ideogram' ? currentMagicPrompt : undefined,
      styleType:
        selectedImageProvider === 'ideogram'
        || (selectedImageProvider === 'openai' && selectedImageModel === 'dall-e-3')
          ? currentStyleType
          : undefined,
      renderingSpeed:
        selectedImageProvider === 'ideogram' ? currentRenderingSpeed : undefined,
      clipGuidance:
        selectedImageProvider === 'stability' ? currentClipGuidance : undefined,
      tileable:
        selectedImageProvider === 'stability' && currentTileable ? true : undefined,
      photoReal:
        selectedImageProvider === 'leonardo' && currentPhotoReal ? true : undefined,
      alchemy:
        selectedImageProvider === 'leonardo' && currentAlchemy ? true : undefined,
      safetyFilter: !currentSafetyFilter ? false : undefined,
      scheduler: isSDProvider ? currentScheduler : undefined,
      clipSkip: isSDProvider && currentClipSkip > 1 ? currentClipSkip : undefined,
      lighting: currentLighting !== 'none' ? currentLighting : undefined,
      colorMood: currentColorMood !== 'none' ? currentColorMood : undefined,
      cameraShot: currentCameraShot !== 'none' ? currentCameraShot : undefined,
      hiresFix: isSDProvider && currentHiresFix ? true : undefined,
      hiresScale:
        isSDProvider && currentHiresFix ? currentHiresScale : undefined,
      hiresSteps:
        isSDProvider && currentHiresFix ? currentHiresSteps : undefined,
      hiresDenoise:
        isSDProvider && currentHiresFix ? currentHiresDenoise : undefined,
      outfitImageUrl: currentOutfitImageUrl || undefined,
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
          prompt: currentPrompt.trim(),
          providerName:
            selectedProviderData?.displayName || selectedImageProvider,
          providerColor: selectedProviderData?.color || '#888',
          modelName:
            imageModels.find((model) => model.modelId === selectedImageModel)?.name
            || selectedImageModel,
        },
      },
      signal: owner.signal,
      pollPolicy: {
        maxElapsedMs: 30 * 60 * 1000,
        maxConsecutiveErrors: 6,
      },
    });
    imageGenerationHandleRef.current = handle;

    let processingNotified = false;
    const unsubscribe = handle.subscribe((snapshot) => {
      if (
        !owner.signal.aborted
        && snapshot.state === 'processing'
        && !processingNotified
      ) {
        processingNotified = true;
        toast.info('Generation in progress…');
      }
    });

    try {
      const result = await handle.result;
      if (owner.signal.aborted) return;

      setLatestResult(result.urls[0] || null);
      setGenerationResults(result.urls);
      setGenerationResultIds(result.generationIds);
      setSelectedResultIndex(0);
      setGenerationDuration(result.durationMs / 1000);
      toast.success(
        result.urls.length > 1
          ? \\`${'${result.urls.length}'} images generated successfully!\\`
          : 'Image generated successfully!',
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
      if (imageGenerationHandleRef.current === handle) {
        imageGenerationHandleRef.current = null;
      }
      if (imageGenerationOwnerRef.current === owner) {
        imageGenerationOwnerRef.current = null;
      }
      if (!owner.signal.aborted) setIsImageGenerating(false);
    }
  }, [
    selectedImageProvider,
    selectedImageModel,
    hasApiKey,
    activeStylePreset,
    selectedProviderData,
    imageModels,
    setIsImageGenerating,
    setLatestResult,
    setGenerationResults,
    setSelectedResultIndex,
    setGenerationDuration,
    addPromptToHistory,
    addToQueue,
    updateQueueItem,
  ]);

  const handleCancelImageGeneration = useCallback(async () => {
    const handle = imageGenerationHandleRef.current;
    const owner = imageGenerationOwnerRef.current;

    if (handle) {
      await handle.cancel('Image generation cancelled by user');
    } else {
      owner?.abort('Image generation cancelled by user');
    }

    setIsImageGenerating(false);
    setGenerationDuration(null);
    toast.info('Image generation cancelled');
  }, [setIsImageGenerating, setGenerationDuration]);

`;

const ownerCleanup = `  // Page changes detach the local lifecycle without falsely failing provider work.
  useEffect(() => {
    return () => {
      imageGenerationOwnerRef.current?.abort('Image Studio unmounted');
    };
  }, []);

`;

source = `${source.slice(0, pollingStart)}${ownerCleanup}${generatePrefix}${newTail}${source.slice(keyboardStart)}`;

const elapsedMarker = `                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/50">
                    <Clock className="h-3 w-3" />
                    <span>{genElapsed}s elapsed</span>
                  </div>
`;
if (!source.includes(elapsedMarker)) {
  throw new Error('Could not locate the Image Studio loading timer');
}
source = source.replace(
  elapsedMarker,
  `${elapsedMarker}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCancelImageGeneration}
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
]) {
  if (source.includes(legacyIdentifier)) {
    throw new Error(`Legacy Image Studio lifecycle identifier remains: ${legacyIdentifier}`);
  }
}

await fs.writeFile(studioPath, source, 'utf8');

const testContent = `/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const studioPath = path.join(
  process.cwd(),
  'src/components/studio/image-studio.tsx',
);

describe('Image Studio generation lifecycle', () => {
  test('uses lifecycle handles instead of a component-owned polling loop', async () => {
    const source = await readFile(studioPath, 'utf8');

    expect(source).toContain('startGenerationJob({');
    expect(source).toContain('handleCancelImageGeneration');
    expect(source).toContain("signal: owner.signal");
    expect(source).not.toContain('const startPolling =');
    expect(source).not.toContain('setCurrentJobId');
    expect(source).not.toContain('generationRef');
    expect(source).not.toContain('queueIdRef');
    expect(source).not.toContain('const queueItem: GenerationQueueItem');
  });
});
`;
await fs.writeFile(testPath, testContent, 'utf8');

console.log('Migrated Image Studio to the typed generation lifecycle.');
