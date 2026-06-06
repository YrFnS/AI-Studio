'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  Sparkles,
  Film,
  ImageIcon,
  Clock,
  RatioIcon,
  Camera,
  RotateCcw,
  Clapperboard,
  Ghost,
  ArrowRightToLine,
  ArrowLeftToLine,
} from 'lucide-react';

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
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { PromptSuggestions } from '@/components/studio/prompt-suggestions';

import type { Provider, ProviderModel } from './video-studio-presets';
import {
  VIDEO_STYLE_PRESETS,
  CAMERA_MOTION_PRESETS,
  VIDEO_MOOD_PRESETS,
  VIDEO_ASPECT_RATIOS,
  RATIO_LABELS,
} from './video-studio-presets';

import { ImageUploadSlot } from './video-studio-image-upload';
import { VideoCostBadge, CollapsibleSectionHeader, PresetGrid } from './video-studio-preset-grid';

// ---------------------------------------------------------------------------
// VideoSidebarContent (shared between desktop and mobile)
// ---------------------------------------------------------------------------

export function VideoSidebarContent({
  providers,
  providersLoading,
  selectedVideoProvider,
  setSelectedVideoProvider,
  selectedVideoModel,
  setSelectedVideoModel,
  selectedProviderData,
  videoModels,
  hasApiKey,
  configuredProviderIds,
  videoPrompt,
  setVideoPrompt,
  videoDuration,
  setVideoDuration,
  videoAspectRatio,
  setVideoAspectRatio,
  referenceImageUrl,
  setReferenceImageUrl,
  isVideoGenerating,
  onGenerate,
  onMobileClose,
  videoStyle,
  setVideoStyle,
  videoCameraMotion,
  setVideoCameraMotion,
  videoMood,
  setVideoMood,
  onResetPresets,
  videoStartFrameUrl,
  setVideoStartFrameUrl,
  videoEndFrameUrl,
  setVideoEndFrameUrl,
}: {
  providers: Provider[];
  providersLoading: boolean;
  selectedVideoProvider: string;
  setSelectedVideoProvider: (v: string) => void;
  selectedVideoModel: string;
  setSelectedVideoModel: (v: string) => void;
  selectedProviderData: Provider | null;
  videoModels: ProviderModel[];
  hasApiKey: boolean;
  configuredProviderIds: string[];
  videoPrompt: string;
  setVideoPrompt: (v: string) => void;
  videoDuration: number;
  setVideoDuration: (v: number) => void;
  videoAspectRatio: string;
  setVideoAspectRatio: (v: string) => void;
  referenceImageUrl: string | null;
  setReferenceImageUrl: (v: string | null) => void;
  isVideoGenerating: boolean;
  onGenerate: () => void;
  onMobileClose?: () => void;
  videoStyle: string;
  setVideoStyle: (v: string) => void;
  videoCameraMotion: string;
  setVideoCameraMotion: (v: string) => void;
  videoMood: string;
  setVideoMood: (v: string) => void;
  onResetPresets: () => void;
  videoStartFrameUrl: string | null;
  setVideoStartFrameUrl: (url: string | null) => void;
  videoEndFrameUrl: string | null;
  setVideoEndFrameUrl: (url: string | null) => void;
}) {
  // Collapsible section states
  const [styleOpen, setStyleOpen] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);
  const [promptFocused, setPromptFocused] = useState(false);

  // Active counts for badges
  const activeStyleCount = videoStyle !== 'none' ? 1 : 0;
  const activeCameraCount = videoCameraMotion !== 'none' ? 1 : 0;
  const activeMoodCount = videoMood !== 'none' ? 1 : 0;
  const totalActivePresets = activeStyleCount + activeCameraCount + activeMoodCount;

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#d9ff00]/10">
          <Film className="h-4 w-4 text-[#d9ff00]" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Video Generation</h2>
          <p className="text-xs text-muted-foreground">Create videos from text or images</p>
        </div>
      </div>

      <Separator className="opacity-40" />

      {/* ----- Model Selector ----- */}
      <div className="space-y-3">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Provider & Model
        </Label>

        {/* Provider select */}
        <Select
          value={selectedVideoProvider}
          onValueChange={(v) => setSelectedVideoProvider(v)}
        >
          <SelectTrigger className="w-full bg-surface border-border/60">
            <SelectValue placeholder="Select provider…">
              {selectedProviderData ? (
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: selectedProviderData.color || '#888' }}
                  />
                  {selectedProviderData.displayName}
                </span>
              ) : (
                'Select provider…'
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-border/60">
            {providersLoading ? (
              <SelectItem value="__loading" disabled>
                Loading…
              </SelectItem>
            ) : (
              providers
                .filter((p) => p.models.some((m) => m.type === 'video'))
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
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

        {/* Model select */}
        <Select
          value={selectedVideoModel}
          onValueChange={(v) => setSelectedVideoModel(v)}
          disabled={!selectedVideoProvider || videoModels.length === 0}
        >
          <SelectTrigger className="w-full bg-surface border-border/60">
            <SelectValue placeholder="Select model…" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-border/60">
            {videoModels.map((m) => (
              <SelectItem key={m.id} value={m.modelId}>
                <span className="flex items-center justify-between gap-2">
                  <span>{m.name}</span>
                  {m.priceInfo && (
                    <span className="text-[10px] text-muted-foreground">{m.priceInfo}</span>
                  )}
                </span>
              </SelectItem>
            ))}
            {videoModels.length === 0 && selectedVideoProvider && (
              <SelectItem value="__none" disabled>
                No video models available
              </SelectItem>
            )}
          </SelectContent>
        </Select>

        {/* Model capabilities badge */}
        {selectedVideoModel && videoModels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(() => {
              const model = videoModels.find((m) => m.modelId === selectedVideoModel);
              if (!model) return null;
              const caps = model.capabilities.split(',');
              return caps.map((cap) => (
                <Badge
                  key={cap}
                  variant="secondary"
                  className="h-5 bg-surface-hover text-[10px] text-muted-foreground"
                >
                  {cap === 't2v' ? 'Text → Video' : cap === 'i2v' ? 'Image → Video' : cap}
                </Badge>
              ));
            })()}
          </div>
        )}

        {/* No-key warning */}
        {selectedVideoProvider && !hasApiKey && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
          >
            No API key configured for this provider. Go to Settings to add one.
          </motion.div>
        )}
      </div>

      <Separator className="opacity-40" />

      {/* ----- Prompt ----- */}
      <div className="space-y-2">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Prompt
        </Label>
        <div className="relative">
          <Textarea
            value={videoPrompt}
            onChange={(e) => setVideoPrompt(e.target.value)}
            onFocus={() => setPromptFocused(true)}
            onBlur={() => setTimeout(() => setPromptFocused(false), 200)}
            placeholder="Describe the video you want to create..."
            className="min-h-[120px] resize-none bg-surface border-border/60 text-sm placeholder:text-muted-foreground/50 focus-visible:ring-[#d9ff00]/30"
          />
          <PromptSuggestions
            partial={videoPrompt.slice(-50)}
            context="video"
            onSelect={(completion) => setVideoPrompt(videoPrompt + completion)}
            visible={promptFocused}
            onClose={() => setPromptFocused(false)}
          />
        </div>
      </div>

      <Separator className="opacity-40" />

      {/* ----- Video Style Presets (Collapsible) ----- */}
      <div className="space-y-2">
        <CollapsibleSectionHeader
          icon={<Clapperboard className="h-4 w-4 text-[#d9ff00]" />}
          label="Video Style"
          activeCount={activeStyleCount}
          isOpen={styleOpen}
          onToggle={() => setStyleOpen(!styleOpen)}
        />
        <AnimatePresence>
          {styleOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <PresetGrid
                presets={VIDEO_STYLE_PRESETS}
                activeId={videoStyle}
                onSelect={setVideoStyle}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Separator className="opacity-40" />

      {/* ----- Camera Motion Presets (Collapsible) ----- */}
      <div className="space-y-2">
        <CollapsibleSectionHeader
          icon={<Camera className="h-4 w-4 text-[#d9ff00]" />}
          label="Camera Motion"
          activeCount={activeCameraCount}
          isOpen={cameraOpen}
          onToggle={() => setCameraOpen(!cameraOpen)}
        />
        <AnimatePresence>
          {cameraOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <PresetGrid
                presets={CAMERA_MOTION_PRESETS}
                activeId={videoCameraMotion}
                onSelect={setVideoCameraMotion}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Separator className="opacity-40" />

      {/* ----- Mood Presets (Collapsible) ----- */}
      <div className="space-y-2">
        <CollapsibleSectionHeader
          icon={<Ghost className="h-4 w-4 text-[#d9ff00]" />}
          label="Mood"
          activeCount={activeMoodCount}
          isOpen={moodOpen}
          onToggle={() => setMoodOpen(!moodOpen)}
        />
        <AnimatePresence>
          {moodOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <PresetGrid
                presets={VIDEO_MOOD_PRESETS}
                activeId={videoMood}
                onSelect={setVideoMood}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Separator className="opacity-40" />

      {/* ----- Duration ----- */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            Duration
          </Label>
          <span className="text-xs font-mono text-[#d9ff00]">{videoDuration}s</span>
        </div>
        <Slider
          value={[videoDuration]}
          onValueChange={([v]) => setVideoDuration(v)}
          min={2}
          max={10}
          step={1}
          className="w-full"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground/60">
          <span>2s</span>
          <span>10s</span>
        </div>
      </div>

      <Separator className="opacity-40" />

      {/* ----- Aspect Ratio ----- */}
      <div className="space-y-2">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <RatioIcon className="h-3 w-3" />
          Aspect Ratio
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {VIDEO_ASPECT_RATIOS.map((ratio) => (
            <button
              key={ratio}
              type="button"
              onClick={() => setVideoAspectRatio(ratio)}
              className={`
                relative flex flex-col items-center gap-0.5 rounded-lg border px-2 py-3 text-center min-w-0 overflow-hidden transition-colors
                ${
                  videoAspectRatio === ratio
                    ? 'border-[#d9ff00] bg-[#d9ff00]/15 text-[#d9ff00]'
                    : 'border-transparent bg-surface/60 text-muted-foreground hover:bg-surface hover:text-foreground hover:border-border/40'
                }
              `}
            >
              {/* Mini preview rectangle */}
              <span
                className={`
                  inline-block rounded-sm bg-current opacity-30
                  ${ratio === '1:1' ? 'h-4 w-4' : ''}
                  ${ratio === '16:9' ? 'h-2.5 w-4.5' : ''}
                  ${ratio === '9:16' ? 'h-4.5 w-2.5' : ''}
                `}
              />
              <span className="text-[11px] font-semibold">{ratio}</span>
              <span className="text-[8px] opacity-60">{RATIO_LABELS[ratio]}</span>
            </button>
          ))}
        </div>
      </div>

      <Separator className="opacity-40" />

      {/* ----- Reference Image (Image-to-Video) ----- */}
      <div className="space-y-2">
        <ImageUploadSlot
          value={referenceImageUrl || null}
          onChange={setReferenceImageUrl}
          label={
            <span className="flex items-center gap-1.5">
              <ImageIcon className="h-3 w-3" />
              Reference Image
            </span>
          }
          description="Provide an image to guide the video generation (image-to-video)"
        />
      </div>

      <Separator className="opacity-40" />

      {/* ----- Start Frame ----- */}
      <div className="space-y-2">
        <ImageUploadSlot
          value={videoStartFrameUrl}
          onChange={setVideoStartFrameUrl}
          label={
            <span className="flex items-center gap-1.5">
              <ArrowLeftToLine className="h-3 w-3" />
              Start Frame
            </span>
          }
          description="Define the first frame of the video"
        />
      </div>

      <Separator className="opacity-40" />

      {/* ----- End Frame ----- */}
      <div className="space-y-2">
        <ImageUploadSlot
          value={videoEndFrameUrl}
          onChange={setVideoEndFrameUrl}
          label={
            <span className="flex items-center gap-1.5">
              <ArrowRightToLine className="h-3 w-3" />
              End Frame
            </span>
          }
          description="Define the last frame of the video"
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* ----- Reset Presets + Generate Button ----- */}
      <div className="space-y-1.5">
        {/* Reset Presets Button */}
        {totalActivePresets > 0 && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            onClick={onResetPresets}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/30 bg-surface px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-border/60 transition-all"
          >
            <RotateCcw className="h-3 w-3" />
            Reset Presets
            <Badge className="h-4 min-w-[18px] px-1 text-[9px] font-bold bg-[#d9ff00]/15 text-[#d9ff00] border-[#d9ff00]/30">
              {totalActivePresets}
            </Badge>
          </motion.button>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button
                onClick={() => { onGenerate(); onMobileClose?.(); }}
                disabled={isVideoGenerating || !hasApiKey || !videoPrompt.trim() || !selectedVideoModel}
                className={`
                  w-full h-12 text-base font-semibold rounded-xl transition-all
                  ${
                    isVideoGenerating
                      ? 'bg-[#d9ff00]/20 text-[#d9ff00] cursor-wait'
                      : !hasApiKey || !selectedVideoModel
                        ? 'bg-surface text-muted-foreground cursor-not-allowed'
                        : 'bg-[#d9ff00] text-background hover:bg-[#c5eb00] neon-glow-strong'
                  }
                `}
              >
                {isVideoGenerating ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Generating…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Generate Video
                  </span>
                )}
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <span className="flex items-center gap-1.5">
              Generate video
              <kbd className="rounded border border-border/60 bg-surface px-1.5 py-0.5 text-[10px] font-mono">⌘Enter</kbd>
            </span>
          </TooltipContent>
        </Tooltip>
        {/* Cost estimator badge */}
        {selectedVideoModel && hasApiKey && (
          <VideoCostBadge providerId={selectedVideoProvider} modelId={selectedVideoModel} duration={videoDuration} />
        )}
      </div>

      {/* Subtle hint */}
      {!hasApiKey && selectedVideoProvider && (
        <p className="text-center text-[10px] text-muted-foreground/60">
          Add an API key in Settings to enable video generation
        </p>
      )}
    </div>
  );
}
