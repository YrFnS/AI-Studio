'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Paintbrush,
  Lightbulb,
  Drama,
  LayoutGrid,
  Palette,
  SearchIcon,
  Camera,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Category Data
// ---------------------------------------------------------------------------

interface PromptCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  chips: string[];
}

const PROMPT_CATEGORIES: PromptCategory[] = [
  {
    id: 'subject',
    label: 'Subject',
    icon: <User className="h-3.5 w-3.5" />,
    color: '#d9ff00',
    chips: ['Person', 'Animal', 'Landscape', 'Architecture', 'Food', 'Vehicle', 'Object', 'Fantasy Creature'],
  },
  {
    id: 'style',
    label: 'Style',
    icon: <Paintbrush className="h-3.5 w-3.5" />,
    color: '#f472b6',
    chips: ['Photorealistic', 'Anime', 'Oil Painting', 'Watercolor', 'Digital Art', '3D Render', 'Pixel Art', 'Sketch'],
  },
  {
    id: 'lighting',
    label: 'Lighting',
    icon: <Lightbulb className="h-3.5 w-3.5" />,
    color: '#fbbf24',
    chips: ['Golden Hour', 'Blue Hour', 'Studio Lighting', 'Neon Lights', 'Dramatic', 'Soft Diffused', 'Backlit', 'Candlelight'],
  },
  {
    id: 'mood',
    label: 'Mood',
    icon: <Drama className="h-3.5 w-3.5" />,
    color: '#a78bfa',
    chips: ['Serene', 'Dramatic', 'Mysterious', 'Joyful', 'Melancholic', 'Epic', 'Dreamy', 'Horrifying'],
  },
  {
    id: 'composition',
    label: 'Composition',
    icon: <LayoutGrid className="h-3.5 w-3.5" />,
    color: '#34d399',
    chips: ['Close-up', 'Wide Angle', "Bird's Eye", 'Low Angle', 'Symmetrical', 'Rule of Thirds', 'Centered', 'Dynamic'],
  },
  {
    id: 'color',
    label: 'Color',
    icon: <Palette className="h-3.5 w-3.5" />,
    color: '#fb923c',
    chips: ['Warm Tones', 'Cool Tones', 'Monochrome', 'Pastel', 'Vibrant', 'Muted', 'Earthy', 'Neon'],
  },
  {
    id: 'detail',
    label: 'Detail',
    icon: <SearchIcon className="h-3.5 w-3.5" />,
    color: '#60a5fa',
    chips: ['Ultra Detailed', 'Minimalist', 'Abstract', 'Impressionistic', 'Hyper-realistic', 'Stylized'],
  },
  {
    id: 'camera',
    label: 'Camera',
    icon: <Camera className="h-3.5 w-3.5" />,
    color: '#e879f9',
    chips: ['35mm', '50mm', '85mm', 'Wide Angle', 'Telephoto', 'Macro', 'Drone Shot', 'Film Grain'],
  },
];

// ---------------------------------------------------------------------------
// PromptBuilder Component
// ---------------------------------------------------------------------------

interface PromptBuilderProps {
  /** Current prompt text (controlled) */
  currentPrompt: string;
  /** Called when user clicks Apply with the composed prompt */
  onApply: (prompt: string) => void;
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to control open state */
  onOpenChange: (open: boolean) => void;
}

