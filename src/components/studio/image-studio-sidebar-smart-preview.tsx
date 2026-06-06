'use client';

import { Sparkles } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import {
  STYLE_PRESETS,
  SUBJECT_PRESETS,
  DETAIL_LEVEL_PRESETS,
  COMPOSITION_PRESETS,
  EMOTION_PRESETS,
  ERA_PRESETS,
  OUTFIT_PRESETS,
  HAIRSTYLE_PRESETS,
  HAIR_COLOR_PRESETS,
  EYE_COLOR_PRESETS,
  POSE_PRESETS,
  ACCESSORIES_PRESETS,
  BODY_TYPE_PRESETS,
  AGE_PRESETS,
  LIGHTING_PRESETS,
  COLOR_MOOD_PRESETS,
  CAMERA_SHOT_PRESETS,
} from '@/components/studio/presets';

// ---------------------------------------------------------------------------
// Smart Prompt Builder Preview Card
// REBUILT: Strictly constrained width — no content can push sidebar wider
// Uses overflow-hidden and truncate on ALL text, fixed max-height
// ---------------------------------------------------------------------------

export function SmartPreviewCard() {
  const activeStylePresetVal = useAppStore((s) => s.activeStylePreset);
  const imageAutoEnhance = useAppStore((s) => s.imageAutoEnhance);
  const imageSubject = useAppStore((s) => s.imageSubject);
  const imageDetailLevel = useAppStore((s) => s.imageDetailLevel);
  const imageComposition = useAppStore((s) => s.imageComposition);
  const imageEmotion = useAppStore((s) => s.imageEmotion);
  const imageEra = useAppStore((s) => s.imageEra);
  const imageOutfit = useAppStore((s) => s.imageOutfit);
  const imageHairstyle = useAppStore((s) => s.imageHairstyle);
  const imageHairColor = useAppStore((s) => s.imageHairColor);
  const imageEyeColor = useAppStore((s) => s.imageEyeColor);
  const imagePose = useAppStore((s) => s.imagePose);
  const imageAccessories = useAppStore((s) => s.imageAccessories);
  const imageBodyType = useAppStore((s) => s.imageBodyType);
  const imageAge = useAppStore((s) => s.imageAge);
  const imageLighting = useAppStore((s) => s.imageLighting);
  const imageColorMood = useAppStore((s) => s.imageColorMood);
  const imageCameraShot = useAppStore((s) => s.imageCameraShot);
  const imageOutfitDescription = useAppStore((s) => s.imageOutfitDescription);
  const imageOutfitImageUrl = useAppStore((s) => s.imageOutfitImageUrl);

  const activeCharCount = [
    imageOutfit, imageHairstyle, imageHairColor, imageEyeColor,
    imagePose, imageAccessories, imageBodyType, imageAge,
  ].filter((v) => v !== 'none').length;

  const totalActivePresets = [
    activeStylePresetVal ? 1 : 0,
    imageSubject !== 'none' ? 1 : 0,
    imageDetailLevel !== 'none' ? 1 : 0,
    imageComposition !== 'none' ? 1 : 0,
    imageEmotion !== 'none' ? 1 : 0,
    imageEra !== 'none' ? 1 : 0,
    activeCharCount,
    imageOutfitDescription ? 1 : 0,
    imageOutfitImageUrl ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  // Build suffix parts
  const parts: string[] = [];
  if (activeStylePresetVal) {
    const p = STYLE_PRESETS.find((s) => s.id === activeStylePresetVal);
    if (p?.suffix) parts.push(p.suffix.slice(2));
  }
  if (imageSubject !== 'none') {
    const p = SUBJECT_PRESETS.find((s) => s.id === imageSubject);
    if (p?.suffix) parts.push(p.suffix.slice(2));
  }
  if (imageDetailLevel !== 'none') {
    const p = DETAIL_LEVEL_PRESETS.find((s) => s.id === imageDetailLevel);
    if (p?.suffix) parts.push(p.suffix.slice(2));
  }
  if (imageComposition !== 'none') {
    const p = COMPOSITION_PRESETS.find((s) => s.id === imageComposition);
    if (p?.suffix) parts.push(p.suffix.slice(2));
  }
  if (imageEmotion !== 'none') {
    const p = EMOTION_PRESETS.find((s) => s.id === imageEmotion);
    if (p?.suffix) parts.push(p.suffix.slice(2));
  }
  if (imageEra !== 'none') {
    const p = ERA_PRESETS.find((s) => s.id === imageEra);
    if (p?.suffix) parts.push(p.suffix.slice(2));
  }
  if (imageLighting !== 'none') {
    const p = LIGHTING_PRESETS.find((s) => s.id === imageLighting);
    if (p?.suffix) parts.push(p.suffix.slice(2));
  }
  if (imageColorMood !== 'none') {
    const p = COLOR_MOOD_PRESETS.find((s) => s.id === imageColorMood);
    if (p?.suffix) parts.push(p.suffix.slice(2));
  }
  if (imageCameraShot !== 'none') {
    const p = CAMERA_SHOT_PRESETS.find((s) => s.id === imageCameraShot);
    if (p?.suffix) parts.push(p.suffix.slice(2));
  }
  if (imageOutfit !== 'none') {
    const p = OUTFIT_PRESETS.find((s) => s.id === imageOutfit);
    if (p?.suffix) parts.push(p.suffix.slice(2));
  }
  if (imageHairstyle !== 'none') {
    const p = HAIRSTYLE_PRESETS.find((s) => s.id === imageHairstyle);
    if (p?.suffix) parts.push(p.suffix.slice(2));
  }
  if (imageHairColor !== 'none') {
    const p = HAIR_COLOR_PRESETS.find((s) => s.id === imageHairColor);
    if (p?.suffix) parts.push(p.suffix.slice(2));
  }
  if (imageEyeColor !== 'none') {
    const p = EYE_COLOR_PRESETS.find((s) => s.id === imageEyeColor);
    if (p?.suffix) parts.push(p.suffix.slice(2));
  }
  if (imagePose !== 'none') {
    const p = POSE_PRESETS.find((s) => s.id === imagePose);
    if (p?.suffix) parts.push(p.suffix.slice(2));
  }
  if (imageAccessories !== 'none') {
    const p = ACCESSORIES_PRESETS.find((s) => s.id === imageAccessories);
    if (p?.suffix) parts.push(p.suffix.slice(2));
  }
  if (imageBodyType !== 'none') {
    const p = BODY_TYPE_PRESETS.find((s) => s.id === imageBodyType);
    if (p?.suffix) parts.push(p.suffix.slice(2));
  }
  if (imageAge !== 'none') {
    const p = AGE_PRESETS.find((s) => s.id === imageAge);
    if (p?.suffix) parts.push(p.suffix.slice(2));
  }
  if (imageOutfitDescription) {
    parts.push(`wearing ${imageOutfitDescription}`);
  }
  if (imageOutfitImageUrl) {
    parts.push('outfit reference image');
  }

  const hasContent = parts.length > 0 || imageAutoEnhance;

  // KEY FIX: Always render in the DOM, use opacity/height to show/hide
  // Use overflow-hidden to prevent any text from pushing sidebar wider
  // Use line-clamp to limit text to 2 lines max
  return (
    <div
      className={`overflow-hidden transition-all duration-200 ${
        hasContent ? 'max-h-[120px] opacity-100' : 'max-h-0 opacity-0'
      }`}
    >
      <div className="rounded-md border border-[#d9ff00]/20 bg-[#d9ff00]/5 p-2.5 space-y-1 overflow-hidden">
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          <Sparkles className="h-3 w-3 text-[#d9ff00] shrink-0" />
          <span className="text-[10px] font-semibold text-[#d9ff00] uppercase tracking-wider truncate">Smart Preview</span>
          {totalActivePresets > 0 && (
            <span className="shrink-0 inline-flex items-center justify-center h-3.5 min-w-[14px] px-1 rounded-full text-[7px] font-bold bg-[#d9ff00]/15 text-[#d9ff00]">
              {totalActivePresets}
            </span>
          )}
          {imageAutoEnhance && (
            <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-purple-500/10 px-1.5 py-0.5 text-[7px] font-bold text-purple-400">
              AUTO
            </span>
          )}
        </div>
        <p className="text-[9px] text-muted-foreground/80 leading-relaxed overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {imageAutoEnhance && (
            <span className="text-purple-400/80">AI-enhanced</span>
          )}
          {imageAutoEnhance && parts.length > 0 && (
            <span className="text-muted-foreground/40"> + </span>
          )}
          {parts.length > 0 && (
            <>
              <span className="text-muted-foreground/50">prompt + </span>
              <span className="text-[#d9ff00]/70">{parts.join(', ')}</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Presets Summary Line
// REBUILT: Strictly constrained width — badges wrap instead of expanding
// Uses overflow-hidden and flex-wrap with max-height
// ---------------------------------------------------------------------------

export function PresetsSummaryLine() {
  const activeStylePresetVal = useAppStore((s) => s.activeStylePreset);
  const imageSubject = useAppStore((s) => s.imageSubject);
  const imageDetailLevel = useAppStore((s) => s.imageDetailLevel);
  const imageComposition = useAppStore((s) => s.imageComposition);
  const imageEmotion = useAppStore((s) => s.imageEmotion);
  const imageEra = useAppStore((s) => s.imageEra);
  const imageOutfit = useAppStore((s) => s.imageOutfit);
  const imageHairstyle = useAppStore((s) => s.imageHairstyle);
  const imageHairColor = useAppStore((s) => s.imageHairColor);
  const imageEyeColor = useAppStore((s) => s.imageEyeColor);
  const imagePose = useAppStore((s) => s.imagePose);
  const imageAccessories = useAppStore((s) => s.imageAccessories);
  const imageBodyType = useAppStore((s) => s.imageBodyType);
  const imageAge = useAppStore((s) => s.imageAge);
  const imageOutfitDescription = useAppStore((s) => s.imageOutfitDescription);
  const imageOutfitImageUrl = useAppStore((s) => s.imageOutfitImageUrl);

  const badges: { emoji: string; label: string }[] = [];
  if (activeStylePresetVal) {
    const p = STYLE_PRESETS.find((s) => s.id === activeStylePresetVal);
    if (p) badges.push({ emoji: p.emoji, label: p.label });
  }
  if (imageSubject !== 'none') {
    const p = SUBJECT_PRESETS.find((s) => s.id === imageSubject);
    if (p) badges.push({ emoji: p.emoji, label: p.label });
  }
  if (imageDetailLevel !== 'none') {
    const p = DETAIL_LEVEL_PRESETS.find((s) => s.id === imageDetailLevel);
    if (p) badges.push({ emoji: p.emoji, label: p.label });
  }
  if (imageComposition !== 'none') {
    const p = COMPOSITION_PRESETS.find((s) => s.id === imageComposition);
    if (p) badges.push({ emoji: p.emoji, label: p.label });
  }
  if (imageEmotion !== 'none') {
    const p = EMOTION_PRESETS.find((s) => s.id === imageEmotion);
    if (p) badges.push({ emoji: p.emoji, label: p.label });
  }
  if (imageEra !== 'none') {
    const p = ERA_PRESETS.find((s) => s.id === imageEra);
    if (p) badges.push({ emoji: p.emoji, label: p.label });
  }
  if (imageOutfit !== 'none') {
    const p = OUTFIT_PRESETS.find((s) => s.id === imageOutfit);
    if (p) badges.push({ emoji: p.emoji, label: p.label });
  }
  if (imageHairstyle !== 'none') {
    const p = HAIRSTYLE_PRESETS.find((s) => s.id === imageHairstyle);
    if (p) badges.push({ emoji: p.emoji, label: p.label });
  }
  if (imageHairColor !== 'none') {
    const p = HAIR_COLOR_PRESETS.find((s) => s.id === imageHairColor);
    if (p) badges.push({ emoji: p.emoji, label: p.label });
  }
  if (imageEyeColor !== 'none') {
    const p = EYE_COLOR_PRESETS.find((s) => s.id === imageEyeColor);
    if (p) badges.push({ emoji: p.emoji, label: p.label });
  }
  if (imagePose !== 'none') {
    const p = POSE_PRESETS.find((s) => s.id === imagePose);
    if (p) badges.push({ emoji: p.emoji, label: p.label });
  }
  if (imageAccessories !== 'none') {
    const p = ACCESSORIES_PRESETS.find((s) => s.id === imageAccessories);
    if (p) badges.push({ emoji: p.emoji, label: p.label });
  }
  if (imageBodyType !== 'none') {
    const p = BODY_TYPE_PRESETS.find((s) => s.id === imageBodyType);
    if (p) badges.push({ emoji: p.emoji, label: p.label });
  }
  if (imageAge !== 'none') {
    const p = AGE_PRESETS.find((s) => s.id === imageAge);
    if (p) badges.push({ emoji: p.emoji, label: p.label });
  }
  if (imageOutfitDescription) {
    badges.push({ emoji: '👕', label: imageOutfitDescription.length > 20 ? imageOutfitDescription.slice(0, 20) + '…' : imageOutfitDescription });
  }
  if (imageOutfitImageUrl) {
    badges.push({ emoji: '🖼️', label: 'Outfit Ref' });
  }

  const hasBadges = badges.length > 0;

  // KEY FIX: Always render in DOM, use flex-wrap so badges wrap to next line
  // instead of pushing sidebar wider. Add overflow-hidden as safety net.
  // Max 2 rows of badges with overflow-y-hidden.
  return (
    <div
      className={`overflow-hidden transition-all duration-200 ${
        hasBadges ? 'max-h-[52px] opacity-100' : 'max-h-0 opacity-0'
      }`}
    >
      <div className="flex flex-wrap gap-1 overflow-hidden max-h-[44px]">
        {badges.map((b, i) => (
          <span key={i} className="flex items-center gap-0.5 shrink-0 rounded-full bg-[#d9ff00]/8 border border-[#d9ff00]/15 px-1.5 py-0.5 text-[8px] font-medium text-[#d9ff00]/70 max-w-[120px] overflow-hidden">
            <span className="text-[9px] shrink-0">{b.emoji}</span>
            <span className="truncate">{b.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
