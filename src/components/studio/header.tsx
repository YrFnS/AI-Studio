'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ImageIcon, VideoIcon, LayoutGrid, SettingsIcon, Sparkles, Clapperboard, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore, type AppTab } from '@/lib/store';
import { useApiKeys } from '@/hooks/use-api-keys';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const tabs: { id: AppTab; label: string; icon: React.ElementType }[] = [
  { id: 'image', label: 'Image', icon: ImageIcon },
  { id: 'video', label: 'Video', icon: VideoIcon },
  { id: 'cinema', label: 'Cinema', icon: Clapperboard },
  { id: 'gallery', label: 'Gallery', icon: LayoutGrid },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export function StudioHeader() {
  const { activeTab, setActiveTab, providerVersion, setKeyboardShortcutsOpen, generationQueue } = useAppStore();
  const apiKeysHook = useApiKeys();
  const [badgeBounce, setBadgeBounce] = useState(false);
  const [tabBounce, setTabBounce] = useState<string | null>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const bounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabBounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCountRef = useRef(0);

  // Use IndexedDB for configured provider count
  const configuredCount = apiKeysHook.configuredCount;

  // Check if there's a generation in progress
  const activeProcessing = generationQueue.some((item) => item.status === 'processing');

  useEffect(() => {
    if (prevCountRef.current !== 0 && configuredCount !== prevCountRef.current) {
      if (bounceTimerRef.current) clearTimeout(bounceTimerRef.current);
      bounceTimerRef.current = setTimeout(() => {
        setBadgeBounce(true);
        bounceTimerRef.current = setTimeout(() => setBadgeBounce(false), 600);
      }, 0);
    }
    prevCountRef.current = configuredCount;
  }, [configuredCount]);

  useEffect(() => {
    return () => {
      if (bounceTimerRef.current) clearTimeout(bounceTimerRef.current);
      if (tabBounceTimerRef.current) clearTimeout(tabBounceTimerRef.current);
    };
  }, []);

  // Handle tab click with micro-bounce animation
  const handleTabClick = useCallback((tabId: AppTab) => {
    setActiveTab(tabId);
    setTabBounce(tabId);
    if (tabBounceTimerRef.current) clearTimeout(tabBounceTimerRef.current);
    tabBounceTimerRef.current = setTimeout(() => setTabBounce(null), 350);
  }, [setActiveTab]);

  return (
    <header className="glass sticky top-0 z-50">
      <div className="relative flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Gradient border-bottom with animated shimmer */}
        <div
          className="absolute inset-x-0 bottom-0 h-px header-gradient-border-animated"
        />

        {/* Left: Logo with subtle dot particles */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div ref={logoRef} className="relative floating-particles">
            {/* Pulsing glow behind logo */}
            <div className="absolute inset-0 rounded-lg bg-[#d9ff00] animate-logo-glow" />

            {/* Dot particles behind the logo */}
            <div className="particle-layer">
              <span className="particle" style={{ width: 2, height: 2, top: '10%', left: '-30%' }} />
              <span className="particle" style={{ width: 1.5, height: 1.5, bottom: '5%', right: '-25%' }} />
              <span className="particle" style={{ width: 2.5, height: 2.5, top: '-15%', right: '20%', background: 'rgba(0, 212, 255, 0.25)' }} />
            </div>

            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-[#d9ff00]">
              <Sparkles className="h-4 w-4 text-background" />
            </div>
          </div>
          <span className="text-lg font-bold tracking-tight">
            <span className="gradient-text-animate">AI</span>{' '}
            <span className="text-foreground">Studio</span>
            {/* Processing pulse indicator */}
            {activeProcessing && (
              <span className="ml-1.5 inline-flex items-center">
                <span className="h-1.5 w-1.5 rounded-full bg-[#d9ff00] animate-processing-dot" />
              </span>
            )}
          </span>
        </div>

        {/* Center: Tab Navigation with glow trail */}
        <nav className="relative flex items-center gap-1 rounded-xl bg-white/[0.03] p-1" aria-label="Main navigation">
          {/* Pill-shaped sliding indicator with glowing trail */}
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            const isCinema = tab.id === 'cinema';
            const activeColor = isCinema ? '#F59E0B' : '#d9ff00';

            return (
              <motion.div
                key={tab.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                animate={tabBounce === tab.id ? { scale: [0.95, 1.02, 0.99, 1] } : {}}
                transition={tabBounce === tab.id ? { duration: 0.3 } : {}}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleTabClick(tab.id)}
                  className={`
                    relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all
                    ${
                      isActive
                        ? `text-[${activeColor}] hover:text-[${activeColor}]`
                        : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground'
                    }
                  `}
                  style={isActive ? { color: activeColor } : undefined}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-tab-pill"
                      className="absolute inset-0 rounded-lg tab-indicator-glow"
                      style={{ backgroundColor: `${activeColor}15` }}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  {/* Active tab underline animation */}
                  {isActive && (
                    <motion.div
                      layoutId="active-tab-underline"
                      className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full tab-underline-animate"
                      style={{ backgroundColor: activeColor }}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  {/* Hover glow on inactive tabs */}
                  {!isActive && (
                    <div className="absolute inset-0 rounded-lg bg-[#d9ff00]/0 hover:bg-[#d9ff00]/5 transition-all duration-300 hover:shadow-[0_0_12px_rgba(217,255,0,0.1)]" />
                  )}
                  <Icon className="relative h-5 w-5" />
                  <span className="relative hidden sm:inline">{tab.label}</span>
                  {/* Notification dot when generation is in progress */}
                  {activeProcessing && isActive && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#d9ff00] opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#d9ff00] notification-pulse" />
                    </span>
                  )}
                </Button>
              </motion.div>
            );
          })}
        </nav>

        {/* Right: Keyboard shortcuts button + Provider indicator */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Keyboard Shortcuts Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setKeyboardShortcutsOpen(true)}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-[#d9ff00] hover:bg-[#d9ff00]/5 transition-all"
              >
                <Keyboard className="h-4 w-4" />
                <span className="sr-only">Keyboard Shortcuts</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Shortcuts (?)
            </TooltipContent>
          </Tooltip>
          <motion.div
            animate={badgeBounce ? { scale: [1, 1.15, 0.95, 1.05, 1] } : {}}
            transition={{ duration: 0.5 }}
          >
            <Badge
              variant="secondary"
              className="relative gap-1.5 border-border bg-surface text-muted-foreground hover:bg-surface-hover overflow-visible"
            >
              <span className="relative flex h-2.5 w-2.5">
                {configuredCount > 0 ? (
                  <>
                    {/* Ring pulse effect */}
                    <span className="absolute inset-0 rounded-full bg-[#d9ff00] animate-ring-pulse" />
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#d9ff00] opacity-30" />
                  </>
                ) : null}
                <span
                  className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                    configuredCount > 0 ? 'bg-[#d9ff00]' : 'bg-muted-foreground/50'
                  }`}
                />
              </span>
              <span className="text-xs">
                {configuredCount} {configuredCount === 1 ? 'provider' : 'providers'}
              </span>
            </Badge>
          </motion.div>
        </div>
      </div>

      {/* Animated gradient accent line — smoother with proper background-size */}
      <div
        className="h-[2px] header-gradient-smooth"
        style={{
          backgroundImage: 'linear-gradient(90deg, #d9ff00, #00d4ff, #c084fc, #ff6b9d, #d9ff00)',
        }}
      />
    </header>
  );
}
