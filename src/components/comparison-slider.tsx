'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Columns2, GripVertical } from 'lucide-react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ComparisonSliderProps {
  /** URL of the "before" image (e.g. original upload) */
  beforeUrl: string;
  /** URL of the "after" image (e.g. generated result) */
  afterUrl: string;
  /** Label for the before side — defaults to "Original" */
  beforeLabel?: string;
  /** Label for the after side — defaults to "Generated" */
  afterLabel?: string;
  /** Optional extra class names on the root container */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ComparisonSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = 'Original',
  afterLabel = 'Generated',
  className = '',
}: ComparisonSliderProps) {
  // Slider position as a percentage (0-100). 50 = center.
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  // Hold-to-compare: while pressed, show only the before image
  const [isHolding, setIsHolding] = useState(false);

  // Auto-fade labels: visible for a few seconds after interaction, then fade
  const [showLabels, setShowLabels] = useState(true);
  const labelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref to the comparison container for position calculations
  const containerRef = useRef<HTMLDivElement>(null);

  // -----------------------------------------------------------------------
  // Update slider position from a client X coordinate
  // -----------------------------------------------------------------------
  const updatePosition = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const pos = ((clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(0, Math.min(100, pos)));
  }, []);

  // -----------------------------------------------------------------------
  // Flash labels on interaction, then auto-fade
  // -----------------------------------------------------------------------
  const flashLabels = useCallback(() => {
    setShowLabels(true);
    if (labelTimerRef.current) clearTimeout(labelTimerRef.current);
    labelTimerRef.current = setTimeout(() => setShowLabels(false), 2500);
  }, []);

  // -----------------------------------------------------------------------
  // Mouse drag handlers
  // -----------------------------------------------------------------------
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      flashLabels();
      updatePosition(e.clientX);
    },
    [updatePosition, flashLabels],
  );

  // Global mouse move / up while dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent) => {
      updatePosition(e.clientX);
    };
    const handleUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging, updatePosition]);

  // -----------------------------------------------------------------------
  // Touch drag handlers
  // -----------------------------------------------------------------------
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      setIsDragging(true);
      flashLabels();
      if (e.touches[0]) updatePosition(e.touches[0].clientX);
    },
    [updatePosition, flashLabels],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) updatePosition(e.touches[0].clientX);
    };
    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, updatePosition]);

  // -----------------------------------------------------------------------
  // Click anywhere on the container to jump the slider
  // -----------------------------------------------------------------------
  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      // Only if we didn't start a drag (no drag on simple click)
      updatePosition(e.clientX);
      flashLabels();
    },
    [updatePosition, flashLabels],
  );

  // -----------------------------------------------------------------------
  // Hold-to-compare button handlers
  // -----------------------------------------------------------------------
  const handleHoldStart = useCallback(() => {
    setIsHolding(true);
    flashLabels();
  }, [flashLabels]);

  const handleHoldEnd = useCallback(() => {
    setIsHolding(false);
  }, []);

  // Show labels on mount for a few seconds
  useEffect(() => {
    labelTimerRef.current = setTimeout(() => setShowLabels(false), 3000);
    return () => {
      if (labelTimerRef.current) clearTimeout(labelTimerRef.current);
    };
  }, []);

  // -----------------------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------------------
  return (
    <div className={`relative flex flex-col gap-2 ${className}`}>
      {/* Comparison container */}
      <div
        ref={containerRef}
        className="relative select-none overflow-hidden rounded-xl border border-border/40 bg-black/40"
        style={{ cursor: isDragging ? 'ew-resize' : 'default' }}
        onClick={handleContainerClick}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* ---- After image (full, underneath) ---- */}
        <img
          src={afterUrl}
          alt={afterLabel}
          className="block h-auto w-full object-contain"
          draggable={false}
        />

        {/* ---- Before image (clipped from left) ---- */}
        {!isHolding && (
          <div
            className="absolute inset-0"
            style={{
              clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
            }}
          >
            <img
              src={beforeUrl}
              alt={beforeLabel}
              className="h-full w-full object-contain"
              draggable={false}
            />
          </div>
        )}

        {/* ---- Divider line + handle ---- */}
        {!isHolding && (
          <div
            className="absolute top-0 bottom-0 z-10 w-0.5 cursor-ew-resize bg-white/70 shadow-[0_0_8px_rgba(255,255,255,0.3)]"
            style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
          >
            {/* Circular handle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="glass flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/80 bg-black/60 shadow-lg backdrop-blur-sm transition-transform duration-150 hover:scale-110">
                <GripVertical className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>
        )}

        {/* ---- Auto-fading labels ---- */}
        <AnimatePresence>
          {showLabels && !isHolding && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="pointer-events-none absolute inset-x-0 top-3 z-20 flex items-center justify-between px-4"
            >
              {/* Before label (left side) */}
              <span
                className="rounded-lg px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase backdrop-blur-md transition-all duration-300"
                style={{
                  background: 'rgba(0,0,0,0.55)',
                  color: 'rgba(255,255,255,0.85)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {beforeLabel}
              </span>

              {/* After label (right side) */}
              <span
                className="rounded-lg px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase backdrop-blur-md transition-all duration-300"
                style={{
                  background: 'rgba(217,255,0,0.15)',
                  color: '#d9ff00',
                  border: '1px solid rgba(217,255,0,0.2)',
                }}
              >
                {afterLabel}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ---- "Holding" overlay label ---- */}
        <AnimatePresence>
          {isHolding && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
            >
              <span
                className="rounded-xl px-4 py-2 text-sm font-bold tracking-wide uppercase backdrop-blur-md"
                style={{
                  background: 'rgba(0,0,0,0.6)',
                  color: 'rgba(255,255,255,0.9)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                {beforeLabel}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ---- Hold to Compare button ---- */}
      <div className="flex items-center justify-center">
        <button
          type="button"
          onMouseDown={handleHoldStart}
          onMouseUp={handleHoldEnd}
          onMouseLeave={handleHoldEnd}
          onTouchStart={handleHoldStart}
          onTouchEnd={handleHoldEnd}
          className={`group flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium transition-all duration-200 select-none ${
            isHolding
              ? 'border-[#d9ff00]/50 bg-[#d9ff00]/15 text-[#d9ff00] shadow-[0_0_16px_rgba(217,255,0,0.15)]'
              : 'border-border/40 bg-surface/60 text-muted-foreground backdrop-blur-sm hover:border-[#d9ff00]/30 hover:text-[#d9ff00]/80'
          }`}
        >
          <Columns2 className="h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110" />
          {isHolding ? `Showing ${beforeLabel}` : 'Hold to Compare'}
        </button>
      </div>
    </div>
  );
}
