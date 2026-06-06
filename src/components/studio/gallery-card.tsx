'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  ImageIcon,
  VideoIcon,
  Heart,
  Download,
  Trash2,
  Copy,
  Film,
  Clock,
  Check,
} from 'lucide-react';

import type { Generation, CollectionWithCount } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cardVariants, getImageUrl, getRelativeTime } from './gallery-types';
import { ParticleBurst } from './gallery-particle-burst';

// ---------------------------------------------------------------------------
// Shared card action callbacks
// ---------------------------------------------------------------------------

export interface CardActions {
  onFavoriteToggle: (id: string, currentFavorite: boolean) => void;
  onCopyPrompt: (prompt: string) => void;
  onDownload: (url: string, type: string) => void;
  onDelete: (id: string) => void;
  onOpenLightbox: (gen: Generation) => void;
  onDoubleClickFav: (gen: Generation) => void;
  onToggleSelect: (id: string) => void;
  onCardMouseMove: (e: React.MouseEvent<HTMLDivElement>, id: string) => void;
  onCardMouseLeave: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Grid Card
// ---------------------------------------------------------------------------

interface GalleryGridCardProps {
  gen: Generation;
  imageUrl: string | null;
  providerColor: string;
  isDeleting: boolean;
  isNew: boolean;
  isSelected: boolean;
  hasShimmer: boolean;
  favRippleId: string | null;
  favBounceId: string | null;
  gallerySelectMode: boolean;
  cardTiltRef: (el: HTMLDivElement | null) => void;
  collections: CollectionWithCount[];
  genCollectionMap: Record<string, string[]>;
  actions: CardActions;
}

export function GalleryGridCard({
  gen,
  imageUrl,
  providerColor,
  isDeleting,
  isNew,
  isSelected,
  hasShimmer,
  favRippleId,
  favBounceId,
  gallerySelectMode,
  cardTiltRef,
  collections,
  genCollectionMap,
  actions,
}: GalleryGridCardProps) {
  const cardHeight = gen.id.charCodeAt(gen.id.length - 1) % 3;

  return (
    <motion.div
      key={gen.id}
      variants={cardVariants}
      exit="exit"
      layout
      className="mb-3 md:mb-4 break-inside-avoid"
      onDoubleClick={() => actions.onDoubleClickFav(gen)}
    >
      <div
        ref={cardTiltRef}
        onMouseMove={(e) => actions.onCardMouseMove(e, gen.id)}
        onMouseLeave={() => actions.onCardMouseLeave(gen.id)}
        className={`gallery-card group relative overflow-hidden rounded-xl parallax-slow transition-all duration-300 ${
          gen.isFavorite ? 'gallery-card-favorite' : ''
        } ${favRippleId === gen.id ? 'fav-ripple' : ''} ${
          isSelected ? 'ring-2 ring-[#d9ff00] shadow-[0_0_16px_rgba(217,255,0,0.2)]' : ''
        }`}
        style={{ transitionProperty: 'transform, box-shadow, ring-color' }}
        onClick={() => {
          if (gallerySelectMode) {
            actions.onToggleSelect(gen.id);
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
            if (!gallerySelectMode && imageUrl) actions.onOpenLightbox(gen);
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
                animate={favBounceId === gen.id ? { scale: [1, 1.5, 0.8, 1.2, 1] } : {}}
                transition={{ duration: 0.5 }}
                className="relative"
              >
                <Heart className="h-4 w-4 fill-[#d9ff00] text-[#d9ff00] drop-shadow-lg" />
                <ParticleBurst active={favBounceId === gen.id} />
              </motion.div>
            </div>
          )}

          {/* New badge */}
          {isNew && !gen.isFavorite && !gallerySelectMode && (
            <div className="absolute right-2 top-2 new-badge-animate">
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
                  actions.onFavoriteToggle(gen.id, gen.isFavorite);
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
                  actions.onCopyPrompt(gen.prompt);
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
                    actions.onDownload(imageUrl, gen.type);
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
                  actions.onDelete(gen.id);
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
}

// ---------------------------------------------------------------------------
// List Item
// ---------------------------------------------------------------------------

interface GalleryListItemProps {
  gen: Generation;
  imageUrl: string | null;
  providerColor: string;
  isSelected: boolean;
  isDeleting: boolean;
  gallerySelectMode: boolean;
  actions: CardActions;
}

export function GalleryListItem({
  gen,
  imageUrl,
  providerColor,
  isSelected,
  isDeleting,
  gallerySelectMode,
  actions,
}: GalleryListItemProps) {
  return (
    <motion.div
      key={gen.id}
      variants={cardVariants}
      exit="exit"
      layout
      onClick={() => {
        if (gallerySelectMode) actions.onToggleSelect(gen.id);
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
              actions.onFavoriteToggle(gen.id, gen.isFavorite);
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
              actions.onCopyPrompt(gen.prompt);
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
                actions.onDownload(imageUrl, gen.type);
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
              actions.onDelete(gen.id);
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
}
