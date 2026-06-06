'use client';

import { Sparkles, Loader2, Grid3x3, GitCompareArrows } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CostEstimateBadge } from '@/components/studio/image-studio-helpers';

// ---------------------------------------------------------------------------
// Generate Button Area — Batch Size Selector + Generate + Compare buttons
// ---------------------------------------------------------------------------

interface GenerateButtonAreaProps {
  onGenerate: () => void;
  onMobileClose?: () => void;
  onCompare: () => void;
  hasApiKey: boolean;
}

export function GenerateButtonArea({
  onGenerate,
  onMobileClose,
  onCompare,
  hasApiKey,
}: GenerateButtonAreaProps) {
  const isImageGenerating = useAppStore((s) => s.isImageGenerating);
  const imagePrompt = useAppStore((s) => s.imagePrompt);
  const selectedImageModel = useAppStore((s) => s.selectedImageModel);
  const selectedImageProvider = useAppStore((s) => s.selectedImageProvider);
  const imageBatchSize = useAppStore((s) => s.imageBatchSize);
  const setImageBatchSize = useAppStore((s) => s.setImageBatchSize);

  return (
    <>
      {/* ----- Batch Size Selector ----- */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Grid3x3 className="h-3 w-3" />
          Batch Size
        </Label>
        <div className="flex gap-1.5">
          {[1, 2, 4].map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setImageBatchSize(size)}
              className={`flex-1 whitespace-nowrap overflow-hidden rounded-md border px-2 py-1.5 text-center text-xs font-medium transition-colors duration-150 h-[36px] ${
                imageBatchSize === size
                  ? 'border-[#d9ff00] bg-[#d9ff00]/15 text-[#d9ff00]'
                  : 'border-transparent bg-surface/60 text-muted-foreground hover:bg-surface hover:text-foreground hover:border-border/40'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* ----- Generate + Compare Buttons ----- */}
      <div className="space-y-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => { onGenerate(); onMobileClose?.(); }}
              disabled={isImageGenerating || !hasApiKey || !imagePrompt.trim() || !selectedImageModel}
              className={`w-full h-12 text-base font-semibold rounded-xl transition-colors ${
                isImageGenerating
                  ? 'bg-[#d9ff00]/20 text-[#d9ff00] cursor-wait'
                  : !hasApiKey || !selectedImageModel
                    ? 'bg-surface text-muted-foreground cursor-not-allowed'
                    : imagePrompt.trim()
                      ? 'bg-[#d9ff00] text-background hover:bg-[#c5eb00] neon-glow-strong generate-btn-glow'
                      : 'bg-[#d9ff00] text-background hover:bg-[#c5eb00] neon-glow-strong'
              }`}
            >
              {isImageGenerating ? (
                <span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />Generating…</span>
              ) : (
                <span className="flex items-center gap-2"><Sparkles className="h-5 w-5" />Generate</span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <span className="flex items-center gap-1.5">
              Generate image
              <kbd className="rounded border border-border/60 bg-surface px-1.5 py-0.5 text-[10px] font-mono">⌘Enter</kbd>
            </span>
          </TooltipContent>
        </Tooltip>
        {/* Compare button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              onClick={() => { onCompare(); onMobileClose?.(); }}
              disabled={!imagePrompt.trim()}
              className="w-full h-10 text-sm font-medium rounded-xl gap-2 border-[#d9ff00]/30 bg-[#d9ff00]/5 text-[#d9ff00] hover:bg-[#d9ff00]/10 hover:text-[#d9ff00] hover:border-[#d9ff00]/50 transition-colors disabled:opacity-40"
            >
              <GitCompareArrows className="h-4 w-4" />
              Compare Models
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Generate the same prompt across 2-3 models side by side
          </TooltipContent>
        </Tooltip>
        {/* Cost estimator badge */}
        {selectedImageModel && hasApiKey && (
          <CostEstimateBadge providerId={selectedImageProvider} modelId={selectedImageModel} type="image" batchSize={imageBatchSize} duration={undefined} />
        )}
      </div>

      {!hasApiKey && selectedImageProvider && (
        <p className="text-center text-[10px] text-muted-foreground/60">Select a model to enable generation</p>
      )}
    </>
  );
}
