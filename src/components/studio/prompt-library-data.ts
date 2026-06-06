import type { PromptTemplate } from '@/lib/types';

// ---------------------------------------------------------------------------
// Category definitions
// ---------------------------------------------------------------------------

export const CATEGORIES = [
  { id: 'all', label: 'All', color: '#d9ff00' },
  { id: 'portrait', label: 'Portrait', color: '#f472b6' },
  { id: 'landscape', label: 'Landscape', color: '#34d399' },
  { id: 'product', label: 'Product', color: '#fbbf24' },
  { id: 'fantasy', label: 'Fantasy', color: '#a78bfa' },
  { id: 'architecture', label: 'Architecture', color: '#60a5fa' },
  { id: 'abstract', label: 'Abstract', color: '#fb923c' },
  { id: 'character', label: 'Character', color: '#e879f9' },
  { id: 'fashion', label: 'Fashion', color: '#f43f5e' },
  { id: 'food', label: 'Food', color: '#fb7185' },
  { id: 'other', label: 'Other', color: '#94a3b8' },
] as const;

export const SORT_OPTIONS = [
  { id: 'recent', label: 'Recent' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'az', label: 'A-Z' },
  { id: 'used', label: 'Most Used' },
] as const;

// ---------------------------------------------------------------------------
// Template data — 30+ templates
// ---------------------------------------------------------------------------

