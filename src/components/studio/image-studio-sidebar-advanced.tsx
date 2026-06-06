'use client';

import {
  Settings2,
  Zap,
  FileImage,
  Shuffle,
  Wand2,
  Cpu,
  Gauge,
  Camera,
  Shield,
  Sun,
  Droplets,
  Film,
  Eye,
  Maximize2,
  Grid3x3,
  Layers,
  FlaskConical,
  Palette,
  Dices,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { PresetButton } from '@/components/studio/preset-button';
import {
  SCHEDULER_OPTIONS,
  LIGHTING_PRESETS,
  COLOR_MOOD_PRESETS,
  CAMERA_SHOT_PRESETS,
} from '@/components/studio/presets';
import type { Provider } from '@/components/studio/image-studio-types';

// ---------------------------------------------------------------------------
// Reusable option toggle button (replaces motion.button to fix enlargement bug)
// ---------------------------------------------------------------------------

function OptionButton({
  active,
  onClick,
  children,
  className = '',
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  // KEY FIX: No shadow/ring on active state — only border-color + bg-color
  // Shadows/rings add visual pixels outside border-box causing "enlargement" bug
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap overflow-hidden rounded-md border transition-colors duration-150 ${
        active
          ? 'border-[#d9ff00] bg-[#d9ff00]/15 text-[#d9ff00]'
          : 'border-transparent bg-surface/60 text-muted-foreground hover:bg-surface hover:text-foreground hover:border-border/40'
      } ${className}`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Sidebar Advanced Settings Component
// ---------------------------------------------------------------------------

interface SidebarAdvancedProps {
  providers: Provider[];
  selectedImageProvider: string;
  selectedImageModel: string;
}

export function SidebarAdvanced({ providers, selectedImageProvider, selectedImageModel }: SidebarAdvancedProps) {
  // Read all settings state from the Zustand store
  const imageQuality = useAppStore((s) => s.imageQuality);
  const setImageQuality = useAppStore((s) => s.setImageQuality);
  const imageFormat = useAppStore((s) => s.imageFormat);
  const setImageFormat = useAppStore((s) => s.setImageFormat);
  const imageSteps = useAppStore((s) => s.imageSteps);
  const setImageSteps = useAppStore((s) => s.setImageSteps);
  const imageGuidance = useAppStore((s) => s.imageGuidance);
  const setImageGuidance = useAppStore((s) => s.setImageGuidance);
  const imageSeed = useAppStore((s) => s.imageSeed);
  const setImageSeed = useAppStore((s) => s.setImageSeed);
  const imageBatchSize = useAppStore((s) => s.imageBatchSize);
  const setImageBatchSize = useAppStore((s) => s.setImageBatchSize);
  const inputImageUrl = useAppStore((s) => s.inputImageUrl);
  const imageStrength = useAppStore((s) => s.imageStrength);
  const setImageStrength = useAppStore((s) => s.setImageStrength);
  const imageSampler = useAppStore((s) => s.imageSampler);
  const setImageSampler = useAppStore((s) => s.setImageSampler);
  const imageMagicPrompt = useAppStore((s) => s.imageMagicPrompt);
  const setImageMagicPrompt = useAppStore((s) => s.setImageMagicPrompt);
  const imageStyleType = useAppStore((s) => s.imageStyleType);
  const setImageStyleType = useAppStore((s) => s.setImageStyleType);
  const imageRenderingSpeed = useAppStore((s) => s.imageRenderingSpeed);
  const setImageRenderingSpeed = useAppStore((s) => s.setImageRenderingSpeed);
  const imageClipGuidance = useAppStore((s) => s.imageClipGuidance);
  const setImageClipGuidance = useAppStore((s) => s.setImageClipGuidance);
  const imageTileable = useAppStore((s) => s.imageTileable);
  const setImageTileable = useAppStore((s) => s.setImageTileable);
  const imagePhotoReal = useAppStore((s) => s.imagePhotoReal);
  const setImagePhotoReal = useAppStore((s) => s.setImagePhotoReal);
  const imageAlchemy = useAppStore((s) => s.imageAlchemy);
  const setImageAlchemy = useAppStore((s) => s.setImageAlchemy);
  const imageSafetyFilter = useAppStore((s) => s.imageSafetyFilter);
  const setImageSafetyFilter = useAppStore((s) => s.setImageSafetyFilter);
  const imageScheduler = useAppStore((s) => s.imageScheduler);
  const setImageScheduler = useAppStore((s) => s.setImageScheduler);
  const imageClipSkip = useAppStore((s) => s.imageClipSkip);
  const setImageClipSkip = useAppStore((s) => s.setImageClipSkip);
  const imageLighting = useAppStore((s) => s.imageLighting);
  const setImageLighting = useAppStore((s) => s.setImageLighting);
  const imageColorMood = useAppStore((s) => s.imageColorMood);
  const setImageColorMood = useAppStore((s) => s.setImageColorMood);
  const imageCameraShot = useAppStore((s) => s.imageCameraShot);
  const setImageCameraShot = useAppStore((s) => s.setImageCameraShot);
  const imageHiresFix = useAppStore((s) => s.imageHiresFix);
  const setImageHiresFix = useAppStore((s) => s.setImageHiresFix);
  const imageHiresScale = useAppStore((s) => s.imageHiresScale);
  const setImageHiresScale = useAppStore((s) => s.setImageHiresScale);
  const imageHiresSteps = useAppStore((s) => s.imageHiresSteps);
  const setImageHiresSteps = useAppStore((s) => s.setImageHiresSteps);
  const imageHiresDenoise = useAppStore((s) => s.imageHiresDenoise);
  const setImageHiresDenoise = useAppStore((s) => s.setImageHiresDenoise);
  const isSDProvider = ['stability', 'replicate', 'fal', 'together', 'fireworks', 'huggingface'].includes(selectedImageProvider);

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="advanced" className="border-border/30">
        <AccordionTrigger className="py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:no-underline hover:text-foreground">
          <span className="flex items-center gap-2"><Settings2 className="h-3.5 w-3.5" />Advanced Settings</span>
        </AccordionTrigger>
        <AccordionContent className="space-y-4 pt-3 animate-slide-in-right-subtle">
          {/* Quality Selector — OpenAI models */}
          {selectedImageProvider && providers.find((p) => p.id === selectedImageProvider)?.name === 'openai' && ['gpt-image-1', 'gpt-image-2', 'dall-e-3'].includes(selectedImageModel) && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Zap className="h-3 w-3" />
                Quality
              </Label>
              <div className="flex gap-1.5">
                {['low', 'medium', 'high'].map((q) => (
                  <OptionButton
                    key={q}
                    active={imageQuality === q}
                    onClick={() => setImageQuality(q)}
                    className="flex-1 px-3 py-1.5 text-xs font-medium capitalize"
                  >
                    {q}
                  </OptionButton>
                ))}
              </div>
            </div>
          )}

          {/* Output Format — All providers */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <FileImage className="h-3 w-3" />
              Output Format
            </Label>
            <div className="flex gap-1.5">
              {['png', 'jpeg', 'webp'].map((fmt) => (
                <OptionButton
                  key={fmt}
                  active={imageFormat === fmt}
                  onClick={() => setImageFormat(fmt)}
                  className="flex-1 px-3 py-1.5 text-xs font-medium uppercase"
                >
                  {fmt}
                </OptionButton>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Steps</Label>
              <span className="text-xs font-mono text-[#d9ff00]">{imageSteps}</span>
            </div>
            <Slider value={[imageSteps]} onValueChange={([v]) => setImageSteps(v)} min={1} max={50} step={1} className="w-full" />
            <div className="flex justify-between text-[10px] text-muted-foreground/60"><span>1</span><span>50</span></div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Guidance Scale</Label>
              <span className="text-xs font-mono text-[#d9ff00]">{imageGuidance}</span>
            </div>
            <Slider value={[imageGuidance]} onValueChange={([v]) => setImageGuidance(v)} min={1} max={20} step={0.5} className="w-full" />
            <div className="flex justify-between text-[10px] text-muted-foreground/60"><span>1</span><span>20</span></div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Seed</Label>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setImageSeed(Math.floor(Math.random() * 2147483647))}
                      className="flex items-center justify-center h-5 w-5 rounded border border-border/40 bg-surface text-muted-foreground hover:text-[#d9ff00] hover:border-[#d9ff00]/30 transition-colors"
                    >
                      <Dices className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Randomize seed</TooltipContent>
                </Tooltip>
                {imageSeed !== null && (
                  <button type="button" onClick={() => setImageSeed(null)} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Clear</button>
                )}
              </div>
            </div>
            <Input type="number" value={imageSeed ?? ''} onChange={(e) => { const v = e.target.value; setImageSeed(v === '' ? null : parseInt(v, 10)); }} placeholder="Random" className="bg-surface border-border/60 text-sm placeholder:text-muted-foreground/40" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Batch Size</Label>
              <span className="text-xs font-mono text-[#d9ff00]">{imageBatchSize}</span>
            </div>
            <Slider value={[imageBatchSize]} onValueChange={([v]) => setImageBatchSize(v)} min={1} max={4} step={1} className="w-full" />
            <div className="flex justify-between text-[10px] text-muted-foreground/60"><span>1</span><span>4</span></div>
          </div>

          {/* Image Strength / Denoising Strength */}
          {inputImageUrl && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Layers className="h-3 w-3" />
                  Image Strength
                </Label>
                <span className="text-xs font-mono text-[#d9ff00]">{imageStrength.toFixed(2)}</span>
              </div>
              <Slider value={[imageStrength]} onValueChange={([v]) => setImageStrength(v)} min={0} max={1} step={0.05} className="w-full" />
              <div className="flex justify-between text-[10px] text-muted-foreground/60"><span>0 (keep original)</span><span>1 (full redraw)</span></div>
            </div>
          )}

          {/* Sampler/Scheduler */}
          {isSDProvider && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Shuffle className="h-3 w-3" />
                Sampler
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {['dpmpp_2m', 'dpmpp_2m_sde', 'euler', 'euler_a', 'ddim', 'dpmpp_sde', 'heun', 'lms', 'dpm2', 'dpm2_a'].map((s) => (
                  <OptionButton
                    key={s}
                    active={imageSampler === s}
                    onClick={() => setImageSampler(s)}
                    className="px-2 py-1 text-[10px] font-mono"
                  >
                    {s}
                  </OptionButton>
                ))}
              </div>
            </div>
          )}

          {/* Ideogram-specific options */}
          {selectedImageProvider === 'ideogram' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Wand2 className="h-3 w-3" />
                  Magic Prompt
                </Label>
                <div className="flex gap-1.5">
                  {['ON', 'OFF'].map((v) => (
                    <OptionButton
                      key={v}
                      active={v === 'ON' ? imageMagicPrompt : !imageMagicPrompt}
                      onClick={() => setImageMagicPrompt(v === 'ON')}
                      className="flex-1 px-3 py-1.5 text-xs font-medium"
                    >
                      {v}
                    </OptionButton>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Cpu className="h-3 w-3" />
                  Style Type
                </Label>
                <div className="flex gap-1.5">
                  {['AUTO', 'GENERAL', 'REALISTIC', 'DESIGN'].map((s) => (
                    <OptionButton
                      key={s}
                      active={imageStyleType === s}
                      onClick={() => setImageStyleType(s)}
                      className="flex-1 px-2 py-1.5 text-[10px] font-medium"
                    >
                      {s}
                    </OptionButton>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Gauge className="h-3 w-3" />
                  Rendering Speed
                </Label>
                <div className="flex gap-1.5">
                  {['TURBO', 'DEFAULT', 'QUALITY'].map((s) => (
                    <OptionButton
                      key={s}
                      active={imageRenderingSpeed === s}
                      onClick={() => setImageRenderingSpeed(s)}
                      className="flex-1 px-2 py-1.5 text-[10px] font-medium"
                    >
                      {s}
                    </OptionButton>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Stability-specific options */}
          {selectedImageProvider === 'stability' && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Cpu className="h-3 w-3" />
                CLIP Guidance
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {['NONE', 'FAST_BLUE', 'FAST_GREEN', 'SIMPLE', 'SLOW', 'SLOWER', 'SLOWEST'].map((s) => (
                  <OptionButton
                    key={s}
                    active={imageClipGuidance === s}
                    onClick={() => setImageClipGuidance(s)}
                    className="px-2 py-1 text-[10px] font-mono"
                  >
                    {s}
                  </OptionButton>
                ))}
              </div>
            </div>
          )}

          {/* Leonardo-specific options */}
          {selectedImageProvider === 'leonardo' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <FlaskConical className="h-3 w-3" />
                  Alchemy
                </Label>
                <div className="flex gap-1.5">
                  {['ON', 'OFF'].map((v) => (
                    <OptionButton
                      key={v}
                      active={v === 'ON' ? imageAlchemy : !imageAlchemy}
                      onClick={() => setImageAlchemy(v === 'ON')}
                      className="flex-1 px-3 py-1.5 text-xs font-medium"
                    >
                      {v}
                    </OptionButton>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Camera className="h-3 w-3" />
                  PhotoReal
                </Label>
                <div className="flex gap-1.5">
                  {['ON', 'OFF'].map((v) => (
                    <OptionButton
                      key={v}
                      active={v === 'ON' ? imagePhotoReal : !imagePhotoReal}
                      onClick={() => setImagePhotoReal(v === 'ON')}
                      className="flex-1 px-3 py-1.5 text-xs font-medium"
                    >
                      {v}
                    </OptionButton>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* DALL-E 3 Style */}
          {selectedImageProvider === 'openai' && selectedImageModel === 'dall-e-3' && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Palette className="h-3 w-3" />
                DALL-E Style
              </Label>
              <div className="flex gap-1.5">
                {['vivid', 'natural'].map((s) => (
                  <OptionButton
                    key={s}
                    active={imageStyleType === s}
                    onClick={() => setImageStyleType(s)}
                    className="flex-1 px-3 py-1.5 text-xs font-medium capitalize"
                  >
                    {s}
                  </OptionButton>
                ))}
              </div>
            </div>
          )}

          {/* Safety Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Shield className="h-3 w-3" />
              Safety Filter
            </Label>
            <div className="flex gap-1.5">
              {['ON', 'OFF'].map((v) => (
                <OptionButton
                  key={v}
                  active={v === 'ON' ? imageSafetyFilter : !imageSafetyFilter}
                  onClick={() => setImageSafetyFilter(v === 'ON')}
                  className="flex-1 px-3 py-1.5 text-xs font-medium"
                >
                  {v}
                </OptionButton>
              ))}
            </div>
          </div>

          {/* Lighting Preset */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Sun className="h-3 w-3" />
              Lighting
            </Label>
            <div className="grid grid-cols-4 gap-1.5">
              {LIGHTING_PRESETS.map((preset) => (
                <PresetButton
                  key={preset.id}
                  emoji={preset.emoji}
                  label={preset.label}
                  isSelected={imageLighting === preset.id && preset.id !== 'none'}
                  onClick={() => setImageLighting(preset.id === imageLighting ? 'none' : preset.id)}
                  tooltip={preset.id === 'none' ? 'No lighting modifier' : `Adds: ${preset.suffix.slice(2)}`}
                  variant="grid"
                />
              ))}
            </div>
          </div>

          {/* Color Mood */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Droplets className="h-3 w-3" />
              Color Mood
            </Label>
            <div className="grid grid-cols-4 gap-1.5">
              {COLOR_MOOD_PRESETS.map((preset) => (
                <PresetButton
                  key={preset.id}
                  emoji={preset.emoji}
                  label={preset.label}
                  isSelected={imageColorMood === preset.id && preset.id !== 'none'}
                  onClick={() => setImageColorMood(preset.id === imageColorMood ? 'none' : preset.id)}
                  tooltip={preset.id === 'none' ? 'No color modifier' : `Adds: ${preset.suffix.slice(2)}`}
                  variant="grid"
                />
              ))}
            </div>
          </div>

          {/* Camera Shot */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Camera className="h-3 w-3" />
              Camera Shot
            </Label>
            <div className="grid grid-cols-4 gap-1.5">
              {CAMERA_SHOT_PRESETS.map((preset) => (
                <PresetButton
                  key={preset.id}
                  emoji={preset.emoji}
                  label={preset.label}
                  isSelected={imageCameraShot === preset.id && preset.id !== 'none'}
                  onClick={() => setImageCameraShot(preset.id === imageCameraShot ? 'none' : preset.id)}
                  tooltip={preset.id === 'none' ? 'No camera modifier' : `Adds: ${preset.suffix.slice(2)}`}
                  variant="grid"
                />
              ))}
            </div>
          </div>

          {/* Scheduler / Noise Schedule */}
          {isSDProvider && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Film className="h-3 w-3" />
                Scheduler
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {SCHEDULER_OPTIONS.map((s) => (
                  <button key={s.id} type="button"
                    onClick={() => setImageScheduler(s.id)}
                    className={`whitespace-nowrap overflow-hidden rounded-md border px-2 py-1 text-[10px] font-medium transition-colors duration-150 ${
                      imageScheduler === s.id ? 'border-[#d9ff00] bg-[#d9ff00]/15 text-[#d9ff00]' : 'border-transparent bg-surface/60 text-muted-foreground hover:bg-surface hover:text-foreground hover:border-border/40'
                    }`}
                  >{s.label}</button>
                ))}
              </div>
            </div>
          )}

          {/* CLIP Skip */}
          {isSDProvider && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Eye className="h-3 w-3" />
                  CLIP Skip
                </Label>
                <span className="text-xs font-mono text-[#d9ff00]">{imageClipSkip}</span>
              </div>
              <Slider value={[imageClipSkip]} onValueChange={([v]) => setImageClipSkip(v)} min={1} max={12} step={1} className="w-full" />
              <div className="flex justify-between text-[10px] text-muted-foreground/60"><span>1 (full)</span><span>12 (abstract)</span></div>
            </div>
          )}

          {/* Hi-Res Fix */}
          {isSDProvider && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Maximize2 className="h-3 w-3" />
                  Hi-Res Fix
                </Label>
                <div className="flex gap-1.5">
                  {['ON', 'OFF'].map((v) => (
                    <OptionButton
                      key={v}
                      active={v === 'ON' ? imageHiresFix : !imageHiresFix}
                      onClick={() => setImageHiresFix(v === 'ON')}
                      className="px-2.5 py-1 text-[10px] font-medium"
                    >
                      {v}
                    </OptionButton>
                  ))}
                </div>
              </div>
              {imageHiresFix && (
                <div className="space-y-3 overflow-hidden">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] text-muted-foreground/60">Upscale Factor</Label>
                      <span className="text-xs font-mono text-[#d9ff00]">{imageHiresScale}x</span>
                    </div>
                    <Slider value={[imageHiresScale]} onValueChange={([v]) => setImageHiresScale(v)} min={1.5} max={4} step={0.5} className="w-full" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] text-muted-foreground/60">Hi-Res Steps</Label>
                      <span className="text-xs font-mono text-[#d9ff00]">{imageHiresSteps}</span>
                    </div>
                    <Slider value={[imageHiresSteps]} onValueChange={([v]) => setImageHiresSteps(v)} min={5} max={50} step={1} className="w-full" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] text-muted-foreground/60">Denoise Strength</Label>
                      <span className="text-xs font-mono text-[#d9ff00]">{imageHiresDenoise.toFixed(2)}</span>
                    </div>
                    <Slider value={[imageHiresDenoise]} onValueChange={([v]) => setImageHiresDenoise(v)} min={0.1} max={1} step={0.05} className="w-full" />
                    <div className="flex justify-between text-[10px] text-muted-foreground/60"><span>0.1 (subtle)</span><span>1.0 (full)</span></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tileable/Seamless */}
          {selectedImageProvider === 'stability' && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Grid3x3 className="h-3 w-3" />
                Tileable / Seamless
              </Label>
              <div className="flex gap-1.5">
                {['ON', 'OFF'].map((v) => (
                  <OptionButton
                    key={v}
                    active={v === 'ON' ? imageTileable : !imageTileable}
                    onClick={() => setImageTileable(v === 'ON')}
                    className="flex-1 px-3 py-1.5 text-xs font-medium"
                  >
                    {v}
                  </OptionButton>
                ))}
              </div>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
