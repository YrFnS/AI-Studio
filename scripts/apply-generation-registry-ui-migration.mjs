import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function replaceRequired(source, oldValue, newValue, label) {
  if (!source.includes(oldValue)) {
    throw new Error(`Could not locate ${label}`);
  }
  return source.replace(oldValue, newValue);
}

function replaceRegexRequired(source, pattern, replacement, label) {
  if (!pattern.test(source)) {
    throw new Error(`Could not locate ${label}`);
  }
  pattern.lastIndex = 0;
  return source.replace(pattern, replacement);
}

function spliceRequired(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Could not locate ${label}`);
  }
  return source.slice(0, start) + replacement + source.slice(end);
}

async function patchHandlers() {
  const filePath = path.join(root, 'src/app/api/generate/handlers.ts');
  let source = await fs.readFile(filePath, 'utf8');

  source = replaceRequired(
    source,
    "import type { GenerateParams } from '@/lib/types';\n",
    "import type { GenerateParams } from '@/lib/types';\nimport { resolveImageBlob } from '@/lib/server/image-input';\nimport { submitReplicatePrediction } from '@/lib/server/replicate';\n",
    'generation handler helper imports',
  );

  const stability = `export async function generateStability(
  params: GenerateParams,
  apiKey: string,
  providerBaseUrl: string,
): Promise<string[]> {
  const sd3Models: Record<string, string> = {
    'stable-diffusion-3.5-large': 'sd3.5-large',
    'stable-diffusion-3.5-large-turbo': 'sd3.5-large-turbo',
    'stable-diffusion-3.5-medium': 'sd3.5-medium',
  };
  const sd3Model = sd3Models[params.model];
  const endpoint = params.model === 'stable-image-ultra'
    ? 'ultra'
    : params.model === 'stable-image-core'
      ? 'core'
      : sd3Model
        ? 'sd3'
        : null;

  if (!endpoint) {
    throw new Error(\`No Stability image adapter exists for \${params.model}.\`);
  }

  const formData = new FormData();
  formData.append('prompt', params.prompt);
  if (params.negativePrompt) {
    formData.append('negative_prompt', params.negativePrompt);
  }
  formData.append('output_format', params.output_format || 'png');
  if (params.seed !== undefined) formData.append('seed', String(params.seed));

  if (params.inputImageUrl) {
    if (!sd3Model) {
      throw new Error(\`\${params.model} is not registered for Stability image-to-image generation.\`);
    }
    const imageBlob = await resolveImageBlob(params.inputImageUrl);
    formData.append('image', imageBlob, 'image.png');
    formData.append('mode', 'image-to-image');
    formData.append('strength', String(params.strength ?? 0.65));
  } else if (params.aspectRatio) {
    formData.append('aspect_ratio', params.aspectRatio);
  }

  if (sd3Model) formData.append('model', sd3Model);

  const response = await fetch(
    \`\${providerBaseUrl}/v2beta/stable-image/generate/\${endpoint}\`,
    {
      method: 'POST',
      headers: {
        Authorization: \`Bearer \${apiKey}\`,
        Accept: 'image/*',
      },
      body: formData,
    },
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(\`Stability API error: \${response.status} - \${error}\`);
  }

  const buffer = await response.arrayBuffer();
  return [\`data:image/\${params.output_format || 'png'};base64,\${Buffer.from(buffer).toString('base64')}\`];
}

`;

  source = spliceRequired(
    source,
    'export async function generateStability(',
    'export async function generateReplicate(',
    stability,
    'Stability generation adapter',
  );

  const replicate = `export async function generateReplicate(
  params: GenerateParams,
  apiKey: string,
  providerBaseUrl: string,
): Promise<{ jobId: string; status: string }> {
  const input: Record<string, unknown> = {
    prompt: params.prompt,
    negative_prompt: params.negativePrompt,
    width: params.width,
    height: params.height,
    num_outputs: params.batchSize || 1,
    num_inference_steps: params.steps,
    guidance_scale: params.guidance,
    seed: params.seed,
    output_format: params.output_format,
  };
  if (params.inputImageUrl) {
    input.image = params.inputImageUrl;
    input.strength = params.strength ?? 0.65;
  }

  for (const key of Object.keys(input)) {
    if (input[key] === undefined || input[key] === '') delete input[key];
  }

  const data = await submitReplicatePrediction(
    providerBaseUrl,
    params.model,
    input,
    apiKey,
  );
  if (typeof data.id !== 'string') {
    throw new Error('Replicate did not return a prediction id');
  }

  return { jobId: data.id, status: 'processing' };
}

`;

  source = spliceRequired(
    source,
    'export async function generateReplicate(',
    'export async function generateFal(',
    replicate,
    'Replicate generation adapter',
  );

  await fs.writeFile(filePath, source, 'utf8');
}

function removeCustomModelMerge(source, label) {
  return replaceRegexRequired(
    source,
    /\n\s*\/\/ Merge custom models from IndexedDB\n\s*try \{[\s\S]*?\n\s*\} catch \{ \/\* non-critical \*\/ \}\n/,
    '\n',
    label,
  );
}

async function patchImageStudio() {
  const filePath = path.join(root, 'src/components/studio/image-studio.tsx');
  let source = await fs.readFile(filePath, 'utf8');

  source = replaceRequired(
    source,
    "import { saveReferenceImage, getAllCustomModels } from '@/lib/idb';",
    "import { saveReferenceImage } from '@/lib/idb';",
    'Image Studio custom model import',
  );
  source = replaceRequired(
    source,
    `  const selectedProviderData = providers.find((p) => p.id === selectedImageProvider) ?? null;
  const imageModels = selectedProviderData?.models.filter((m) => m.type === 'image') ?? [];
  const hasApiKey = apiKeysHook.hasKey(selectedImageProvider);`,
    `  const selectedProviderData = providers.find((p) => p.id === selectedImageProvider) ?? null;
  const imageOperationCapability = inputImageUrl ? 'i2i' : 't2i';
  const imageModels = selectedProviderData?.models.filter((model) => (
    model.type === 'image'
    && (model.capabilities || '').split(',').includes(imageOperationCapability)
  )) ?? [];
  const hasApiKey = apiKeysHook.hasKey(selectedImageProvider);`,
    'Image Studio operation-aware models',
  );
  source = removeCustomModelMerge(source, 'Image Studio custom model merge');

  source = replaceRequired(
    source,
    `        // Auto-select first provider that has an API key
        if (!selectedImageProvider && data.length > 0) {
          const withKey = data.find((p) => apiKeysHook.hasKey(p.id));
          const pick = withKey || data[0];
          setSelectedImageProvider(pick.id);
          // Auto-select default model
          const defaultModel = pick.models.find((m) => m.isDefault && m.type === 'image');
          if (defaultModel) {
            setSelectedImageModel(defaultModel.modelId);
          } else {
            const firstImage = pick.models.find((m) => m.type === 'image');
            if (firstImage) setSelectedImageModel(firstImage.modelId);
          }
        }`,
    `        // Auto-select a provider/model registered for the current image operation.
        if (!selectedImageProvider && data.length > 0) {
          const requiredCapability = useAppStore.getState().inputImageUrl ? 'i2i' : 't2i';
          const supportsRequiredOperation = (model: ProviderModel) => (
            model.type === 'image'
            && (model.capabilities || '').split(',').includes(requiredCapability)
          );
          const withKey = data.find((provider) => (
            apiKeysHook.hasKey(provider.id)
            && provider.models.some(supportsRequiredOperation)
          ));
          const withImage = data.find((provider) => (
            provider.models.some(supportsRequiredOperation)
          ));
          const pick = withKey || withImage;
          if (pick) {
            setSelectedImageProvider(pick.id);
            const eligibleModels = pick.models.filter(supportsRequiredOperation);
            const defaultModel = eligibleModels.find((model) => model.isDefault);
            setSelectedImageModel((defaultModel || eligibleModels[0])?.modelId || '');
          }
        }`,
    'Image Studio initial registry selection',
  );

  source = replaceRequired(
    source,
    `  // When provider changes, reset model selection ---------------------------
  useEffect(() => {
    if (!selectedImageProvider || providers.length === 0) return;
    const prov = providers.find((p) => p.id === selectedImageProvider);
    if (!prov) return;
    const defaultModel = prov.models.find((m) => m.isDefault && m.type === 'image');
    if (defaultModel) {
      setSelectedImageModel(defaultModel.modelId);
    } else {
      const firstImage = prov.models.find((m) => m.type === 'image');
      if (firstImage) setSelectedImageModel(firstImage.modelId);
      else setSelectedImageModel('');
    }
  }, [selectedImageProvider, providers, setSelectedImageModel]);`,
    `  // Provider or operation changes reset the selection to an eligible model.
  useEffect(() => {
    if (!selectedImageProvider || providers.length === 0) return;
    const provider = providers.find((candidate) => candidate.id === selectedImageProvider);
    if (!provider) return;
    const eligibleModels = provider.models.filter((model) => (
      model.type === 'image'
      && (model.capabilities || '').split(',').includes(imageOperationCapability)
    ));
    const currentIsEligible = eligibleModels.some(
      (model) => model.modelId === selectedImageModel,
    );
    if (currentIsEligible) return;
    const defaultModel = eligibleModels.find((model) => model.isDefault);
    setSelectedImageModel((defaultModel || eligibleModels[0])?.modelId || '');
  }, [
    selectedImageProvider,
    selectedImageModel,
    providers,
    imageOperationCapability,
    setSelectedImageModel,
  ]);`,
    'Image Studio operation-aware model reset',
  );

  source = replaceRequired(
    source,
    `              providers.map((p) => (`,
    `              providers
                .filter((provider) => provider.models.some((model) => (
                  model.type === 'image'
                  && (model.capabilities || '').split(',').includes(
                    inputImageUrl ? 'i2i' : 't2i',
                  )
                )))
                .map((p) => (`,
    'Image Studio provider selector filtering',
  );

  source = replaceRequired(
    source,
    `    if (!currentPrompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }
    if (!hasApiKey) {`,
    `    if (!currentPrompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }
    const requiredCapability = currentInputImageUrl ? 'i2i' : 't2i';
    const selectedGenerationModel = providers
      .find((provider) => provider.id === selectedImageProvider)
      ?.models.find((model) => model.modelId === selectedImageModel);
    if (
      !selectedGenerationModel
      || !(selectedGenerationModel.capabilities || '')
        .split(',')
        .includes(requiredCapability)
    ) {
      toast.error(
        currentInputImageUrl
          ? 'The selected model is not registered for image-to-image generation.'
          : 'The selected model is not registered for text-to-image generation.',
      );
      return;
    }
    if (!hasApiKey) {`,
    'Image Studio submit-time registry guard',
  );

  if (source.includes('getAllCustomModels')) {
    throw new Error('Image Studio still exposes unregistered custom models');
  }
  await fs.writeFile(filePath, source, 'utf8');
}

async function patchVideoStudio() {
  const filePath = path.join(root, 'src/components/studio/video-studio.tsx');
  let source = await fs.readFile(filePath, 'utf8');

  source = replaceRequired(
    source,
    "import { saveReferenceImage, getAllCustomModels } from '@/lib/idb';",
    "import { saveReferenceImage } from '@/lib/idb';",
    'Video Studio custom model import',
  );
  source = replaceRequired(
    source,
    `  const selectedProviderData = providers.find((p) => p.id === selectedVideoProvider) ?? null;
  const videoModels = selectedProviderData?.models.filter((m) => m.type === 'video') ?? [];
  const hasApiKey = apiKeysHook.hasKey(selectedVideoProvider);`,
    `  const selectedProviderData = providers.find((p) => p.id === selectedVideoProvider) ?? null;
  const requiresImageToVideo = Boolean(referenceImageUrl || videoStartFrameUrl);
  const videoOperationCapability = requiresImageToVideo ? 'i2v' : 't2v';
  const videoModels = selectedProviderData?.models.filter((model) => (
    model.type === 'video'
    && (model.capabilities || '').split(',').includes(videoOperationCapability)
  )) ?? [];
  const hasApiKey = apiKeysHook.hasKey(selectedVideoProvider);`,
    'Video Studio operation-aware models',
  );
  source = removeCustomModelMerge(source, 'Video Studio custom model merge');

  source = replaceRequired(
    source,
    `        // Auto-select first provider that has video models and an API key
        if (!selectedVideoProvider && data.length > 0) {
          const withKeyAndVideo = data.find(
            (p) => apiKeysHook.hasKey(p.id) && p.models.some((m) => m.type === 'video')
          );
          const withVideo = data.find((p) => p.models.some((m) => m.type === 'video'));
          const pick = withKeyAndVideo || withVideo || data[0];
          setSelectedVideoProvider(pick.id);
          // Auto-select default video model
          const defaultModel = pick.models.find((m) => m.isDefault && m.type === 'video');
          if (defaultModel) {
            setSelectedVideoModel(defaultModel.modelId);
          } else {
            const firstVideo = pick.models.find((m) => m.type === 'video');
            if (firstVideo) setSelectedVideoModel(firstVideo.modelId);
          }
        }`,
    `        // Auto-select a provider/model registered for text-to-video.
        if (!selectedVideoProvider && data.length > 0) {
          const supportsTextToVideo = (model: ProviderModel) => (
            model.type === 'video'
            && (model.capabilities || '').split(',').includes('t2v')
          );
          const withKeyAndVideo = data.find((provider) => (
            apiKeysHook.hasKey(provider.id)
            && provider.models.some(supportsTextToVideo)
          ));
          const withVideo = data.find((provider) => (
            provider.models.some(supportsTextToVideo)
          ));
          const pick = withKeyAndVideo || withVideo;
          if (pick) {
            setSelectedVideoProvider(pick.id);
            const eligibleModels = pick.models.filter(supportsTextToVideo);
            const defaultModel = eligibleModels.find((model) => model.isDefault);
            setSelectedVideoModel((defaultModel || eligibleModels[0])?.modelId || '');
          }
        }`,
    'Video Studio initial registry selection',
  );

  source = replaceRequired(
    source,
    `  useEffect(() => {
    if (!selectedVideoProvider || providers.length === 0) return;
    const prov = providers.find((p) => p.id === selectedVideoProvider);
    if (!prov) return;
    const defaultModel = prov.models.find((m) => m.isDefault && m.type === 'video');
    if (defaultModel) {
      setSelectedVideoModel(defaultModel.modelId);
    } else {
      const firstVideo = prov.models.find((m) => m.type === 'video');
      if (firstVideo) setSelectedVideoModel(firstVideo.modelId);
      else setSelectedVideoModel('');
    }
  }, [selectedVideoProvider, providers, setSelectedVideoModel]);`,
    `  useEffect(() => {
    if (!selectedVideoProvider || providers.length === 0) return;
    const provider = providers.find((candidate) => candidate.id === selectedVideoProvider);
    if (!provider) return;
    const eligibleModels = provider.models.filter((model) => (
      model.type === 'video'
      && (model.capabilities || '').split(',').includes(videoOperationCapability)
    ));
    const currentIsEligible = eligibleModels.some(
      (model) => model.modelId === selectedVideoModel,
    );
    if (currentIsEligible) return;
    const defaultModel = eligibleModels.find((model) => model.isDefault);
    setSelectedVideoModel((defaultModel || eligibleModels[0])?.modelId || '');
  }, [
    selectedVideoProvider,
    selectedVideoModel,
    providers,
    videoOperationCapability,
    setSelectedVideoModel,
  ]);`,
    'Video Studio operation-aware model reset',
  );

  source = replaceRequired(
    source,
    `              providers
                .filter((p) => p.models.some((m) => m.type === 'video'))
                .map((p) => (`,
    `              providers
                .filter((provider) => provider.models.some((model) => (
                  model.type === 'video'
                  && (model.capabilities || '').split(',').includes(
                    referenceImageUrl || videoStartFrameUrl ? 'i2v' : 't2v',
                  )
                )))
                .map((p) => (`,
    'Video Studio provider selector filtering',
  );

  source = replaceRequired(
    source,
    `    if (!apiKeysHook.hasKey(state.selectedVideoProvider)) {
      toast.error('No API key configured for this provider. Add one in Settings.');
      return;
    }

    const activeHandle = videoGenerationHandleRef.current;`,
    `    if (!apiKeysHook.hasKey(state.selectedVideoProvider)) {
      toast.error('No API key configured for this provider. Add one in Settings.');
      return;
    }

    const sourceImage = referenceImageUrl || state.videoStartFrameUrl;
    const requiredCapability = sourceImage ? 'i2v' : 't2v';
    const selectedGenerationModel = providers
      .find((provider) => provider.id === state.selectedVideoProvider)
      ?.models.find((model) => model.modelId === state.selectedVideoModel);
    if (
      !selectedGenerationModel
      || !(selectedGenerationModel.capabilities || '')
        .split(',')
        .includes(requiredCapability)
    ) {
      toast.error(
        sourceImage
          ? 'The selected model is not registered for image-to-video generation.'
          : 'The selected model is not registered for text-to-video generation.',
      );
      return;
    }

    const activeHandle = videoGenerationHandleRef.current;`,
    'Video Studio submit-time registry guard',
  );

  source = replaceRequired(
    source,
    `    const vModels = provData?.models.filter((m) => m.type === 'video') ?? [];`,
    `    const requiredCapability = referenceImageUrl || state.videoStartFrameUrl ? 'i2v' : 't2v';
    const vModels = provData?.models.filter((model) => (
      model.type === 'video'
      && (model.capabilities || '').split(',').includes(requiredCapability)
    )) ?? [];`,
    'Video Studio generation metadata models',
  );

  if (source.includes('getAllCustomModels')) {
    throw new Error('Video Studio still exposes unregistered custom models');
  }
  await fs.writeFile(filePath, source, 'utf8');
}

async function patchCinemaStudio() {
  const filePath = path.join(root, 'src/components/studio/cinema-studio.tsx');
  let source = await fs.readFile(filePath, 'utf8');

  source = replaceRequired(
    source,
    "import { getAllCustomModels } from '@/lib/idb';\n",
    '',
    'Cinema Studio custom model import',
  );
  source = replaceRequired(
    source,
    `  const selectedProviderData = providers.find((p) => p.id === selectedProvider) ?? null;
  const imageModels = selectedProviderData?.models.filter((m) => m.type === 'image') ?? [];
  const hasApiKey = apiKeysHook.hasKey(selectedProvider);`,
    `  const selectedProviderData = providers.find((p) => p.id === selectedProvider) ?? null;
  const imageModels = selectedProviderData?.models.filter((model) => (
    model.type === 'image'
    && (model.capabilities || '').split(',').includes('t2i')
  )) ?? [];
  const hasApiKey = apiKeysHook.hasKey(selectedProvider);`,
    'Cinema Studio registry models',
  );
  source = removeCustomModelMerge(source, 'Cinema Studio custom model merge');

  source = replaceRequired(
    source,
    `        if (!selectedProvider && data.length > 0) {
          const withKey = data.find((p) => apiKeysHook.hasKey(p.id));
          const pick = withKey || data[0];
          setSelectedProvider(pick.id);
          const defaultModel = pick.models.find((m) => m.isDefault && m.type === 'image');
          if (defaultModel) {
            setSelectedModel(defaultModel.modelId);
          } else {
            const firstImage = pick.models.find((m) => m.type === 'image');
            if (firstImage) setSelectedModel(firstImage.modelId);
          }
        }`,
    `        if (!selectedProvider && data.length > 0) {
          const supportsTextToImage = (model: ProviderModel) => (
            model.type === 'image'
            && (model.capabilities || '').split(',').includes('t2i')
          );
          const withKey = data.find((provider) => (
            apiKeysHook.hasKey(provider.id)
            && provider.models.some(supportsTextToImage)
          ));
          const withImage = data.find((provider) => (
            provider.models.some(supportsTextToImage)
          ));
          const pick = withKey || withImage;
          if (pick) {
            setSelectedProvider(pick.id);
            const eligibleModels = pick.models.filter(supportsTextToImage);
            const defaultModel = eligibleModels.find((model) => model.isDefault);
            setSelectedModel((defaultModel || eligibleModels[0])?.modelId || '');
          }
        }`,
    'Cinema Studio initial registry selection',
  );

  source = replaceRequired(
    source,
    `  // When provider changes, reset model
  useEffect(() => {
    if (!selectedProvider || providers.length === 0) return;
    const prov = providers.find((p) => p.id === selectedProvider);
    if (!prov) return;
    const defaultModel = prov.models.find((m) => m.isDefault && m.type === 'image');
    if (defaultModel) {
      setSelectedModel(defaultModel.modelId);
    } else {
      const firstImage = prov.models.find((m) => m.type === 'image');
      if (firstImage) setSelectedModel(firstImage.modelId);
      else setSelectedModel('');
    }
  }, [selectedProvider, providers]);`,
    `  // When the provider changes, select an eligible text-to-image model.
  useEffect(() => {
    if (!selectedProvider || providers.length === 0) return;
    const provider = providers.find((candidate) => candidate.id === selectedProvider);
    if (!provider) return;
    const eligibleModels = provider.models.filter((model) => (
      model.type === 'image'
      && (model.capabilities || '').split(',').includes('t2i')
    ));
    if (eligibleModels.some((model) => model.modelId === selectedModel)) return;
    const defaultModel = eligibleModels.find((model) => model.isDefault);
    setSelectedModel((defaultModel || eligibleModels[0])?.modelId || '');
  }, [selectedProvider, selectedModel, providers]);`,
    'Cinema Studio registry model reset',
  );

  source = replaceRequired(
    source,
    `              providers.map((p) => (`,
    `              providers
                .filter((provider) => provider.models.some((model) => (
                  model.type === 'image'
                  && (model.capabilities || '').split(',').includes('t2i')
                )))
                .map((p) => (`,
    'Cinema Studio provider selector filtering',
  );

  source = replaceRequired(
    source,
    `    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }
    if (!hasApiKey) {`,
    `    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }
    const selectedGenerationModel = providers
      .find((provider) => provider.id === selectedProvider)
      ?.models.find((model) => model.modelId === selectedModel);
    if (
      !selectedGenerationModel
      || !(selectedGenerationModel.capabilities || '').split(',').includes('t2i')
    ) {
      toast.error('The selected model is not registered for text-to-image generation.');
      return;
    }
    if (!hasApiKey) {`,
    'Cinema Studio submit-time registry guard',
  );

  if (source.includes('getAllCustomModels')) {
    throw new Error('Cinema Studio still exposes unregistered custom models');
  }
  await fs.writeFile(filePath, source, 'utf8');
}

await patchHandlers();
await patchImageStudio();
await patchVideoStudio();
await patchCinemaStudio();
