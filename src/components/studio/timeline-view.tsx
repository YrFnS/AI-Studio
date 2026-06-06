'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';
import {
  GitBranch,
  ImageIcon,
  VideoIcon,
  Heart,
  Clock,
  Maximize2,
  Layers,
  Wand2,
  Film,
  Paintbrush,
  Download,
  Loader2,
  Calendar,
  Filter,
  Sparkles,
  ChevronDown,
  X,
  ZoomIn,
} from 'lucide-react';

import { useAppStore } from '@/lib/store';
import * as data from '@/lib/data';
import type { Generation, TimelineNode, TimelineDateFilter } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';

// ---------------------------------------------------------------------------
// Branch color palette — each branch gets a unique color
// ---------------------------------------------------------------------------

const BRANCH_COLORS = [
  '#d9ff00', // Neon green (main)
  '#00d4ff', // Cyan
  '#ff6b6b', // Coral
  '#c084fc', // Purple
  '#fb923c', // Orange
  '#34d399', // Emerald
  '#f472b6', // Pink
  '#facc15', // Yellow
  '#60a5fa', // Blue
  '#a78bfa', // Violet
];

// ---------------------------------------------------------------------------
// Date filter options
// ---------------------------------------------------------------------------

const DATE_FILTERS: { value: TimelineDateFilter; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

// ---------------------------------------------------------------------------
// Helper: build tree from flat generation list
// ---------------------------------------------------------------------------

function buildTimelineTree(generations: Generation[]): TimelineNode[] {
  const map = new Map<string, TimelineNode>();
  const roots: TimelineNode[] = [];

  // Create all nodes first
  for (const gen of generations) {
    map.set(gen.id, {
      generation: gen,
      children: [],
      depth: 0,
      branchIndex: 0,
    });
  }

  // Build parent-child relationships
  let branchCounter = 0;
  for (const gen of generations) {
    const node = map.get(gen.id)!;
    if (gen.parentGenerationId && map.has(gen.parentGenerationId)) {
      const parent = map.get(gen.parentGenerationId)!;
      parent.children.push(node);
      node.depth = parent.depth + 1;
      // Assign branch index based on child's position among siblings
      node.branchIndex = parent.children.length - 1;
    } else {
      node.depth = 0;
      node.branchIndex = branchCounter++;
      roots.push(node);
    }
  }

  // Sort roots by createdAt
  roots.sort((a, b) => new Date(a.generation.createdAt).getTime() - new Date(b.generation.createdAt).getTime());

  return roots;
}

// ---------------------------------------------------------------------------
// Get image URL from generation
// ---------------------------------------------------------------------------

function getImageUrl(gen: Generation): string | null {
  if (gen.thumbnailUrl) return gen.thumbnailUrl;
  if (gen.resultUrl) return gen.resultUrl;
  if (gen.resultData) return `data:image/png;base64,${gen.resultData}`;
  return null;
}

// ---------------------------------------------------------------------------
// Provider info for timeline
// ---------------------------------------------------------------------------

interface ProviderOption {
  id: string;
  displayName: string;
  color: string | null;
}

// ---------------------------------------------------------------------------
// Timeline Node Card component
// ---------------------------------------------------------------------------

interface TimelineNodeCardProps {
  node: TimelineNode;
  onOpenLightbox: (gen: Generation) => void;
  onFork: (gen: Generation) => void;
  isHovered: string | null;
  onHover: (id: string | null) => void;
  branchColor: string;
}

function TimelineNodeCard({ node, onOpenLightbox, onFork, isHovered, onHover, branchColor }: TimelineNodeCardProps) {
  const gen = node.generation;
  const imageUrl = getImageUrl(gen);
  const isHoveredNode = isHovered === gen.id;
  const providerColor = gen.provider?.color || '#888';
  const branchBorderColor = branchColor || '#d9ff00';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24, delay: node.depth * 0.05 }}
      onMouseEnter={() => onHover(gen.id)}
      onMouseLeave={() => onHover(null)}
      className="relative group"
    >
      {/* Node card */}
      <motion.div
        whileHover={{ scale: 1.03, y: -2 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={`
          relative cursor-pointer overflow-hidden rounded-xl border
          transition-all duration-300
          ${isHoveredNode
            ? 'border-[var(--branch-color)] shadow-[0_0_20px_var(--branch-glow)] bg-white/[0.08]'
            : 'border-white/[0.08] bg-white/[0.04] hover:border-white/[0.15]'
          }
        `}
        style={{
          '--branch-color': branchBorderColor,
          '--branch-glow': `${branchBorderColor}30`,
          width: '180px',
        } as React.CSSProperties}
        onClick={() => imageUrl && onOpenLightbox(gen)}
      >
        {/* Branch color accent top bar */}
        <div
          className="h-1 w-full"
          style={{
            background: `linear-gradient(90deg, ${branchBorderColor}, ${branchBorderColor}80)`,
          }}
        />

        {/* Thumbnail */}
        <div className="relative aspect-square bg-surface overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={gen.prompt}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
              loading="lazy"
            />
          ) : gen.type === 'video' ? (
            <div className="flex h-full w-full items-center justify-center">
              <VideoIcon className="h-8 w-8 text-muted-foreground/30" />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
            </div>
          )}

          {/* Type badge */}
          <div className="absolute left-1.5 top-1.5">
            {gen.type === 'video' ? (
              <Badge className="gap-0.5 bg-black/60 text-white backdrop-blur-sm border-0 text-[8px] px-1 py-0">
                <VideoIcon className="h-2.5 w-2.5" />
              </Badge>
            ) : (
              <Badge className="gap-0.5 bg-black/60 text-white backdrop-blur-sm border-0 text-[8px] px-1 py-0">
                <ImageIcon className="h-2.5 w-2.5" />
              </Badge>
            )}
          </div>

          {/* Favorite */}
          {gen.isFavorite && (
            <div className="absolute right-1.5 top-1.5">
              <Heart className="h-3 w-3 fill-[#d9ff00] text-[#d9ff00] drop-shadow" />
            </div>
          )}

          {/* Hover overlay with Fork button */}
          <AnimatePresence>
            {isHoveredNode && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center gap-2"
              >
                {imageUrl && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenLightbox(gen);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 transition-colors"
                    title="View full size"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Info */}
        <div className="p-2 space-y-1">
          <p className="line-clamp-2 text-[10px] leading-snug text-foreground/80" title={gen.prompt}>
            {gen.prompt}
          </p>
          <div className="flex items-center gap-1">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: providerColor }}
            />
            <span className="text-[8px] text-muted-foreground/70 truncate">
              {gen.provider?.displayName || 'Unknown'}
            </span>
            {gen.modelId && (
              <span className="text-[8px] text-muted-foreground/50 truncate">
                · {gen.modelId}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-2 w-2 text-muted-foreground/40" />
            <span className="text-[8px] text-muted-foreground/50">
              {formatDistanceToNow(new Date(gen.createdAt), { addSuffix: true })}
            </span>
          </div>
        </div>

        {/* Fork button */}
        <motion.button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onFork(gen);
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className={`
            absolute -bottom-1 left-1/2 -translate-x-1/2 z-10
            flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold
            transition-all duration-200
            ${isHoveredNode
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0'
            }
          `}
          style={{
            backgroundColor: `${branchBorderColor}20`,
            color: branchBorderColor,
            border: `1px solid ${branchBorderColor}40`,
            boxShadow: `0 0 8px ${branchBorderColor}20`,
          }}
          title="Fork: Create a variation from this point"
        >
          <GitBranch className="h-2.5 w-2.5" />
          Fork
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Timeline Branch Row — renders a root node and its children as a tree
// ---------------------------------------------------------------------------

interface TimelineBranchRowProps {
  root: TimelineNode;
  onOpenLightbox: (gen: Generation) => void;
  onFork: (gen: Generation) => void;
  isHovered: string | null;
  onHover: (id: string | null) => void;
  branchIndex: number;
}

function TimelineBranchRow({ root, onOpenLightbox, onFork, isHovered, onHover, branchIndex }: TimelineBranchRowProps) {
  const branchColor = BRANCH_COLORS[branchIndex % BRANCH_COLORS.length];

  // Flatten the tree into rows (BFS-like) for rendering
  const renderTree = (node: TimelineNode, depth: number, childIdx: number, parentColor: string) => {
    const color = depth === 0 ? branchColor : parentColor;
    const items: React.ReactNode[] = [];

    items.push(
      <div key={node.generation.id} className="flex items-start gap-0">
        {/* Connection line from parent */}
        {depth > 0 && (
          <div className="relative flex flex-col items-center" style={{ width: '40px' }}>
            {/* Vertical line down from parent */}
            <div
              className="w-px flex-1"
              style={{
                background: `linear-gradient(to bottom, ${color}60, ${color}20)`,
                minHeight: '20px',
              }}
            />
            {/* Horizontal line to node */}
            <div
              className="h-px self-end"
              style={{
                background: `linear-gradient(to right, ${color}40, ${color}10)`,
                width: '20px',
              }}
            />
            {/* Vertical line down to node */}
            <div
              className="w-px"
              style={{
                background: `linear-gradient(to bottom, ${color}40, transparent)`,
                height: '20px',
              }}
            />
          </div>
        )}

        <TimelineNodeCard
          node={node}
          onOpenLightbox={onOpenLightbox}
          onFork={onFork}
          isHovered={isHovered}
          onHover={onHover}
          branchColor={color}
        />

        {/* Children */}
        {node.children.length > 0 && (
          <div className="flex flex-col gap-3 ml-3">
            {node.children.map((child, i) => (
              <div key={child.generation.id} className="flex items-start">
                {/* Branch connection */}
                <div className="relative flex flex-col items-center" style={{ width: '30px' }}>
                  {/* Vertical connector from parent level */}
                  <div
                    className="w-px"
                    style={{
                      background: `linear-gradient(to bottom, ${color}50, ${color}25)`,
                      height: '100%',
                    }}
                  />
                  {/* Horizontal connector */}
                  <div
                    className="absolute top-1/2 h-px"
                    style={{
                      background: `linear-gradient(to right, ${color}40, ${color}10)`,
                      width: '30px',
                      left: '0',
                    }}
                  />
                  {/* Branch dot */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 left-0 h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: BRANCH_COLORS[(branchIndex + i + 1) % BRANCH_COLORS.length],
                      boxShadow: `0 0 6px ${BRANCH_COLORS[(branchIndex + i + 1) % BRANCH_COLORS.length]}40`,
                    }}
                  />
                </div>

                <TimelineNodeCard
                  node={child}
                  onOpenLightbox={onOpenLightbox}
                  onFork={onFork}
                  isHovered={isHovered}
                  onHover={onHover}
                  branchColor={BRANCH_COLORS[(branchIndex + i + 1) % BRANCH_COLORS.length]}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );

    return items;
  };

  // Flatten all nodes for rendering as a horizontal flow
  const allNodes = useMemo(() => {
    const result: { node: TimelineNode; depth: number; color: string; parentChildCount: number; siblingIndex: number }[] = [];
    const traverse = (n: TimelineNode, d: number, c: string, sibIdx: number, parentChildCount: number) => {
      result.push({ node: n, depth: d, color: c, siblingIndex: sibIdx, parentChildCount });
      n.children.forEach((child, i) => {
        traverse(child, d + 1, BRANCH_COLORS[(branchIndex + i + 1) % BRANCH_COLORS.length], i, n.children.length);
      });
    };
    traverse(root, 0, branchColor, 0, 1);
    return result;
  }, [root, branchIndex, branchColor]);

  return (
    <div className="flex items-start gap-0 overflow-x-auto scrollbar-none pb-2">
      {/* Render as a horizontal tree */}
      <div className="flex items-start gap-4 px-2">
        {allNodes.map((item, idx) => {
          const isFirst = idx === 0;
          const hasParent = item.depth > 0;

          return (
            <div key={item.node.generation.id} className="flex flex-col items-center">
              {/* Connection line from previous node */}
              {hasParent && (
                <div className="flex items-center gap-0 mb-0">
                  <div
                    className="h-px"
                    style={{
                      background: `linear-gradient(to right, ${item.color}30, ${item.color}60)`,
                      width: '24px',
                      marginLeft: '-24px',
                    }}
                  />
                  {/* Branch dot */}
                  <div
                    className="h-2 w-2 rounded-full -ml-3 -mb-1"
                    style={{
                      backgroundColor: item.color,
                      boxShadow: `0 0 6px ${item.color}40`,
                    }}
                  />
                </div>
              )}

              {/* Depth indicator lines */}
              {item.depth > 0 && (
                <div className="flex gap-0 w-full mb-1">
                  {Array.from({ length: item.depth }).map((_, i) => (
                    <div
                      key={i}
                      className="w-px h-3"
                      style={{
                        background: `linear-gradient(to bottom, ${BRANCH_COLORS[(branchIndex + i) % BRANCH_COLORS.length]}30, transparent)`,
                      }}
                    />
                  ))}
                </div>
              )}

              <TimelineNodeCard
                node={item.node}
                onOpenLightbox={onOpenLightbox}
                onFork={onFork}
                isHovered={isHovered}
                onHover={onHover}
                branchColor={item.color}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main TimelineView component
// ---------------------------------------------------------------------------

interface TimelineViewProps {
  onOpenLightbox: (gen: Generation) => void;
}

export function TimelineView({ onOpenLightbox }: TimelineViewProps) {
  const {
    galleryTimelineDateFilter, setGalleryTimelineDateFilter,
    galleryTimelineTypeFilter, setGalleryTimelineTypeFilter,
    galleryTimelineProviderFilter, setGalleryTimelineProviderFilter,
  } = useAppStore();

  const [generations, setGenerations] = useState<Generation[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [lightboxGen, setLightboxGen] = useState<Generation | null>(null);

  // Fetch timeline data from IndexedDB
  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const result = await data.fetchGenerationsTimeline({
        dateFilter: galleryTimelineDateFilter,
        typeFilter: galleryTimelineTypeFilter,
        providerFilter: galleryTimelineProviderFilter,
      });
      const mapped: Generation[] = result.generations.map((g) => ({
        id: g.id, providerId: g.providerId, modelId: g.modelId, type: g.type,
        prompt: g.prompt, negativePrompt: g.negativePrompt || null,
        resultUrl: g.resultUrl || null, resultData: g.resultData || null,
        thumbnailUrl: g.thumbnailUrl || null, isFavorite: g.isFavorite,
        status: g.status, parentGenerationId: g.parentGenerationId || null,
        createdAt: new Date(g.createdAt).toISOString(),
        provider: g.providerName ? { name: g.providerName, displayName: g.providerName, color: null } : null,
      }));
      setGenerations(mapped);
      // Build provider options from generations
      const providerMap = new Map<string, { id: string; displayName: string; color: string | null }>();
      for (const g of result.generations) {
        if (g.providerId && g.providerName && !providerMap.has(g.providerId)) {
          providerMap.set(g.providerId, { id: g.providerId, displayName: g.providerName, color: null });
        }
      }
      setProviders(Array.from(providerMap.values()));
    } catch {
      toast.error('Failed to load timeline');
    } finally {
      setLoading(false);
    }
  }, [galleryTimelineDateFilter, galleryTimelineTypeFilter, galleryTimelineProviderFilter]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  // Build tree
  const tree = useMemo(() => buildTimelineTree(generations), [generations]);

  // Group roots by date
  const groupedByDate = useMemo(() => {
    const groups: { label: string; date: Date; nodes: TimelineNode[] }[] = [];
    for (const node of tree) {
      const date = new Date(node.generation.createdAt);
      const label = format(date, 'MMM d, yyyy');
      let group = groups.find((g) => g.label === label);
      if (!group) {
        group = { label, date, nodes: [] };
        groups.push(group);
      }
      group.nodes.push(node);
    }
    return groups.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [tree]);

  // Fork handler
  const handleFork = useCallback((gen: Generation) => {
    const imageUrl = getImageUrl(gen);
    const { setInputImageUrl, setImagePrompt, setActiveTab } = useAppStore.getState();
    if (imageUrl) {
      setInputImageUrl(imageUrl);
    }
    setImagePrompt(gen.prompt);
    setActiveTab('image');
    toast.success('Image loaded as reference — customize and generate a fork!');
  }, []);

  // Open lightbox
  const handleOpenLightbox = useCallback((gen: Generation) => {
    onOpenLightbox(gen);
  }, [onOpenLightbox]);

  // Download
  const handleDownload = useCallback(async (url: string, type: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `ai-studio-${Date.now()}.${type === 'video' ? 'mp4' : 'png'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast.success('Downloaded');
    } catch {
      window.open(url, '_blank');
    }
  }, []);

  // Stats
  const totalNodes = generations.length;
  const rootCount = tree.length;
  const branchedCount = generations.filter((g) => g.parentGenerationId).length;

  return (
    <div className="flex flex-col h-full">
      {/* Timeline Filters Bar */}
      <div className="shrink-0 border-b border-border/30 bg-surface/20 px-5 py-2.5">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <GitBranch className="h-4 w-4 text-[#d9ff00]" />
            <span className="text-xs font-semibold text-foreground">Timeline</span>
            <Badge className="bg-[#d9ff00]/15 text-[#d9ff00] border-[#d9ff00]/30 text-[9px] px-1.5">
              {totalNodes} nodes
            </Badge>
            {branchedCount > 0 && (
              <Badge className="bg-cyan-500/15 text-cyan-400 border-cyan-500/30 text-[9px] px-1.5">
                {branchedCount} branches
              </Badge>
            )}
          </div>

          <div className="h-4 w-px bg-border/30" />

          {/* Date filter */}
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-muted-foreground/60" />
            {DATE_FILTERS.map((df) => (
              <button
                key={df.value}
                type="button"
                onClick={() => setGalleryTimelineDateFilter(df.value)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all duration-200 ${
                  galleryTimelineDateFilter === df.value
                    ? 'bg-[#d9ff00]/15 text-[#d9ff00] border border-[#d9ff00]/30'
                    : 'text-muted-foreground/60 hover:text-foreground hover:bg-white/5 border border-transparent'
                }`}
              >
                {df.label}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-border/30" />

          {/* Type filter */}
          <div className="flex items-center gap-1">
            <Filter className="h-3 w-3 text-muted-foreground/60" />
            {(['all', 'image', 'video'] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setGalleryTimelineTypeFilter(tf)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all duration-200 ${
                  galleryTimelineTypeFilter === tf
                    ? 'bg-[#d9ff00]/15 text-[#d9ff00] border border-[#d9ff00]/30'
                    : 'text-muted-foreground/60 hover:text-foreground hover:bg-white/5 border border-transparent'
                }`}
              >
                {tf === 'all' ? 'All' : tf === 'image' ? 'Images' : 'Videos'}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-border/30" />

          {/* Provider filter */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all duration-200 text-muted-foreground/60 hover:text-foreground hover:bg-white/5 border border-transparent"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor: galleryTimelineProviderFilter
                      ? providers.find((p) => p.id === galleryTimelineProviderFilter)?.color || '#888'
                      : '#888',
                  }}
                />
                {galleryTimelineProviderFilter
                  ? providers.find((p) => p.id === galleryTimelineProviderFilter)?.displayName || 'Provider'
                  : 'All Providers'}
                <ChevronDown className="h-2.5 w-2.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 glass-strong border-border/60 bg-[#111111]/95 p-1.5" align="start">
              <button
                type="button"
                onClick={() => setGalleryTimelineProviderFilter('')}
                className={`flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-xs transition-colors ${
                  !galleryTimelineProviderFilter
                    ? 'bg-[#d9ff00]/10 text-[#d9ff00]'
                    : 'text-foreground/80 hover:bg-white/5'
                }`}
              >
                All Providers
              </button>
              {providers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setGalleryTimelineProviderFilter(p.id)}
                  className={`flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-xs transition-colors ${
                    galleryTimelineProviderFilter === p.id
                      ? 'bg-[#d9ff00]/10 text-[#d9ff00]'
                      : 'text-foreground/80 hover:bg-white/5'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color || '#888' }} />
                  {p.displayName}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Refresh */}
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchTimeline}
            className="ml-auto gap-1 text-muted-foreground hover:text-[#d9ff00] h-7 px-2 text-[10px]"
          >
            <Sparkles className="h-3 w-3" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Timeline Content */}
      <ScrollArea className="flex-1">
        <div className="p-5 space-y-8">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-8 w-8 text-[#d9ff00] animate-spin" />
              <span className="text-sm text-muted-foreground">Loading timeline…</span>
            </div>
          )}

          {/* Empty state */}
          {!loading && generations.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-20 gap-6 text-center"
            >
              <div className="relative">
                <div className="absolute -inset-4 rounded-full bg-[#d9ff00]/5 blur-2xl" />
                <motion.div
                  animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-[#d9ff00]/20 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-sm"
                >
                  <GitBranch className="h-10 w-10 text-[#d9ff00]/60" />
                </motion.div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">No generations yet</h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-md">
                  Your generation timeline will appear here as a visual tree. Create images or videos to see them branch out.
                </p>
              </div>
              <Button
                onClick={() => useAppStore.getState().setActiveTab('image')}
                className="gap-2 bg-[#d9ff00] text-background hover:bg-[#c5eb00] font-semibold rounded-xl px-5 h-10 shadow-[0_0_20px_rgba(217,255,0,0.2)]"
              >
                <Sparkles className="h-4 w-4" />
                Start Creating
              </Button>
            </motion.div>
          )}

          {/* Date groups */}
          {!loading && groupedByDate.map((group) => (
            <motion.div
              key={group.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* Date header */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-[#d9ff00]/70" />
                  <span className="text-sm font-semibold text-foreground">{group.label}</span>
                  <Badge className="bg-white/5 border-white/10 text-[9px] text-muted-foreground">
                    {group.nodes.length} root{group.nodes.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-border/40 to-transparent" />
              </div>

              {/* Timeline rows */}
              <div className="space-y-6 ml-2">
                {group.nodes.map((rootNode, idx) => {
                  const branchColor = BRANCH_COLORS[idx % BRANCH_COLORS.length];

                  // Render as vertical tree with indentation
                  const renderNode = (node: TimelineNode, depth: number, sibIdx: number, color: string): React.ReactNode => {
                    const nodeColor = depth === 0 ? branchColor : color;
                    const childCount = node.children.length;

                    return (
                      <div key={node.generation.id} className="flex flex-col">
                        <div className="flex items-start gap-3">
                          {/* Connection lines for depth > 0 */}
                          {depth > 0 && (
                            <div className="flex flex-col items-center shrink-0" style={{ width: '28px' }}>
                              {/* Vertical line from parent */}
                              <div
                                className="w-px h-4"
                                style={{ background: `linear-gradient(to bottom, ${nodeColor}50, ${nodeColor}20)` }}
                              />
                              {/* Branch dot */}
                              <div
                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                style={{
                                  backgroundColor: nodeColor,
                                  boxShadow: `0 0 6px ${nodeColor}40`,
                                }}
                              />
                              {/* Vertical line to next sibling or end */}
                              <div
                                className="w-px flex-1"
                                style={{ background: `linear-gradient(to bottom, ${nodeColor}20, transparent)` }}
                              />
                            </div>
                          )}

                          {/* Depth indentation guides */}
                          {depth > 1 && (
                            <div className="flex gap-0 shrink-0">
                              {Array.from({ length: depth - 1 }).map((_, i) => (
                                <div
                                  key={i}
                                  className="w-px h-full"
                                  style={{
                                    background: `linear-gradient(to bottom, ${BRANCH_COLORS[(idx + i) % BRANCH_COLORS.length]}15, transparent)`,
                                    minHeight: '100%',
                                  }}
                                />
                              ))}
                            </div>
                          )}

                          {/* Node card */}
                          <div className="relative">
                            {/* Horizontal connector line for children */}
                            {depth === 0 && childCount > 0 && (
                              <div
                                className="absolute -bottom-3 left-1/2 h-6 w-px"
                                style={{ background: `linear-gradient(to bottom, ${nodeColor}40, ${nodeColor}15)` }}
                              />
                            )}

                            <TimelineNodeCard
                              node={node}
                              onOpenLightbox={handleOpenLightbox}
                              onFork={handleFork}
                              isHovered={hoveredId}
                              onHover={setHoveredId}
                              branchColor={nodeColor}
                            />
                          </div>
                        </div>

                        {/* Children */}
                        {childCount > 0 && (
                          <div className="ml-[28px] mt-2 space-y-2 pl-2 border-l"
                            style={{ borderColor: `${nodeColor}15` }}
                          >
                            {node.children.map((child, ci) => (
                              <div key={child.generation.id}>
                                {renderNode(
                                  child,
                                  depth + 1,
                                  ci,
                                  BRANCH_COLORS[(idx + ci + 1) % BRANCH_COLORS.length]
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  };

                  return (
                    <div key={rootNode.generation.id}>
                      {renderNode(rootNode, 0, idx, branchColor)}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      </ScrollArea>

      {/* Mini lightbox for timeline */}
      <Dialog
        open={!!lightboxGen}
        onOpenChange={(open) => {
          if (!open) setLightboxGen(null);
        }}
      >
        <DialogContent
          className="glass-dialog max-w-3xl border-border/40 bg-[#0a0a0a]/95 p-0 backdrop-blur-2xl lightbox-zoom-enter"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Timeline generation detail</DialogTitle>
          <DialogDescription className="sr-only">View generation from timeline</DialogDescription>
          {lightboxGen && (
            <div className="relative flex flex-col">
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 top-3 z-10 h-8 w-8 rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-black/80"
                onClick={() => setLightboxGen(null)}
              >
                <X className="h-4 w-4" />
              </Button>

              <div className="overflow-hidden rounded-t-xl">
                {getImageUrl(lightboxGen) ? (
                  <img
                    src={getImageUrl(lightboxGen)!}
                    alt={lightboxGen.prompt}
                    className="w-full max-h-[60vh] object-contain bg-black/40"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center bg-black/40">
                    <ImageIcon className="h-12 w-12 text-muted-foreground/20" />
                  </div>
                )}
              </div>

              <div className="space-y-3 p-4">
                <p className="text-sm text-foreground/90">{lightboxGen.prompt}</p>
                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                  <Badge
                    className="gap-1 border-0 px-1.5 py-0 text-[9px]"
                    style={{
                      backgroundColor: `${lightboxGen.provider?.color || '#888'}20`,
                      color: lightboxGen.provider?.color || '#888',
                    }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: lightboxGen.provider?.color || '#888' }} />
                    {lightboxGen.provider?.displayName || 'Unknown'}
                  </Badge>
                  {lightboxGen.modelId && (
                    <Badge variant="secondary" className="border-0 bg-white/5 text-[9px]">
                      {lightboxGen.modelId}
                    </Badge>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(lightboxGen.createdAt), { addSuffix: true })}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {getImageUrl(lightboxGen) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-border/40 bg-surface/50 text-xs"
                      onClick={() => handleDownload(getImageUrl(lightboxGen)!, lightboxGen.type)}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-border/40 bg-surface/50 text-xs"
                    onClick={() => handleFork(lightboxGen)}
                  >
                    <GitBranch className="h-3.5 w-3.5 text-[#d9ff00]" />
                    Fork
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
