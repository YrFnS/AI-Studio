'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import * as idb from '@/lib/data';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  VideoIcon,
  ChevronDown,
  ChevronUp,
  Download,
  Heart,
  Loader2,
  Sparkles,
  Film,
  X,
  RefreshCw,
  ImageIcon,
  Play,
  Pause,
  Maximize2,
  Clock,
  RatioIcon,
  PanelLeftOpen,
  DollarSign,
  Camera,
  RotateCcw,
  Clapperboard,
  Ghost,
  Upload,
  Link,
  ArrowRightToLine,
  ArrowLeftToLine,
  History,
} from 'lucide-react';

import { useAppStore } from '@/lib/store';
import type { GenerationQueueItem } from '@/lib/store';
import { saveReferenceImage } from '@/lib/idb';
import { useApiKeys } from '@/hooks/use-api-keys';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { RecentBar } from '@/components/studio/recent-bar';
import { PromptSuggestions } from '@/components/studio/prompt-suggestions';
import { ReferenceImagePicker } from '@/components/studio/reference-image-picker';

// ---------------------------------------------------------------------------
// Cost Estimate Badge
// ---------------------------------------------------------------------------

function VideoCostBadge({ providerId, modelId, duration }: {
  providerId: string;
  modelId: string;
  duration: number;
}) {
  const [cost, setCost] = useState<string | null>(null);

  useEffect(() => {
    if (!providerId || !modelId) return;
    const controller = new AbortController();
    fetch('/api/cost-estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId, modelId, params: { duration } }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => setCost(data.estimatedCost || 'varies'))
      .catch(() => setCost('varies'));
    return () => controller.abort();
  }, [providerId, modelId, duration]);

  if (!cost) return null;

  return (
    <div className="flex items-center justify-center gap-1.5">
      <DollarSign className="h-3 w-3 text-muted-foreground/60" />
      <span className="text-[10px] text-muted-foreground/60">Est. {cost}</span>
    </div>
  );
}

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

// ---------------------------------------------------------------------------
// Aspect ratio config
// ---------------------------------------------------------------------------

const VIDEO_ASPECT_RATIOS = ['16:9', '9:16', '1:1'] as const;

const RATIO_LABELS: Record<string, string> = {
  '16:9': 'Landscape',
  '9:16': 'Portrait',
  '1:1': 'Square',
};

// ---------------------------------------------------------------------------
// Video Style Presets
// ---------------------------------------------------------------------------

const VIDEO_STYLE_PRESETS = [
  { id: 'cinematic', emoji: '🎬', label: 'Cinematic', suffix: ', cinematic video, film grain, dramatic camera movement, 24fps, movie scene' },
  { id: 'documentary', emoji: '📹', label: 'Documentary', suffix: ', documentary style, natural footage, observational, voice-over ready' },
  { id: 'commercial', emoji: '💼', label: 'Commercial', suffix: ', commercial video, product showcase, clean lighting, smooth camera' },
  { id: 'music-video', emoji: '🎵', label: 'Music Video', suffix: ', music video style, dynamic cuts, visual effects, rhythmic editing' },
  { id: 'slow-motion', emoji: '🐌', label: 'Slow Motion', suffix: ', slow motion video, high frame rate, fluid movement, time stretch' },
  { id: 'time-lapse', emoji: '⏰', label: 'Time-lapse', suffix: ', time-lapse video, accelerated time, sweeping movement, long exposure' },
  { id: 'loop', emoji: '🔁', label: 'Loop', suffix: ', seamless loop, perfectly looping video, continuous motion, endless cycle' },
  { id: 'animation', emoji: '🎨', label: 'Animation', suffix: ', animated video, motion graphics, smooth transitions, fluid animation' },
  { id: 'drone-shot', emoji: '🚁', label: 'Drone Shot', suffix: ', aerial drone footage, sweeping bird\'s eye view, smooth gliding camera' },
  { id: 'vlog', emoji: '📱', label: 'Vlog', suffix: ', vlog style, handheld camera, personal perspective, casual footage' },
];

// ---------------------------------------------------------------------------
// Camera Motion Presets
// ---------------------------------------------------------------------------

const CAMERA_MOTION_PRESETS = [
  { id: 'static', emoji: '📷', label: 'Static', suffix: ', static camera, locked off shot, no movement' },
  { id: 'pan-left', emoji: '⬅️', label: 'Pan Left', suffix: ', camera panning left, smooth horizontal movement' },
  { id: 'pan-right', emoji: '➡️', label: 'Pan Right', suffix: ', camera panning right, smooth horizontal movement' },
  { id: 'zoom-in', emoji: '🔍', label: 'Zoom In', suffix: ', camera zooming in, gradually closer, tight framing' },
  { id: 'zoom-out', emoji: '🔭', label: 'Zoom Out', suffix: ', camera zooming out, pulling back, revealing scene' },
  { id: 'orbit', emoji: '🔄', label: 'Orbit', suffix: ', camera orbiting around subject, 360 rotation' },
  { id: 'dolly', emoji: '🎬', label: 'Dolly', suffix: ', camera dollying forward, smooth tracking shot' },
  { id: 'crane-up', emoji: '⬆️', label: 'Crane Up', suffix: ', camera crane shot rising, ascending movement' },
  { id: 'crane-down', emoji: '⬇️', label: 'Crane Down', suffix: ', camera crane shot descending, lowering movement' },
  { id: 'shake', emoji: '📳', label: 'Shake', suffix: ', camera shake, handheld vibration, dynamic movement' },
];

// ---------------------------------------------------------------------------
// Video Mood Presets
// ---------------------------------------------------------------------------

const VIDEO_MOOD_PRESETS = [
  { id: 'dramatic', emoji: '🎭', label: 'Dramatic', suffix: ', dramatic mood, intense, powerful, cinematic tension' },
  { id: 'peaceful', emoji: '🕊️', label: 'Peaceful', suffix: ', peaceful mood, calm, serene, tranquil atmosphere' },
  { id: 'energetic', emoji: '⚡', label: 'Energetic', suffix: ', energetic mood, fast-paced, dynamic, high energy' },
  { id: 'mysterious', emoji: '🌙', label: 'Mysterious', suffix: ', mysterious mood, enigmatic, shadowy, suspenseful' },
  { id: 'romantic', emoji: '💕', label: 'Romantic', suffix: ', romantic mood, dreamy, warm, intimate' },
  { id: 'epic', emoji: '⚔️', label: 'Epic', suffix: ', epic mood, grand, monumental, awe-inspiring' },
  { id: 'nostalgic', emoji: '📼', label: 'Nostalgic', suffix: ', nostalgic mood, vintage feel, warm tones, reminiscent' },
  { id: 'futuristic', emoji: '🚀', label: 'Futuristic', suffix: ', futuristic mood, sci-fi, sleek, advanced technology' },
];

// ---------------------------------------------------------------------------
// Image Upload Slot (reusable for Reference / Start Frame / End Frame)
// ---------------------------------------------------------------------------

function ImageUploadSlot({
  value,
  onChange,
  label,
  description,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  label: React.ReactNode;
  description: string;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlMode, setUrlMode] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  // Handle file upload → convert to base64
  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Handle drag events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so the same file can be selected again
    e.target.value = '';
  };

  // Handle URL submission
  const handleUrlSubmit = () => {
    const trimmed = urlInput.trim();
    if (trimmed) {
      onChange(trimmed);
      setUrlInput('');
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        {label}
      </div>
      <p className="text-[10px] text-muted-foreground/60 -mt-1">{description}</p>

      {value ? (
        // Show preview with remove button
        <div className="relative group rounded-lg border border-border/40 overflow-hidden">
          <img
            src={value || ''}
            alt={typeof label === 'string' ? label : 'upload'}
            className="h-24 w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <motion.button
              type="button"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onChange(null)}
              className="rounded-full bg-destructive/90 p-1.5 text-white shadow-lg"
            >
              <X className="h-4 w-4" />
            </motion.button>
          </div>
          <Badge className="absolute top-1.5 left-1.5 h-4 px-1.5 text-[8px] bg-[#d9ff00]/20 text-[#d9ff00] border-[#d9ff00]/30 backdrop-blur-sm">
            SET
          </Badge>
        </div>
      ) : urlMode ? (
        // Show URL input
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUrlSubmit();
              }}
              placeholder="Paste image URL…"
              className="bg-surface border-border/60 text-sm placeholder:text-muted-foreground/40 focus-visible:ring-[#d9ff00]/30"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleUrlSubmit}
              className="shrink-0 border-border/60 bg-surface hover:bg-surface-hover"
            >
              <Link className="h-3.5 w-3.5" />
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setUrlMode(false)}
            className="text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            ← Back to upload
          </button>
        </div>
      ) : (
        // Show drag-and-drop zone
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed
            px-4 py-6 cursor-pointer transition-all
            ${isDragOver
              ? 'border-[#d9ff00]/60 bg-[#d9ff00]/5'
              : 'border-border/40 bg-surface hover:border-border/60 hover:bg-surface-hover'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <motion.div
            animate={isDragOver ? { scale: 1.15, y: -2 } : { scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <Upload className={`h-5 w-5 ${isDragOver ? 'text-[#d9ff00]' : 'text-muted-foreground/60'}`} />
          </motion.div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              {isDragOver ? 'Drop image here' : 'Click or drag to upload'}
            </p>
            <p className="text-[10px] text-muted-foreground/40 mt-0.5">PNG, JPG, WebP</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setUrlMode(true);
            }}
            className="text-[10px] text-[#d9ff00]/70 hover:text-[#d9ff00] transition-colors underline underline-offset-2"
          >
            Or paste URL
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible Section Header
// ---------------------------------------------------------------------------

function CollapsibleSectionHeader({
  icon,
  label,
  activeCount,
  isOpen,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  activeCount: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-lg border border-border/30 bg-surface px-3 py-2 hover:border-border/60 transition-all group"
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
          {label}
        </span>
        {activeCount > 0 && (
          <Badge className="h-4 min-w-[18px] px-1 text-[9px] font-bold bg-[#d9ff00]/15 text-[#d9ff00] border-[#d9ff00]/30">
            {activeCount}
          </Badge>
        )}
      </div>
      {isOpen ? (
        <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
      ) : (
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Preset Grid
// ---------------------------------------------------------------------------

function PresetGrid({
  presets,
  activeId,
  onSelect,
}: {
  presets: readonly { id: string; emoji: string; label: string; suffix: string }[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1">
      {presets.map((preset) => {
        const isActive = activeId === preset.id && preset.id !== 'none';
        return (
          <Tooltip key={preset.id}>
            <TooltipTrigger asChild>
              <motion.button
                type="button"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => onSelect(preset.id === activeId ? 'none' : preset.id)}
                className={`relative flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-center transition-all ${
                  isActive
                    ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_8px_rgba(217,255,0,0.15)]'
                    : 'border-border/30 bg-surface text-muted-foreground hover:border-border/60'
                }`}
              >
                <span className="text-sm">{preset.emoji}</span>
                <span className="text-[7px] font-medium leading-tight truncate w-full">{preset.label}</span>
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs max-w-[200px]">
              {`Adds: ${preset.suffix.slice(2)}`}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// VideoSidebarContent (shared between desktop and mobile)
// ---------------------------------------------------------------------------

function VideoSidebarContent({
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
  onOpenRefImageHistory,
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
  onOpenRefImageHistory: (target: 'reference' | 'startFrame' | 'endFrame') => void;
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
            <motion.button
              key={ratio}
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setVideoAspectRatio(ratio)}
              className={`
                relative flex flex-col items-center gap-0.5 rounded-lg border px-2 py-3 text-center transition-all
                ${
                  videoAspectRatio === ratio
                    ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00]'
                    : 'border-border/40 bg-surface text-muted-foreground hover:border-border hover:text-foreground'
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
            </motion.button>
          ))}
        </div>
      </div>

      <Separator className="opacity-40" />

      {/* ----- Reference Image (Image-to-Video) ----- */}
      <div className="space-y-2">
        <ImageUploadSlot
          value={referenceImageUrl || null}
          onChange={(url) => { setReferenceImageUrl(url); if (url) saveReferenceImage(url).catch(() => {}); }}
          label={
            <span className="flex items-center gap-1.5">
              <ImageIcon className="h-3 w-3" />
              Reference Image
            </span>
          }
          description="Provide an image to guide the video generation (image-to-video)"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenRefImageHistory('reference')}
                className="w-full gap-1.5 border-border/50 bg-surface/80 hover:border-[#d9ff00]/40 hover:bg-[#d9ff00]/5 hover:text-[#d9ff00] text-xs h-7"
              >
                <History className="h-3 w-3" />
                History
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Pick from previously used images</TooltipContent>
        </Tooltip>
      </div>

      <Separator className="opacity-40" />

      {/* ----- Start Frame ----- */}
      <div className="space-y-2">
        <ImageUploadSlot
          value={videoStartFrameUrl}
          onChange={(url) => { setVideoStartFrameUrl(url); if (url) saveReferenceImage(url).catch(() => {}); }}
          label={
            <span className="flex items-center gap-1.5">
              <ArrowLeftToLine className="h-3 w-3" />
              Start Frame
            </span>
          }
          description="Define the first frame of the video"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenRefImageHistory('startFrame')}
                className="w-full gap-1.5 border-border/50 bg-surface/80 hover:border-[#d9ff00]/40 hover:bg-[#d9ff00]/5 hover:text-[#d9ff00] text-xs h-7"
              >
                <History className="h-3 w-3" />
                History
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Pick from previously used images</TooltipContent>
        </Tooltip>
      </div>

      <Separator className="opacity-40" />

      {/* ----- End Frame ----- */}
      <div className="space-y-2">
        <ImageUploadSlot
          value={videoEndFrameUrl}
          onChange={(url) => { setVideoEndFrameUrl(url); if (url) saveReferenceImage(url).catch(() => {}); }}
          label={
            <span className="flex items-center gap-1.5">
              <ArrowRightToLine className="h-3 w-3" />
              End Frame
            </span>
          }
          description="Define the last frame of the video"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenRefImageHistory('endFrame')}
                className="w-full gap-1.5 border-border/50 bg-surface/80 hover:border-[#d9ff00]/40 hover:bg-[#d9ff00]/5 hover:text-[#d9ff00] text-xs h-7"
              >
                <History className="h-3 w-3" />
                History
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Pick from previously used images</TooltipContent>
        </Tooltip>
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
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
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
            </motion.div>
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VideoStudio() {
  // Store ------------------------------------------------------------------
  const {
    videoPrompt,
    setVideoPrompt,
    selectedVideoProvider,
    setSelectedVideoProvider,
    selectedVideoModel,
    setSelectedVideoModel,
    videoDuration,
    setVideoDuration,
    videoAspectRatio,
    setVideoAspectRatio,
    isVideoGenerating,
    setIsVideoGenerating,
    latestResult,
    setLatestResult,
    providerVersion,
    generateTrigger,
    addToQueue,
    updateQueueItem,
    videoStyle,
    setVideoStyle,
    videoCameraMotion,
    setVideoCameraMotion,
    videoMood,
    setVideoMood,
    videoStartFrameUrl,
    setVideoStartFrameUrl,
    videoEndFrameUrl,
    setVideoEndFrameUrl,
  } = useAppStore();

  // IndexedDB-backed API keys hook -------------------------------------------
  const apiKeysHook = useApiKeys();

  // Local state ------------------------------------------------------------
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);

  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showGenInfo, setShowGenInfo] = useState(true);
  const [refImagePickerOpen, setRefImagePickerOpen] = useState(false);
  const [refImageTarget, setRefImageTarget] = useState<'reference' | 'startFrame' | 'endFrame'>('reference');
  const videoRef = useRef<HTMLVideoElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueIdRef = useRef<string | null>(null);
  const isMobile = useIsMobile();

  // Derived ----------------------------------------------------------------
  const selectedProviderData = providers.find((p) => p.id === selectedVideoProvider) ?? null;
  const videoModels = selectedProviderData?.models.filter((m) => m.type === 'video') ?? [];
  const hasApiKey = apiKeysHook.hasKey(selectedVideoProvider);

  // Reset presets -----------------------------------------------------------
  const handleResetPresets = useCallback(() => {
    setVideoStyle('none');
    setVideoCameraMotion('none');
    setVideoMood('none');
    toast.success('Presets reset');
  }, [setVideoStyle, setVideoCameraMotion, setVideoMood]);

  // Reference image history --------------------------------------------------
  const handleOpenRefImageHistory = useCallback((target: 'reference' | 'startFrame' | 'endFrame') => {
    setRefImageTarget(target);
    setRefImagePickerOpen(true);
  }, []);

  const handleRefImageSelect = useCallback((dataUrl: string) => {
    if (refImageTarget === 'reference') {
      setReferenceImageUrl(dataUrl);
    } else if (refImageTarget === 'startFrame') {
      setVideoStartFrameUrl(dataUrl);
    } else if (refImageTarget === 'endFrame') {
      setVideoEndFrameUrl(dataUrl);
    }
  }, [refImageTarget, setReferenceImageUrl, setVideoStartFrameUrl, setVideoEndFrameUrl]);

  const refImagePickerTitle = refImageTarget === 'reference'
    ? 'Reference Image History'
    : refImageTarget === 'startFrame'
      ? 'Start Frame History'
      : 'End Frame History';

  // Fetch providers --------------------------------------------------------
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/providers');
        if (!res.ok) throw new Error('Failed to fetch');
        const data: Provider[] = await res.json();
        setProviders(data);

        // Auto-select first provider that has video models and an API key
        if (!selectedVideoProvider && data.length > 0) {
          const withKeyAndVideo = data.find(
            (p) => apiKeysHook.hasKey(p.id) && p.models.some((m) => m.type === 'video')
          );
          const withVideo = data.find((p) => p.models.some((m) => m.type === 'video'));
          const pick = withKeyAndVideo || withVideo || data[0];
          setSelectedVideoProvider(pick.id);
          // Auto-select default video model
          const defaultModel = pick.models.find((m) => m.isDefault && m.type === 'video');
          if (defaultModel) {
            setSelectedVideoModel(defaultModel.modelId);
          } else {
            const firstVideo = pick.models.find((m) => m.type === 'video');
            if (firstVideo) setSelectedVideoModel(firstVideo.modelId);
          }
        }
      } catch {
        toast.error('Failed to load providers');
      } finally {
        setProvidersLoading(false);
      }
    }
    load();
  }, [providerVersion]);
  useEffect(() => {
    if (!selectedVideoProvider || providers.length === 0) return;
    const prov = providers.find((p) => p.id === selectedVideoProvider);
    if (!prov) return;
    const defaultModel = prov.models.find((m) => m.isDefault && m.type === 'video');
    if (defaultModel) {
      setSelectedVideoModel(defaultModel.modelId);
    } else {
      const firstVideo = prov.models.find((m) => m.type === 'video');
      if (firstVideo) setSelectedVideoModel(firstVideo.modelId);
      else setSelectedVideoModel('');
    }
  }, [selectedVideoProvider, providers, setSelectedVideoModel]);



  // Polling logic — sends apiKey from IndexedDB for async status checks --------
  const startPolling = useCallback(
    (generationId: string) => {
      if (pollRef.current) clearInterval(pollRef.current);

      pollRef.current = setInterval(async () => {
        try {
          const apiKey = await apiKeysHook.getKeyForProvider(selectedVideoProvider);
          const res = await fetch(`/api/generate/status?id=${generationId}${apiKey ? `&apiKey=${encodeURIComponent(apiKey)}` : ''}`);
          if (!res.ok) throw new Error('Status check failed');
          const data = await res.json();

          if (data.status === 'completed') {
            setIsVideoGenerating(false);
            setLatestResult(data.resultUrl || data.urls?.[0] || null);
            setCurrentJobId(null);
            if (queueIdRef.current) {
              updateQueueItem(queueIdRef.current, { status: 'completed', resultUrl: data.resultUrl || data.urls?.[0] || undefined });
              queueIdRef.current = null;
            }
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            toast.success('Video generated successfully!');
          } else if (data.status === 'failed') {
            setIsVideoGenerating(false);
            setCurrentJobId(null);
            if (queueIdRef.current) {
              updateQueueItem(queueIdRef.current, { status: 'failed' });
              queueIdRef.current = null;
            }
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            toast.error(data.error || 'Video generation failed');
          }
        } catch {
          // retry next interval
        }
      }, 5000);
    },
    [setIsVideoGenerating, setLatestResult, apiKeysHook, selectedVideoProvider, updateQueueItem]
  );

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Auto-hide generation info card after 5 seconds
  useEffect(() => {
    if (latestResult && showGenInfo) {
      const timer = setTimeout(() => setShowGenInfo(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [latestResult, showGenInfo]);

  // Video player controls --------------------------------------------------
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleFullscreen = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  }, []);

  const handleVideoTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const progress =
      (videoRef.current.currentTime / videoRef.current.duration) * 100;
    setVideoProgress(progress || 0);
  }, []);

  const handleVideoEnded = useCallback(() => {
    setIsPlaying(false);
    setVideoProgress(0);
  }, []);

  // Generate handler -------------------------------------------------------
  const handleGenerate = useCallback(async () => {
    // Read fresh state from store to avoid stale closures
    const state = useAppStore.getState();

    if (!state.selectedVideoProvider) {
      toast.error('Please select a provider');
      return;
    }
    if (!state.selectedVideoModel) {
      toast.error('Please select a model');
      return;
    }
    if (!state.videoPrompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }
    if (!apiKeysHook.hasKey(state.selectedVideoProvider)) {
      toast.error('No API key configured for this provider. Add one in Settings.');
      return;
    }

    setIsVideoGenerating(true);
    setLatestResult(null);
    setCurrentJobId(null);
    setIsPlaying(false);
    setVideoProgress(0);
    setShowGenInfo(true);

    // Build enhanced prompt with preset suffixes
    let enhancedPrompt = state.videoPrompt.trim();
    const stylePreset = VIDEO_STYLE_PRESETS.find((p) => p.id === state.videoStyle);
    if (stylePreset) enhancedPrompt += stylePreset.suffix;
    const cameraPreset = CAMERA_MOTION_PRESETS.find((p) => p.id === state.videoCameraMotion);
    if (cameraPreset) enhancedPrompt += cameraPreset.suffix;
    const moodPreset = VIDEO_MOOD_PRESETS.find((p) => p.id === state.videoMood);
    if (moodPreset) enhancedPrompt += moodPreset.suffix;

    const provData = providers.find((p) => p.id === state.selectedVideoProvider);
    const vModels = provData?.models.filter((m) => m.type === 'video') ?? [];

    // Add to generation queue
    const queueItem: GenerationQueueItem = {
      id: `vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      prompt: enhancedPrompt,
      providerName: provData?.displayName || state.selectedVideoProvider,
      providerColor: provData?.color || '#888',
      modelName: vModels.find((m) => m.modelId === state.selectedVideoModel)?.name || state.selectedVideoModel,
      status: 'processing',
      createdAt: Date.now(),
    };
    addToQueue(queueItem);
    queueIdRef.current = queueItem.id;

    try {
      // Get API key from IndexedDB (BYOK model)
      const apiKey = await apiKeysHook.getKeyForProvider(state.selectedVideoProvider);
      if (!apiKey) {
        toast.error('No API key configured for this provider. Add one in Settings.');
        setIsVideoGenerating(false);
        return;
      }

      const body: Record<string, unknown> = {
        providerId: state.selectedVideoProvider,
        modelId: state.selectedVideoModel,
        prompt: enhancedPrompt,
        duration: state.videoDuration,
        aspectRatio: state.videoAspectRatio,
        imageUrl: referenceImageUrl || undefined,
        startFrameUrl: state.videoStartFrameUrl || undefined,
        endFrameUrl: state.videoEndFrameUrl || undefined,
        apiKey,
      };

      const res = await fetch('/api/generate/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Video generation failed');
      }

      if (data.status === 'completed' && data.urls) {
        // Immediate result (unlikely for video, but handle it)
        setLatestResult(data.urls[0] || null);
        setIsVideoGenerating(false);
        if (queueIdRef.current) {
          updateQueueItem(queueIdRef.current, { status: 'completed', resultUrl: data.urls[0] || undefined });
          queueIdRef.current = null;
        }
        toast.success('Video generated successfully!');
      } else if (data.status === 'processing' && data.id) {
        // Async – start polling
        setCurrentJobId(data.id);
        startPolling(data.id);
        toast.info('Video generation in progress… This may take a minute.');
      } else {
        setIsVideoGenerating(false);
        if (queueIdRef.current) {
          updateQueueItem(queueIdRef.current, { status: 'failed' });
          queueIdRef.current = null;
        }
        toast.error('Unexpected response from server');
      }
    } catch (err) {
      setIsVideoGenerating(false);
      if (queueIdRef.current) {
        updateQueueItem(queueIdRef.current, { status: 'failed' });
        queueIdRef.current = null;
      }
      toast.error(err instanceof Error ? err.message : 'Video generation failed');
    }
  }, [
    providers,
    referenceImageUrl,
    apiKeysHook,
    setIsVideoGenerating,
    setLatestResult,
    startPolling,
    addToQueue,
    updateQueueItem,
  ]);

  // Keyboard shortcut: generate on trigger
  useEffect(() => {
    if (generateTrigger > 0) {
      handleGenerate();
    }
  }, [generateTrigger, handleGenerate]);

  // Download helper --------------------------------------------------------
  const handleDownload = useCallback(async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `ai-studio-video-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast.success('Video downloaded');
    } catch {
      window.open(url, '_blank');
    }
  }, []);

  // Favorite helper --------------------------------------------------------
  const handleFavorite = useCallback(async (id: string) => {
    try {
      await idb.toggleGenerationFavorite(id, true);
      toast.success('Added to favorites');
    } catch {
      toast.error('Failed to favorite');
    }
  }, []);

  // ========================================================================
  // RENDER
  // ========================================================================

  // Sidebar props shared between desktop and mobile
  const videoSidebarProps = {
    providers,
    providersLoading,
    selectedVideoProvider,
    setSelectedVideoProvider,
    selectedVideoModel,
    setSelectedVideoModel,
    selectedProviderData,
    videoModels,
    hasApiKey,
    configuredProviderIds: apiKeysHook.configuredProviderIds,
    videoPrompt,
    setVideoPrompt,
    videoDuration,
    setVideoDuration,
    videoAspectRatio,
    setVideoAspectRatio,
    referenceImageUrl,
    setReferenceImageUrl,
    isVideoGenerating,
    onGenerate: handleGenerate,
    videoStyle,
    setVideoStyle,
    videoCameraMotion,
    setVideoCameraMotion,
    videoMood,
    setVideoMood,
    onResetPresets: handleResetPresets,
    videoStartFrameUrl,
    setVideoStartFrameUrl,
    videoEndFrameUrl,
    setVideoEndFrameUrl,
    onOpenRefImageHistory: handleOpenRefImageHistory,
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Reference Image History Picker Dialog */}
      <ReferenceImagePicker
        open={refImagePickerOpen}
        onOpenChange={setRefImagePickerOpen}
        onSelect={handleRefImageSelect}
        title={refImagePickerTitle}
      />

      {/* ================================================================== */}
      {/* LEFT SIDEBAR – Video Generation Controls                          */}
      {/* ================================================================== */}
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-[380px] min-w-[380px] max-w-[380px] shrink-0 overflow-hidden border-r border-border/60">
        <ScrollArea className="h-full">
          <VideoSidebarContent {...videoSidebarProps} />
        </ScrollArea>
      </aside>

      {/* Mobile sidebar - Sheet/Drawer */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="glass-strong w-[340px] p-0 border-r-0">
          <SheetTitle className="sr-only">Video Generation Controls</SheetTitle>
          <SheetDescription className="sr-only">Configure video generation settings</SheetDescription>
          <ScrollArea className="h-full">
            <VideoSidebarContent {...videoSidebarProps} onMobileClose={() => setMobileSidebarOpen(false)} />
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* ================================================================== */}
      {/* MAIN AREA – Results Display                                        */}
      {/* ================================================================== */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar with controls toggle */}
        <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-surface/40">
          <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 border-border/60 bg-surface hover:bg-surface-hover">
                <PanelLeftOpen className="h-4 w-4" />
                Controls
              </Button>
            </SheetTrigger>
          </Sheet>
          {selectedProviderData && (
            <Badge variant="secondary" className="ml-auto gap-1 text-[10px] bg-surface border-border text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: selectedProviderData.color || '#888' }} />
              {selectedProviderData.displayName}
            </Badge>
          )}
        </div>

        {/* Result area */}
        <div className="flex-1 flex items-center justify-center p-4 md:p-6">
          <AnimatePresence mode="wait">
            {/* --- Empty State --- */}
            {!isVideoGenerating && !latestResult && (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center gap-6 text-center relative"
              >
                {/* Animated gradient background */}
                <div className="absolute inset-0 -m-8 rounded-3xl animate-empty-gradient opacity-30" />

                {/* Floating Film icon with glow */}
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="relative z-10"
                >
                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-surface/80 border border-[#d9ff00]/20 backdrop-blur-sm animate-empty-glow">
                    <VideoIcon className="h-10 w-10 text-[#d9ff00]/60" />
                  </div>
                </motion.div>

                <div className="relative z-10">
                  <h3 className="text-lg font-semibold text-foreground">
                    Generate your first video
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                    Choose a provider and model, write a prompt, and click Generate to create a
                    video.
                  </p>
                </div>

                {/* Feature hint cards with staggered entrance */}
                <div className="flex flex-col sm:flex-row items-stretch gap-3 mt-2 relative z-10">
                  {[
                    { icon: <Clapperboard className="h-5 w-5 text-[#d9ff00]" />, title: 'Style Presets', desc: 'Cinematic, Documentary, Commercial & more' },
                    { icon: <Camera className="h-5 w-5 text-[#d9ff00]" />, title: 'Camera Motion', desc: 'Pan, Zoom, Orbit, Dolly & more' },
                    { icon: <Ghost className="h-5 w-5 text-[#d9ff00]" />, title: 'Moods', desc: 'Dramatic, Peaceful, Epic & more' },
                  ].map((card, i) => (
                    <motion.div
                      key={card.title}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + i * 0.1, duration: 0.4 }}
                      className="flex items-start gap-3 rounded-xl border border-border/30 bg-surface/60 backdrop-blur-sm p-4 min-w-[160px] text-left"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#d9ff00]/10 shrink-0">
                        {card.icon}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{card.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{card.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* --- Loading State --- */}
            {isVideoGenerating && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center gap-4 text-center"
              >
                <div className="relative flex h-40 w-40 items-center justify-center">
                  {/* Pulsing ring */}
                  <div className="absolute inset-0 rounded-full border-2 border-[#d9ff00]/20 animate-neon-pulse" />
                  <div className="absolute inset-3 rounded-full border-2 border-[#d9ff00]/40 animate-neon-pulse [animation-delay:0.5s]" />
                  <div className="absolute inset-6 rounded-full border-2 border-[#d9ff00]/60 animate-neon-pulse [animation-delay:1s]" />
                  <Film className="h-10 w-10 text-[#d9ff00] animate-neon-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Generating your video…
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This may take a few minutes depending on the provider and duration.
                  </p>
                </div>
                {/* Animated progress bar */}
                <div className="w-64 h-1.5 rounded-full bg-surface overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[#d9ff00] to-[#00d4ff] rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 60, ease: 'linear' }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground/60">
                  Polling for results every 5 seconds…
                </p>
              </motion.div>
            )}

            {/* --- Result State --- */}
            {!isVideoGenerating && latestResult && (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center gap-4 w-full max-w-4xl"
              >
                {/* Video container */}
                <div
                  className="relative w-full overflow-hidden rounded-xl border border-border/40 bg-surface shadow-2xl group"
                  onMouseEnter={() => setShowGenInfo(true)}
                  onMouseLeave={() => setShowGenInfo(false)}
                >
                  <video
                    ref={videoRef}
                    src={latestResult}
                    onTimeUpdate={handleVideoTimeUpdate}
                    onEnded={handleVideoEnded}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    className="w-full h-auto max-h-[55vh] object-contain"
                    playsInline
                  />

                  {/* Video controls overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12">
                    {/* Progress bar */}
                    <div
                      className="w-full h-1 rounded-full bg-white/20 mb-3 cursor-pointer"
                      onClick={(e) => {
                        if (!videoRef.current) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const percentage = x / rect.width;
                        videoRef.current.currentTime =
                          percentage * videoRef.current.duration;
                      }}
                    >
                      <div
                        className="h-full rounded-full bg-[#d9ff00] transition-all"
                        style={{ width: `${videoProgress}%` }}
                      />
                    </div>

                    {/* Controls row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={togglePlay}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d9ff00] text-background hover:bg-[#c5eb00] transition-colors"
                        >
                          {isPlaying ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4 ml-0.5" />
                          )}
                        </motion.button>
                        <span className="text-xs text-white/70 ml-2">
                          {videoDuration}s
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={handleFullscreen}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
                        >
                          <Maximize2 className="h-4 w-4" />
                        </motion.button>
                      </div>
                    </div>
                  </div>

                  {/* Generation info card overlay */}
                  <AnimatePresence>
                    {showGenInfo && selectedProviderData && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-3 right-3 rounded-lg border border-border/30 bg-black/60 backdrop-blur-md px-2.5 py-1.5 flex items-center gap-2"
                      >
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: selectedProviderData.color || '#888' }}
                        />
                        <span className="text-[10px] font-medium text-white/80">
                          {selectedProviderData.displayName}
                        </span>
                        <span className="text-[10px] text-white/40">·</span>
                        <span className="text-[10px] text-white/60">
                          {videoModels.find((m) => m.modelId === selectedVideoModel)?.name || selectedVideoModel}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(latestResult)}
                    className="gap-2 border-border/60 bg-surface hover:bg-surface-hover"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (currentJobId) handleFavorite(currentJobId);
                      else toast.info('Added to favorites');
                    }}
                    className="gap-2 border-border/60 bg-surface hover:bg-surface-hover"
                  >
                    <Heart className="h-4 w-4" />
                    Favorite
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerate}
                    className="gap-2 border-border/60 bg-surface hover:bg-surface-hover"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Regenerate
                  </Button>
                </div>

                {/* Prompt echo */}
                <p className="text-xs text-muted-foreground/60 max-w-lg text-center line-clamp-2">
                  &ldquo;{videoPrompt}&rdquo;
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Recent Generations Quick-Access Bar */}
        <RecentBar accentColor="#d9ff00" />
      </main>
    </div>
  );
}
