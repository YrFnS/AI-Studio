'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

import { useAppStore } from '@/lib/store';
import { useApiKeys } from '@/hooks/use-api-keys';

import type { Provider, CompareResult, CompareSlot } from './model-compare-types';

// ---------------------------------------------------------------------------
// Custom Hook: useModelCompare
// Encapsulates all comparison state management, API calls, and polling logic
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

  // Local state
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [sharedPrompt, setSharedPrompt] = useState(defaultPrompt);
  const [sharedNegPrompt, setSharedNegPrompt] = useState(defaultNegativePrompt);
  const [results, setResults] = useState<CompareResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const pollingRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Fetch providers
  useEffect(() => {
    fetch('/api/providers')
      .then((res) => res.json())
      .then((data) => {
        const provs = (data.providers || data || []).map((p: Provider) => ({
          ...p,
          models: (p.models || []).filter(
            (m: { type: string; capabilities?: string }) => m.type === 'image' && m.capabilities?.includes('t2i')
          ),
        }));
        setProviders(provs.filter((p: Provider) => p.models.length > 0));
      })
      .catch(() => {})
      .finally(() => setProvidersLoading(false));
  }, []);

  // Initialize slots when dialog opens
  useEffect(() => {
    if (isCompareOpen) {
      setSharedPrompt(defaultPrompt);
      setSharedNegPrompt(defaultNegativePrompt);

      // Set first slot to the current provider/model
      if (compareSlots[0]?.providerId !== defaultProviderId || compareSlots[0]?.modelId !== defaultModelId) {
        const newSlots = [...compareSlots];
        newSlots[0] = { providerId: defaultProviderId, modelId: defaultModelId };
        // Keep second slot or leave empty
        if (!newSlots[1]) {
          newSlots[1] = { providerId: '', modelId: '' };
        }
        setCompareSlots(newSlots);
      }

      // Reset results
      setResults(
        compareSlots.map((_: CompareSlot, i: number) => ({
          slotIndex: i,
          status: 'idle',
          resultUrl: null,
          error: null,
          cost: null,
          providerName: '',
          modelName: '',
          providerColor: '',
        }))
      );
    }
  }, [isCompareOpen, defaultProviderId, defaultModelId, defaultPrompt, defaultNegativePrompt]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      pollingRefs.current.forEach((timer) => clearInterval(timer));
      pollingRefs.current.clear();
    };
  }, []);

  // Poll for async job result
  const startPollingForResult = useCallback(
    (jobId: string, slotIndex: number, providerName: string, modelName: string, providerColor: string, providerId: string) => {
      const pollInterval = setInterval(async () => {
        try {
          const apiKey = await apiKeysHook.getKeyForProvider(providerId);
          const res = await fetch(`/api/generate/status?id=${jobId}${apiKey ? `&apiKey=${encodeURIComponent(apiKey)}` : ''}`);
          const data = await res.json();

          if (data.status === 'completed' && data.resultUrl) {
            clearInterval(pollInterval);
            pollingRefs.current.delete(jobId);
            setResults((prev) =>
              prev.map((r) =>
                r.slotIndex === slotIndex
                  ? { ...r, status: 'completed', resultUrl: data.resultUrl, cost: data.cost || null }
                  : r
              )
            );
          } else if (data.status === 'failed') {
            clearInterval(pollInterval);
            pollingRefs.current.delete(jobId);
            setResults((prev) =>
              prev.map((r) =>
                r.slotIndex === slotIndex
                  ? { ...r, status: 'failed', error: data.error || 'Generation failed' }
                  : r
              )
            );
          }
        } catch {
          clearInterval(pollInterval);
          pollingRefs.current.delete(jobId);
          setResults((prev) =>
            prev.map((r) =>
              r.slotIndex === slotIndex
                ? { ...r, status: 'failed', error: 'Polling error' }
                : r
            )
          );
        }
      }, 3000);

      pollingRefs.current.set(jobId, pollInterval);
    },
    [apiKeysHook]
  );

  // Generate all slots in parallel
  const handleGenerateAll = useCallback(async () => {
    if (!sharedPrompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    // Check all slots have provider and model
    const validSlots = compareSlots.filter((s) => s.providerId && s.modelId);
    if (validSlots.length === 0) {
      toast.error('Please configure at least one slot with a provider and model');
      return;
    }

    // Check API keys
    for (const slot of validSlots) {
      const hasKey = apiKeysHook.hasKey(slot.providerId);
      if (!hasKey) {
        const prov = providers.find((p) => p.id === slot.providerId);
        toast.error(`No API key for ${prov?.displayName || slot.providerId}`);
        return;
      }
    }

    setIsGenerating(true);

    // Initialize results for all slots
    const initialResults: CompareResult[] = compareSlots.map((slot, i) => ({
      slotIndex: i,
      status: slot.providerId && slot.modelId ? 'generating' : 'idle',
      resultUrl: null,
      error: null,
      cost: null,
      providerName: providers.find((p) => p.id === slot.providerId)?.displayName || '',
      modelName:
        providers
          .find((p) => p.id === slot.providerId)
          ?.models.find((m) => m.modelId === slot.modelId)?.name || '',
      providerColor: providers.find((p) => p.id === slot.providerId)?.color || '',
    }));
    setResults(initialResults);

    // Fire all generations in parallel
    const promises = validSlots.map(async (slot) => {
      const slotIndex = compareSlots.indexOf(slot);
      const providerData = providers.find((p) => p.id === slot.providerId);
      const modelData = providerData?.models.find((m) => m.modelId === slot.modelId);

      try {
        const apiKey = await apiKeysHook.getKeyForProvider(slot.providerId);
        if (!apiKey) {
          setResults((prev) =>
            prev.map((r) =>
              r.slotIndex === slotIndex
                ? { ...r, status: 'failed', error: 'No API key' }
                : r
            )
          );
          return;
        }

        const body = {
          providerId: slot.providerId,
          modelId: slot.modelId,
          prompt: sharedPrompt.trim(),
          negativePrompt: sharedNegPrompt.trim() || undefined,
          aspectRatio: imageAspectRatio,
          quality: imageQuality,
          steps: imageSteps,
          guidance: imageGuidance,
          seed: imageSeed ?? undefined,
          batchSize: 1,
          apiKey,
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
          // Direct result
          setResults((prev) =>
            prev.map((r) =>
              r.slotIndex === slotIndex
                ? {
                    ...r,
                    status: 'completed',
                    resultUrl: data.urls[0] || null,
                  }
                : r
            )
          );
        } else if (data.status === 'processing' && data.id) {
          // Async - start polling
          startPollingForResult(
            data.id,
            slotIndex,
            providerData?.displayName || '',
            modelData?.name || '',
            providerData?.color || '',
            slot.providerId
          );
        } else {
          throw new Error('Unexpected response');
        }
      } catch (err) {
        setResults((prev) =>
          prev.map((r) =>
            r.slotIndex === slotIndex
              ? {
                  ...r,
                  status: 'failed',
                  error: err instanceof Error ? err.message : 'Generation failed',
                }
              : r
          )
        );
      }
    });

    await Promise.allSettled(promises);
    setIsGenerating(false);
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
    startPollingForResult,
  ]);

  // Add/remove slot
  const addSlot = useCallback(() => {
    if (compareSlots.length >= 3) return;
    setCompareSlots([...compareSlots, { providerId: '', modelId: '' }]);
    setResults((prev) => [
      ...prev,
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
    setCompareSlots(compareSlots.slice(0, -1));
    setResults((prev) => prev.slice(0, -1));
  }, [compareSlots, setCompareSlots]);

  // Handle provider/model change with result reset
  const handleProviderChange = useCallback(
    (slotIndex: number, providerId: string) => {
      updateCompareSlot(slotIndex, { providerId, modelId: '' });
      setResults((prev) =>
        prev.map((r) =>
          r.slotIndex === slotIndex
            ? { ...r, status: 'idle', resultUrl: null, error: null }
            : r
        )
      );
    },
    [updateCompareSlot]
  );

  const handleModelChange = useCallback(
    (slotIndex: number, modelId: string) => {
      updateCompareSlot(slotIndex, { modelId });
      setResults((prev) =>
        prev.map((r) =>
          r.slotIndex === slotIndex
            ? { ...r, status: 'idle', resultUrl: null, error: null }
            : r
        )
      );
    },
    [updateCompareSlot]
  );

  // Handle "Use This"
  const handleUseThis = useCallback(
    (url: string, onUseResult: (url: string) => void) => {
      onUseResult(url);
      setIsCompareOpen(false);
      toast.success('Result loaded into Image Studio');
    },
    [setIsCompareOpen]
  );

  // Derived state
  const allCompleted = results.every(
    (r) => r.status === 'completed' || r.status === 'idle'
  );
  const anyGenerating = results.some((r) => r.status === 'generating') || isGenerating;

  return {
    // Store-backed state
    isCompareOpen,
    setIsCompareOpen,
    compareSlots,
    // Provider data
    providers,
    providersLoading,
    apiKeysHook,
    // Prompt state
    sharedPrompt,
    setSharedPrompt,
    sharedNegPrompt,
    setSharedNegPrompt,
    // Results
    results,
    setResults,
    // Actions
    handleGenerateAll,
    addSlot,
    removeSlot,
    handleProviderChange,
    handleModelChange,
    handleUseThis,
    // Derived
    anyGenerating,
  };
}
