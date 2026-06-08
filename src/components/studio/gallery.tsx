'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  ImageIcon,
  VideoIcon,
  Heart,
  Download,
  Trash2,
  Trash,
  Sparkles,
  Filter,
  LayoutGrid,
  X,
  Film,
  Star,
  BarChart3,
  TrendingUp,
  Search,
  RefreshCw,
  Loader2,
  Maximize2,
  Layers,
  Paintbrush,
  ImagePlus,
  Wand2,
  Copy,
  ChevronLeft,
  ChevronRight,
  Clock,
  Settings2,
  Zap,
  FolderOpen,
  FolderPlus,
  Plus,
  List,
  Check,
  CheckCircle2,
  MousePointerSquareDashed,
  Columns3,
  Columns2,
  Grid3x3,
  GitBranch,
} from 'lucide-react';

import { useAppStore } from '@/lib/store';
import type { Generation, GalleryFilterType, CollectionWithCount } from '@/lib/types';
import { NewCollectionDialog, AddToCollectionPopover } from '@/components/studio/collection-dialog';
import * as idb from '@/lib/data';
import { TimelineView } from '@/components/studio/timeline-view';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

// ---------------------------------------------------------------------------
// Filter config
// ---------------------------------------------------------------------------

const FILTERS: { value: GalleryFilterType; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  { value: 'image', label: 'Images', icon: <ImageIcon className="h-3.5 w-3.5" /> },
  { value: 'video', label: 'Videos', icon: <VideoIcon className="h-3.5 w-3.5" /> },
  { value: 'favorite', label: 'Favorites', icon: <Star className="h-3.5 w-3.5" /> },
  { value: 'collection', label: 'Collections', icon: <FolderOpen className="h-3.5 w-3.5" /> },
];

// ---------------------------------------------------------------------------
// Grid size config
// ---------------------------------------------------------------------------

const GRID_SIZE_CONFIG: Record<string, { label: string; icon: React.ReactNode; cols: string }> = {
  sm: { label: 'S', icon: <Grid3x3 className="h-3 w-3" />, cols: 'columns-4 md:columns-5 lg:columns-6' },
  md: { label: 'M', icon: <Columns3 className="h-3 w-3" />, cols: 'columns-2 md:columns-3 lg:columns-4' },
  lg: { label: 'L', icon: <Columns2 className="h-3 w-3" />, cols: 'columns-1 md:columns-2 lg:columns-3' },
};

// ---------------------------------------------------------------------------
// Stats type
// ---------------------------------------------------------------------------

interface GalleryStats {
  totalGenerations: number;
  totalImages: number;
  totalVideos: number;
  totalFavorites: number;
  recentCount: number;
  topProviders: {
    providerId: string | null;
    count: number;
    provider: { id: string; displayName: string; color: string | null } | null;
  }[];
  topModels: {
    modelId: string | null;
    count: number;
  }[];
  avgPerDay: number;
}

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const cardVariants = {
  hidden: (idx: number) => ({
    opacity: 0,
    y: 20,
    scale: 0.95,
    transition: { delay: Math.min(idx * 0.04, 0.8) },
  }),
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.2 },
  },
};

