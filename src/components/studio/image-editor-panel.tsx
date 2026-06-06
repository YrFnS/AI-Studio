'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Paintbrush,
  Eraser,
  Move,
  Loader2,
  Sparkles,
  Maximize2,
  RotateCcw,
  Wand2,
  Download,
  Heart,
  Columns2,
  X,
} from 'lucide-react';
import { useApiKeys } from '@/hooks/use-api-keys';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

import type { Tool, Stroke, ProviderModel, Provider } from './image-editor-helpers';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EditorControlsPanelProps {
  imageUrl: string;
  onClose: () => void;
  providerId: string;
  onResult: (url: string) => void;
  tool: Tool;
  setTool: (t: Tool) => void;
  brushSize: number;
  setBrushSize: (v: number) => void;
  brushHardness: number;
  setBrushHardness: (v: number) => void;
  strokes: Stroke[];
  providers: Provider[];
  selectedProviderData: Provider | null;
  editModels: ProviderModel[];
  allImageModels: ProviderModel[];
  hasApiKey: boolean;
  exportMask: () => string | null;
  exportOriginalImage: () => string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EditorControlsPanel({
  imageUrl,
  onClose,
  providerId,
  onResult,
  tool,
  setTool,
  brushSize,
  setBrushSize,
  brushHardness,
  setBrushHardness,
  strokes,
  providers,
  selectedProviderData,
  editModels,
  allImageModels,
  hasApiKey,
  exportMask,
  exportOriginalImage,
}: EditorControlsPanelProps) {
  // -----------------------------------------------------------------------
  // State – Edit Controls
  // -----------------------------------------------------------------------
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // -----------------------------------------------------------------------
  // State – Results & Comparison
  // -----------------------------------------------------------------------
  const [editResult, setEditResult] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonPos, setComparisonPos] = useState(50);
  const [isDraggingComp, setIsDraggingComp] = useState(false);

  const comparisonContainerRef = useRef<HTMLDivElement>(null);
  const apiKeysHook = useApiKeys();

  // -----------------------------------------------------------------------
  // API calls
  // -----------------------------------------------------------------------
  const handleInpaint = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error('Please enter an editing prompt');
      return;
    }
    if (strokes.length === 0) {
      toast.error('Please paint a mask on the area you want to edit');
      return;
    }
    if (!selectedModel) {
      toast.error('Please select a model');
      return;
    }
    if (!hasApiKey) {
      toast.error('No API key configured for this provider');
      return;
    }

    setIsLoading(true);
    try {
      const maskBase64 = exportMask();
      const imageBase64 = exportOriginalImage();

      // Get API key from IndexedDB (BYOK model)
      const apiKey = await apiKeysHook.getKeyForProvider(providerId);
      if (!apiKey) {
        toast.error('No API key configured for this provider');
        setIsLoading(false);
        return;
      }

      const body: Record<string, unknown> = {
        providerId,
        modelId: selectedModel,
        prompt: prompt.trim(),
        type: 'edit',
        image: imageBase64,
        mask: maskBase64,
        apiKey,
      };

      const res = await fetch('/api/generate/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Inpainting failed');

      if (data.status === 'completed' && (data.images?.[0] || data.urls?.[0])) {
        const resultUrl = data.images?.[0] || data.urls[0];
        setEditResult(resultUrl);
        onResult(resultUrl);
        toast.success('Inpainting completed!');
      } else if (data.status === 'processing' && data.id) {
        toast.info('Inpainting in progress…');
        // Poll for result
        const poll = setInterval(async () => {
          try {
            const sr = await fetch(`/api/generate/status?id=${data.id}${apiKey ? `&apiKey=${encodeURIComponent(apiKey)}` : ''}`);
            const sd = await sr.json();
            if (sd.status === 'completed') {
              clearInterval(poll);
              setEditResult(sd.resultUrl || sd.urls?.[0]);
              onResult(sd.resultUrl || sd.urls?.[0]);
              setIsLoading(false);
              toast.success('Inpainting completed!');
            } else if (sd.status === 'failed') {
              clearInterval(poll);
              setIsLoading(false);
              toast.error(sd.error || 'Inpainting failed');
            }
          } catch {
            /* retry */
          }
        }, 3000);
        return; // don't setIsLoading(false) yet
      } else {
        throw new Error('Unexpected response');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Inpainting failed');
    }
    setIsLoading(false);
  }, [prompt, strokes, selectedModel, hasApiKey, providerId, apiKeysHook, exportMask, exportOriginalImage, onResult]);

  const handleUpscale = useCallback(async () => {
    if (!selectedModel || !hasApiKey) {
      toast.error('Please configure a provider with an API key');
      return;
    }

    setIsLoading(true);
    try {
      const imageBase64 = exportOriginalImage();
      // Find an upscale-capable model, fall back to current model
      const upscaleModel =
        editModels.find((m) => (m.capabilities || '').toLowerCase().includes('upscale'))?.modelId ||
        selectedModel;

      // Get API key from IndexedDB (BYOK model)
      const apiKey = await apiKeysHook.getKeyForProvider(providerId);
      if (!apiKey) {
        toast.error('No API key configured for this provider');
        setIsLoading(false);
        return;
      }

      const body: Record<string, unknown> = {
        providerId,
        modelId: upscaleModel,
        prompt: 'Upscale this image to 2x resolution',
        type: 'upscale',
        inputImageUrl: imageBase64,
        apiKey,
      };

      const res = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upscale failed');

      if (data.status === 'completed' && data.urls?.[0]) {
        setEditResult(data.urls[0]);
        onResult(data.urls[0]);
        toast.success('Upscale completed!');
      } else if (data.status === 'processing') {
        toast.info('Upscale in progress…');
      } else {
        throw new Error('Unexpected response');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upscale failed');
    }
    setIsLoading(false);
  }, [selectedModel, hasApiKey, providerId, apiKeysHook, editModels, exportOriginalImage, onResult]);

  const handleVariation = useCallback(async () => {
    if (!selectedModel) {
      toast.error('Please select a model');
      return;
    }
    if (!hasApiKey) {
      toast.error('No API key configured for this provider');
      return;
    }

    setIsLoading(true);
    try {
      const imageBase64 = exportOriginalImage();

      // Get API key from IndexedDB (BYOK model)
      const apiKey = await apiKeysHook.getKeyForProvider(providerId);
      if (!apiKey) {
        toast.error('No API key configured for this provider');
        setIsLoading(false);
        return;
      }

      const body: Record<string, unknown> = {
        providerId,
        modelId: selectedModel,
        prompt: prompt.trim() || 'Generate a variation of this image',
        type: 'variation',
        inputImageUrl: imageBase64,
        apiKey,
      };

      const res = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Variation failed');

      if (data.status === 'completed' && data.urls?.[0]) {
        setEditResult(data.urls[0]);
        onResult(data.urls[0]);
        toast.success('Variation generated!');
      } else if (data.status === 'processing') {
        toast.info('Variation in progress…');
      } else {
        throw new Error('Unexpected response');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Variation failed');
    }
    setIsLoading(false);
  }, [selectedModel, hasApiKey, providerId, apiKeysHook, prompt, exportOriginalImage, onResult]);

  // -----------------------------------------------------------------------
  // Download helper
  // -----------------------------------------------------------------------
  const handleDownload = useCallback(async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `ai-studio-edit-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast.success('Image downloaded');
    } catch {
      window.open(url, '_blank');
    }
  }, []);

  // -----------------------------------------------------------------------
  // Comparison drag handler
  // -----------------------------------------------------------------------
  const handleComparisonMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingComp(true);
  }, []);

  useEffect(() => {
    if (!isDraggingComp) return;
    const handler = (e: MouseEvent) => {
      const container = comparisonContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const pos = ((e.clientX - rect.left) / rect.width) * 100;
      setComparisonPos(Math.max(0, Math.min(100, pos)));
    };
    const upHandler = () => setIsDraggingComp(false);
    window.addEventListener('mousemove', handler);
    window.addEventListener('mouseup', upHandler);
    return () => {
      window.removeEventListener('mousemove', handler);
      window.removeEventListener('mouseup', upHandler);
    };
  }, [isDraggingComp]);

  // -----------------------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------------------
  return (
    <>
      {/* =============================================================== */}
      {/* RIGHT – Controls Panel                                          */}
      {/* =============================================================== */}
      <div className="glass-strong flex w-[340px] shrink-0 flex-col border-l border-border/40">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#d9ff00]/10">
                <Wand2 className="h-3.5 w-3.5 text-[#d9ff00]" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Image Editor</h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-5 p-4">
              {/* ---- Brush Settings ---- */}
              <div className="space-y-3">
                <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Brush Settings
                </Label>

                {/* Brush Size */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Size</span>
                    <span className="text-xs font-mono text-[#d9ff00]">{brushSize}px</span>
                  </div>
                  <Slider
                    value={[brushSize]}
                    onValueChange={([v]) => setBrushSize(v)}
                    min={5}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground/50">
                    <span>5</span>
                    <span>100</span>
                  </div>
                </div>

                {/* Brush Hardness */}
                {tool !== 'pan' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Hardness</span>
                      <span className="text-xs font-mono text-[#d9ff00]">{brushHardness}%</span>
                    </div>
                    <Slider
                      value={[brushHardness]}
                      onValueChange={([v]) => setBrushHardness(v)}
                      min={0}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground/50">
                      <span>Soft</span>
                      <span>Hard</span>
                    </div>
                  </div>
                )}

                {/* Quick tool badges */}
                <div className="flex gap-1.5">
                  {(
                    [
                      { id: 'brush' as Tool, icon: Paintbrush, label: 'Brush' },
                      { id: 'eraser' as Tool, icon: Eraser, label: 'Eraser' },
                      { id: 'pan' as Tool, icon: Move, label: 'Pan' },
                    ] as const
                  ).map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTool(id)}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition-all ${
                        tool === id
                          ? 'border-[#d9ff00]/40 bg-[#d9ff00]/10 text-[#d9ff00]'
                          : 'border-border/40 bg-surface text-muted-foreground hover:border-border hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <Separator className="opacity-30" />

              {/* ---- Edit Controls ---- */}
              <div className="space-y-3">
                <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Edit Controls
                </Label>

                {/* Prompt */}
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Inpainting Prompt</span>
                  <Input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe what to change in the masked area..."
                    className="bg-surface border-border/60 text-sm placeholder:text-muted-foreground/40 focus-visible:ring-[#d9ff00]/30"
                  />
                </div>

                {/* Model Selector */}
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Model</span>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="w-full bg-surface border-border/60 text-sm">
                      <SelectValue placeholder="Select model…" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-border/60">
                      {/* Edit/inpaint capable models first */}
                      {editModels.length > 0 && (
                        <>
                          {editModels.map((m) => (
                            <SelectItem key={m.id} value={m.modelId}>
                              <span className="flex items-center gap-2">
                                {m.name}
                                <Badge className="ml-auto h-4 bg-[#d9ff00]/10 text-[8px] text-[#d9ff00]">
                                  EDIT
                                </Badge>
                              </span>
                            </SelectItem>
                          ))}
                        </>
                      )}
                      {/* Other image models */}
                      {allImageModels
                        .filter(
                          (m) => !editModels.some((em) => em.modelId === m.modelId),
                        )
                        .map((m) => (
                          <SelectItem key={m.id} value={m.modelId}>
                            {m.name}
                          </SelectItem>
                        ))}
                      {allImageModels.length === 0 && (
                        <SelectItem value="__none" disabled>
                          No models available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  {/* Inpaint */}
                  <div>
                    <Button
                      onClick={handleInpaint}
                      disabled={isLoading || !hasApiKey || strokes.length === 0 || !prompt.trim()}
                      className={`w-full gap-2 rounded-xl font-semibold transition-colors ${
                        isLoading
                          ? 'bg-[#d9ff00]/20 text-[#d9ff00] cursor-wait'
                          : !hasApiKey || strokes.length === 0
                            ? 'bg-surface text-muted-foreground cursor-not-allowed'
                            : 'bg-[#d9ff00] text-background hover:bg-[#c5eb00] neon-glow-strong'
                      }`}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Paintbrush className="h-4 w-4" />
                      )}
                      Inpaint
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    {/* Upscale 2x */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleUpscale}
                      disabled={isLoading || !hasApiKey}
                      className="flex-1 gap-1.5 border-border/60 bg-surface text-xs hover:bg-surface-hover"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                      Upscale 2×
                    </Button>

                    {/* Variations */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleVariation}
                      disabled={isLoading || !hasApiKey}
                      className="flex-1 gap-1.5 border-border/60 bg-surface text-xs hover:bg-surface-hover"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Variation
                    </Button>
                  </div>
                </div>

                {/* No-key warning */}
                {!hasApiKey && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-[11px] text-destructive">
                    No API key configured. Add one in Settings.
                  </div>
                )}
              </div>

              <Separator className="opacity-30" />

              {/* ---- Edit Result ---- */}
              {editResult && (
                <div className="space-y-3">
                  <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Edit Result
                  </Label>

                  {/* Result Image */}
                  <div className="relative overflow-hidden rounded-xl border border-border/40 bg-surface">
                    <img
                      src={editResult}
                      alt="Edit result"
                      className="w-full h-auto object-contain max-h-48"
                    />
                  </div>

                  {/* Result Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(editResult)}
                      className="flex-1 gap-1.5 border-border/60 bg-surface text-xs hover:bg-surface-hover"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toast.success('Added to favorites')}
                      className="flex-1 gap-1.5 border-border/60 bg-surface text-xs hover:bg-surface-hover"
                    >
                      <Heart className="h-3.5 w-3.5" />
                      Favorite
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleInpaint()}
                    disabled={isLoading}
                    className="w-full gap-1.5 border-border/60 bg-surface text-xs hover:bg-surface-hover"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Regenerate
                  </Button>

                  <Separator className="opacity-30" />

                  {/* Before / After Comparison Toggle */}
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowComparison(!showComparison)}
                      className={`w-full gap-1.5 text-xs transition-all ${
                        showComparison
                          ? 'border-[#d9ff00]/40 bg-[#d9ff00]/10 text-[#d9ff00]'
                          : 'border-border/60 bg-surface hover:bg-surface-hover'
                      }`}
                    >
                      <Columns2 className="h-3.5 w-3.5" />
                      {showComparison ? 'Hide Comparison' : 'Before / After'}
                    </Button>
                  </div>
                </div>
              )}

              {/* ---- Loading Indicator ---- */}
              {isLoading && (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-[#d9ff00]/20 bg-[#d9ff00]/5 p-4">
                  <Loader2 className="h-6 w-6 animate-spin text-[#d9ff00]" />
                  <span className="text-xs text-[#d9ff00]">Processing edit…</span>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* =============================================================== */}
        {/* BEFORE / AFTER COMPARISON OVERLAY                                */}
        {/* =============================================================== */}
        <AnimatePresence>
          {showComparison && editResult && (
            <motion.div
              key="comparison"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md"
            >
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowComparison(false)}
                className="absolute top-4 right-4 z-10 h-10 w-10 text-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </Button>

              {/* Labels */}
              <div className="absolute top-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-4">
                <Badge className="bg-surface/80 text-xs text-foreground backdrop-blur-sm">
                  Original
                </Badge>
                <Badge className="bg-[#d9ff00]/20 text-xs text-[#d9ff00] backdrop-blur-sm">
                  Edited
                </Badge>
              </div>

              {/* Comparison container */}
              <div
                ref={comparisonContainerRef}
                className="relative h-[80vh] w-[80vw] max-w-5xl overflow-hidden rounded-2xl border border-border/40"
              >
                {/* After image (full) */}
                <img
                  src={editResult}
                  alt="Edited"
                  className="absolute inset-0 h-full w-full object-contain"
                  draggable={false}
                />

                {/* Before image (clipped) */}
                <div
                  className="absolute inset-0"
                  style={{
                    clipPath: `inset(0 ${100 - comparisonPos}% 0 0)`,
                  }}
                >
                  <img
                    src={imageUrl}
                    alt="Original"
                    className="h-full w-full object-contain"
                    draggable={false}
                  />
                </div>

                {/* Divider line */}
                <div
                  className="absolute top-0 bottom-0 z-10 w-0.5 cursor-ew-resize bg-white/80"
                  style={{ left: `${comparisonPos}%` }}
                  onMouseDown={handleComparisonMouseDown}
                >
                  {/* Handle */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-black/60 backdrop-blur-sm">
                      <Columns2 className="h-4 w-4 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
  );
}
