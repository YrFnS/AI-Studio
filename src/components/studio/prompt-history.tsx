'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Search, Trash2, ArrowRight, X } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ---------------------------------------------------------------------------
// PromptHistory — dropdown with search, reuse, and clear functionality
// ---------------------------------------------------------------------------

interface PromptHistoryProps {
  /** Called when a prompt from history is selected */
  onSelectPrompt: (prompt: string) => void;
}

const MAX_DISPLAY_LENGTH = 80;

export function PromptHistory({ onSelectPrompt }: PromptHistoryProps) {
  const promptHistory = useAppStore((s) => s.promptHistory);
  const clearPromptHistory = useAppStore((s) => s.clearPromptHistory);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return promptHistory;
    const q = searchQuery.toLowerCase();
    return promptHistory.filter((p) => p.toLowerCase().includes(q));
  }, [promptHistory, searchQuery]);

  const handleSelect = (prompt: string) => {
    onSelectPrompt(prompt);
    setOpen(false);
    setSearchQuery('');
  };

  const handleClear = () => {
    clearPromptHistory();
    setSearchQuery('');
  };

  const truncate = (text: string) => {
    if (text.length <= MAX_DISPLAY_LENGTH) return text;
    return text.slice(0, MAX_DISPLAY_LENGTH) + '...';
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearchQuery(''); }}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1 rounded-md border border-border/40 bg-surface px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-[#d9ff00] hover:border-[#d9ff00]/30 transition-all"
            >
              <Clock className="h-3 w-3" />
              <span className="hidden sm:inline">History</span>
              {promptHistory.length > 0 && (
                <span className="ml-0.5 rounded-full bg-[#d9ff00]/15 px-1.5 py-px text-[8px] font-bold text-[#d9ff00] leading-none">
                  {promptHistory.length}
                </span>
              )}
            </motion.button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          View and reuse past prompts
        </TooltipContent>
      </Tooltip>

      <PopoverContent
        className="w-80 p-0 glass-strong border-border/60 shadow-[0_0_24px_rgba(0,0,0,0.5)]"
        align="end"
        sideOffset={8}
      >
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-[#d9ff00]" />
                  <span className="text-xs font-semibold text-foreground">Prompt History</span>
                  {promptHistory.length > 0 && (
                    <span className="rounded-full bg-[#d9ff00]/15 px-1.5 py-px text-[9px] font-bold text-[#d9ff00]">
                      {promptHistory.length}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-sm p-0.5 text-muted-foreground/50 hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Search */}
              <div className="px-3 py-2 border-b border-border/30">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search history..."
                    className="w-full rounded-md bg-white/5 border border-border/40 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/40 focus:border-[#d9ff00]/30 transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Prompt list */}
              <ScrollArea className="max-h-64">
                {filteredHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 px-4">
                    <Clock className="h-8 w-8 text-muted-foreground/20 mb-2" />
                    <p className="text-xs text-muted-foreground/50 text-center">
                      {promptHistory.length === 0
                        ? 'No prompts in history yet'
                        : 'No matching prompts found'}
                    </p>
                    {promptHistory.length === 0 && (
                      <p className="text-[10px] text-muted-foreground/30 mt-1">
                        Prompts will appear here after generation
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="py-1">
                    {filteredHistory.map((prompt, index) => (
                      <motion.button
                        key={`${prompt.slice(0, 40)}-${index}`}
                        type="button"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.02, duration: 0.12 }}
                        onClick={() => handleSelect(prompt)}
                        className="group flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-[#d9ff00]/5 transition-colors"
                      >
                        <Clock className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/30 group-hover:text-[#d9ff00]/60 transition-colors" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors leading-relaxed line-clamp-2">
                            {truncate(prompt)}
                          </p>
                        </div>
                        <ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/0 group-hover:text-[#d9ff00] transition-all translate-x-0 group-hover:translate-x-0.5" />
                      </motion.button>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Footer with clear button */}
              {promptHistory.length > 0 && (
                <div className="border-t border-border/30 px-3 py-2">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleClear}
                    className="flex items-center gap-1.5 w-full justify-center rounded-md border border-red-500/20 bg-red-500/5 px-2 py-1.5 text-[10px] font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear History
                  </motion.button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </PopoverContent>
    </Popover>
  );
}
