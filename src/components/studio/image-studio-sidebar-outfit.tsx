'use client';

import { useState } from 'react';
import { Shirt, X, Upload } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Label } from '@/components/ui/label';
import { CollapsibleHeader } from '@/components/studio/image-studio-sidebar-shared';

// ---------------------------------------------------------------------------
// Change Outfit (Virtual Try-On) — CSS-only collapsible, no framer-motion
// ---------------------------------------------------------------------------

export function SidebarChangeOutfit() {
  // Zustand store
  const imageOutfitDescription = useAppStore((s) => s.imageOutfitDescription);
  const setImageOutfitDescription = useAppStore((s) => s.setImageOutfitDescription);
  const imageOutfitImageUrl = useAppStore((s) => s.imageOutfitImageUrl);
  const setImageOutfitImageUrl = useAppStore((s) => s.setImageOutfitImageUrl);

  // Collapsible state
  const [changeOutfitOpen, setChangeOutfitOpen] = useState(false);

  // URL input state
  const [outfitUrlInput, setOutfitUrlInput] = useState('');
  const [showOutfitUrlInput, setShowOutfitUrlInput] = useState(false);

  return (
    <div>
      <CollapsibleHeader
        icon={<Shirt className={`h-3.5 w-3.5 ${(imageOutfitDescription || imageOutfitImageUrl) ? 'text-[#d9ff00]' : 'text-muted-foreground'}`} />}
        label="Outfit"
        isActive={!!(imageOutfitDescription || imageOutfitImageUrl)}
        activeCount={(imageOutfitDescription ? 1 : 0) + (imageOutfitImageUrl ? 1 : 0)}
        isOpen={changeOutfitOpen}
        onToggle={() => setChangeOutfitOpen(!changeOutfitOpen)}
      />
      <div
        className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out ${
          changeOutfitOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="space-y-2.5 pt-1.5">
          {/* Outfit Description */}
          <div className="space-y-1">
            <Label className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Outfit Description
            </Label>
            <textarea
              value={imageOutfitDescription}
              onChange={(e) => setImageOutfitDescription(e.target.value)}
              placeholder="Describe the outfit you want to change to..."
              rows={2}
              className="w-full rounded-md border border-border/30 bg-surface/50 px-2.5 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/40 focus:border-[#d9ff00]/30 focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/15 resize-none transition-colors duration-150"
            />
            <p className="text-[8px] text-muted-foreground/40 leading-relaxed">
              e.g. &quot;red evening gown with gold embroidery&quot;
            </p>
          </div>

          {/* Outfit Reference Image Upload */}
          <div className="space-y-1">
            <Label className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Reference Image
            </Label>

            {imageOutfitImageUrl ? (
              <div className="relative group/img rounded-md overflow-hidden border border-border/30">
                <img
                  src={imageOutfitImageUrl}
                  alt="Outfit reference"
                  className="w-full h-28 object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setImageOutfitImageUrl(null)}
                    className="flex items-center gap-1 rounded-md bg-red-500/80 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-red-500 transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                    Remove
                  </button>
                </div>
                <div className="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[8px] text-white/70 backdrop-blur-sm">
                  Reference attached
                </div>
              </div>
            ) : (
              <div
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const result = ev.target?.result as string;
                        if (result) setImageOutfitImageUrl(result);
                      };
                      reader.readAsDataURL(file);
                    }
                  };
                  input.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  (e.currentTarget as HTMLElement).classList.add('border-[#d9ff00]/40', 'bg-[#d9ff00]/5');
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  (e.currentTarget as HTMLElement).classList.remove('border-[#d9ff00]/40', 'bg-[#d9ff00]/5');
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  (e.currentTarget as HTMLElement).classList.remove('border-[#d9ff00]/40', 'bg-[#d9ff00]/5');
                  const file = e.dataTransfer.files?.[0];
                  if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const result = ev.target?.result as string;
                      if (result) setImageOutfitImageUrl(result);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                className="flex flex-col items-center justify-center gap-1.5 rounded-md border-dashed border-2 border-border/30 bg-surface/30 p-3 cursor-pointer hover:border-border/50 hover:bg-surface/50 transition-all"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#d9ff00]/10">
                  <Upload className="h-3.5 w-3.5 text-[#d9ff00]" />
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-medium text-muted-foreground/60">Drop image or click</p>
                  <p className="text-[8px] text-muted-foreground/30">PNG, JPG, WEBP</p>
                </div>
              </div>
            )}

            {/* Or paste URL toggle */}
            {!imageOutfitImageUrl && (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setShowOutfitUrlInput(!showOutfitUrlInput)}
                  className="text-[8px] text-[#d9ff00]/60 hover:text-[#d9ff00] underline underline-offset-2 transition-colors"
                >
                  {showOutfitUrlInput ? 'Hide URL input' : 'Or paste URL'}
                </button>
                {showOutfitUrlInput && (
                  <div className="flex gap-1">
                    <input
                      type="url"
                      value={outfitUrlInput}
                      onChange={(e) => setOutfitUrlInput(e.target.value)}
                      placeholder="https://example.com/outfit.jpg"
                      className="flex-1 rounded-md border border-border/30 bg-surface/50 px-2 py-0.5 text-[9px] text-foreground placeholder:text-muted-foreground/40 focus:border-[#d9ff00]/30 focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/15 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (outfitUrlInput.trim()) {
                          setImageOutfitImageUrl(outfitUrlInput.trim());
                          setOutfitUrlInput('');
                          setShowOutfitUrlInput(false);
                        }
                      }}
                      disabled={!outfitUrlInput.trim()}
                      className="rounded-md border border-[#d9ff00]/25 bg-[#d9ff00]/10 px-2 py-0.5 text-[9px] font-medium text-[#d9ff00] hover:bg-[#d9ff00]/20 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    >
                      Load
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Preview Card */}
          {(imageOutfitDescription || imageOutfitImageUrl) && (
            <div className="rounded-md border border-[#d9ff00]/15 bg-[#d9ff00]/5 p-2 space-y-0.5">
              <div className="flex items-center gap-1">
                <Shirt className="h-2.5 w-2.5 text-[#d9ff00]" />
                <span className="text-[8px] font-semibold text-[#d9ff00] uppercase tracking-wider">Outfit Change</span>
              </div>
              <p className="text-[9px] text-muted-foreground/70 leading-relaxed">
                {imageOutfitDescription || 'Custom outfit'}
                {imageOutfitImageUrl && (
                  <span className="text-[#d9ff00]/60"> + ref image</span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
