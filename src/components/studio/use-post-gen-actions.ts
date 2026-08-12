'use client';

import { generationFetch as fetch } from '@/lib/generation-client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  GenerationLifecycleError,
  startGenerationJob,
  type GenerationJobHandle,
} from '@/lib/generation-lifecycle';
import {
  prepareGenerationOperation,
  type GenerationOperationProvider,
} from '@/lib/generation-operation';
import { useAppStore } from '@/lib/store';
import { useApiKeys } from '@/hooks/use-api-keys';

interface UsePostGenActionsParams {
  selectedImageProvider: string;
  selectedImageModel: string;
  hasApiKey: boolean;
  apiKeysHook: ReturnType<typeof useApiKeys>;
  providers?: GenerationOperationProvider[];
  parentGenerationId?: string;
}

export function usePostGenActions({
  selectedImageProvider,
  selectedImageModel,
  apiKeysHook,
  providers: suppliedProviders,
  parentGenerationId,
}: UsePostGenActionsParams) {
  const [providers, setProviders] = useState<GenerationOperationProvider[]>(
    suppliedProviders || [],
  );
  const handleRef = useRef<GenerationJobHandle | null>(null);
  const ownerRef = useRef<AbortController | null>(null);

  const setIsPostGenProcessing = useAppStore((state) => state.setIsPostGenProcessing);
  const setPostGenAction = useAppStore((state) => state.setPostGenAction);
  const setLatestResult = useAppStore((state) => state.setLatestResult);
  const setGenerationResults = useAppStore((state) => state.setGenerationResults);
  const setSelectedResultIndex = useAppStore((state) => state.setSelectedResultIndex);
  const setPostGenResult = useAppStore((state) => state.setPostGenResult);
  const addToQueue = useAppStore((state) => state.addToQueue);
  const updateQueueItem = useAppStore((state) => state.updateQueueItem);

  useEffect(() => {
    if (suppliedProviders) {
      setProviders(suppliedProviders);
      return;
    }

    const controller = new AbortController();
    fetch('/api/providers', { signal: controller.signal })
      .then((response) => response.json())
      .then((value: unknown) => {
        if (Array.isArray(value)) {
          setProviders(value as GenerationOperationProvider[]);
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [suppliedProviders]);

  useEffect(() => {
    return () => {
      ownerRef.current?.abort('Post-generation action detached');
    };
  }, []);

  const handlePostGenAction = useCallback(async (
    action: 'upscale' | 'variation' | 'improve' | 'img2vid',
  ) => {
    const activeHandle = handleRef.current;
    if (
      activeHandle
      && ['submitting', 'processing'].includes(activeHandle.getSnapshot().state)
    ) {
      toast.info('A post-generation action is already in progress');
      return;
    }

    const state = useAppStore.getState();
    const activeImageUrl = state.generationResults.length > 1
      ? state.generationResults[state.selectedResultIndex] || state.latestResult
      : state.latestResult;

    if (!activeImageUrl) {
      toast.error('No image to process');
      return;
    }
    if (providers.length === 0) {
      toast.error('Provider catalog is still loading');
      return;
    }

    const prepared = prepareGenerationOperation({
      operation: action,
      providers,
      configuredProviderIds: apiKeysHook.configuredProviderIds,
      preferredProviderId: selectedImageProvider,
      preferredModelId: selectedImageModel,
      sourceImageUrl: activeImageUrl,
      parentGenerationId,
      prompt: action === 'improve'
        ? `Enhanced, improved quality, better details, higher resolution version of: ${state.imagePrompt}`
        : state.imagePrompt || undefined,
      negativePrompt: action === 'improve'
        ? 'low quality, blurry, distorted, deformed, bad anatomy'
        : state.imageNegativePrompt || undefined,
      duration: 5,
      aspectRatio: state.imageAspectRatio,
      allowProviderFallback: true,
    });

    if (
      prepared.target.providerId !== selectedImageProvider
      || prepared.target.modelId !== selectedImageModel
    ) {
      toast.info(
        `Using ${prepared.target.providerName} · ${prepared.target.modelName} for this action.`,
      );
    }

    const owner = new AbortController();
    ownerRef.current = owner;
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
    handleRef.current = handle;

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
      toast.error(error instanceof Error ? error.message : `${action} failed`);
    } finally {
      unsubscribe();
      if (handleRef.current === handle) handleRef.current = null;
      if (ownerRef.current === owner) ownerRef.current = null;
      if (!owner.signal.aborted) {
        setIsPostGenProcessing(false);
        setPostGenAction(null);
      }
    }
  }, [
    providers,
    apiKeysHook.configuredProviderIds,
    selectedImageProvider,
    selectedImageModel,
    parentGenerationId,
    setPostGenAction,
    setIsPostGenProcessing,
    setPostGenResult,
    setLatestResult,
    setGenerationResults,
    setSelectedResultIndex,
    addToQueue,
    updateQueueItem,
  ]);

  const cancelPostGenAction = useCallback(async () => {
    const handle = handleRef.current;
    const owner = ownerRef.current;

    if (handle) {
      await handle.cancel('Post-generation action cancelled by user');
    } else {
      owner?.abort('Post-generation action cancelled by user');
    }

    setIsPostGenProcessing(false);
    setPostGenAction(null);
    toast.info('Post-generation action cancelled');
  }, [setIsPostGenProcessing, setPostGenAction]);

  return {
    handlePostGenAction,
    cancelPostGenAction,
    isPostGenProcessing: useAppStore((state) => state.isPostGenProcessing),
  };
}
