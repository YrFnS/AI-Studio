'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Heart,
  X,
  ArrowLeft,
  Columns2,
  Loader2,
  Sparkles,
  Maximize2,
  RotateCcw,
  Wand2,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useApiKeys } from '@/hooks/use-api-keys';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ComparisonSlider } from '@/components/studio/comparison-slider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tool = 'brush' | 'eraser' | 'pan';

interface StrokePoint {
  x: number;
  y: number;
}

interface Stroke {
  points: StrokePoint[];
  size: number;
  hardness: number;
  tool: 'brush' | 'eraser';
}

interface ProviderModel {
  id: string;
  name: string;
  modelId: string;
  type: string;
  capabilities: string;
  description?: string;
  priceInfo?: string;
  isDefault: boolean;
}

interface Provider {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  color?: string;
  icon?: string;
  models: ProviderModel[];
}

export interface ImageEditorProps {
  imageUrl: string;
  onClose: () => void;
  providerId: string;
  onResult: (url: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers – Stroke Rendering
// ---------------------------------------------------------------------------

function drawSoftCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  hardness: number,
  color: string,
  transparentColor: string,
) {
  const r = Math.max(radius, 0.5);
  if (hardness >= 0.99) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    return;
  }

  const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
  gradient.addColorStop(0, color);
  gradient.addColorStop(Math.max(hardness, 0.01), color);
  gradient.addColorStop(1, transparentColor);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
}