const floatingBarVariants = {
  hidden: { y: 80, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 28 },
  },
  exit: {
    y: 80,
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

// ---------------------------------------------------------------------------
// Particle burst component for favorite animation
// ---------------------------------------------------------------------------

function ParticleBurst({ active }: { active: boolean }) {
  if (!active) return null;
  const particles = Array.from({ length: 8 });
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      {particles.map((_, i) => {
        const angle = (i / particles.length) * 360;
        const distance = 18 + Math.random() * 12;
        return (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-[#d9ff00]"
            initial={{ x: '-50%', y: '-50%', scale: 1, opacity: 1 }}
            animate={{
              x: `calc(-50% + ${Math.cos((angle * Math.PI) / 180) * distance}px)`,
              y: `calc(-50% + ${Math.sin((angle * Math.PI) / 180) * distance}px)`,
              scale: 0,
              opacity: 0,
            }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

export function Gallery() {
  const {
    galleryFilter, setGalleryFilter, selectedCollectionId, setSelectedCollectionId,
    galleryViewMode, setGalleryViewMode, galleryGridSize, setGalleryGridSize,
    gallerySelectMode, setGallerySelectMode, gallerySelectedIds, setGallerySelectedIds,
  } = useAppStore();

  // State ------------------------------------------------------------------
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<Generation | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [stats, setStats] = useState<GalleryStats | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useCallback((node: HTMLInputElement | null) => {
    if (node) {
      (window as unknown as Record<string, HTMLInputElement>).__gallerySearchInput = node;
    }
  }, []);

  const [favRippleId, setFavRippleId] = useState<string | null>(null);
  const [favBounceId, setFavBounceId] = useState<string | null>(null);
  const [shimmerIds, setShimmerIds] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const cardTiltRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Collections state
  const [collections, setCollections] = useState<CollectionWithCount[]>([]);
  const [showNewCollectionDialog, setShowNewCollectionDialog] = useState(false);
  const [lightboxCollectionIds, setLightboxCollectionIds] = useState<string[]>([]);
  const [genCollectionMap, setGenCollectionMap] = useState<Record<string, string[]>>({});
  const [batchCollectionOpen, setBatchCollectionOpen] = useState(false);

  // Intersection observer ref for infinite scroll
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Shimmer effect for newly loaded items
  useEffect(() => {
    if (generations.length === 0) return;
    const newIds = generations.slice(0, PAGE_SIZE).map((g) => g.id);
    setShimmerIds((prev) => {
      const next = new Set(prev);
      newIds.forEach((id) => next.add(id));
      return next;
    });
    const timer = setTimeout(() => setShimmerIds(new Set()), 1500);
    return () => clearTimeout(timer);
  }, [generations]);

  // Fetch collections -----------------------------------------------------
  const fetchCollections = useCallback(async () => {
    try {
      const res = await fetch('/api/collections');
      if (res.ok) {
        const data = await res.json();
        setCollections(data.collections ?? []);
      }
    } catch { /* non-critical */ }
  }, []);

  // Load collections on mount
  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  // Fetch collection memberships for displayed generations
  useEffect(() => {
    if (generations.length === 0) {
      setGenCollectionMap({});
      return;
    }
    async function loadCollectionMemberships() {
      try {
        const ids = generations.map((g) => g.id).join(',');
        const res = await fetch(`/api/collections/items?generationIds=${ids}`);
        if (res.ok) {
          const data = await res.json();
          const map: Record<string, string[]> = {};
          for (const item of (data.items ?? [])) {
            if (!map[item.generationId]) map[item.generationId] = [];
            map[item.generationId].push(item.collectionId);
          }
          setGenCollectionMap(map);
        }
      } catch { /* non-critical */ }
    }
    loadCollectionMemberships();
  }, [generations]);

  // Fetch generations ------------------------------------------------------
  const fetchGenerations = useCallback(async (pageNum: number, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      let url = `/api/gallery?filter=${galleryFilter}&page=${pageNum}&limit=${PAGE_SIZE}`;
      if (galleryFilter === 'collection' && selectedCollectionId) {
        url += `&collectionId=${selectedCollectionId}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();

      if (append) {
        setGenerations((prev) => [...prev, ...(data.generations ?? [])]);
      } else {
        setGenerations(data.generations ?? []);
      }
      setTotal(data.total ?? 0);
      setHasMore(data.hasMore ?? false);
    } catch {
      toast.error('Failed to load gallery');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [galleryFilter, selectedCollectionId]);

  // Initial fetch + refetch on filter change
  useEffect(() => {
    setPage(1);
    fetchGenerations(1, false);
  }, [fetchGenerations]);

  // Load more handler
  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchGenerations(nextPage, true);
  }, [loadingMore, hasMore, page, fetchGenerations]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
          handleLoadMore();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, handleLoadMore]);

  // Fetch stats ------------------------------------------------------------
  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch('/api/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch { /* non-critical */ }
    }
    loadStats();
  }, [generations]);

  // Favorite toggle --------------------------------------------------------
  const handleFavoriteToggle = useCallback(
    async (id: string, currentFavorite: boolean) => {
      try {
        const res = await fetch('/api/gallery', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, isFavorite: !currentFavorite }),
        });
        if (!res.ok) throw new Error('Failed to update');
        toast.success(currentFavorite ? 'Removed from favorites' : 'Added to favorites');
        setGenerations((prev) =>
          prev.map((g) => (g.id === id ? { ...g, isFavorite: !currentFavorite } : g))
        );
        if (lightboxItem?.id === id) {
          setLightboxItem((prev) => prev ? { ...prev, isFavorite: !currentFavorite } : null);
        }
        // Bounce + particle animation
        if (!currentFavorite) {
          setFavBounceId(id);
          setTimeout(() => setFavBounceId(null), 600);
        }
      } catch {
        toast.error('Failed to update favorite');
      }
    },
    [lightboxItem]
  );

  // Delete single ----------------------------------------------------------
  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id);
      try {
        const res = await fetch(`/api/gallery?id=${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete');
        toast.success('Generation deleted');
        setGenerations((prev) => prev.filter((g) => g.id !== id));
        setTotal((prev) => prev - 1);
        if (lightboxItem?.id === id) setLightboxItem(null);
        // Remove from selected if selected
        setGallerySelectedIds(gallerySelectedIds.filter((sid) => sid !== id));
      } catch {
        toast.error('Failed to delete generation');
      } finally {
        setDeletingId(null);
      }
    },
    [lightboxItem, gallerySelectedIds, setGallerySelectedIds]
  );

  // Clear all --------------------------------------------------------------
  const handleClearAll = useCallback(async () => {
    try {
      const deletePromises = generations.map((g) =>
        fetch(`/api/gallery?id=${g.id}`, { method: 'DELETE' })
      );
      await Promise.all(deletePromises);
      toast.success('All generations cleared');
      setGenerations([]);
      setTotal(0);
      setHasMore(false);
    } catch {
      toast.error('Failed to clear all generations');
    }
  }, [generations]);

  // Download ---------------------------------------------------------------
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

  // Double-click to favorite handler
  const handleDoubleClickFav = useCallback(
    (gen: Generation) => {
      if (gallerySelectMode) return; // Don't double-click fav in select mode
      setFavRippleId(gen.id);
      handleFavoriteToggle(gen.id, gen.isFavorite);
      setTimeout(() => setFavRippleId(null), 600);
    },
    [handleFavoriteToggle, gallerySelectMode]
  );

  // Filtered generations by search query (must be defined before callbacks that use it)
  const filteredGenerations = searchQuery
    ? generations.filter((g) => g.prompt.toLowerCase().includes(searchQuery.toLowerCase()))
    : generations;

  // Multi-select handlers --------------------------------------------------
  const toggleSelectItem = useCallback((id: string) => {
    setGallerySelectedIds(
      gallerySelectedIds.includes(id)
        ? gallerySelectedIds.filter((sid) => sid !== id)
        : [...gallerySelectedIds, id]
    );
  }, [gallerySelectedIds, setGallerySelectedIds]);

  const handleSelectAll = useCallback(() => {
    const allIds = filteredGenerations.map((g) => g.id);
    setGallerySelectedIds(allIds);
  }, [filteredGenerations, setGallerySelectedIds]);

  const handleDeselectAll = useCallback(() => {
    setGallerySelectedIds([]);
  }, [setGallerySelectedIds]);

  const handleBatchFavorite = useCallback(async () => {
    const selected = generations.filter((g) => gallerySelectedIds.includes(g.id));
    const toFav = selected.filter((g) => !g.isFavorite);
    const toUnfav = selected.filter((g) => g.isFavorite);
    try {
      const promises = [...toFav, ...toUnfav].map((g) =>
        fetch('/api/gallery', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: g.id, isFavorite: !g.isFavorite }),
        })
      );
      await Promise.all(promises);
      toast.success(`Updated ${gallerySelectedIds.length} items`);
      setGenerations((prev) =>
        prev.map((g) =>
          gallerySelectedIds.includes(g.id) ? { ...g, isFavorite: !g.isFavorite } : g
        )
      );
    } catch {
      toast.error('Failed to update favorites');
    }
  }, [generations, gallerySelectedIds]);

  const handleBatchDownload = useCallback(async () => {
    const selected = generations.filter((g) => gallerySelectedIds.includes(g.id));
    toast.info(`Downloading ${selected.length} items…`);
    for (const gen of selected) {
      const url = getImageUrl(gen);
      if (url) {
        await handleDownload(url, gen.type);
      }
    }
  }, [generations, gallerySelectedIds, handleDownload]);

  const handleBatchDelete = useCallback(async () => {
    try {
      const promises = gallerySelectedIds.map((id) =>
        fetch(`/api/gallery?id=${id}`, { method: 'DELETE' })
      );
      await Promise.all(promises);
      toast.success(`Deleted ${gallerySelectedIds.length} items`);
      setGenerations((prev) => prev.filter((g) => !gallerySelectedIds.includes(g.id)));
      setTotal((prev) => prev - gallerySelectedIds.length);
      setGallerySelectedIds([]);
      setGallerySelectMode(false);
    } catch {
      toast.error('Failed to delete items');
    }
  }, [gallerySelectedIds, setGallerySelectedIds, setGallerySelectMode]);

  const handleBatchAddToCollection = useCallback(async (collectionId: string) => {
    try {
      const promises = gallerySelectedIds.map((genId) =>
        fetch('/api/collections/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collectionId, generationId: genId }),
        })
      );
      await Promise.all(promises);
      toast.success(`Added ${gallerySelectedIds.length} items to collection`);
      setCollections((prev) =>
        prev.map((c) => c.id === collectionId ? { ...c, itemCount: c.itemCount + gallerySelectedIds.length } : c)
      );
      setBatchCollectionOpen(false);
    } catch {
      toast.error('Failed to add to collection');
    }
  }, [gallerySelectedIds]);

  // Exit select mode when filter changes
  useEffect(() => {
    if (gallerySelectMode) {
      setGallerySelectMode(false);
      setGallerySelectedIds([]);
    }
  }, [galleryFilter, setGallerySelectMode, setGallerySelectedIds]);

  // Subtle parallax scroll effect + empty state zoom on scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const cards = container.querySelectorAll('.parallax-slow');
      cards.forEach((card) => {
        const el = card as HTMLElement;
        const rect = el.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const viewportCenter = window.innerHeight / 2;
        const offset = (center - viewportCenter) * 0.015;
        el.style.transform = `translateY(${offset}px)`;
      });

      // Zoom on scroll for empty state floating icon
      const emptyZoom = container.querySelector('.gallery-empty-zoom') as HTMLElement | null;
      if (emptyZoom) {
        const scrollY = container.scrollTop;
        const scale = Math.min(1 + scrollY * 0.001, 1.1);
        emptyZoom.style.transform = `scale(${scale})`;
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Helper: get image URL for a generation ---------------------------------
  const getImageUrl = useCallback((gen: Generation): string | null => {
    if (gen.thumbnailUrl) return gen.thumbnailUrl;
    if (gen.resultUrl) return gen.resultUrl;
    if (gen.resultData) return `data:image/png;base64,${gen.resultData}`;
    return null;
  }, []);

  // Helper: relative time --------------------------------------------------
  const getRelativeTime = useCallback((dateStr: string): string => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return '';
    }
  }, []);

  // Helper: grid columns class ---------------------------------------------
  const getGridColsClass = useCallback(() => {
    return GRID_SIZE_CONFIG[galleryGridSize]?.cols ?? GRID_SIZE_CONFIG.md.cols;
  }, [galleryGridSize]);

  // Card tilt effect handler -----------------------------------------------
  const handleCardMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>, id: string) => {
    const el = cardTiltRefs.current[id];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -4;
    const rotateY = ((x - centerX) / centerX) * 4;
    el.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
  }, []);

  const handleCardMouseLeave = useCallback((id: string) => {
    const el = cardTiltRefs.current[id];
    if (!el) return;
    el.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)';
  }, []);

  // Lightbox navigation ----------------------------------------------------
  const openLightbox = useCallback((gen: Generation) => {
    const idx = filteredGenerations.findIndex((g) => g.id === gen.id);
    setLightboxItem(gen);
    setLightboxIndex(idx);
  }, [filteredGenerations]);

  const navigateLightbox = useCallback((direction: 'prev' | 'next') => {
    if (!filteredGenerations.length) return;
    let newIdx: number;
    if (direction === 'prev') {
      newIdx = lightboxIndex <= 0 ? filteredGenerations.length - 1 : lightboxIndex - 1;
    } else {
      newIdx = lightboxIndex >= filteredGenerations.length - 1 ? 0 : lightboxIndex + 1;
    }
    setLightboxIndex(newIdx);
    setLightboxItem(filteredGenerations[newIdx]);
  }, [filteredGenerations, lightboxIndex]);

  // Keyboard support for lightbox ------------------------------------------
  useEffect(() => {
    if (!lightboxItem) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxItem(null);
      } else if (e.key === 'ArrowLeft') {
        navigateLightbox('prev');
      } else if (e.key === 'ArrowRight') {
        navigateLightbox('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxItem, navigateLightbox]);

  // Load lightbox collection memberships ----------------------------------
  useEffect(() => {
    if (!lightboxItem) return;
    const lbId = lightboxItem.id;
    async function load() {
      try {
        const result = await idb.fetchCollectionItems([lbId]);
        setLightboxCollectionIds((result.items ?? []).map((i) => i.collectionId));
      } catch { /* non-critical */ }
    }
    load();
  }, [lightboxItem]);

  // Collection add/remove handlers -----------------------------------------
  const handleCollectionAdded = useCallback((collectionId: string) => {
    setLightboxCollectionIds((prev) => [...prev, collectionId]);
    setGenCollectionMap((prev) => {
      if (!lightboxItem) return prev;
      const existing = prev[lightboxItem.id] ?? [];
      return { ...prev, [lightboxItem.id]: [...existing, collectionId] };
    });
    setCollections((prev) =>
      prev.map((c) => c.id === collectionId ? { ...c, itemCount: c.itemCount + 1 } : c)
    );
  }, [lightboxItem]);

  const handleCollectionRemoved = useCallback((collectionId: string) => {
    setLightboxCollectionIds((prev) => prev.filter((id) => id !== collectionId));
    setGenCollectionMap((prev) => {
      if (!lightboxItem) return prev;
      const existing = prev[lightboxItem.id] ?? [];
      return { ...prev, [lightboxItem.id]: existing.filter((id) => id !== collectionId) };
    });
    setCollections((prev) =>
      prev.map((c) => c.id === collectionId ? { ...c, itemCount: Math.max(0, c.itemCount - 1) } : c)
    );
  }, [lightboxItem]);

  const handleCollectionCreated = useCallback((collection: CollectionWithCount) => {
    setCollections((prev) => [collection, ...prev]);
  }, []);

  // Copy prompt to clipboard -----------------------------------------------
  const handleCopyPrompt = useCallback(async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success('Prompt copied to clipboard');
    } catch {
      toast.error('Failed to copy prompt');
    }
  }, []);

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="flex h-full flex-col">
      {/* ================================================================== */}
      {/* TOP BAR                                                            */}
      {/* ================================================================== */}
      <div className="glass-strong sticky top-0 z-10 shrink-0">
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          {/* Filter buttons */}
          <div className="flex items-center gap-1.5">
            <Filter className="mr-1 h-4 w-4 text-muted-foreground" />
            {FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={galleryFilter === f.value ? 'default' : 'ghost'}
                size="sm"
                onClick={() => {
                  setGalleryFilter(f.value);
                  if (f.value !== 'collection') {
                    setSelectedCollectionId(null);
                  }
                }}
                className={`transition-all duration-200 ${
                  galleryFilter === f.value
                    ? 'bg-[#d9ff00] text-background hover:bg-[#c5eb00] font-semibold'
                    : 'text-muted-foreground hover:bg-[#d9ff00]/10 hover:text-[#d9ff00]'
                }`}
              >
                {f.icon}
                <span className="hidden sm:inline">{f.label}</span>
              </Button>
            ))}

            {/* Grid size control */}
            <div className="ml-2 flex items-center gap-0.5 border border-border/40 rounded-lg p-0.5">
              {(['sm', 'md', 'lg'] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setGalleryGridSize(size)}
                  className={`flex items-center justify-center h-6 w-6 rounded transition-all duration-200 ${
                    galleryGridSize === size
                      ? 'bg-[#d9ff00] text-background'
                      : 'text-muted-foreground hover:text-[#d9ff00] hover:bg-[#d9ff00]/10'
                  }`}
                  title={`Grid size: ${size.toUpperCase()}`}
                >
                  {GRID_SIZE_CONFIG[size].icon}
                </button>
              ))}
            </div>
          </div>

          {/* Right side: view toggle + select + search + count + actions */}
          <div className="flex items-center gap-3">
            {/* View mode toggle */}
            <div className="flex items-center gap-0.5 border border-border/40 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setGalleryViewMode('grid')}
                className={`flex items-center justify-center h-6 w-6 rounded transition-all duration-200 ${
                  galleryViewMode === 'grid'
                    ? 'bg-[#d9ff00] text-background'
                    : 'text-muted-foreground hover:text-[#d9ff00] hover:bg-[#d9ff00]/10'
                }`}
                title="Grid view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setGalleryViewMode('list')}
                className={`flex items-center justify-center h-6 w-6 rounded transition-all duration-200 ${
                  galleryViewMode === 'list'
                    ? 'bg-[#d9ff00] text-background'
                    : 'text-muted-foreground hover:text-[#d9ff00] hover:bg-[#d9ff00]/10'
                }`}
                title="List view"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setGalleryViewMode('timeline')}
                className={`flex items-center justify-center h-6 w-6 rounded transition-all duration-200 ${
                  galleryViewMode === 'timeline'
                    ? 'bg-[#d9ff00] text-background'
                    : 'text-muted-foreground hover:text-[#d9ff00] hover:bg-[#d9ff00]/10'
                }`}
                title="Timeline view"
              >
                <GitBranch className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Select mode toggle */}
            {filteredGenerations.length > 0 && (
              gallerySelectMode ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setGallerySelectMode(false);
                    setGallerySelectedIds([]);
                  }}
                  className="gap-1.5 text-[#d9ff00] hover:bg-[#d9ff00]/10"
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Exit Select</span>
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setGallerySelectMode(true)}
                  className="gap-1.5 text-muted-foreground hover:text-[#d9ff00] hover:bg-[#d9ff00]/10"
                >
                  <MousePointerSquareDashed className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Select</span>
                </Button>
              )
            )}

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search prompts…"
                className="h-8 w-36 rounded-lg border-border/40 bg-surface pl-8 pr-7 text-xs placeholder:text-muted-foreground/50 focus-visible:ring-[#d9ff00]/30"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {searchQuery
                ? `${filteredGenerations.length} results`
                : `${total} ${total === 1 ? 'item' : 'items'}`}
            </span>

            {/* Stats toggle */}
            {stats && stats.totalGenerations > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowStats(!showStats)}
                className={`gap-1.5 ${showStats ? 'text-[#d9ff00]' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Stats</span>
              </Button>
            )}

            {generations.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-destructive"
                  >
                    <Trash className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Clear All</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="glass-strong border-border/60 bg-[#111111]">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all generations?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all {total} generation{total !== 1 ? 's' : ''}. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-border/60 bg-surface">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClearAll}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      Delete All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* New Collection button */}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-[#d9ff00]"
              onClick={() => setShowNewCollectionDialog(true)}
            >
              <FolderPlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Collection</span>
            </Button>
          </div>
        </div>

        <Separator className="opacity-30" />

        {/* Collections strip — shown when "Collections" filter is active */}
        <AnimatePresence>
          {galleryFilter === 'collection' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-b border-border/30 bg-surface/20"
            >
              <div className="flex items-center gap-2 px-5 py-2 overflow-x-auto scrollbar-none">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 shrink-0 text-[#d9ff00] hover:bg-[#d9ff00]/10 text-xs h-7 px-2"
                  onClick={() => setShowNewCollectionDialog(true)}
                >
                  <Plus className="h-3 w-3" />
                  New
                </Button>
                {collections.length === 0 ? (
                  <span className="text-xs text-muted-foreground/50">No collections yet — create one to organize your items</span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedCollectionId(null)}
                      className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 border ${
                        !selectedCollectionId
                          ? 'bg-[#d9ff00]/20 border-[#d9ff00]/40 text-[#d9ff00] shadow-[0_0_8px_rgba(217,255,0,0.1)]'
                          : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:text-foreground'
                      }`}
                    >
                      <FolderOpen className="h-3 w-3" />
                      All
                    </button>
                    {collections.map((col) => (
                      <motion.button
                        key={col.id}
                        type="button"
                        onClick={() => setSelectedCollectionId(col.id === selectedCollectionId ? null : col.id)}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 border ${
                          selectedCollectionId === col.id
                            ? 'shadow-[0_0_10px_rgba(217,255,0,0.1)]'
                            : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:text-foreground'
                        }`}
                        style={
                          selectedCollectionId === col.id
                            ? { backgroundColor: `${col.color}20`, borderColor: `${col.color}40`, color: col.color }
                            : undefined
                        }
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: col.color }}
                        />
                        {col.name}
                        <span className="text-[9px] opacity-60">({col.itemCount})</span>
                      </motion.button>
                    ))}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ================================================================== */}
      {/* STATS BAR                                                          */}
      {/* ================================================================== */}
      <AnimatePresence>
        {showStats && stats && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-b border-border/30 bg-surface/20"
          >
            <div className="px-5 py-3 space-y-3">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#d9ff00]/10">
                    <TrendingUp className="h-3.5 w-3.5 text-[#d9ff00]" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
                    <p className="text-sm font-bold text-foreground">{stats.totalGenerations}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10">
                    <ImageIcon className="h-3.5 w-3.5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Images</p>
                    <p className="text-sm font-bold text-foreground">{stats.totalImages}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10">
                    <VideoIcon className="h-3.5 w-3.5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Videos</p>
                    <p className="text-sm font-bold text-foreground">{stats.totalVideos}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-500/10">
                    <Heart className="h-3.5 w-3.5 text-pink-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Favorites</p>
                    <p className="text-sm font-bold text-foreground">{stats.totalFavorites}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/10">
                    <Sparkles className="h-3.5 w-3.5 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">This Week</p>
                    <p className="text-sm font-bold text-foreground">{stats.recentCount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
                    <Clock className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg/Day</p>
                    <p className="text-sm font-bold text-foreground">{stats.avgPerDay}</p>
                  </div>
                </div>
              </div>

              {(stats.topProviders.length > 0 || stats.topModels.length > 0) && (
                <div className="flex items-center gap-4 flex-wrap text-[10px] text-muted-foreground">
                  {stats.topProviders.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="uppercase tracking-wider font-medium">Providers:</span>
                      {stats.topProviders.map((tp) => (
                        <Badge
                          key={tp.providerId}
                          className="gap-1 border-0 text-[9px] font-medium"
                          style={{
                            backgroundColor: `${tp.provider?.color || '#888'}15`,
                            color: tp.provider?.color || '#888',
                          }}
                        >
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: tp.provider?.color || '#888' }}
                          />
                          {tp.provider?.displayName || 'Unknown'} ({tp.count})
                        </Badge>
                      ))}
                    </div>
                  )}
                  {stats.topModels.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="uppercase tracking-wider font-medium">Models:</span>
                      {stats.topModels.map((tm) => (
                        <Badge
                          key={tm.modelId}
                          variant="secondary"
                          className="border-0 bg-white/5 text-[9px] text-muted-foreground"
                        >
                          {tm.modelId} ({tm.count})
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================================================================== */}
      {/* TIMELINE VIEW                                                      */}
      {/* ================================================================== */}
      {galleryViewMode === 'timeline' && (
        <TimelineView onOpenLightbox={openLightbox} />
      )}

      {/* ================================================================== */}
      {/* GRID / CONTENT AREA                                                */}
      {/* ================================================================== */}
      {galleryViewMode !== 'timeline' && (
      <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
        <ScrollArea className="h-full">
          <div className="p-4 md:p-5">
            {/* --- Empty State --- */}
            {filteredGenerations.length === 0 && !loading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex min-h-[60vh] flex-col items-center justify-center gap-8 text-center w-full max-w-2xl mx-auto relative"
              >
                <div className="absolute inset-0 -m-8 rounded-3xl bg-gradient-to-br from-[#d9ff00]/5 via-transparent to-[#d9ff00]/3 animate-empty-gradient pointer-events-none" />
                <div className="absolute inset-0 -m-8 rounded-3xl bg-gradient-to-tl from-transparent via-[#d9ff00]/2 to-[#d9ff00]/4 animate-empty-gradient pointer-events-none" style={{ animationDelay: '4s' }} />

                <div className="relative z-10 gallery-empty-zoom">
                  <div className="absolute -inset-6 rounded-full bg-[#d9ff00]/5 blur-3xl animate-empty-glow" />
                  <motion.div
                    animate={{ y: [0, -12, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    className="relative flex h-32 w-32 items-center justify-center rounded-3xl border border-[#d9ff00]/20 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-sm shadow-[0_0_40px_rgba(217,255,0,0.08)]"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.08, 1], rotate: [0, 3, -3, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <LayoutGrid className="h-14 w-14 text-[#d9ff00]/70" />
                    </motion.div>
                  </motion.div>
                </div>

                <div className="relative z-10">
                  <h3 className="text-2xl font-bold text-foreground tracking-tight">
                    Your creative gallery
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground max-w-md leading-relaxed">
                    All your AI-generated images and videos will appear here. Start creating to fill your gallery.
                  </p>
                </div>

                <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white/5 border border-white/10 rounded-xl p-4 text-left hover:border-[#d9ff00]/20 hover:bg-white/[0.07] transition-all group cursor-default"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <LayoutGrid className="h-4 w-4 text-[#d9ff00]" />
                      <span className="text-xs font-semibold text-foreground group-hover:text-[#d9ff00] transition-colors">Smart Gallery</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">Browse all your AI generations in one place</p>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="bg-white/5 border border-white/10 rounded-xl p-4 text-left hover:border-[#d9ff00]/20 hover:bg-white/[0.07] transition-all group cursor-default"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Zap className="h-4 w-4 text-[#d9ff00]" />
                      <span className="text-xs font-semibold text-foreground group-hover:text-[#d9ff00] transition-colors">Quick Actions</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70 leading-relaxed">Download, favorite, and share with one click</p>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-white/5 border border-white/10 rounded-xl p-4 text-left hover:border-[#d9ff00]/20 hover:bg-white/[0.07] transition-all group cursor-default"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Search className="h-4 w-4 text-[#d9ff00]" />
                      <span className="text-xs font-semibold text-foreground group-hover:text-[#d9ff00] transition-colors">Advanced Search</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70 leading-relaxed">Find any generation by prompt or model</p>
                  </motion.div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.65 }}
                  className="relative z-10"
                >
                  <Button
                    onClick={() => useAppStore.getState().setActiveTab('image')}
                    className="gap-2 bg-[#d9ff00] text-background hover:bg-[#c5eb00] font-semibold rounded-xl px-6 h-11 shadow-[0_0_20px_rgba(217,255,0,0.2)] hover:shadow-[0_0_30px_rgba(217,255,0,0.3)] transition-all duration-200 animate-pulse-glow"
                  >
                    <Sparkles className="h-4 w-4" />
                    Start Creating
                  </Button>
                </motion.div>
              </motion.div>
            )}

            {/* --- Loading Skeleton --- */}
            {loading && (
              <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass overflow-hidden rounded-xl"
                  >
                    <div className="aspect-square animate-pulse bg-surface-hover" />
                    <div className="space-y-2 p-3">
                      <div className="h-3 w-3/4 animate-pulse rounded bg-surface-hover" />
                      <div className="h-2.5 w-1/2 animate-pulse rounded bg-surface-hover" />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* --- LIST VIEW --- */}
            {!loading && galleryViewMode === 'list' && filteredGenerations.length > 0 && (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="flex flex-col gap-2"
              >
                <AnimatePresence mode="popLayout">
                  {filteredGenerations.map((gen) => {
                    const imageUrl = getImageUrl(gen);
                    const providerColor = gen.provider?.color || '#888';
                    const isSelected = gallerySelectMode && gallerySelectedIds.includes(gen.id);
                    const isDeleting = deletingId === gen.id;

                    return (
                      <motion.div
                        key={gen.id}
                        variants={cardVariants}
                        exit="exit"
                        layout
                        onClick={() => {
                          if (gallerySelectMode) toggleSelectItem(gen.id);
                        }}
                        className={`group flex items-center gap-4 rounded-xl p-3 transition-all duration-200 cursor-default ${
                          isSelected
                            ? 'bg-[#d9ff00]/10 border border-[#d9ff00]/40 shadow-[0_0_12px_rgba(217,255,0,0.1)]'
                            : 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/10'
                        } ${gallerySelectMode ? 'cursor-pointer' : ''}`}
                      >
                        {/* Checkbox in select mode */}
                        {gallerySelectMode && (
                          <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all duration-200 ${
                            isSelected
                              ? 'bg-[#d9ff00] border-[#d9ff00] text-background'
                              : 'border-white/20 bg-transparent'
                          }`}>
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                        )}

                        {/* Thumbnail */}
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={gen.prompt}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                              loading="lazy"
                            />
                          ) : gen.type === 'video' ? (
                            <div className="flex h-full w-full items-center justify-center">
                              <Film className="h-6 w-6 text-muted-foreground/30" />
                            </div>
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="line-clamp-1 text-sm text-foreground/90 truncate">{gen.prompt}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: providerColor }}
                            />
                            <span className="text-[11px] text-muted-foreground/70">{gen.provider?.displayName || 'Unknown'}</span>
                            {gen.modelId && (
                              <span className="text-[11px] text-muted-foreground/50">· {gen.modelId}</span>
                            )}
                          </div>
                        </div>

                        {/* Time */}
                        <span className="hidden sm:block text-[11px] text-muted-foreground/50 shrink-0">
                          {getRelativeTime(gen.createdAt)}
                        </span>

                        {/* Actions */}
                        {!gallerySelectMode && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0">
                            <button
                              type="button"
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFavoriteToggle(gen.id, gen.isFavorite);
                              }}
                              title={gen.isFavorite ? 'Unfavorite' : 'Favorite'}
                            >
                              <Heart className={`h-3.5 w-3.5 ${gen.isFavorite ? 'fill-[#d9ff00] text-[#d9ff00]' : ''}`} />
                            </button>
                            <button
                              type="button"
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyPrompt(gen.prompt);
                              }}
                              title="Copy prompt"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            {imageUrl && (
                              <button
                                type="button"
                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(imageUrl, gen.type);
                                }}
                                title="Download"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                              disabled={isDeleting}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(gen.id);
                              }}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}

                        {/* Type badge */}
                        <Badge className="shrink-0 gap-1 bg-white/5 border-0 text-[10px] text-muted-foreground">
                          {gen.type === 'video' ? <VideoIcon className="h-2.5 w-2.5" /> : <ImageIcon className="h-2.5 w-2.5" />}
                          {gen.type === 'video' ? 'Video' : 'Image'}
                        </Badge>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}

            {/* --- Generation Grid (Masonry-like with CSS columns) --- */}
            {!loading && galleryViewMode === 'grid' && filteredGenerations.length > 0 && (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className={`${getGridColsClass()} gap-3 md:gap-4`}
              >
                <AnimatePresence mode="popLayout">
                  {filteredGenerations.map((gen, idx) => {
                    const imageUrl = getImageUrl(gen);
                    const providerColor = gen.provider?.color || '#888';
                    const isDeleting = deletingId === gen.id;
                    const cardHeight = gen.id.charCodeAt(gen.id.length - 1) % 3;
                    const isNew = Date.now() - new Date(gen.createdAt).getTime() < 5 * 60 * 1000;
                    const isSelected = gallerySelectMode && gallerySelectedIds.includes(gen.id);
                    const hasShimmer = shimmerIds.has(gen.id);

                    return (
                      <motion.div
                        key={gen.id}
                        variants={cardVariants}
                        exit="exit"
                        layout
                        custom={idx}
                        className="mb-3 md:mb-4 break-inside-avoid"
                        onDoubleClick={() => handleDoubleClickFav(gen)}
                      >
                        <div
                          ref={(el) => { cardTiltRefs.current[gen.id] = el; }}
                          onMouseMove={(e) => handleCardMouseMove(e, gen.id)}
                          onMouseLeave={() => handleCardMouseLeave(gen.id)}
                          className={`gallery-card card-hover-lift group relative overflow-hidden rounded-xl parallax-slow transition-all duration-300 ${
                            gen.isFavorite ? 'gallery-card-favorite' : ''
                          } ${favRippleId === gen.id ? 'fav-ripple' : ''} ${
                            isSelected ? 'ring-2 ring-[#d9ff00] shadow-[0_0_16px_rgba(217,255,0,0.2)]' : ''
                          }`}
                          style={{ transitionProperty: 'transform, box-shadow, ring-color' }}
                          onClick={() => {
                            if (gallerySelectMode) {
                              toggleSelectItem(gen.id);
                            }
                          }}
                        >
                          {/* Shimmer effect on load */}
                          {hasShimmer && (
                            <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden rounded-xl">
                              <div
                                className="absolute inset-0 card-shimmer-sweep"
                                style={{
                                  background: 'linear-gradient(90deg, transparent, rgba(217,255,0,0.12), transparent)',
                                }}
                              />
                            </div>
                          )}

                          {/* Selection checkmark overlay */}
                          {gallerySelectMode && (
                            <div className={`absolute top-2 right-2 z-30 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                              isSelected
                                ? 'bg-[#d9ff00] border-[#d9ff00] text-background scale-100'
                                : 'bg-black/40 border-white/30 backdrop-blur-sm scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100'
                            }`}>
                              {isSelected && <Check className="h-3.5 w-3.5" />}
                            </div>
                          )}

                          {/* Thumbnail area */}
                          <button
                            type="button"
                            onClick={() => {
                              if (!gallerySelectMode && imageUrl) openLightbox(gen);
                            }}
                            className={`relative block w-full ${gallerySelectMode ? 'cursor-pointer' : 'cursor-zoom-in'} overflow-hidden`}
                          >
                            <div className={`${cardHeight === 0 ? 'gallery-card-tall' : cardHeight === 1 ? 'gallery-card-standard' : 'gallery-card-wide'} bg-surface`}>
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={gen.prompt}
                                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                                  loading="lazy"
                                />
                              ) : gen.type === 'video' ? (
                                <div className="flex h-full w-full items-center justify-center bg-surface">
                                  <Film className="h-10 w-10 text-muted-foreground/30" />
                                </div>
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-surface">
                                  <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                                </div>
                              )}
                            </div>

                            {/* Gradient overlay at bottom */}
                            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none" />

                            {/* Type badge overlay */}
                            <div className="absolute left-2 top-2">
                              {gen.type === 'video' ? (
                                <Badge className="gap-1 bg-black/60 text-white backdrop-blur-sm border-0 text-[10px]">
                                  <VideoIcon className="h-3 w-3" />
                                  Video
                                </Badge>
                              ) : (
                                <Badge className="gap-1 bg-black/60 text-white backdrop-blur-sm border-0 text-[10px]">
                                  <ImageIcon className="h-3 w-3" />
                                  Image
                                </Badge>
                              )}
                            </div>

                            {/* Favorite heart - always visible for favorited items */}
                            {gen.isFavorite && !gallerySelectMode && (
                              <div className="absolute right-2 top-2">
                                <motion.div
                                  initial={favBounceId === gen.id ? { scale: 0 } : undefined}
                                  animate={favBounceId === gen.id ? { scale: [0, 1.3, 1] } : {}}
                                  transition={{ duration: 0.35, ease: 'easeOut' }}
                                  className="relative"
                                >
                                  <Heart className="h-4 w-4 fill-[#d9ff00] text-[#d9ff00] drop-shadow-lg" />
                                  <ParticleBurst active={favBounceId === gen.id} />
                                </motion.div>
                              </div>
                            )}

                            {/* New badge */}
                            {isNew && !gen.isFavorite && !gallerySelectMode && (
                              <div className="absolute right-2 top-2 slide-up-enter">
                                <Badge className="gap-1 bg-[#d9ff00] text-background border-0 text-[9px] font-bold px-1.5 py-0 shadow-md shadow-[#d9ff00]/20">
                                  NEW
                                </Badge>
                              </div>
                            )}

                            {/* Floating action toolbar on hover */}
                            {!gallerySelectMode && (
                              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-end gap-1 opacity-0 translate-y-2 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0">
                                <button
                                  type="button"
                                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleFavoriteToggle(gen.id, gen.isFavorite);
                                  }}
                                  title={gen.isFavorite ? 'Unfavorite' : 'Favorite'}
                                >
                                  <Heart
                                    className={`h-3.5 w-3.5 ${
                                      gen.isFavorite
                                        ? 'fill-[#d9ff00] text-[#d9ff00]'
                                        : 'text-white hover:text-[#d9ff00]'
                                    }`}
                                  />
                                </button>
                                <button
                                  type="button"
                                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyPrompt(gen.prompt);
                                  }}
                                  title="Copy prompt"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                                {imageUrl && (
                                  <button
                                    type="button"
                                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownload(imageUrl, gen.type);
                                    }}
                                    title="Download"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur-sm hover:bg-destructive/80 transition-colors"
                                  disabled={isDeleting}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(gen.id);
                                  }}
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </button>

                          {/* Card info */}
                          <div className="p-3">
                            <p className="line-clamp-2 text-xs leading-relaxed text-foreground/80" title={gen.prompt}>
                              {gen.prompt}
                            </p>

                            <div className="mt-2 flex items-center gap-1.5">
                              <Badge
                                className="gap-1 border-0 px-1.5 py-0 text-[9px] font-medium"
                                style={{
                                  backgroundColor: `${providerColor}15`,
                                  color: providerColor,
                                }}
                              >
                                <span
                                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: providerColor }}
                                />
                                {gen.provider?.displayName || 'Unknown'}
                              </Badge>
                              {gen.modelId && (
                                <span className="truncate text-[9px] text-muted-foreground/60">
                                  {gen.modelId}
                                </span>
                              )}
                            </div>

                            <div className="mt-1.5 flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5 text-muted-foreground/40" />
                              <span className="text-[10px] text-muted-foreground/50">
                                {getRelativeTime(gen.createdAt)}
                              </span>
                            </div>

                            {genCollectionMap[gen.id] && genCollectionMap[gen.id].length > 0 && (
                              <div className="mt-1 flex items-center gap-1">
                                {genCollectionMap[gen.id].map((colId) => {
                                  const col = collections.find((c) => c.id === colId);
                                  return col ? (
                                    <span
                                      key={colId}
                                      className="h-2 w-2 rounded-full"
                                      style={{ backgroundColor: col.color }}
                                      title={col.name}
                                    />
                                  ) : null;
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}

            {/* --- Load More Skeleton (additional pages) --- */}
            {loadingMore && (
              <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-3 lg:grid-cols-4 mt-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <motion.div
                    key={`more-skeleton-${i}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass overflow-hidden rounded-xl"
                  >
                    <div className="aspect-square animate-pulse bg-surface-hover" />
                    <div className="space-y-2 p-3">
                      <div className="h-3 w-3/4 animate-pulse rounded bg-surface-hover" />
                      <div className="h-2.5 w-1/2 animate-pulse rounded bg-surface-hover" />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* --- Load More Button & Infinite Scroll Sentinel --- */}
            {!loading && hasMore && (
              <div className="mt-6 flex flex-col items-center gap-3">
                <Button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="group gap-2 bg-[#d9ff00]/10 text-[#d9ff00] hover:bg-[#d9ff00]/20 border border-[#d9ff00]/20 hover:border-[#d9ff00]/40 font-semibold rounded-xl px-6 h-10 transition-all duration-200 hover:shadow-[0_0_20px_rgba(217,255,0,0.15)]"
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 transition-transform duration-300 group-hover:rotate-180" />
                  )}
                  {loadingMore ? 'Loading…' : 'Load More'}
                </Button>

                <p className="text-[11px] text-muted-foreground/40">
                  Showing {generations.length} of {total} items
                </p>

                <div ref={loadMoreRef} className="h-4" />
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
      )}

      {/* ================================================================== */}
      {/* MULTI-SELECT FLOATING ACTION BAR                                   */}
      {/* ================================================================== */}
      <AnimatePresence>
        {gallerySelectMode && gallerySelectedIds.length > 0 && (
          <motion.div
            variants={floatingBarVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
          >
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#111111]/90 backdrop-blur-xl px-4 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] shadow-[#d9ff00]/5">
              {/* Selected count */}
              <div className="flex items-center gap-1.5 pr-3 border-r border-white/10">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#d9ff00] text-background text-[10px] font-bold">
                  {gallerySelectedIds.length}
                </div>
                <span className="text-xs text-foreground/80 font-medium">selected</span>
              </div>

              {/* Select all */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="gap-1.5 text-muted-foreground hover:text-[#d9ff00] hover:bg-[#d9ff00]/10 h-8 px-2.5 text-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">All</span>
              </Button>

              {/* Download All */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBatchDownload}
                className="gap-1.5 text-muted-foreground hover:text-[#d9ff00] hover:bg-[#d9ff00]/10 h-8 px-2.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Download</span>
              </Button>

              {/* Add to Collection */}
              <Popover open={batchCollectionOpen} onOpenChange={setBatchCollectionOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-[#d9ff00] hover:bg-[#d9ff00]/10 h-8 px-2.5 text-xs"
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Collection</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 glass-strong border-border/60 bg-[#111111]/95 p-2" align="end">
                  <div className="space-y-1">
                    <p className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Add to collection</p>
                    {collections.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-muted-foreground/50">No collections yet</p>
                    ) : (
                      collections.map((col) => (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => handleBatchAddToCollection(col.id)}
                          className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-xs text-foreground/80 hover:bg-white/5 transition-colors"
                        >
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: col.color }} />
                          {col.name}
                          <span className="ml-auto text-[9px] text-muted-foreground/50">({col.itemCount})</span>
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Favorite All */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBatchFavorite}
                className="gap-1.5 text-muted-foreground hover:text-[#d9ff00] hover:bg-[#d9ff00]/10 h-8 px-2.5 text-xs"
              >
                <Heart className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Favorite</span>
              </Button>

              {/* Delete All */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 px-2.5 text-xs"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="glass-strong border-border/60 bg-[#111111]">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {gallerySelectedIds.length} items?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete {gallerySelectedIds.length} selected generation{gallerySelectedIds.length !== 1 ? 's' : ''}. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-border/60 bg-surface">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleBatchDelete}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      Delete {gallerySelectedIds.length} Items
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Deselect All */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeselectAll}
                className="gap-1.5 text-muted-foreground hover:text-foreground hover:bg-white/5 h-8 px-2.5 text-xs"
              >
                <X className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================================================================== */}
      {/* LIGHTBOX DIALOG                                                    */}
      {/* ================================================================== */}
      <Dialog
        open={!!lightboxItem}
        onOpenChange={(open) => {
          if (!open) setLightboxItem(null);
        }}
      >
        <DialogContent
          className="glass-dialog max-w-4xl border-border/40 bg-[#0a0a0a]/95 p-0 sm:max-w-5xl backdrop-blur-2xl lightbox-zoom-enter"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Generation detail view</DialogTitle>
          <DialogDescription className="sr-only">View generation details and actions</DialogDescription>
          {lightboxItem && (
            <div className="relative flex flex-col">
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 top-3 z-10 h-8 w-8 rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 hover:text-white"
                onClick={() => setLightboxItem(null)}
              >
                <X className="h-4 w-4" />
              </Button>

              {/* Navigation arrows */}
              {filteredGenerations.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 hover:text-white transition-colors"
                    onClick={() => navigateLightbox('prev')}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 hover:text-white transition-colors"
                    onClick={() => navigateLightbox('next')}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              )}

              {/* Image */}
              <div className="overflow-hidden rounded-t-xl">
                {getImageUrl(lightboxItem) ? (
                  <img
                    src={getImageUrl(lightboxItem)!}
                    alt={lightboxItem.prompt}
                    className="w-full max-h-[70vh] object-contain bg-black/40 lightbox-image-zoom"
                  />
                ) : lightboxItem.type === 'video' ? (
                  <div className="flex h-64 items-center justify-center bg-black/40">
                    <VideoIcon className="h-16 w-16 text-muted-foreground/20" />
                  </div>
                ) : (
                  <div className="flex h-64 items-center justify-center bg-black/40">
                    <ImageIcon className="h-16 w-16 text-muted-foreground/20" />
                  </div>
                )}
              </div>

              {/* Info panel */}
              <div className="space-y-4 p-5">
                {/* Prompt */}
                <p className="text-sm leading-relaxed text-foreground/90">{lightboxItem.prompt}</p>

                {/* Copy prompt */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyPrompt(lightboxItem.prompt)}
                  className="gap-1.5 text-muted-foreground hover:text-[#d9ff00] text-xs"
                >
                  <Copy className="h-3 w-3" />
                  Copy Prompt
                </Button>

                {/* Metadata */}
                <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                  <Badge
                    className="gap-1 border-0 px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: `${lightboxItem.provider?.color || '#888'}20`,
                      color: lightboxItem.provider?.color || '#888',
                    }}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: lightboxItem.provider?.color || '#888' }}
                    />
                    {lightboxItem.provider?.displayName || 'Unknown'}
                  </Badge>
                  {lightboxItem.modelId && (
                    <Badge variant="secondary" className="border-0 bg-white/5 text-xs">
                      {lightboxItem.modelId}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="border-0 bg-white/5 gap-1 text-xs">
                    {lightboxItem.type === 'video' ? <VideoIcon className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                    {lightboxItem.type === 'video' ? 'Video' : 'Image'}
                  </Badge>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {getRelativeTime(lightboxItem.createdAt)}
                  </span>
                  {filteredGenerations.length > 1 && (
                    <span className="text-muted-foreground/50">
                      {lightboxIndex + 1} / {filteredGenerations.length}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleFavoriteToggle(lightboxItem.id, lightboxItem.isFavorite)}
                    className="gap-1.5 border-border/40 bg-surface/50 text-xs"
                  >
                    <Heart className={`h-3.5 w-3.5 ${lightboxItem.isFavorite ? 'fill-[#d9ff00] text-[#d9ff00]' : ''}`} />
                    {lightboxItem.isFavorite ? 'Unfavorite' : 'Favorite'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyPrompt(lightboxItem.prompt)}
                    className="gap-1.5 border-border/40 bg-surface/50 text-xs"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy Prompt
                  </Button>
                  {getImageUrl(lightboxItem) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(getImageUrl(lightboxItem)!, lightboxItem.type)}
                      className="gap-1.5 border-border/40 bg-surface/50 text-xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-border/40 bg-surface/50 text-destructive hover:bg-destructive/10 text-xs"
                        disabled={deletingId === lightboxItem.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="glass-strong border-border/60 bg-[#111111]">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this generation?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-border/60 bg-surface">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(lightboxItem.id)}
                          className="bg-destructive text-white hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  {/* Add to collection */}
                  <AddToCollectionPopover
                    collections={collections}
                    generationCollections={lightboxCollectionIds}
                    generationId={lightboxItem!.id}
                    onAdded={handleCollectionAdded}
                    onRemoved={handleCollectionRemoved}
                  />
                </div>

                {/* Continue Customizing — post-gen actions for images */}
                {lightboxItem.type === 'image' && getImageUrl(lightboxItem) && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <Wand2 className="h-3.5 w-3.5 text-[#d9ff00]" />
                      <span className="text-xs font-semibold text-[#d9ff00] uppercase tracking-wider">Continue Customizing</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-border/40 bg-surface/50 text-xs"
                        onClick={() => {
                          const { setInputImageUrl, setImagePrompt } = useAppStore.getState();
                          setInputImageUrl(getImageUrl(lightboxItem)!);
                          setImagePrompt(lightboxItem.prompt);
                          useAppStore.getState().setActiveTab('image');
                        }}
                      >
                        <Maximize2 className="h-3 w-3" />
                        Upscale
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-border/40 bg-surface/50 text-xs"
                        onClick={() => {
                          const { setInputImageUrl, setImagePrompt } = useAppStore.getState();
                          setInputImageUrl(getImageUrl(lightboxItem)!);
                          setImagePrompt(lightboxItem.prompt);
                          useAppStore.getState().setActiveTab('image');
                        }}
                      >
                        <Layers className="h-3 w-3" />
                        Variations
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-border/40 bg-surface/50 text-xs"
                        onClick={() => {
                          const { setInputImageUrl, setImagePrompt } = useAppStore.getState();
                          setInputImageUrl(getImageUrl(lightboxItem)!);
                          setImagePrompt(`Enhanced, improved quality: ${lightboxItem.prompt}`);
                          useAppStore.getState().setActiveTab('image');
                        }}
                      >
                        <Wand2 className="h-3 w-3" />
                        Improve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-border/40 bg-surface/50 text-xs"
                        onClick={() => {
                          const { setVideoPrompt } = useAppStore.getState();
                          setVideoPrompt(lightboxItem.prompt);
                          useAppStore.getState().setActiveTab('video');
                        }}
                      >
                        <Film className="h-3 w-3" />
                        To Video
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-border/40 bg-surface/50 text-xs"
                        onClick={() => {
                          const { setInputImageUrl, setImagePrompt } = useAppStore.getState();
                          setInputImageUrl(getImageUrl(lightboxItem)!);
                          setImagePrompt(lightboxItem.prompt);
                          useAppStore.getState().setActiveTab('image');
                        }}
                      >
                        <Paintbrush className="h-3 w-3" />
                        Inpaint
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* NEW COLLECTION DIALOG                                              */}
      {/* ================================================================== */}
      <NewCollectionDialog
        open={showNewCollectionDialog}
        onOpenChange={setShowNewCollectionDialog}
        onCreated={handleCollectionCreated}
      />
    </div>
  );
}
