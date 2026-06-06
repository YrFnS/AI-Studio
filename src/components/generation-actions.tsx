'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  RefreshCw,
  ArrowUpCircle,
  Film,
  Pencil,
  Palette,
  Sparkles,
  Expand,
  Maximize2,
  Share2,
  ChevronDown,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GenerationAction =
  | { type: 'variation'; prompt: string }
  | { type: 'upscale'; imageUrl: string }
  | { type: 'animate'; imageUrl: string; prompt: string }
  | { type: 'edit'; imageUrl: string; prompt: string }
  | { type: 'inpaint'; imageUrl: string }
  | { type: 'style-transfer'; imageUrl: string; style: string }
  | { type: 'enhance'; imageUrl: string }
  | { type: 'outpaint'; imageUrl: string; direction: string }
  | { type: 'resize'; imageUrl: string }
  | { type: 'variation-video'; prompt: string }
  | { type: 'edit-prompt'; prompt: string }
  | { type: 'style-change'; prompt: string; style: string }
  | { type: 'hd-upscale'; imageUrl: string };

interface GenerationActionsProps {
  resultUrl: string;
  resultType: 'image' | 'video';
  prompt: string;
  negativePrompt?: string;
  providerId: string;
  modelId: string;
  onAction: (action: GenerationAction) => void;
}

// ---------------------------------------------------------------------------
// Style Presets for Style Transfer
// ---------------------------------------------------------------------------

const STYLE_TRANSFER_OPTIONS = [
  { id: 'photorealistic', label: '📷 Photorealistic', suffix: ', photorealistic, ultra detailed, 8k, DSLR quality' },
  { id: 'anime', label: '🌸 Anime', suffix: ', anime style, vibrant colors, detailed illustration' },
  { id: 'cinematic', label: '🎬 Cinematic', suffix: ', cinematic still, dramatic lighting, color graded' },
  { id: 'oil-painting', label: '🎨 Oil Painting', suffix: ', oil painting style, thick brushstrokes, canvas texture' },
  { id: 'digital-art', label: '💻 Digital Art', suffix: ', digital art, concept art, detailed illustration' },
  { id: 'watercolor', label: '🖌️ Watercolor', suffix: ', watercolor painting style, soft edges, flowing colors' },
  { id: '3d-render', label: '🧊 3D Render', suffix: ', 3d render, octane render, unreal engine' },
  { id: 'pixel-art', label: '👾 Pixel Art', suffix: ', pixel art style, 16-bit, retro game aesthetic' },
];

const VIDEO_STYLE_OPTIONS = [
  { id: 'cinematic', label: '🎬 Cinematic', suffix: ', cinematic film style, dramatic lighting' },
  { id: 'animation', label: '✨ Animation', suffix: ', animated style, smooth motion' },
  { id: 'documentary', label: '📹 Documentary', suffix: ', documentary style, natural lighting' },
  { id: 'social', label: '📱 Social Media', suffix: ', social media style, eye-catching' },
];

const OUTPAINT_DIRECTIONS = [
  { id: 'left', label: '⬅️ Left' },
  { id: 'right', label: '➡️ Right' },
  { id: 'up', label: '⬆️ Up' },
  { id: 'down', label: '⬇️ Down' },
  { id: 'all', label: '🔲 All Sides' },
];

// ---------------------------------------------------------------------------
// Provider/Model capability checking hook
// ---------------------------------------------------------------------------

interface ProviderModelInfo {
  id: string;
  name: string;
  modelId: string;
  type: string;
  capabilities: string;
}

interface ProviderInfo {
  id: string;
  name: string;
  displayName: string;
  models: ProviderModelInfo[];
}

