import { formatDistanceToNow } from 'date-fns';
import {
  ImageIcon,
  VideoIcon,
  Star,
  FolderOpen,
  LayoutGrid,
  Grid3x3,
  Columns3,
  Columns2,
} from 'lucide-react';

import type { GalleryFilterType } from '@/lib/types';

// ---------------------------------------------------------------------------
// Filter config
// ---------------------------------------------------------------------------

export const FILTERS: { value: GalleryFilterType; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  { value: 'image', label: 'Images', icon: <ImageIcon className="h-3.5 w-3.5" /> },
  { value: 'video', label: 'Videos', icon: <VideoIcon className="h-3.5 w-3.5" /> },
  { value: 'favorite', label: 'Favorites', icon: <Star className="h-3.5 w-3.5" /> },
  { value: 'collection', label: 'Collections', icon: <FolderOpen className="h-3.5 w-3.5" /> },
];

// ---------------------------------------------------------------------------
// Grid size config
// ---------------------------------------------------------------------------

export const GRID_SIZE_CONFIG: Record<string, { label: string; icon: React.ReactNode; cols: string }> = {
  sm: { label: 'S', icon: <Grid3x3 className="h-3 w-3" />, cols: 'columns-4 md:columns-5 lg:columns-6' },
  md: { label: 'M', icon: <Columns3 className="h-3 w-3" />, cols: 'columns-2 md:columns-3 lg:columns-4' },
  lg: { label: 'L', icon: <Columns2 className="h-3 w-3" />, cols: 'columns-1 md:columns-2 lg:columns-3' },
};

// ---------------------------------------------------------------------------
// Stats type
// ---------------------------------------------------------------------------

export interface GalleryStats {
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

export const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

export const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.2 },
  },
};

export const floatingBarVariants = {
  hidden: { y: 80, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 300, damping: 28 },
  },
  exit: {
    y: 80,
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Helper: get image URL for a generation
// ---------------------------------------------------------------------------

export function getImageUrl(gen: { thumbnailUrl?: string | null; resultUrl?: string | null; resultData?: string | null }): string | null {
  if (gen.thumbnailUrl) return gen.thumbnailUrl;
  if (gen.resultUrl) return gen.resultUrl;
  if (gen.resultData) return `data:image/png;base64,${gen.resultData}`;
  return null;
}

// ---------------------------------------------------------------------------
// Helper: relative time
// ---------------------------------------------------------------------------

export function getRelativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return '';
  }
}
