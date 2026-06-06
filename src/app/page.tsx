'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { StudioHeader } from '@/components/studio/header';
import { ImageStudio } from '@/components/studio/image-studio';
import { VideoStudio } from '@/components/studio/video-studio';
import { CinemaStudio } from '@/components/studio/cinema-studio';
import { Gallery } from '@/components/studio/gallery';
import { Settings } from '@/components/studio/settings';
import { ErrorBoundary } from '@/components/error-boundary';
import { GenerationQueue } from '@/components/studio/generation-queue';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function Home() {
  const { activeTab, triggerGenerate, keyboardShortcutsOpen, setKeyboardShortcutsOpen } = useAppStore();

  // Typing effect for footer "AI Studio" text
  const [displayedText, setDisplayedText] = useState('');
  const fullText = 'AI Studio';
  const [typingDone, setTypingDone] = useState(false);

  useEffect(() => {
    let i = 0;
    setDisplayedText('');
    setTypingDone(false);
    const interval = setInterval(() => {
      if (i < fullText.length) {
        setDisplayedText(fullText.slice(0, i + 1));
        i++;
      } else {
        setTypingDone(true);
        clearInterval(interval);
      }
    }, 120);
    return () => clearInterval(interval);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+Enter or Cmd+Enter → Generate
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        triggerGenerate();
      }
      // Ctrl+K or Cmd+K → Focus gallery search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = (window as unknown as Record<string, HTMLInputElement>).__gallerySearchInput;
        if (searchInput) {
          searchInput.focus();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerGenerate]);

  // No database seeding needed — all data is static or client-side IndexedDB

  return (
    <ErrorBoundary>
    <div className="h-dvh flex flex-col bg-background dot-pattern relative overflow-hidden">
      {/* Ambient background orbs */}
      <div className="ambient-mesh-orb" style={{ width: 400, height: 400, top: '10%', left: '5%', background: 'rgba(217, 255, 0, 0.03)', animationDelay: '0s' }} />
      <div className="ambient-mesh-orb" style={{ width: 350, height: 350, bottom: '15%', right: '10%', background: 'rgba(0, 212, 255, 0.025)', animationDelay: '-7s' }} />
      <div className="ambient-mesh-orb" style={{ width: 300, height: 300, top: '50%', left: '50%', background: 'rgba(192, 132, 252, 0.02)', animationDelay: '-13s' }} />

      <StudioHeader />
      
      <main className="flex-1 flex flex-col min-h-0">
        <AnimatePresence mode="wait">
          {activeTab === 'image' && (
            <motion.div
              key="image"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="flex-1 min-h-0"
            >
              <ImageStudio />
            </motion.div>
          )}
          {activeTab === 'video' && (
            <motion.div
              key="video"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="flex-1 min-h-0"
            >
              <VideoStudio />
            </motion.div>
          )}
          {activeTab === 'cinema' && (
            <motion.div
              key="cinema"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="flex-1 min-h-0"
            >
              <CinemaStudio />
            </motion.div>
          )}
          {activeTab === 'gallery' && (
            <motion.div
              key="gallery"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="flex-1 min-h-0"
            >
              <Gallery />
            </motion.div>
          )}
          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="flex-1 min-h-0"
            >
              <Settings />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer with animated gradient */}
      <footer className="glass shrink-0 relative py-3.5 px-6 z-40">
        {/* Animated gradient top border */}
        <div className="absolute inset-x-0 top-0 h-px footer-gradient-line" />

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className={`text-[#d9ff00]/70 font-medium ${!typingDone ? 'footer-typing-cursor' : ''}`}>
              {displayedText}
            </span>
            <span className="opacity-40">•</span>
            <span className="opacity-50">Multi-Provider Generation</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="opacity-50 animate-breathe-opacity">
              <span className="text-[#d9ff00]/60 font-medium">16</span> Providers
              <span className="mx-1.5 opacity-40">•</span>
              <span className="text-[#d9ff00]/60 font-medium">100+</span> Models
            </span>
            <span className="inline-flex items-center rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/70 animate-version-shift">
              v1.0
            </span>
          </div>
        </div>
      </footer>

      {/* Generation Queue — floating overlay */}
      <GenerationQueue />

      {/* Keyboard Shortcuts Dialog */}
      <Dialog open={keyboardShortcutsOpen} onOpenChange={setKeyboardShortcutsOpen}>
        <DialogContent className="glass-strong sm:max-w-lg">
          <DialogTitle className="text-lg font-bold text-foreground">Keyboard Shortcuts</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Quick actions to speed up your workflow
          </DialogDescription>
          <div className="mt-4 space-y-2">
            {[
              { keys: ['Ctrl', 'Enter'], action: 'Generate', context: 'Image / Video / Cinema' },
              { keys: ['Ctrl', 'K'], action: 'Search prompts', context: 'Image Studio' },
              { keys: ['Ctrl', 'E'], action: 'AI Enhance prompt', context: 'Image Studio' },
              { keys: ['Ctrl', 'Shift', 'V'], action: 'Paste reference image URL', context: 'Image Studio' },
              { keys: ['Esc'], action: 'Close dialog / lightbox', context: 'Gallery' },
              { keys: ['←', '→'], action: 'Navigate lightbox', context: 'Gallery' },
              { keys: ['F'], action: 'Toggle favorite', context: 'Gallery lightbox' },
              { keys: ['Delete'], action: 'Delete selected', context: 'Gallery select mode' },
              { keys: ['1-5'], action: 'Switch tab', context: 'Global' },
              { keys: ['?'], action: 'Show shortcuts', context: 'Global' },
              { keys: ['Ctrl', 'Z'], action: 'Undo last prompt', context: 'Image Studio' },
            ].map((shortcut, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                <span className="text-sm text-foreground">{shortcut.action}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground mr-2">{shortcut.context}</span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, j) => (
                      <kbd key={j} className="inline-flex items-center rounded border border-border/60 bg-surface px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </ErrorBoundary>
  );
}
