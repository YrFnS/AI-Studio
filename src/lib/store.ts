import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppTab, SavedPrompt, GenerationStatus, GalleryFilterType, GalleryViewMode, TimelineDateFilter } from '@/lib/types';

export type { AppTab };
export type { SavedPrompt };
export type { GenerationStatus };

// ---------------------------------------------------------------------------
// Generation Queue Types
// ---------------------------------------------------------------------------

export interface GenerationQueueItem {
  id: string;
  prompt: string;
  providerName: string;
  providerColor: string;
  modelName: string;
  status: GenerationStatus;
  resultUrl?: string;
  createdAt: number;
}

interface AppState {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  
  // Image generation state
  imagePrompt: string;
  setImagePrompt: (prompt: string) => void;
  imageNegativePrompt: string;
  setImageNegativePrompt: (prompt: string) => void;
  selectedImageProvider: string;
  setSelectedImageProvider: (provider: string) => void;
  selectedImageModel: string;
  setSelectedImageModel: (model: string) => void;
  imageAspectRatio: string;
  setImageAspectRatio: (ratio: string) => void;
  imageQuality: string;
  setImageQuality: (quality: string) => void;
  imageSteps: number;
  setImageSteps: (steps: number) => void;
  imageGuidance: number;
  setImageGuidance: (guidance: number) => void;
  imageSeed: number | null;
  setImageSeed: (seed: number | null) => void;
  imageBatchSize: number;
  setImageBatchSize: (size: number) => void;
  imageResolutionTier: string;
  setImageResolutionTier: (tier: string) => void;
  imageFormat: string;
  setImageFormat: (format: string) => void;
  imageStrength: number;
  setImageStrength: (strength: number) => void;
  imageSampler: string;
  setImageSampler: (sampler: string) => void;
  imageMagicPrompt: boolean;
  setImageMagicPrompt: (enabled: boolean) => void;
  imageStyleType: string;
  setImageStyleType: (styleType: string) => void;
  imageRenderingSpeed: string;
  setImageRenderingSpeed: (speed: string) => void;
  imageClipGuidance: string;
  setImageClipGuidance: (preset: string) => void;
  imageTileable: boolean;
  setImageTileable: (tileable: boolean) => void;
  imagePhotoReal: boolean;
  setImagePhotoReal: (photoReal: boolean) => void;
  imageAlchemy: boolean;
  setImageAlchemy: (alchemy: boolean) => void;
  imageSafetyFilter: boolean;
  setImageSafetyFilter: (enabled: boolean) => void;
  imageScheduler: string;
  setImageScheduler: (scheduler: string) => void;
  imageClipSkip: number;
  setImageClipSkip: (skip: number) => void;
  imageLighting: string;
  setImageLighting: (lighting: string) => void;
  imageColorMood: string;
  setImageColorMood: (mood: string) => void;
  imageCameraShot: string;
  setImageCameraShot: (shot: string) => void;
  imageHiresFix: boolean;
  setImageHiresFix: (enabled: boolean) => void;
  imageHiresScale: number;
  setImageHiresScale: (scale: number) => void;
  imageHiresSteps: number;
  setImageHiresSteps: (steps: number) => void;
  imageHiresDenoise: number;
  setImageHiresDenoise: (denoise: number) => void;
  // Smart Prompt Builder — pre-generation customization
  imageSubject: string;
  setImageSubject: (subject: string) => void;
  imageDetailLevel: string;
  setImageDetailLevel: (level: string) => void;
  imageComposition: string;
  setImageComposition: (comp: string) => void;
  imageEmotion: string;
  setImageEmotion: (emotion: string) => void;
  imageEra: string;
  setImageEra: (era: string) => void;
  // Character Details — Smart Prompt Builder
  imageOutfit: string;
  setImageOutfit: (outfit: string) => void;
  imageHairstyle: string;
  setImageHairstyle: (hairstyle: string) => void;
  imageHairColor: string;
  setImageHairColor: (color: string) => void;
  imageEyeColor: string;
  setImageEyeColor: (color: string) => void;
  imagePose: string;
  setImagePose: (pose: string) => void;
  imageAccessories: string;
  setImageAccessories: (accessories: string) => void;
  imageBodyType: string;
  setImageBodyType: (bodyType: string) => void;
  imageAge: string;
  setImageAge: (age: string) => void;
  // Auto-enhance prompt
  imageAutoEnhance: boolean;
  setImageAutoEnhance: (enabled: boolean) => void;
  // Style preset
  activeStylePreset: string;
  setActiveStylePreset: (preset: string) => void;
  // Outfit change
  imageOutfitDescription: string;
  setImageOutfitDescription: (desc: string) => void;
  imageOutfitImageUrl: string | null;
  setImageOutfitImageUrl: (url: string | null) => void;
  inputImageUrl: string | null;
  setInputImageUrl: (url: string | null) => void;
  isImageGenerating: boolean;
  setIsImageGenerating: (generating: boolean) => void;
  // Post-generation state
  postGenAction: string | null;
  setPostGenAction: (action: string | null) => void;
  isPostGenProcessing: boolean;
  setIsPostGenProcessing: (processing: boolean) => void;
  postGenResult: string | null;
  setPostGenResult: (url: string | null) => void;
  
