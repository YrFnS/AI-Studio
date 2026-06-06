'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Keyboard Shortcuts Section
// ---------------------------------------------------------------------------

const KEYBOARD_SHORTCUTS = [
  { keys: ['Ctrl', 'Enter'], description: 'Generate image / video', context: 'Image Studio' },
  { keys: ['Ctrl', 'K'], description: 'Search gallery', context: 'Gallery' },
  { keys: ['Ctrl', 'E'], description: 'AI enhance prompt', context: 'Image Studio' },
  { keys: ['Ctrl', 'S'], description: 'Download result', context: 'Result View' },
  { keys: ['Ctrl', 'Z'], description: 'Undo last action', context: 'Global' },
  { keys: ['Esc'], description: 'Close dialog / lightbox', context: 'Global' },
  { keys: ['←', '→'], description: 'Navigate gallery images', context: 'Lightbox' },
  { keys: ['F'], description: 'Toggle favorite', context: 'Gallery' },
  { keys: ['D'], description: 'Download current image', context: 'Lightbox' },
  { keys: ['R'], description: 'Regenerate with same settings', context: 'Result View' },
  { keys: ['?'], description: 'Show keyboard shortcuts', context: 'Global' },
];

export function KeyboardShortcutsSection() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="space-y-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-3 w-full text-left group"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface border border-border/30 group-hover:border-[#d9ff00]/30 transition-colors">
          <Keyboard className="h-4 w-4 text-muted-foreground group-hover:text-[#d9ff00] transition-colors" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">Keyboard Shortcuts</h3>
          <p className="text-xs text-muted-foreground">
            Quick shortcuts for faster workflow
          </p>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Card className="glass-light border-border/30">
              <CardContent className="p-0">
                <div className="divide-y divide-border/20">
                  {KEYBOARD_SHORTCUTS.map((shortcut, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-surface/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-foreground">{shortcut.description}</span>
                        <Badge variant="secondary" className="text-[9px] bg-surface border-border text-muted-foreground">
                          {shortcut.context}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, kIdx) => (
                          <span key={kIdx} className="flex items-center gap-1">
                            <kbd className="inline-flex items-center justify-center h-6 min-w-[28px] px-2 text-[11px] font-mono font-medium text-foreground/80 bg-surface border border-border/50 rounded-md shadow-sm">
                              {key}
                            </kbd>
                            {kIdx < shortcut.keys.length - 1 && (
                              <span className="text-muted-foreground/50 text-xs">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
