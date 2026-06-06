// ---------------------------------------------------------------------------
// Shared types for the Image Studio feature
// ---------------------------------------------------------------------------

export interface ProviderModel {
  id: string;
  name: string;
  modelId: string;
  type: string;
  capabilities: string;
  description?: string;
  priceInfo?: string;
  isDefault: boolean;
}

export interface Provider {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  color?: string;
  icon?: string;
  models: ProviderModel[];
}

export interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  prompt: string;
  style?: string;
  aspectRatio?: string;
  suggestedStylePreset?: string;
  suggestedAspectRatio?: string;
  negativePrompt?: string;
}