  // Video generation state
  videoPrompt: string;
  setVideoPrompt: (prompt: string) => void;
  selectedVideoProvider: string;
  setSelectedVideoProvider: (provider: string) => void;
  selectedVideoModel: string;
  setSelectedVideoModel: (model: string) => void;
  videoDuration: number;
  setVideoDuration: (duration: number) => void;
  videoAspectRatio: string;
  setVideoAspectRatio: (ratio: string) => void;
  isVideoGenerating: boolean;
  setIsVideoGenerating: (generating: boolean) => void;
  // Video presets
  videoStyle: string;
  setVideoStyle: (style: string) => void;
  videoCameraMotion: string;
  setVideoCameraMotion: (motion: string) => void;
  videoMood: string;
  setVideoMood: (mood: string) => void;
  // Video reference images
  videoStartFrameUrl: string | null;
  setVideoStartFrameUrl: (url: string | null) => void;
  videoEndFrameUrl: string | null;
  setVideoEndFrameUrl: (url: string | null) => void;

  // Gallery state
  galleryFilter: GalleryFilterType;
  setGalleryFilter: (filter: GalleryFilterType) => void;
  selectedCollectionId: string | null;
  setSelectedCollectionId: (id: string | null) => void;
  galleryViewMode: GalleryViewMode;
  setGalleryViewMode: (mode: GalleryViewMode) => void;
  galleryTimelineDateFilter: TimelineDateFilter;
  setGalleryTimelineDateFilter: (filter: TimelineDateFilter) => void;
  galleryTimelineTypeFilter: 'all' | 'image' | 'video';
  setGalleryTimelineTypeFilter: (filter: 'all' | 'image' | 'video') => void;
  galleryTimelineProviderFilter: string;
  setGalleryTimelineProviderFilter: (filter: string) => void;
  galleryGridSize: 'sm' | 'md' | 'lg';
  setGalleryGridSize: (size: 'sm' | 'md' | 'lg') => void;
  gallerySelectMode: boolean;
  setGallerySelectMode: (enabled: boolean) => void;
  gallerySelectedIds: string[];
  setGallerySelectedIds: (ids: string[]) => void;
  
  // Settings state
  settingsTab: 'providers' | 'models' | 'transfer';
  setSettingsTab: (tab: 'providers' | 'models' | 'transfer') => void;
  
  // Generation result
  latestResult: string | null;
  setLatestResult: (url: string | null) => void;

  // Batch generation results
  generationResults: string[];
  setGenerationResults: (urls: string[]) => void;
  selectedResultIndex: number;
  setSelectedResultIndex: (index: number) => void;
  
