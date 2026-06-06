'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// PromptSuggestions — Autocomplete dropdown for prompt textareas
// ---------------------------------------------------------------------------

interface PromptSuggestionsProps {
  /** The current partial prompt text */
  partial: string;
  /** Context type for the suggestions API */
  context: 'image' | 'video';
  /** Called when the user selects a suggestion — receives the completion text to append */
  onSelect: (completion: string) => void;
  /** Whether the dropdown is visible (controlled by parent based on focus) */
  visible: boolean;
  /** Called when the user presses Escape */
  onClose: () => void;
}

export function PromptSuggestions({
  partial,
  context,
  onSelect,
  visible,
  onClose,
}: PromptSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch suggestions with debounce
  const fetchSuggestions = useCallback(
    (text: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();

      if (text.length < 3) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      debounceRef.current = setTimeout(async () => {
        const controller = new AbortController();
        abortRef.current = controller;

        try {
          const res = await fetch(
            `/api/prompt-suggestions?partial=${encodeURIComponent(text)}&context=${context}`,
            { signal: controller.signal }
          );
          if (!res.ok) throw new Error('Failed');
          const data = await res.json();
          if (!controller.signal.aborted) {
            setSuggestions(data.suggestions || []);
            setSelectedIndex(-1);
          }
        } catch {
          if (!controller.signal.aborted) {
            setSuggestions([]);
          }
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        }
      }, 300);
    },
    [context]
  );

  // Fetch when partial text changes
  useEffect(() => {
    if (visible && partial.length >= 3) {
      fetchSuggestions(partial);
    } else {
      setSuggestions([]);
      setSelectedIndex(-1);
      setLoading(false);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [partial, visible, fetchSuggestions]);

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [suggestions]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible || suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case 'Enter':
          if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            e.preventDefault();
            onSelect(suggestions[selectedIndex]);
            setSuggestions([]);
            setSelectedIndex(-1);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setSuggestions([]);
          setSelectedIndex(-1);
          onClose();
          break;
      }
    },
    [visible, suggestions, selectedIndex, onSelect, onClose]
  );

  // Register keyboard listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && containerRef.current) {
      const items = containerRef.current.querySelectorAll('[data-suggestion-item]');
      const selected = items[selectedIndex] as HTMLElement;
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const showDropdown = visible && partial.length >= 3 && (suggestions.length > 0 || loading);

  if (!showDropdown) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.15 }}
        ref={containerRef}
        className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-[#d9ff00]/20 glass-strong shadow-xl shadow-black/30"
      >
        {/* Header */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[#d9ff00]/10">
          <Sparkles className="h-3 w-3 text-[#d9ff00]/60" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-[#d9ff00]/60">
            Suggestions
          </span>
          {loading && <Loader2 className="ml-auto h-3 w-3 animate-spin text-[#d9ff00]/40" />}
        </div>

        {/* Suggestion items */}
        <div className="max-h-64 overflow-y-auto custom-scrollbar py-1">
          {loading && suggestions.length === 0 ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-[#d9ff00]/50" />
              <span className="ml-2 text-xs text-muted-foreground/50">Generating suggestions...</span>
            </div>
          ) : (
            suggestions.map((suggestion, index) => {
              const isSelected = index === selectedIndex;
              // Highlight matching prefix: if suggestion starts with text that overlaps with partial
              const lowerPartial = partial.toLowerCase();
              const lowerSuggestion = suggestion.toLowerCase();
              let prefixEnd = 0;
              // Find how much of the beginning of the suggestion matches the end of the partial
              for (let i = 1; i <= Math.min(lowerPartial.length, lowerSuggestion.length); i++) {
                const partialEnd = lowerPartial.slice(-i);
                const suggestionStart = lowerSuggestion.slice(0, i);
                if (partialEnd === suggestionStart) {
                  prefixEnd = i;
                }
              }

              return (
                <button
                  key={`${suggestion}-${index}`}
                  data-suggestion-item
                  type="button"
                  onClick={() => {
                    onSelect(suggestion);
                    setSuggestions([]);
                    setSelectedIndex(-1);
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`
                    flex w-full items-start gap-2 px-3 py-2 text-left transition-all
                    ${isSelected
                      ? 'bg-[#d9ff00]/10 text-[#d9ff00]'
                      : 'text-muted-foreground hover:bg-[#d9ff00]/5 hover:text-foreground'
                    }
                  `}
                >
                  <span className="mt-0.5 shrink-0">
                    <Sparkles className={`h-3 w-3 ${isSelected ? 'text-[#d9ff00]' : 'text-muted-foreground/30'}`} />
                  </span>
                  <span className="text-xs leading-relaxed break-words">
                    {prefixEnd > 0 ? (
                      <>
                        <span className="text-muted-foreground/40">{suggestion.slice(0, prefixEnd)}</span>
                        <span className={isSelected ? 'text-[#d9ff00]' : 'text-foreground/80'}>{suggestion.slice(prefixEnd)}</span>
                      </>
                    ) : (
                      <span className={isSelected ? 'text-[#d9ff00]' : 'text-foreground/80'}>{suggestion}</span>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        {suggestions.length > 0 && (
          <div className="flex items-center justify-between px-3 py-1.5 border-t border-[#d9ff00]/10">
            <span className="text-[9px] text-muted-foreground/40">
              ↑↓ Navigate • Enter Select • Esc Close
            </span>
            <span className="text-[9px] text-muted-foreground/40">
              {suggestions.length} results
            </span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
