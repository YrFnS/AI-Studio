'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

import { useApiKeys } from '@/hooks/use-api-keys';
import { useModelCompare } from '@/components/studio/use-model-compare';
import type {
  Provider,
  CompareResult,
} from '@/components/studio/model-compare-types';
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

function SlotCostBadge({ providerId, modelId }: {
  providerId: string;
  modelId: string;
}) {
  const [cost, setCost] = useState<string | null>(null);

  useEffect(() => {
    if (!providerId || !modelId) return;
    const controller = new AbortController();
    fetch('/api/cost-estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId,
        modelId,
        params: { batchSize: 1 },
      }),
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((payload) => setCost(payload.estimatedCost || 'varies'))
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
  const selectedProvider = providers.find(
    (provider) => provider.id === slotProviderId,
  );
  const imageModels = (selectedProvider?.models || []).filter(
    (model) => model.type === 'image' && model.capabilities.includes('t2i'),
  );
  const hasApiKey = apiKeysHook.hasKey(slotProviderId);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/40 bg-surface/60 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#d9ff00]/10 text-xs font-bold text-[#d9ff00]">
            {index + 1}
          </span>
          <span className="text-xs font-medium text-foreground">
            Model {index + 1}
          </span>
        </div>
        {result.status === 'completed' && result.cost && (
          <Badge
            variant="secondary"
            className="text-[9px] bg-[#d9ff00]/10 text-[#d9ff00]"
          >
            ~{result.cost}
          </Badge>
        )}
      </div>

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
                    style={{
                      backgroundColor: selectedProvider.color || '#888',
                    }}
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
              providers.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  <span className="flex items-center gap-2 text-xs">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: provider.color || '#888' }}
                    />
                    {provider.displayName}
                    {configuredProviderIds.includes(provider.id) ? (
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
            {imageModels.map((model) => (
              <SelectItem key={model.id} value={model.modelId}>
                <span className="flex items-center justify-between gap-2 text-xs">
                  <span>{model.name}</span>
                  {model.priceInfo && (
                    <span className="text-[9px] text-muted-foreground">
                      {model.priceInfo}
                    </span>
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

      {slotProviderId && slotModelId && (
        <SlotCostBadge
          providerId={slotProviderId}
          modelId={slotModelId}
        />
      )}

      {slotProviderId && !hasApiKey && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-[10px] text-destructive">
          No API key configured
        </div>
      )}

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
              <p className="text-[10px] text-muted-foreground/50">
                Select provider & model
              </p>
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
              <p className="text-[10px] text-muted-foreground">
                Generating...
              </p>
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
  } = useModelCompare(
    defaultPrompt,
    defaultNegativePrompt,
    defaultProviderId,
    defaultModelId,
  );

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

        <div className="space-y-3 px-1">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Shared Prompt
            </Label>
            <Textarea
              value={sharedPrompt}
              onChange={(event) => setSharedPrompt(event.target.value)}
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
              onChange={(event) => setSharedNegPrompt(event.target.value)}
              placeholder="Things to avoid..."
              className="min-h-[50px] resize-none bg-surface border-border/60 text-sm placeholder:text-muted-foreground/50 focus-visible:ring-[#d9ff00]/30"
            />
          </div>
        </div>

        <Separator className="opacity-30" />

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

        <ScrollArea className="flex-1 overflow-y-auto">
          <div
            className={`grid gap-3 px-1 pb-2 ${
              compareSlots.length === 2
                ? 'grid-cols-1 md:grid-cols-2'
                : 'grid-cols-1 md:grid-cols-3'
            }`}
          >
            {compareSlots.map((slot, index) => (
              <CompareSlotColumn
                key={index}
                index={index}
                providers={providers}
                providersLoading={providersLoading}
                configuredProviderIds={apiKeysHook.configuredProviderIds}
                slotProviderId={slot.providerId}
                slotModelId={slot.modelId}
                onProviderChange={(providerId) =>
                  handleProviderChange(index, providerId)
                }
                onModelChange={(modelId) =>
                  handleModelChange(index, modelId)
                }
                result={results[index] || {
                  slotIndex: index,
                  status: 'idle',
                  resultUrl: null,
                  error: null,
                  cost: null,
                  providerName: '',
                  modelName: '',
                  providerColor: '',
                }}
                onUseThis={(url) => handleUseThis(url, onUseResult)}
                apiKeysHook={apiKeysHook}
              />
            ))}
          </div>
        </ScrollArea>

        <Separator className="opacity-30" />

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