  // Global refresh counter - increment to trigger data refreshes across components
  providerVersion: number;
  refreshProviders: () => void;

  // Keyboard shortcut: generate trigger
  generateTrigger: number;
  triggerGenerate: () => void;

  // Keyboard shortcuts dialog
  keyboardShortcutsOpen: boolean;
  setKeyboardShortcutsOpen: (open: boolean) => void;

  // Generation duration tracking
  generationDuration: number | null;
  setGenerationDuration: (duration: number | null) => void;

  // Cinema Studio state
  isCinemaGenerating: boolean;
  setIsCinemaGenerating: (generating: boolean) => void;
  cinemaCamera: string;
  setCinemaCamera: (v: string) => void;
  cinemaLens: string;
  setCinemaLens: (v: string) => void;
  cinemaFocalLength: number;
  setCinemaFocalLength: (v: number) => void;
  cinemaAperture: number;
  setCinemaAperture: (v: number) => void;
  cinemaFilmStock: string;
  setCinemaFilmStock: (v: string) => void;
  cinemaColorGrade: string;
  setCinemaColorGrade: (v: string) => void;
  cinemaLighting: string;
  setCinemaLighting: (v: string) => void;
  cinemaScenePreset: string;
  setCinemaScenePreset: (v: string) => void;

  // Generation Queue
  generationQueue: GenerationQueueItem[];
  addToQueue: (item: GenerationQueueItem) => void;
  updateQueueItem: (id: string, updates: Partial<GenerationQueueItem>) => void;
  removeFromQueue: (id: string) => void;
  clearCompleted: () => void;

  // Model Compare
  isCompareOpen: boolean;
  setIsCompareOpen: (open: boolean) => void;
  compareSlots: { providerId: string; modelId: string }[];
  setCompareSlots: (slots: { providerId: string; modelId: string }[]) => void;
  updateCompareSlot: (index: number, slot: Partial<{ providerId: string; modelId: string }>) => void;

  // Prompt History (persisted to localStorage)
  promptHistory: string[];
  addPromptToHistory: (prompt: string) => void;
  clearPromptHistory: () => void;

  // Prompt Library
  promptLibraryOpen: boolean;
  setPromptLibraryOpen: (open: boolean) => void;
  savedPrompts: SavedPrompt[];
  setSavedPrompts: (prompts: SavedPrompt[]) => void;

