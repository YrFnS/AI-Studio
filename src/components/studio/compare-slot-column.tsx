'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign,
  Image as ImageIcon,
  Check,
  X,
  Sparkles,
} from 'lucide-react';

import { useApiKeys } from '@/hooks/use-api-keys';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { Provider, ProviderModel, CompareResult } from './model-compare-types';

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

export function CompareSlotColumn({
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
    (m: ProviderModel) => m.type === 'image' && m.capabilities.includes('t2i')
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
