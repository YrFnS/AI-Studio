'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  GitCompareArrows,
  Loader2,
  Sparkles,
  X,
  Plus,
  Minus,
  DollarSign,
  Image as ImageIcon,
  Check,
} from 'lucide-react';

import { useAppStore } from '@/lib/store';
import { useApiKeys } from '@/hooks/use-api-keys';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProviderModel {
  id: string;
  name: string;
  modelId: string;
  type: string;
  capabilities: string;
  description?: string;
  priceInfo?: string;
  isDefault: boolean;
}

interface Provider {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  color?: string;
  icon?: string;
  models: ProviderModel[];
}

interface CompareResult {
  slotIndex: number;
  status: 'idle' | 'generating' | 'completed' | 'failed';
  resultUrl: string | null;
  error: string | null;
  cost: string | null;
  providerName: string;
  modelName: string;
  providerColor: string;
  jobId?: string;
}

// ---------------------------------------------------------------------------
// Cost Estimate Helper
// ---------------------------------------------------------------------------

function SlotCostBadge({ providerId, modelId }: { providerId: string; modelId: string }) {
  const [cost, setCost] = useState<string | null>(null);

  useEffect(() => {
    if (!providerId || !modelId) return;
    const controller = new AbortController();
    fetch('/api/cost-estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId, modelId, params: { batchSize: 1 } }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => setCost(data.estimatedCost || 'varies'))
      .catch(() => setCost('varies'));
    return () => controller.abort();
  }, [providerId, modelId]);

  if (!cost) return null;

  return (
    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
      <DollarSign className="h-3 w-3" />
      Est. {cost}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Compare Slot Column
// ---------------------------------------------------------------------------

function CompareSlotColumn({
  index,
  providers,
  providersLoading,
  configuredProviderIds,
  slotProviderId,
  slotModelId,
  onProviderChange,
  onModelChange,
  result,
  onUseThis,
  apiKeysHook,
}: {
  index: number;
  providers: Provider[];
  providersLoading: boolean;
  configuredProviderIds: string[];
  slotProviderId: string;
  slotModelId: string;
  onProviderChange: (providerId: string) => void;
  onModelChange: (modelId: string) => void;
  result: CompareResult;
  onUseThis: (url: string) => void;
  apiKeysHook: ReturnType<typeof useApiKeys>;
}) {
  const selectedProvider = providers.find((p) => p.id === slotProviderId);
  const imageModels = (selectedProvider?.models || []).filter(
    (m) => m.type === 'image' && m.capabilities.includes('t2i')
  );
  const hasApiKey = apiKeysHook.hasKey(slotProviderId);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/40 bg-surface/60 p-4 backdrop-blur-sm">
      {/* Slot header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#d9ff00]/10 text-xs font-bold text-[#d9ff00]">
            {index + 1}
          </span>
          <span className="text-xs font-medium text-foreground">Model {index + 1}</span>
        </div>
        {result.status === 'completed' && result.cost && (
          <Badge variant="secondary" className="text-[9px] bg-[#d9ff00]/10 text-[#d9ff00]">
            ~{result.cost}
          </Badge>
        )}
      </div>

      {/* Provider selector */}
      <div className="space-y-2">
        <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Provider
        </Label>
        <Select value={slotProviderId} onValueChange={onProviderChange}>
          <SelectTrigger className="w-full bg-surface border-border/60 text-xs h-9">
            <SelectValue placeholder="Select provider...">
              {selectedProvider ? (
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: selectedProvider.color || '#888' }}
                  />
                  {selectedProvider.displayName}
                </span>
              ) : (
                'Select provider...'
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-border/60">
            {providersLoading ? (
              <SelectItem value="__loading" disabled>
                Loading...
              </SelectItem>
            ) : (
              providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="flex items-center gap-2 text-xs">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: p.color || '#888' }}
                    />
                    {p.displayName}
                    {configuredProviderIds.includes(p.id) ? (
                      <Badge
                        variant="secondary"
                        className="ml-auto h-4 bg-[#d9ff00]/10 text-[8px] text-[#d9ff00]"
                      >
                        KEY
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="ml-auto h-4 bg-destructive/10 text-[8px] text-destructive"
                      >
                        NO KEY
                      </Badge>
                    )}
                  </span>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Model selector */}
      <div className="space-y-2">
        <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Model
        </Label>
        <Select
          value={slotModelId}
          onValueChange={onModelChange}
          disabled={!slotProviderId || imageModels.length === 0}
        >
          <SelectTrigger className="w-full bg-surface border-border/60 text-xs h-9">
            <SelectValue placeholder="Select model..." />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-border/60">
            {imageModels.map((m) => (
              <SelectItem key={m.id} value={m.modelId}>
                <span className="flex items-center justify-between gap-2 text-xs">
                  <span>{m.name}</span>
                  {m.priceInfo && (
                    <span className="text-[9px] text-muted-foreground">{m.priceInfo}</span>
                  )}
                </span>
              </SelectItem>
            ))}
            {imageModels.length === 0 && slotProviderId && (
              <SelectItem value="__none" disabled>
                No image models available
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Cost estimate */}
      {slotProviderId && slotModelId && (
        <SlotCostBadge providerId={slotProviderId} modelId={slotModelId} />
      )}

      {/* API key warning */}
      {slotProviderId && !hasApiKey && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-[10px] text-destructive">
          No API key configured
        </div>
      )}

      {/* Result area */}
      <div className="mt-1 flex-1 min-h-[180px] flex items-center justify-center">
        <AnimatePresence mode="wait">
          {result.status === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2 text-center"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-border/30 bg-surface">
                <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
              </div>
              <p className="text-[10px] text-muted-foreground/50">Select provider & model</p>
            </motion.div>
          )}

          {result.status === 'generating' && (
            <motion.div
              key="generating"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center gap-3 text-center"
            >
              <div className="relative flex h-20 w-20 items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-[#d9ff00]/20 animate-neon-pulse" />
                <div className="absolute inset-2 rounded-full border-2 border-[#d9ff00]/40 animate-neon-pulse [animation-delay:0.5s]" />
                <Sparkles className="h-7 w-7 text-[#d9ff00] animate-neon-pulse" />
              </div>
              <p className="text-[10px] text-muted-foreground">Generating...</p>
            </motion.div>
          )}

          {result.status === 'completed' && result.resultUrl && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center gap-2 w-full"
            >
              <div className="relative w-full overflow-hidden rounded-lg border border-border/40 bg-surface">
                <img
                  src={result.resultUrl}
                  alt={`Compare result ${index + 1}`}
                  className="w-full h-auto max-h-[200px] object-contain"
                />
              </div>
              <Button
                size="sm"
                onClick={() => onUseThis(result.resultUrl!)}
                className="w-full h-8 text-xs gap-1.5 bg-[#d9ff00] text-background hover:bg-[#c5eb00] font-semibold rounded-lg"
              >
                <Check className="h-3.5 w-3.5" />
                Use This
              </Button>
            </motion.div>
          )}

          {result.status === 'failed' && (
            <motion.div
              key="failed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center gap-2 text-center"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5">
                <X className="h-6 w-6 text-destructive" />
              </div>
              <p className="text-[10px] text-destructive">
                {result.error || 'Generation failed'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Provider/model label on result */}
      {result.status !== 'idle' && (
        <div className="flex items-center gap-1.5 mt-auto pt-2 border-t border-border/20">
          <span
            className="inline-block h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: result.providerColor || '#888' }}
          />
          <span className="text-[9px] text-muted-foreground truncate">
            {result.providerName} / {result.modelName}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ModelCompare({
  defaultPrompt,
  defaultNegativePrompt,
  defaultProviderId,
  defaultModelId,
  onUseResult,
}: {
  defaultPrompt: string;
  defaultNegativePrompt: string;
  defaultProviderId: string;
  defaultModelId: string;
  onUseResult: (url: string) => void;
}) {
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
            (m: ProviderModel) => m.type === 'image' && m.capabilities?.includes('t2i')
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
        compareSlots.map((_, i) => ({
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
    const promises = validSlots.map(async (slot, idx) => {
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
  const addSlot = () => {
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
  };

  const removeSlot = () => {
    if (compareSlots.length <= 2) return;
    setCompareSlots(compareSlots.slice(0, -1));
    setResults((prev) => prev.slice(0, -1));
  };

  // Handle "Use This"
  const handleUseThis = (url: string) => {
    onUseResult(url);
    setIsCompareOpen(false);
    toast.success('Result loaded into Image Studio');
  };

  const allCompleted = results.every(
    (r) => r.status === 'completed' || r.status === 'idle'
  );
  const anyGenerating = results.some((r) => r.status === 'generating') || isGenerating;

  return (
    <Dialog open={isCompareOpen} onOpenChange={setIsCompareOpen}>
      <DialogContent className="glass-strong sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <GitCompareArrows className="h-5 w-5 text-[#d9ff00]" />
            Model Comparison
          </DialogTitle>
          <DialogDescription className="sr-only">
            Compare image generation results across different models side by side
          </DialogDescription>
        </DialogHeader>

        {/* Shared prompt controls */}
        <div className="space-y-3 px-1">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Shared Prompt
            </Label>
            <Textarea
              value={sharedPrompt}
              onChange={(e) => setSharedPrompt(e.target.value)}
              placeholder="Enter a prompt to compare across models..."
              className="min-h-[70px] resize-none bg-surface border-border/60 text-sm placeholder:text-muted-foreground/50 focus-visible:ring-[#d9ff00]/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Negative Prompt
            </Label>
            <Textarea
              value={sharedNegPrompt}
              onChange={(e) => setSharedNegPrompt(e.target.value)}
              placeholder="Things to avoid..."
              className="min-h-[50px] resize-none bg-surface border-border/60 text-sm placeholder:text-muted-foreground/50 focus-visible:ring-[#d9ff00]/30"
            />
          </div>
        </div>

        <Separator className="opacity-30" />

        {/* Slot count controls */}
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-muted-foreground">
            {compareSlots.length} model{compareSlots.length > 1 ? 's' : ''} to compare
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={removeSlot}
              disabled={compareSlots.length <= 2}
              className="h-7 w-7 p-0 border-border/60"
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="text-xs font-mono text-[#d9ff00] min-w-[16px] text-center">
              {compareSlots.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={addSlot}
              disabled={compareSlots.length >= 3}
              className="h-7 w-7 p-0 border-border/60"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Comparison columns */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div
            className={`grid gap-3 px-1 pb-2 ${
              compareSlots.length === 2
                ? 'grid-cols-1 md:grid-cols-2'
                : 'grid-cols-1 md:grid-cols-3'
            }`}
          >
            {compareSlots.map((slot, i) => (
              <CompareSlotColumn
                key={i}
                index={i}
                providers={providers}
                providersLoading={providersLoading}
                configuredProviderIds={apiKeysHook.configuredProviderIds}
                slotProviderId={slot.providerId}
                slotModelId={slot.modelId}
                onProviderChange={(pid) => {
                  updateCompareSlot(i, { providerId: pid, modelId: '' });
                  // Reset result when changing provider
                  setResults((prev) =>
                    prev.map((r) =>
                      r.slotIndex === i
                        ? { ...r, status: 'idle', resultUrl: null, error: null }
                        : r
                    )
                  );
                }}
                onModelChange={(mid) => {
                  updateCompareSlot(i, { modelId: mid });
                  // Reset result when changing model
                  setResults((prev) =>
                    prev.map((r) =>
                      r.slotIndex === i
                        ? { ...r, status: 'idle', resultUrl: null, error: null }
                        : r
                    )
                  );
                }}
                result={results[i] || {
                  slotIndex: i,
                  status: 'idle',
                  resultUrl: null,
                  error: null,
                  cost: null,
                  providerName: '',
                  modelName: '',
                  providerColor: '',
                }}
                onUseThis={handleUseThis}
                apiKeysHook={apiKeysHook}
              />
            ))}
          </div>
        </ScrollArea>

        <Separator className="opacity-30" />

        {/* Generate All button */}
        <div className="flex items-center gap-3 px-1">
          <Button
            onClick={handleGenerateAll}
            disabled={anyGenerating || !sharedPrompt.trim()}
            className={`flex-1 h-11 text-sm font-semibold rounded-xl transition-all ${
              anyGenerating
                ? 'bg-[#d9ff00]/20 text-[#d9ff00] cursor-wait'
                : 'bg-[#d9ff00] text-background hover:bg-[#c5eb00]'
            }`}
          >
            {anyGenerating ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Generate All
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsCompareOpen(false)}
            className="border-border/60"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
