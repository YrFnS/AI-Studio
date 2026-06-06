'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  ImageIcon,
  Search,
  Trash2,
  Upload,
  Clock,
  X,
  Loader2,
  ImagePlus,
  Trash,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  getRecentReferenceImages,
  deleteReferenceImage,
  clearAllReferenceImages,
  saveReferenceImage,
  type ReferenceImage,
} from '@/lib/idb';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReferenceImagePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (dataUrl: string) => void;
  /** Label context — e.g. "Reference Image", "Start Frame" */
  title?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReferenceImagePicker({
  open,
  onOpenChange,
  onSelect,
  title = 'Reference Image History',
}: ReferenceImagePickerProps) {
  const [images, setImages] = useState<ReferenceImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredImageId, setHoveredImageId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load images from IndexedDB
  const loadImages = useCallback(async () => {
    try {
      setLoading(true);
      const recent = await getRecentReferenceImages(100);
      setImages(recent);
    } catch {
      toast.error('Failed to load reference images');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadImages();
      setSearchQuery('');
      setSelectedId(null);
    }
  }, [open, loadImages]);

  // Delete single image
  const handleDelete = useCallback(
    async (id: number, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        setDeleting(id);
        await deleteReferenceImage(id);
        setImages((prev) => prev.filter((img) => img.id !== id));
        if (selectedId === id) setSelectedId(null);
        toast.success('Image removed from history');
      } catch {
        toast.error('Failed to delete image');
      } finally {
        setDeleting(null);
      }
    },
    [selectedId]
  );

  // Clear all
  const handleClearAll = useCallback(async () => {
    try {
      await clearAllReferenceImages();
      setImages([]);
      setSelectedId(null);
      toast.success('All reference images cleared');
    } catch {
      toast.error('Failed to clear images');
    }
  }, []);

  // Upload new image
  const handleUploadNew = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      try {
        setUploading(true);
        // Read file as data URL
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const saved = await saveReferenceImage(dataUrl, file.name);
        setImages((prev) => [saved, ...prev]);
        toast.success('Image saved to history');
      } catch {
        toast.error('Failed to save image');
      } finally {
        setUploading(false);
      }
    },
    []
  );

  // Select image
  const handleSelect = useCallback(
    (image: ReferenceImage) => {
      setSelectedId(image.id ?? null);
      onSelect(image.dataUrl);
      onOpenChange(false);
    },
    [onSelect, onOpenChange]
  );

  // Filter images by search query
  const filteredImages = images.filter((img) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      img.name.toLowerCase().includes(q) ||
      `${img.width}×${img.height}`.includes(q) ||
      formatRelativeTime(img.createdAt).toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass bg-[#111111] border-border/40 sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
          <DialogTitle className="text-foreground flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#d9ff00]/10">
              <ImageIcon className="h-4 w-4 text-[#d9ff00]" />
            </div>
            {title}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Select a previously used reference image, or upload a new one.
          </DialogDescription>
        </DialogHeader>

        {/* Search + Actions bar */}
        <div className="px-6 py-3 shrink-0 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, size, or date…"
              className="pl-8 h-8 text-xs bg-surface border-border/60 placeholder:text-muted-foreground/40 focus-visible:ring-[#d9ff00]/30"
            />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUploadNew(file);
              e.target.value = '';
            }}
            className="hidden"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="gap-1.5 border-border/50 bg-surface text-xs hover:border-[#d9ff00]/40 hover:bg-[#d9ff00]/5 hover:text-[#d9ff00]"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                Upload New
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Upload a new image to history</TooltipContent>
          </Tooltip>
          {images.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearAll}
                  className="gap-1.5 border-border/50 bg-surface text-xs hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
                >
                  <Trash className="h-3.5 w-3.5" />
                  Clear All
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Remove all images from history</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Image count */}
        <div className="px-6 pb-2 shrink-0 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground/60">
            {filteredImages.length} image{filteredImages.length !== 1 ? 's' : ''}
            {searchQuery && ` found for "${searchQuery}"`}
          </p>
          {filteredImages.length > 0 && (
            <Badge className="h-4 px-1.5 text-[8px] bg-[#d9ff00]/10 text-[#d9ff00] border-[#d9ff00]/20">
              Click to select
            </Badge>
          )}
        </div>

        {/* Image Grid */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0 scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 text-[#d9ff00] animate-spin" />
              <p className="text-xs text-muted-foreground">Loading history…</p>
            </div>
          ) : filteredImages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-16 gap-4"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#d9ff00]/10">
                <ImagePlus className="h-8 w-8 text-[#d9ff00]/50" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-foreground">No reference images yet</p>
                <p className="text-xs text-muted-foreground/60">
                  {searchQuery
                    ? 'No images match your search.'
                    : 'Upload or use reference images and they will appear here.'}
                </p>
              </div>
              {!searchQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5 border-[#d9ff00]/30 bg-[#d9ff00]/5 text-[#d9ff00] hover:bg-[#d9ff00]/10 hover:border-[#d9ff00]/50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload First Image
                </Button>
              )}
            </motion.div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              <AnimatePresence>
                {filteredImages.map((image, index) => {
                  const id = image.id ?? 0;
                  const isSelected = selectedId === id;
                  const isHovered = hoveredImageId === id;
                  const isDeleting = deleting === id;

                  return (
                    <motion.div
                      key={id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15, delay: index * 0.02 }}
                      onMouseEnter={() => {
                        setHoveredImageId(id);
                        // Clear any existing timeout
                        if (tooltipTimeoutRef.current) {
                          clearTimeout(tooltipTimeoutRef.current);
                        }
                      }}
                      onMouseLeave={() => {
                        setHoveredImageId(null);
                      }}
                      onClick={() => handleSelect(image)}
                      className={`
                        relative group cursor-pointer rounded-lg border overflow-hidden
                        transition-all duration-200
                        ${
                          isSelected
                            ? 'border-[#d9ff00] shadow-[0_0_12px_rgba(217,255,0,0.3),0_0_4px_rgba(217,255,0,0.2)] ring-1 ring-[#d9ff00]/50'
                            : 'border-border/40 bg-surface hover:border-[#d9ff00]/40 hover:shadow-[0_0_8px_rgba(217,255,0,0.1)]'
                        }
                      `}
                    >
                      {/* Thumbnail */}
                      <div className="aspect-square overflow-hidden bg-black/30">
                        <img
                          src={image.thumbnailUrl || image.dataUrl}
                          alt={image.name}
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>

                      {/* Hover overlay with info */}
                      <AnimatePresence>
                        {isHovered && !isDeleting && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1 p-1.5"
                          >
                            {/* Full preview */}
                            <img
                              src={image.dataUrl}
                              alt={image.name}
                              className="max-h-[80%] max-w-full object-contain rounded"
                            />
                            <p className="text-[8px] text-white/80 truncate w-full text-center">
                              {image.name}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Delete button (top-right corner, visible on hover) */}
                      <AnimatePresence>
                        {isHovered && !isDeleting && (
                          <motion.button
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            type="button"
                            onClick={(e) => handleDelete(id, e)}
                            className="absolute top-1 right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white/70 backdrop-blur-sm transition-colors hover:bg-destructive hover:text-white"
                            aria-label="Delete image"
                          >
                            <X className="h-3 w-3" />
                          </motion.button>
                        )}
                      </AnimatePresence>

                      {/* Deleting overlay */}
                      <AnimatePresence>
                        {isDeleting && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/70 flex items-center justify-center"
                          >
                            <Loader2 className="h-5 w-5 text-destructive animate-spin" />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Selected indicator */}
                      {isSelected && (
                        <div className="absolute bottom-1 left-1">
                          <Badge className="h-4 px-1 text-[7px] font-bold bg-[#d9ff00] text-background border-none">
                            SELECTED
                          </Badge>
                        </div>
                      )}

                      {/* Bottom info bar */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1 pt-4 pointer-events-none">
                        <div className="flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5 text-white/50 shrink-0" />
                          <span className="text-[7px] text-white/50 truncate">
                            {formatRelativeTime(image.createdAt)}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
