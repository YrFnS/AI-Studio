'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Download,
  Heart,
  ImagePlus,
  Loader2,
  Sparkles,
  Wand2,
  RefreshCw,
  Share2,
  Clock,
  Key,
  Settings2,
  Check,
  Cpu,
  Timer,
  ChevronUp,
  ChevronDown,
  Palette,
  Maximize2,
  Layers,
  Film,
  Paintbrush,
  Copy,
  Grid3x3,
  Zap,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { STYLE_PRESETS } from '@/components/studio/presets';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Provider } from '@/components/studio/image-studio-types';

// ---------------------------------------------------------------------------
// Image Studio Result Display Component
// ---------------------------------------------------------------------------

interface ImageStudioResultProps {
  providers: Provider[];
  selectedImageProvider: string;
  selectedImageModel: string;
  selectedProviderData: Provider | null;
  hasApiKey: boolean;
  configuredCount: number;
  activeImageUrl: string | null;
  currentJobId: string | null;
  onDownload: (url: string) => void;
  onFavorite: (id: string) => void;
  onPostGenAction: (action: 'upscale' | 'variation' | 'improve' | 'img2vid') => void;
  onGenerate: () => void;
  onOpenEditor: (imageUrl: string) => void;
  onSetReference: (url: string) => void;
  onSetSocialExportOpen: (open: boolean) => void;
  onSetActiveTab: (tab: string) => void;
}

