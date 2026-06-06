'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  CheckCircle2,
  XCircle,
  Loader2,
  Minimize2,
  Trash2,
  ListOrdered,
} from 'lucide-react';

import { useAppStore, type GenerationQueueItem } from '@/lib/store';

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// ---------------------------------------------------------------------------
// Status icon
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: GenerationQueueItem['status'] }) {
  switch (status) {
    case 'processing':
      return (
        <div className="relative flex h-5 w-5 items-center justify-center">
          {/* Progress ring */}
          <svg className="progress-ring-animated h-5 w-5 -rotate-90" viewBox="0 0 20 20">
            <circle
              cx="10"
              cy="10"
              r="7"
              fill="none"
              stroke="rgba(217, 255, 0, 0.15)"
              strokeWidth="2"
            />
            <circle
              cx="10"
              cy="10"
              r="7"
              fill="none"
              stroke="#d9ff00"
              strokeWidth="2"
              strokeDasharray="14 44"
              strokeLinecap="round"
            />
          </svg>
        </div>
      );
    case 'completed':
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 checkmark-animate" />;
    case 'failed':
      return <XCircle className="h-3.5 w-3.5 text-red-400 shake-animate" />;
  }
}

// ---------------------------------------------------------------------------
// Queue Item Row
// ---------------------------------------------------------------------------

function QueueItemRow({ item, onDismiss }: { item: GenerationQueueItem; onDismiss: (id: string) => void }) {
  const [opacity, setOpacity] = useState(1);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-dismiss completed items after 5s (but keep in list with fade)
  useEffect(() => {
    if (item.status !== 'processing') {
      const fadeTimer = setTimeout(() => setOpacity(0.4), 4500);
      return () => {
        clearTimeout(fadeTimer);
      };
    }
  }, [item.status, item.id]);

  const truncatedPrompt =
    item.prompt.length > 60 ? item.prompt.slice(0, 60) + '...' : item.prompt;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20, scale: 0.95 }}
      animate={{ opacity, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={`queue-item-enter queue-item-expand flex items-start gap-2.5 rounded-lg border border-border/30 bg-surface/60 p-2.5 backdrop-blur-sm ${
        item.status === 'processing' ? 'queue-item-processing' : ''
      } ${item.status === 'completed' ? 'queue-item-complete' : ''} ${
        item.status === 'failed' ? 'queue-item-failed border-red-500/30' : ''
      }`}
    >
      {/* Provider color dot */}
      <span
        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: item.providerColor || '#888' }}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground/90 leading-snug truncate" title={item.prompt}>
          {truncatedPrompt}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-muted-foreground/70 truncate max-w-[120px]">
            {item.modelName}
          </span>
          <span className="text-[10px] text-muted-foreground/40">•</span>
          <span className="text-[10px] text-muted-foreground/50">
            {relativeTime(item.createdAt)}
          </span>
        </div>
        {/* Progress bar for processing items */}
        {item.status === 'processing' && (
          <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-white/5">
            <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-[#d9ff00]/60 to-[#d9ff00] animate-queue-progress" />
          </div>
        )}
        {/* Hover expand: show full prompt on hover */}
        <AnimatePresence>
          {isHovered && item.prompt.length > 60 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <p className="text-[10px] text-muted-foreground/60 leading-relaxed pt-1">
                {item.prompt}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Status */}
      <div className="shrink-0 mt-0.5">
        <StatusIcon status={item.status} />
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Generation Queue Component
// ---------------------------------------------------------------------------

export function GenerationQueue() {
  const { generationQueue, removeFromQueue, clearCompleted } = useAppStore();
  const [isExpanded, setIsExpanded] = useState(false);

  const activeCount = generationQueue.filter((i) => i.status === 'processing').length;
  const completedCount = generationQueue.filter((i) => i.status !== 'processing').length;
  const totalCount = generationQueue.length;

  const handleDismiss = useCallback(
    (id: string) => {
      removeFromQueue(id);
    },
    [removeFromQueue],
  );

  const handleClearCompleted = useCallback(() => {
    clearCompleted();
  }, [clearCompleted]);

  // Don't render anything if queue is empty
  if (totalCount === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 pointer-events-none">
      <AnimatePresence mode="wait">
        {isExpanded ? (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="pointer-events-auto w-80 rounded-xl border border-border/40 bg-[#0d0d0d]/85 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
              <div className="flex items-center gap-2">
                <ListOrdered className="h-4 w-4 text-[#d9ff00]/80" />
                <span className="text-xs font-semibold text-foreground/90">Generation Queue</span>
                {activeCount > 0 && (
                  <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-[#d9ff00]/15 text-[9px] font-bold text-[#d9ff00]">
                    {activeCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {completedCount > 0 && (
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleClearCompleted}
                    className="flex items-center gap-1 rounded-md border border-border/30 bg-surface/60 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:border-border/60 transition-all"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear
                  </motion.button>
                )}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsExpanded(false)}
                  className="flex items-center justify-center h-6 w-6 rounded-md border border-border/30 bg-surface/60 text-muted-foreground hover:text-foreground hover:border-border/60 transition-all"
                >
                  <Minimize2 className="h-3 w-3" />
                </motion.button>
              </div>
            </div>

            {/* Queue items */}
            <div className="max-h-80 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              <AnimatePresence>
                {generationQueue.map((item) => (
                  <QueueItemRow key={item.id} item={item} onDismiss={handleDismiss} />
                ))}
              </AnimatePresence>
            </div>

            {/* Footer hint */}
            {activeCount > 0 && (
              <div className="px-4 py-2 border-t border-border/20">
                <p className="text-[10px] text-muted-foreground/50 text-center">
                  {activeCount} generation{activeCount !== 1 ? 's' : ''} in progress
                </p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.button
            key="badge"
            type="button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsExpanded(true)}
            className="pointer-events-auto relative flex items-center justify-center h-12 w-12 rounded-full border border-border/40 bg-[#0d0d0d]/85 backdrop-blur-xl shadow-lg shadow-black/30 hover:border-[#d9ff00]/40 transition-all group"
          >
            {/* Pulse ring when active */}
            {activeCount > 0 && (
              <span className="absolute inset-0 rounded-full animate-pulse-ring border-2 border-[#d9ff00]/30" />
            )}

            <ListOrdered className="h-5 w-5 text-foreground/70 group-hover:text-[#d9ff00] transition-colors" />

            {/* Count badge */}
            <span className="absolute -top-1 -right-1 flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-[#d9ff00] text-background text-[10px] font-bold shadow-md">
              {totalCount}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
