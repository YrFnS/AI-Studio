'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { getAllCustomModels } from '@/lib/idb';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Camera,
  Aperture,
  Film,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Download,
  Heart,
  Loader2,
  Sparkles,
  X,
  RefreshCw,
  PanelLeftOpen,
  Clapperboard,
  DollarSign,
  Palette,
  SlidersHorizontal,
  Clock,
} from 'lucide-react';

import { useAppStore } from '@/lib/store';
import * as data from '@/lib/data';
import type { GenerationQueueItem } from '@/lib/store';
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

// ---------------------------------------------------------------------------
// Cinema Data Constants
// ---------------------------------------------------------------------------

const CAMERA_BODIES = [
  { id: 'arri-alexa-mini-lf', name: 'ARRI Alexa Mini LF', style: 'cinematic, rich colors, wide dynamic range' },
  { id: 'red-v-raptor', name: 'RED V-Raptor XL', style: '8K resolution, sharp detail, cinematic' },
  { id: 'sony-venice-2', name: 'Sony Venice 2', style: 'full-frame cinematic, natural skin tones' },
  { id: 'canon-eos-r5', name: 'Canon EOS R5', style: 'clean, sharp, vibrant colors' },
  { id: 'blackmagic-ursa', name: 'Blackmagic URSA Mini Pro', style: 'film look, organic, cinematic' },
  { id: 'panavision-dxl2', name: 'Panavision DXL2', style: 'Hollywood cinema, anamorphic, epic' },
  { id: 'nikon-z9', name: 'Nikon Z9', style: 'sharp, detailed, professional photography' },
  { id: 'leica-s3', name: 'Leica S3', style: 'medium format, creamy bokeh, premium look' },
];

const LENS_TYPES = [
  { id: 'cooke-anamorphic', name: 'Cooke Anamorphic', effect: 'anamorphic lens flare, oval bokeh, cinematic widescreen' },
  { id: 'zeiss-master-prime', name: 'Zeiss Master Prime', effect: 'razor sharp, minimal distortion, clean rendering' },
  { id: 'panavision-ultra', name: 'Panavision Ultra Vista', effect: 'anamorphic, wide aspect, beautiful flare' },
  { id: 'canon-cn-e', name: 'Canon CN-E Cinema Prime', effect: 'smooth bokeh, warm tones, cinema quality' },
  { id: 'sigma-cine', name: 'Sigma Cine Prime', effect: 'sharp, modern rendering, high contrast' },
  { id: 'tokina-vista', name: 'Tokina Vista Prime', effect: 'vintage character, warm flares, organic' },
  { id: 'leica-thalia', name: 'Leica Thalia', effect: 'medium format cinema, smooth, elegant' },
  { id: 'angénieux-optimo', name: 'Angénieux Optimo', effect: 'French cinema, smooth zoom, beautiful rendering' },
];

const FILM_STOCKS = [
  { id: 'kodak-portra-400', name: 'Kodak Portra 400', effect: 'warm skin tones, pastel colors, natural grain' },
  { id: 'fujifilm-pro-400h', name: 'Fujifilm Pro 400H', effect: 'cool tones, fine grain, subtle pastels' },
  { id: 'kodak-ektar-100', name: 'Kodak Ektar 100', effect: 'vivid saturated colors, ultra fine grain' },
  { id: 'ilford-hp5', name: 'Ilford HP5 Plus', effect: 'classic black and white, visible grain, contrasty' },
  { id: 'cinestill-800t', name: 'CineStill 800T', effect: 'tungsten balanced, halation, night photography' },
  { id: 'kodak-vision3-500t', name: 'Kodak Vision3 500T', effect: 'cinematic tungsten, rich shadows, film grain' },
  { id: 'fujifilm-superia', name: 'Fujifilm Superia 400', effect: 'everyday film, slight green cast, nostalgic' },
  { id: 'none', name: 'Digital (No Film Stock)', effect: '' },
];

const COLOR_GRADES = [
  { id: 'teal-orange', name: 'Teal & Orange', effect: 'teal shadows, orange highlights, blockbuster look' },
  { id: 'bleach-bypass', name: 'Bleach Bypass', effect: 'desaturated, high contrast, metallic look' },
  { id: 'cross-process', name: 'Cross Process', effect: 'unnatural colors, high saturation, vintage' },
  { id: 'desaturated', name: 'Desaturated', effect: 'muted colors, subtle tones, moody' },
  { id: 'high-contrast', name: 'High Contrast', effect: 'deep blacks, bright highlights, dramatic' },
  { id: 'natural', name: 'Natural', effect: 'true to life colors, balanced exposure' },
  { id: 'none', name: 'None (Original)', effect: '' },
];

const LIGHTING_SETUPS = [
  { id: 'golden-hour', name: 'Golden Hour', effect: 'warm directional sunlight, long shadows, golden tones' },
  { id: 'blue-hour', name: 'Blue Hour', effect: 'cool ambient light, deep blue sky, silhouette potential' },
  { id: 'overcast', name: 'Overcast', effect: 'soft diffused light, even illumination, no harsh shadows' },
  { id: 'studio-three-point', name: 'Studio Three-Point', effect: 'professional key, fill, and back lighting, controlled' },
  { id: 'rembrandt', name: 'Rembrandt', effect: 'dramatic side lighting, triangle of light on cheek, moody' },
  { id: 'neon-noir', name: 'Neon Noir', effect: 'neon colored lights, dark shadows, cyberpunk atmosphere' },
  { id: 'silhouette', name: 'Silhouette', effect: 'backlit subject, dark foreground, bright background' },
  { id: 'natural-window', name: 'Natural Window', effect: 'soft directional window light, natural, flattering' },
  { id: 'none', name: 'None (Unspecified)', effect: '' },
];

