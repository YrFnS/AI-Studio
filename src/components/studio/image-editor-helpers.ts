// ---------------------------------------------------------------------------
// Image Editor – Types & Canvas Helper Functions
// ---------------------------------------------------------------------------

import type { Provider, ProviderModel } from '@/components/studio/image-studio-types';

export type { Provider, ProviderModel };

export type Tool = 'brush' | 'eraser' | 'pan';

export interface StrokePoint {
  x: number;
  y: number;
}

export interface Stroke {
  points: StrokePoint[];
  size: number;
  hardness: number;
  tool: 'brush' | 'eraser';
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

export function drawSoftCircle(
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

export function renderStrokeOnCtx(
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