export function ImageStudioResult({
  providers,
  selectedImageProvider,
  selectedImageModel,
  selectedProviderData,
  hasApiKey,
  configuredCount,
  activeImageUrl,
  currentJobId,
  onDownload,
  onFavorite,
  onPostGenAction,
  onGenerate,
  onOpenEditor,
  onSetReference,
  onSetSocialExportOpen,
  onSetActiveTab,
}: ImageStudioResultProps) {
  // Read state from store
  const isImageGenerating = useAppStore((s) => s.isImageGenerating);
  const latestResult = useAppStore((s) => s.latestResult);
  const generationResults = useAppStore((s) => s.generationResults);
  const selectedResultIndex = useAppStore((s) => s.selectedResultIndex);
  const setSelectedResultIndex = useAppStore((s) => s.setSelectedResultIndex);
  const imagePrompt = useAppStore((s) => s.imagePrompt);
  const imageNegativePrompt = useAppStore((s) => s.imageNegativePrompt);
  const imageAspectRatio = useAppStore((s) => s.imageAspectRatio);
  const imageSteps = useAppStore((s) => s.imageSteps);
  const imageGuidance = useAppStore((s) => s.imageGuidance);
  const imageSeed = useAppStore((s) => s.imageSeed);
  const imageBatchSize = useAppStore((s) => s.imageBatchSize);
  const activeStylePreset = useAppStore((s) => s.activeStylePreset);
  const isPostGenProcessing = useAppStore((s) => s.isPostGenProcessing);
  const postGenAction = useAppStore((s) => s.postGenAction);
  const generationDuration = useAppStore((s) => s.generationDuration);

  const isMobile = useIsMobile();

  // Local state for loading animation
  const [genElapsed, setGenElapsed] = useState(0);
  const [genMsgIndex, setGenMsgIndex] = useState(0);
  const genStartTimeRef = useRef<number | null>(null);

  // Generation info card state
  const [infoCardVisible, setInfoCardVisible] = useState(true);
  const [infoDetailsOpen, setInfoDetailsOpen] = useState(false);
  const infoCardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived
  const imageModels = selectedProviderData?.models.filter((m) => m.type === 'image') ?? [];

  // Generation loading: start timer & rotate messages
  useEffect(() => {
    if (isImageGenerating) {
      genStartTimeRef.current = Date.now();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset counters when generation starts
      setGenElapsed(0);
      setGenMsgIndex(0);
    } else {
      genStartTimeRef.current = null;
    }
  }, [isImageGenerating]);

  useEffect(() => {
    if (!isImageGenerating || !genStartTimeRef.current) return;
    const interval = setInterval(() => {
      if (genStartTimeRef.current) {
        setGenElapsed(Math.floor((Date.now() - genStartTimeRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isImageGenerating]);

  useEffect(() => {
    if (!isImageGenerating) return;
    const interval = setInterval(() => {
      setGenMsgIndex((prev) => (prev + 1) % 4);
    }, 2000);
    return () => clearInterval(interval);
  }, [isImageGenerating]);

  // Info card auto-hide when a new result appears
  useEffect(() => {
    if (latestResult) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset info card when new result appears
      setInfoCardVisible(true);
      setInfoDetailsOpen(false);
      if (infoCardTimerRef.current) clearTimeout(infoCardTimerRef.current);
      infoCardTimerRef.current = setTimeout(() => setInfoCardVisible(false), 5000);
      return () => {
        if (infoCardTimerRef.current) clearTimeout(infoCardTimerRef.current);
      };
    }
  }, [latestResult]);

  return (
    <div className="flex-1 flex items-center justify-center p-4 md:p-6">
      <AnimatePresence mode="wait">
        {/* --- Onboarding Card (no API keys configured) --- */}
        {!isImageGenerating && !latestResult && configuredCount === 0 && (
          <motion.div
            key="onboarding"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass-card onboarding-glow rounded-2xl border border-[#d9ff00]/20 p-6 max-w-lg mx-auto text-center space-y-4"
          >
            {/* Gradient icon */}
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d9ff00]/20 to-[#00d4ff]/10 mx-auto">
              <Key className="h-8 w-8 text-[#d9ff00]" />
            </div>

            <h3 className="text-xl font-bold text-foreground">Welcome to AI Studio</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              To start generating images, you&apos;ll need to add an API key from at least one AI provider.
              We support 16 providers including OpenAI, Stability AI, and more.
            </p>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="glass rounded-lg p-3 stat-card-hover">
                <span className="text-2xl">🎨</span>
                <p className="text-[10px] text-muted-foreground mt-1">100+ Models</p>
              </div>
              <div className="glass rounded-lg p-3 stat-card-hover">
                <span className="text-2xl">⚡</span>
                <p className="text-[10px] text-muted-foreground mt-1">Smart Presets</p>
              </div>
              <div className="glass rounded-lg p-3 stat-card-hover">
                <span className="text-2xl">🔒</span>
                <p className="text-[10px] text-muted-foreground mt-1">BYOK Security</p>
              </div>
            </div>

            <Button onClick={() => onSetActiveTab('settings')} className="gap-2 bg-[#d9ff00] text-background font-semibold hover:bg-[#c5eb00]">
              <Settings2 className="h-4 w-4" />
              Add API Key
            </Button>
          </motion.div>
        )}

        {/* --- Empty State --- */}
        {!isImageGenerating && !latestResult && configuredCount > 0 && (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center gap-8 text-center w-full max-w-2xl relative"
          >
            {/* Animated gradient background */}
            <div className="absolute inset-0 -m-8 rounded-3xl bg-gradient-to-br from-[#d9ff00]/5 via-transparent to-[#d9ff00]/3 animate-empty-gradient pointer-events-none" />
            <div className="absolute inset-0 -m-8 rounded-3xl bg-gradient-to-tl from-transparent via-[#d9ff00]/2 to-[#d9ff00]/4 animate-empty-gradient pointer-events-none" style={{ animationDelay: '4s' }} />

            {/* Floating icon with pulsing glow */}
            <div className="relative z-10">
              <div className="absolute -inset-6 rounded-full bg-[#d9ff00]/5 blur-3xl animate-empty-glow" />
              <motion.div
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="relative flex h-32 w-32 items-center justify-center rounded-3xl border border-[#d9ff00]/20 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-sm shadow-[0_0_40px_rgba(217,255,0,0.08)]"
              >
                <motion.div
                  animate={{ scale: [1, 1.08, 1], rotate: [0, 3, -3, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Sparkles className="h-14 w-14 text-[#d9ff00]/70" />
                </motion.div>
              </motion.div>
            </div>

            <div className="relative z-10">
              <h3 className="text-2xl font-bold text-foreground tracking-tight">
                Generate your first image
              </h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md leading-relaxed">
                Choose a provider and model, write a prompt, and click Generate to create stunning AI images.
              </p>
            </div>

            {/* Feature hint cards */}
            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white/5 border border-white/10 rounded-xl p-4 text-left hover:border-[#d9ff00]/20 hover:bg-white/[0.07] transition-all group cursor-default"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-lg">🎨</span>
                  <span className="text-xs font-semibold text-foreground group-hover:text-[#d9ff00] transition-colors">Smart Presets</span>
                </div>
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed">Customize style, lighting, mood with one click</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="bg-white/5 border border-white/10 rounded-xl p-4 text-left hover:border-[#d9ff00]/20 hover:bg-white/[0.07] transition-all group cursor-default"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-lg">📚</span>
                  <span className="text-xs font-semibold text-foreground group-hover:text-[#d9ff00] transition-colors">Prompt Library</span>
                </div>
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed">Save, organize, and reuse your best prompts</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white/5 border border-white/10 rounded-xl p-4 text-left hover:border-[#d9ff00]/20 hover:bg-white/[0.07] transition-all group cursor-default"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-lg">✨</span>
                  <span className="text-xs font-semibold text-foreground group-hover:text-[#d9ff00] transition-colors">AI Enhance</span>
                </div>
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed">Auto-enhance prompts for stunning results</p>
              </motion.div>
            </div>

            <div className="relative z-10 flex items-center justify-center gap-2 text-xs text-muted-foreground/50">
              <Zap className="h-3.5 w-3.5 text-[#d9ff00]/50" />
              <span>16 providers • 100+ models • Instant generation</span>
            </div>
          </motion.div>
        )}

        {/* --- Loading State --- */}
        {isImageGenerating && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center gap-6 text-center w-full max-w-md"
          >
            <div className="relative flex h-32 w-32 items-center justify-center">
              {/* Pulsing ring */}
              <div className="absolute inset-0 rounded-full border-2 border-[#d9ff00]/20 animate-neon-pulse" />
              <div className="absolute inset-3 rounded-full border-2 border-[#d9ff00]/40 animate-neon-pulse [animation-delay:0.5s]" />
              <div className="absolute inset-6 rounded-full border-2 border-[#d9ff00]/60 animate-neon-pulse [animation-delay:1s]" />
              <Sparkles className="h-10 w-10 text-[#d9ff00] animate-neon-pulse" />
            </div>

            <div className="space-y-3 w-full">
              <h3 className="text-lg font-semibold text-foreground">Generating your image…</h3>

              {/* Rotating context-aware messages */}
              <AnimatePresence mode="wait">
                <motion.p
                  key={genMsgIndex}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3 }}
                  className="text-sm text-muted-foreground"
                >
                  {[
                    '🎨 Crafting your vision...',
                    '✨ Adding fine details...',
                    '🖌️ Refining composition...',
                    '🔍 Enhancing quality...',
                  ][genMsgIndex]}
                </motion.p>
              </AnimatePresence>

              {/* Stylized progress bar */}
              <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div className="absolute inset-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-[#d9ff00] to-transparent animate-gen-progress" />
              </div>

              {/* Elapsed time counter */}
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/50">
                <Clock className="h-3 w-3" />
                <span>{genElapsed}s elapsed</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* --- Result State --- */}
        {!isImageGenerating && latestResult && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center gap-4 w-full max-w-3xl"
          >
            {/* Image container */}
            <div
              className="relative w-full overflow-hidden rounded-xl border border-border/40 bg-surface shadow-2xl group"
              onMouseEnter={() => setInfoCardVisible(true)}
              onMouseLeave={() => {
                if (infoCardTimerRef.current) clearTimeout(infoCardTimerRef.current);
                infoCardTimerRef.current = setTimeout(() => {
                  if (!infoDetailsOpen) setInfoCardVisible(false);
                }, 2000);
              }}
            >
              <img
                src={activeImageUrl || ''}
                alt={imagePrompt}
                className="w-full h-auto max-h-[60vh] object-contain"
              />

              {/* Generation Info Card overlay */}
              <AnimatePresence>
                {infoCardVisible && selectedProviderData && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-3 right-3 max-w-[280px] sm:max-w-[320px] rounded-xl bg-black/60 backdrop-blur-xl border border-white/10 p-3 text-left animate-info-card"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: selectedProviderData.color || '#888' }} />
                        <span className="text-[11px] font-semibold text-white/90 truncate">{selectedProviderData.displayName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInfoDetailsOpen(!infoDetailsOpen)}
                        className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-md hover:bg-white/10 transition-colors"
                      >
                        {infoDetailsOpen ? (
                          <ChevronDown className="h-3 w-3 text-white/60" />
                        ) : (
                          <ChevronUp className="h-3 w-3 text-white/60" />
                        )}
                      </button>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Cpu className="h-3 w-3 text-white/40" />
                      <span className="text-[10px] text-white/50 truncate">
                        {imageModels.find((m) => m.modelId === selectedImageModel)?.name || selectedImageModel}
                      </span>
                      {generationDuration !== null && (
                        <span className="flex items-center gap-0.5 text-[10px] text-[#d9ff00]/70 ml-auto">
                          <Timer className="h-3 w-3" />
                          {generationDuration.toFixed(1)}s
                        </span>
                      )}
                    </div>

                    {/* Expandable details */}
                    <AnimatePresence>
                      {infoDetailsOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 pt-2 border-t border-white/10 space-y-1.5">
                            {imagePrompt && (
                              <div>
                                <span className="text-[9px] font-medium text-[#d9ff00]/70 uppercase tracking-wider">Prompt</span>
                                <p className="text-[10px] text-white/60 leading-relaxed line-clamp-3">{imagePrompt}</p>
                              </div>
                            )}
                            {imageNegativePrompt && (
                              <div>
                                <span className="text-[9px] font-medium text-red-400/70 uppercase tracking-wider">Negative</span>
                                <p className="text-[10px] text-white/50 leading-relaxed line-clamp-2">{imageNegativePrompt}</p>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                              {imageAspectRatio && imageAspectRatio !== '1:1' && (
                                <span className="text-[9px] text-white/40">{imageAspectRatio}</span>
                              )}
                              {imageSteps > 0 && (
                                <span className="text-[9px] text-white/40">{imageSteps} steps</span>
                              )}
                              {imageGuidance > 0 && (
                                <span className="text-[9px] text-white/40">CFG {imageGuidance}</span>
                              )}
                              {imageSeed !== null && imageSeed > 0 && (
                                <span className="text-[9px] text-white/40">Seed {imageSeed}</span>
                              )}
                              {imageBatchSize > 1 && (
                                <span className="text-[9px] text-white/40">×{imageBatchSize}</span>
                              )}
                              {activeStylePreset && (
                                <span className="text-[9px] text-[#d9ff00]/50">{STYLE_PRESETS.find(p => p.id === activeStylePreset)?.label}</span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Batch thumbnail grid */}
            {generationResults.length > 1 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="w-full rounded-xl bg-gradient-to-br from-white/[0.03] via-transparent to-[#d9ff00]/[0.02] border border-white/5 p-3"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#d9ff00]/10">
                    <Grid3x3 className="h-3 w-3 text-[#d9ff00]" />
                  </div>
                  <span className="text-[11px] font-semibold text-foreground/80">
                    {generationResults.length} images generated
                  </span>
                  <span className="text-[10px] text-muted-foreground/50 ml-1">— click to select</span>
                </div>
                <div className={`grid gap-2 ${
                  generationResults.length <= 2
                    ? 'grid-cols-2'
                    : generationResults.length <= 4
                      ? 'grid-cols-2 sm:grid-cols-4'
                      : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6'
                }`}>
                  {generationResults.map((url, idx) => (
                    <button
                      key={url + idx}
                      type="button"
                      onClick={() => setSelectedResultIndex(idx)}
                      className={`relative aspect-square overflow-hidden rounded-lg transition-colors ${
                        selectedResultIndex === idx
                          ? 'ring-2 ring-[#d9ff00] ring-offset-2 ring-offset-background animate-selected-glow'
                          : 'border border-border/40 hover:border-[#d9ff00]/40 hover:shadow-[0_0_8px_rgba(217,255,0,0.15)]'
                      }`}
                    >
                      <img
                        src={url}
                        alt={`Result ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {/* Index badge */}
                      <span className={`absolute top-1 left-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        selectedResultIndex === idx
                          ? 'bg-[#d9ff00] text-background'
                          : 'bg-background/80 text-muted-foreground'
                      }`}>
                        {idx + 1}
                      </span>
                      {/* Selected checkmark badge */}
                      {selectedResultIndex === idx && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#d9ff00] text-background"
                        >
                          <Check className="h-3 w-3" />
                        </motion.div>
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Post-Generation Action Bar */}
            <div className="w-full space-y-3">
              {/* Primary actions row */}
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDownload(activeImageUrl || '')}
                  className="gap-1.5 border-border/60 bg-surface hover:bg-surface-hover"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSetSocialExportOpen(true)}
                  className="gap-1.5 border-[#d9ff00]/30 bg-[#d9ff00]/5 text-[#d9ff00] hover:bg-[#d9ff00]/10 hover:border-[#d9ff00]/50"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (currentJobId) onFavorite(currentJobId);
                    else toast.info('Added to favorites');
                  }}
                  className="gap-1.5 border-border/60 bg-surface hover:bg-surface-hover"
                >
                  <Heart className="h-3.5 w-3.5" />
                  Favorite
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onGenerate}
                  className="gap-1.5 border-border/60 bg-surface hover:bg-surface-hover"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const promptToCopy = imagePrompt;
                        if (promptToCopy) {
                          navigator.clipboard.writeText(promptToCopy);
                          toast.success('Prompt copied to clipboard!');
                        } else {
                          toast.info('No prompt to copy');
                        }
                      }}
                      className="gap-1.5 border-border/60 bg-surface hover:bg-surface-hover"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy Prompt
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">Copy the enhanced prompt used for generation</TooltipContent>
                </Tooltip>
              </div>

              {/* Continue Customizing section */}
              <div className="glass-strong rounded-xl border border-[#d9ff00]/20 p-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#d9ff00]/10">
                    <Wand2 className="h-3 w-3 text-[#d9ff00]" />
                  </div>
                  <span className="text-xs font-semibold text-[#d9ff00] uppercase tracking-wider">Continue Customizing</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {/* Upscale */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.button
                        type="button"
                        disabled={isPostGenProcessing}
                        onClick={() => onPostGenAction('upscale')}
                        className="min-w-0 overflow-hidden flex flex-col items-center gap-1 rounded-lg border border-border/40 bg-surface px-2 py-2 text-center transition-all hover:border-[#d9ff00]/40 hover:bg-[#d9ff00]/5 group disabled:opacity-40"
                      >
                        <Maximize2 className="h-4 w-4 text-muted-foreground group-hover:text-[#d9ff00] transition-colors" />
                        <span className="text-[9px] font-medium text-muted-foreground group-hover:text-[#d9ff00] transition-colors">Upscale</span>
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">Increase resolution 2x or 4x</TooltipContent>
                  </Tooltip>

                  {/* Variations */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.button
                        type="button"
                        disabled={isPostGenProcessing}
                        onClick={() => onPostGenAction('variation')}
                        className="min-w-0 overflow-hidden flex flex-col items-center gap-1 rounded-lg border border-border/40 bg-surface px-2 py-2 text-center transition-all hover:border-[#d9ff00]/40 hover:bg-[#d9ff00]/5 group disabled:opacity-40"
                      >
                        <Layers className="h-4 w-4 text-muted-foreground group-hover:text-[#d9ff00] transition-colors" />
                        <span className="text-[9px] font-medium text-muted-foreground group-hover:text-[#d9ff00] transition-colors">Variations</span>
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">Create variations of this image</TooltipContent>
                  </Tooltip>

                  {/* Improve / Enhance */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.button
                        type="button"
                        disabled={isPostGenProcessing}
                        onClick={() => onPostGenAction('improve')}
                        className="min-w-0 overflow-hidden flex flex-col items-center gap-1 rounded-lg border border-border/40 bg-surface px-2 py-2 text-center transition-all hover:border-[#d9ff00]/40 hover:bg-[#d9ff00]/5 group disabled:opacity-40"
                      >
                        <Sparkles className="h-4 w-4 text-muted-foreground group-hover:text-[#d9ff00] transition-colors" />
                        <span className="text-[9px] font-medium text-muted-foreground group-hover:text-[#d9ff00] transition-colors">Improve</span>
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">Enhance quality and details</TooltipContent>
                  </Tooltip>

                  {/* Image to Video */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.button
                        type="button"
                        disabled={isPostGenProcessing || !['runway', 'luma', 'fal', 'replicate', 'seedance'].includes(selectedImageProvider)}
                        onClick={() => onPostGenAction('img2vid')}
                        className="min-w-0 overflow-hidden flex flex-col items-center gap-1 rounded-lg border border-border/40 bg-surface px-2 py-2 text-center transition-all hover:border-[#d9ff00]/40 hover:bg-[#d9ff00]/5 group disabled:opacity-40"
                      >
                        <Film className="h-4 w-4 text-muted-foreground group-hover:text-[#d9ff00] transition-colors" />
                        <span className="text-[9px] font-medium text-muted-foreground group-hover:text-[#d9ff00] transition-colors">To Video</span>
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {['runway', 'luma', 'fal', 'replicate', 'seedance'].includes(selectedImageProvider)
                        ? 'Animate this image into a video'
                        : 'Switch to a video-capable provider (Runway, Luma, Fal, Replicate) to use this'}
                    </TooltipContent>
                  </Tooltip>

                  {/* Inpaint / Edit */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.button
                        type="button"
                        disabled={isPostGenProcessing}
                        onClick={() => onOpenEditor(activeImageUrl || '')}
                        className="min-w-0 overflow-hidden flex flex-col items-center gap-1 rounded-lg border border-border/40 bg-surface px-2 py-2 text-center transition-all hover:border-[#d9ff00]/40 hover:bg-[#d9ff00]/5 group disabled:opacity-40"
                      >
                        <Paintbrush className="h-4 w-4 text-muted-foreground group-hover:text-[#d9ff00] transition-colors" />
                        <span className="text-[9px] font-medium text-muted-foreground group-hover:text-[#d9ff00] transition-colors">Inpaint</span>
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">Paint a mask and edit specific areas</TooltipContent>
                  </Tooltip>

                  {/* Use as Reference */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.button
                        type="button"
                        onClick={() => onSetReference(activeImageUrl || '')}
                        className="min-w-0 overflow-hidden flex flex-col items-center gap-1 rounded-lg border border-border/40 bg-surface px-2 py-2 text-center transition-all hover:border-[#d9ff00]/40 hover:bg-[#d9ff00]/5 group"
                      >
                        <ImagePlus className="h-4 w-4 text-muted-foreground group-hover:text-[#d9ff00] transition-colors" />
                        <span className="text-[9px] font-medium text-muted-foreground group-hover:text-[#d9ff00] transition-colors">Reference</span>
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">Use as reference for next generation</TooltipContent>
                  </Tooltip>
                </div>

                {/* Processing indicator */}
                <AnimatePresence>
                  {isPostGenProcessing && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2 rounded-lg bg-[#d9ff00]/5 border border-[#d9ff00]/20 px-3 py-2"
                    >
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#d9ff00]" />
                      <span className="text-[11px] text-[#d9ff00] font-medium">
                        {postGenAction === 'upscale' && 'Upscaling image…'}
                        {postGenAction === 'variation' && 'Creating variation…'}
                        {postGenAction === 'improve' && 'Enhancing image…'}
                        {postGenAction === 'img2vid' && 'Converting to video…'}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Prompt echo */}
            <p className="text-xs text-muted-foreground/60 max-w-lg text-center line-clamp-2">
              &ldquo;{imagePrompt}&rdquo;
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
