'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Sun, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Lighting position → prompt description mapping
// ---------------------------------------------------------------------------

const LIGHTING_DESCRIPTIONS: Record<string, string> = {
  left: 'dramatic side lighting from the left, Rembrandt lighting',
  right: 'dramatic side lighting from the right, cinematic rim light',
  'center-top': 'even overhead lighting, butterfly/paramount lighting',
  'top-left': 'classic portrait lighting, 45-degree key light',
  'top-right': 'loop lighting, 45-degree key light from right',
  bottom: 'under-lighting, horror lighting effect',
};

// Zones define angular ranges for each position (top-down view, 0° = top)
// Positions on the circle: top = 0°, right = 90°, bottom = 180°, left = 270°

interface Zone {
  id: string;
  label: string;
  minAngle: number;
  maxAngle: number;
}

const ZONES: Zone[] = [
  { id: 'center-top', label: 'Top', minAngle: 315, maxAngle: 45 },
  { id: 'top-right', label: 'Top-Right', minAngle: 45, maxAngle: 90 },
  { id: 'right', label: 'Right', minAngle: 90, maxAngle: 135 },
  { id: 'bottom', label: 'Bottom', minAngle: 135, maxAngle: 225 },
  { id: 'left', label: 'Left', minAngle: 225, maxAngle: 270 },
  { id: 'top-left', label: 'Top-Left', minAngle: 270, maxAngle: 315 },
];

