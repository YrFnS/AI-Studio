'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Search, Palette, X, Sparkles } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Style Presets Data
// ---------------------------------------------------------------------------

interface StylePreset {
  id: string;
  name: string;
  emoji: string;
  description: string;
  accent: string;
  promptSuffix: string;
  category: 'artistic' | 'modern' | 'cinematic' | 'illustration';
}

const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'oil-painting',
    name: 'Oil Painting',
    emoji: '🎨',
    description: 'Rich impasto texture with visible brushstrokes',
    accent: '#8B4513',
    promptSuffix: ', oil painting style, visible brushstrokes, rich impasto texture, classical painting technique, gallery lighting',
    category: 'artistic',
  },
  {
    id: 'watercolor',
    name: 'Watercolor',
    emoji: '🖌️',
    description: 'Soft washes with gentle color bleeding',
    accent: '#87CEEB',
    promptSuffix: ', watercolor painting style, soft translucent washes, color bleeding, wet-on-wet technique, delicate paper texture',
    category: 'artistic',
  },
  {
    id: 'pencil-sketch',
    name: 'Pencil Sketch',
    emoji: '✏️',
    description: 'Detailed graphite lines and shading',
    accent: '#808080',
    promptSuffix: ', pencil sketch style, detailed graphite drawing, fine crosshatching, subtle shading, rough paper texture',
    category: 'artistic',
  },
  {
    id: 'impressionist',
    name: 'Impressionist',
    emoji: '🖼️',
    description: 'Light-focused, loose brushwork like Monet',
    accent: '#DAA520',
    promptSuffix: ', impressionist style, loose brushwork, dappled light, vibrant color patches, plein air atmosphere, like Claude Monet',
    category: 'artistic',
  },
  {
    id: 'anime',
    name: 'Anime',
    emoji: '🌸',
    description: 'Cel shading with clean line art',
    accent: '#FF69B4',
    promptSuffix: ', anime style, cel shading, vibrant colors, clean line art, Japanese animation aesthetic, detailed eyes',
    category: 'illustration',
  },
  {
    id: 'pop-art',
    name: 'Pop Art',
    emoji: '🎭',
    description: 'Bold colors, Ben-Day dots, Warhol-esque',
    accent: '#FF4500',
    promptSuffix: ', pop art style, bold primary colors, Ben-Day dots, high contrast, Andy Warhol inspired, comic book aesthetic',
    category: 'modern',
  },
  {
    id: 'photorealistic',
    name: 'Photorealistic',
    emoji: '📷',
    description: 'Ultra-realistic, indistinguishable from photo',
    accent: '#2F4F4F',
    promptSuffix: ', photorealistic style, ultra-detailed, natural lighting, DSLR quality, shallow depth of field, 8K resolution',
    category: 'cinematic',
  },
  {
    id: 'classical-art',
    name: 'Classical Art',
    emoji: '🏛️',
    description: 'Renaissance masters, chiaroscuro lighting',
    accent: '#8B6914',
    promptSuffix: ', classical art style, Renaissance master technique, chiaroscuro lighting, sfumato blending, museum quality, like Leonardo da Vinci',
    category: 'artistic',
  },
  {
    id: 'art-nouveau',
    name: 'Art Nouveau',
    emoji: '🌊',
    description: 'Organic curves and flowing natural forms',
    accent: '#20B2AA',
    promptSuffix: ', art nouveau style, organic flowing curves, decorative floral motifs, Alphonse Mucha inspired, ornate borders',
    category: 'artistic',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    emoji: '⚡',
    description: 'Neon-lit dystopian future aesthetic',
    accent: '#00FFFF',
    promptSuffix: ', cyberpunk style, neon lighting, rain-slicked streets, holographic displays, dystopian future, Blade Runner aesthetic',
    category: 'modern',
  },
  {
    id: 'surrealist',
    name: 'Surrealist',
    emoji: '🔮',
    description: 'Dreamlike, impossible, Dalí-inspired',
    accent: '#9370DB',
    promptSuffix: ', surrealist style, dreamlike imagery, impossible geometry, Salvador Dalí inspired, melting forms, subconscious imagery',
    category: 'artistic',
  },
  {
    id: 'ghibli',
    name: 'Ghibli',
    emoji: '🧸',
    description: 'Studio Ghibli warmth and whimsy',
    accent: '#7CCD7C',
    promptSuffix: ', Studio Ghibli style, soft watercolor backgrounds, whimsical atmosphere, Hayao Miyazaki inspired, lush nature, warm lighting',
    category: 'illustration',
  },
  {
    id: 'comic-book',
    name: 'Comic Book',
    emoji: '📰',
    description: 'Bold outlines, halftone, action-packed',
    accent: '#FFD700',
    promptSuffix: ', comic book style, bold black outlines, halftone dots, dynamic action poses, speech bubbles, vivid colors',
    category: 'illustration',
  },
  {
    id: 'steampunk',
    name: 'Steampunk',
    emoji: '🎪',
    description: 'Victorian-era brass and steam machinery',
    accent: '#B8860B',
    promptSuffix: ', steampunk style, Victorian-era machinery, brass gears, copper pipes, steam-powered devices, industrial aesthetic',
    category: 'modern',
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    emoji: '❄️',
    description: 'Clean lines, negative space, simplicity',
    accent: '#E8E8E8',
    promptSuffix: ', minimalist style, clean lines, generous negative space, simple geometry, limited color palette, modern design',
    category: 'modern',
  },
  {
    id: 'vaporwave',
    name: 'Vaporwave',
    emoji: '🔥',
    description: 'Retro-futuristic, pastel grids, nostalgia',
    accent: '#FF71CE',
    promptSuffix: ', vaporwave style, retro-futuristic aesthetic, pastel pink and cyan gradients, Greek statues, pixel grids, 80s nostalgia',
    category: 'modern',
  },
  {
    id: 'baroque',
    name: 'Baroque',
    emoji: '🎪',
    description: 'Ornate, dramatic, grand composition',
    accent: '#800020',
    promptSuffix: ', baroque style, ornate dramatic composition, deep chiaroscuro, rich gold details, grand theatrical lighting, Caravaggio inspired',
    category: 'artistic',
  },
  {
    id: 'art-deco',
    name: 'Art Deco',
    emoji: '🌿',
    description: 'Geometric elegance, 1920s glamour',
    accent: '#C9A96E',
    promptSuffix: ', art deco style, geometric patterns, gold accents, 1920s glamour, symmetrical design, The Great Gatsby aesthetic',
    category: 'artistic',
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    emoji: '🎬',
    description: 'Film-like grading, dramatic composition',
    accent: '#1E90FF',
    promptSuffix: ', cinematic style, dramatic film grading, anamorphic lens flare, shallow depth of field, movie still composition, widescreen',
    category: 'cinematic',
  },
  {
    id: 'pixel-art',
    name: 'Pixel Art',
    emoji: '🪄',
    description: 'Retro pixel-perfect, 16-bit nostalgia',
    accent: '#32CD32',
    promptSuffix: ', pixel art style, retro 16-bit graphics, limited color palette, crisp pixels, video game aesthetic, nostalgic sprites',
    category: 'illustration',
  },
  {
    id: 'ink-wash',
    name: 'Ink Wash',
    emoji: '🖤',
    description: 'East Asian brush painting, sumi-e',
    accent: '#36454F',
    promptSuffix: ', ink wash painting style, sumi-e technique, East Asian brushwork, subtle gradients, rice paper texture, zen simplicity',
    category: 'artistic',
  },
  {
    id: 'low-poly',
    name: 'Low Poly',
    emoji: '💎',
    description: 'Geometric facets, 3D mesh aesthetic',
    accent: '#FF6347',
    promptSuffix: ', low poly style, geometric facets, 3D mesh aesthetic, triangular faces, flat shading, minimalist 3D render',
    category: 'modern',
  },
  {
    id: 'stained-glass',
    name: 'Stained Glass',
    emoji: '🌈',
    description: 'Vitreous colors, lead outlines, Gothic',
    accent: '#4169E1',
    promptSuffix: ', stained glass style, vitreous translucent colors, black lead outlines, Gothic cathedral windows, luminous light filtering',
    category: 'artistic',
  },
  {
    id: 'ukiyo-e',
    name: 'Ukiyo-e',
    emoji: '🏯',
    description: 'Japanese woodblock print tradition',
    accent: '#DC143C',
    promptSuffix: ', ukiyo-e style, Japanese woodblock print, flat bold colors, Hokusai inspired, wave motifs, traditional composition',
    category: 'artistic',
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All', icon: '✨' },
  { id: 'artistic', label: 'Artistic', icon: '🎨' },
  { id: 'modern', label: 'Modern', icon: '⚡' },
  { id: 'cinematic', label: 'Cinematic', icon: '🎬' },
  { id: 'illustration', label: 'Illustration', icon: '🖌️' },
] as const;

