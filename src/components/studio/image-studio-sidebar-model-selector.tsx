'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Provider } from '@/components/studio/image-studio-types';

// ---------------------------------------------------------------------------
// Model Selector — Provider & Model selection with API key warning
// ---------------------------------------------------------------------------

interface ModelSelectorProps {
  providers: Provider[];
  providersLoading: boolean;
  hasApiKey: boolean;
  configuredProviderIds: string[];
}

export function ModelSelector({
  providers,
  providersLoading,
  hasApiKey,
  configuredProviderIds,
}: ModelSelectorProps) {
  const selectedImageProvider = useAppStore((s) => s.selectedImageProvider);
  const setSelectedImageProvider = useAppStore((s) => s.setSelectedImageProvider);
  const selectedImageModel = useAppStore((s) => s.selectedImageModel);
  const setSelectedImageModel = useAppStore((s) => s.setSelectedImageModel);

  const [warningDismissed, setWarningDismissed] = useState(false);

  const selectedProviderData = providers.find((p) => p.id === selectedImageProvider) ?? null;
  const imageModels = selectedProviderData?.models.filter((m) => m.type === 'image') ?? [];

  return (
    <div className="space-y-3">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Provider & Model
      </Label>

      <Select value={selectedImageProvider} onValueChange={setSelectedImageProvider}>
        <SelectTrigger className="w-full bg-surface border-border/60">
          <SelectValue placeholder="Select provider…">
            {selectedProviderData ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedProviderData.color || '#888' }} />
                {selectedProviderData.displayName}
              </span>
            ) : 'Select provider…'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-[#1a1a1a] border-border/60">
          {providersLoading ? (
            <SelectItem value="__loading" disabled>Loading…</SelectItem>
          ) : (
            providers.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color || '#888' }} />
                  {p.displayName}
                  {configuredProviderIds.includes(p.id) ? (
                    <Badge variant="secondary" className="ml-auto h-4 bg-[#d9ff00]/10 text-[8px] text-[#d9ff00]">KEY</Badge>
                  ) : (
                    <Badge variant="secondary" className="ml-auto h-4 bg-destructive/10 text-[8px] text-destructive">NO KEY</Badge>
                  )}
                </span>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      <Select value={selectedImageModel} onValueChange={setSelectedImageModel} disabled={!selectedImageProvider || imageModels.length === 0}>
        <SelectTrigger className="w-full bg-surface border-border/60">
          <SelectValue placeholder="Select model…" />
        </SelectTrigger>
        <SelectContent className="bg-[#1a1a1a] border-border/60">
          {imageModels.map((m) => (
            <SelectItem key={m.id} value={m.modelId}>
              <span className="flex items-center justify-between gap-2">
                <span>{m.name}</span>
                {m.priceInfo && <span className="text-[10px] text-muted-foreground">{m.priceInfo}</span>}
              </span>
            </SelectItem>
          ))}
          {imageModels.length === 0 && selectedImageProvider && (
            <SelectItem value="__none" disabled>No image models available</SelectItem>
          )}
        </SelectContent>
      </Select>

      {selectedImageProvider && !hasApiKey && !warningDismissed && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="warning-slide-in relative rounded-lg bg-red-500/10 border border-red-500/20 backdrop-blur-sm p-3 pr-8 text-xs text-red-400"
        >
          No API key configured for this provider. Go to Settings to add one.
          <button
            type="button"
            onClick={() => setWarningDismissed(true)}
            className="absolute top-2 right-2 text-red-400/60 hover:text-red-400 transition-colors"
            aria-label="Dismiss warning"
          >
            <X className="h-3 w-3" />
          </button>
        </motion.div>
      )}
    </div>
  );
}