const FOCAL_LENGTH_PRESETS = [
  { label: 'Ultra Wide 14mm', value: 14 },
  { label: 'Wide 24mm', value: 24 },
  { label: 'Standard 35mm', value: 35 },
  { label: 'Normal 50mm', value: 50 },
  { label: 'Portrait 85mm', value: 85 },
  { label: 'Short Tele 135mm', value: 135 },
  { label: 'Telephoto 200mm', value: 200 },
];

const APERTURE_STOPS = [1.4, 1.8, 2, 2.8, 4, 5.6, 8, 11, 16, 22];

// ---------------------------------------------------------------------------
// Cinema Scene Presets
// ---------------------------------------------------------------------------

const CINEMA_SCENE_PRESETS = [
  { id: 'hollywood-epic', emoji: '🎬', label: 'Hollywood Epic', suffix: ', grand cinematic wide shot, dramatic scale, sweeping vistas' },
  { id: 'neo-noir', emoji: '🌆', label: 'Neo Noir', suffix: ', noir style, high contrast, rain-slicked streets, moody' },
  { id: 'golden-hour', emoji: '🌅', label: 'Golden Hour', suffix: ', warm golden light, long shadows, romantic atmosphere' },
  { id: 'urban-night', emoji: '🏙️', label: 'Urban Night', suffix: ', neon lights, urban cityscape, cyberpunk atmosphere, reflections' },
  { id: 'drama', emoji: '🎭', label: 'Drama', suffix: ', intense dramatic lighting, chiaroscuro, emotional close-up' },
  { id: 'natural', emoji: '🌿', label: 'Natural', suffix: ', soft natural lighting, organic feel, earthy tones, serene' },
  { id: 'sci-fi', emoji: '🔮', label: 'Sci-Fi', suffix: ', futuristic, holographic, advanced technology, clean lines' },
  { id: 'vintage', emoji: '🏚️', label: 'Vintage', suffix: ', retro film grain, vintage color palette, nostalgic warmth' },
  { id: 'fantasy', emoji: '🎪', label: 'Fantasy', suffix: ', magical, ethereal glow, enchanted, mystical atmosphere' },
  { id: 'documentary', emoji: '📸', label: 'Documentary', suffix: ', raw, authentic, handheld feel, natural lighting, candid' },
];

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
// Aspect ratio helpers
// ---------------------------------------------------------------------------

const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'] as const;

const RATIO_LABELS: Record<string, string> = {
  '1:1': 'Square',
  '16:9': 'Landscape',
  '9:16': 'Portrait',
  '4:3': 'Classic',
  '3:4': 'Tall',
  '3:2': 'Photo',
  '2:3': 'Slim',
};

// ---------------------------------------------------------------------------
// Cost Estimate Badge
// ---------------------------------------------------------------------------

