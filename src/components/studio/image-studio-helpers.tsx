'use client';

import { useEffect, useState } from 'react';

import {
  DollarSign,
  Search,
  BookOpen,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { PromptTemplate } from '@/components/studio/image-studio-types';

// ---------------------------------------------------------------------------
// Cost Estimate Badge
// ---------------------------------------------------------------------------

export function CostEstimateBadge({ providerId, modelId, type, batchSize, duration }: {
  providerId: string;
  modelId: string;
  type: 'image' | 'video';
  batchSize?: number;
  duration?: number;
}) {
  const [cost, setCost] = useState<string | null>(null);

  useEffect(() => {
    if (!providerId || !modelId) return;
    const controller = new AbortController();
    fetch('/api/cost-estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId, modelId, params: { batchSize, duration } }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => setCost(data.estimatedCost || 'varies'))
      .catch(() => setCost('varies'));
    return () => controller.abort();
  }, [providerId, modelId, batchSize, duration]);

  if (!cost) return null;

  return (
    <div className="flex items-center justify-center gap-1.5">
      <DollarSign className="h-3 w-3 text-muted-foreground/60" />
      <span className="text-[10px] text-muted-foreground/60">Est. {cost}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template Browser (used in Templates dialog)
// ---------------------------------------------------------------------------

export function TemplateBrowser({ onSelect }: { onSelect: (template: PromptTemplate) => void }) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [categories, setCategories] = useState<{ name: string; icon: string; count: number }[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/prompt-templates${activeCategory !== 'all' ? `?category=${activeCategory}` : ''}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`)
      .then((res) => res.json())
      .then((data) => {
        setTemplates(data.templates || []);
        if (data.categories) setCategories(data.categories);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeCategory, searchQuery]);

  return (
    <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search templates..."
          className="w-full rounded-lg bg-surface border border-border/60 pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30"
        />
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
            activeCategory === 'all'
              ? 'bg-[#d9ff00]/10 text-[#d9ff00] border border-[#d9ff00]/30'
              : 'bg-surface border border-border/40 text-muted-foreground hover:text-foreground'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.name}
            type="button"
            onClick={() => setActiveCategory(cat.name)}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
              activeCategory === cat.name
                ? 'bg-[#d9ff00]/10 text-[#d9ff00] border border-[#d9ff00]/30'
                : 'bg-surface border border-border/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="flex-1 overflow-y-auto max-h-96 custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-[#d9ff00]" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-10">
            <BookOpen className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No templates found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {templates.map((template) => {
              const cat = categories.find((c) => c.name === template.category);
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => onSelect(template)}
                  className="flex flex-col gap-1.5 rounded-lg border border-border/40 bg-surface p-3 text-left hover:border-[#d9ff00]/30 hover:bg-[#d9ff00]/5 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{cat?.icon || '📁'}</span>
                    <span className="text-xs font-medium text-foreground group-hover:text-[#d9ff00] transition-colors truncate">
                      {template.name}
                    </span>
                  </div>
                  {template.description && (
                    <p className="text-[10px] text-muted-foreground/80 line-clamp-1">
                      {template.description}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground/50 line-clamp-2">
                    {template.prompt}
                  </p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {(template.style || template.suggestedStylePreset) && (
                      <Badge variant="secondary" className="text-[8px] w-fit bg-[#d9ff00]/5 text-[#d9ff00]/70 border-[#d9ff00]/10">
                        {template.style || template.suggestedStylePreset}
                      </Badge>
                    )}
                    {(template.aspectRatio || template.suggestedAspectRatio) && (
                      <Badge variant="secondary" className="text-[8px] w-fit bg-surface text-muted-foreground/60 border-border/30">
                        {template.aspectRatio || template.suggestedAspectRatio}
                      </Badge>
                    )}
                    {template.negativePrompt && (
                      <Badge variant="secondary" className="text-[8px] w-fit bg-red-500/5 text-red-400/60 border-red-500/10">
                        neg
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
