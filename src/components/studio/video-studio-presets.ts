// ---------------------------------------------------------------------------
// Video Studio – Types & Preset Data
// ---------------------------------------------------------------------------

import type { Provider, ProviderModel } from '@/components/studio/image-studio-types';

export type { Provider, ProviderModel };

// ---------------------------------------------------------------------------
// Aspect ratio config
// ---------------------------------------------------------------------------

export const VIDEO_ASPECT_RATIOS = ['16:9', '9:16', '1:1'] as const;

export const RATIO_LABELS: Record<string, string> = {
  '16:9': 'Landscape',
  '9:16': 'Portrait',
  '1:1': 'Square',
};

// ---------------------------------------------------------------------------
// Video Style Presets
// ---------------------------------------------------------------------------

export const VIDEO_STYLE_PRESETS = [
  { id: 'cinematic', emoji: '🎬', label: 'Cinematic', suffix: ', cinematic video, film grain, dramatic camera movement, 24fps, movie scene' },
  { id: 'documentary', emoji: '📹', label: 'Documentary', suffix: ', documentary style, natural footage, observational, voice-over ready' },
  { id: 'commercial', emoji: '💼', label: 'Commercial', suffix: ', commercial video, product showcase, clean lighting, smooth camera' },
  { id: 'music-video', emoji: '🎵', label: 'Music Video', suffix: ', music video style, dynamic cuts, visual effects, rhythmic editing' },
  { id: 'slow-motion', emoji: '🐌', label: 'Slow Motion', suffix: ', slow motion video, high frame rate, fluid movement, time stretch' },
  { id: 'time-lapse', emoji: '⏰', label: 'Time-lapse', suffix: ', time-lapse video, accelerated time, sweeping movement, long exposure' },
  { id: 'loop', emoji: '🔁', label: 'Loop', suffix: ', seamless loop, perfectly looping video, continuous motion, endless cycle' },
  { id: 'animation', emoji: '🎨', label: 'Animation', suffix: ', animated video, motion graphics, smooth transitions, fluid animation' },
  { id: 'drone-shot', emoji: '🚁', label: 'Drone Shot', suffix: ', aerial drone footage, sweeping bird\'s eye view, smooth gliding camera' },
  { id: 'vlog', emoji: '📱', label: 'Vlog', suffix: ', vlog style, handheld camera, personal perspective, casual footage' },
];

// ---------------------------------------------------------------------------
// Camera Motion Presets
// ---------------------------------------------------------------------------

export const CAMERA_MOTION_PRESETS = [
  { id: 'static', emoji: '📷', label: 'Static', suffix: ', static camera, locked off shot, no movement' },
  { id: 'pan-left', emoji: '⬅️', label: 'Pan Left', suffix: ', camera panning left, smooth horizontal movement' },
  { id: 'pan-right', emoji: '➡️', label: 'Pan Right', suffix: ', camera panning right, smooth horizontal movement' },
  { id: 'zoom-in', emoji: '🔍', label: 'Zoom In', suffix: ', camera zooming in, gradually closer, tight framing' },
  { id: 'zoom-out', emoji: '🔭', label: 'Zoom Out', suffix: ', camera zooming out, pulling back, revealing scene' },
  { id: 'orbit', emoji: '🔄', label: 'Orbit', suffix: ', camera orbiting around subject, 360 rotation' },
  { id: 'dolly', emoji: '🎬', label: 'Dolly', suffix: ', camera dollying forward, smooth tracking shot' },
  { id: 'crane-up', emoji: '⬆️', label: 'Crane Up', suffix: ', camera crane shot rising, ascending movement' },
  { id: 'crane-down', emoji: '⬇️', label: 'Crane Down', suffix: ', camera crane shot descending, lowering movement' },
  { id: 'shake', emoji: '📳', label: 'Shake', suffix: ', camera shake, handheld vibration, dynamic movement' },
];

// ---------------------------------------------------------------------------
// Video Mood Presets
// ---------------------------------------------------------------------------

export const VIDEO_MOOD_PRESETS = [
  { id: 'dramatic', emoji: '🎭', label: 'Dramatic', suffix: ', dramatic mood, intense, powerful, cinematic tension' },
  { id: 'peaceful', emoji: '🕊️', label: 'Peaceful', suffix: ', peaceful mood, calm, serene, tranquil atmosphere' },
  { id: 'energetic', emoji: '⚡', label: 'Energetic', suffix: ', energetic mood, fast-paced, dynamic, high energy' },
  { id: 'mysterious', emoji: '🌙', label: 'Mysterious', suffix: ', mysterious mood, enigmatic, shadowy, suspenseful' },
  { id: 'romantic', emoji: '💕', label: 'Romantic', suffix: ', romantic mood, dreamy, warm, intimate' },
  { id: 'epic', emoji: '⚔️', label: 'Epic', suffix: ', epic mood, grand, monumental, awe-inspiring' },
  { id: 'nostalgic', emoji: '📼', label: 'Nostalgic', suffix: ', nostalgic mood, vintage feel, warm tones, reminiscent' },
  { id: 'futuristic', emoji: '🚀', label: 'Futuristic', suffix: ', futuristic mood, sci-fi, sleek, advanced technology' },
];
