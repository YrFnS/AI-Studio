'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { FolderPlus, X, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import * as data from '@/lib/data';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { CollectionWithCount } from '@/lib/types';

// ---------------------------------------------------------------------------
// Preset colors
// ---------------------------------------------------------------------------

const PRESET_COLORS = [
  '#d9ff00',
  '#00d4ff',
  '#c084fc',
  '#ff6b9d',
  '#fb923c',
  '#34d399',
  '#f472b6',
  '#60a5fa',
];

// ---------------------------------------------------------------------------
// New Collection Dialog
// ---------------------------------------------------------------------------

interface NewCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (collection: CollectionWithCount) => void;
}

export function NewCollectionDialog({ open, onOpenChange, onCreated }: NewCollectionDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#d9ff00');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Collection name is required');
      return;
    }

    setCreating(true);
    try {
      const result = await data.createCollection({ name: name.trim(), description: description.trim() || undefined, color });
      toast.success(`Collection "${name.trim()}" created`);
      onCreated({ ...result.collection, createdAt: new Date(result.collection.createdAt).toISOString(), updatedAt: new Date(result.collection.updatedAt).toISOString() });
      // Reset form
      setName('');
      setDescription('');
      setColor('#d9ff00');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create collection');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-dialog border-border/40 bg-[#0a0a0a]/95 backdrop-blur-xl sm:max-w-md">
        <DialogTitle className="text-foreground text-base font-semibold">
          New Collection
        </DialogTitle>
        <DialogDescription className="text-muted-foreground text-sm">
          Create a collection to organize your gallery items.
        </DialogDescription>

        <div className="mt-2 flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Favorites, Portraits, Landscapes…"
              className="h-9 border-border/40 bg-surface text-sm placeholder:text-muted-foreground/40 focus-visible:ring-[#d9ff00]/30"
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this collection about?"
              className="h-9 border-border/40 bg-surface text-sm placeholder:text-muted-foreground/40 focus-visible:ring-[#d9ff00]/30"
            />
          </div>

          {/* Color picker */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground">Color</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  onClick={() => setColor(presetColor)}
                  className="group relative flex h-8 w-8 items-center justify-center rounded-lg border-2 transition-all duration-200 hover:scale-110"
                  style={{
                    backgroundColor: `${presetColor}20`,
                    borderColor: color === presetColor ? presetColor : 'transparent',
                  }}
                >
                  <span
                    className="h-4 w-4 rounded-full transition-transform duration-200 group-hover:scale-110"
                    style={{ backgroundColor: presetColor }}
                  />
                  {color === presetColor && (
                    <Check
                      className="absolute h-3.5 w-3.5 text-white drop-shadow-md"
                      style={{ color: presetColor }}
                    />
                  )}
                </button>
              ))}
            </div>
            {/* Custom color input */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground/60">Custom:</span>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent"
              />
              <span className="text-[10px] font-mono text-muted-foreground/60">{color}</span>
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 rounded-lg border border-border/30 bg-surface/50 p-3">
            <div
              className="h-8 w-1.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            <div>
              <p className="text-sm font-medium text-foreground">
                {name || 'Collection Name'}
              </p>
              <p className="text-[11px] text-muted-foreground/60">
                {description || 'No description'}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className="gap-1.5 bg-[#d9ff00] text-background hover:bg-[#c5eb00] font-semibold"
            >
              {creating ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="h-3.5 w-3.5 rounded-full border-2 border-background/30 border-t-background"
                />
              ) : (
                <FolderPlus className="h-3.5 w-3.5" />
              )}
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Add to Collection Popover (used in lightbox and context menu)
// ---------------------------------------------------------------------------

interface AddToCollectionPopoverProps {
  collections: CollectionWithCount[];
  generationId: string;
  generationCollections: string[]; // collection IDs the generation is already in
  onAdded: (collectionId: string) => void;
  onRemoved: (collectionId: string) => void;
  onClose?: () => void;
}

export function AddToCollectionPopover({
  collections,
  generationId,
  generationCollections,
  onAdded,
  onRemoved,
  onClose,
}: AddToCollectionPopoverProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleToggle = async (collectionId: string, isCurrentlyIn: boolean) => {
    setLoading(collectionId);
    try {
      if (isCurrentlyIn) {
        await data.removeFromCollection(collectionId, generationId);
        toast.success('Removed from collection');
        onRemoved(collectionId);
      } else {
        await data.addToCollection(collectionId, generationId);
        toast.success('Added to collection');
        onAdded(collectionId);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update collection');
    } finally {
      setLoading(null);
      onClose?.();
    }
  };

  if (collections.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 p-4 text-center">
        <FolderPlus className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">No collections yet</p>
        <p className="text-[10px] text-muted-foreground/50">Create one from the gallery toolbar</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 py-1">
      {collections.map((col) => {
        const isIn = generationCollections.includes(col.id);
        const isLoading = loading === col.id;

        return (
          <button
            key={col.id}
            type="button"
            onClick={() => handleToggle(col.id, isIn)}
            disabled={isLoading}
            className="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all duration-150 hover:bg-white/5"
          >
            {/* Colored dot */}
            <span
              className={`h-3 w-3 shrink-0 rounded-full ring-2 ring-offset-1 ring-offset-[#0a0a0a] transition-all duration-200 ${isIn ? '' : 'ring-transparent'}`}
              style={{
                backgroundColor: col.color,
                '--tw-ring-color': isIn ? col.color : 'transparent',
              } as React.CSSProperties}
            />
            {/* Name & count */}
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-medium text-foreground">{col.name}</p>
              <p className="text-[10px] text-muted-foreground/50">
                {col.itemCount} item{col.itemCount !== 1 ? 's' : ''}
              </p>
            </div>
            {/* Status indicator */}
            {isIn ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex h-5 w-5 items-center justify-center"
              >
                <Check className="h-3.5 w-3.5" style={{ color: col.color }} />
              </motion.div>
            ) : isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
