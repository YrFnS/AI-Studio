'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Star, Trash2, X, BookmarkCheck,
  ArrowRight, Clock, Tag, Cpu, AlertTriangle,
} from 'lucide-react';
import type { SavedPrompt } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CATEGORIES,
  SORT_OPTIONS,
  truncate,
  getCategoryColor,
  getCategoryLabel,
  formatDate,
} from './prompt-library-data';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SavedPromptsTabProps {
  savedPrompts: SavedPrompt[];
  filteredSaved: SavedPrompt[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  categoryFilter: string;
  setCategoryFilter: (c: string) => void;
  sortBy: 'recent' | 'oldest' | 'az' | 'used';
  setSortBy: (s: 'recent' | 'oldest' | 'az' | 'used') => void;
  deleteConfirmId: string | null;
  setDeleteConfirmId: (id: string | null) => void;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  handleToggleFavorite: (id: string, current: boolean) => void;
  handleDelete: (id: string) => void;
  handleUseSaved: (prompt: SavedPrompt) => void;
}

// ---------------------------------------------------------------------------
// SavedPromptsTab
// ---------------------------------------------------------------------------

export function SavedPromptsTab({
  savedPrompts,
  filteredSaved,
  searchQuery,
  setSearchQuery,
  categoryFilter,
  setCategoryFilter,
  sortBy,
  setSortBy,
  deleteConfirmId,
  setDeleteConfirmId,
  expandedId,
  setExpandedId,
  handleToggleFavorite,
  handleDelete,
  handleUseSaved,
}: SavedPromptsTabProps) {
  return (
    <div className="flex flex-col h-[55vh]">
      {/* Search + Sort */}
      <div className="px-5 pt-3 pb-2 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved prompts..."
            className="w-full rounded-md bg-white/5 border border-border/40 pl-8 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/40 focus:border-[#d9ff00]/30 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Category filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                categoryFilter === cat.id
                  ? 'border-[#d9ff00]/40 bg-[#d9ff00]/15 text-[#d9ff00]'
                  : 'border-border/30 bg-white/5 text-muted-foreground/70 hover:text-foreground hover:border-border/50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Sort row */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground/50 mr-1">Sort:</span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSortBy(opt.id as typeof sortBy)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                sortBy === opt.id
                  ? 'bg-[#d9ff00]/10 text-[#d9ff00]'
                  : 'text-muted-foreground/50 hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt list */}
      <ScrollArea className="flex-1 px-5">
        {filteredSaved.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <BookmarkCheck className="h-10 w-10 text-muted-foreground/15 mb-3" />
            <p className="text-xs text-muted-foreground/50 text-center">
              {savedPrompts.length === 0
                ? 'No saved prompts yet'
                : 'No matching prompts found'}
            </p>
            {savedPrompts.length === 0 && (
              <p className="text-[10px] text-muted-foreground/30 mt-1 text-center">
                Save prompts from your history or use templates to get started
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-1.5 pb-4">
            <AnimatePresence mode="popLayout">
              {filteredSaved.map((prompt, index) => (
                <motion.div
                  key={prompt.id}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.02, duration: 0.15 }}
                  className="group relative rounded-lg border border-border/30 bg-white/[0.02] hover:bg-white/[0.05] hover:border-[#d9ff00]/20 transition-all"
                >
                  <div
                    className="flex items-start gap-2 px-3 py-2.5 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === prompt.id ? null : prompt.id)}
                  >
                    {/* Favorite star */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFavorite(prompt.id, prompt.isFavorite);
                      }}
                      className="mt-0.5 shrink-0"
                    >
                      <Star
                        className={`h-3.5 w-3.5 transition-colors ${
                          prompt.isFavorite
                            ? 'fill-[#d9ff00] text-[#d9ff00]'
                            : 'text-muted-foreground/30 hover:text-[#d9ff00]/60'
                        }`}
                      />
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] leading-relaxed text-muted-foreground group-hover:text-foreground transition-colors ${
                        expandedId !== prompt.id ? 'line-clamp-2' : ''
                      }`}>
                        {expandedId === prompt.id ? prompt.text : truncate(prompt.text)}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {/* Category badge */}
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[9px] font-medium border"
                          style={{
                            color: getCategoryColor(prompt.category),
                            borderColor: `${getCategoryColor(prompt.category)}30`,
                            backgroundColor: `${getCategoryColor(prompt.category)}10`,
                          }}
                        >
                          <Tag className="h-2 w-2" />
                          {getCategoryLabel(prompt.category)}
                        </span>

                        {/* Provider/Model */}
                        {(prompt.providerName || prompt.modelName) && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[9px] font-medium border border-border/30 bg-white/5 text-muted-foreground/60">
                            <Cpu className="h-2 w-2" />
                            {prompt.providerName}{prompt.modelName ? ` / ${prompt.modelName}` : ''}
                          </span>
                        )}

                        {/* Usage count */}
                        {prompt.usageCount > 0 && (
                          <span className="text-[9px] text-muted-foreground/40">
                            Used {prompt.usageCount}×
                          </span>
                        )}

                        {/* Date */}
                        <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground/40">
                          <Clock className="h-2 w-2" />
                          {formatDate(prompt.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUseSaved(prompt);
                            }}
                            className="rounded-md p-1 text-[#d9ff00]/60 hover:text-[#d9ff00] hover:bg-[#d9ff00]/10 transition-colors"
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="text-[10px]">Use this prompt</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(prompt.id);
                            }}
                            className="rounded-md p-1 text-muted-foreground/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="text-[10px]">Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Expanded view */}
                  <AnimatePresence>
                    {expandedId === prompt.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-2.5 pt-0 border-t border-border/20">
                          <p className="text-[11px] text-muted-foreground/70 leading-relaxed pt-2 whitespace-pre-wrap">
                            {prompt.text}
                          </p>
                          <div className="flex gap-2 mt-2">
                            <button
                              type="button"
                              onClick={() => handleUseSaved(prompt)}
                              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#d9ff00]/10 text-[#d9ff00] text-[10px] font-medium hover:bg-[#d9ff00]/20 transition-colors"
                            >
                              <ArrowRight className="h-3 w-3" />
                              Use Prompt
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Delete confirmation overlay */}
                  <AnimatePresence>
                    {deleteConfirmId === prompt.id && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 rounded-lg bg-black/80 backdrop-blur-sm flex items-center justify-center gap-3 z-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                        <span className="text-[10px] text-foreground">Delete?</span>
                        <button
                          type="button"
                          onClick={() => handleDelete(prompt.id)}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/10 text-muted-foreground hover:bg-white/20 transition-all"
                        >
                          Cancel
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
