'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  ChevronDown,
  Wand2,
  X,
  Monitor,
  Loader2,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ImageUpload } from '@/components/studio/image-upload';
import {
  ASPECT_RATIOS,
  RATIO_LABELS,
  RESOLUTION_TIERS,
  TIER_LABELS,
  RESOLUTION_MAP,
} from '@/components/studio/presets';
import { SidebarPresets } from '@/components/studio/image-studio-sidebar-presets';
import { SidebarAdvanced } from '@/components/studio/image-studio-sidebar-advanced';
import { SmartPreviewCard, PresetsSummaryLine } from '@/components/studio/image-studio-sidebar-smart-preview';
import { ModelSelector } from '@/components/studio/image-studio-sidebar-model-selector';
import { GenerateButtonArea } from '@/components/studio/image-studio-sidebar-generate-button';
import { PromptHistory } from '@/components/studio/prompt-history';
import { PromptLibrary } from '@/components/studio/prompt-library';
import { PromptSuggestions } from '@/components/studio/prompt-suggestions';
import type { Provider } from '@/components/studio/image-studio-types';

// ---------------------------------------------------------------------------
// Sidebar Content (shared between desktop and mobile)
// REBUILT: No framer-motion, CSS-only transitions throughout
// All sections that previously returned null now use max-h-0/opacity-0
// to stay in the DOM and prevent layout shifts
// ---------------------------------------------------------------------------

interface SidebarContentProps {
  providers: Provider[];
  providersLoading: boolean;
  hasApiKey: boolean;
  configuredProviderIds: string[];
  onGenerate: () => void;
  onMobileClose?: () => void;
  onCompare: () => void;
}

