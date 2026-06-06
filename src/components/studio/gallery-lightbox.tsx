'use client';

import { useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ImageIcon,
  VideoIcon,
  Heart,
  Download,
  Trash2,
  X,
  Film,
  Clock,
  Copy,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Layers,
  Paintbrush,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAppStore } from '@/lib/store';
import type { Generation, CollectionWithCount } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { AddToCollectionPopover } from '@/components/studio/collection-dialog';
import { getImageUrl, getRelativeTime } from './gallery-types';

// ---------------------------------------------------------------------------
// Gallery Lightbox
// ---------------------------------------------------------------------------

interface GalleryLightboxProps {
  lightboxItem: Generation | null;
  setLightboxItem: (item: Generation | null) => void;
  lightboxIndex: number;
  setLightboxIndex: (index: number) => void;
  filteredGenerations: Generation[];
  deletingId: string | null;
  collections: CollectionWithCount[];
  lightboxCollectionIds: string[];
  onFavoriteToggle: (id: string, currentFavorite: boolean) => void;
  onCopyPrompt: (prompt: string) => void;
  onDownload: (url: string, type: string) => void;
  onDelete: (id: string) => void;
  onCollectionAdded: (collectionId: string) => void;
  onCollectionRemoved: (collectionId: string) => void;
  onShowNewCollectionDialog: () => void;
}

export function GalleryLightbox({
  lightboxItem,
  setLightboxItem,
  lightboxIndex,
  setLightboxIndex,
  filteredGenerations,
  deletingId,
  collections,
  lightboxCollectionIds,
  onFavoriteToggle,
  onCopyPrompt,
  onDownload,
  onDelete,
  onCollectionAdded,
  onCollectionRemoved,
  onShowNewCollectionDialog,
}: GalleryLightboxProps) {
  // Navigation
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
  }, [filteredGenerations, lightboxIndex, setLightboxIndex, setLightboxItem]);

  // Keyboard support
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
  }, [lightboxItem, navigateLightbox, setLightboxItem]);

  return (
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
                onClick={() => onCopyPrompt(lightboxItem.prompt)}
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
                  onClick={() => onFavoriteToggle(lightboxItem.id, lightboxItem.isFavorite)}
                  className="gap-1.5 border-border/40 bg-surface/50 text-xs"
                >
                  <Heart className={`h-3.5 w-3.5 ${lightboxItem.isFavorite ? 'fill-[#d9ff00] text-[#d9ff00]' : ''}`} />
                  {lightboxItem.isFavorite ? 'Unfavorite' : 'Favorite'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCopyPrompt(lightboxItem.prompt)}
                  className="gap-1.5 border-border/40 bg-surface/50 text-xs"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy Prompt
                </Button>
                {getImageUrl(lightboxItem) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDownload(getImageUrl(lightboxItem)!, lightboxItem.type)}
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
                        onClick={() => onDelete(lightboxItem.id)}
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
                  onAdded={onCollectionAdded}
                  onRemoved={onCollectionRemoved}
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
  );
}
