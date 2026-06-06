'use client';
/* eslint-disable react-hooks/refs -- This hook intentionally accesses refs during render for canvas layout calculations that don't trigger re-renders */

import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { Tool, Stroke } from './image-editor-helpers';
import { renderStrokeOnCtx } from './image-editor-helpers';

export interface UseCanvasEventsOptions {
  imageUrl: string;
  onClose: () => void;
}

export interface UseCanvasEventsReturn {
  // State
  tool: Tool;
  setTool: (t: Tool) => void;
  brushSize: number;
  setBrushSize: (v: number) => void;
  brushHardness: number;
  setBrushHardness: (v: number) => void;
  zoom: number;
  setZoom: (z: number | ((prev: number) => number)) => void;
  panOffset: { x: number; y: number };
  setPanOffset: (v: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  strokes: Stroke[];
  undoneStrokes: Stroke[];
  isPanning: boolean;
  isPainting: boolean;
  cursorPos: { x: number; y: number } | null;
  imageLoaded: boolean;
  imageDims: { width: number; height: number };

  // Refs
  maskCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  viewportRef: React.RefObject<HTMLDivElement | null>;

  // Computed display values
  imgLeft: number;
  imgTop: number;
  cursorDisplaySize: number;

  // Handlers
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  handleMouseLeave: () => void;
  handleWheel: (e: React.WheelEvent) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  handleClearMask: () => void;

  // Export functions
  exportMask: () => string | null;
  exportOriginalImage: () => string | null;
}

export function useCanvasEvents({ imageUrl, onClose }: UseCanvasEventsOptions): UseCanvasEventsReturn {
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
  // Refs
  // -----------------------------------------------------------------------
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const baseDisplayRef = useRef({ width: 0, height: 0 });
  const viewportSizeRef = useRef({ width: 0, height: 0 });

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

  return {
    tool,
    setTool,
    brushSize,
    setBrushSize,
    brushHardness,
    setBrushHardness,
    zoom,
    setZoom,
    panOffset,
    setPanOffset,
    strokes,
    undoneStrokes,
    isPanning,
    isPainting,
    cursorPos,
    imageLoaded,
    imageDims,
    maskCanvasRef,
    viewportRef,
    imgLeft,
    imgTop,
    cursorDisplaySize,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleWheel,
    handleUndo,
    handleRedo,
    handleClearMask,
    exportMask,
    exportOriginalImage,
  };
}
