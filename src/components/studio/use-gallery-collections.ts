'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

import type { Generation, CollectionWithCount } from '@/lib/types';
import * as data from '@/lib/data';

interface UseGalleryCollectionsParams {
  generations: Generation[];
  lightboxItem: Generation | null;
  gallerySelectedIds: string[];
}

export interface UseGalleryCollectionsReturn {
  collections: CollectionWithCount[];
  setCollections: React.Dispatch<React.SetStateAction<CollectionWithCount[]>>;
  showNewCollectionDialog: boolean;
  setShowNewCollectionDialog: (v: boolean) => void;
  lightboxCollectionIds: string[];
  genCollectionMap: Record<string, string[]>;
  batchCollectionOpen: boolean;
  setBatchCollectionOpen: (v: boolean) => void;
  handleCollectionAdded: (collectionId: string) => void;
  handleCollectionRemoved: (collectionId: string) => void;
  handleCollectionCreated: (collection: CollectionWithCount) => void;
  handleBatchAddToCollection: (collectionId: string) => Promise<void>;
}

export function useGalleryCollections({
  generations,
  lightboxItem,
  gallerySelectedIds,
}: UseGalleryCollectionsParams): UseGalleryCollectionsReturn {
  const [collections, setCollections] = useState<CollectionWithCount[]>([]);
  const [showNewCollectionDialog, setShowNewCollectionDialog] = useState(false);
  const [lightboxCollectionIds, setLightboxCollectionIds] = useState<string[]>([]);
  const [genCollectionMap, setGenCollectionMap] = useState<Record<string, string[]>>({});
  const [batchCollectionOpen, setBatchCollectionOpen] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Fetch collections from IndexedDB
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const cols = await data.fetchCollections();
        if (!cancelled && mountedRef.current) setCollections(cols as unknown as CollectionWithCount[]);
      } catch { /* non-critical */ }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Fetch collection memberships for displayed generations
  useEffect(() => {
    if (generations.length === 0) return;
    let cancelled = false;
    async function loadCollectionMemberships() {
      try {
        const ids = generations.map((g) => g.id);
        const result = await data.fetchCollectionItems(ids);
        if (!cancelled && mountedRef.current) {
          const map: Record<string, string[]> = {};
          for (const item of (result.items ?? [])) {
            if (!map[item.generationId]) map[item.generationId] = [];
            map[item.generationId].push(item.collectionId);
          }
          setGenCollectionMap(map);
        }
      } catch { /* non-critical */ }
    }
    loadCollectionMemberships();
    return () => { cancelled = true; };
  }, [generations]);

  // Load lightbox collection memberships
  useEffect(() => {
    if (!lightboxItem) return;
    const itemId = lightboxItem.id;
    let cancelled = false;
    async function load() {
      try {
        const result = await data.fetchCollectionItems([itemId]);
        if (!cancelled && mountedRef.current) {
          setLightboxCollectionIds((result.items ?? []).map((i) => i.collectionId));
        }
      } catch { /* non-critical */ }
    }
    load();
    return () => { cancelled = true; };
  }, [lightboxItem]);

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

  const handleBatchAddToCollection = useCallback(async (collectionId: string) => {
    try {
      for (const genId of gallerySelectedIds) {
        await data.addToCollection(collectionId, genId);
      }
      toast.success(`Added ${gallerySelectedIds.length} items to collection`);
      setCollections((prev) =>
        prev.map((c) => c.id === collectionId ? { ...c, itemCount: c.itemCount + gallerySelectedIds.length } : c)
      );
      setBatchCollectionOpen(false);
    } catch {
      toast.error('Failed to add to collection');
    }
  }, [gallerySelectedIds]);

  return {
    collections,
    setCollections,
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
  };
}
