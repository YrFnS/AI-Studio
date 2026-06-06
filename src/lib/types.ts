// ---------------------------------------------------------------------------
// Shared Types — consolidated from across the AI Studio app
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// App-level types
// ---------------------------------------------------------------------------

/** Active studio tab identifiers */
export type AppTab = 'image' | 'video' | 'cinema' | 'gallery' | 'settings';

/** Status of a generation job */
export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** Model content type */
export type ModelType = 'image' | 'video';

// ---------------------------------------------------------------------------
// API Key types (from settings.tsx)
// ---------------------------------------------------------------------------

export interface ApiKeyRecord {
  id: string;
  providerId: string;
  key: string;
  label?: string;
  isActive: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Provider & Model types (from settings.tsx)
// ---------------------------------------------------------------------------

export interface ProviderModel {
  id: string;
  name: string;
  modelId: string;
  type: ModelType;
  capabilities: string;
  description?: string;
  defaultParams?: string;
  priceInfo?: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface Provider {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  baseUrl: string;
  authHeader: string;
  authPrefix: string;
  keyFormat?: string;
  icon?: string;
  color?: string;
  website?: string;
  sortOrder: number;
  isActive: boolean;
  models: ProviderModel[];
}

export interface ModelWithProvider extends ProviderModel {
  provider?: {
    name: string;
    displayName: string;
    color?: string;
    icon?: string;
  };
}

// ---------------------------------------------------------------------------
// Capability definitions (from settings.tsx)
// ---------------------------------------------------------------------------

export const CAPABILITY_OPTIONS = [
  { id: 't2i', label: 'Text-to-Image', description: 'Generate from text prompts' },
  { id: 'i2i', label: 'Image-to-Image', description: 'Transform existing images' },
  { id: 'inpaint', label: 'Inpainting', description: 'Fill masked regions' },
  { id: 'upscale', label: 'Upscale', description: 'Increase resolution' },
  { id: 'edit', label: 'Edit', description: 'Instruction-based editing' },
  { id: 't2v', label: 'Text-to-Video', description: 'Generate video from text' },
  { id: 'i2v', label: 'Image-to-Video', description: 'Animate existing images' },
] as const;

// ---------------------------------------------------------------------------
// Gallery types (from gallery.tsx)
// ---------------------------------------------------------------------------

export interface ProviderInfo {
  name: string;
  displayName: string;
  color: string | null;
}

export interface Generation {
  id: string;
  providerId: string | null;
  modelId: string | null;
  type: string;
  prompt: string;
  negativePrompt: string | null;
  resultUrl: string | null;
  resultData: string | null;
  thumbnailUrl: string | null;
  isFavorite: boolean;
  status: GenerationStatus;
  parentGenerationId: string | null;
  createdAt: string;
  provider: ProviderInfo | null;
  childGenerations?: Generation[];
}

export type GalleryFilterType = 'all' | 'image' | 'video' | 'favorite' | 'collection';

// ---------------------------------------------------------------------------
// Timeline types (from gallery.tsx)
// ---------------------------------------------------------------------------

export type GalleryViewMode = 'grid' | 'list' | 'timeline';

export type TimelineDateFilter = 'today' | 'week' | 'month' | 'all';

export interface TimelineNode {
  generation: Generation;
  children: TimelineNode[];
  depth: number;
  branchIndex: number;
}

// ---------------------------------------------------------------------------
// Prompt Library types
// ---------------------------------------------------------------------------

export interface SavedPrompt {
  id: string;
  text: string;
  category: string;
  isFavorite: boolean;
  providerName?: string;
  modelName?: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PromptTemplate {
  id: string;
  title: string;
  prompt: string;
  category: string;
  emoji: string;
}

// ---------------------------------------------------------------------------
// Collection types (from gallery.tsx / collection-dialog.tsx)
// ---------------------------------------------------------------------------

export interface CollectionWithCount {
  id: string;
  name: string;
  description?: string;
  color: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Generation API types (from api/generate/image/route.ts)
// ---------------------------------------------------------------------------

export interface GenerateParams {
  prompt: string;
  negativePrompt?: string;
  model: string;
  provider: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
  quality?: string;
  size?: string;
  output_format?: string;
  steps?: number;
  guidance?: number;
  seed?: number;
  batchSize?: number;
  inputImageUrl?: string;
  style?: string;
  // Advanced generation parameters
  strength?: number;
  sampler?: string;
  magicPrompt?: boolean;
  styleType?: string;
  renderingSpeed?: string;
  clipGuidance?: string;
  tileable?: boolean;
  photoReal?: boolean;
  alchemy?: boolean;
  safetyFilter?: boolean;
  // New advanced generation parameters
  scheduler?: string;
  clipSkip?: number;
  lighting?: string;
  colorMood?: string;
  cameraShot?: string;
  hiresFix?: boolean;
  hiresScale?: number;
  hiresSteps?: number;
  hiresDenoise?: number;
  // Smart Prompt Builder — pre-generation customization
  subject?: string;
  detailLevel?: string;
  composition?: string;
  emotion?: string;
  era?: string;
  // Character Details — Smart Prompt Builder
  outfit?: string;
  hairstyle?: string;
  hairColor?: string;
  eyeColor?: string;
  pose?: string;
  accessories?: string;
  bodyType?: string;
  age?: string;
  // Post-generation action type
  actionType?: 'generate' | 'upscale' | 'variation' | 'improve' | 'img2vid' | 'inpaint' | 'outpaint';
  upscaleFactor?: number;
  variationStrength?: number;
  // Outfit change
  outfitDescription?: string;
  outfitImageUrl?: string;
  // Video frame controls
  startFrameUrl?: string;
  endFrameUrl?: string;
  [key: string]: unknown;
}