export function PromptBuilder({ currentPrompt, onApply, open, onOpenChange }: PromptBuilderProps) {
  const [selectedChips, setSelectedChips] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Build the composed prompt from selected chips
  const composedPrompt = useMemo(() => {
    const chips: string[] = [];
    for (const category of PROMPT_CATEGORIES) {
      for (const chip of category.chips) {
        if (selectedChips.has(`${category.id}:${chip}`)) {
          chips.push(chip.toLowerCase());
        }
      }
    }
    const chipText = chips.join(', ');
    // Combine with existing prompt text
    if (currentPrompt.trim() && chipText) {
      return `${currentPrompt.trim()}, ${chipText}`;
    }
    return currentPrompt.trim() || chipText;
  }, [selectedChips, currentPrompt]);

  // Toggle a chip
  const toggleChip = useCallback((category: PromptCategory, chip: string) => {
    const key = `${category.id}:${chip}`;
    setSelectedChips((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Clear all selections
  const clearAll = useCallback(() => {
    setSelectedChips(new Set());
  }, []);

  // Apply the composed prompt
  const handleApply = useCallback(() => {
    if (composedPrompt.trim()) {
      onApply(composedPrompt.trim());
      onOpenChange(false);
    }
  }, [composedPrompt, onApply, onOpenChange]);

  // Toggle category collapse
  const toggleCollapse = useCallback((categoryId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  // Filter categories and chips based on search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return PROMPT_CATEGORIES;
    const q = searchQuery.toLowerCase();
    return PROMPT_CATEGORIES
      .map((cat) => ({
        ...cat,
        chips: cat.chips.filter((chip) => chip.toLowerCase().includes(q)),
      }))
      .filter((cat) => cat.chips.length > 0 || cat.label.toLowerCase().includes(q));
  }, [searchQuery]);

  // Count selected chips
  const selectedCount = selectedChips.size;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="glass-strong w-full max-w-3xl max-h-[85vh] rounded-2xl border border-border/60 shadow-2xl flex flex-col pointer-events-auto overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#d9ff00]/10">
                    <Layers className="h-4.5 w-4.5 text-[#d9ff00]" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Prompt Builder</h2>
                    <p className="text-[11px] text-muted-foreground">Compose your prompt from structured categories</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#d9ff00]/10 px-2 text-[10px] font-semibold text-[#d9ff00]"
                    >
                      {selectedCount}
                    </motion.span>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="px-5 py-3 border-b border-border/30">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search across all categories..."
                    className="w-full rounded-lg bg-surface border border-border/50 pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30 focus:border-[#d9ff00]/30 transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Category Chips */}
              <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
                <div className="space-y-4">
                  {filteredCategories.map((category) => {
                    const isCollapsed = collapsedCategories.has(category.id);
                    const categorySelectedCount = category.chips.filter(
                      (chip) => selectedChips.has(`${category.id}:${chip}`)
                    ).length;

                    return (
                      <div key={category.id} className="rounded-xl border border-border/30 bg-surface/30 overflow-hidden">
                        {/* Category Header */}
                        <button
                          type="button"
                          onClick={() => toggleCollapse(category.id)}
                          className="flex items-center justify-between w-full px-4 py-2.5 text-left hover:bg-surface/50 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className="flex h-6 w-6 items-center justify-center rounded-md"
                              style={{ backgroundColor: `${category.color}15`, color: category.color }}
                            >
                              {category.icon}
                            </span>
                            <span className="text-xs font-semibold text-foreground">{category.label}</span>
                            {categorySelectedCount > 0 && (
                              <span
                                className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold"
                                style={{
                                  backgroundColor: `${category.color}20`,
                                  color: category.color,
                                }}
                              >
                                {categorySelectedCount}
                              </span>
                            )}
                          </div>
                          {isCollapsed ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                          ) : (
                            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/50" />
                          )}
                        </button>

                        {/* Chips */}
                        <AnimatePresence>
                          {!isCollapsed && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                                {category.chips.map((chip) => {
                                  const key = `${category.id}:${chip}`;
                                  const isSelected = selectedChips.has(key);

                                  return (
                                    <motion.button
                                      key={key}
                                      type="button"
                                      whileHover={{ scale: 1.04 }}
                                      whileTap={{ scale: 0.96 }}
                                      onClick={() => toggleChip(category, chip)}
                                      className={`
                                        relative flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all
                                        ${
                                          isSelected
                                            ? 'border-[#d9ff00]/60 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_8px_rgba(217,255,0,0.15)]'
                                            : 'border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60'
                                        }
                                      `}
                                      style={
                                        !isSelected
                                          ? { backgroundColor: `${category.color}08` }
                                          : undefined
                                      }
                                    >
                                      {isSelected && <Check className="h-3 w-3" />}
                                      {chip}
                                    </motion.button>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}

                  {filteredCategories.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-10">
                      <SearchIcon className="h-8 w-8 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">No categories match &quot;{searchQuery}&quot;</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Preview + Actions Footer */}
              <div className="border-t border-border/40 px-5 py-4 space-y-3">
                {/* Prompt Preview */}
                <div className="rounded-xl border border-border/30 bg-surface/60 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="h-3 w-3 text-[#d9ff00]/60" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Prompt Preview
                    </span>
                  </div>
                  <p className="text-xs font-mono text-foreground/80 leading-relaxed break-words min-h-[20px]">
                    {composedPrompt || (
                      <span className="text-muted-foreground/30 italic">Select chips above to build your prompt...</span>
                    )}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={clearAll}
                    disabled={selectedCount === 0}
                    className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-surface px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={!composedPrompt.trim()}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#d9ff00] px-4 py-2.5 text-xs font-semibold text-background hover:bg-[#c5eb00] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Apply to Prompt
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
