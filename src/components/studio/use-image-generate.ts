'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

import { useAppStore } from '@/lib/store';
import type { GenerationQueueItem } from '@/lib/store';
import { useApiKeys } from '@/hooks/use-api-keys';
import {
  STYLE_PRESETS,
  LIGHTING_PRESETS,
  COLOR_MOOD_PRESETS,
  CAMERA_SHOT_PRESETS,
  SUBJECT_PRESETS,
  DETAIL_LEVEL_PRESETS,
  COMPOSITION_PRESETS,
  EMOTION_PRESETS,
  ERA_PRESETS,
  OUTFIT_PRESETS,
  HAIRSTYLE_PRESETS,
  HAIR_COLOR_PRESETS,
  EYE_COLOR_PRESETS,
  POSE_PRESETS,
  ACCESSORIES_PRESETS,
  BODY_TYPE_PRESETS,
  AGE_PRESETS,
  RESOLUTION_MAP,
} from '@/components/studio/presets';
import type { Provider } from '@/components/studio/image-studio-types';

// ---------------------------------------------------------------------------
// useImageGenerate — handles image generation logic, polling, and related state
// ---------------------------------------------------------------------------

interface UseImageGenerateParams {
  providers: Provider[];
  selectedImageProvider: string;
  selectedImageModel: string;
  hasApiKey: boolean;
  apiKeysHook: ReturnType<typeof useApiKeys>;
}