function angleToZone(angle: number): Zone {
  const normalized = ((angle % 360) + 360) % 360;
  for (const zone of ZONES) {
    if (zone.minAngle > zone.maxAngle) {
      // wraps around 0
      if (normalized >= zone.minAngle || normalized < zone.maxAngle) return zone;
    } else {
      if (normalized >= zone.minAngle && normalized < zone.maxAngle) return zone;
    }
  }
  return ZONES[0];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface LightingVisualizerProps {
  onLightingChange?: (description: string) => void;
  value?: string;
}

export function LightingVisualizer({ onLightingChange, value }: LightingVisualizerProps) {
  const [open, setOpen] = useState(false);
  const [lightAngle, setLightAngle] = useState(() => {
    // Derive initial angle from value prop if provided
    if (value) {
      for (const [zoneId, desc] of Object.entries(LIGHTING_DESCRIPTIONS)) {
        if (value === desc || value.includes(desc)) {
          const zone = ZONES.find((z) => z.id === zoneId);
          if (zone) {
            const midAngle = zone.minAngle > zone.maxAngle
              ? (zone.minAngle + zone.maxAngle + 360) / 2
              : (zone.minAngle + zone.maxAngle) / 2;
            return midAngle % 360;
          }
          break;
        }
      }
    }
    return 315; // default: center-top
  });
  const [isDragging, setIsDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // Compute current zone & description
  const currentZone = angleToZone(lightAngle);
  const currentDescription = LIGHTING_DESCRIPTIONS[currentZone.id] ?? '';

  // Notify parent of angle changes
  useEffect(() => {
    if (onLightingChange && currentDescription) {
      onLightingChange(currentDescription);
    }
  }, [lightAngle, onLightingChange, currentDescription]);

  // Compute light indicator position from angle
  const RADIUS = 80;
  const CX = 120;
  const CY = 120;
  const lightX = CX + RADIUS * Math.sin((lightAngle * Math.PI) / 180);
  const lightY = CY - RADIUS * Math.cos((lightAngle * Math.PI) / 180);

  // Handle mouse/touch interaction on the SVG
  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = 240 / rect.width;
      const scaleY = 240 / rect.height;
      const px = (clientX - rect.left) * scaleX;
      const py = (clientY - rect.top) * scaleY;

      const dx = px - CX;
      const dy = -(py - CY); // flip Y for standard math coords
      let angle = (Math.atan2(dx, dy) * 180) / Math.PI;
      if (angle < 0) angle += 360;

      // Snap to zone midpoint when close
      const zone = angleToZone(angle);
      const midAngle =
        zone.minAngle > zone.maxAngle
          ? ((zone.minAngle + zone.maxAngle + 360) / 2) % 360
          : (zone.minAngle + zone.maxAngle) / 2;

      setLightAngle(midAngle);
    },
    []
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      handlePointerMove(e.clientX, e.clientY);
    },
    [handlePointerMove]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handlePointerMove(e.clientX, e.clientY);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const handleUp = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchend', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDragging, handlePointerMove]);

  // Quick-select buttons
  const quickPositions = [
    { id: 'top-left', label: 'TL' },
    { id: 'center-top', label: 'Top' },
    { id: 'top-right', label: 'TR' },
    { id: 'left', label: 'Left' },
    { id: 'bottom', label: 'Bottom' },
    { id: 'right', label: 'Right' },
  ];

  const handleQuickSelect = (zoneId: string) => {
    const zone = ZONES.find((z) => z.id === zoneId);
    if (!zone) return;
    const midAngle =
      zone.minAngle > zone.maxAngle
        ? ((zone.minAngle + zone.maxAngle + 360) / 2) % 360
        : (zone.minAngle + zone.maxAngle) / 2;
    setLightAngle(midAngle);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Sun className="h-3.5 w-3.5" />
            Lighting Direction
          </span>
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 pt-2">
          {/* SVG Diagram */}
          <div className="relative flex items-center justify-center">
            <svg
              ref={svgRef}
              viewBox="0 0 240 240"
              className="w-full max-w-[240px] cursor-pointer select-none"
              onMouseDown={handleMouseDown}
              style={{ touchAction: 'none' }}
            >
              <defs>
                {/* Light beam gradient */}
                <radialGradient id="lightBeam" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#d9ff00" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#d9ff00" stopOpacity="0" />
                </radialGradient>
                {/* Glow for light indicator */}
                <radialGradient id="lightGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#d9ff00" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#d9ff00" stopOpacity="0" />
                </radialGradient>
                {/* Subject gradient */}
                <radialGradient id="subjectGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
                </radialGradient>
              </defs>

              {/* Background circle (stage) */}
              <circle cx={CX} cy={CY} r={RADIUS + 12} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4 4" />

              {/* Light beam from source to subject */}
              <line
                x1={lightX}
                y1={lightY}
                x2={CX}
                y2={CY}
                stroke="#d9ff00"
                strokeWidth="2"
                strokeOpacity="0.4"
                strokeLinecap="round"
              />
              {/* Wider beam glow */}
              <line
                x1={lightX}
                y1={lightY}
                x2={CX}
                y2={CY}
                stroke="#d9ff00"
                strokeWidth="12"
                strokeOpacity="0.08"
                strokeLinecap="round"
              />

              {/* Zone markers around the circle */}
              {ZONES.map((zone) => {
                const midAngle =
                  zone.minAngle > zone.maxAngle
                    ? ((zone.minAngle + zone.maxAngle + 360) / 2) % 360
                    : (zone.minAngle + zone.maxAngle) / 2;
                const markerR = RADIUS + 20;
                const mx = CX + markerR * Math.sin((midAngle * Math.PI) / 180);
                const my = CY - markerR * Math.cos((midAngle * Math.PI) / 180);
                const isActive = currentZone.id === zone.id;
                return (
                  <circle
                    key={zone.id}
                    cx={mx}
                    cy={my}
                    r="3"
                    fill={isActive ? '#d9ff00' : 'rgba(255,255,255,0.15)'}
                    opacity={isActive ? 1 : 0.5}
                  />
                );
              })}

              {/* Subject circle in center */}
              <circle cx={CX} cy={CY} r="24" fill="url(#subjectGrad)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
              {/* Head silhouette */}
              <ellipse cx={CX} cy={CY - 4} rx="10" ry="12" fill="rgba(255,255,255,0.1)" />
              {/* Shoulders outline */}
              <path
                d={`M ${CX - 18} ${CY + 12} Q ${CX - 12} ${CY + 4} ${CX} ${CY + 4} Q ${CX + 12} ${CY + 4} ${CX + 18} ${CY + 12}`}
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />

              {/* Light glow behind indicator */}
              <circle cx={lightX} cy={lightY} r="20" fill="url(#lightGlow)" />

              {/* Light indicator (draggable sun) */}
              <circle
                cx={lightX}
                cy={lightY}
                r="10"
                fill="#d9ff00"
                fillOpacity="0.2"
                stroke="#d9ff00"
                strokeWidth="2"
                className="transition-all duration-150"
                style={{
                  filter: isDragging ? 'drop-shadow(0 0 8px #d9ff00)' : 'drop-shadow(0 0 4px #d9ff00)',
                }}
              />
              {/* Sun rays */}
              <g transform={`translate(${lightX}, ${lightY})`} opacity="0.7">
                {[0, 45, 90, 135].map((rot) => (
                  <line
                    key={rot}
                    x1="0"
                    y1="-14"
                    x2="0"
                    y2="-17"
                    stroke="#d9ff00"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    transform={`rotate(${rot})`}
                  />
                ))}
              </g>
              {/* Inner dot */}
              <circle cx={lightX} cy={lightY} r="4" fill="#d9ff00" />

              {/* Label */}
              <text x={CX} y={CY + RADIUS + 38} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="system-ui">
                Studio Top View
              </text>

              {/* Direction labels */}
              <text x={CX} y={14} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="system-ui">N</text>
              <text x={230} y={CY + 3} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="system-ui">E</text>
              <text x={CX} y={237} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="system-ui">S</text>
              <text x={10} y={CY + 3} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="system-ui">W</text>
            </svg>
          </div>

          {/* Quick position buttons */}
          <div className="grid grid-cols-6 gap-1">
            {quickPositions.map((pos) => (
              <button
                key={pos.id}
                type="button"
                onClick={() => handleQuickSelect(pos.id)}
                className={`rounded-md px-1.5 py-1 text-[10px] font-medium transition-all ${
                  currentZone.id === pos.id
                    ? 'bg-[#d9ff00]/15 text-[#d9ff00] border border-[#d9ff00]/30'
                    : 'bg-surface border border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60'
                }`}
              >
                {pos.label}
              </button>
            ))}
          </div>

          {/* Current lighting description badge */}
          {currentDescription && (
            <div className="flex items-start gap-2 rounded-lg border border-[#d9ff00]/15 bg-[#d9ff00]/5 p-2.5">
              <Sun className="h-3.5 w-3.5 text-[#d9ff00] mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-[#d9ff00]/70 uppercase tracking-wider mb-0.5">
                  {currentZone.label}
                </p>
                <p className="text-[11px] text-foreground/80 leading-snug">
                  {currentDescription}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0 text-[8px] bg-[#d9ff00]/10 text-[#d9ff00] border-[#d9ff00]/20">
                Auto
              </Badge>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