export function SidebarContent({
  providers,
  providersLoading,
  hasApiKey,
  configuredProviderIds,
  onGenerate,
  onMobileClose,
  onCompare,
}: SidebarContentProps) {
  // Read state from the Zustand store
  const imagePrompt = useAppStore((s) => s.imagePrompt);
  const setImagePrompt = useAppStore((s) => s.setImagePrompt);
  const imageNegativePrompt = useAppStore((s) => s.imageNegativePrompt);
  const setImageNegativePrompt = useAppStore((s) => s.setImageNegativePrompt);
  const imageAspectRatio = useAppStore((s) => s.imageAspectRatio);
  const setImageAspectRatio = useAppStore((s) => s.setImageAspectRatio);
  const imageResolutionTier = useAppStore((s) => s.imageResolutionTier);
  const setImageResolutionTier = useAppStore((s) => s.setImageResolutionTier);
  const inputImageUrl = useAppStore((s) => s.inputImageUrl);
  const setInputImageUrl = useAppStore((s) => s.setInputImageUrl);
  const imageAutoEnhance = useAppStore((s) => s.imageAutoEnhance);
  const selectedImageProvider = useAppStore((s) => s.selectedImageProvider);
  const selectedImageModel = useAppStore((s) => s.selectedImageModel);

  // Local state
  const [showNegPrompt, setShowNegPrompt] = useState(false);
  const [isEnhancingLocal, setIsEnhancingLocal] = useState(false);
  const [promptFocused, setPromptFocused] = useState(false);

  // Computed
  const computedDimensions = RESOLUTION_MAP[imageAspectRatio]?.[imageResolutionTier] ?? RESOLUTION_MAP['1:1']['hd'];

  return (
    <div className="flex flex-col gap-4 p-4 w-full min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#d9ff00]/10">
            <Wand2 className="h-3.5 w-3.5 text-[#d9ff00]" />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-foreground">Image Generation</h2>
            <p className="text-[10px] text-muted-foreground">Configure and generate</p>
          </div>
        </div>
      </div>

      {/* ----- Smart Prompt Builder Preview (always in DOM) ----- */}
      <SmartPreviewCard />

      {/* ----- Presets Summary Line (always in DOM) ----- */}
      <PresetsSummaryLine />

      <Separator className="opacity-30" />

      {/* ----- Model Selector ----- */}
      <ModelSelector
        providers={providers}
        providersLoading={providersLoading}
        hasApiKey={hasApiKey}
        configuredProviderIds={configuredProviderIds}
      />

      <Separator className="opacity-30" />

      {/* ----- Preset Sections ----- */}
      <SidebarPresets />

      <Separator className="opacity-30" />

      {/* ----- Prompt + History ----- */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Prompt
          </Label>
          <div className="flex items-center gap-1">
            {/* Prompt History */}
            <PromptHistory onSelectPrompt={setImagePrompt} />
            {/* Prompt Library */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => useAppStore.getState().setPromptLibraryOpen(true)}
                  className="flex items-center gap-0.5 rounded-md border border-border/30 bg-surface/60 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground hover:text-[#d9ff00] hover:border-[#d9ff00]/25 transition-colors duration-150 overflow-hidden"
                >
                  <BookOpen className="h-2.5 w-2.5" />
                  <span className="hidden sm:inline">Library</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Saved prompts & templates
              </TooltipContent>
            </Tooltip>
            <PromptLibrary onSelectPrompt={setImagePrompt} />
            {/* AI Enhance */}
            <button
              type="button"
              onClick={async () => {
                if (!imagePrompt.trim()) { toast.error('Enter a prompt first'); return; }
                setIsEnhancingLocal(true);
                try {
                  const res = await fetch('/api/enhance-prompt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: imagePrompt, type: 'enhance' }),
                  });
                  const data = await res.json();
                  if (data.enhancedPrompt) { setImagePrompt(data.enhancedPrompt); toast.success('Prompt enhanced with AI!'); }
                  else { toast.error(data.error || 'Enhancement failed'); }
                } catch { toast.error('Failed to enhance prompt'); }
                finally { setIsEnhancingLocal(false); }
              }}
              disabled={isEnhancingLocal || !imagePrompt.trim()}
              className="flex items-center gap-0.5 rounded-md border border-[#d9ff00]/25 bg-[#d9ff00]/5 px-1.5 py-0.5 text-[9px] font-medium text-[#d9ff00] hover:bg-[#d9ff00]/10 transition-colors duration-150 disabled:opacity-40 overflow-hidden"
            >
              {isEnhancingLocal ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Wand2 className="h-2.5 w-2.5" />}
              {isEnhancingLocal ? 'Enhancing...' : 'Enhance'}
            </button>
            {/* Auto-Enhance Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    const newVal = !imageAutoEnhance;
                    useAppStore.getState().setImageAutoEnhance(newVal);
                    toast.success(newVal ? 'Auto-enhance enabled' : 'Auto-enhance disabled');
                  }}
                  className={`flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[9px] font-medium transition-colors duration-150 overflow-hidden ${
                    imageAutoEnhance
                      ? 'border-[#d9ff00]/40 bg-[#d9ff00]/10 text-[#d9ff00]'
                      : 'border-border/30 bg-surface/60 text-muted-foreground hover:border-border/50'
                  }`}
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  Auto
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                {imageAutoEnhance
                  ? 'Auto-enhance ON — prompts enhanced before generation'
                  : 'Turn on to auto-enhance every prompt'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="relative">
          <Textarea
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
            onFocus={() => setPromptFocused(true)}
            onBlur={() => setTimeout(() => setPromptFocused(false), 200)}
            placeholder="Describe the image you want to create..."
            className="min-h-[100px] resize-none bg-surface/60 border-border/40 text-sm placeholder:text-muted-foreground/40 focus-visible:ring-[#d9ff00]/25 transition-colors duration-150"
          />
          <PromptSuggestions
            partial={imagePrompt.slice(-50)}
            context="image"
            onSelect={(completion) => setImagePrompt(imagePrompt + completion)}
            visible={promptFocused}
            onClose={() => setPromptFocused(false)}
          />
        </div>
      </div>

      {/* ----- Negative Prompt (CSS-only collapsible) ----- */}
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => setShowNegPrompt(!showNegPrompt)}
          className="flex w-full items-center justify-between text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors duration-150 h-[24px]"
        >
          Negative Prompt
          <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${showNegPrompt ? 'rotate-180' : ''}`} />
        </button>
        <div
          className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out ${
            showNegPrompt ? 'max-h-[120px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <Textarea
            value={imageNegativePrompt}
            onChange={(e) => setImageNegativePrompt(e.target.value)}
            placeholder="Things to avoid in the image..."
            className="min-h-[70px] resize-none bg-surface/60 border-border/40 text-sm placeholder:text-muted-foreground/40 focus-visible:ring-[#d9ff00]/25 transition-colors duration-150"
          />
        </div>
      </div>

      <Separator className="opacity-30" />

      {/* ----- Output Size ----- */}
      <div className="space-y-2">
        <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <Monitor className="h-2.5 w-2.5" />
          Output Size
        </Label>
        <div className="grid grid-cols-4 gap-1">
          {ASPECT_RATIOS.map((ratio) => (
            <button
              key={ratio}
              type="button"
              onClick={() => setImageAspectRatio(ratio)}
              className={`relative flex flex-col items-center gap-0.5 rounded-md border px-1 py-1.5 text-center min-w-0 overflow-hidden h-[48px] w-full transition-colors duration-150 ${
                imageAspectRatio === ratio
                  ? 'border-[#d9ff00] bg-[#d9ff00]/15 text-[#d9ff00]'
                  : 'border-transparent bg-surface/60 text-muted-foreground hover:bg-surface hover:text-foreground hover:border-border/40'
              }`}
            >
              <span className={`inline-block rounded-sm bg-current opacity-25 ${ratio === '1:1' ? 'h-3.5 w-3.5' : ''} ${ratio === '16:9' ? 'h-2 w-4' : ''} ${ratio === '9:16' ? 'h-4 w-2' : ''} ${ratio === '4:3' ? 'h-2.5 w-3.5' : ''} ${ratio === '3:4' ? 'h-3.5 w-2.5' : ''} ${ratio === '3:2' ? 'h-2.5 w-4' : ''} ${ratio === '2:3' ? 'h-4 w-2.5' : ''}`} />
              <span className="text-[9px] font-semibold">{ratio}</span>
              <span className="text-[7px] opacity-50">{RATIO_LABELS[ratio]}</span>
            </button>
          ))}
        </div>

        {/* Resolution Tier */}
        <div className="space-y-1">
          <Label className="text-[9px] text-muted-foreground/50">Resolution</Label>
          <div className="flex gap-1">
            {RESOLUTION_TIERS.map((tier) => {
              const dims = RESOLUTION_MAP[imageAspectRatio]?.[tier];
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setImageResolutionTier(tier)}
                  className={`flex-1 overflow-hidden rounded-md border px-1.5 py-1 text-center whitespace-nowrap h-[38px] transition-colors duration-150 ${
                    imageResolutionTier === tier
                      ? 'border-[#d9ff00] bg-[#d9ff00]/15 text-[#d9ff00]'
                      : 'border-transparent bg-surface/60 text-muted-foreground hover:bg-surface hover:text-foreground hover:border-border/40'
                  }`}
                >
                  <span className="text-[10px] font-medium">{TIER_LABELS[tier]}</span>
                  {dims && <span className="block text-[7px] opacity-50 font-mono">{dims.width}×{dims.height}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Computed output dimensions */}
        <div className="flex items-center justify-center gap-1">
          <span className="text-[9px] text-muted-foreground/40">Output:</span>
          <Badge variant="secondary" className="text-[8px] font-mono bg-[#d9ff00]/5 text-[#d9ff00]/60 border-[#d9ff00]/10 px-1.5 py-0">
            {computedDimensions.width} × {computedDimensions.height}
          </Badge>
        </div>
      </div>

      <Separator className="opacity-30" />

      {/* ----- Advanced Settings ----- */}
      <SidebarAdvanced
        providers={providers}
        selectedImageProvider={selectedImageProvider}
        selectedImageModel={selectedImageModel}
      />

      {/* ----- Reference Image Upload ----- */}
      <div className="space-y-1.5">
        <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Reference Image</Label>
        <ImageUpload onUploadComplete={(url) => setInputImageUrl(url)} onRemove={() => setInputImageUrl(null)} currentImageUrl={inputImageUrl} compact label="Upload Reference" />
        {inputImageUrl && (
          <div className="relative overflow-hidden rounded-md border border-[#d9ff00]/15 bg-[#d9ff00]/5">
            <img src={inputImageUrl} alt="Reference" className="h-20 w-full object-contain bg-black/40" />
            <div className="absolute bottom-1 right-1">
              <Button variant="ghost" size="icon" onClick={() => setInputImageUrl(null)} className="h-5 w-5 bg-black/60 text-white hover:bg-destructive hover:text-white">
                <X className="h-2.5 w-2.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* ----- Generate Button Area ----- */}
      <GenerateButtonArea
        onGenerate={onGenerate}
        onMobileClose={onMobileClose}
        onCompare={onCompare}
        hasApiKey={hasApiKey}
      />
    </div>
  );
}
