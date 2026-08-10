import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function replaceRequired(source, oldValue, newValue, label) {
  if (!source.includes(oldValue)) {
    throw new Error(`Could not locate ${label}`);
  }
  return source.replace(oldValue, newValue);
}

function spliceRequired(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Could not locate ${label}`);
  }
  return source.slice(0, start) + replacement + source.slice(end);
}

async function updateLifecycle() {
  const filePath = path.join(root, 'src/lib/generation-lifecycle.ts');
  let source = await fs.readFile(filePath, 'utf8');
  source = replaceRequired(
    source,
    `function normalizeUrls(payload: Record<string, unknown>): string[] {
  const urls = Array.isArray(payload.urls)
    ? payload.urls.filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      )
    : [];

  const resultUrl = asString(payload.resultUrl);
  if (urls.length === 0 && resultUrl) urls.push(resultUrl);
  return urls;
}
`,
    `function normalizeUrls(payload: Record<string, unknown>): string[] {
  const urls = Array.isArray(payload.urls)
    ? payload.urls.filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      )
    : [];
  const images = Array.isArray(payload.images)
    ? payload.images.filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      )
    : [];

  if (urls.length === 0 && images.length > 0) urls.push(...images);
  const resultUrl = asString(payload.resultUrl);
  if (urls.length === 0 && resultUrl) urls.push(resultUrl);
  return urls;
}
`,
    'generation lifecycle URL normalization',
  );
  await fs.writeFile(filePath, source, 'utf8');
}

async function updateImageStudio() {
  const filePath = path.join(root, 'src/components/studio/image-studio.tsx');
  let source = await fs.readFile(filePath, 'utf8');

  source = replaceRequired(
    source,
    `import {
  GenerationLifecycleError,
  startGenerationJob,
  type GenerationJobHandle,
} from '@/lib/generation-lifecycle';
`,
    `import {
  GenerationLifecycleError,
  startGenerationJob,
  type GenerationJobHandle,
} from '@/lib/generation-lifecycle';
import { prepareGenerationOperation } from '@/lib/generation-operation';
`,
    'Image Studio lifecycle import',
  );
  source = replaceRequired(
    source,
    "import { beginGeneration, completeGeneration, createGenerationId, failGeneration, markGenerationProcessing, type GenerationDescriptor } from '@/lib/generation-persistence';\n",
    "import { createGenerationId, type GenerationDescriptor } from '@/lib/generation-persistence';\n",
    'Image Studio persistence import',
  );
  source = replaceRequired(
    source,
    `  const postGenPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const postGenPollCountRef = useRef(0);
`,
    `  const postGenHandleRef = useRef<GenerationJobHandle | null>(null);
  const postGenOwnerRef = useRef<AbortController | null>(null);
`,
    'Image Studio post-generation refs',
  );
  source = replaceRequired(
    source,
    `  useEffect(() => {
    return () => {
      imageGenerationOwnerRef.current?.abort('Image Studio unmounted');
    };
  }, []);
`,
    `  useEffect(() => {
    return () => {
      imageGenerationOwnerRef.current?.abort('Image Studio unmounted');
      postGenOwnerRef.current?.abort('Post-generation action detached');
    };
  }, []);