export const TEMPLATES: PromptTemplate[] = [
  // Portrait (5)
  { id: 't-portrait-1', title: 'Professional Headshot', prompt: 'Professional headshot of {subject}, {lighting} lighting, sharp focus, shallow depth of field, high-end portrait photography', category: 'portrait', emoji: '👔' },
  { id: 't-portrait-2', title: 'Artistic Portrait', prompt: 'Artistic portrait of {subject}, {style} style, dramatic lighting, expressive, fine art photography', category: 'portrait', emoji: '🎨' },
  { id: 't-portrait-3', title: 'Fashion Portrait', prompt: 'Fashion editorial portrait of {subject}, wearing {outfit}, studio lighting, high fashion photography, Vogue style', category: 'portrait', emoji: '📸' },
  { id: 't-portrait-4', title: 'Candid Portrait', prompt: 'Candid portrait of {subject}, natural moment, soft natural lighting, authentic expression, lifestyle photography', category: 'portrait', emoji: '😊' },
  { id: 't-portrait-5', title: 'Fantasy Portrait', prompt: 'Fantasy portrait of {subject}, {accessories}, ethereal glow, magical atmosphere, detailed face, portrait painting', category: 'portrait', emoji: '✨' },

  // Landscape (5)
  { id: 't-landscape-1', title: 'Epic Landscape', prompt: 'Breathtaking {landscape_type} landscape, golden hour light, dramatic sky, ultra-wide shot, National Geographic quality', category: 'landscape', emoji: '🏔️' },
  { id: 't-landscape-2', title: 'Moody Landscape', prompt: 'Moody {landscape_type} scene, fog and mist, desaturated tones, atmospheric, fine art landscape', category: 'landscape', emoji: '🌫️' },
  { id: 't-landscape-3', title: 'Urban Landscape', prompt: 'Urban cityscape of {city}, twilight, city lights reflecting, long exposure, architectural photography', category: 'landscape', emoji: '🌃' },
  { id: 't-landscape-4', title: 'Seascape', prompt: 'Dramatic seascape, crashing waves, {time_of_day} light, long exposure water, coastal photography', category: 'landscape', emoji: '🌊' },
  { id: 't-landscape-5', title: 'Mountain Vista', prompt: 'Majestic mountain vista, alpine {season}, dramatic clouds, panoramic, adventure photography', category: 'landscape', emoji: '⛰️' },

  // Product (3)
  { id: 't-product-1', title: 'Product Hero', prompt: 'Premium product photography of {product}, clean white background, studio lighting, commercial quality, high detail', category: 'product', emoji: '📦' },
  { id: 't-product-2', title: 'Lifestyle Product', prompt: '{product} in lifestyle setting, natural environment, soft lighting, aspirational, commercial photography', category: 'product', emoji: '🏠' },
  { id: 't-product-3', title: 'Food Photography', prompt: 'Professional food photography of {dish}, styled plating, {lighting}, shallow depth of field, editorial quality', category: 'product', emoji: '🍽️' },

  // Fantasy (3)
  { id: 't-fantasy-1', title: 'Fantasy World', prompt: 'Epic fantasy world, {setting}, magical atmosphere, volumetric lighting, concept art, detailed matte painting', category: 'fantasy', emoji: '🏰' },
  { id: 't-fantasy-2', title: 'Creature Design', prompt: 'Fantasy creature design, {creature_type}, detailed anatomy, dramatic pose, concept art illustration', category: 'fantasy', emoji: '🐉' },
  { id: 't-fantasy-3', title: 'Magical Scene', prompt: 'Enchanted {location}, magical glow, floating particles, mystical atmosphere, fantasy illustration', category: 'fantasy', emoji: '🔮' },

  // Architecture (3)
  { id: 't-arch-1', title: 'Modern Architecture', prompt: 'Modern architectural photography, {building_type}, clean lines, dramatic perspective, architectural digest quality', category: 'architecture', emoji: '🏛️' },
  { id: 't-arch-2', title: 'Interior Design', prompt: 'Luxury interior design, {room_type}, warm ambient lighting, curated details, architectural photography', category: 'architecture', emoji: '🛋️' },
  { id: 't-arch-3', title: 'Historical Building', prompt: 'Grand historical {building_type}, ornate details, {era} architecture, golden light, heritage photography', category: 'architecture', emoji: '🕌' },

  // Abstract (3)
  { id: 't-abstract-1', title: 'Abstract Art', prompt: 'Abstract {medium} art, {color_scheme}, flowing forms, expressive, contemporary art', category: 'abstract', emoji: '🌀' },
  { id: 't-abstract-2', title: 'Geometric Pattern', prompt: 'Geometric pattern art, {pattern_type}, precise lines, mathematical beauty, modern design', category: 'abstract', emoji: '🔷' },
  { id: 't-abstract-3', title: 'Fluid Art', prompt: 'Fluid art, {colors}, organic flowing shapes, marbled texture, alcohol ink style', category: 'abstract', emoji: '💧' },

  // Character (3)
  { id: 't-char-1', title: 'Character Design', prompt: 'Character design sheet, {character_type}, full body, multiple poses, concept art, clean lines', category: 'character', emoji: '🦸' },
  { id: 't-char-2', title: 'Hero Character', prompt: 'Hero character portrait, {hero_type}, dramatic pose, epic armor, fantasy art, detailed illustration', category: 'character', emoji: '⚔️' },
  { id: 't-char-3', title: 'Sci-Fi Character', prompt: 'Sci-fi character, {role}, futuristic outfit, holographic elements, cyberpunk style, detailed rendering', category: 'character', emoji: '🤖' },

  // Fashion (3)
  { id: 't-fashion-1', title: 'Fashion Editorial', prompt: 'High fashion editorial, {garment}, runway pose, dramatic lighting, Vogue quality photography', category: 'fashion', emoji: '👗' },
  { id: 't-fashion-2', title: 'Street Style', prompt: 'Street style fashion, {style}, urban backdrop, candid, editorial photography', category: 'fashion', emoji: '👟' },
  { id: 't-fashion-3', title: 'Avant-Garde', prompt: 'Avant-garde fashion, {concept}, artistic styling, studio lighting, fashion art photography', category: 'fashion', emoji: '🎭' },

  // Food (2)
  { id: 't-food-1', title: 'Food Flatlay', prompt: 'Overhead food flatlay, {cuisine_type}, styled table setting, natural light, food styling photography', category: 'food', emoji: '🥘' },
  { id: 't-food-2', title: 'Action Food', prompt: 'Action food shot, {dish} being prepared, dynamic, steam, kitchen photography', category: 'food', emoji: '🔥' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_DISPLAY_LENGTH = 100;

export function truncate(text: string, max = MAX_DISPLAY_LENGTH) {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
}

export function getCategoryColor(categoryId: string): string {
  return CATEGORIES.find((c) => c.id === categoryId)?.color ?? '#94a3b8';
}

export function getCategoryLabel(categoryId: string): string {
  return CATEGORIES.find((c) => c.id === categoryId)?.label ?? 'Other';
}

export function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}
