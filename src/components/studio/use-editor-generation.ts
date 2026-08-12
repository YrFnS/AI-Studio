'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  GenerationLifecycleError,
  startGenerationJob,
  type GenerationJobHandle,
} from '@/lib/generation-lifecycle';
import {
  prepareGenerationOperation,
  type GenerationOperation,
  type GenerationOperationProvider,
  type PreparedGenerationOperation,
} from '@/lib/generation-operation';
import { useAppStore } from '@/lib/store';

export interface RunEditorOperationOptions {
  operation: Extract<GenerationOperation, 'inpaint' | 'edit' | 'upscale' | 'variation' | 'improve'>;
  prompt?: string;
  negativePrompt?: string;
  imageUrl?: string | null;
  mask?: string | null;
  upscaleFactor?: 2 | 4;
}

interface UseEditorGenerationOptions {
  providers: GenerationOperationProvider[];
  configuredProviderIds: string[];
  preferredProviderId: string;
  preferredModelId: string;
  sourceImageUrl: string;
  parentGenerationId?: string;
  onResult: (url: string, generationId?: string) => void;
}

export function useEditorGeneration({
  providers,
  configuredProviderIds,
  preferredProviderId,
  preferredModelId,
  sourceImageUrl,
  parentGenerationId,
  onResult,
}: UseEditorGenerationOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [editResult, setEditResult] = useState<string | null>(null);
  const [activeOperation, setActiveOperation] = useState<GenerationOperation | null>(null);

  const handleRef = useRef<GenerationJobHandle | null>(null);
  const ownerRef = useRef<AbortController | null>(null);

  const addToQueue = useAppStore((state) => state.addToQueue);
  const updateQueueItem = useAppStore((state) => state.updateQueueItem);

  useEffect(() => {
    return () => {
      ownerRef.current?.abort('Image editor unmounted');
    };
  }, []);

  const runOperation = useCallback(async ({
    operation,
    prompt,
    negativePrompt,
    imageUrl,
    mask,
    upscaleFactor,
  }: RunEditorOperationOptions) => {
    const activeHandle = handleRef.current;
    if (
      activeHandle
      && ['submitting', 'processing'].includes(activeHandle.getSnapshot().state)
    ) {
      toast.info('An editor action is already in progress');
      return;
    }

    let prepared: PreparedGenerationOperation;
    try {
      prepared = prepareGenerationOperation({
        operation,
        providers,
        configuredProviderIds,
        preferredProviderId,
        preferredModelId,
        sourceImageUrl: imageUrl || sourceImageUrl,
        parentGenerationId,
        prompt,
        negativePrompt,
        mask,
        upscaleFactor,
        // The editor keeps provider choice explicit. It may select a compatible
        // model within that provider, but never silently bills another provider.
        allowProviderFallback: false,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'This editor action is unavailable');
      return;
    }

    if (prepared.target.modelId !== preferredModelId) {
      toast.info(`Using ${prepared.target.modelName} for this editor action.`);
    }

    const owner = new AbortController();
    ownerRef.current = owner;
    setIsLoading(true);
    setActiveOperation(operation);

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
        maxElapsedMs: 30 * 60 * 1000,
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
      if (!resultUrl) throw new Error('Provider completed without returning an image');

      setEditResult(resultUrl);
      onResult(resultUrl, result.generationIds[0]);
      toast.success(prepared.successMessage);
    } catch (error) {
      if (owner.signal.aborted) return;
      if (
        error instanceof GenerationLifecycleError
        && (error.code === 'detached' || error.code === 'cancelled')
      ) {
        return;
      }
      toast.error(error instanceof Error ? error.message : 'Editor action failed');
    } finally {
      unsubscribe();
      if (handleRef.current === handle) handleRef.current = null;
      if (ownerRef.current === owner) ownerRef.current = null;
      if (!owner.signal.aborted) {
        setIsLoading(false);
        setActiveOperation(null);
      }
    }
  }, [
    providers,
    configuredProviderIds,
    preferredProviderId,
    preferredModelId,
    sourceImageUrl,
    parentGenerationId,
    onResult,
    addToQueue,
    updateQueueItem,
  ]);

  const cancelOperation = useCallback(async () => {
    const handle = handleRef.current;
    const owner = ownerRef.current;

    if (handle) {
      await handle.cancel('Editor action cancelled by user');
    } else {
      owner?.abort('Editor action cancelled by user');
    }

    setIsLoading(false);
    setActiveOperation(null);
    toast.info('Editor action cancelled');
  }, []);

  return {
    isLoading,
    editResult,
    setEditResult,
    activeOperation,
    runOperation,
    cancelOperation,
  };
}
