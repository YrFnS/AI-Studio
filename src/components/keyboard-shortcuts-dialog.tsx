'use client';

import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useAppStore } from '@/lib/store';
import { Keyboard } from 'lucide-react';
import { motion } from 'framer-motion';

// ---------------------------------------------------------------------------
// Shortcut definitions grouped by category
// ---------------------------------------------------------------------------

const SHORTCUT_CATEGORIES = [
  {
    name: 'Global',
    icon: '🌐',
    color: '#d9ff00',
    items: [
      { keys: ['Ctrl', 'Enter'], description: 'Generate image or video' },
      { keys: ['Ctrl', 'K'], description: 'Search Gallery' },
      { keys: ['?'], description: 'Show this shortcuts dialog' },
    ],
  },
  {
    name: 'Image Studio',
    icon: '🎨',
    color: '#c084fc',
    items: [
      { keys: ['Ctrl', 'S'], description: 'Save / Download result' },
      { keys: ['Ctrl', 'R'], description: 'Regenerate last prompt' },
      { keys: ['Ctrl', 'E'], description: 'AI Enhance prompt' },
    ],
  },
  {
    name: 'Video Studio',
    icon: '🎬',
    color: '#00d4ff',
    items: [
      { keys: ['Ctrl', 'Enter'], description: 'Generate video' },
      { keys: ['Ctrl', 'S'], description: 'Save / Download result' },
    ],
  },
  {
    name: 'Gallery',
    icon: '🖼️',
    color: '#34d399',
    items: [
      { keys: ['Esc'], description: 'Close lightbox' },
      { keys: ['←'], description: 'Navigate lightbox left' },
      { keys: ['→'], description: 'Navigate lightbox right' },
      { keys: ['Del'], description: 'Delete selected item' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Keyboard Key Badge (styled like physical key)
// ---------------------------------------------------------------------------

function KeyBadge({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="
        inline-flex items-center justify-center min-w-[28px] h-7 px-2
        rounded-md text-[11px] font-semibold leading-none
        bg-white/[0.06] border border-white/[0.12]
        text-foreground/80
        shadow-[0_2px_0_0_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)_inset]
        select-none
      "
    >
      {children}
    </kbd>
  );
}

// ---------------------------------------------------------------------------
// Dialog Component
// ---------------------------------------------------------------------------

export function KeyboardShortcutsDialog() {
  const { keyboardShortcutsOpen, setKeyboardShortcutsOpen } = useAppStore();

  // Listen for "?" key press (when not in an input/textarea)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (e.key === '?' && !isInput) {
        e.preventDefault();
        setKeyboardShortcutsOpen(!keyboardShortcutsOpen);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyboardShortcutsOpen, setKeyboardShortcutsOpen]);

  return (
    <Dialog open={keyboardShortcutsOpen} onOpenChange={setKeyboardShortcutsOpen}>
      <DialogContent className="glass-dialog max-w-lg border-border/40 bg-[#0a0a0a]/95 backdrop-blur-xl">
        <DialogTitle className="flex items-center gap-2.5 text-foreground">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#d9ff00]/10 border border-[#d9ff00]/20">
            <Keyboard className="h-4.5 w-4.5 text-[#d9ff00]" />
          </div>
          <div>
            <span className="text-base font-semibold">Keyboard Shortcuts</span>
            <p className="text-[11px] text-muted-foreground/60 font-normal mt-0.5">
              Quick actions to speed up your workflow
            </p>
          </div>
        </DialogTitle>
        <DialogDescription className="sr-only">
          View all available keyboard shortcuts for AI Studio
        </DialogDescription>

        <div className="mt-3 max-h-[60vh] overflow-y-auto space-y-5 pr-1 custom-scrollbar">
          {SHORTCUT_CATEGORIES.map((group, catIdx) => (
            <motion.div
              key={group.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: catIdx * 0.06, duration: 0.25 }}
            >
              {/* Category Header */}
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-sm">{group.icon}</span>
                <h3
                  className="text-[10px] font-bold uppercase tracking-[0.15em]"
                  style={{ color: group.color }}
                >
                  {group.name}
                </h3>
                <div
                  className="flex-1 h-px opacity-20"
                  style={{ backgroundColor: group.color }}
                />
                <span className="text-[9px] text-muted-foreground/40">
                  {group.items.length}
                </span>
              </div>

              {/* Shortcut Rows */}
              <div className="space-y-1 rounded-xl bg-white/[0.02] border border-white/[0.04] p-2">
                {group.items.map((item, itemIdx) => (
                  <div
                    key={itemIdx}
                    className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-white/[0.04] transition-colors group"
                  >
                    <span className="text-xs text-foreground/70 group-hover:text-foreground/90 transition-colors">
                      {item.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((key, ki) => (
                        <span key={ki} className="flex items-center gap-1">
                          {ki > 0 && (
                            <span className="text-[9px] text-muted-foreground/30 mx-0.5">+</span>
                          )}
                          <KeyBadge>{key}</KeyBadge>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="mt-4 flex items-center justify-center gap-2 border-t border-border/20 pt-3">
          <span className="text-[10px] text-muted-foreground/40">
            Press
          </span>
          <KeyBadge>?</KeyBadge>
          <span className="text-[10px] text-muted-foreground/40">
            anytime to open this dialog
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
