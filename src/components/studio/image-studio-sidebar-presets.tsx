'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Palette,
  User,
  Search,
  Grid3x3,
  Heart,
  Clock,
  Shirt,
  Scissors,
  Gem,
  Eye,
  Footprints,
  Glasses,
  UserCircle,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Label } from '@/components/ui/label';
import { PresetButton } from '@/components/studio/preset-button';
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
} from '@/components/studio/presets';
import { CollapsibleHeader } from '@/components/studio/image-studio-sidebar-shared';
import { SidebarChangeOutfit } from '@/components/studio/image-studio-sidebar-outfit';
import { SidebarQuickPrompts } from '@/components/studio/image-studio-sidebar-quick-prompts';

// CSS-only collapsible — no framer-motion
// REBUILT: Added min-w-0 and overflow-hidden to prevent width expansion
function CollapsibleSection({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) {
  return (
    <div
      className={'overflow-hidden min-w-0 transition-[max-height,opacity] duration-200 ease-in-out ' + (isOpen ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0')}
    >
      <div className="pt-1.5 min-w-0 overflow-hidden">{children}</div>
    </div>
  );
}

// Helper: icon class based on active state
function iconCls(isActive: boolean) {
  return 'h-3.5 w-3.5 shrink-0 ' + (isActive ? 'text-[#d9ff00]' : 'text-muted-foreground');
}

// Helper: tooltip text
function presetTooltip(id: string, suffix: string, label: string) {
  return id === 'none' ? 'No ' + label.toLowerCase() + ' modifier' : 'Adds: ' + suffix.slice(2);
}

export function SidebarPresets() {
  const activeStylePreset = useAppStore((s) => s.activeStylePreset);
  const setActiveStylePreset = useAppStore((s) => s.setActiveStylePreset);
  const imageSubject = useAppStore((s) => s.imageSubject);
  const setImageSubject = useAppStore((s) => s.setImageSubject);
  const imageDetailLevel = useAppStore((s) => s.imageDetailLevel);
  const setImageDetailLevel = useAppStore((s) => s.setImageDetailLevel);
  const imageComposition = useAppStore((s) => s.imageComposition);
  const setImageComposition = useAppStore((s) => s.setImageComposition);
  const imageEmotion = useAppStore((s) => s.imageEmotion);
  const setImageEmotion = useAppStore((s) => s.setImageEmotion);
  const imageEra = useAppStore((s) => s.imageEra);
  const setImageEra = useAppStore((s) => s.setImageEra);
  const imageOutfit = useAppStore((s) => s.imageOutfit);
  const setImageOutfit = useAppStore((s) => s.setImageOutfit);
  const imageHairstyle = useAppStore((s) => s.imageHairstyle);
  const setImageHairstyle = useAppStore((s) => s.setImageHairstyle);
  const imageHairColor = useAppStore((s) => s.imageHairColor);
  const setImageHairColor = useAppStore((s) => s.setImageHairColor);
  const imageEyeColor = useAppStore((s) => s.imageEyeColor);
  const setImageEyeColor = useAppStore((s) => s.setImageEyeColor);
  const imagePose = useAppStore((s) => s.imagePose);
  const setImagePose = useAppStore((s) => s.setImagePose);
  const imageAccessories = useAppStore((s) => s.imageAccessories);
  const setImageAccessories = useAppStore((s) => s.setImageAccessories);
  const imageBodyType = useAppStore((s) => s.imageBodyType);
  const setImageBodyType = useAppStore((s) => s.setImageBodyType);
  const imageAge = useAppStore((s) => s.imageAge);
  const setImageAge = useAppStore((s) => s.setImageAge);
  const setImageOutfitDescription = useAppStore((s) => s.setImageOutfitDescription);
  const setImageOutfitImageUrl = useAppStore((s) => s.setImageOutfitImageUrl);

  const [styleOpen, setStyleOpen] = useState(true);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [compositionOpen, setCompositionOpen] = useState(false);
  const [emotionOpen, setEmotionOpen] = useState(false);
  const [eraOpen, setEraOpen] = useState(false);
  const [charDetailsOpen, setCharDetailsOpen] = useState(false);

  const activeCharCount = [
    imageOutfit, imageHairstyle, imageHairColor, imageEyeColor,
    imagePose, imageAccessories, imageBodyType, imageAge,
  ].filter((v) => v !== 'none').length;

  const handleResetAllPresets = useCallback(() => {
    setActiveStylePreset('');
    setImageSubject('none');
    setImageDetailLevel('none');
    setImageComposition('none');
    setImageEmotion('none');
    setImageEra('none');
    setImageOutfit('none');
    setImageHairstyle('none');
    setImageHairColor('none');
    setImageEyeColor('none');
    setImagePose('none');
    setImageAccessories('none');
    setImageBodyType('none');
    setImageAge('none');
    setImageOutfitDescription('');
    setImageOutfitImageUrl(null);
    toast.success('All presets cleared');
  }, [setActiveStylePreset, setImageSubject, setImageDetailLevel, setImageComposition, setImageEmotion, setImageEra, setImageOutfit, setImageHairstyle, setImageHairColor, setImageEyeColor, setImagePose, setImageAccessories, setImageBodyType, setImageAge, setImageOutfitDescription, setImageOutfitImageUrl]);

  return (
    <div className="space-y-3 min-w-0 overflow-hidden">
      {/* Style Presets */}
      <div className="min-w-0 overflow-hidden">
        <CollapsibleHeader
          icon={<Palette className={iconCls(!!activeStylePreset)} />}
          label="Style"
          isActive={!!activeStylePreset}
          activeCount={activeStylePreset ? 1 : 0}
          isOpen={styleOpen}
          onToggle={() => setStyleOpen(!styleOpen)}
        />
        <CollapsibleSection isOpen={styleOpen}>
          <div className="grid grid-cols-4 gap-1 min-w-0">
            {STYLE_PRESETS.map((preset) => {
              const isSelected = activeStylePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setActiveStylePreset(isSelected ? '' : preset.id)}
                  className={'flex flex-col items-center justify-center gap-0.5 rounded-md border px-0.5 py-1 text-center min-w-0 overflow-hidden h-[44px] w-full transition-colors duration-150 ' + (isSelected ? 'border-[#d9ff00] text-[#d9ff00]' : 'border-transparent bg-surface/60 text-muted-foreground hover:bg-surface hover:text-foreground hover:border-border/40')}
                  style={isSelected ? { backgroundColor: preset.color + '15', color: preset.color, borderColor: preset.color } as React.CSSProperties : undefined}
                >
                  <span className="text-sm leading-none select-none">{preset.emoji}</span>
                  <span className="text-[8px] font-medium leading-tight truncate w-full">{preset.label}</span>
                </button>
              );
            })}
          </div>
        </CollapsibleSection>
      </div>

      {/* Subject Presets */}
      <div className="min-w-0 overflow-hidden">
        <CollapsibleHeader
          icon={<User className={iconCls(imageSubject !== 'none')} />}
          label="Subject"
          isActive={imageSubject !== 'none'}
          activeCount={imageSubject !== 'none' ? 1 : 0}
          isOpen={subjectOpen}
          onToggle={() => setSubjectOpen(!subjectOpen)}
        />
        <CollapsibleSection isOpen={subjectOpen}>
          <div className="grid grid-cols-4 gap-1 min-w-0">
            {SUBJECT_PRESETS.map((preset) => (
              <PresetButton
                key={preset.id}
                emoji={preset.emoji}
                label={preset.label}
                isSelected={imageSubject === preset.id && preset.id !== 'none'}
                onClick={() => setImageSubject(preset.id === imageSubject ? 'none' : preset.id)}
                tooltip={presetTooltip(preset.id, preset.suffix, 'subject')}
                variant="grid"
              />
            ))}
          </div>
        </CollapsibleSection>
      </div>

      {/* Detail Level */}
      <div className="min-w-0 overflow-hidden">
        <CollapsibleHeader
          icon={<Search className={iconCls(imageDetailLevel !== 'none')} />}
          label="Detail"
          isActive={imageDetailLevel !== 'none'}
          activeCount={imageDetailLevel !== 'none' ? 1 : 0}
          isOpen={detailOpen}
          onToggle={() => setDetailOpen(!detailOpen)}
        />
        <CollapsibleSection isOpen={detailOpen}>
          <div className="grid grid-cols-5 gap-1 min-w-0">
            {DETAIL_LEVEL_PRESETS.map((preset) => (
              <PresetButton
                key={preset.id}
                emoji={preset.emoji}
                label={preset.label}
                isSelected={imageDetailLevel === preset.id && preset.id !== 'none'}
                onClick={() => setImageDetailLevel(preset.id === imageDetailLevel ? 'none' : preset.id)}
                tooltip={presetTooltip(preset.id, preset.suffix, 'detail')}
                variant="pill"
              />
            ))}
          </div>
        </CollapsibleSection>
      </div>

      {/* Composition */}
      <div className="min-w-0 overflow-hidden">
        <CollapsibleHeader
          icon={<Grid3x3 className={iconCls(imageComposition !== 'none')} />}
          label="Composition"
          isActive={imageComposition !== 'none'}
          activeCount={imageComposition !== 'none' ? 1 : 0}
          isOpen={compositionOpen}
          onToggle={() => setCompositionOpen(!compositionOpen)}
        />
        <CollapsibleSection isOpen={compositionOpen}>
          <div className="grid grid-cols-4 gap-1 min-w-0">
            {COMPOSITION_PRESETS.map((preset) => (
              <PresetButton
                key={preset.id}
                emoji={preset.emoji}
                label={preset.label}
                isSelected={imageComposition === preset.id && preset.id !== 'none'}
                onClick={() => setImageComposition(preset.id === imageComposition ? 'none' : preset.id)}
                tooltip={presetTooltip(preset.id, preset.suffix, 'composition')}
                variant="grid"
              />
            ))}
          </div>
        </CollapsibleSection>
      </div>

      {/* Emotion */}
      <div className="min-w-0 overflow-hidden">
        <CollapsibleHeader
          icon={<Heart className={iconCls(imageEmotion !== 'none')} />}
          label="Emotion"
          isActive={imageEmotion !== 'none'}
          activeCount={imageEmotion !== 'none' ? 1 : 0}
          isOpen={emotionOpen}
          onToggle={() => setEmotionOpen(!emotionOpen)}
        />
        <CollapsibleSection isOpen={emotionOpen}>
          <div className="grid grid-cols-4 gap-1 min-w-0">
            {EMOTION_PRESETS.map((preset) => (
              <PresetButton
                key={preset.id}
                emoji={preset.emoji}
                label={preset.label}
                isSelected={imageEmotion === preset.id && preset.id !== 'none'}
                onClick={() => setImageEmotion(preset.id === imageEmotion ? 'none' : preset.id)}
                tooltip={presetTooltip(preset.id, preset.suffix, 'emotion')}
                variant="grid"
              />
            ))}
          </div>
        </CollapsibleSection>
      </div>

      {/* Era */}
      <div className="min-w-0 overflow-hidden">
        <CollapsibleHeader
          icon={<Clock className={iconCls(imageEra !== 'none')} />}
          label="Era"
          isActive={imageEra !== 'none'}
          activeCount={imageEra !== 'none' ? 1 : 0}
          isOpen={eraOpen}
          onToggle={() => setEraOpen(!eraOpen)}
        />
        <CollapsibleSection isOpen={eraOpen}>
          <div className="grid grid-cols-4 gap-1 min-w-0">
            {ERA_PRESETS.map((preset) => (
              <PresetButton
                key={preset.id}
                emoji={preset.emoji}
                label={preset.label}
                isSelected={imageEra === preset.id && preset.id !== 'none'}
                onClick={() => setImageEra(preset.id === imageEra ? 'none' : preset.id)}
                tooltip={presetTooltip(preset.id, preset.suffix, 'era')}
                variant="grid"
              />
            ))}
          </div>
        </CollapsibleSection>
      </div>

      {/* Character Details */}
      <div className="min-w-0 overflow-hidden">
        <CollapsibleHeader
          icon={<UserCircle className={iconCls(activeCharCount > 0)} />}
          label="Character"
          isActive={activeCharCount > 0}
          activeCount={activeCharCount}
          isOpen={charDetailsOpen}
          onToggle={() => setCharDetailsOpen(!charDetailsOpen)}
        />
        <CollapsibleSection isOpen={charDetailsOpen}>
          <div className="space-y-2.5 min-w-0 overflow-hidden">
            {/* Outfit */}
            <div className="space-y-1 min-w-0">
              <Label className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1">
                <Shirt className="h-2.5 w-2.5 shrink-0" />Outfit
              </Label>
              <div className="grid grid-cols-4 gap-1 min-w-0">
                {OUTFIT_PRESETS.map((preset) => (
                  <PresetButton key={preset.id} emoji={preset.emoji} label={preset.label} isSelected={imageOutfit === preset.id && preset.id !== 'none'} onClick={() => setImageOutfit(preset.id === imageOutfit ? 'none' : preset.id)} tooltip={presetTooltip(preset.id, preset.suffix, 'outfit')} variant="grid" />
                ))}
              </div>
            </div>

            {/* Hairstyle */}
            <div className="space-y-1 min-w-0">
              <Label className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1">
                <Scissors className="h-2.5 w-2.5 shrink-0" />Hairstyle
              </Label>
              <div className="grid grid-cols-4 gap-1 min-w-0">
                {HAIRSTYLE_PRESETS.map((preset) => (
                  <PresetButton key={preset.id} emoji={preset.emoji} label={preset.label} isSelected={imageHairstyle === preset.id && preset.id !== 'none'} onClick={() => setImageHairstyle(preset.id === imageHairstyle ? 'none' : preset.id)} tooltip={presetTooltip(preset.id, preset.suffix, 'hairstyle')} variant="grid" />
                ))}
              </div>
            </div>

            {/* Hair Color */}
            <div className="space-y-1 min-w-0">
              <Label className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1">
                <Gem className="h-2.5 w-2.5 shrink-0" />Hair Color
              </Label>
              <div className="grid grid-cols-5 gap-1 min-w-0">
                {HAIR_COLOR_PRESETS.map((preset) => (
                  <PresetButton key={preset.id} emoji={preset.emoji} label={preset.label} isSelected={imageHairColor === preset.id && preset.id !== 'none'} onClick={() => setImageHairColor(preset.id === imageHairColor ? 'none' : preset.id)} tooltip={presetTooltip(preset.id, preset.suffix, 'hair color')} variant="pill" />
                ))}
              </div>
            </div>

            {/* Eye Color */}
            <div className="space-y-1 min-w-0">
              <Label className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1">
                <Eye className="h-2.5 w-2.5 shrink-0" />Eye Color
              </Label>
              <div className="grid grid-cols-5 gap-1 min-w-0">
                {EYE_COLOR_PRESETS.map((preset) => (
                  <PresetButton key={preset.id} emoji={preset.emoji} label={preset.label} isSelected={imageEyeColor === preset.id && preset.id !== 'none'} onClick={() => setImageEyeColor(preset.id === imageEyeColor ? 'none' : preset.id)} tooltip={presetTooltip(preset.id, preset.suffix, 'eye color')} variant="pill" />
                ))}
              </div>
            </div>

            {/* Pose */}
            <div className="space-y-1 min-w-0">
              <Label className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1">
                <Footprints className="h-2.5 w-2.5 shrink-0" />Pose
              </Label>
              <div className="grid grid-cols-4 gap-1 min-w-0">
                {POSE_PRESETS.map((preset) => (
                  <PresetButton key={preset.id} emoji={preset.emoji} label={preset.label} isSelected={imagePose === preset.id && preset.id !== 'none'} onClick={() => setImagePose(preset.id === imagePose ? 'none' : preset.id)} tooltip={presetTooltip(preset.id, preset.suffix, 'pose')} variant="grid" />
                ))}
              </div>
            </div>

            {/* Accessories */}
            <div className="space-y-1 min-w-0">
              <Label className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1">
                <Glasses className="h-2.5 w-2.5 shrink-0" />Accessories
              </Label>
              <div className="grid grid-cols-4 gap-1 min-w-0">
                {ACCESSORIES_PRESETS.map((preset) => (
                  <PresetButton key={preset.id} emoji={preset.emoji} label={preset.label} isSelected={imageAccessories === preset.id && preset.id !== 'none'} onClick={() => setImageAccessories(preset.id === imageAccessories ? 'none' : preset.id)} tooltip={presetTooltip(preset.id, preset.suffix, 'accessory')} variant="grid" />
                ))}
              </div>
            </div>

            {/* Body Type */}
            <div className="space-y-1 min-w-0">
              <Label className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1">
                <User className="h-2.5 w-2.5 shrink-0" />Body Type
              </Label>
              <div className="grid grid-cols-4 gap-1 min-w-0">
                {BODY_TYPE_PRESETS.map((preset) => (
                  <PresetButton key={preset.id} emoji={preset.emoji} label={preset.label} isSelected={imageBodyType === preset.id && preset.id !== 'none'} onClick={() => setImageBodyType(preset.id === imageBodyType ? 'none' : preset.id)} tooltip={presetTooltip(preset.id, preset.suffix, 'body type')} variant="pill" />
                ))}
              </div>
            </div>

            {/* Age */}
            <div className="space-y-1 min-w-0">
              <Label className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1">
                <Clock className="h-2.5 w-2.5 shrink-0" />Age
              </Label>
              <div className="grid grid-cols-4 gap-1 min-w-0">
                {AGE_PRESETS.map((preset) => (
                  <PresetButton key={preset.id} emoji={preset.emoji} label={preset.label} isSelected={imageAge === preset.id && preset.id !== 'none'} onClick={() => setImageAge(preset.id === imageAge ? 'none' : preset.id)} tooltip={presetTooltip(preset.id, preset.suffix, 'age')} variant="pill" />
                ))}
              </div>
            </div>
          </div>
        </CollapsibleSection>
      </div>

      {/* Change Outfit */}
      <SidebarChangeOutfit />

      {/* Quick Prompts */}
      <SidebarQuickPrompts />

      {/* Reset All */}
      <button
        type="button"
        onClick={handleResetAllPresets}
        className="w-full rounded-md border border-border/20 bg-surface/40 px-3 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5 transition-colors duration-150 overflow-hidden"
      >
        Reset All Presets
      </button>
    </div>
  );
}