function CostEstimateBadge({ providerId, modelId, batchSize }: {
  providerId: string;
  modelId: string;
  batchSize?: number;
}) {
  const [cost, setCost] = useState<string | null>(null);

  useEffect(() => {
    if (!providerId || !modelId) return;
    const controller = new AbortController();
    fetch('/api/cost-estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId, modelId, params: { batchSize } }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => setCost(data.estimatedCost || 'varies'))
      .catch(() => setCost('varies'));
    return () => controller.abort();
  }, [providerId, modelId, batchSize]);

  if (!cost) return null;

  return (
    <div className="flex items-center justify-center gap-1.5">
      <DollarSign className="h-3 w-3 text-muted-foreground/60" />
      <span className="text-[10px] text-muted-foreground/60">Est. {cost}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cinema Prompt Suffix Builder
// ---------------------------------------------------------------------------

function buildCinemaSuffix(
  camera: string,
  lens: string,
  focalLength: number,
  aperture: number,
  filmStock: string,
  colorGrade: string,
  lighting: string,
  scenePreset: string,
): string {
  const parts: string[] = [];

  // Scene preset suffix
  const sceneData = CINEMA_SCENE_PRESETS.find((s) => s.id === scenePreset);
  if (sceneData) {
    parts.push(sceneData.suffix.trim().replace(/^,\\s*/, ''));
  }

  const cameraData = CAMERA_BODIES.find((c) => c.id === camera);
  if (cameraData) {
    parts.push(`shot on ${cameraData.name}`);
  }

  const lensData = LENS_TYPES.find((l) => l.id === lens);
  if (lensData) {
    parts.push(`${lensData.name} ${focalLength}mm lens`);
  }

  parts.push(`f/${aperture}`);

  const filmData = FILM_STOCKS.find((f) => f.id === filmStock);
  if (filmData && filmData.id !== 'none') {
    parts.push(`${filmData.name} film stock`);
  }

  const gradeData = COLOR_GRADES.find((g) => g.id === colorGrade);
  if (gradeData && gradeData.id !== 'none') {
    parts.push(`${gradeData.name.toLowerCase()} color grade`);
  }

  const lightData = LIGHTING_SETUPS.find((l) => l.id === lighting);
  if (lightData && lightData.id !== 'none') {
    parts.push(`${lightData.name.toLowerCase()} lighting`);
  }

  // Add cinematic keywords
  if (aperture <= 2.8) {
    parts.push('cinematic depth of field');
  }
  if (lensData && lensData.id.includes('anamorphic')) {
    parts.push('anamorphic lens flare');
  }

  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// Sidebar Content
// ---------------------------------------------------------------------------

function CinemaSidebarContent({
  providers,
  providersLoading,
  selectedProvider,
  setSelectedProvider,
  selectedModel,
  setSelectedModel,
  selectedProviderData,
  imageModels,
  hasApiKey,
  configuredProviderIds,
  prompt,
  setPrompt,
  negativePrompt,
  setNegativePrompt,
  aspectRatio,
  setAspectRatio,
  batchSize,
  setBatchSize,
  isCinemaGenerating,
  showNegPrompt,
  setShowNegPrompt,
  cinemaCamera,
  setCinemaCamera,
  cinemaLens,
  setCinemaLens,
  cinemaFocalLength,
  setCinemaFocalLength,
  cinemaAperture,
  setCinemaAperture,
  cinemaFilmStock,
  setCinemaFilmStock,
  cinemaColorGrade,
  setCinemaColorGrade,
  cinemaLighting,
  setCinemaLighting,
  cinemaScenePreset,
  setCinemaScenePreset,
  cinemaSuffix,
  onGenerate,
  onMobileClose,
}: {
  providers: Provider[];
  providersLoading: boolean;
  selectedProvider: string;
  setSelectedProvider: (v: string) => void;
  selectedModel: string;
  setSelectedModel: (v: string) => void;
  selectedProviderData: Provider | null;
  imageModels: ProviderModel[];
  hasApiKey: boolean;
  configuredProviderIds: string[];
  prompt: string;
  setPrompt: (v: string) => void;
  negativePrompt: string;
  setNegativePrompt: (v: string) => void;
  aspectRatio: string;
  setAspectRatio: (v: string) => void;
  batchSize: number;
  setBatchSize: (v: number) => void;
  isCinemaGenerating: boolean;
  showNegPrompt: boolean;
  setShowNegPrompt: (v: boolean) => void;
  cinemaCamera: string;
  setCinemaCamera: (v: string) => void;
  cinemaLens: string;
  setCinemaLens: (v: string) => void;
  cinemaFocalLength: number;
  setCinemaFocalLength: (v: number) => void;
  cinemaAperture: number;
  setCinemaAperture: (v: number) => void;
  cinemaFilmStock: string;
  setCinemaFilmStock: (v: string) => void;
  cinemaColorGrade: string;
  setCinemaColorGrade: (v: string) => void;
  cinemaLighting: string;
  setCinemaLighting: (v: string) => void;
  cinemaScenePreset: string;
  setCinemaScenePreset: (v: string) => void;
  cinemaSuffix: string;
  onGenerate: () => void;
  onMobileClose?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 p-5">
      {/* Header with Cinema Mode badge */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F59E0B]/10">
          <Clapperboard className="h-4 w-4 text-[#F59E0B]" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Cinema Studio</h2>
            <Badge className="gap-1 text-[9px] font-semibold bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20 hover:bg-[#F59E0B]/15">
              <Camera className="h-2.5 w-2.5" />
              CINEMA MODE
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">Pro camera controls for cinematic AI images</p>
        </div>
      </div>

      <Separator className="opacity-40" />

      {/* ===== SMART PREVIEW CARD ===== */}
      {cinemaSuffix && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="rounded-xl border border-[#F59E0B]/25 bg-gradient-to-br from-[#F59E0B]/8 to-[#F59E0B]/3 p-3.5"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#F59E0B]/15">
              <Film className="h-3.5 w-3.5 text-[#F59E0B]" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#F59E0B]/80">
              Cinema Suffix
            </span>
            {cinemaScenePreset !== 'none' && (
              <Badge className="ml-auto h-4 min-w-[18px] px-1 text-[8px] font-bold bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30">
                {CINEMA_SCENE_PRESETS.find((s) => s.id === cinemaScenePreset)?.emoji} PRESET
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-foreground/70 leading-relaxed break-words line-clamp-3">
            {cinemaSuffix}
          </p>
        </motion.div>
      )}

      {/* ===== SCENE PRESETS ===== */}
      <div className="space-y-2">
        <Label className="text-xs font-medium uppercase tracking-wider text-[#F59E0B]/80 flex items-center gap-1.5">
          <Clapperboard className="h-3 w-3" />
          Scene Presets
        </Label>
        <div className="grid grid-cols-5 gap-1">
          {CINEMA_SCENE_PRESETS.map((preset) => {
            const isActive = cinemaScenePreset === preset.id;
            return (
              <Tooltip key={preset.id}>
                <TooltipTrigger asChild>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setCinemaScenePreset(preset.id === cinemaScenePreset ? 'none' : preset.id)}
                    className={`relative flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-center transition-all ${
                      isActive
                        ? 'border-[#F59E0B]/50 bg-[#F59E0B]/10 text-[#F59E0B] shadow-[0_0_8px_rgba(245,158,11,0.15)]'
                        : 'border-border/30 bg-surface text-muted-foreground hover:border-[#F59E0B]/30 hover:text-[#F59E0B]/80'
                    }`}
                  >
                    <span className="text-sm">{preset.emoji}</span>
                    <span className="text-[7px] font-medium leading-tight truncate w-full">{preset.label}</span>
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px] max-w-[200px]">
                  {preset.suffix.replace(/^,\\s*/, '')}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>

      <Separator className="opacity-30" />

      {/* ===== CINEMA CONTROLS ===== */}
      <div className="space-y-4">
        <Label className="text-xs font-medium uppercase tracking-wider text-[#F59E0B]/80 flex items-center gap-1.5">
          <SlidersHorizontal className="h-3 w-3" />
          Camera Settings
        </Label>

        {/* Camera Body */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Camera className="h-3 w-3 text-[#F59E0B]/70" />
            Camera Body
          </Label>
          <Select value={cinemaCamera} onValueChange={setCinemaCamera}>
            <SelectTrigger className="w-full bg-surface border-[#F59E0B]/20 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-border/60">
              {CAMERA_BODIES.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    <Camera className="h-3 w-3 text-[#F59E0B]/50" />
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Lens Type */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Aperture className="h-3 w-3 text-[#F59E0B]/70" />
            Lens Type
          </Label>
          <Select value={cinemaLens} onValueChange={setCinemaLens}>
            <SelectTrigger className="w-full bg-surface border-[#F59E0B]/20 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-border/60">
              {LENS_TYPES.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  <span>{l.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Focal Length */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Aperture className="h-3 w-3 text-[#F59E0B]/70" />
              Focal Length
            </Label>
            <span className="text-xs font-mono text-[#F59E0B]">{cinemaFocalLength}mm</span>
          </div>
          <Slider
            value={[cinemaFocalLength]}
            onValueChange={([v]) => setCinemaFocalLength(v)}
            min={14}
            max={200}
            step={1}
            className="w-full"
          />
          <div className="flex flex-wrap gap-1">
            {FOCAL_LENGTH_PRESETS.map((preset) => (
              <motion.button
                key={preset.value}
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCinemaFocalLength(preset.value)}
                className={`rounded-md border px-1.5 py-0.5 text-[9px] font-medium transition-all ${
                  cinemaFocalLength === preset.value
                    ? 'border-[#F59E0B]/50 bg-[#F59E0B]/10 text-[#F59E0B]'
                    : 'border-border/30 bg-surface text-muted-foreground hover:border-[#F59E0B]/30 hover:text-[#F59E0B]/80'
                }`}
              >
                {preset.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Aperture */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Aperture className="h-3 w-3 text-[#F59E0B]/70" />
              Aperture
            </Label>
            <span className="text-xs font-mono text-[#F59E0B]">f/{cinemaAperture}</span>
          </div>
          <Slider
            value={[cinemaAperture]}
            onValueChange={([v]) => setCinemaAperture(v)}
            min={1.4}
            max={22}
            step={0.1}
            className="w-full"
          />
          <div className="flex flex-wrap gap-1">
            {APERTURE_STOPS.map((stop) => (
              <motion.button
                key={stop}
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCinemaAperture(stop)}
                className={`rounded-md border px-1.5 py-0.5 text-[9px] font-medium transition-all ${
                  cinemaAperture === stop
                    ? 'border-[#F59E0B]/50 bg-[#F59E0B]/10 text-[#F59E0B]'
                    : 'border-border/30 bg-surface text-muted-foreground hover:border-[#F59E0B]/30 hover:text-[#F59E0B]/80'
                }`}
              >
                f/{stop}
              </motion.button>
            ))}
          </div>
        </div>

        <Separator className="opacity-30" />

        {/* Film Stock */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Film className="h-3 w-3 text-[#F59E0B]/70" />
            Film Stock
          </Label>
          <Select value={cinemaFilmStock} onValueChange={setCinemaFilmStock}>
            <SelectTrigger className="w-full bg-surface border-[#F59E0B]/20 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-border/60">
              {FILM_STOCKS.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  <span className="flex items-center gap-2">
                    <Film className="h-3 w-3 text-[#F59E0B]/50" />
                    {f.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Color Grade */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Palette className="h-3 w-3 text-[#F59E0B]/70" />
            Color Grade
          </Label>
          <Select value={cinemaColorGrade} onValueChange={setCinemaColorGrade}>
            <SelectTrigger className="w-full bg-surface border-[#F59E0B]/20 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-border/60">
              {COLOR_GRADES.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Lighting */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Lightbulb className="h-3 w-3 text-[#F59E0B]/70" />
            Lighting
          </Label>
          <Select value={cinemaLighting} onValueChange={setCinemaLighting}>
            <SelectTrigger className="w-full bg-surface border-[#F59E0B]/20 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-border/60">
              {LIGHTING_SETUPS.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  <span className="flex items-center gap-2">
                    <Lightbulb className="h-3 w-3 text-[#F59E0B]/50" />
                    {l.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Cinema Prompt Suffix Preview */}
        <div className="rounded-lg border border-[#F59E0B]/20 bg-[#F59E0B]/5 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Film className="h-3.5 w-3.5 text-[#F59E0B]/70" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#F59E0B]/70">
              Cinema Prompt Suffix
            </span>
          </div>
          <p className="text-[11px] text-foreground/80 leading-relaxed break-words">
            , {cinemaSuffix}
          </p>
        </div>
      </div>

      <Separator className="opacity-40" />

      {/* ===== PROVIDER & MODEL SELECTOR ===== */}
      <div className="space-y-3">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Provider & Model
        </Label>

        <Select value={selectedProvider} onValueChange={setSelectedProvider}>
          <SelectTrigger className="w-full bg-surface border-border/60">
            <SelectValue placeholder="Select provider...">
              {selectedProviderData ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedProviderData.color || '#888' }} />
                  {selectedProviderData.displayName}
                </span>
              ) : 'Select provider...'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-border/60">
            {providersLoading ? (
              <SelectItem value="__loading" disabled>Loading...</SelectItem>
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

        <Select value={selectedModel} onValueChange={setSelectedModel} disabled={!selectedProvider || imageModels.length === 0}>
          <SelectTrigger className="w-full bg-surface border-border/60">
            <SelectValue placeholder="Select model..." />
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
            {imageModels.length === 0 && selectedProvider && (
              <SelectItem value="__none" disabled>No image models available</SelectItem>
            )}
          </SelectContent>
        </Select>

        {selectedProvider && !hasApiKey && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            No API key configured for this provider. Go to Settings to add one.
          </motion.div>
        )}
      </div>

      <Separator className="opacity-40" />

      {/* ===== PROMPT ===== */}
      <div className="space-y-2">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Prompt
        </Label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the scene you want to create (cinema suffix is auto-appended)..."
          className="min-h-[100px] resize-none bg-surface border-border/60 text-sm placeholder:text-muted-foreground/50 focus-visible:ring-[#F59E0B]/30"
        />
      </div>

      {/* Negative Prompt (collapsible) */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowNegPrompt(!showNegPrompt)}
          className="flex w-full items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          Negative Prompt
          {showNegPrompt ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        <AnimatePresence>
          {showNegPrompt && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <Textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="Things to avoid in the image..."
                className="min-h-[80px] resize-none bg-surface border-border/60 text-sm placeholder:text-muted-foreground/50 focus-visible:ring-[#F59E0B]/30"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Separator className="opacity-40" />

      {/* ===== ASPECT RATIO ===== */}
      <div className="space-y-2">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Aspect Ratio</Label>
        <div className="grid grid-cols-4 gap-2">
          {ASPECT_RATIOS.map((ratio) => (
            <motion.button
              key={ratio}
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setAspectRatio(ratio)}
              className={`relative flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-center transition-all ${
                aspectRatio === ratio
                  ? 'border-[#F59E0B]/50 bg-[#F59E0B]/10 text-[#F59E0B]'
                  : 'border-border/40 bg-surface text-muted-foreground hover:border-border hover:text-foreground'
              }`}
            >
              <span className={`inline-block rounded-sm bg-current opacity-30 ${ratio === '1:1' ? 'h-4 w-4' : ''} ${ratio === '16:9' ? 'h-2.5 w-4.5' : ''} ${ratio === '9:16' ? 'h-4.5 w-2.5' : ''} ${ratio === '4:3' ? 'h-3 w-4' : ''} ${ratio === '3:4' ? 'h-4 w-3' : ''} ${ratio === '3:2' ? 'h-3 w-4.5' : ''} ${ratio === '2:3' ? 'h-4.5 w-3' : ''}`} />
              <span className="text-[10px] font-semibold">{ratio}</span>
              <span className="text-[8px] opacity-60">{RATIO_LABELS[ratio]}</span>
            </motion.button>
          ))}
        </div>
      </div>

      <Separator className="opacity-40" />

      {/* ===== BATCH SIZE ===== */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Batch Size</Label>
          <span className="text-xs font-mono text-[#F59E0B]">{batchSize}</span>
        </div>
        <Slider value={[batchSize]} onValueChange={([v]) => setBatchSize(v)} min={1} max={4} step={1} className="w-full" />
        <div className="flex justify-between text-[10px] text-muted-foreground/60"><span>1</span><span>4</span></div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* ===== GENERATE BUTTON ===== */}
      <div className="space-y-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={() => { onGenerate(); onMobileClose?.(); }}
                disabled={isCinemaGenerating || !hasApiKey || !prompt.trim() || !selectedModel}
                className={`w-full h-12 text-base font-semibold rounded-xl transition-all ${
                  isCinemaGenerating
                    ? 'bg-[#F59E0B]/20 text-[#F59E0B] cursor-wait'
                    : !hasApiKey || !selectedModel
                      ? 'bg-surface text-muted-foreground cursor-not-allowed'
                      : 'bg-[#F59E0B] text-background hover:bg-[#d97706]'
                }`}
              >
                {isCinemaGenerating ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />Generating...</span>
                ) : (
                  <span className="flex items-center gap-2"><Clapperboard className="h-5 w-5" />Generate Cinema</span>
                )}
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <span className="flex items-center gap-1.5">
              Generate cinematic image
              <kbd className="rounded border border-border/60 bg-surface px-1.5 py-0.5 text-[10px] font-mono">Ctrl+Enter</kbd>
            </span>
          </TooltipContent>
        </Tooltip>
        {/* Cost estimator badge */}
        {selectedModel && hasApiKey && (
          <CostEstimateBadge providerId={selectedProvider} modelId={selectedModel} batchSize={batchSize} />
        )}
      </div>

      {!hasApiKey && selectedProvider && (
        <p className="text-center text-[10px] text-muted-foreground/60">Add an API key in Settings to enable generation</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CinemaStudio() {
  const {
    cinemaCamera,
    setCinemaCamera,
    cinemaLens,
    setCinemaLens,
    cinemaFocalLength,
    setCinemaFocalLength,
    cinemaAperture,
    setCinemaAperture,
    cinemaFilmStock,
    setCinemaFilmStock,
    cinemaColorGrade,
    setCinemaColorGrade,
    cinemaLighting,
    setCinemaLighting,
    cinemaScenePreset,
    setCinemaScenePreset,
    isCinemaGenerating,
    setIsCinemaGenerating,
    latestResult,
    setLatestResult,
    providerVersion,
    generateTrigger,
    addToQueue,
    updateQueueItem,
  } = useAppStore();

  // IndexedDB-backed API keys hook -------------------------------------------
  const apiKeysHook = useApiKeys();

  // Local state
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [batchSize, setBatchSize] = useState(1);
  const [showNegPrompt, setShowNegPrompt] = useState(false);

  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showGenInfo, setShowGenInfo] = useState(true);
  const [genStartTime, setGenStartTime] = useState<number | null>(null);
  const [genElapsed, setGenElapsed] = useState(0);
  const [genMsgIndex, setGenMsgIndex] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueIdRef = useRef<string | null>(null);
  const isMobile = useIsMobile();

  // Derived
  const selectedProviderData = providers.find((p) => p.id === selectedProvider) ?? null;
  const imageModels = selectedProviderData?.models.filter((m) => m.type === 'image') ?? [];
  const hasApiKey = apiKeysHook.hasKey(selectedProvider);

  // Build cinema suffix
  const cinemaSuffix = useMemo(
    () => buildCinemaSuffix(cinemaCamera, cinemaLens, cinemaFocalLength, cinemaAperture, cinemaFilmStock, cinemaColorGrade, cinemaLighting, cinemaScenePreset),
    [cinemaCamera, cinemaLens, cinemaFocalLength, cinemaAperture, cinemaFilmStock, cinemaColorGrade, cinemaLighting, cinemaScenePreset],
  );

  // Fetch providers
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/providers');
        if (!res.ok) throw new Error('Failed to fetch');
        const data: Provider[] = await res.json();

        // Merge custom models from IndexedDB
        try {
          const customModels = await getAllCustomModels();
          for (const cm of customModels) {
            const provider = data.find((p) => p.name === cm.providerId || p.id === cm.providerId);
            if (provider) {
              provider.models.push({
                id: `custom-${cm.id}`,
                name: cm.name,
                modelId: cm.modelId,
                type: cm.type,
                capabilities: cm.capabilities,
                description: cm.description || '',
                priceInfo: cm.priceInfo || '',
                isDefault: false,
              });
            }
          }
        } catch { /* non-critical */ }

        setProviders(data);

        if (!selectedProvider && data.length > 0) {
          const withKey = data.find((p) => apiKeysHook.hasKey(p.id));
          const pick = withKey || data[0];
          setSelectedProvider(pick.id);
          const defaultModel = pick.models.find((m) => m.isDefault && m.type === 'image');
          if (defaultModel) {
            setSelectedModel(defaultModel.modelId);
          } else {
            const firstImage = pick.models.find((m) => m.type === 'image');
            if (firstImage) setSelectedModel(firstImage.modelId);
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

  // When provider changes, reset model
  useEffect(() => {
    if (!selectedProvider || providers.length === 0) return;
    const prov = providers.find((p) => p.id === selectedProvider);
    if (!prov) return;
    const defaultModel = prov.models.find((m) => m.isDefault && m.type === 'image');
    if (defaultModel) {
      setSelectedModel(defaultModel.modelId);
    } else {
      const firstImage = prov.models.find((m) => m.type === 'image');
      if (firstImage) setSelectedModel(firstImage.modelId);
      else setSelectedModel('');
    }
  }, [selectedProvider, providers]);



  // Polling logic
  const startPolling = useCallback(
    (generationId: string) => {
      if (pollRef.current) clearInterval(pollRef.current);

      pollRef.current = setInterval(async () => {
        try {
          const apiKey = await apiKeysHook.getKeyForProvider(selectedProvider);
          const res = await fetch(`/api/generate/status?id=${generationId}${apiKey ? `&apiKey=${encodeURIComponent(apiKey)}` : ''}`);
          if (!res.ok) throw new Error('Status check failed');
          const data = await res.json();

          if (data.status === 'completed') {
            setIsCinemaGenerating(false);
            setLatestResult(data.resultUrl || data.urls?.[0] || null);
            setCurrentJobId(null);
            if (queueIdRef.current) {
              updateQueueItem(queueIdRef.current, { status: 'completed', resultUrl: data.resultUrl || data.urls?.[0] || undefined });
              queueIdRef.current = null;
            }
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            toast.success('Cinematic image generated successfully!');
          } else if (data.status === 'failed') {
            setIsCinemaGenerating(false);
            setCurrentJobId(null);
            if (queueIdRef.current) {
              updateQueueItem(queueIdRef.current, { status: 'failed' });
              queueIdRef.current = null;
            }
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            toast.error(data.error || 'Generation failed');
          }
        } catch {
          // retry next interval
        }
      }, 3000);
    },
    [setIsCinemaGenerating, setLatestResult, updateQueueItem, apiKeysHook, selectedProvider],
  );

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Loading state: start timer & rotate messages
  useEffect(() => {
    if (isCinemaGenerating) {
      setGenStartTime(Date.now());
      setGenElapsed(0);
      setGenMsgIndex(0);
    } else {
      setGenStartTime(null);
    }
  }, [isCinemaGenerating]);

  useEffect(() => {
    if (!isCinemaGenerating || !genStartTime) return;
    const interval = setInterval(() => {
      setGenElapsed(Math.floor((Date.now() - genStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isCinemaGenerating, genStartTime]);

  useEffect(() => {
    if (!isCinemaGenerating) return;
    const interval = setInterval(() => {
      setGenMsgIndex((prev) => (prev + 1) % 6);
    }, 2000);
    return () => clearInterval(interval);
  }, [isCinemaGenerating]);

  // Auto-hide generation info card after 5 seconds
  useEffect(() => {
    if (latestResult && showGenInfo) {
      const timer = setTimeout(() => setShowGenInfo(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [latestResult, showGenInfo]);

  // Generate handler
  const handleGenerate = useCallback(async () => {
    if (!selectedProvider) {
      toast.error('Please select a provider');
      return;
    }
    if (!selectedModel) {
      toast.error('Please select a model');
      return;
    }
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }
    if (!hasApiKey) {
      toast.error('No API key configured for this provider. Add one in Settings.');
      return;
    }

    // Read fresh state from store to avoid stale closures
    const freshState = useAppStore.getState();
    const freshScenePreset = CINEMA_SCENE_PRESETS.find((s) => s.id === freshState.cinemaScenePreset);
    const sceneSuffix = freshScenePreset ? freshScenePreset.suffix : '';

    // Combine user prompt with cinema suffix + scene preset suffix
    const finalPrompt = `${prompt.trim()}, ${cinemaSuffix}${sceneSuffix}`;

    setIsCinemaGenerating(true);
    setLatestResult(null);
    setCurrentJobId(null);

    // Add to generation queue
    const queueItem: GenerationQueueItem = {
      id: `cin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      prompt: prompt.trim(),
      providerName: selectedProviderData?.displayName || selectedProvider,
      providerColor: selectedProviderData?.color || '#F59E0B',
      modelName: imageModels.find((m) => m.modelId === selectedModel)?.name || selectedModel,
      status: 'processing',
      createdAt: Date.now(),
    };
    addToQueue(queueItem);
    queueIdRef.current = queueItem.id;

    try {
      const body: Record<string, unknown> = {
        providerId: selectedProvider,
        modelId: selectedModel,
        prompt: finalPrompt,
        negativePrompt: negativePrompt.trim() || undefined,
        aspectRatio,
        batchSize,
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
        setLatestResult(data.urls[0] || null);
        setIsCinemaGenerating(false);
        if (queueIdRef.current) {
          updateQueueItem(queueIdRef.current, { status: 'completed', resultUrl: data.urls[0] || undefined });
          queueIdRef.current = null;
        }
        toast.success('Cinematic image generated successfully!');
      } else if (data.status === 'processing' && data.id) {
        setCurrentJobId(data.id);
        startPolling(data.id);
        toast.info('Generation in progress...');
      } else {
        setIsCinemaGenerating(false);
        if (queueIdRef.current) {
          updateQueueItem(queueIdRef.current, { status: 'failed' });
          queueIdRef.current = null;
        }
        toast.error('Unexpected response from server');
      }
    } catch (err) {
      setIsCinemaGenerating(false);
      if (queueIdRef.current) {
        updateQueueItem(queueIdRef.current, { status: 'failed' });
        queueIdRef.current = null;
      }
      toast.error(err instanceof Error ? err.message : 'Generation failed');
    }
  }, [
    selectedProvider,
    selectedModel,
    prompt,
    negativePrompt,
    aspectRatio,
    batchSize,
    hasApiKey,
    cinemaSuffix,
    setIsCinemaGenerating,
    setLatestResult,
    startPolling,
    addToQueue,
    updateQueueItem,
    selectedProviderData,
    imageModels,
  ]);

  // Keyboard shortcut: generate on trigger
  useEffect(() => {
    if (generateTrigger > 0) {
      handleGenerate();
    }
  }, [generateTrigger, handleGenerate]);

  // Download helper
  const handleDownload = useCallback(async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `cinema-studio-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast.success('Image downloaded');
    } catch {
      window.open(url, '_blank');
    }
  }, []);

  // Favorite helper
  const handleFavorite = useCallback(async (id: string) => {
    try {
      await data.toggleGenerationFavorite(id, false);
      toast.success('Added to favorites');
    } catch {
      toast.error('Failed to favorite');
    }
  }, []);

  // ========================================================================
  // RENDER
  // ========================================================================

  const sidebarProps = {
    providers,
    providersLoading,
    selectedProvider,
    setSelectedProvider,
    selectedModel,
    setSelectedModel,
    selectedProviderData,
    imageModels,
    hasApiKey,
    configuredProviderIds: apiKeysHook.configuredProviderIds,
    prompt,
    setPrompt,
    negativePrompt,
    setNegativePrompt,
    aspectRatio,
    setAspectRatio,
    batchSize,
    setBatchSize,
    isCinemaGenerating,
    showNegPrompt,
    setShowNegPrompt,
    cinemaCamera,
    setCinemaCamera,
    cinemaLens,
    setCinemaLens,
    cinemaFocalLength,
    setCinemaFocalLength,
    cinemaAperture,
    setCinemaAperture,
    cinemaFilmStock,
    setCinemaFilmStock,
    cinemaColorGrade,
    setCinemaColorGrade,
    cinemaLighting,
    setCinemaLighting,
    cinemaScenePreset,
    setCinemaScenePreset,
    cinemaSuffix,
    onGenerate: handleGenerate,
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* ================================================================== */}
      {/* LEFT SIDEBAR – Cinema Controls                                     */}
      {/* ================================================================== */}

      {/* Desktop sidebar */}
      <aside className="hidden md:block w-[380px] min-w-[380px] max-w-[380px] shrink-0 overflow-hidden border-r border-border/60">
        <ScrollArea className="h-full">
          <CinemaSidebarContent {...sidebarProps} />
        </ScrollArea>
      </aside>

      {/* Mobile sidebar - Sheet/Drawer */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="glass-strong w-[340px] p-0 border-r-0">
          <SheetTitle className="sr-only">Cinema Studio Controls</SheetTitle>
          <SheetDescription className="sr-only">Configure cinema generation settings</SheetDescription>
          <ScrollArea className="h-full">
            <CinemaSidebarContent {...sidebarProps} onMobileClose={() => setMobileSidebarOpen(false)} />
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
          <Badge className="gap-1 text-[10px] bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20">
            <Clapperboard className="h-3 w-3" />
            CINEMA
          </Badge>
          {selectedProviderData && (
            <Badge variant="secondary" className="ml-auto gap-1 text-[10px] bg-surface border-border text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: selectedProviderData.color || '#888' }} />
              {selectedProviderData.displayName}
            </Badge>
          )}
        </div>

        {/* Cinema mode indicator (desktop) */}
        {!isMobile && (
          <div className="hidden md:flex items-center gap-2 px-4 py-1.5 border-b border-border/30 bg-[#F59E0B]/5">
            <Clapperboard className="h-3.5 w-3.5 text-[#F59E0B]/70" />
            <span className="text-[11px] text-[#F59E0B]/70 font-medium">Cinema Mode Active</span>
            <span className="text-[10px] text-muted-foreground/50 ml-2">
              {CAMERA_BODIES.find((c) => c.id === cinemaCamera)?.name} • {cinemaFocalLength}mm • f/{cinemaAperture}
            </span>
            <button type="button" onClick={() => setMobileSidebarOpen(false)} className="sr-only">
              Close sidebar
            </button>
          </div>
        )}

        {/* Result area */}
        <div className="flex-1 flex items-center justify-center p-4 md:p-6">
          <AnimatePresence mode="wait">
            {/* --- Empty State --- */}
            {!isCinemaGenerating && !latestResult && (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center gap-6 text-center relative"
              >
                {/* Animated gradient background */}
                <div className="absolute inset-0 -m-8 rounded-3xl bg-gradient-to-br from-[#F59E0B]/5 via-transparent to-[#F59E0B]/3 animate-empty-gradient pointer-events-none" />

                {/* Floating Clapperboard icon with pulsing glow */}
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="relative z-10"
                >
                  <div className="absolute -inset-6 rounded-full bg-[#F59E0B]/5 blur-3xl animate-empty-glow" />
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-surface/80 border border-[#F59E0B]/20 backdrop-blur-sm animate-empty-glow">
                    <Clapperboard className="h-10 w-10 text-[#F59E0B]/60" />
                  </div>
                </motion.div>

                <div className="relative z-10">
                  <h3 className="text-lg font-semibold text-foreground">
                    Generate your first cinematic image
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                    Configure camera settings, choose a scene preset, and type your scene to create professional cinematic images.
                  </p>
                </div>

                {/* Feature hint cards with staggered entrance */}
                <div className="flex flex-col sm:flex-row items-stretch gap-3 mt-2 relative z-10">
                  {[
                    { icon: <Camera className="h-5 w-5 text-[#F59E0B]" />, title: 'Camera Controls', desc: 'Real camera bodies, lenses & film stocks' },
                    { icon: <Clapperboard className="h-5 w-5 text-[#F59E0B]" />, title: 'Scene Presets', desc: 'Hollywood Epic, Neo Noir & more' },
                    { icon: <Film className="h-5 w-5 text-[#F59E0B]" />, title: 'Cinema Suffix', desc: 'Auto-generated cinematic prompt enhancement' },
                  ].map((card, i) => (
                    <motion.div
                      key={card.title}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + i * 0.1, duration: 0.4 }}
                      className="flex items-start gap-3 rounded-xl border border-border/30 bg-surface/60 backdrop-blur-sm p-4 min-w-[160px] text-left"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F59E0B]/10 shrink-0">
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
            {isCinemaGenerating && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center gap-6 text-center w-full max-w-md"
              >
                <div className="relative flex h-32 w-32 items-center justify-center">
                  {/* Pulsing ring - amber colored for cinema */}
                  <div className="absolute inset-0 rounded-full border-2 border-[#F59E0B]/20 animate-neon-pulse" />
                  <div className="absolute inset-3 rounded-full border-2 border-[#F59E0B]/40 animate-neon-pulse [animation-delay:0.5s]" />
                  <div className="absolute inset-6 rounded-full border-2 border-[#F59E0B]/60 animate-neon-pulse [animation-delay:1s]" />
                  <Clapperboard className="h-10 w-10 text-[#F59E0B] animate-neon-pulse" />
                </div>

                <div className="space-y-3 w-full">
                  <h3 className="text-lg font-semibold text-foreground">Generating cinematic image…</h3>

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
                        '🎬 Setting up camera...',
                        '🔍 Adjusting lens...',
                        '🎞️ Loading film stock...',
                        '💡 Processing exposure...',
                        '🎨 Applying color grade...',
                        '📸 Finalizing shot...',
                      ][genMsgIndex]}
                    </motion.p>
                  </AnimatePresence>

                  {/* Stylized progress bar */}
                  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                    <div className="absolute inset-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-[#F59E0B] to-transparent animate-gen-progress" />
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
            {!isCinemaGenerating && latestResult && (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center gap-4 w-full max-w-3xl"
              >
                {/* Image container */}
                <div
                  className="relative w-full overflow-hidden rounded-xl border border-[#F59E0B]/30 bg-surface shadow-2xl group"
                  onMouseEnter={() => setShowGenInfo(true)}
                  onMouseLeave={() => setShowGenInfo(false)}
                >
                  <img
                    src={latestResult}
                    alt={prompt}
                    className="w-full h-auto max-h-[60vh] object-contain"
                  />

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
                          {imageModels.find((m) => m.modelId === selectedModel)?.name || selectedModel}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-3 flex-wrap justify-center">
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
                    className="gap-2 border-[#F59E0B]/40 bg-[#F59E0B]/5 text-[#F59E0B] hover:bg-[#F59E0B]/10 hover:text-[#F59E0B]"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Regenerate
                  </Button>
                </div>

                {/* Prompt echo with cinema suffix */}
                <div className="text-center max-w-lg">
                  <p className="text-xs text-muted-foreground/60 line-clamp-2">
                    &ldquo;{prompt}&rdquo;
                  </p>
                  <p className="text-[10px] text-[#F59E0B]/50 mt-1 line-clamp-2">
                    + {cinemaSuffix}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Recent Generations Quick-Access Bar */}
        <RecentBar accentColor="#F59E0B" />
      </main>
    </div>
  );
}
