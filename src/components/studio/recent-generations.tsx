'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ImageIcon,
  VideoIcon,
  Grid3X3,
  Play,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { Generation } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import * as data from '@/lib/data';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecentGenerationsProps {
  /** Optional studio accent color for the active ring (default: #d9ff00) */
  accentColor?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getResultUrl(gen: Generation): string {
  return gen.thumbnailUrl || gen.resultData || gen.resultUrl || '';
}

function isVideo(gen: Generation): boolean {
  return gen.type === 'video';
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

// ---------------------------------------------------------------------------
// RecentGenerations — horizontal scrollable strip with click-to-load
// ---------------------------------------------------------------------------

export function RecentGenerations({ accentColor = '#d9ff00' }: RecentGenerationsProps) {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { setActiveTab, setLatestResult, setGenerationResults, setSelectedResultIndex, providerVersion } = useAppStore();

  const maxItems = isMobile ? 6 : 10;

  // Fetch recent generations from IndexedDB
  const fetchRecent = useCallback(async () => {
    try {
      const result = await data.fetchGenerations({ limit: maxItems });
      const items: Generation[] = result.generations.map((g) => ({
        id: g.id,
        providerId: g.providerId,
        modelId: g.modelId,
        type: g.type,
        prompt: g.prompt,
        negativePrompt: g.negativePrompt || null,
        resultUrl: g.resultUrl || null,
        resultData: g.resultData || null,
        thumbnailUrl: g.thumbnailUrl || null,
        isFavorite: g.isFavorite,
        status: g.status,
        parentGenerationId: g.parentGenerationId || null,
        createdAt: new Date(g.createdAt).toISOString(),
        provider: g.providerName ? { name: g.providerName, displayName: g.providerName, color: null } : null,
      }));
      setGenerations(items.slice(0, maxItems));
    } catch {
      /* non-critical */
    } finally {
      setLoading(false);
    }
  }, [maxItems]);

  useEffect(() => {
    fetchRecent();
  }, [fetchRecent, providerVersion]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    pollRef.current = setInterval(fetchRecent, 10000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchRecent]);

  // Click to load result into the store
  const handleLoadResult = useCallback((gen: Generation) => {
    const url = getResultUrl(gen);
    if (!url) return;
    setLatestResult(url);
    setGenerationResults([url]);
    setSelectedResultIndex(0);
  }, [setLatestResult, setGenerationResults, setSelectedResultIndex]);

  const handleOpenGallery = useCallback(() => {
    setActiveTab('gallery');
  }, [setActiveTab]);

  // Empty state — don't render
  if (!loading && generations.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="shrink-0 border-t border-white/[0.06] backdrop-blur-xl bg-white/[0.02]"
    >
      <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
        {/* Label */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 hidden sm:block">
            Recent
          </span>
        </div>

        {/* Thumbnails strip */}
        <ScrollArea className="flex-1">
          <div className="flex gap-2 pb-0.5">
            <AnimatePresence>
              {generations.map((gen, idx) => {
                const url = getResultUrl(gen);
                if (!url) return null;

                return (
                  <motion.button
                    key={gen.id}
                    type="button"
                    initial={{ opacity: 0, scale: 0.85, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.25 }}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => handleLoadResult(gen)}
                    className="group relative shrink-0 overflow-hidden rounded-lg border border-white/[0.08] hover:border-[#d9ff00]/30 transition-all focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-transparent hover:shadow-[0_0_12px_rgba(217,255,0,0.1)]"
                    style={
                      { '--tw-ring-color': `${accentColor}60` } as React.CSSProperties
                    }
                  >
                    {/* Thumbnail */}
                    {isVideo(gen) ? (
                      <div className="relative h-14 w-14 bg-black/60 flex items-center justify-center">
                        <video
                          src={url}
                          className="h-full w-full object-cover"
                          muted
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
                          <Play className="h-3 w-3 text-white/80" />
                        </div>
                      </div>
                    ) : (
                      <img
                        src={url}
                        alt={gen.prompt}
                        className="h-14 w-14 object-cover"
                        loading="lazy"
                      />
                    )}

                    {/* Provider color dot */}
                    {gen.provider?.color && (
                      <span
                        className="absolute bottom-0.5 left-0.5 h-2 w-2 rounded-full ring-1 ring-black/40"
                        style={{ backgroundColor: gen.provider.color }}
                      />
                    )}

                    {/* Time badge */}
                    <span className="absolute top-0.5 right-0.5 flex items-center gap-0.5 rounded-full bg-black/60 backdrop-blur-sm px-1 py-0.5 text-[7px] text-white/70 font-medium">
                      {isVideo(gen) ? (
                        <VideoIcon className="h-2 w-2" />
                      ) : (
                        <ImageIcon className="h-2 w-2" />
                      )}
                      {formatRelativeTime(gen.createdAt)}
                    </span>

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-[#d9ff00]/0 group-hover:bg-[#d9ff00]/5 transition-colors" />
                  </motion.button>
                );
              })}
            </AnimatePresence>

            {/* Loading skeletons */}
            {loading &&
              Array.from({ length: isMobile ? 4 : 6 }).map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  className="h-14 w-14 shrink-0 animate-pulse rounded-lg bg-white/[0.06]"
                />
              ))}
          </div>
        </ScrollArea>

        {/* View All button */}
        <button
          type="button"
          onClick={handleOpenGallery}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground/70 transition-all hover:bg-white/[0.08] hover:text-muted-foreground hover:border-white/15 active:scale-95"
        >
          <Grid3X3 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">View All</span>
          <ArrowRight className="h-3 w-3 hidden sm:inline" />
        </button>
      </div>
    </motion.div>
  );
}
