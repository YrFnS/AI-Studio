'use client';

import { motion } from 'framer-motion';

// ---------------------------------------------------------------------------
// Particle burst component for favorite animation
// ---------------------------------------------------------------------------

export function ParticleBurst({ active }: { active: boolean }) {
  if (!active) return null;
  const particles = Array.from({ length: 8 });
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      {particles.map((_, i) => {
        const angle = (i / particles.length) * 360;
        const distance = 18 + Math.random() * 12;
        return (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-[#d9ff00]"
            initial={{ x: '-50%', y: '-50%', scale: 1, opacity: 1 }}
            animate={{
              x: `calc(-50% + ${Math.cos((angle * Math.PI) / 180) * distance}px)`,
              y: `calc(-50% + ${Math.sin((angle * Math.PI) / 180) * distance}px)`,
              scale: 0,
              opacity: 0,
            }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        );
      })}
    </div>
  );
}
