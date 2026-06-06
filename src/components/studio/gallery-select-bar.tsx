'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  Download,
  Trash2,
  X,
  FolderPlus,
  CheckCircle2,
} from 'lucide-react';

import type { CollectionWithCount } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
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
import { floatingBarVariants } from './gallery-types';

// ---------------------------------------------------------------------------
// Gallery Select Bar (floating multi-select action bar)
// ---------------------------------------------------------------------------

interface GallerySelectBarProps {
  gallerySelectedIds: string[];
  collections: CollectionWithCount[];
  batchCollectionOpen: boolean;
  setBatchCollectionOpen: (open: boolean) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBatchFavorite: () => void;
  onBatchDownload: () => void;
  onBatchDelete: () => void;
  onBatchAddToCollection: (collectionId: string) => void;
}

export function GallerySelectBar({
  gallerySelectedIds,
  collections,
  batchCollectionOpen,
  setBatchCollectionOpen,
  onSelectAll,
  onDeselectAll,
  onBatchFavorite,
  onBatchDownload,
  onBatchDelete,
  onBatchAddToCollection,
}: GallerySelectBarProps) {
  return (
    <AnimatePresence>
      {gallerySelectedIds.length > 0 && (
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
              onClick={onSelectAll}
              className="gap-1.5 text-muted-foreground hover:text-[#d9ff00] hover:bg-[#d9ff00]/10 h-8 px-2.5 text-xs"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">All</span>
            </Button>

            {/* Download All */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onBatchDownload}
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
              <PopoverContent className="w-56 glass-strong border-border/60 bg-[#111111]/95 p-2" align="bottom">
                <div className="space-y-1">
                  <p className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Add to collection</p>
                  {collections.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-muted-foreground/50">No collections yet</p>
                  ) : (
                    collections.map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => onBatchAddToCollection(col.id)}
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
              onClick={onBatchFavorite}
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
                    onClick={onBatchDelete}
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
              onClick={onDeselectAll}
              className="gap-1.5 text-muted-foreground hover:text-foreground hover:bg-white/5 h-8 px-2.5 text-xs"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
