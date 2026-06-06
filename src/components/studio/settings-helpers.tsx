// ---------------------------------------------------------------------------
// Shared helpers for Settings components
// ---------------------------------------------------------------------------

import { maskKey as idbMaskKey } from '@/lib/idb';
import { CAPABILITY_OPTIONS } from '@/lib/types';

// ---------------------------------------------------------------------------
// Key format validation
// ---------------------------------------------------------------------------

const KEY_VALIDATION: Record<string, { pattern: RegExp; hint: string }> = {
  'sk-': { pattern: /^sk-[a-zA-Z0-9-_]{20,}$/, hint: 'Must start with sk- followed by 20+ characters' },
  'r8_': { pattern: /^r8_[a-zA-Z0-9-_]{10,}$/, hint: 'Must start with r8_ followed by 10+ characters' },
  'hf_': { pattern: /^hf_[a-zA-Z0-9-_]{10,}$/, hint: 'Must start with hf_ followed by 10+ characters' },
  'AIza': { pattern: /^(AIza[a-zA-Z0-9-_]{30,}|AQ[a-zA-Z0-9._-]{30,}|[a-zA-Z0-9._-]{35,})$/, hint: 'Google API key (AIza..., AQ..., or 35+ char key)' },
};

export function getKeyValidationHint(keyFormat: string | undefined): string | null {
  if (!keyFormat) return null;
  for (const [prefix, val] of Object.entries(KEY_VALIDATION)) {
    if (keyFormat.startsWith(prefix)) return val.hint;
  }
  return null;
}

export function validateKeyFormat(key: string, keyFormat: string | undefined): { valid: boolean; message?: string } {
  if (!key || key.trim().length < 8) {
    return { valid: false, message: 'Key must be at least 8 characters' };
  }
  if (!keyFormat) return { valid: true };

  for (const [prefix, val] of Object.entries(KEY_VALIDATION)) {
    if (keyFormat.startsWith(prefix)) {
      if (val.pattern.test(key)) return { valid: true };
      return { valid: false, message: val.hint };
    }
  }
  return { valid: true };
}

export function maskKey(key: string): string {
  return idbMaskKey(key);
}

// ---------------------------------------------------------------------------
// Provider icon dot
// ---------------------------------------------------------------------------

export function ProviderDot({ color, size = 'sm' }: { color?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'h-3 w-3', md: 'h-4 w-4', lg: 'h-5 w-5' };
  return (
    <span
      className={`inline-block rounded-full shrink-0 ring-2 ring-white/10 ${sizeClasses[size]}`}
      style={{ backgroundColor: color || '#888' }}
    />
  );
}

// ---------------------------------------------------------------------------
// Provider emoji map
// ---------------------------------------------------------------------------

const PROVIDER_EMOJIS: Record<string, string> = {
  openai: '🟢',
  stability: '🟣',
  replicate: '🔵',
  fal: '🟠',
  together: '🟡',
  fireworks: '🔴',
  huggingface: '🤗',
  ideogram: '🟤',
  leonardo: '🎨',
  recraft: '🔷',
  runway: '🎬',
  luma: '✨',
  seedance: '🌱',
  google: '🔵',
  'google-aistudio': '🔵',
  'google-vertex': '🟩',
  anthropic: '🟧',
  midjourney: '⛵',
};

export function getProviderEmoji(name: string): string {
  return PROVIDER_EMOJIS[name.toLowerCase()] || '🔑';
}

// ---------------------------------------------------------------------------
// Capability badge colors
// ---------------------------------------------------------------------------

export const CAPABILITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  t2i: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
  i2i: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  inpaint: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  upscale: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
  edit: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' },
  t2v: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  i2v: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
};

// Re-export CAPABILITY_OPTIONS for convenience
export { CAPABILITY_OPTIONS };
