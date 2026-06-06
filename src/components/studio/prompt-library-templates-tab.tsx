'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, ArrowRight, Plus, Check, Sparkles,
} from 'lucide-react';
import type { PromptTemplate } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CATEGORIES,
  TEMPLATES,
  getCategoryColor,
  getCategoryLabel,
} from './prompt-library-data';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TemplatesTabProps {
  filteredTemplates: PromptTemplate[];
  templateCategory: string;
  setTemplateCategory: (c: string) => void;
  templateSearch: string;
  setTemplateSearch: (q: string) => void;
  handleUseTemplate: (template: PromptTemplate) => void;
  handleSaveTemplate: (template: PromptTemplate) => void;
  savingId: string | null;
}

// ---------------------------------------------------------------------------
// TemplatesTab
// ---------------------------------------------------------------------------

export function TemplatesTab({
  filteredTemplates,
  templateCategory,
  setTemplateCategory,
  templateSearch,
  setTemplateSearch,
  handleUseTemplate,
  handleSaveTemplate,
  savingId,
}: TemplatesTabProps) {
  return (
    <div className="flex flex-col h-[55vh]">
      {/* Search + Category filter */}
      <div className="px-5 pt-3 pb-2 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <input
            value={templateSearch}
            onChange={(e) => setTemplateSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full rounded-md bg-white/5 border border-border/40 pl-8 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/40 focus:border-[#d9ff00]/30 transition-all"
          />
          {templateSearch && (
            <button
              type="button"
              onClick={() => setTemplateSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Template category pills */}
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.filter((c) => c.id !== 'other').map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setTemplateCategory(templateCategory === cat.id ? 'all' : cat.id)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                templateCategory === cat.id
                  ? 'border-[#d9ff00]/40 bg-[#d9ff00]/15 text-[#d9ff00]'
                  : 'border-border/30 bg-white/5 text-muted-foreground/70 hover:text-foreground hover:border-border/50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Template grid */}
      <ScrollArea className="flex-1 px-5">
        {filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Sparkles className="h-10 w-10 text-muted-foreground/15 mb-3" />
            <p className="text-xs text-muted-foreground/50 text-center">
              No templates found
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-4">
            <AnimatePresence mode="popLayout">
              {filteredTemplates.map((template, index) => (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.02, duration: 0.15 }}
                  className="group relative rounded-lg border border-border/30 bg-white/[0.02] hover:bg-white/[0.05] hover:border-[#d9ff00]/20 transition-all overflow-hidden"
                >
                  {/* Color accent top border */}
                  <div
                    className="h-0.5 w-full"
                    style={{ backgroundColor: getCategoryColor(template.category) }}
                  />

                  <div className="p-3 space-y-2">
                    {/* Header */}
                    <div className="flex items-center gap-2">
                      <span className="text-base">{template.emoji}</span>
                      <span className="text-[11px] font-semibold text-foreground flex-1 truncate">
                        {template.title}
                      </span>
                      <span
                        className="shrink-0 px-1.5 py-px rounded-full text-[8px] font-medium border"
                        style={{
                          color: getCategoryColor(template.category),
                          borderColor: `${getCategoryColor(template.category)}30`,
                          backgroundColor: `${getCategoryColor(template.category)}10`,
                        }}
                      >
                        {getCategoryLabel(template.category)}
                      </span>
                    </div>

                    {/* Prompt preview */}
                    <p className="text-[10px] text-muted-foreground/60 leading-relaxed line-clamp-3">
                      {template.prompt}
                    </p>

                    {/* Highlighted placeholders */}
                    <div className="flex flex-wrap gap-1">
                      {template.prompt.match(/\{[^}]+\}/g)?.map((ph, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-px rounded text-[8px] font-mono font-medium bg-[#d9ff00]/10 text-[#d9ff00]/80 border border-[#d9ff00]/20"
                        >
                          {ph}
                        </span>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleUseTemplate(template)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#d9ff00]/10 text-[#d9ff00] text-[10px] font-medium hover:bg-[#d9ff00]/20 transition-colors"
                      >
                        <ArrowRight className="h-3 w-3" />
                        Use Template
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSaveTemplate(template)}
                        disabled={savingId === template.id}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/5 border border-border/30 text-muted-foreground/60 text-[10px] font-medium hover:text-foreground hover:border-border/50 transition-colors disabled:opacity-50"
                      >
                        {savingId === template.id ? (
                          <Check className="h-3 w-3 text-[#d9ff00]" />
                        ) : (
                          <Plus className="h-3 w-3" />
                        )}
                        {savingId === template.id ? 'Saved' : 'Save'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
