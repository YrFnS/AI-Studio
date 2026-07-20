// ---------------------------------------------------------------------------
// Client-side data layer — replaces server API routes with IndexedDB
// ---------------------------------------------------------------------------

import * as idb from './idb';
import type {
  GenerationRecord,
  CollectionRecord,
  CollectionItemRecord,
  PromptRecord,
} from './idb';

export type { GenerationRecord, CollectionRecord, CollectionItemRecord, PromptRecord };

const DEMO_GALLERY_KEY = 'ai-studio-demo-gallery-v1';
const DEMO_GENERATIONS: GenerationRecord[] = [
  {
    id: 'demo-neon-city', providerId: 'demo', providerName: 'AI Studio Demo', modelId: 'flux-demo',
    type: 'image', prompt: 'A cinematic neon city after rain, reflective streets and atmospheric light',
    resultUrl: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1400&q=85',
    status: 'completed', isFavorite: true, width: 1400, height: 933, createdAt: Date.now() - 60 * 60 * 1000,
  },
  {
    id: 'demo-desert-future', providerId: 'demo', providerName: 'AI Studio Demo', modelId: 'flux-demo',
    type: 'image', prompt: 'Futuristic desert architecture at golden hour, editorial concept art',
    resultUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=85',
    status: 'completed', isFavorite: false, width: 1400, height: 933, createdAt: Date.now() - 3 * 60 * 60 * 1000,
  },
  {
    id: 'demo-abstract-color', providerId: 'demo', providerName: 'AI Studio Demo', modelId: 'flux-demo',
    type: 'image', prompt: 'Vibrant abstract color study with fluid gradients and luminous texture',
    resultUrl: 'https://images.unsplash.com/photo-1550859492-d5da9d8e45f3?auto=format&fit=crop&w=1400&q=85',
    status: 'completed', isFavorite: false, width: 1400, height: 933, createdAt: Date.now() - 24 * 60 * 60 * 1000,
  },
];

async function ensureDemoGallery() {
  if (typeof window === 'undefined' || localStorage.getItem(DEMO_GALLERY_KEY)) return;
  const { total } = await idb.getGenerations({ limit: 1 });
  if (total === 0) {
    for (const generation of DEMO_GENERATIONS) await idb.saveGeneration(generation);
  }
  localStorage.setItem(DEMO_GALLERY_KEY, 'seeded');
}

// ---------------------------------------------------------------------------
// Generations
// ---------------------------------------------------------------------------

export async function fetchGenerations(options?: {
  filter?: 'all' | 'image' | 'video' | 'favorite';
  collectionId?: string;
  page?: number;
  limit?: number;
}) {
  await ensureDemoGallery();
  const page = options?.page || 1;
  const limit = options?.limit || 20;
  const offset = (page - 1) * limit;
  const { generations, total } = await idb.getGenerations({
    filter: options?.filter,
    collectionId: options?.collectionId,
    limit,
    offset,
    orderBy: 'desc',
  });
  const totalPages = Math.ceil(total / limit);
  const hasMore = page < totalPages;
  return { generations, total, page, totalPages, hasMore };
}

export async function fetchGenerationsTimeline(options?: {
  dateFilter?: 'today' | 'week' | 'month' | 'all';
  typeFilter?: 'all' | 'image' | 'video';
  providerFilter?: string;
}) {
  const generations = await idb.getGenerationsForTimeline(options);
  return { generations };
}

export async function saveGeneration(gen: GenerationRecord) {
  return idb.saveGeneration(gen);
}

export async function updateGeneration(id: string, updates: Partial<GenerationRecord>) {
  return idb.updateGeneration(id, updates);
}

export async function deleteGeneration(id: string) {
  return idb.deleteGeneration(id);
}

export async function toggleGenerationFavorite(id: string, isFavorite: boolean) {
  return idb.updateGeneration(id, { isFavorite });
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export async function fetchStats() {
  return idb.getStats();
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export async function fetchCollections() {
  return idb.getAllCollections();
}

export async function createCollection(data: { name: string; description?: string; color?: string; icon?: string }) {
  const collection: CollectionRecord = {
    id: crypto.randomUUID(),
    name: data.name,
    description: data.description,
    color: data.color || '#d9ff00',
    icon: data.icon,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await idb.saveCollection(collection);
  return { collection: { ...collection, itemCount: 0 } };
}

export async function updateCollection(id: string, data: Partial<CollectionRecord>) {
  await idb.updateCollection(id, data);
  const collections = await idb.getAllCollections();
  const updated = collections.find((c) => c.id === id);
  return { collection: updated };
}

export async function deleteCollection(id: string) {
  await idb.deleteCollection(id);
  return { success: true };
}

export async function addToCollection(collectionId: string, generationId: string) {
  const item = await idb.addToCollection(collectionId, generationId);
  return { item };
}

export async function removeFromCollection(collectionId: string, generationId: string) {
  await idb.removeFromCollection(collectionId, generationId);
  return { success: true };
}

export async function fetchCollectionItems(generationIds: string[]) {
  const items = await idb.getCollectionItems(generationIds);
  return { items };
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

export async function fetchPrompts() {
  return idb.getAllPrompts();
}

export async function createPrompt(data: { text: string; category?: string; isFavorite?: boolean; providerName?: string; modelName?: string }) {
  const prompt: PromptRecord = {
    id: crypto.randomUUID(),
    text: data.text,
    category: data.category || 'other',
    isFavorite: data.isFavorite ?? false,
    providerName: data.providerName,
    modelName: data.modelName,
    usageCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await idb.savePrompt(prompt);
  return prompt;
}

export async function updatePrompt(id: string, data: Partial<PromptRecord>) {
  await idb.updatePrompt(id, data);
  return idb.getPrompt(id);
}

export async function deletePrompt(id: string) {
  await idb.deletePrompt(id);
  return { success: true };
}