function useCapabilities() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/providers')
      .then((res) => res.json())
      .then((data: ProviderInfo[]) => setProviders(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const hasCapability = useMemo(() => {
    return (capability: string): boolean => {
      if (loading) return true; // Assume available while loading
      return providers.some((p) =>
        p.models.some((m) =>
          m.capabilities.split(',').map((c) => c.trim()).includes(capability)
        )
      );
    };
  }, [providers, loading]);

  const findProviderWithCapability = useMemo(() => {
    return (capability: string): { providerId: string; modelId: string } | null => {
      for (const p of providers) {
        for (const m of p.models) {
          const caps = m.capabilities.split(',').map((c) => c.trim());
          if (caps.includes(capability)) {
            return { providerId: p.id, modelId: m.modelId };
          }
        }
      }
      return null;
    };
  }, [providers]);

  return { hasCapability, findProviderWithCapability, loading };
}

// ---------------------------------------------------------------------------
// Action Button Component
// ---------------------------------------------------------------------------

function ActionButton({
  icon,
  label,
  badge,
  disabled,
  disabledReason,
  onClick,
  accentColor = '#d9ff00',
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  disabled?: boolean;
  disabledReason?: string;
  onClick: () => void;
  accentColor?: string;
}) {
  const button = (
    <motion.button
      type="button"
      whileHover={!disabled ? { scale: 1.05, y: -2 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      className={`
        relative flex flex-col items-center gap-1.5 rounded-xl border px-3 py-2.5 text-center transition-all min-w-[72px]
        ${
          disabled
            ? 'border-border/20 bg-surface/30 opacity-40 cursor-not-allowed'
            : `border-border/40 bg-surface hover:border-[${accentColor}]/40 hover:bg-[${accentColor}]/5 hover:shadow-[0_0_12px_${accentColor}15]`
        }
      `}
      style={
        !disabled
          ? {
              // @ts-expect-error CSS custom property for hover
              '--accent': accentColor,
            }
          : undefined
      }
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
          disabled ? 'text-muted-foreground/30' : 'text-foreground/70'
        }`}
        style={!disabled ? { color: accentColor } : undefined}
      >
        {icon}
      </span>
      <span
        className={`text-[10px] font-medium leading-tight ${
          disabled ? 'text-muted-foreground/40' : 'text-foreground/80'
        }`}
      >
        {label}
      </span>
      {badge && !disabled && (
        <span
          className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8px] font-bold text-background"
          style={{ backgroundColor: accentColor }}
        >
          {badge}
        </span>
      )}
    </motion.button>
  );

  if (disabled && disabledReason) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {disabledReason}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function GenerationActions({
  resultUrl,
  resultType,
  prompt,
  negativePrompt: _negativePrompt,
  providerId: _providerId,
  modelId: _modelId,
  onAction,
}: GenerationActionsProps) {
  const { hasCapability, findProviderWithCapability } = useCapabilities();
  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const [outpaintPickerOpen, setOutpaintPickerOpen] = useState(false);

  // ---- Image Actions ----
  const imageActions = useMemo(() => {
    const hasUpscale = hasCapability('upscale');
    const hasI2v = hasCapability('i2v');
    const hasEdit = hasCapability('edit') || hasCapability('inpaint');

    return [
      {
        key: 'variation',
        icon: <RefreshCw className="h-4 w-4" />,
        label: 'Variations',
        badge: undefined,
        disabled: false,
        disabledReason: undefined,
        onClick: () => onAction({ type: 'variation', prompt }),
      },
      {
        key: 'upscale',
        icon: <ArrowUpCircle className="h-4 w-4" />,
        label: 'Upscale 2×',
        badge: hasUpscale ? '✓' : undefined,
        disabled: !hasUpscale,
        disabledReason: 'No model available for this action',
        onClick: () => onAction({ type: 'upscale', imageUrl: resultUrl }),
      },
      {
        key: 'animate',
        icon: <Film className="h-4 w-4" />,
        label: 'Animate',
        badge: hasI2v ? '✓' : undefined,
        disabled: !hasI2v,
        disabledReason: 'No i2v model available for this action',
        onClick: () => onAction({ type: 'animate', imageUrl: resultUrl, prompt }),
      },
      {
        key: 'edit',
        icon: <Pencil className="h-4 w-4" />,
        label: 'Edit',
        badge: hasEdit ? '✓' : undefined,
        disabled: !hasEdit,
        disabledReason: 'No edit/inpaint model available for this action',
        onClick: () => onAction({ type: 'edit', imageUrl: resultUrl, prompt }),
      },
      {
        key: 'style-transfer',
        icon: <Palette className="h-4 w-4" />,
        label: 'Style',
        badge: undefined,
        disabled: false,
        disabledReason: undefined,
        onClick: () => setStylePickerOpen(true),
      },
      {
        key: 'enhance',
        icon: <Sparkles className="h-4 w-4" />,
        label: 'Enhance',
        badge: undefined,
        disabled: false,
        disabledReason: undefined,
        onClick: () => onAction({ type: 'enhance', imageUrl: resultUrl }),
      },
      {
        key: 'outpaint',
        icon: <Expand className="h-4 w-4" />,
        label: 'Outpaint',
        badge: hasEdit ? '✓' : undefined,
        disabled: !hasEdit,
        disabledReason: 'No edit model available for this action',
        onClick: () => setOutpaintPickerOpen(true),
      },
      {
        key: 'resize',
        icon: <Maximize2 className="h-4 w-4" />,
        label: 'Resize',
        badge: undefined,
        disabled: false,
        disabledReason: undefined,
        onClick: () => onAction({ type: 'resize', imageUrl: resultUrl }),
      },
    ];
  }, [hasCapability, findProviderWithCapability, prompt, resultUrl, onAction]);

  // ---- Video Actions ----
  const videoActions = useMemo(() => {
    return [
      {
        key: 'variation-video',
        icon: <RefreshCw className="h-4 w-4" />,
        label: 'Variation',
        badge: undefined,
        disabled: false,
        disabledReason: undefined,
        onClick: () => onAction({ type: 'variation-video', prompt }),
      },
      {
        key: 'edit-prompt',
        icon: <Pencil className="h-4 w-4" />,
        label: 'Edit Prompt',
        badge: undefined,
        disabled: false,
        disabledReason: undefined,
        onClick: () => onAction({ type: 'edit-prompt', prompt }),
      },
      {
        key: 'style-change',
        icon: <Palette className="h-4 w-4" />,
        label: 'Style Change',
        badge: undefined,
        disabled: false,
        disabledReason: undefined,
        onClick: () => setStylePickerOpen(true),
      },
      {
        key: 'hd-upscale',
        icon: <ArrowUpCircle className="h-4 w-4" />,
        label: 'HD Upscale',
        badge: undefined,
        disabled: !hasCapability('upscale'),
        disabledReason: 'No upscale model available for this action',
        onClick: () => onAction({ type: 'hd-upscale', imageUrl: resultUrl }),
      },
    ];
  }, [hasCapability, prompt, resultUrl, onAction]);

  const actions = resultType === 'image' ? imageActions : videoActions;

  // ---- Handle Style Transfer ----
  const handleStyleTransfer = (style: { id: string; label: string; suffix: string }) => {
    setStylePickerOpen(false);
    if (resultType === 'image') {
      onAction({ type: 'style-transfer', imageUrl: resultUrl, style: style.suffix });
    } else {
      onAction({ type: 'style-change', prompt, style: style.suffix });
    }
    toast.success(`Applying ${style.label} style`);
  };

  // ---- Handle Outpaint ----
  const handleOutpaint = (direction: string) => {
    setOutpaintPickerOpen(false);
    onAction({ type: 'outpaint', imageUrl: resultUrl, direction });
    toast.success(`Outpainting ${direction}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="w-full"
    >
      {/* Glassmorphism action bar */}
      <div className="relative rounded-xl border border-border/30 bg-black/40 backdrop-blur-xl p-3 shadow-lg">
        {/* Label */}
        <div className="flex items-center gap-2 mb-2.5 px-1">
          <Sparkles className="h-3.5 w-3.5 text-[#d9ff00]/60" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Quick Actions
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-border/30 to-transparent" />
        </div>

        {/* Scrollable actions row */}
        <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
          {actions.map((action) => {
            // Special handling for style-transfer and outpaint which have popovers
            if (action.key === 'style-transfer' || (resultType === 'video' && action.key === 'style-change')) {
              const styles = resultType === 'image' ? STYLE_TRANSFER_OPTIONS : VIDEO_STYLE_OPTIONS;
              return (
                <Popover
                  key={action.key}
                  open={stylePickerOpen}
                  onOpenChange={setStylePickerOpen}
                >
                  <PopoverTrigger asChild>
                    <div>
                      <ActionButton
                        icon={action.icon}
                        label={action.label}
                        badge={action.badge}
                        disabled={action.disabled}
                        disabledReason={action.disabledReason}
                        onClick={() => setStylePickerOpen(true)}
                      />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-64 glass-strong border-border/40 p-2"
                    align="center"
                    side="top"
                  >
                    <div className="space-y-1">
                      <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Choose Style
                      </div>
                      {styles.map((style) => (
                        <motion.button
                          key={style.id}
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleStyleTransfer(style)}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-foreground hover:bg-[#d9ff00]/5 hover:text-[#d9ff00] transition-all"
                        >
                          <span className="text-sm">{style.label}</span>
                        </motion.button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              );
            }

            if (action.key === 'outpaint') {
              return (
                <Popover
                  key={action.key}
                  open={outpaintPickerOpen}
                  onOpenChange={setOutpaintPickerOpen}
                >
                  <PopoverTrigger asChild>
                    <div>
                      <ActionButton
                        icon={action.icon}
                        label={action.label}
                        badge={action.badge}
                        disabled={action.disabled}
                        disabledReason={action.disabledReason}
                        onClick={() => setOutpaintPickerOpen(true)}
                      />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-48 glass-strong border-border/40 p-2"
                    align="center"
                    side="top"
                  >
                    <div className="space-y-1">
                      <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Outpaint Direction
                      </div>
                      {OUTPAINT_DIRECTIONS.map((dir) => (
                        <motion.button
                          key={dir.id}
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleOutpaint(dir.id)}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-foreground hover:bg-[#d9ff00]/5 hover:text-[#d9ff00] transition-all"
                        >
                          {dir.label}
                        </motion.button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              );
            }

            return (
              <ActionButton
                key={action.key}
                icon={action.icon}
                label={action.label}
                badge={action.badge}
                disabled={action.disabled}
                disabledReason={action.disabledReason}
                onClick={action.onClick}
              />
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
