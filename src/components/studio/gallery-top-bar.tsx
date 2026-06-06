'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Filter,
  LayoutGrid,
  X,
  Search,
  BarChart3,
  Trash,
  FolderPlus,
  Plus,
  FolderOpen,
  List,
  MousePointerSquareDashed,
  TrendingUp,
  ImageIcon,
  VideoIcon,
  Heart,
  Sparkles,
  Clock,
} from 'lucide-react';

import type { GalleryFilterType, CollectionWithCount } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { FILTERS, GRID_SIZE_CONFIG, type GalleryStats } from './gallery-types';

// ---------------------------------------------------------------------------
// Gallery Top Bar
// ---------------------------------------------------------------------------

interface GalleryTopBarProps {
  galleryFilter: GalleryFilterType;
  setGalleryFilter: (filter: GalleryFilterType) => void;
  selectedCollectionId: string | null;
  setSelectedCollectionId: (id: string | null) => void;
  galleryViewMode: 'grid' | 'list';
  setGalleryViewMode: (mode: 'grid' | 'list') => void;
  galleryGridSize: 'sm' | 'md' | 'lg';
  setGalleryGridSize: (size: 'sm' | 'md' | 'lg') => void;
  gallerySelectMode: boolean;
  setGallerySelectMode: (enabled: boolean) => void;
  gallerySelectedIds: string[];
  setGallerySelectedIds: (ids: string[]) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchInputRef: (node: HTMLInputElement | null) => void;
  filteredGenerationsCount: number;
  total: number;
  generationsCount: number;
  stats: GalleryStats | null;
  showStats: boolean;
  setShowStats: (show: boolean) => void;
  collections: CollectionWithCount[];
  showNewCollectionDialog: boolean;
  setShowNewCollectionDialog: (show: boolean) => void;
  onClearAll: () => void;
}

export function GalleryTopBar({
  galleryFilter,
  setGalleryFilter,
  selectedCollectionId,
  setSelectedCollectionId,
  galleryViewMode,
  setGalleryViewMode,
  galleryGridSize,
  setGalleryGridSize,
  gallerySelectMode,
  setGallerySelectMode,
  gallerySelectedIds,
  setGallerySelectedIds,
  searchQuery,
  setSearchQuery,
  searchInputRef,
  filteredGenerationsCount,
  total,
  generationsCount,
  stats,
  showStats,
  setShowStats,
  collections,
  setShowNewCollectionDialog,
  onClearAll,
}: GalleryTopBarProps) {
  return (
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
          </div>

          {/* Select mode toggle */}
          {filteredGenerationsCount > 0 && (
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
              ? `${filteredGenerationsCount} results`
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

          {generationsCount > 0 && (
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
                    onClick={onClearAll}
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
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => setSelectedCollectionId(col.id === selectedCollectionId ? null : col.id)}
                      className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors duration-200 border ${
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
                    </button>
                  ))}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats bar */}
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
    </div>
  );
}
