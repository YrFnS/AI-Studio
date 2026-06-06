'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  Heart,
  ImageIcon,
  VideoIcon,
  Grid3X3,
  X,
  ExternalLink,
  Play,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import * as data from '@/lib/data';
import type { Generation } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecentBarProps {
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
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// QuickPreview — popover content shown when clicking a thumbnail
// ---------------------------------------------------------------------------

function QuickPreview({
  gen,
  onFavorite,
  onOpenGallery,
}: {
  gen: Generation;
  onFavorite: () => void;
  onOpenGallery: () => void;
}) {
  const url = getResultUrl(gen);

  const handleDownload = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-studio-${gen.id}.${isVideo(gen) ? 'mp4' : 'png'}`;
    a.target = '_blank';
    a.click();
  };

  return (
    <div className="w-72 space-y-3 p-1">
      {/* Preview image / video */}
      <div className="relative overflow-hidden rounded-lg border border-border/30 bg-black/40">
        {isVideo(gen) ? (
          <div className="relative aspect-video flex items-center justify-center bg-black/60">
            <video
              src={url}
              className="h-full w-full object-contain"
              controls
              muted
              autoPlay
            />
          </div>
        ) : (
          <img
            src={url}
            alt={gen.prompt}
            className="aspect-square w-full object-cover"
          />
        )}
        {/* Type badge */}
        <div className="absolute top-2 left-2">
          <Badge
            variant="secondary"
            className="h-5 gap-1 bg-black/60 text-[10px] text-white backdrop-blur-sm border-0"
          >
            {isVideo(gen) ? (
              <VideoIcon className="h-3 w-3" />
            ) : (
              <ImageIcon className="h-3 w-3" />
            )}
            {isVideo(gen) ? 'Video' : 'Image'}
          </Badge>
        </div>
        {/* Provider dot */}
        {gen.provider?.color && (
          <div className="absolute top-2 right-2">
            <span
              className="inline-block h-3 w-3 rounded-full ring-2 ring-black/40"
              style={{ backgroundColor: gen.provider.color }}
            />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="space-y-1.5 px-1">
        <p className="text-xs text-foreground line-clamp-3 leading-relaxed">
          {gen.prompt}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {gen.provider && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: gen.provider.color || '#888' }}
              />
              {gen.provider.displayName}
            </span>
          )}
          {gen.modelId && (
            <span className="text-[10px] text-muted-foreground/70">
              {gen.modelId}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/50">
            {formatRelativeTime(gen.createdAt)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 px-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDownload}
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onFavorite}
          className={`h-7 gap-1.5 text-xs ${
            gen.isFavorite
              ? 'text-red-400 hover:text-red-300'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Heart className={`h-3.5 w-3.5 ${gen.isFavorite ? 'fill-current' : ''}`} />
          {gen.isFavorite ? 'Favorited' : 'Favorite'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenGallery}
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground ml-auto"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Gallery
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RecentBar — main component
// ---------------------------------------------------------------------------

export function RecentBar({ accentColor = '#d9ff00' }: RecentBarProps) {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { setActiveTab, providerVersion } = useAppStore();

  const maxVisible = isMobile ? 4 : 8;

  // Fetch recent generations from IndexedDB
  const fetchRecent = useCallback(async () => {
    try {
      const result = await data.fetchGenerations({ limit: maxVisible });
      const items: Generation[] = result.generations.map((g) => ({
        id: g.id, providerId: g.providerId, modelId: g.modelId, type: g.type,
        prompt: g.prompt, negativePrompt: g.negativePrompt || null,
        resultUrl: g.resultUrl || null, resultData: g.resultData || null,
        thumbnailUrl: g.thumbnailUrl || null, isFavorite: g.isFavorite,
        status: g.status, parentGenerationId: g.parentGenerationId || null,
        createdAt: new Date(g.createdAt).toISOString(),
        provider: g.providerName ? { name: g.providerName, displayName: g.providerName, color: null } : null,
      }));
      setGenerations(items.slice(0, maxVisible));
    } catch {
      /* non-critical */
    } finally {
      setLoading(false);
    }
  }, [maxVisible]);

  useEffect(() => {
    fetchRecent();
  }, [fetchRecent, providerVersion]);

  // Auto-refresh every 10 seconds -------------------------------------------
  useEffect(() => {
    pollRef.current = setInterval(fetchRecent, 10000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchRecent]);

  // Favorite handler --------------------------------------------------------
  const handleFavorite = useCallback(async (gen: Generation) => {
    try {
      await data.toggleGenerationFavorite(gen.id, gen.isFavorite);
      setGenerations((prev) =>
        prev.map((g) =>
          g.id === gen.id ? { ...g, isFavorite: !g.isFavorite } : g
        )
      );
    } catch {
      /* non-critical */
    }
  }, []);

  const handleOpenGallery = useCallback(() => {
    setActiveTab('gallery');
    setOpenPopoverId(null);
  }, [setActiveTab]);

  // Empty state — don't render the bar --------------------------------------
  if (!loading && generations.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="shrink-0 border-t border-white/[0.06] backdrop-blur-xl bg-white/[0.03]"
    >
      <div className="flex items-center gap-3 px-3 py-2 sm:px-4">
        {/* Label */}
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 hidden sm:block">
          Recent
        </span>

        {/* Thumbnails strip */}
        <ScrollArea className="flex-1">
          <div className="flex gap-2 pb-0.5">
            <AnimatePresence>
              {generations.map((gen, idx) => {
                const url = getResultUrl(gen);
                if (!url) return null;

                return (
                  <motion.div
                    key={gen.id}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.04, duration: 0.25 }}
                  >
                    <Popover
                      open={openPopoverId === gen.id}
                      onOpenChange={(open) =>
                        setOpenPopoverId(open ? gen.id : null)
                      }
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="group relative shrink-0 overflow-hidden rounded-lg border border-white/[0.08] hover:border-white/20 transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-transparent"
                          style={
                            { '--tw-ring-color': `${accentColor}60` } as React.CSSProperties
                          }
                        >
                          {/* Thumbnail */}
                          {isVideo(gen) ? (
                            <div className="relative h-16 w-16 bg-black/60 flex items-center justify-center">
                              <video
                                src={url}
                                className="h-full w-full object-cover"
                                muted
                                preload="metadata"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
                                <Play className="h-3.5 w-3.5 text-white/80" />
                              </div>
                            </div>
                          ) : (
                            <img
                              src={url}
                              alt={gen.prompt}
                              className="h-16 w-16 object-cover"
                              loading="lazy"
                            />
                          )}

                          {/* Provider color dot overlay */}
                          {gen.provider?.color && (
                            <span
                              className="absolute bottom-1 left-1 h-2 w-2 rounded-full ring-1 ring-black/40"
                              style={{ backgroundColor: gen.provider.color }}
                            />
                          )}

                          {/* Type badge overlay */}
                          <span className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
                            {isVideo(gen) ? (
                              <VideoIcon className="h-2 w-2 text-white/80" />
                            ) : (
                              <ImageIcon className="h-2 w-2 text-white/80" />
                            )}
                          </span>

                          {/* Favorite indicator */}
                          {gen.isFavorite && (
                            <span className="absolute top-1 left-1">
                              <Heart className="h-2.5 w-2.5 text-red-400 fill-current" />
                            </span>
                          )}
                        </button>
                      </PopoverTrigger>

                      <PopoverContent
                        side="top"
                        align="center"
                        sideOffset={8}
                        className="glass-strong w-auto border-border/40 p-3 shadow-2xl"
                      >
                        <QuickPreview
                          gen={gen}
                          onFavorite={() => handleFavorite(gen)}
                          onOpenGallery={handleOpenGallery}
                        />
                      </PopoverContent>
                    </Popover>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Loading skeletons */}
            {loading &&
              Array.from({ length: isMobile ? 4 : 6 }).map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  className="h-16 w-16 shrink-0 animate-pulse rounded-lg bg-white/[0.06]"
                />
              ))}
          </div>
        </ScrollArea>

        {/* View All button */}
        <button
          type="button"
          onClick={handleOpenGallery}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground/70 transition-all hover:bg-white/[0.08] hover:text-muted-foreground hover:border-white/15 active:scale-95"
        >
          <Grid3X3 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">View All</span>
        </button>
      </div>
    </motion.div>
  );
}