`,
    'Image Studio lifecycle cleanup',
  );

  const newPostGenerationBlock = `  const handlePostGenAction = useCallback(async (
    action: 'upscale' | 'variation' | 'improve' | 'img2vid',
  ) => {
    if (!activeImageUrl) {
      toast.error('No image to process');
      return;
    }

    const activeHandle = postGenHandleRef.current;
    if (
      activeHandle
      && ['submitting', 'processing'].includes(activeHandle.getSnapshot().state)
    ) {
      toast.info('A post-generation action is already in progress');
      return;
    }

    const prepared = (() => {
      try {
        return prepareGenerationOperation({
          operation: action,
          providers,
          configuredProviderIds: apiKeysHook.configuredProviderIds,
          preferredProviderId: selectedImageProvider,
          preferredModelId: selectedImageModel,
          sourceImageUrl: activeImageUrl,
          parentGenerationId:
            generationResultIds[selectedResultIndex] || generationResultIds[0],
          prompt: action === 'improve'
            ? 'Enhanced, improved quality, better details, higher resolution version of: ' + imagePrompt
            : imagePrompt || undefined,
          negativePrompt: action === 'improve'
            ? 'low quality, blurry, distorted, deformed, bad anatomy'
            : imageNegativePrompt || undefined,
          duration: 5,
          aspectRatio: imageAspectRatio,
          allowProviderFallback: true,
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : action + ' is unavailable');
        return null;
      }
    })();
    if (!prepared) return;

    if (
      prepared.target.providerId !== selectedImageProvider
      || prepared.target.modelId !== selectedImageModel
    ) {
      toast.info(
        'Using ' + prepared.target.providerName + ' · ' + prepared.target.modelName + ' for this action.',
      );
    }

    const owner = new AbortController();
    postGenOwnerRef.current = owner;
    setPostGenAction(action);
    setIsPostGenProcessing(true);
    setPostGenResult(null);

    const handle = startGenerationJob({
      descriptor: prepared.descriptor,
      endpoint: prepared.endpoint,
      body: prepared.body,
      queue: {
        port: {
          add: addToQueue,
          update: updateQueueItem,
        },
        metadata: {
          prompt: prepared.descriptor.prompt,
          providerName: prepared.target.providerName,
          providerColor: prepared.target.providerColor,
          modelName: prepared.target.modelName,
        },
      },
      signal: owner.signal,
      pollPolicy: {
        maxElapsedMs: action === 'img2vid' ? 45 * 60 * 1000 : 30 * 60 * 1000,
        maxConsecutiveErrors: 6,
      },
    });
    postGenHandleRef.current = handle;

    let processingNotified = false;
    const unsubscribe = handle.subscribe((snapshot) => {
      if (
        !owner.signal.aborted
        && snapshot.state === 'processing'
        && !processingNotified
      ) {
        processingNotified = true;
        toast.info(prepared.processingMessage);
      }
    });

    try {
      const result = await handle.result;
      if (owner.signal.aborted) return;

      const resultUrl = result.urls[0];
      if (!resultUrl) throw new Error('Provider completed without returning a result');
      setPostGenResult(resultUrl);

      if (prepared.target.type === 'image') {
        setLatestResult(resultUrl);
        setGenerationResults(result.urls);
        setGenerationResultIds(result.generationIds);
        setSelectedResultIndex(0);
      }
      toast.success(prepared.successMessage);
    } catch (error) {
      if (owner.signal.aborted) return;
      if (
        error instanceof GenerationLifecycleError
        && (error.code === 'detached' || error.code === 'cancelled')
      ) {
        return;
      }
      toast.error(error instanceof Error ? error.message : action + ' failed');
    } finally {
      unsubscribe();
      if (postGenHandleRef.current === handle) postGenHandleRef.current = null;
      if (postGenOwnerRef.current === owner) postGenOwnerRef.current = null;
      if (!owner.signal.aborted) {
        setIsPostGenProcessing(false);
        setPostGenAction(null);
      }
    }
  }, [
    activeImageUrl,
    providers,
    apiKeysHook.configuredProviderIds,
    selectedImageProvider,
    selectedImageModel,
    imagePrompt,
    imageNegativePrompt,
    imageAspectRatio,
    generationResultIds,
    selectedResultIndex,
    setPostGenAction,
    setIsPostGenProcessing,
    setPostGenResult,
    setLatestResult,
    setGenerationResults,
    setSelectedResultIndex,
    addToQueue,
    updateQueueItem,
  ]);

  const handleCancelPostGenAction = useCallback(async () => {
    const handle = postGenHandleRef.current;
    const owner = postGenOwnerRef.current;

    if (handle) {
      await handle.cancel('Post-generation action cancelled by user');
    } else {
      owner?.abort('Post-generation action cancelled by user');
    }

    setIsPostGenProcessing(false);
    setPostGenAction(null);
    toast.info('Post-generation action cancelled');
  }, [setIsPostGenProcessing, setPostGenAction]);

`;

  source = spliceRequired(
    source,
    "  const handlePostGenAction = useCallback(async (action: 'upscale' | 'variation' | 'improve' | 'img2vid') => {",
    '  // Generation loading: start timer & rotate messages',
    newPostGenerationBlock,
    'Image Studio post-generation lifecycle block',
  );

  source = replaceRequired(
    source,
    "                            disabled={isPostGenProcessing || !['runway', 'luma', 'fal', 'replicate', 'seedance'].includes(selectedImageProvider)}\n",
    '                            disabled={isPostGenProcessing || apiKeysHook.configuredProviderIds.length === 0}\n',
    'Image Studio image-to-video availability',
  );
  source = replaceRequired(
    source,
    `                          {['runway', 'luma', 'fal', 'replicate', 'seedance'].includes(selectedImageProvider)
                            ? 'Animate this image into a video'
                            : 'Switch to a video-capable provider (Runway, Luma, Fal, Replicate) to use this'}
`,
    `                          Uses a connected provider with a verified image-to-video model.
`,
    'Image Studio image-to-video tooltip',
  );

  const oldProcessingIndicator = `                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-2 rounded-lg bg-[#d9ff00]/5 border border-[#d9ff00]/20 px-3 py-2"
                        >
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#d9ff00]" />
                          <span className="text-[11px] text-[#d9ff00] font-medium">
                            {postGenAction === 'upscale' && 'Upscaling image…'}
                            {postGenAction === 'variation' && 'Creating variation…'}
                            {postGenAction === 'improve' && 'Enhancing image…'}
                            {postGenAction === 'img2vid' && 'Converting to video…'}
                          </span>
                        </motion.div>
`;
  const newProcessingIndicator = `                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-2 rounded-lg bg-[#d9ff00]/5 border border-[#d9ff00]/20 px-3 py-2"
                        >
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#d9ff00]" />
                          <span className="text-[11px] text-[#d9ff00] font-medium">
                            {postGenAction === 'upscale' && 'Upscaling image…'}
                            {postGenAction === 'variation' && 'Creating variation…'}
                            {postGenAction === 'improve' && 'Enhancing image…'}
                            {postGenAction === 'img2vid' && 'Converting to video…'}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelPostGenAction}
                            className="ml-auto h-7 text-[10px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            Cancel
                          </Button>
                        </motion.div>
`;
  source = replaceRequired(
    source,
    oldProcessingIndicator,
    newProcessingIndicator,
    'Image Studio post-generation cancellation control',
  );

  source = replaceRequired(
    source,
    `          providerId={selectedImageProvider}
          onResult={(url) => {
            setLatestResult(url);
            setShowEditor(false);
            setEditorImage(null);
          }}
`,
    `          providerId={selectedImageProvider}
          parentGenerationId={
            generationResultIds[selectedResultIndex] || generationResultIds[0]
          }
          onResult={(url, generationId) => {
            setLatestResult(url);
            setGenerationResults([url]);
            if (generationId) setGenerationResultIds([generationId]);
            setSelectedResultIndex(0);
            setShowEditor(false);
            setEditorImage(null);
          }}
`,
    'Image Studio editor result ownership',
  );

  for (const legacy of [
    'postGenPollRef',
    'postGenPollCountRef',
    'await beginGeneration(derivedGeneration)',
    'await markGenerationProcessing(derivedGeneration',
  ]) {
    if (source.includes(legacy)) {
      throw new Error(`Legacy Image Studio derived-action identifier remains: ${legacy}`);
    }
  }

  await fs.writeFile(filePath, source, 'utf8');
}

function editorHandlers() {
  return `  // -----------------------------------------------------------------------
  // Generation lifecycle actions
  // -----------------------------------------------------------------------
  const handleInpaint = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error('Please enter an editing prompt');
      return;
    }
    if (strokes.length === 0) {
      toast.error('Please paint a mask on the area you want to edit');
      return;
    }
    if (!selectedModel) {
      toast.error('Please select a model');
      return;
    }

    const maskBase64 = exportMask();
    const imageBase64 = exportOriginalImage();
    if (!maskBase64 || !imageBase64) {
      toast.error('The source image or edit mask could not be prepared');
      return;
    }

    await runOperation({
      operation: 'inpaint',
      prompt: prompt.trim(),
      imageUrl: imageBase64,
      mask: maskBase64,
    });
  }, [prompt, strokes, selectedModel, exportMask, exportOriginalImage, runOperation]);

  const handleUpscale = useCallback(async () => {
    if (!selectedModel) {
      toast.error('Please select a model');
      return;
    }
    const imageBase64 = exportOriginalImage();
    if (!imageBase64) {
      toast.error('The source image could not be prepared');
      return;
    }
    await runOperation({
      operation: 'upscale',
      prompt: 'Upscale this image and preserve its composition and details',
      imageUrl: imageBase64,
      upscaleFactor: 2,
    });
  }, [selectedModel, exportOriginalImage, runOperation]);

  const handleVariation = useCallback(async () => {
    if (!selectedModel) {
      toast.error('Please select a model');
      return;
    }
    const imageBase64 = exportOriginalImage();
    if (!imageBase64) {
      toast.error('The source image could not be prepared');
      return;
    }
    await runOperation({
      operation: 'variation',
      prompt: prompt.trim() || 'Generate a variation of this image',
      imageUrl: imageBase64,
    });
  }, [selectedModel, prompt, exportOriginalImage, runOperation]);