function renderStrokeOnCtx(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  color: string,
  transparentColor: string,
) {
  const { points, size, hardness, tool } = stroke;
  if (points.length === 0) return;

  const radius = size / 2;

  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
  } else {
    ctx.globalCompositeOperation = 'source-over';
  }

  if (hardness >= 0.99) {
    // Hard brush – use lineTo for smooth continuous strokes
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    if (points.length === 1) {
      // Single dot
      ctx.lineTo(points[0].x + 0.1, points[0].y);
    }
    ctx.stroke();
  } else {
    // Soft brush – draw individual circles, interpolate for smooth coverage
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      drawSoftCircle(ctx, p.x, p.y, radius, hardness, color, transparentColor);

      if (i > 0) {
        const prev = points[i - 1];
        const dist = Math.hypot(p.x - prev.x, p.y - prev.y);
        const step = Math.max(size * 0.2, 1);
        const steps = Math.ceil(dist / step);
        for (let j = 1; j < steps; j++) {
          const t = j / steps;
          const ix = prev.x + (p.x - prev.x) * t;
          const iy = prev.y + (p.y - prev.y) * t;
          drawSoftCircle(ctx, ix, iy, radius, hardness, color, transparentColor);
        }
      }
    }
  }

  ctx.globalCompositeOperation = 'source-over';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImageEditor({
  imageUrl,
  onClose,
  providerId,
  onResult,
}: ImageEditorProps) {
  // -----------------------------------------------------------------------
  // Store
  // -----------------------------------------------------------------------
  const { isImageGenerating, setIsImageGenerating, providerVersion } = useAppStore();
  const apiKeysHook = useApiKeys();

  // -----------------------------------------------------------------------
  // State – Tools & Canvas
  // -----------------------------------------------------------------------
  const [tool, setTool] = useState<Tool>('brush');
  const [brushSize, setBrushSize] = useState(30);
  const [brushHardness, setBrushHardness] = useState(80);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // Stroke history
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [undoneStrokes, setUndoneStrokes] = useState<Stroke[]>([]);
  const [isPainting, setIsPainting] = useState(false);
  const currentStrokeRef = useRef<Stroke | null>(null);

  // Pan
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Cursor
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Image
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDims, setImageDims] = useState({ width: 0, height: 0 });
  const imageObjRef = useRef<HTMLImageElement | null>(null);

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

  // -----------------------------------------------------------------------
  // State – Providers
  // -----------------------------------------------------------------------
  const [providers, setProviders] = useState<Provider[]>([]);

  // -----------------------------------------------------------------------
  // Refs
  // -----------------------------------------------------------------------
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const baseDisplayRef = useRef({ width: 0, height: 0 });
  const viewportSizeRef = useRef({ width: 0, height: 0 });
  const comparisonContainerRef = useRef<HTMLDivElement>(null);

  // -----------------------------------------------------------------------
  // Derived
  // -----------------------------------------------------------------------
  const selectedProviderData = providers.find((p) => p.id === providerId) ?? null;
  const editModels =
    selectedProviderData?.models.filter((m) => {
      const caps = (m.capabilities || '').toLowerCase();
      return (
        m.type === 'image' &&
        (caps.includes('edit') || caps.includes('inpaint') || caps.includes('upscale'))
      );
    }) ?? [];
  const allImageModels = selectedProviderData?.models.filter((m) => m.type === 'image') ?? [];
  const hasApiKey = apiKeysHook.hasKey(providerId);

  // -----------------------------------------------------------------------
  // Load image
  // -----------------------------------------------------------------------
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageObjRef.current = img;
      setImageDims({ width: img.naturalWidth, height: img.naturalHeight });
      setImageLoaded(true);
    };
    img.onerror = () => {
      toast.error('Failed to load image for editing');
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // -----------------------------------------------------------------------
  // Load providers
  // -----------------------------------------------------------------------
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/providers');
        if (!res.ok) throw new Error('Failed');
        const data: Provider[] = await res.json();
        setProviders(data);

        // Auto-select first edit-capable model
        const prov = data.find((p) => p.id === providerId);
        if (prov) {
          const editCapable = prov.models.filter((m) => {
            const caps = (m.capabilities || '').toLowerCase();
            return m.type === 'image' && (caps.includes('edit') || caps.includes('inpaint'));
          });
          if (editCapable.length > 0) {
            setSelectedModel(editCapable[0].modelId);
          } else if (prov.models.filter((m) => m.type === 'image').length > 0) {
            setSelectedModel(prov.models.filter((m) => m.type === 'image')[0].modelId);
          }
        }
      } catch {
        toast.error('Failed to load providers');
      }
    }
    load();
  }, [providerId, providerVersion]);

  // -----------------------------------------------------------------------
  // Calculate base display dimensions (fit image in viewport at zoom=1)
  // -----------------------------------------------------------------------
  const computeBaseDisplay = useCallback(() => {
    if (!imageLoaded || !viewportRef.current) return;
    const vp = viewportRef.current.getBoundingClientRect();
    viewportSizeRef.current = { width: vp.width, height: vp.height };
    const pad = 40;
    const availW = vp.width - pad * 2;
    const availH = vp.height - pad * 2;
    if (availW <= 0 || availH <= 0) return;

    const scale = Math.min(availW / imageDims.width, availH / imageDims.height, 1);
    baseDisplayRef.current = {
      width: imageDims.width * scale,
      height: imageDims.height * scale,
    };
  }, [imageLoaded, imageDims]);

  useEffect(() => {
    computeBaseDisplay();
  }, [computeBaseDisplay]);

  // ResizeObserver for viewport
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const observer = new ResizeObserver(() => computeBaseDisplay());
    observer.observe(vp);
    return () => observer.disconnect();
  }, [computeBaseDisplay]);

  // -----------------------------------------------------------------------
  // Mask Canvas – render all strokes
  // -----------------------------------------------------------------------
  const renderMask = useCallback(
    (targetStrokes: Stroke[]) => {
      const canvas = maskCanvasRef.current;
      if (!canvas || !imageLoaded) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const stroke of targetStrokes) {
        renderStrokeOnCtx(
          ctx,
          stroke,
          'rgba(255, 50, 50, 0.45)',
          'rgba(255, 50, 50, 0)',
        );
      }
    },
    [imageLoaded],
  );

  // Re-render mask when strokes change
  useEffect(() => {
    renderMask(strokes);
  }, [strokes, renderMask]);

  // -----------------------------------------------------------------------
  // Set mask canvas dimensions when image loads
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (imageLoaded && maskCanvasRef.current) {
      maskCanvasRef.current.width = imageDims.width;
      maskCanvasRef.current.height = imageDims.height;
    }
  }, [imageLoaded, imageDims]);

  // -----------------------------------------------------------------------
  // Coordinate conversion: viewport mouse → canvas pixel
  // -----------------------------------------------------------------------
  const viewportToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const vp = viewportRef.current;
      if (!vp) return null;
      const rect = vp.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;

      const bw = baseDisplayRef.current.width;
      const bh = baseDisplayRef.current.height;
      if (bw <= 0 || bh <= 0) return null;

      const imgLeft = (rect.width - bw * zoom) / 2 + panOffset.x;
      const imgTop = (rect.height - bh * zoom) / 2 + panOffset.y;

      const relX = (mx - imgLeft) / (bw * zoom);
      const relY = (my - imgTop) / (bh * zoom);

      return {
        x: relX * imageDims.width,
        y: relY * imageDims.height,
      };
    },
    [zoom, panOffset, imageDims],
  );

  // -----------------------------------------------------------------------
  // Canvas brush size in image pixels
  // -----------------------------------------------------------------------
  const canvasBrushSize = useCallback(() => {
    const bw = baseDisplayRef.current.width;
    if (bw <= 0 || imageDims.width <= 0) return brushSize;
    const displayToCanvas = imageDims.width / bw;
    return brushSize * displayToCanvas;
  }, [brushSize, imageDims.width]);

  // -----------------------------------------------------------------------
  // Mouse handlers – viewport
  // -----------------------------------------------------------------------
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Ctrl+click or middle mouse = pan override
      if (e.ctrlKey || e.button === 1 || tool === 'pan') {
        setIsPanning(true);
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          panX: panOffset.x,
          panY: panOffset.y,
        };
        return;
      }

      if (tool !== 'brush' && tool !== 'eraser') return;

      const pos = viewportToCanvas(e.clientX, e.clientY);
      if (!pos) return;

      const cSize = canvasBrushSize();
      const newStroke: Stroke = {
        points: [pos],
        size: cSize,
        hardness: brushHardness / 100,
        tool: tool as 'brush' | 'eraser',
      };
      currentStrokeRef.current = newStroke;
      setIsPainting(true);

      // Draw the first point immediately on the canvas
      const canvas = maskCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderStrokeOnCtx(
            ctx,
            newStroke,
            'rgba(255, 50, 50, 0.45)',
            'rgba(255, 50, 50, 0)',
          );
        }
      }
    },
    [tool, panOffset, viewportToCanvas, canvasBrushSize, brushHardness],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Update cursor position
      const vp = viewportRef.current;
      if (vp) {
        const rect = vp.getBoundingClientRect();
        setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }

      if (isPanning) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        setPanOffset({
          x: panStartRef.current.panX + dx,
          y: panStartRef.current.panY + dy,
        });
        return;
      }

      if (!isPainting || !currentStrokeRef.current) return;

      const pos = viewportToCanvas(e.clientX, e.clientY);
      if (!pos) return;

      currentStrokeRef.current.points.push(pos);

      // Draw incrementally on the canvas
      const canvas = maskCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const pts = currentStrokeRef.current.points;
          const len = pts.length;
          // Draw just the last segment for performance
          const stroke: Stroke = {
            ...currentStrokeRef.current,
            points: len >= 2 ? [pts[len - 2], pts[len - 1]] : [pts[len - 1]],
          };
          renderStrokeOnCtx(
            ctx,
            stroke,
            'rgba(255, 50, 50, 0.45)',
            'rgba(255, 50, 50, 0)',
          );
        }
      }
    },
    [isPanning, isPainting, viewportToCanvas],
  );

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isPainting && currentStrokeRef.current) {
      setStrokes((prev) => [...prev, currentStrokeRef.current!]);
      setUndoneStrokes([]); // clear redo stack on new stroke
      currentStrokeRef.current = null;
    }
    setIsPainting(false);
  }, [isPanning, isPainting]);

  const handleMouseLeave = useCallback(() => {
    setCursorPos(null);
    if (isPainting && currentStrokeRef.current) {
      setStrokes((prev) => [...prev, currentStrokeRef.current!]);
      setUndoneStrokes([]);
      currentStrokeRef.current = null;
    }
    setIsPainting(false);
    setIsPanning(false);
  }, [isPainting]);

  // -----------------------------------------------------------------------
  // Wheel zoom
  // -----------------------------------------------------------------------
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      const newZoom = Math.min(Math.max(zoom + delta * zoom, 0.1), 8);

      // Zoom towards mouse position
      const vp = viewportRef.current;
      if (!vp) {
        setZoom(newZoom);
        return;
      }
      const rect = vp.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const bw = baseDisplayRef.current.width;
      const bh = baseDisplayRef.current.height;
      if (bw <= 0 || bh <= 0) {
        setZoom(newZoom);
        return;
      }

      // Point on image the mouse is hovering (0-1 range)
      const imgLeft = (rect.width - bw * zoom) / 2 + panOffset.x;
      const imgTop = (rect.height - bh * zoom) / 2 + panOffset.y;
      const relX = (mx - imgLeft) / (bw * zoom);
      const relY = (my - imgTop) / (bh * zoom);

      // New image position after zoom
      const newImgLeft = (rect.width - bw * newZoom) / 2 + panOffset.x;
      const newImgTop = (rect.height - bh * newZoom) / 2 + panOffset.y;
      const newMx = newImgLeft + relX * bw * newZoom;
      const newMy = newImgTop + relY * bh * newZoom;

      setPanOffset((prev) => ({
        x: prev.x + (mx - newMx),
        y: prev.y + (my - newMy),
      }));
      setZoom(newZoom);
    },
    [zoom, panOffset],
  );

  // -----------------------------------------------------------------------
  // Undo / Redo
  // -----------------------------------------------------------------------
  const handleUndo = useCallback(() => {
    if (strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    setStrokes((prev) => prev.slice(0, -1));
    setUndoneStrokes((prev) => [...prev, last]);
  }, [strokes]);

  const handleRedo = useCallback(() => {
    if (undoneStrokes.length === 0) return;
    const last = undoneStrokes[undoneStrokes.length - 1];
    setUndoneStrokes((prev) => prev.slice(0, -1));
    setStrokes((prev) => [...prev, last]);
  }, [undoneStrokes]);

  const handleClearMask = useCallback(() => {
    setStrokes([]);
    setUndoneStrokes([]);
  }, []);

  // -----------------------------------------------------------------------
  // Keyboard shortcuts
  // -----------------------------------------------------------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Z = undo, Ctrl+Shift+Z = redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
      if (e.key === 'b' && !e.ctrlKey && !e.metaKey) setTool('brush');
      if (e.key === 'e' && !e.ctrlKey && !e.metaKey) setTool('eraser');
      if (e.key === 'v' && !e.ctrlKey && !e.metaKey) setTool('pan');
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo, onClose]);

  // -----------------------------------------------------------------------
  // Export mask as base64 PNG (white on black)
  // -----------------------------------------------------------------------
  const exportMask = useCallback((): string | null => {
    if (strokes.length === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = imageDims.width;
    canvas.height = imageDims.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Create mask layer (transparent)
    const maskLayer = document.createElement('canvas');
    maskLayer.width = imageDims.width;
    maskLayer.height = imageDims.height;
    const maskCtx = maskLayer.getContext('2d')!;

    for (const stroke of strokes) {
      renderStrokeOnCtx(maskCtx, stroke, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    }

    // Composite: black background + white mask
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(maskLayer, 0, 0);

    return canvas.toDataURL('image/png');
  }, [strokes, imageDims]);

  // -----------------------------------------------------------------------
  // Export original image as base64
  // -----------------------------------------------------------------------
  const exportOriginalImage = useCallback((): string | null => {
    const img = imageObjRef.current;
    if (!img) return null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL('image/png');
    } catch {
      // CORS issue – use the URL directly
      return imageUrl;
    }
  }, [imageUrl]);

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
  // Image transform for display
  // -----------------------------------------------------------------------
  const bw = baseDisplayRef.current.width;
  const bh = baseDisplayRef.current.height;
  const vpW = viewportSizeRef.current.width;
  const vpH = viewportSizeRef.current.height;
  const imgLeft = vpW > 0 && bw > 0 ? (vpW - bw * zoom) / 2 + panOffset.x : 0;
  const imgTop = vpH > 0 && bh > 0 ? (vpH - bh * zoom) / 2 + panOffset.y : 0;

  // Cursor display size (screen pixels)
  const cursorDisplaySize =
    bw > 0 && imageDims.width > 0
      ? (brushSize * zoom * bw) / imageDims.width
      : brushSize * zoom;

  // -----------------------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------------------
  return (
    <AnimatePresence>
      <motion.div
        key="image-editor"
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
        className="fixed inset-0 z-50 flex bg-background/95 backdrop-blur-md"
      >
        {/* =============================================================== */}
        {/* LEFT – Canvas Viewport                                           */}
        {/* =============================================================== */}
        <div className="relative flex-1 flex flex-col overflow-hidden">
          {/* Top Toolbar */}
          <div className="glass-strong absolute top-4 left-4 z-20 flex items-center gap-1 rounded-xl px-2 py-1.5">
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Back</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Separator orientation="vertical" className="mx-1 h-5 opacity-40" />

            {/* Tool buttons */}
            {(
              [
                { id: 'brush' as Tool, icon: Paintbrush, label: 'Brush (B)' },
                { id: 'eraser' as Tool, icon: Eraser, label: 'Eraser (E)' },
                { id: 'pan' as Tool, icon: Move, label: 'Pan (V)' },
              ] as const
            ).map(({ id, icon: Icon, label }) => (
              <TooltipProvider key={id} delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setTool(id)}
                      className={`h-8 w-8 ${
                        tool === id
                          ? 'bg-[#d9ff00]/15 text-[#d9ff00] hover:bg-[#d9ff00]/20 hover:text-[#d9ff00]'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{label}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}

            <Separator orientation="vertical" className="mx-1 h-5 opacity-40" />

            {/* Undo / Redo / Clear */}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleUndo}
                    disabled={strokes.length === 0}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Undo (Ctrl+Z)</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRedo}
                    disabled={undoneStrokes.length === 0}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <Redo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Redo (Ctrl+Shift+Z)</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClearMask}
                    disabled={strokes.length === 0}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Clear Mask</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Separator orientation="vertical" className="mx-1 h-5 opacity-40" />

            {/* Zoom controls */}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setZoom((z) => Math.max(z - 0.25, 0.1))}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Zoom Out</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <span className="min-w-[3rem] text-center text-xs font-mono text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>

            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setZoom((z) => Math.min(z + 0.25, 8))}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Zoom In</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setZoom(1);
                      setPanOffset({ x: 0, y: 0 });
                    }}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Fit to View</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Canvas Viewport */}
          <div
            ref={viewportRef}
            className="relative flex-1 overflow-hidden bg-black/60 dot-pattern"
            style={{
              cursor:
                isPanning
                  ? 'grabbing'
                  : tool === 'pan'
                    ? 'grab'
                    : tool === 'brush' || tool === 'eraser'
                      ? 'crosshair'
                      : 'default',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel}
          >
            {imageLoaded && bw > 0 && (
              <div
                style={{
                  position: 'absolute',
                  left: imgLeft,
                  top: imgTop,
                  width: bw * zoom,
                  height: bh * zoom,
                }}
              >
                {/* Original Image */}
                <img
                  src={imageUrl}
                  alt="Source"
                  className="h-full w-full object-fill select-none"
                  draggable={false}
                />

                {/* Mask Canvas Overlay */}
                <canvas
                  ref={maskCanvasRef}
                  className="absolute left-0 top-0 h-full w-full"
                  style={{ pointerEvents: 'none' }}
                />
              </div>
            )}

            {/* Loading state */}
            {!imageLoaded && (
              <div className="flex h-full w-full items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-[#d9ff00]" />
                  <span className="text-sm text-muted-foreground">Loading image…</span>
                </div>
              </div>
            )}

            {/* Brush cursor circle */}
            {cursorPos &&
              (tool === 'brush' || tool === 'eraser') &&
              !isPanning &&
              imageLoaded && (
                <div
                  className="pointer-events-none absolute z-10 rounded-full"
                  style={{
                    left: cursorPos.x - cursorDisplaySize / 2,
                    top: cursorPos.y - cursorDisplaySize / 2,
                    width: cursorDisplaySize,
                    height: cursorDisplaySize,
                    border:
                      tool === 'brush'
                        ? '2px solid rgba(217, 255, 0, 0.7)'
                        : '2px solid rgba(255, 255, 255, 0.6)',
                    boxShadow:
                      tool === 'brush'
                        ? '0 0 6px rgba(217, 255, 0, 0.3)'
                        : '0 0 6px rgba(255, 255, 255, 0.2)',
                  }}
                />
              )}

            {/* Bottom info bar */}
            <div className="glass absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-lg px-3 py-1.5">
              <span className="text-[10px] font-mono text-muted-foreground">
                {imageDims.width}×{imageDims.height}
              </span>
              <Separator orientation="vertical" className="h-3 opacity-30" />
              <span className="text-[10px] font-mono text-muted-foreground">
                Mask: {strokes.length} strokes
              </span>
              <Separator orientation="vertical" className="h-3 opacity-30" />
              <span className="text-[10px] font-mono text-[#d9ff00]">
                {tool.charAt(0).toUpperCase() + tool.slice(1)}
              </span>
            </div>
          </div>
        </div>

        {/* =============================================================== */}
        {/* RIGHT – Controls Panel                                           */}
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
                  <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      onClick={handleInpaint}
                      disabled={isLoading || !hasApiKey || strokes.length === 0 || !prompt.trim()}
                      className={`w-full gap-2 rounded-xl font-semibold transition-all ${
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
                  </motion.div>

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
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 sm:p-8"
            >
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowComparison(false)}
                className="absolute top-4 right-4 z-20 h-10 w-10 text-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </Button>

              {/* Comparison Slider */}
              <div className="relative h-[80vh] w-[80vw] max-w-5xl overflow-hidden rounded-2xl border border-border/40">
                <ComparisonSlider
                  beforeUrl={imageUrl}
                  afterUrl={editResult}
                  beforeLabel="Original"
                  afterLabel="Edited"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
