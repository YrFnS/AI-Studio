'use client';

import { useState, useEffect } from 'react';

import {
  ChevronDown,
  ChevronUp,
  DollarSign,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ---------------------------------------------------------------------------
// Cost Estimate Badge
// ---------------------------------------------------------------------------

export function VideoCostBadge({ providerId, modelId, duration }: {
  providerId: string;
  modelId: string;
  duration: number;
}) {
  const [cost, setCost] = useState<string | null>(null);

  useEffect(() => {
    if (!providerId || !modelId) return;
    const controller = new AbortController();
    fetch('/api/cost-estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId, modelId, params: { duration } }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => setCost(data.estimatedCost || 'varies'))
      .catch(() => setCost('varies'));
    return () => controller.abort();
  }, [providerId, modelId, duration]);

  if (!cost) return null;

  return (
    <div className="flex items-center justify-center gap-1.5">
      <DollarSign className="h-3 w-3 text-muted-foreground/60" />
      <span className="text-[10px] text-muted-foreground/60">Est. {cost}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible Section Header
// ---------------------------------------------------------------------------

export function CollapsibleSectionHeader({
  icon,
  label,
  activeCount,
  isOpen,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  activeCount: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-lg border border-border/30 bg-surface px-3 py-2 hover:border-border/60 transition-all group"
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
          {label}
        </span>
        {activeCount > 0 && (
          <Badge className="h-4 min-w-[18px] px-1 text-[9px] font-bold bg-[#d9ff00]/15 text-[#d9ff00] border-[#d9ff00]/30">
            {activeCount}
          </Badge>
        )}
      </div>
      {isOpen ? (
        <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
      ) : (
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Preset Grid
// ---------------------------------------------------------------------------

export function PresetGrid({
  presets,
  activeId,
  onSelect,
}: {
  presets: readonly { id: string; emoji: string; label: string; suffix: string }[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1">
      {presets.map((preset) => {
        const isActive = activeId === preset.id && preset.id !== 'none';
        return (
          <Tooltip key={preset.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onSelect(preset.id === activeId ? 'none' : preset.id)}
                className={`relative flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-center min-w-0 overflow-hidden h-[52px] w-full transition-colors ${
                  isActive
                    ? 'border-[#d9ff00] bg-[#d9ff00]/15 text-[#d9ff00]'
                    : 'border-transparent bg-surface/60 text-muted-foreground hover:bg-surface hover:text-foreground hover:border-border/40'
                }`}
              >
                <span className="text-sm">{preset.emoji}</span>
                <span className="text-[7px] font-medium leading-tight truncate w-full">{preset.label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs max-w-[200px]">
              {`Adds: ${preset.suffix.slice(2)}`}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
