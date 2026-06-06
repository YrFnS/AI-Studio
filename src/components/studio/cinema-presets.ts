// ---------------------------------------------------------------------------
// Cinema Studio – Data Constants, Types & Helpers
// ---------------------------------------------------------------------------

import type { Provider, ProviderModel } from '@/components/studio/image-studio-types';

export type { Provider, ProviderModel };

// ---------------------------------------------------------------------------
// Cinema Data Constants
// ---------------------------------------------------------------------------

export const CAMERA_BODIES = [
  { id: 'arri-alexa-mini-lf', name: 'ARRI Alexa Mini LF', style: 'cinematic, rich colors, wide dynamic range' },
  { id: 'red-v-raptor', name: 'RED V-Raptor XL', style: '8K resolution, sharp detail, cinematic' },
  { id: 'sony-venice-2', name: 'Sony Venice 2', style: 'full-frame cinematic, natural skin tones' },
  { id: 'canon-eos-r5', name: 'Canon EOS R5', style: 'clean, sharp, vibrant colors' },
  { id: 'blackmagic-ursa', name: 'Blackmagic URSA Mini Pro', style: 'film look, organic, cinematic' },
  { id: 'panavision-dxl2', name: 'Panavision DXL2', style: 'Hollywood cinema, anamorphic, epic' },
  { id: 'nikon-z9', name: 'Nikon Z9', style: 'sharp, detailed, professional photography' },
  { id: 'leica-s3', name: 'Leica S3', style: 'medium format, creamy bokeh, premium look' },
];

export const LENS_TYPES = [
  { id: 'cooke-anamorphic', name: 'Cooke Anamorphic', effect: 'anamorphic lens flare, oval bokeh, cinematic widescreen' },
  { id: 'zeiss-master-prime', name: 'Zeiss Master Prime', effect: 'razor sharp, minimal distortion, clean rendering' },
  { id: 'panavision-ultra', name: 'Panavision Ultra Vista', effect: 'anamorphic, wide aspect, beautiful flare' },
  { id: 'canon-cn-e', name: 'Canon CN-E Cinema Prime', effect: 'smooth bokeh, warm tones, cinema quality' },
  { id: 'sigma-cine', name: 'Sigma Cine Prime', effect: 'sharp, modern rendering, high contrast' },
  { id: 'tokina-vista', name: 'Tokina Vista Prime', effect: 'vintage character, warm flares, organic' },
  { id: 'leica-thalia', name: 'Leica Thalia', effect: 'medium format cinema, smooth, elegant' },
  { id: 'angénieux-optimo', name: 'Angénieux Optimo', effect: 'French cinema, smooth zoom, beautiful rendering' },
];

export const FILM_STOCKS = [
  { id: 'kodak-portra-400', name: 'Kodak Portra 400', effect: 'warm skin tones, pastel colors, natural grain' },
  { id: 'fujifilm-pro-400h', name: 'Fujifilm Pro 400H', effect: 'cool tones, fine grain, subtle pastels' },
  { id: 'kodak-ektar-100', name: 'Kodak Ektar 100', effect: 'vivid saturated colors, ultra fine grain' },
  { id: 'ilford-hp5', name: 'Ilford HP5 Plus', effect: 'classic black and white, visible grain, contrasty' },
  { id: 'cinestill-800t', name: 'CineStill 800T', effect: 'tungsten balanced, halation, night photography' },
  { id: 'kodak-vision3-500t', name: 'Kodak Vision3 500T', effect: 'cinematic tungsten, rich shadows, film grain' },
  { id: 'fujifilm-superia', name: 'Fujifilm Superia 400', effect: 'everyday film, slight green cast, nostalgic' },
  { id: 'none', name: 'Digital (No Film Stock)', effect: '' },
];

export const COLOR_GRADES = [
  { id: 'teal-orange', name: 'Teal & Orange', effect: 'teal shadows, orange highlights, blockbuster look' },
  { id: 'bleach-bypass', name: 'Bleach Bypass', effect: 'desaturated, high contrast, metallic look' },
  { id: 'cross-process', name: 'Cross Process', effect: 'unnatural colors, high saturation, vintage' },
  { id: 'desaturated', name: 'Desaturated', effect: 'muted colors, subtle tones, moody' },
  { id: 'high-contrast', name: 'High Contrast', effect: 'deep blacks, bright highlights, dramatic' },
  { id: 'natural', name: 'Natural', effect: 'true to life colors, balanced exposure' },
  { id: 'none', name: 'None (Original)', effect: '' },
];

export const LIGHTING_SETUPS = [
  { id: 'golden-hour', name: 'Golden Hour', effect: 'warm directional sunlight, long shadows, golden tones' },
  { id: 'blue-hour', name: 'Blue Hour', effect: 'cool ambient light, deep blue sky, silhouette potential' },
  { id: 'overcast', name: 'Overcast', effect: 'soft diffused light, even illumination, no harsh shadows' },
  { id: 'studio-three-point', name: 'Studio Three-Point', effect: 'professional key, fill, and back lighting, controlled' },
  { id: 'rembrandt', name: 'Rembrandt', effect: 'dramatic side lighting, triangle of light on cheek, moody' },
  { id: 'neon-noir', name: 'Neon Noir', effect: 'neon colored lights, dark shadows, cyberpunk atmosphere' },
  { id: 'silhouette', name: 'Silhouette', effect: 'backlit subject, dark foreground, bright background' },
  { id: 'natural-window', name: 'Natural Window', effect: 'soft directional window light, natural, flattering' },
  { id: 'none', name: 'None (Unspecified)', effect: '' },
];

