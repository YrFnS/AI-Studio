'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Share2,
  Download,
  Loader2,
  Linkedin,
  Twitter,
  Instagram,
  Facebook,
  Youtube,
  MessageCircle,
  Github,
  Maximize2,
  Package,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Platform definitions
// ---------------------------------------------------------------------------

interface PlatformConfig {
  id: string;
  name: string;
  width: number;
  height: number;
  icon: React.ReactNode;
  color: string;
  category: 'social' | 'dev' | 'original';
}

const PLATFORMS: PlatformConfig[] = [
  {
    id: 'linkedin',
    name: 'LinkedIn',
    width: 400,
    height: 400,
    icon: <Linkedin className="h-5 w-5" />,
    color: '#0A66C2',
    category: 'social',
  },
  {
    id: 'twitter',
    name: 'Twitter / X',
    width: 400,
    height: 400,
    icon: <Twitter className="h-5 w-5" />,
    color: '#1DA1F2',
    category: 'social',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    width: 320,
    height: 320,
    icon: <Instagram className="h-5 w-5" />,
    color: '#E4405F',
    category: 'social',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    width: 180,
    height: 180,
    icon: <Facebook className="h-5 w-5" />,
    color: '#1877F2',
    category: 'social',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    width: 800,
    height: 800,
    icon: <Youtube className="h-5 w-5" />,
    color: '#FF0000',
    category: 'social',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    width: 500,
    height: 500,
    icon: <MessageCircle className="h-5 w-5" />,
    color: '#25D366',
    category: 'social',
  },
  {
    id: 'github',
    name: 'GitHub',
    width: 500,
    height: 500,
    icon: <Github className="h-5 w-5" />,
    color: '#8B949E',
    category: 'dev',
  },
  {
    id: 'original',
    name: 'Original',
    width: 0, // 0 means use original dimensions
    height: 0,
    icon: <Maximize2 className="h-5 w-5" />,
    color: '#d9ff00',
    category: 'original',
  },
];

// ---------------------------------------------------------------------------
// Canvas-based export utility
// ---------------------------------------------------------------------------