  // Style Transfer Panel
  styleTransferOpen: boolean;
  setStyleTransferOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
  activeTab: 'image',
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  // Image generation state
  imagePrompt: '',
  setImagePrompt: (prompt) => set({ imagePrompt: prompt }),
  imageNegativePrompt: '',
  setImageNegativePrompt: (prompt) => set({ imageNegativePrompt: prompt }),
  selectedImageProvider: '',
  setSelectedImageProvider: (provider) => set({ selectedImageProvider: provider }),
  selectedImageModel: '',
  setSelectedImageModel: (model) => set({ selectedImageModel: model }),
  imageAspectRatio: '1:1',
  setImageAspectRatio: (ratio) => set({ imageAspectRatio: ratio }),
  imageQuality: 'auto',
  setImageQuality: (quality) => set({ imageQuality: quality }),
  imageSteps: 20,
  setImageSteps: (steps) => set({ imageSteps: steps }),
  imageGuidance: 7.5,
  setImageGuidance: (guidance) => set({ imageGuidance: guidance }),
  imageSeed: null,
  setImageSeed: (seed) => set({ imageSeed: seed }),
  imageBatchSize: 1,
  setImageBatchSize: (size) => set({ imageBatchSize: size }),
  imageResolutionTier: 'hd',
  setImageResolutionTier: (tier) => set({ imageResolutionTier: tier }),
  imageFormat: 'png',
  setImageFormat: (format) => set({ imageFormat: format }),
  imageStrength: 0.7,
  setImageStrength: (strength) => set({ imageStrength: strength }),
  imageSampler: 'dpmpp_2m',
  setImageSampler: (sampler) => set({ imageSampler: sampler }),
  imageMagicPrompt: true,
  setImageMagicPrompt: (enabled) => set({ imageMagicPrompt: enabled }),
  imageStyleType: 'AUTO',
  setImageStyleType: (styleType) => set({ imageStyleType: styleType }),
  imageRenderingSpeed: 'DEFAULT',
  setImageRenderingSpeed: (speed) => set({ imageRenderingSpeed: speed }),
  imageClipGuidance: 'NONE',
  setImageClipGuidance: (preset) => set({ imageClipGuidance: preset }),
  imageTileable: false,
  setImageTileable: (tileable) => set({ imageTileable: tileable }),
  imagePhotoReal: false,
  setImagePhotoReal: (photoReal) => set({ imagePhotoReal: photoReal }),
  imageAlchemy: false,
  setImageAlchemy: (alchemy) => set({ imageAlchemy: alchemy }),
  imageSafetyFilter: true,
  setImageSafetyFilter: (enabled) => set({ imageSafetyFilter: enabled }),
  imageScheduler: 'karras',
  setImageScheduler: (scheduler) => set({ imageScheduler: scheduler }),
  imageClipSkip: 1,
  setImageClipSkip: (skip) => set({ imageClipSkip: skip }),
  imageLighting: 'none',
  setImageLighting: (lighting) => set({ imageLighting: lighting }),
  imageColorMood: 'none',
  setImageColorMood: (mood) => set({ imageColorMood: mood }),
  imageCameraShot: 'none',
  setImageCameraShot: (shot) => set({ imageCameraShot: shot }),
  imageHiresFix: false,
  setImageHiresFix: (enabled) => set({ imageHiresFix: enabled }),
  imageHiresScale: 2,
  setImageHiresScale: (scale) => set({ imageHiresScale: scale }),
  imageHiresSteps: 15,
  setImageHiresSteps: (steps) => set({ imageHiresSteps: steps }),
  imageHiresDenoise: 0.5,
  setImageHiresDenoise: (denoise) => set({ imageHiresDenoise: denoise }),
  // Smart Prompt Builder — pre-generation customization
  imageSubject: 'none',
  setImageSubject: (subject) => set({ imageSubject: subject }),
  imageDetailLevel: 'none',
  setImageDetailLevel: (level) => set({ imageDetailLevel: level }),
  imageComposition: 'none',
  setImageComposition: (comp) => set({ imageComposition: comp }),
  imageEmotion: 'none',
  setImageEmotion: (emotion) => set({ imageEmotion: emotion }),
  imageEra: 'none',
  setImageEra: (era) => set({ imageEra: era }),
  // Character Details — Smart Prompt Builder
  imageOutfit: 'none',
  setImageOutfit: (outfit) => set({ imageOutfit: outfit }),
  imageHairstyle: 'none',
  setImageHairstyle: (hairstyle) => set({ imageHairstyle: hairstyle }),
  imageHairColor: 'none',
  setImageHairColor: (color) => set({ imageHairColor: color }),
  imageEyeColor: 'none',
  setImageEyeColor: (color) => set({ imageEyeColor: color }),
  imagePose: 'none',
  setImagePose: (pose) => set({ imagePose: pose }),
  imageAccessories: 'none',
  setImageAccessories: (accessories) => set({ imageAccessories: accessories }),
  imageBodyType: 'none',
  setImageBodyType: (bodyType) => set({ imageBodyType: bodyType }),
  imageAge: 'none',
  setImageAge: (age) => set({ imageAge: age }),
  // Auto-enhance prompt
  imageAutoEnhance: false,
  setImageAutoEnhance: (enabled) => set({ imageAutoEnhance: enabled }),
  // Style preset
  activeStylePreset: '',
  setActiveStylePreset: (preset) => set({ activeStylePreset: preset }),
  // Outfit change
  imageOutfitDescription: '',
  setImageOutfitDescription: (desc) => set({ imageOutfitDescription: desc }),
  imageOutfitImageUrl: null,
  setImageOutfitImageUrl: (url) => set({ imageOutfitImageUrl: url }),
  inputImageUrl: null,
  setInputImageUrl: (url) => set({ inputImageUrl: url }),
  isImageGenerating: false,
  setIsImageGenerating: (generating) => set({ isImageGenerating: generating }),
  // Post-generation state
  postGenAction: null,
  setPostGenAction: (action) => set({ postGenAction: action }),
  isPostGenProcessing: false,
  setIsPostGenProcessing: (processing) => set({ isPostGenProcessing: processing }),
  postGenResult: null,
  setPostGenResult: (url) => set({ postGenResult: url }),
  
