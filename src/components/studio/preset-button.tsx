'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ---------------------------------------------------------------------------
// PresetButton — strictly fixed dimensions, no conditional size changes
// Uses border-color + bg-color transitions only, no shadows/rings that add size
// ---------------------------------------------------------------------------

interface PresetButtonProps {
  emoji: string;
  label: string;
  isSelected: boolean;
  onClick: () => void;
  tooltip?: string;
  variant?: 'grid' | 'pill';
}

export function PresetButton({ emoji, label, isSelected, onClick, tooltip, variant = 'grid' }: PresetButtonProps) {
  // IMPORTANT: Use ONLY border-color and background-color for selection state.
  // No box-shadow, no ring, no outline — these add visual pixels outside
  // the border-box and cause the perceived "enlargement" bug.
  const selectedClasses = 'border-[#d9ff00] bg-[#d9ff00]/15 text-[#d9ff00]';
  const unselectedClasses = 'border-transparent bg-surface/60 text-muted-foreground hover:bg-surface hover:text-foreground';

  const button = variant === 'grid' ? (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex flex-col items-center justify-center gap-0.5 rounded-md
        px-0.5 py-1 text-center min-w-0 overflow-hidden
        h-[44px] w-full border
        transition-colors duration-150
        ${isSelected ? selectedClasses : unselectedClasses}
      `}
    >
      <span className="text-sm leading-none select-none">{emoji}</span>
      <span className={`text-[8px] font-medium leading-tight truncate w-full ${isSelected ? 'text-[#d9ff00]' : ''}`}>{label}</span>
    </button>
  ) : (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex items-center justify-center gap-0.5 rounded-md
        px-1.5 py-0.5 text-center min-w-0 overflow-hidden
        h-[28px] w-full border
        transition-colors duration-150
        ${isSelected ? selectedClasses : unselectedClasses}
      `}
    >
      <span className="text-[11px] leading-none select-none">{emoji}</span>
      <span className={`text-[8px] font-medium leading-tight truncate ${isSelected ? 'text-[#d9ff00]' : ''}`}>{label}</span>
    </button>
  );

  if (!tooltip) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs max-w-[200px]">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