async function exportImage(
  imageUrl: string,
  platform: PlatformConfig,
  imageName?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const targetW = platform.width === 0 ? img.naturalWidth : platform.width;
      const targetH = platform.height === 0 ? img.naturalHeight : platform.height;

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Draw scaled image to fill the target dimensions
      ctx.drawImage(img, 0, 0, targetW, targetH);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob'));
            return;
          }
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          const timestamp = Date.now();
          const safeName = imageName ? imageName.replace(/[^a-zA-Z0-9_-]/g, '_') : 'image';
          a.download = `ai-studio-${platform.id}-${safeName}-${timestamp}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
          resolve();
        },
        'image/png',
        1.0
      );
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for export. CORS may be blocking access.'));
    };

    img.src = imageUrl;
  });
}

// ---------------------------------------------------------------------------
// SocialExportModal Component
// ---------------------------------------------------------------------------

interface SocialExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  imageName?: string;
}

export function SocialExportModal({
  open,
  onOpenChange,
  imageUrl,
  imageName,
}: SocialExportModalProps) {
  const [exportingPlatform, setExportingPlatform] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  // Export a single platform ------------------------------------------------
  const handleExport = useCallback(
    async (platform: PlatformConfig) => {
      setExportingPlatform(platform.id);
      try {
        await exportImage(imageUrl, platform, imageName);
        toast.success(`Exported for ${platform.name} (${platform.width || 'full'}×${platform.height || 'full'})`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Export failed';
        toast.error(message);
      } finally {
        setExportingPlatform(null);
      }
    },
    [imageUrl, imageName]
  );

  // Download all sizes ------------------------------------------------------
  const handleDownloadAll = useCallback(async () => {
    setDownloadingAll(true);
    let successCount = 0;
    let failCount = 0;

    for (const platform of PLATFORMS) {
      try {
        await exportImage(imageUrl, platform, imageName);
        successCount++;
        // Small delay to prevent browser blocking multiple downloads
        await new Promise((r) => setTimeout(r, 300));
      } catch {
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Exported ${successCount} size${successCount > 1 ? 's' : ''}${failCount > 0 ? ` (${failCount} failed)` : ''}`);
    } else {
      toast.error('Failed to export all sizes');
    }
    setDownloadingAll(false);
  }, [imageUrl, imageName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-3xl border-border/40 bg-[#0a0a0a]/95 backdrop-blur-xl p-0 overflow-hidden">
        <DialogTitle className="sr-only">Export for Social Media</DialogTitle>
        <DialogDescription className="sr-only">
          Export your generated image at platform-specific sizes for social media and developer profiles
        </DialogDescription>

        <div className="flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-border/30">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d9ff00]/10">
                <Share2 className="h-5 w-5 text-[#d9ff00]" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Export for Social Media
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Download at platform-specific sizes
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onOpenChange(false)}
            >
              ✕
            </Button>
          </div>

          {/* Preview strip */}
          <div className="px-6 py-4 border-b border-border/20 bg-surface/30">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border/30 bg-surface">
                <img
                  src={imageUrl}
                  alt="Preview"
                  crossOrigin="anonymous"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {imageName || 'Generated Image'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  8 export sizes available
                </p>
              </div>
              <Button
                onClick={handleDownloadAll}
                disabled={downloadingAll || !!exportingPlatform}
                className="gap-2 bg-[#d9ff00] text-background hover:bg-[#c5eb00] font-semibold rounded-lg h-9 px-4 neon-glow-strong"
              >
                {downloadingAll ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Exporting…
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4" />
                    Download All Sizes
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Platform grid */}
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {PLATFORMS.map((platform) => {
                const isExporting = exportingPlatform === platform.id;
                const isDisabled = !!exportingPlatform || downloadingAll;

                return (
                  <motion.button
                    key={platform.id}
                    type="button"
                    whileHover={!isDisabled ? { scale: 1.03 } : {}}
                    whileTap={!isDisabled ? { scale: 0.97 } : {}}
                    onClick={() => handleExport(platform)}
                    disabled={isDisabled}
                    className={`
                      relative flex flex-col items-center gap-3 rounded-xl border p-4 text-center transition-all card-hover-lift group
                      ${isExporting
                        ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10'
                        : isDisabled
                          ? 'border-border/20 bg-surface/30 opacity-50 cursor-not-allowed'
                          : 'border-border/30 bg-surface hover:border-[#d9ff00]/30 hover:bg-[#d9ff00]/5'
                      }
                    `}
                  >
                    {/* Platform icon with color */}
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl transition-all"
                      style={{
                        backgroundColor: isExporting ? 'rgba(217, 255, 0, 0.15)' : `${platform.color}15`,
                        color: isExporting ? '#d9ff00' : platform.color,
                      }}
                    >
                      {isExporting ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        platform.icon
                      )}
                    </div>

                    {/* Platform name */}
                    <div>
                      <p className="text-xs font-medium text-foreground">
                        {platform.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {platform.width === 0
                          ? 'Full resolution'
                          : `${platform.width}×${platform.height}`}
                      </p>
                    </div>

                    {/* Category badge */}
                    {platform.category !== 'social' && (
                      <Badge
                        variant="secondary"
                        className="text-[8px] border-0 px-1.5 py-0"
                        style={{
                          backgroundColor: `${platform.color}10`,
                          color: platform.color,
                        }}
                      >
                        {platform.category === 'dev' ? 'DEV' : 'ORIGINAL'}
                      </Badge>
                    )}

                    {/* Download icon overlay on hover */}
                    {!isExporting && !isDisabled && (
                      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Download className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Footer hint */}
          <div className="px-6 pb-5">
            <p className="text-[10px] text-muted-foreground/50 text-center">
              Images are resized to exact pixel dimensions. PNG format with transparency support.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