  // Video generation state
  videoPrompt: '',
  setVideoPrompt: (prompt) => set({ videoPrompt: prompt }),
  selectedVideoProvider: '',
  setSelectedVideoProvider: (provider) => set({ selectedVideoProvider: provider }),
  selectedVideoModel: '',
  setSelectedVideoModel: (model) => set({ selectedVideoModel: model }),
  videoDuration: 5,
  setVideoDuration: (duration) => set({ videoDuration: duration }),
  videoAspectRatio: '16:9',
  setVideoAspectRatio: (ratio) => set({ videoAspectRatio: ratio }),
  isVideoGenerating: false,
  setIsVideoGenerating: (generating) => set({ isVideoGenerating: generating }),
  // Video presets
  videoStyle: 'none',
  setVideoStyle: (style) => set({ videoStyle: style }),
  videoCameraMotion: 'none',
  setVideoCameraMotion: (motion) => set({ videoCameraMotion: motion }),
  videoMood: 'none',
  setVideoMood: (mood) => set({ videoMood: mood }),
  // Video reference images
  videoStartFrameUrl: null,
  setVideoStartFrameUrl: (url) => set({ videoStartFrameUrl: url }),
  videoEndFrameUrl: null,
  setVideoEndFrameUrl: (url) => set({ videoEndFrameUrl: url }),

  // Gallery state
  galleryFilter: 'all',
  setGalleryFilter: (filter) => set({ galleryFilter: filter }),
  selectedCollectionId: null,
  setSelectedCollectionId: (id) => set({ selectedCollectionId: id }),
  galleryViewMode: 'grid',
  setGalleryViewMode: (mode) => set({ galleryViewMode: mode }),
  galleryTimelineDateFilter: 'all',
  setGalleryTimelineDateFilter: (filter) => set({ galleryTimelineDateFilter: filter }),
  galleryTimelineTypeFilter: 'all',
  setGalleryTimelineTypeFilter: (filter) => set({ galleryTimelineTypeFilter: filter }),
  galleryTimelineProviderFilter: '',
  setGalleryTimelineProviderFilter: (filter) => set({ galleryTimelineProviderFilter: filter }),
  galleryGridSize: 'md',
  setGalleryGridSize: (size) => set({ galleryGridSize: size }),
  gallerySelectMode: false,
  setGallerySelectMode: (enabled) => set({ gallerySelectMode: enabled, gallerySelectedIds: !enabled ? [] : undefined as unknown as string[] }),
  gallerySelectedIds: [],
  setGallerySelectedIds: (ids) => set({ gallerySelectedIds: ids }),
  
  // Settings state
  settingsTab: 'providers',
  setSettingsTab: (tab) => set({ settingsTab: tab }),
  
  // Result
  latestResult: null,
  setLatestResult: (url) => set({ latestResult: url }),

  // Batch generation results
  generationResults: [],
  setGenerationResults: (urls) => set({ generationResults: urls }),
  selectedResultIndex: 0,
  setSelectedResultIndex: (index) => set({ selectedResultIndex: index }),
  