// ---------------------------------------------------------------------------
// Style Transfer Panel Component
// ---------------------------------------------------------------------------

export function StyleTransferPanel() {
  const { styleTransferOpen, setStyleTransferOpen, imagePrompt, setImagePrompt, triggerGenerate } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedStyle, setSelectedStyle] = useState<StylePreset | null>(null);

  const filteredStyles = useMemo(() => {
    let styles = STYLE_PRESETS;
    if (activeCategory !== 'all') {
      styles = styles.filter((s) => s.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      styles = styles.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.emoji.includes(q)
      );
    }
    return styles;
  }, [searchQuery, activeCategory]);

  const handleApplyStyle = React.useCallback(
    (style: StylePreset) => {
      // Remove any previous style suffix from the prompt
      const prevStyle = STYLE_PRESETS.find((s) => imagePrompt.includes(s.promptSuffix));
      let cleanPrompt = imagePrompt;
      if (prevStyle) {
        cleanPrompt = imagePrompt.replace(prevStyle.promptSuffix, '');
      }
      const newPrompt = cleanPrompt.trim() + style.promptSuffix;
      setImagePrompt(newPrompt);
      setStyleTransferOpen(false);
      setSelectedStyle(null);
      toast.success(`Style Applied: ${style.emoji} ${style.name}`, {
        description: 'Prompt updated — click Generate to create with this style',
      });
    },
    [imagePrompt, setImagePrompt, setStyleTransferOpen]
  );

  const handleApplyAndGenerate = React.useCallback(
    (style: StylePreset) => {
      // Remove any previous style suffix from the prompt
      const prevStyle = STYLE_PRESETS.find((s) => imagePrompt.includes(s.promptSuffix));
      let cleanPrompt = imagePrompt;
      if (prevStyle) {
        cleanPrompt = imagePrompt.replace(prevStyle.promptSuffix, '');
      }
      const newPrompt = cleanPrompt.trim() + style.promptSuffix;
      setImagePrompt(newPrompt);
      setStyleTransferOpen(false);
      setSelectedStyle(null);
      toast.success(`Style Applied: ${style.emoji} ${style.name}`, {
        description: 'Generating with new style…',
      });
      // Trigger generation after a short delay to allow state to update
      setTimeout(() => triggerGenerate(), 100);
    },
    [imagePrompt, setImagePrompt, setStyleTransferOpen, triggerGenerate]
  );

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      setStyleTransferOpen(open);
      if (!open) {
        setSelectedStyle(null);
        setSearchQuery('');
        setActiveCategory('all');
      }
    },
    [setStyleTransferOpen]
  );

  return (
    <Dialog open={styleTransferOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] bg-[#0a0a0f]/95 border-border/40 backdrop-blur-xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#d9ff00]/10 border border-[#d9ff00]/20">
              <Palette className="h-4.5 w-4.5 text-[#d9ff00]" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-foreground">
                Style Transfer
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                One-click style application — pick a style and apply it to your prompt
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Search + Category Filter */}
        <div className="px-5 py-3 space-y-3 border-b border-border/20">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search styles…"
              className="pl-9 h-9 bg-surface/50 border-border/40 text-sm placeholder:text-muted-foreground/50 focus:border-[#d9ff00]/40"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Category pills */}
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  activeCategory === cat.id
                    ? 'bg-[#d9ff00]/15 text-[#d9ff00] border border-[#d9ff00]/30'
                    : 'bg-surface/50 text-muted-foreground border border-border/30 hover:border-border/60 hover:text-foreground'
                }`}
              >
                <span>{cat.icon}</span>
                {cat.label}
                {cat.id !== 'all' && (
                  <span className="text-[10px] opacity-60">
                    ({STYLE_PRESETS.filter((s) => s.category === cat.id).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Style Grid */}
        <div className="p-5 overflow-y-auto max-h-[calc(90vh-220px)] scrollbar-thin">
          {filteredStyles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="h-8 w-8 mb-3 opacity-40" />
              <p className="text-sm">No styles match your search</p>
              <p className="text-xs mt-1 opacity-60">Try a different keyword or category</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              <AnimatePresence mode="popLayout">
                {filteredStyles.map((style) => {
                  const isSelected = selectedStyle?.id === style.id;
                  return (
                    <motion.div
                      key={style.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.03, y: -2 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => setSelectedStyle(isSelected ? null : style)}
                            className={`w-full text-left rounded-xl border p-3 transition-all ${
                              isSelected
                                ? 'bg-[#d9ff00]/10 border-[#d9ff00]/40 shadow-[0_0_20px_rgba(217,255,0,0.15)]'
                                : 'bg-surface/40 border-border/30 hover:border-border/60 hover:bg-surface/70'
                            }`}
                          >
                            {/* Color accent strip */}
                            <div
                              className="h-1 w-8 rounded-full mb-2.5"
                              style={{ backgroundColor: style.accent }}
                            />
                            {/* Emoji + Name */}
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-lg">{style.emoji}</span>
                              <span className={`text-sm font-semibold truncate ${isSelected ? 'text-[#d9ff00]' : 'text-foreground'}`}>
                                {style.name}
                              </span>
                            </div>
                            {/* Description */}
                            <p className="text-[11px] text-muted-foreground leading-tight line-clamp-2">
                              {style.description}
                            </p>
                            {/* Category badge */}
                            <Badge
                              variant="secondary"
                              className="mt-2 text-[9px] px-1.5 py-0 bg-surface/60 text-muted-foreground border-0"
                            >
                              {style.category}
                            </Badge>
                          </motion.button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs text-xs">
                          <span className="font-medium">{style.name}:</span>{' '}
                          {style.promptSuffix.slice(2)}
                        </TooltipContent>
                      </Tooltip>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Preview + Apply Footer */}
        <AnimatePresence>
          {selectedStyle && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-[#d9ff00]/20 bg-[#d9ff00]/5"
            >
              <div className="p-4 space-y-3">
                {/* Selected style preview */}
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{selectedStyle.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#d9ff00]">{selectedStyle.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 break-all">
                      <span className="text-foreground/50">Your prompt +</span>
                      <span className="text-[#d9ff00]/80">{selectedStyle.promptSuffix}</span>
                    </p>
                  </div>
                </div>
                {/* Apply buttons */}
                <div className="flex gap-2">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleApplyStyle(selectedStyle)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-[#d9ff00]/30 bg-surface/50 px-4 py-2.5 text-sm font-medium text-[#d9ff00] transition-all hover:bg-[#d9ff00]/10"
                  >
                    <Palette className="h-4 w-4" />
                    Apply Style
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleApplyAndGenerate(selectedStyle)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#d9ff00] px-4 py-2.5 text-sm font-semibold text-black transition-all hover:bg-[#d9ff00]/90"
                  >
                    <Sparkles className="h-4 w-4" />
                    Apply & Generate
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
