'use client';

import { ChevronDown } from 'lucide-react';

// ---------------------------------------------------------------------------
// Collapsible Section Header — REBUILT
// KEY FIX: Always renders the same height AND width regardless of active state
// The activeCount badge uses a fixed-size container that's always in the DOM
// (just invisible when 0) so width never changes on state toggle
// ---------------------------------------------------------------------------

export function CollapsibleHeader({
  icon,
  label,
  isActive,
  activeCount,
  isOpen,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  activeCount: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 transition-colors duration-150 group h-[34px] overflow-hidden ${
        isActive
          ? 'border-[#d9ff00]/30 bg-[#d9ff00]/5'
          : 'border-border/20 bg-surface/60 hover:border-border/40'
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0 overflow-hidden flex-1">
        <span className="shrink-0">{icon}</span>
        <span className={`text-[11px] font-medium uppercase tracking-wider truncate transition-colors duration-150 ${isActive ? 'text-[#d9ff00]' : 'text-muted-foreground group-hover:text-foreground'}`}>
          {label}
        </span>
        {/* Badge: always same width container, visibility hidden when 0 */}
        <span
          className={`shrink-0 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[8px] font-bold border transition-opacity duration-150 ${
            activeCount > 0
              ? 'bg-[#d9ff00]/15 text-[#d9ff00] border-[#d9ff00]/20 opacity-100'
              : 'opacity-0 pointer-events-none'
          }`}
          aria-hidden={activeCount === 0}
        >
          {activeCount > 0 ? activeCount : '0'}
        </span>
      </div>
      <ChevronDown className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
    </button>
  );
}