  // Provider refresh
  providerVersion: 0,
  refreshProviders: () => set((state) => ({ providerVersion: state.providerVersion + 1 })),

  // Keyboard shortcut: generate trigger
  generateTrigger: 0,
  triggerGenerate: () => set((state) => ({ generateTrigger: state.generateTrigger + 1 })),

  // Keyboard shortcuts dialog
  keyboardShortcutsOpen: false,
  setKeyboardShortcutsOpen: (open) => set({ keyboardShortcutsOpen: open }),

  // Generation duration tracking
  generationDuration: null,
  setGenerationDuration: (duration) => set({ generationDuration: duration }),

  // Cinema Studio state
  isCinemaGenerating: false,
  setIsCinemaGenerating: (generating) => set({ isCinemaGenerating: generating }),
  cinemaCamera: 'arri-alexa-mini-lf',
  setCinemaCamera: (v) => set({ cinemaCamera: v }),
  cinemaLens: 'cooke-anamorphic',
  setCinemaLens: (v) => set({ cinemaLens: v }),
  cinemaFocalLength: 50,
  setCinemaFocalLength: (v) => set({ cinemaFocalLength: v }),
  cinemaAperture: 2.8,
  setCinemaAperture: (v) => set({ cinemaAperture: v }),
  cinemaFilmStock: 'kodak-vision3-500t',
  setCinemaFilmStock: (v) => set({ cinemaFilmStock: v }),
  cinemaColorGrade: 'teal-orange',
  setCinemaColorGrade: (v) => set({ cinemaColorGrade: v }),
  cinemaLighting: 'golden-hour',
  setCinemaLighting: (v) => set({ cinemaLighting: v }),
  cinemaScenePreset: 'none',
  setCinemaScenePreset: (v) => set({ cinemaScenePreset: v }),

  // Generation Queue
  generationQueue: [],
  addToQueue: (item) => set((state) => ({
    generationQueue: [item, ...state.generationQueue],
  })),
  updateQueueItem: (id, updates) => set((state) => ({
    generationQueue: state.generationQueue.map((item) =>
      item.id === id ? { ...item, ...updates } : item
    ),
  })),
  removeFromQueue: (id) => set((state) => ({
    generationQueue: state.generationQueue.filter((item) => item.id !== id),
  })),
  clearCompleted: () => set((state) => ({
    generationQueue: state.generationQueue.filter((item) => item.status === 'processing'),
  })),

  // Model Compare
  isCompareOpen: false,
  setIsCompareOpen: (open) => set({ isCompareOpen: open }),
  compareSlots: [
    { providerId: '', modelId: '' },
    { providerId: '', modelId: '' },
  ],
  setCompareSlots: (slots) => set({ compareSlots: slots }),
  updateCompareSlot: (index, slot) => set((state) => ({
    compareSlots: state.compareSlots.map((s, i) => i === index ? { ...s, ...slot } : s),
  })),

  // Prompt History
  promptHistory: [],
  addPromptToHistory: (prompt) => set((state) => {
    const trimmed = prompt.trim();
    if (!trimmed) return state;
    const filtered = state.promptHistory.filter((p) => p !== trimmed);
    return { promptHistory: [trimmed, ...filtered].slice(0, 50) };
  }),
  clearPromptHistory: () => set({ promptHistory: [] }),

  // Prompt Library
  promptLibraryOpen: false,
  setPromptLibraryOpen: (open) => set({ promptLibraryOpen: open }),
  savedPrompts: [],
  setSavedPrompts: (prompts) => set({ savedPrompts: prompts }),

  // Style Transfer Panel
  styleTransferOpen: false,
  setStyleTransferOpen: (open) => set({ styleTransferOpen: open }),
}),
    {
      name: 'ai-studio-prompt-history',
      partialize: (state) => ({ promptHistory: state.promptHistory }),
    }
  )
);
