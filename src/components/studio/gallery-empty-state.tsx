'use client';

import { motion } from 'framer-motion';
import { LayoutGrid, Zap, Search, Sparkles } from 'lucide-react';

import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Gallery Empty State
// ---------------------------------------------------------------------------

export function GalleryEmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex min-h-[60vh] flex-col items-center justify-center gap-8 text-center w-full max-w-2xl mx-auto relative"
    >
      <div className="absolute inset-0 -m-8 rounded-3xl bg-gradient-to-br from-[#d9ff00]/5 via-transparent to-[#d9ff00]/3 animate-empty-gradient pointer-events-none" />
      <div className="absolute inset-0 -m-8 rounded-3xl bg-gradient-to-tl from-transparent via-[#d9ff00]/2 to-[#d9ff00]/4 animate-empty-gradient pointer-events-none" style={{ animationDelay: '4s' }} />

      <div className="relative z-10 gallery-empty-zoom">
        <div className="absolute -inset-6 rounded-full bg-[#d9ff00]/5 blur-3xl animate-empty-glow" />
        <motion.div
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="relative flex h-32 w-32 items-center justify-center rounded-3xl border border-[#d9ff00]/20 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-sm shadow-[0_0_40px_rgba(217,255,0,0.08)]"
        >
          <motion.div
            animate={{ scale: [1, 1.08, 1], rotate: [0, 3, -3, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <LayoutGrid className="h-14 w-14 text-[#d9ff00]/70" />
          </motion.div>
        </motion.div>
      </div>

      <div className="relative z-10">
        <h3 className="text-2xl font-bold text-foreground tracking-tight">
          Your creative gallery
        </h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-md leading-relaxed">
          All your AI-generated images and videos will appear here. Start creating to fill your gallery.
        </p>
      </div>

      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 border border-white/10 rounded-xl p-4 text-left hover:border-[#d9ff00]/20 hover:bg-white/[0.07] transition-all group cursor-default"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <LayoutGrid className="h-4 w-4 text-[#d9ff00]" />
            <span className="text-xs font-semibold text-foreground group-hover:text-[#d9ff00] transition-colors">Smart Gallery</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">Browse all your AI generations in one place</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white/5 border border-white/10 rounded-xl p-4 text-left hover:border-[#d9ff00]/20 hover:bg-white/[0.07] transition-all group cursor-default"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Zap className="h-4 w-4 text-[#d9ff00]" />
            <span className="text-xs font-semibold text-foreground group-hover:text-[#d9ff00] transition-colors">Quick Actions</span>
          </div>
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed">Download, favorite, and share with one click</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white/5 border border-white/10 rounded-xl p-4 text-left hover:border-[#d9ff00]/20 hover:bg-white/[0.07] transition-all group cursor-default"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Search className="h-4 w-4 text-[#d9ff00]" />
            <span className="text-xs font-semibold text-foreground group-hover:text-[#d9ff00] transition-colors">Advanced Search</span>
          </div>
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed">Find any generation by prompt or model</p>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
        className="relative z-10"
      >
        <Button
          onClick={() => useAppStore.getState().setActiveTab('image')}
          className="gap-2 bg-[#d9ff00] text-background hover:bg-[#c5eb00] font-semibold rounded-xl px-6 h-11 shadow-[0_0_20px_rgba(217,255,0,0.2)] hover:shadow-[0_0_30px_rgba(217,255,0,0.3)] transition-all duration-200 animate-pulse-glow"
        >
          <Sparkles className="h-4 w-4" />
          Start Creating
        </Button>
      </motion.div>
    </motion.div>
  );
}