export const FOCAL_LENGTH_PRESETS = [
  { label: 'Ultra Wide 14mm', value: 14 },
  { label: 'Wide 24mm', value: 24 },
  { label: 'Standard 35mm', value: 35 },
  { label: 'Normal 50mm', value: 50 },
  { label: 'Portrait 85mm', value: 85 },
  { label: 'Short Tele 135mm', value: 135 },
  { label: 'Telephoto 200mm', value: 200 },
];

export const APERTURE_STOPS = [1.4, 1.8, 2, 2.8, 4, 5.6, 8, 11, 16, 22];

// ---------------------------------------------------------------------------
// Cinema Scene Presets
// ---------------------------------------------------------------------------

export const CINEMA_SCENE_PRESETS = [
  { id: 'hollywood-epic', emoji: '🎬', label: 'Hollywood Epic', suffix: ', grand cinematic wide shot, dramatic scale, sweeping vistas' },
  { id: 'neo-noir', emoji: '🌆', label: 'Neo Noir', suffix: ', noir style, high contrast, rain-slicked streets, moody' },
  { id: 'golden-hour', emoji: '🌅', label: 'Golden Hour', suffix: ', warm golden light, long shadows, romantic atmosphere' },
  { id: 'urban-night', emoji: '🏙️', label: 'Urban Night', suffix: ', neon lights, urban cityscape, cyberpunk atmosphere, reflections' },
  { id: 'drama', emoji: '🎭', label: 'Drama', suffix: ', intense dramatic lighting, chiaroscuro, emotional close-up' },
  { id: 'natural', emoji: '🌿', label: 'Natural', suffix: ', soft natural lighting, organic feel, earthy tones, serene' },
  { id: 'sci-fi', emoji: '🔮', label: 'Sci-Fi', suffix: ', futuristic, holographic, advanced technology, clean lines' },
  { id: 'vintage', emoji: '🏚️', label: 'Vintage', suffix: ', retro film grain, vintage color palette, nostalgic warmth' },
  { id: 'fantasy', emoji: '🎪', label: 'Fantasy', suffix: ', magical, ethereal glow, enchanted, mystical atmosphere' },
  { id: 'documentary', emoji: '📸', label: 'Documentary', suffix: ', raw, authentic, handheld feel, natural lighting, candid' },
];

// ---------------------------------------------------------------------------
// Aspect ratio helpers
// ---------------------------------------------------------------------------

export const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'] as const;

export const RATIO_LABELS: Record<string, string> = {
  '1:1': 'Square',
  '16:9': 'Landscape',
  '9:16': 'Portrait',
  '4:3': 'Classic',
  '3:4': 'Tall',
  '3:2': 'Photo',
  '2:3': 'Slim',
};

// ---------------------------------------------------------------------------
// Cinema Prompt Suffix Builder
// ---------------------------------------------------------------------------

export function buildCinemaSuffix(
  camera: string,
  lens: string,
  focalLength: number,
  aperture: number,
  filmStock: string,
  colorGrade: string,
  lighting: string,
  scenePreset: string,
): string {
  const parts: string[] = [];

  // Scene preset suffix
  const sceneData = CINEMA_SCENE_PRESETS.find((s) => s.id === scenePreset);
  if (sceneData) {
    parts.push(sceneData.suffix.trim().replace(/^,\s*/, ''));
  }

  const cameraData = CAMERA_BODIES.find((c) => c.id === camera);
  if (cameraData) {
    parts.push(`shot on ${cameraData.name}`);
  }

  const lensData = LENS_TYPES.find((l) => l.id === lens);
  if (lensData) {
    parts.push(`${lensData.name} ${focalLength}mm lens`);
  }

  parts.push(`f/${aperture}`);

  const filmData = FILM_STOCKS.find((f) => f.id === filmStock);
  if (filmData && filmData.id !== 'none') {
    parts.push(`${filmData.name} film stock`);
  }

  const gradeData = COLOR_GRADES.find((g) => g.id === colorGrade);
  if (gradeData && gradeData.id !== 'none') {
    parts.push(`${gradeData.name.toLowerCase()} color grade`);
  }

  const lightData = LIGHTING_SETUPS.find((l) => l.id === lighting);
  if (lightData && lightData.id !== 'none') {
    parts.push(`${lightData.name.toLowerCase()} lighting`);
  }

  // Add cinematic keywords
  if (aperture <= 2.8) {
    parts.push('cinematic depth of field');
  }
  if (lensData && lensData.id.includes('anamorphic')) {
    parts.push('anamorphic lens flare');
  }

  return parts.join(', ');
}
