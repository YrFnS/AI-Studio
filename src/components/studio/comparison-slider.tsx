'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ComparisonSliderProps {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
}

// ---------------------------------------------------------------------------
// Comparison Slider Component
// ---------------------------------------------------------------------------

export function ComparisonSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = 'Before',
  afterLabel = 'After',
}: ComparisonSliderProps) {
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // -----------------------------------------------------------------------
  // Position update helper
  // -----------------------------------------------------------------------
  const updatePosition = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.max(2, Math.min(98, pct)));
  }, []);

  // -----------------------------------------------------------------------
  // Mouse drag handlers
  // -----------------------------------------------------------------------
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      updatePosition(e.clientX);
    },
    [updatePosition]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      updatePosition(e.clientX);
    };
    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, updatePosition]);

  // -----------------------------------------------------------------------
  // Touch drag handlers
  // -----------------------------------------------------------------------
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      setIsDragging(true);
      if (e.touches[0]) {
        updatePosition(e.touches[0].clientX);
      }
    },
    [updatePosition]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        updatePosition(e.touches[0].clientX);
      }
    };
    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, updatePosition]);

  // -----------------------------------------------------------------------
  // Keyboard handler (left/right arrows move by 2%)
  // -----------------------------------------------------------------------
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setPosition((p) => Math.max(2, p - 2));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setPosition((p) => Math.min(98, p + 2));
    }
  }, []);

  // -----------------------------------------------------------------------
  // Click on container to move divider
  // -----------------------------------------------------------------------
  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      // Only handle direct clicks on the container, not on the divider
      if ((e.target as HTMLElement).closest('[data-divider]')) return;
      updatePosition(e.clientX);
    },
    [updatePosition]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden rounded-xl select-none cursor-ew-resize"
      onMouseDown={handleContainerClick}
      role="slider"
      aria-valuenow={Math.round(position)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Image comparison slider"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* After image (full, underneath) */}
      <img
        src={afterUrl}
        alt={afterLabel}
        className="absolute inset-0 w-full h-full object-contain"
        draggable={false}
      />

      {/* Before image (clipped from left) */}
      <div
        className="absolute inset-0"
        style={{
          clipPath: `inset(0 ${100 - position}% 0 0)`,
        }}
      >
        <img
          src={beforeUrl}
          alt={beforeLabel}
          className="w-full h-full object-contain"
          draggable={false}
        />
      </div>

      {/* Divider line */}
      <div
        data-divider
        className="absolute top-0 bottom-0 z-10 w-0.5 bg-white/70 cursor-ew-resize"
        style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Grip handle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div
            className={`flex h-10 w-6 items-center justify-center rounded-full border-2 border-[#d9ff00] bg-black/70 backdrop-blur-sm transition-shadow ${
              isDragging ? 'shadow-[0_0_20px_rgba(217,255,0,0.5)]' : 'shadow-[0_0_10px_rgba(0,0,0,0.5)]'
            }`}
          >
            {/* Pill grip lines */}
            <div className="flex flex-col gap-[3px]">
              <div className="h-[1.5px] w-3 rounded-full bg-[#d9ff00]/80" />
              <div className="h-[1.5px] w-3 rounded-full bg-[#d9ff00]/80" />
              <div className="h-[1.5px] w-3 rounded-full bg-[#d9ff00]/80" />
            </div>
          </div>
        </div>
      </div>

      {/* Before label */}
      <div className="absolute top-3 left-3 z-20">
        <Badge className="bg-black/60 text-xs text-white/90 backdrop-blur-sm border-0 shadow-lg">
          {beforeLabel}
        </Badge>
      </div>

      {/* After label */}
      <div className="absolute top-3 right-3 z-20">
        <Badge className="bg-[#d9ff00]/20 text-xs text-[#d9ff00] backdrop-blur-sm border border-[#d9ff00]/30 shadow-lg">
          {afterLabel}
        </Badge>
      </div>
    </div>
  );
}
