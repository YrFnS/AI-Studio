'use client';

import { useState } from 'react';
import { Zap, BookOpen } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { TemplateBrowser } from '@/components/studio/image-studio-helpers';
import { CollapsibleHeader } from '@/components/studio/image-studio-sidebar-shared';

// ---------------------------------------------------------------------------
// Quick Prompts — CSS-only collapsible, no framer-motion
// ---------------------------------------------------------------------------

export function SidebarQuickPrompts() {
  // Zustand store
  const setImagePrompt = useAppStore((s) => s.setImagePrompt);
  const setImageNegativePrompt = useAppStore((s) => s.setImageNegativePrompt);
  const setImageAspectRatio = useAppStore((s) => s.setImageAspectRatio);
  const setActiveStylePreset = useAppStore((s) => s.setActiveStylePreset);

  // Collapsible state
  const [quickPromptsOpen, setQuickPromptsOpen] = useState(true);

  return (
    <div>
      <CollapsibleHeader
        icon={<Zap className="h-3.5 w-3.5 text-muted-foreground" />}
        label="Quick Prompts"
        isActive={false}
        activeCount={0}
        isOpen={quickPromptsOpen}
        onToggle={() => setQuickPromptsOpen(!quickPromptsOpen)}
      />
      <div
        className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out ${
          quickPromptsOpen ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="space-y-2 pt-1.5">
          <div className="flex items-center justify-end">
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-md border border-[#d9ff00]/25 bg-[#d9ff00]/5 px-2 py-0.5 text-[9px] font-medium text-[#d9ff00] hover:bg-[#d9ff00]/10 transition-colors duration-150"
                >
                  <BookOpen className="h-2.5 w-2.5" />
                  Templates
                </button>
              </DialogTrigger>
              <DialogContent className="glass-strong sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle className="text-foreground flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-[#d9ff00]" />
                    Prompt Templates Library
                  </DialogTitle>
                  <DialogDescription className="sr-only">Browse and select prompt templates for image generation</DialogDescription>
                </DialogHeader>
                <TemplateBrowser
                  onSelect={(template) => {
                    setImagePrompt(template.prompt);
                    if (template.suggestedStylePreset || template.style) {
                      setActiveStylePreset(
                        template.suggestedStylePreset ||
                          template.style!.toLowerCase().replace(/\s+/g, '-')
                      );
                    }
                    if (template.suggestedAspectRatio || template.aspectRatio) {
                      setImageAspectRatio(
                        template.suggestedAspectRatio || template.aspectRatio!
                      );
                    }
                    if (template.negativePrompt) {
                      setImageNegativePrompt(template.negativePrompt);
                    }
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex flex-wrap gap-1">
            {[
              { label: '🎨 Portrait', prompt: 'A professional portrait photo of a person, studio lighting, shallow depth of field, 85mm lens, high detail' },
              { label: '🏔️ Landscape', prompt: 'A breathtaking mountain landscape at golden hour, dramatic clouds, reflection in lake, ultra detailed, 8k' },
              { label: '🏢 Product', prompt: 'A professional product photography shot on clean white background, soft studio lighting, commercial quality' },
              { label: '📸 Cinematic', prompt: 'A cinematic film still, dramatic lighting, anamorphic lens flare, color graded, 35mm film grain' },
              { label: '🎭 Fantasy', prompt: 'An epic fantasy scene, magical atmosphere, ethereal lighting, detailed environment, mystical creatures' },
              { label: '🏙️ Architecture', prompt: 'Modern architectural photography, clean lines, dramatic perspective, golden hour lighting, ultra detailed' },
            ].map((tmpl) => (
              <button
                key={tmpl.label}
                type="button"
                onClick={() => setImagePrompt(tmpl.prompt)}
                className="whitespace-nowrap overflow-hidden rounded-md border border-transparent bg-surface/60 px-2 py-1 text-[10px] text-muted-foreground hover:border-[#d9ff00]/25 hover:bg-[#d9ff00]/5 hover:text-[#d9ff00] transition-colors duration-150"
              >
                {tmpl.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
