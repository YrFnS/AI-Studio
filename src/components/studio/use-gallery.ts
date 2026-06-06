'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

import { useAppStore } from '@/lib/store';
import type { Generation } from '@/lib/types';
import * as data from '@/lib/data';

import {
  PAGE_SIZE,
  GRID_SIZE_CONFIG,
  getImageUrl,
  type GalleryStats,
} from './gallery-types';
import type { CardActions } from './gallery-card';
import { downloadFile, copyToClipboard } from './gallery-utils';
import { useGalleryCollections } from './use-gallery-collections';

export interface UseGalleryReturn {
  generations: Generation[];
  total: number;
  stats: GalleryStats | null;
  collections: ReturnType<typeof useGalleryCollections>['collections'];
  filteredGenerations: Generation[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  deletingId: string | null;
  showStats: boolean;
  setShowStats: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  searchInputRef: (node: HTMLInputElement | null) => void;
  lightboxItem: Generation | null;
  setLightboxItem: (v: Generation | null) => void;
  lightboxIndex: number;
  setLightboxIndex: (v: number) => void;
  lightboxCollectionIds: string[];
  showNewCollectionDialog: boolean;
  setShowNewCollectionDialog: (v: boolean) => void;
  genCollectionMap: Record<string, string[]>;
  batchCollectionOpen: boolean;
  setBatchCollectionOpen: (v: boolean) => void;
  favRippleId: string | null;
  favBounceId: string | null;
  shimmerIds: Set<string>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
  cardTiltRefs: React.RefObject<Record<string, HTMLDivElement | null>>;
  getGridColsClass: () => string;
  cardActions: CardActions;
  handleCollectionAdded: (collectionId: string) => void;
  handleCollectionRemoved: (collectionId: string) => void;
  handleCollectionCreated: (collection: ReturnType<typeof useGalleryCollections>['collections'][number]) => void;
  handleSelectAll: () => void;
  handleDeselectAll: () => void;
  handleBatchFavorite: () => Promise<void>;
  handleBatchDownload: () => Promise<void>;
  handleBatchDelete: () => Promise<void>;
  handleBatchAddToCollection: (collectionId: string) => Promise<void>;
  handleClearAll: () => Promise<void>;
  handleLoadMore: () => void;
}

export function useGallery(): UseGalleryReturn {
  const {
    galleryFilter, setGalleryFilter, selectedCollectionId, setSelectedCollectionId,
    galleryViewMode, setGalleryViewMode, galleryGridSize, setGalleryGridSize,
    gallerySelectMode, setGallerySelectMode, gallerySelectedIds, setGallerySelectedIds,
  } = useAppStore();

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
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const {
    collections,
    showNewCollectionDialog,
    setShowNewCollectionDialog,
    lightboxCollectionIds,
    genCollectionMap,
    batchCollectionOpen,
    setBatchCollectionOpen,
    handleCollectionAdded,
    handleCollectionRemoved,
    handleCollectionCreated,
    handleBatchAddToCollection,
  } = useGalleryCollections({
    generations,
    lightboxItem,
    gallerySelectedIds,
  });

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

  // Fetch generations from IndexedDB
  const fetchGenerations = useCallback(async (pageNum: number, append = false) => {
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);

      const result = await data.fetchGenerations({
        filter: (galleryFilter === 'collection' ? 'all' : galleryFilter) as 'all' | 'image' | 'video' | 'favorite',
        collectionId: galleryFilter === 'collection' ? selectedCollectionId || undefined : undefined,
        page: pageNum,
        limit: PAGE_SIZE,
      });

      const mapped = result.generations.map((g) => ({
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

      if (append) {
        setGenerations((prev) => [...prev, ...mapped]);
      } else {
        setGenerations(mapped);
      }
      setTotal(result.total);
      setHasMore(result.hasMore);
    } catch {
      toast.error('Failed to load gallery');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [galleryFilter, selectedCollectionId]);

  useEffect(() => {
    setPage(1);
    fetchGenerations(1, false);
  }, [fetchGenerations]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchGenerations(nextPage, true);
  }, [loadingMore, hasMore, page, fetchGenerations]);

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

  // Fetch stats from IndexedDB
  useEffect(() => {
    async function loadStats() {
      try {
        const s = await data.fetchStats();
        setStats({
          totalGenerations: s.totalGenerations,
          totalImages: s.totalImages,
          totalVideos: s.totalVideos,
          totalFavorites: s.totalFavorites,
          topProviders: [],
          topModels: [],
          recentCount: s.recentCount,
          avgPerDay: s.avgPerDay,
        });
      } catch { /* non-critical */ }
    }
    loadStats();
  }, [generations]);

  // Favorite toggle — update in IndexedDB
  const handleFavoriteToggle = useCallback(
    async (id: string, currentFavorite: boolean) => {
      try {
        await data.toggleGenerationFavorite(id, !currentFavorite);
        toast.success(currentFavorite ? 'Removed from favorites' : 'Added to favorites');
        setGenerations((prev) =>
          prev.map((g) => (g.id === id ? { ...g, isFavorite: !currentFavorite } : g))
        );
        if (lightboxItem?.id === id) {
          setLightboxItem((prev) => prev ? { ...prev, isFavorite: !currentFavorite } : null);
        }
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

  // Delete — remove from IndexedDB
  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id);
      try {
        await data.deleteGeneration(id);
        toast.success('Generation deleted');
        setGenerations((prev) => prev.filter((g) => g.id !== id));
        setTotal((prev) => prev - 1);
        if (lightboxItem?.id === id) setLightboxItem(null);
        setGallerySelectedIds(gallerySelectedIds.filter((sid) => sid !== id));
      } catch {
        toast.error('Failed to delete generation');
      } finally {
        setDeletingId(null);
      }
    },
    [lightboxItem, gallerySelectedIds, setGallerySelectedIds]
  );

  const handleClearAll = useCallback(async () => {
    try {
      for (const g of generations) {
        await data.deleteGeneration(g.id);
      }
      toast.success('All generations cleared');
      setGenerations([]);
      setTotal(0);
      setHasMore(false);
    } catch {
      toast.error('Failed to clear all generations');
    }
  }, [generations]);

  const handleDoubleClickFav = useCallback(
    (gen: Generation) => {
      if (gallerySelectMode) return;
      setFavRippleId(gen.id);
      handleFavoriteToggle(gen.id, gen.isFavorite);
      setTimeout(() => setFavRippleId(null), 600);
    },
    [handleFavoriteToggle, gallerySelectMode]
  );

  const filteredGenerations = searchQuery
    ? generations.filter((g) => g.prompt.toLowerCase().includes(searchQuery.toLowerCase()))
    : generations;

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
    try {
      for (const g of selected) {
        await data.toggleGenerationFavorite(g.id, g.isFavorite);
      }
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
      if (url) await downloadFile(url, gen.type);
    }
  }, [generations, gallerySelectedIds]);

  const handleBatchDelete = useCallback(async () => {
    try {
      for (const id of gallerySelectedIds) {
        await data.deleteGeneration(id);
      }
      toast.success(`Deleted ${gallerySelectedIds.length} items`);
      setGenerations((prev) => prev.filter((g) => !gallerySelectedIds.includes(g.id)));
      setTotal((prev) => prev - gallerySelectedIds.length);
      setGallerySelectedIds([]);
      setGallerySelectMode(false);
    } catch {
      toast.error('Failed to delete items');
    }
  }, [gallerySelectedIds, setGallerySelectedIds, setGallerySelectMode]);

  useEffect(() => {
    if (gallerySelectMode) {
      setGallerySelectMode(false);
      setGallerySelectedIds([]);
    }
  }, [galleryFilter, setGallerySelectMode, setGallerySelectedIds]);

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

  const getGridColsClass = useCallback(() => {
    return GRID_SIZE_CONFIG[galleryGridSize]?.cols ?? GRID_SIZE_CONFIG.md.cols;
  }, [galleryGridSize]);

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

  const openLightbox = useCallback((gen: Generation) => {
    const idx = filteredGenerations.findIndex((g) => g.id === gen.id);
    setLightboxItem(gen);
    setLightboxIndex(idx);
  }, [filteredGenerations]);

  const cardActions: CardActions = {
    onFavoriteToggle: handleFavoriteToggle,
    onCopyPrompt: copyToClipboard,
    onDownload: downloadFile,
    onDelete: handleDelete,
    onOpenLightbox: openLightbox,
    onDoubleClickFav: handleDoubleClickFav,
    onToggleSelect: toggleSelectItem,
    onCardMouseMove: handleCardMouseMove,
    onCardMouseLeave: handleCardMouseLeave,
  };

  return {
    generations, total, stats, collections, filteredGenerations,
    loading, loadingMore, hasMore, deletingId,
    showStats, setShowStats, searchQuery, setSearchQuery, searchInputRef,
    lightboxItem, setLightboxItem, lightboxIndex, setLightboxIndex, lightboxCollectionIds,
    showNewCollectionDialog, setShowNewCollectionDialog,
    genCollectionMap, batchCollectionOpen, setBatchCollectionOpen,
    favRippleId, favBounceId, shimmerIds,
    scrollContainerRef, loadMoreRef, cardTiltRefs,
    getGridColsClass, cardActions,
    handleCollectionAdded, handleCollectionRemoved, handleCollectionCreated,
    handleSelectAll, handleDeselectAll,
    handleBatchFavorite, handleBatchDownload, handleBatchDelete, handleBatchAddToCollection,
    handleClearAll, handleLoadMore,
  };
}