`;
}

function addEditorCancelControl(source, label) {
  return replaceRequired(
    source,
    `                  </div>
                </div>

                {/* No-key warning */}
`,
    `                  </div>
                  {isLoading && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={cancelOperation}
                      className="w-full border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10"
                    >
                      <X className="mr-1.5 h-3.5 w-3.5" />
                      Cancel editor action
                    </Button>
                  )}
                </div>

                {/* No-key warning */}
`,
    label,
  );
}

async function updateImageEditor() {
  const filePath = path.join(root, 'src/components/studio/image-editor.tsx');
  let source = await fs.readFile(filePath, 'utf8');

  source = replaceRequired(
    source,
    "import { generationFetch as fetch } from '@/lib/generation-client';\n",
    "import { generationFetch as fetch } from '@/lib/generation-client';\nimport { useEditorGeneration } from '@/components/studio/use-editor-generation';\n",
    'Image Editor lifecycle import',
  );
  source = replaceRequired(
    source,
    `  providerId: string;
  onResult: (url: string) => void;
`,
    `  providerId: string;
  parentGenerationId?: string;
  onResult: (url: string, generationId?: string) => void;
`,
    'Image Editor props',
  );
  source = replaceRequired(
    source,
    `  providerId,
  onResult,
}: ImageEditorProps) {
`,
    `  providerId,
  parentGenerationId,
  onResult,
}: ImageEditorProps) {
`,
    'Image Editor props destructuring',
  );
  source = replaceRequired(
    source,
    '  const { isImageGenerating, setIsImageGenerating, providerVersion } = useAppStore();\n',
    '  const { providerVersion } = useAppStore();\n',
    'Image Editor store subscription',
  );
  source = replaceRequired(
    source,
    `  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [isLoading, setIsLoading] = useState(false);
`,
    `  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
`,
    'Image Editor loading state',
  );
  source = replaceRequired(
    source,
    `  const [editResult, setEditResult] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
`,
    `  const [showComparison, setShowComparison] = useState(false);
`,
    'Image Editor result state',
  );
  source = replaceRequired(
    source,
    `  const hasApiKey = apiKeysHook.hasKey(providerId);
`,
    `  const hasApiKey = apiKeysHook.hasKey(providerId);
  const {
    isLoading,
    editResult,
    runOperation,
    cancelOperation,
  } = useEditorGeneration({
    providers,
    configuredProviderIds: apiKeysHook.configuredProviderIds,
    preferredProviderId: providerId,
    preferredModelId: selectedModel,
    sourceImageUrl: imageUrl,
    parentGenerationId,
    onResult,
  });
`,
    'Image Editor lifecycle hook',
  );
  source = spliceRequired(
    source,
    '  // API calls\n',
    '  // Download helper\n',
    editorHandlers(),
    'Image Editor API handlers',
  );
  source = addEditorCancelControl(
    source,
    'Image Editor cancellation control',
  );

  for (const legacy of [
    'setIsLoading(',
    'apiKey=${encodeURIComponent(apiKey)}',
    "fetch('/api/generate/image'",
    "type: 'upscale'",
    "type: 'variation'",
  ]) {
    if (source.includes(legacy)) {
      throw new Error(`Legacy Image Editor generation identifier remains: ${legacy}`);
    }
  }

  await fs.writeFile(filePath, source, 'utf8');
}

async function updateImageEditorPanel() {
  const filePath = path.join(root, 'src/components/studio/image-editor-panel.tsx');
  let source = await fs.readFile(filePath, 'utf8');

  source = replaceRequired(
    source,
    "import { generationFetch as fetch } from '@/lib/generation-client';\n",
    "import { generationFetch as fetch } from '@/lib/generation-client';\nimport { useEditorGeneration } from '@/components/studio/use-editor-generation';\n",
    'Editor Panel lifecycle import',
  );
  source = replaceRequired(
    source,
    `  providerId: string;
  onResult: (url: string) => void;
`,
    `  providerId: string;
  parentGenerationId?: string;
  onResult: (url: string, generationId?: string) => void;
`,
    'Editor Panel props',
  );
  source = replaceRequired(
    source,
    `  providerId,
  onResult,
  tool,
`,
    `  providerId,
  parentGenerationId,
  onResult,
  tool,
`,
    'Editor Panel props destructuring',
  );
  source = replaceRequired(
    source,
    `  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [isLoading, setIsLoading] = useState(false);
`,
    `  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
`,
    'Editor Panel loading state',
  );
  source = replaceRequired(
    source,
    `  const [editResult, setEditResult] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
`,
    `  const [showComparison, setShowComparison] = useState(false);
`,
    'Editor Panel result state',
  );
  source = replaceRequired(
    source,
    `  const comparisonContainerRef = useRef<HTMLDivElement>(null);
  const apiKeysHook = useApiKeys();
`,
    `  const comparisonContainerRef = useRef<HTMLDivElement>(null);
  const apiKeysHook = useApiKeys();
  const {
    isLoading,
    editResult,
    runOperation,
    cancelOperation,
  } = useEditorGeneration({
    providers,
    configuredProviderIds: apiKeysHook.configuredProviderIds,
    preferredProviderId: providerId,
    preferredModelId: selectedModel,
    sourceImageUrl: imageUrl,
    parentGenerationId,
    onResult,
  });
`,
    'Editor Panel lifecycle hook',
  );
  source = spliceRequired(
    source,
    '  // API calls\n',
    '  // Download helper\n',
    editorHandlers(),
    'Editor Panel API handlers',
  );
  source = addEditorCancelControl(
    source,
    'Editor Panel cancellation control',
  );

  for (const legacy of [
    'setIsLoading(',
    'apiKey=${encodeURIComponent(apiKey)}',
    "fetch('/api/generate/image'",
    "type: 'upscale'",
    "type: 'variation'",
  ]) {
    if (source.includes(legacy)) {
      throw new Error(`Legacy Editor Panel generation identifier remains: ${legacy}`);
    }
  }

  await fs.writeFile(filePath, source, 'utf8');
}

async function updateEditorHelpers() {
  const filePath = path.join(root, 'src/components/studio/image-editor-helpers.ts');
  let source = await fs.readFile(filePath, 'utf8');
  source = replaceRequired(
    source,
    `  providerId: string;
  onResult: (url: string) => void;
`,
    `  providerId: string;
  parentGenerationId?: string;
  onResult: (url: string, generationId?: string) => void;
`,
    'Image Editor helper props',
  );
  await fs.writeFile(filePath, source, 'utf8');
}

await updateLifecycle();
await updateImageStudio();
await updateImageEditor();
await updateImageEditorPanel();
await updateEditorHelpers();