export function useImageGenerate({
  providers,
  selectedImageProvider,
  selectedImageModel,
  hasApiKey,
  apiKeysHook,
}: UseImageGenerateParams) {
  // Local state ------------------------------------------------------------
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  // Refs -------------------------------------------------------------------
  const queueIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Store setters (stable references) ---------------------------------------
  const setIsImageGenerating = useAppStore((s) => s.setIsImageGenerating);
  const setLatestResult = useAppStore((s) => s.setLatestResult);
  const setGenerationResults = useAppStore((s) => s.setGenerationResults);
  const setSelectedResultIndex = useAppStore((s) => s.setSelectedResultIndex);
  const setGenerationDuration = useAppStore((s) => s.setGenerationDuration);
  const addToQueue = useAppStore((s) => s.addToQueue);
  const updateQueueItem = useAppStore((s) => s.updateQueueItem);
  const addPromptToHistory = useAppStore((s) => s.addPromptToHistory);

  // Derived ----------------------------------------------------------------
  const selectedProviderData = providers.find((p) => p.id === selectedImageProvider) ?? null;
  const imageModels = selectedProviderData?.models.filter((m) => m.type === 'image') ?? [];

  // Polling logic — sends apiKey from IndexedDB for async status checks --------
  const startPolling = useCallback(
    (generationId: string) => {
      if (pollRef.current) clearInterval(pollRef.current);

      pollRef.current = setInterval(async () => {
        try {
          const apiKey = await apiKeysHook.getKeyForProvider(selectedImageProvider);
          const res = await fetch(`/api/generate/status?id=${generationId}${apiKey ? `&apiKey=${encodeURIComponent(apiKey)}` : ''}`);
          if (!res.ok) throw new Error('Status check failed');
          const data = await res.json();

          if (data.status === 'completed') {
            setIsImageGenerating(false);
            const allUrls = data.urls || (data.resultUrl ? [data.resultUrl] : []);
            setLatestResult(data.resultUrl || data.urls?.[0] || null);
            setGenerationResults(allUrls);
            setSelectedResultIndex(0);
            setCurrentJobId(null);
            setGenerationDuration(null);
            if (queueIdRef.current) {
              updateQueueItem(queueIdRef.current, { status: 'completed', resultUrl: data.resultUrl || data.urls?.[0] || undefined });
              queueIdRef.current = null;
            }
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            toast.success(allUrls.length > 1 ? `${allUrls.length} images generated successfully!` : 'Image generated successfully!');
          } else if (data.status === 'failed') {
            setIsImageGenerating(false);
            setCurrentJobId(null);
            if (queueIdRef.current) {
              updateQueueItem(queueIdRef.current, { status: 'failed' });
              queueIdRef.current = null;
            }
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            toast.error(data.error || 'Generation failed');
          }
        } catch {
          // retry next interval
        }
      }, 3000);
    },
    [setIsImageGenerating, setLatestResult, setGenerationResults, setSelectedResultIndex, setGenerationDuration, apiKeysHook, selectedImageProvider, updateQueueItem]
  );

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Generate handler -------------------------------------------------------
  const handleGenerate = useCallback(async () => {
    if (!selectedImageProvider) {
      toast.error('Please select a provider');
      return;
    }
    if (!selectedImageModel) {
      toast.error('Please select a model');
      return;
    }

    // Read fresh state from store (avoids stale closure issues)
    const s = useAppStore.getState();
    const currentPrompt = s.imagePrompt;
    const currentNegPrompt = s.imageNegativePrompt;
    const currentAspectRatio = s.imageAspectRatio;
    const currentResolutionTier = s.imageResolutionTier;
    const currentQuality = s.imageQuality;
    const currentFormat = s.imageFormat;
    const currentSteps = s.imageSteps;
    const currentGuidance = s.imageGuidance;
    const currentSeed = s.imageSeed;
    const currentBatchSize = s.imageBatchSize;
    const currentInputImageUrl = s.inputImageUrl;
    const currentStrength = s.imageStrength;
    const currentSampler = s.imageSampler;
    const currentMagicPrompt = s.imageMagicPrompt;
    const currentStyleType = s.imageStyleType;
    const currentRenderingSpeed = s.imageRenderingSpeed;
    const currentClipGuidance = s.imageClipGuidance;
    const currentTileable = s.imageTileable;
    const currentPhotoReal = s.imagePhotoReal;
    const currentAlchemy = s.imageAlchemy;
    const currentSafetyFilter = s.imageSafetyFilter;
    const currentLighting = s.imageLighting;
    const currentColorMood = s.imageColorMood;
    const currentCameraShot = s.imageCameraShot;
    const currentSubject = s.imageSubject;
    const currentDetailLevel = s.imageDetailLevel;
    const currentComposition = s.imageComposition;
    const currentEmotion = s.imageEmotion;
    const currentEra = s.imageEra;
    const currentOutfit = s.imageOutfit;
    const currentHairstyle = s.imageHairstyle;
    const currentHairColor = s.imageHairColor;
    const currentEyeColor = s.imageEyeColor;
    const currentPose = s.imagePose;
    const currentAccessories = s.imageAccessories;
    const currentBodyType = s.imageBodyType;
    const currentAge = s.imageAge;
    const currentScheduler = s.imageScheduler;
    const currentClipSkip = s.imageClipSkip;
    const currentHiresFix = s.imageHiresFix;
    const currentHiresScale = s.imageHiresScale;
    const currentHiresSteps = s.imageHiresSteps;
    const currentHiresDenoise = s.imageHiresDenoise;
    const currentAutoEnhance = s.imageAutoEnhance;
    const currentOutfitDescription = s.imageOutfitDescription;
    const currentOutfitImageUrl = s.imageOutfitImageUrl;
    const currentActiveStylePreset = s.activeStylePreset;

    if (!currentPrompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }
    if (!hasApiKey) {
      toast.error('No API key configured for this provider. Add one in Settings.');
      return;
    }

    // Auto-enhance prompt if toggle is on
    let basePrompt = currentPrompt.trim();
    if (currentAutoEnhance) {
      try {
        setIsImageGenerating(true);
        const enhanceRes = await fetch('/api/enhance-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: basePrompt, type: 'enhance' }),
        });
        const enhanceData = await enhanceRes.json();
        if (enhanceData.enhancedPrompt) {
          basePrompt = enhanceData.enhancedPrompt;
          toast.success('Prompt auto-enhanced with AI!');
        }
      } catch {
        toast.info('Auto-enhance failed, using original prompt');
      }
    }

    // Apply style preset suffix to prompt
    let finalPrompt = basePrompt;
    let finalNegPrompt = currentNegPrompt.trim();
    if (currentActiveStylePreset) {
      const preset = STYLE_PRESETS.find((p) => p.id === currentActiveStylePreset);
      if (preset) {
        finalPrompt += preset.suffix;
        if (preset.negSuffix) {
          finalNegPrompt = finalNegPrompt ? `${finalNegPrompt}, ${preset.negSuffix}` : preset.negSuffix;
        }
      }
    }

    // Apply all preset suffixes
    const applyPreset = (value: string, presets: readonly { id: string; suffix?: string }[]) => {
      if (value !== 'none') {
        const preset = presets.find((p) => p.id === value);
        if (preset?.suffix) finalPrompt += preset.suffix;
      }
    };

    applyPreset(currentLighting, LIGHTING_PRESETS);
    applyPreset(currentColorMood, COLOR_MOOD_PRESETS);
    applyPreset(currentCameraShot, CAMERA_SHOT_PRESETS);
    applyPreset(currentSubject, SUBJECT_PRESETS);
    applyPreset(currentDetailLevel, DETAIL_LEVEL_PRESETS);
    applyPreset(currentComposition, COMPOSITION_PRESETS);
    applyPreset(currentEmotion, EMOTION_PRESETS);
    applyPreset(currentEra, ERA_PRESETS);
    applyPreset(currentOutfit, OUTFIT_PRESETS);
    applyPreset(currentHairstyle, HAIRSTYLE_PRESETS);
    applyPreset(currentHairColor, HAIR_COLOR_PRESETS);
    applyPreset(currentEyeColor, EYE_COLOR_PRESETS);
    applyPreset(currentPose, POSE_PRESETS);
    applyPreset(currentAccessories, ACCESSORIES_PRESETS);
    applyPreset(currentBodyType, BODY_TYPE_PRESETS);
    applyPreset(currentAge, AGE_PRESETS);

    // Apply outfit change description
    if (currentOutfitDescription) {
      finalPrompt += `, wearing ${currentOutfitDescription}`;
    }

    // Save to prompt history
    addPromptToHistory(currentPrompt.trim());

    setIsImageGenerating(true);
    setLatestResult(null);
    setGenerationResults([]);
    setSelectedResultIndex(0);
    setCurrentJobId(null);
    setGenerationDuration(null);
    const generationStartTime = Date.now();

    // Add to generation queue
    const queueItem: GenerationQueueItem = {
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      prompt: currentPrompt.trim(),
      providerName: selectedProviderData?.displayName || selectedImageProvider,
      providerColor: selectedProviderData?.color || '#888',
      modelName: imageModels.find((m) => m.modelId === selectedImageModel)?.name || selectedImageModel,
      status: 'processing',
      createdAt: Date.now(),
    };
    addToQueue(queueItem);
    queueIdRef.current = queueItem.id;

    try {
      // Get API key from IndexedDB (BYOK model)
      const apiKey = await apiKeysHook.getKeyForProvider(selectedImageProvider);
      if (!apiKey) {
        toast.error('No API key configured for this provider. Add one in Settings.');
        setIsImageGenerating(false);
        return;
      }

      // Compute dimensions from aspect ratio + resolution tier
      const dimensions = RESOLUTION_MAP[currentAspectRatio]?.[currentResolutionTier] ?? RESOLUTION_MAP['1:1']['hd'];
      const computedSize = `${dimensions.width}x${dimensions.height}`;
      const isSDProvider = ['stability', 'replicate', 'fal', 'together', 'fireworks', 'huggingface'].includes(selectedImageProvider);

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
        apiKey,
        strength: currentInputImageUrl ? currentStrength : undefined,
        sampler: isSDProvider ? currentSampler : undefined,
        magicPrompt: selectedImageProvider === 'ideogram' ? currentMagicPrompt : undefined,
        styleType: (selectedImageProvider === 'ideogram' || (selectedImageProvider === 'openai' && selectedImageModel === 'dall-e-3')) ? currentStyleType : undefined,
        renderingSpeed: selectedImageProvider === 'ideogram' ? currentRenderingSpeed : undefined,
        clipGuidance: selectedImageProvider === 'stability' ? currentClipGuidance : undefined,
        tileable: selectedImageProvider === 'stability' && currentTileable ? true : undefined,
        photoReal: selectedImageProvider === 'leonardo' && currentPhotoReal ? true : undefined,
        alchemy: selectedImageProvider === 'leonardo' && currentAlchemy ? true : undefined,
        safetyFilter: !currentSafetyFilter ? false : undefined,
        scheduler: isSDProvider ? currentScheduler : undefined,
        clipSkip: isSDProvider && currentClipSkip > 1 ? currentClipSkip : undefined,
        lighting: currentLighting !== 'none' ? currentLighting : undefined,
        colorMood: currentColorMood !== 'none' ? currentColorMood : undefined,
        cameraShot: currentCameraShot !== 'none' ? currentCameraShot : undefined,
        hiresFix: isSDProvider && currentHiresFix ? true : undefined,
        hiresScale: isSDProvider && currentHiresFix ? currentHiresScale : undefined,
        hiresSteps: isSDProvider && currentHiresFix ? currentHiresSteps : undefined,
        hiresDenoise: isSDProvider && currentHiresFix ? currentHiresDenoise : undefined,
        outfitImageUrl: currentOutfitImageUrl || undefined,
      };

      const res = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Generation failed');
      }

      if (data.status === 'completed' && data.urls) {
        setLatestResult(data.urls[0] || null);
        setGenerationResults(data.urls);
        setSelectedResultIndex(0);
        setIsImageGenerating(false);
        setGenerationDuration((Date.now() - generationStartTime) / 1000);
        if (queueIdRef.current) {
          updateQueueItem(queueIdRef.current, { status: 'completed', resultUrl: data.urls[0] || undefined });
          queueIdRef.current = null;
        }
        toast.success(data.urls.length > 1 ? `${data.urls.length} images generated successfully!` : 'Image generated successfully!');
      } else if (data.status === 'processing' && data.id) {
        setCurrentJobId(data.id);
        startPolling(data.id);
        toast.info('Generation in progress…');
      } else {
        setIsImageGenerating(false);
        if (queueIdRef.current) {
          updateQueueItem(queueIdRef.current, { status: 'failed' });
          queueIdRef.current = null;
        }
        toast.error('Unexpected response from server');
      }
    } catch (err) {
      setIsImageGenerating(false);
      if (queueIdRef.current) {
        updateQueueItem(queueIdRef.current, { status: 'failed' });
        queueIdRef.current = null;
      }
      toast.error(err instanceof Error ? err.message : 'Generation failed');
    }
  }, [
    selectedImageProvider,
    selectedImageModel,
    hasApiKey,
    apiKeysHook,
    selectedProviderData,
    imageModels,
    setIsImageGenerating,
    setLatestResult,
    startPolling,
    addToQueue,
    updateQueueItem,
    addPromptToHistory,
    setGenerationResults,
    setSelectedResultIndex,
    setGenerationDuration,
  ]);

  // Keyboard shortcut: generate on trigger
  const generateTrigger = useAppStore((s) => s.generateTrigger);
  useEffect(() => {
    if (generateTrigger > 0) {
      handleGenerate();
    }
  }, [generateTrigger, handleGenerate]);

  return {
    handleGenerate,
    isImageGenerating: useAppStore((s) => s.isImageGenerating),
    currentJobId,
    startPolling,
  };
}
