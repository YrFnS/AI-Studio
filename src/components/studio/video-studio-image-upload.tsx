'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  X,
  Upload,
  Link,
} from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Image Upload Slot (reusable for Reference / Start Frame / End Frame)
// ---------------------------------------------------------------------------

export function ImageUploadSlot({
  value,
  onChange,
  label,
  description,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  label: React.ReactNode;
  description: string;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlMode, setUrlMode] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  // Handle file upload → convert to base64
  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Handle drag events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so the same file can be selected again
    e.target.value = '';
  };

  // Handle URL submission
  const handleUrlSubmit = () => {
    const trimmed = urlInput.trim();
    if (trimmed) {
      onChange(trimmed);
      setUrlInput('');
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        {label}
      </div>
      <p className="text-[10px] text-muted-foreground/60 -mt-1">{description}</p>

      {value ? (
        // Show preview with remove button
        <div className="relative group rounded-lg border border-border/40 overflow-hidden">
          <img
            src={value}
            alt={label}
            className="h-24 w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded-full bg-destructive/90 p-1.5 text-white shadow-lg"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <Badge className="absolute top-1.5 left-1.5 h-4 px-1.5 text-[8px] bg-[#d9ff00]/20 text-[#d9ff00] border-[#d9ff00]/30 backdrop-blur-sm">
            SET
          </Badge>
        </div>
      ) : urlMode ? (
        // Show URL input
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUrlSubmit();
              }}
              placeholder="Paste image URL…"
              className="bg-surface border-border/60 text-sm placeholder:text-muted-foreground/40 focus-visible:ring-[#d9ff00]/30"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleUrlSubmit}
              className="shrink-0 border-border/60 bg-surface hover:bg-surface-hover"
            >
              <Link className="h-3.5 w-3.5" />
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setUrlMode(false)}
            className="text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            ← Back to upload
          </button>
        </div>
      ) : (
        // Show drag-and-drop zone
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed
            px-4 py-6 cursor-pointer transition-all
            ${isDragOver
              ? 'border-[#d9ff00]/60 bg-[#d9ff00]/5'
              : 'border-border/40 bg-surface hover:border-border/60 hover:bg-surface-hover'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <motion.div
            animate={isDragOver ? { scale: 1.15, y: -2 } : { scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <Upload className={`h-5 w-5 ${isDragOver ? 'text-[#d9ff00]' : 'text-muted-foreground/60'}`} />
          </motion.div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              {isDragOver ? 'Drop image here' : 'Click or drag to upload'}
            </p>
            <p className="text-[10px] text-muted-foreground/40 mt-0.5">PNG, JPG, WebP</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setUrlMode(true);
            }}
            className="text-[10px] text-[#d9ff00]/70 hover:text-[#d9ff00] transition-colors underline underline-offset-2"
          >
            Or paste URL
          </button>
        </div>
      )}
    </div>
  );
}
