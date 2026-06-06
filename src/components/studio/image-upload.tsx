'use client';

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Upload, X, ImagePlus, Loader2, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImageUploadProps {
  onUploadComplete: (url: string) => void;
  onRemove?: () => void;
  currentImageUrl?: string | null;
  compact?: boolean;
  label?: string;
}

type UploadState = 'idle' | 'dragging' | 'uploading' | 'success' | 'error';

interface PreviewData {
  file: File;
  objectUrl: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const ACCEPTED_EXTENSIONS = '.png,.jpeg,.jpg,.webp,.gif';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_FILE_SIZE_LABEL = '20MB';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return `Unsupported file type "${file.type}". Accepted: PNG, JPEG, WebP, GIF.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File exceeds ${MAX_FILE_SIZE_LABEL} limit (${formatFileSize(file.size)}).`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Internal: Upload Dropzone (full mode)
// ---------------------------------------------------------------------------

function DropzoneArea({
  uploadState,
  preview,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
  label,
}: {
  uploadState: UploadState;
  preview: PreviewData | null;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onClick: () => void;
  label: string;
}) {
  const isDragging = uploadState === 'dragging';
  const isUploading = uploadState === 'uploading';
  const isSuccess = uploadState === 'success';

  return (
    <motion.div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      className={`
        relative flex flex-col items-center justify-center gap-4
        rounded-2xl border-2 border-dashed p-8
        cursor-pointer select-none transition-colors duration-300
        ${
          isDragging
            ? 'border-[#d9ff00] bg-[#d9ff00]/10 shadow-[0_0_30px_rgba(217,255,0,0.15)]'
            : isSuccess
              ? 'border-[#d9ff00]/40 bg-[#d9ff00]/5'
              : 'border-border/50 bg-surface/50 hover:border-[#d9ff00]/30 hover:bg-[#d9ff00]/5'
        }
      `}
      animate={isDragging ? { scale: 1.01 } : { scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* Glow ring when dragging */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_40px_rgba(217,255,0,0.12)]"
          />
        )}
      </AnimatePresence>

      {/* Animated icon */}
      <motion.div
        animate={isDragging ? { y: [0, -8, 0] } : isUploading ? { rotate: 360 } : {}}
        transition={
          isDragging
            ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' }
            : isUploading
              ? { duration: 1, repeat: Infinity, ease: 'linear' }
              : {}
        }
        className={`
          flex h-16 w-16 items-center justify-center rounded-2xl
          ${isDragging ? 'bg-[#d9ff00]/20' : 'bg-[#d9ff00]/10'}
        `}
      >
        {isUploading ? (
          <Loader2 className="h-8 w-8 text-[#d9ff00] animate-spin" />
        ) : isSuccess ? (
          <Check className="h-8 w-8 text-[#d9ff00]" />
        ) : (
          <Upload className="h-8 w-8 text-[#d9ff00]/70" />
        )}
      </motion.div>

      {/* Text */}
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">
          {isDragging ? 'Release to upload' : label || 'Drop image here'}
        </p>
        {!isDragging && !isUploading && !isSuccess && (
          <p className="mt-1 text-xs text-muted-foreground">or click to browse</p>
        )}
        {isUploading && (
          <p className="mt-1 text-xs text-[#d9ff00]/80">Uploading…</p>
        )}
        {isSuccess && (
          <p className="mt-1 text-xs text-[#d9ff00]/80">Upload complete</p>
        )}
      </div>

      {/* Accepted formats hint */}
      {!isDragging && !isUploading && !isSuccess && (
        <div className="flex items-center gap-1.5">
          {['PNG', 'JPEG', 'WebP', 'GIF'].map((fmt) => (
            <Badge
              key={fmt}
              variant="secondary"
              className="bg-surface border-border/40 text-[10px] text-muted-foreground"
            >
              {fmt}
            </Badge>
          ))}
          <span className="text-[10px] text-muted-foreground/60 ml-1">Max {MAX_FILE_SIZE_LABEL}</span>
        </div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Internal: Preview Card
// ---------------------------------------------------------------------------

function PreviewCard({
  preview,
  uploadState,
  onRemove,
  onUseAsReference,
  onUseAsInput,
}: {
  preview: PreviewData;
  uploadState: UploadState;
  onRemove: () => void;
  onUseAsReference: () => void;
  onUseAsInput: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="relative overflow-hidden rounded-xl border border-border/40 bg-surface/80 glass"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-black/20">
        <img
          src={preview.objectUrl}
          alt={preview.file.name}
          className="h-full w-full object-contain"
        />

        {/* Remove button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white/80 backdrop-blur-sm transition-colors hover:bg-destructive hover:text-white"
          aria-label="Remove image"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Upload progress overlay */}
        <AnimatePresence>
          {uploadState === 'uploading' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            >
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 text-[#d9ff00] animate-spin" />
                <span className="text-xs text-white/80">Uploading…</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success badge */}
        <AnimatePresence>
          {uploadState === 'success' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute top-2 left-2"
            >
              <Badge className="bg-[#d9ff00]/90 text-background gap-1 text-[10px] font-semibold">
                <Check className="h-3 w-3" />
                Uploaded
              </Badge>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Info + Actions */}
      <div className="p-3 space-y-3">
        {/* File info */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <p className="truncate text-xs font-medium text-foreground">
            {preview.file.name}
          </p>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {formatFileSize(preview.file.size)}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onUseAsReference();
            }}
            disabled={uploadState === 'uploading'}
            className="flex-1 gap-1.5 border-border/50 bg-surface text-xs hover:border-[#d9ff00]/40 hover:bg-[#d9ff00]/5 hover:text-[#d9ff00]"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            Use as Reference
          </Button>
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onUseAsInput();
            }}
            disabled={uploadState === 'uploading'}
            className="flex-1 gap-1.5 bg-[#d9ff00] text-background text-xs font-semibold hover:bg-[#c5eb00]"
          >
            <Upload className="h-3.5 w-3.5" />
            Use as Input
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Internal: Compact Trigger Button
// ---------------------------------------------------------------------------

function CompactTrigger({ label }: { label: string }) {
  return (
    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
      <Button
        variant="outline"
        className="gap-2 border-border/50 bg-surface/80 hover:border-[#d9ff00]/40 hover:bg-[#d9ff00]/5 hover:text-[#d9ff00]"
      >
        <ImagePlus className="h-4 w-4" />
        <span className="text-xs">{label || 'Upload Image'}</span>
      </Button>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ImageUpload({
  onUploadComplete,
  onRemove,
  currentImageUrl,
  compact = false,
  label = 'Upload Image',
}: ImageUploadProps) {
  // State -------------------------------------------------------------------
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(currentImageUrl ?? null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived -----------------------------------------------------------------
  const hasExistingImage = !!(currentImageUrl || uploadedUrl);

  // Cleanup object URL on unmount or preview change
  const cleanupPreview = useCallback(() => {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev.objectUrl);
      return null;
    });
  }, []);

  // Reset to idle -----------------------------------------------------------
  const resetState = useCallback(() => {
    cleanupPreview();
    setUploadState('idle');
    setUploadedUrl(currentImageUrl ?? null);
  }, [cleanupPreview, currentImageUrl]);

  // Drag handlers -----------------------------------------------------------
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploadState !== 'uploading') {
      setUploadState('dragging');
    }
  }, [uploadState]);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to idle if we're in dragging state (don't interfere with other states)
    if (uploadState === 'dragging') {
      setUploadState(preview ? 'success' : 'idle');
    }
  }, [uploadState, preview]);

  // File processing ---------------------------------------------------------
  const processFile = useCallback(
    (file: File) => {
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        setUploadState('idle');
        return;
      }

      // Clean up old preview if any
      cleanupPreview();

      const objectUrl = URL.createObjectURL(file);
      setPreview({ file, objectUrl });
      setUploadState('idle'); // Will show preview, user can then upload

      // Auto-start upload
      const formData = new FormData();
      formData.append('file', file);

      setUploadState('uploading');

      fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `Upload failed (${res.status})`);
          }
          const data = await res.json();
          const url: string = data.url;
          setUploadedUrl(url);
          setUploadState('success');
          onUploadComplete(url);
          toast.success('Image uploaded successfully');
        })
        .catch((err: unknown) => {
          setUploadState('error');
          toast.error(err instanceof Error ? err.message : 'Upload failed');
          // Don't remove preview so user can retry
        });
    },
    [cleanupPreview, onUploadComplete]
  );

  // Drop handler ------------------------------------------------------------
  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (uploadState === 'uploading') return;

      const files = e.dataTransfer.files;
      if (files.length === 0) {
        setUploadState('idle');
        return;
      }

      processFile(files[0]);
    },
    [uploadState, processFile]
  );

  // Click to browse ---------------------------------------------------------
  const handleClick = useCallback(() => {
    if (uploadState === 'uploading') return;
    fileInputRef.current?.click();
  }, [uploadState]);

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      processFile(files[0]);

      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [processFile]
  );

  // Remove handler ----------------------------------------------------------
  const handleRemove = useCallback(() => {
    resetState();
    onRemove?.();
  }, [resetState, onRemove]);

  // Use as reference/input --------------------------------------------------
  const handleUseAsReference = useCallback(() => {
    if (uploadedUrl) {
      onUploadComplete(uploadedUrl);
      toast.success('Image set as reference');
    }
  }, [uploadedUrl, onUploadComplete]);

  const handleUseAsInput = useCallback(() => {
    if (uploadedUrl) {
      onUploadComplete(uploadedUrl);
      toast.success('Image set as input');
    }
  }, [uploadedUrl, onUploadComplete]);

  // ========================================================================
  // RENDER — Compact Mode
  // ========================================================================

  if (compact) {
    return (
      <>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <div>
              <CompactTrigger label={label} />
            </div>
          </DialogTrigger>

          <DialogContent className="glass bg-[#111111] border-border/40 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground flex items-center gap-2">
                <ImagePlus className="h-5 w-5 text-[#d9ff00]" />
                {label}
              </DialogTitle>
              <DialogDescription className="sr-only">Upload a reference image for generation</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <AnimatePresence mode="wait">
                {preview ? (
                  <PreviewCard
                    key="preview"
                    preview={preview}
                    uploadState={uploadState}
                    onRemove={handleRemove}
                    onUseAsReference={() => {
                      handleUseAsReference();
                      setDialogOpen(false);
                    }}
                    onUseAsInput={() => {
                      handleUseAsInput();
                      setDialogOpen(false);
                    }}
                  />
                ) : (
                  <DropzoneArea
                    key="dropzone"
                    uploadState={uploadState}
                    preview={preview}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={handleClick}
                    label={label}
                  />
                )}
              </AnimatePresence>

              {/* Existing image display */}
              {hasExistingImage && !preview && (
                <div className="space-y-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Current Image
                  </p>
                  <div className="relative overflow-hidden rounded-lg border border-border/40 bg-black/20">
                    <img
                      src={currentImageUrl || uploadedUrl || ''}
                      alt="Current"
                      className="h-20 w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleRemove}
                      className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/80 transition-colors hover:bg-destructive hover:text-white"
                      aria-label="Remove current image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                onChange={handleFileChange}
                className="hidden"
                aria-hidden="true"
              />
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // ========================================================================
  // RENDER — Full Mode
  // ========================================================================

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        {preview ? (
          <PreviewCard
            key="preview"
            preview={preview}
            uploadState={uploadState}
            onRemove={handleRemove}
            onUseAsReference={handleUseAsReference}
            onUseAsInput={handleUseAsInput}
          />
        ) : (
          <DropzoneArea
            key="dropzone"
            uploadState={uploadState}
            preview={preview}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
            label={label}
          />
        )}
      </AnimatePresence>

      {/* Existing image display when no preview */}
      {hasExistingImage && !preview && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Current Image
          </p>
          <div className="relative overflow-hidden rounded-xl border border-border/40 bg-black/20 glass">
            <img
              src={currentImageUrl || uploadedUrl || ''}
              alt="Current"
              className="h-24 w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between p-2.5">
              <Badge className="bg-[#d9ff00]/20 text-[#d9ff00] text-[10px] border-[#d9ff00]/20">
                Active
              </Badge>
              <button
                type="button"
                onClick={handleRemove}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white/80 backdrop-blur-sm transition-colors hover:bg-destructive hover:text-white"
                aria-label="Remove current image"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />
    </div>
  );
}
