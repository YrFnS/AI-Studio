'use client';

import { generationFetch as fetch } from '@/lib/generation-client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

import { useAppStore } from '@/lib/store';
import { useApiKeys } from '@/hooks/use-api-keys';
import {
  GenerationLifecycleError,
  startGenerationJob,
  type GenerationJobHandle,
} from '@/lib/generation-lifecycle';
import {
  createGenerationId,
  type GenerationDescriptor,
} from '@/lib/generation-persistence';

import type { Provider, CompareResult, CompareSlot } from './model-compare-types';

// ---------------------------------------------------------------------------
// Custom Hook: useModelCompare
// Comparison results now share the same submit → persist → poll → terminal
// lifecycle as the primary studios and are saved to the Gallery.
// ---------------------------------------------------------------------------

export function useModelCompare(
  defaultPrompt: string,
  defaultNegativePrompt: string,
  defaultProviderId: string,
  defaultModelId: string,
) {
  const {
    isCompareOpen,
    setIsCompareOpen,
    compareSlots,
    setCompareSlots,
    updateCompareSlot,
    imageAspectRatio,
    imageQuality,
    imageSteps,
    imageGuidance,
    imageSeed,
  } = useAppStore();

  const apiKeysHook = useApiKeys();

  const [providers, setProviders] = useState<Provider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [sharedPrompt, setSharedPrompt] = useState(defaultPrompt);
  const [sharedNegPrompt, setSharedNegPrompt] = useState(defaultNegativePrompt);
  const [results, setResults] = useState<CompareResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const handlesRef = useRef<Map<number, GenerationJobHandle>>(new Map());
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      // Do not cancel provider work on unmount. Lifecycle persistence and the
      // startup recovery path remain responsible for eventual terminal state.
      handlesRef.current.clear();
    };
  }, []);

  useEffect(() => {
    fetch('/api/providers')
      .then((res) => res.json())
      .then((data) => {
        const provs = (data.providers || data || []).map((p: Provider) => ({
          ...p,
          models: (p.models || []).filter(
            (m: { type: string; capabilities?: string }) =>
              m.type === 'image' && m.capabilities?.includes('t2i'),
          ),
        }));
        setProviders(provs.filter((p: Provider) => p.models.length > 0));
      })
      .catch(() => {})
      .finally(() => setProvidersLoading(false));
  }, []);

  useEffect(() => {
    if (!isCompareOpen) return;

    setSharedPrompt(defaultPrompt);
    setSharedNegPrompt(defaultNegativePrompt);

    if (
      compareSlots[0]?.providerId !== defaultProviderId
      || compareSlots[0]?.modelId !== defaultModelId
    ) {
      const newSlots = [...compareSlots];
      newSlots[0] = {
        providerId: defaultProviderId,
        modelId: defaultModelId,
      };
      if (!newSlots[1]) newSlots[1] = { providerId: '', modelId: '' };
      setCompareSlots(newSlots);
    }

    setResults(
      compareSlots.map((_: CompareSlot, index: number) => ({
        slotIndex: index,
        status: 'idle',
        resultUrl: null,
        error: null,
        cost: null,
        providerName: '',
        modelName: '',
        providerColor: '',
      })),
    );
  }, [
    isCompareOpen,
    defaultProviderId,
    defaultModelId,
    defaultPrompt,
    defaultNegativePrompt,
  ]);

  const updateResult = useCallback(
    (slotIndex: number, patch: Partial<CompareResult>) => {
      if (!mountedRef.current) return;
      setResults((previous) => previous.map((result) =>
        result.slotIndex === slotIndex
          ? { ...result, ...patch }
          : result,
      ));
    },
    [],
  );

  const handleGenerateAll = useCallback(async () => {
    const prompt = sharedPrompt.trim();
    if (!prompt) {
      toast.error('Please enter a prompt');
      return;
    }

    const validSlots = compareSlots.filter(
      (slot) => slot.providerId && slot.modelId,
    );
    if (validSlots.length === 0) {
      toast.error('Please configure at least one slot with a provider and model');
      return;
    }

    for (const slot of validSlots) {
      if (!apiKeysHook.hasKey(slot.providerId)) {
        const provider = providers.find((item) => item.id === slot.providerId);
        toast.error(`No API key for ${provider?.displayName || slot.providerId}`);
        return;
      }
    }

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    handlesRef.current.clear();
    setIsGenerating(true);

    setResults(compareSlots.map((slot, index) => {
      const provider = providers.find((item) => item.id === slot.providerId);
      return {
        slotIndex: index,
        status: slot.providerId && slot.modelId ? 'generating' : 'idle',
        resultUrl: null,
        error: null,
        cost: null,
        providerName: provider?.displayName || '',
        modelName: provider?.models.find(
          (model) => model.modelId === slot.modelId,
        )?.name || '',
        providerColor: provider?.color || '',
      };
    }));

    const tasks = validSlots.map(async (slot) => {
      const slotIndex = compareSlots.indexOf(slot);
      const provider = providers.find((item) => item.id === slot.providerId);
      const model = provider?.models.find(
        (item) => item.modelId === slot.modelId,
      );
      const createdAt = Date.now();
      const descriptor: GenerationDescriptor = {
        id: createGenerationId('img'),
        providerId: slot.providerId,
        providerName: provider?.displayName || slot.providerId,
        modelId: slot.modelId,
        type: 'image',
        prompt,
        negativePrompt: sharedNegPrompt.trim() || undefined,
        params: {
          aspectRatio: imageAspectRatio,
          quality: imageQuality,
          steps: imageSteps,
          guidance: imageGuidance,
          seed: imageSeed,
          batchSize: 1,
          source: 'model-compare',
          comparisonSlot: slotIndex,
        },
        createdAt,
      };
      const body: Record<string, unknown> = {
        providerId: slot.providerId,
        modelId: slot.modelId,
        prompt,
        negativePrompt: sharedNegPrompt.trim() || undefined,
        aspectRatio: imageAspectRatio,
        quality: imageQuality,
        steps: imageSteps,
        guidance: imageGuidance,
        seed: imageSeed ?? undefined,
        batchSize: 1,
      };

      const handle = startGenerationJob({
        descriptor,
        endpoint: '/api/generate/image',
        body,
        pollPolicy: { maxElapsedMs: 25 * 60 * 1000 },
      });
      handlesRef.current.set(slotIndex, handle);
      const unsubscribe = handle.subscribe((snapshot) => {
        if (runIdRef.current !== runId) return;
        if (snapshot.state === 'processing') {
          updateResult(slotIndex, { jobId: snapshot.providerJobId });
        }
      });

      try {
        const lifecycleResult = await handle.result;
        if (runIdRef.current !== runId) return;
        updateResult(slotIndex, {
          status: 'completed',
          resultUrl: lifecycleResult.urls[0] || null,
          error: null,
          cost:
            typeof lifecycleResult.payload.cost === 'string'
              ? lifecycleResult.payload.cost
              : null,
          providerName: provider?.displayName || slot.providerId,
          modelName: model?.name || slot.modelId,
          providerColor: provider?.color || '',
          jobId: lifecycleResult.providerJobId,
        });
      } catch (error) {
        if (runIdRef.current !== runId) return;
        if (
          error instanceof GenerationLifecycleError
          && (error.code === 'detached' || error.code === 'cancelled')
        ) {
          return;
        }
        updateResult(slotIndex, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Generation failed',
        });
      } finally {
        unsubscribe();
        handlesRef.current.delete(slotIndex);
      }
    });

    await Promise.allSettled(tasks);
    if (mountedRef.current && runIdRef.current === runId) {
      setIsGenerating(false);
    }
  }, [
    sharedPrompt,
    sharedNegPrompt,
    compareSlots,
    providers,
    apiKeysHook,
    imageAspectRatio,
    imageQuality,
    imageSteps,
    imageGuidance,
    imageSeed,
    updateResult,
  ]);

  const addSlot = useCallback(() => {
    if (compareSlots.length >= 3) return;
    setCompareSlots([...compareSlots, { providerId: '', modelId: '' }]);
    setResults((previous) => [
      ...previous,
      {
        slotIndex: compareSlots.length,
        status: 'idle',
        resultUrl: null,
        error: null,
        cost: null,
        providerName: '',
        modelName: '',
        providerColor: '',
      },
    ]);
  }, [compareSlots, setCompareSlots]);

  const removeSlot = useCallback(() => {
    if (compareSlots.length <= 2) return;
    const removedIndex = compareSlots.length - 1;
    void handlesRef.current.get(removedIndex)?.cancel(
      'Comparison slot removed by user',
    );
    handlesRef.current.delete(removedIndex);
    setCompareSlots(compareSlots.slice(0, -1));
    setResults((previous) => previous.slice(0, -1));
  }, [compareSlots, setCompareSlots]);

  const handleProviderChange = useCallback(
    (slotIndex: number, providerId: string) => {
      void handlesRef.current.get(slotIndex)?.cancel(
        'Comparison provider changed by user',
      );
      handlesRef.current.delete(slotIndex);
      updateCompareSlot(slotIndex, { providerId, modelId: '' });
      updateResult(slotIndex, {
        status: 'idle',
        resultUrl: null,
        error: null,
        jobId: undefined,
      });
    },
    [updateCompareSlot, updateResult],
  );

  const handleModelChange = useCallback(
    (slotIndex: number, modelId: string) => {
      void handlesRef.current.get(slotIndex)?.cancel(
        'Comparison model changed by user',
      );
      handlesRef.current.delete(slotIndex);
      updateCompareSlot(slotIndex, { modelId });
      updateResult(slotIndex, {
        status: 'idle',
        resultUrl: null,
        error: null,
        jobId: undefined,
      });
    },
    [updateCompareSlot, updateResult],
  );

  const handleUseThis = useCallback(
    (url: string, onUseResult: (url: string) => void) => {
      onUseResult(url);
      setIsCompareOpen(false);
      toast.success('Result loaded into Image Studio');
    },
    [setIsCompareOpen],
  );

  const anyGenerating = results.some(
    (result) => result.status === 'generating',
  ) || isGenerating;

  return {
    isCompareOpen,
    setIsCompareOpen,
    compareSlots,
    providers,
    providersLoading,
    apiKeysHook,
    sharedPrompt,
    setSharedPrompt,
    sharedNegPrompt,
    setSharedNegPrompt,
    results,
    handleGenerateAll,
    addSlot,
    removeSlot,
    handleProviderChange,
    handleModelChange,
    handleUseThis,
    anyGenerating,
  };
}
