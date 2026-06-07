// ---------------------------------------------------------------------------
// IndexedDB utility for all client-side persistent storage
// Uses Dexie-like raw IndexedDB API — no external dependencies
// ---------------------------------------------------------------------------

const DB_NAME = 'ai-studio';
const DB_VERSION = 4;

// ---------------------------------------------------------------------------
// Open / upgrade DB
// ---------------------------------------------------------------------------

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB not available in SSR'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // v1: api-keys store
      if (!db.objectStoreNames.contains('api-keys')) {
        const store = db.createObjectStore('api-keys', { keyPath: 'providerId' });
        store.createIndex('providerId', 'providerId', { unique: true });
      }
      // v2: referenceImages store
      if (!db.objectStoreNames.contains('referenceImages')) {
        const refStore = db.createObjectStore('referenceImages', { keyPath: 'id', autoIncrement: true });
        refStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      // v3: generations, prompts, collections
      if (!db.objectStoreNames.contains('generations')) {
        const genStore = db.createObjectStore('generations', { keyPath: 'id' });
        genStore.createIndex('createdAt', 'createdAt', { unique: false });
        genStore.createIndex('type', 'type', { unique: false });
        genStore.createIndex('isFavorite', 'isFavorite', { unique: false });
        genStore.createIndex('providerId', 'providerId', { unique: false });
        genStore.createIndex('status', 'status', { unique: false });
        genStore.createIndex('parentGenerationId', 'parentGenerationId', { unique: false });
      }
      if (!db.objectStoreNames.contains('prompts')) {
        const promptStore = db.createObjectStore('prompts', { keyPath: 'id' });
        promptStore.createIndex('createdAt', 'createdAt', { unique: false });
        promptStore.createIndex('category', 'category', { unique: false });
        promptStore.createIndex('isFavorite', 'isFavorite', { unique: false });
      }
      if (!db.objectStoreNames.contains('collections')) {
        const colStore = db.createObjectStore('collections', { keyPath: 'id' });
        colStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('collectionItems')) {
        const itemStore = db.createObjectStore('collectionItems', { keyPath: 'id' });
        itemStore.createIndex('collectionId', 'collectionId', { unique: false });
        itemStore.createIndex('generationId', 'generationId', { unique: false });
      }
      // v4: customModels store
      if (!db.objectStoreNames.contains('customModels')) {
        const customStore = db.createObjectStore('customModels', { keyPath: 'id' });
        customStore.createIndex('providerId', 'providerId', { unique: false });
      }
    };
  });
}

function tx(storeNames: string | string[], mode: IDBTransactionMode = 'readonly'): Promise<{ transaction: IDBTransaction; stores: Record<string, IDBObjectStore> }> {
  return openDB().then((db) => {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    const transaction = db.transaction(names, mode);
    const stores: Record<string, IDBObjectStore> = {};
    for (const name of names) {
      stores[name] = transaction.objectStore(name);
    }
    return { transaction, stores };
  });
}

function reqToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// ===========================================================================
// API Keys (BYOK — Bring Your Own Key)
// ===========================================================================

export interface StoredApiKey {
  providerId: string;
  key: string;
  label: string;
  createdAt: number;
}

export async function saveApiKey(providerId: string, key: string, label: string): Promise<void> {
  const { transaction, stores } = await tx('api-keys', 'readwrite');
  stores['api-keys'].put({ providerId, key, label, createdAt: Date.now() });
  await txComplete(transaction);
}

export async function getApiKey(providerId: string): Promise<StoredApiKey | null> {
  const { stores } = await tx('api-keys');
  return reqToPromise(stores['api-keys'].get(providerId));
}

export async function getAllApiKeys(): Promise<StoredApiKey[]> {
  const { stores } = await tx('api-keys');
  return reqToPromise(stores['api-keys'].getAll());
}

export async function deleteApiKey(providerId: string): Promise<void> {
  const { transaction, stores } = await tx('api-keys', 'readwrite');
  stores['api-keys'].delete(providerId);
  await txComplete(transaction);
}

export async function getApiKeyForProvider(providerId: string): Promise<string | null> {
  const stored = await getApiKey(providerId);
  return stored?.key || null;
}

export function maskKey(key: string): string {
  if (!key || key.length <= 8) return key;
  return `${key.slice(0, 6)}${'•'.repeat(Math.min(16, key.length - 8))}${key.slice(-2)}`;
}

export async function clearAllApiKeys(): Promise<number> {
  const keys = await getAllApiKeys();
  const { transaction, stores } = await tx('api-keys', 'readwrite');
  stores['api-keys'].clear();
  await txComplete(transaction);
  return keys.length;
}

// ===========================================================================
// Reference Image History
// ===========================================================================

export interface ReferenceImage {
  id?: number;
  dataUrl: string;
  thumbnailUrl: string;
  name: string;
  width: number;
  height: number;
  createdAt: number;
}

function generateThumbnail(dataUrl: string, maxSize = 128): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = Math.min(maxSize / img.naturalWidth, maxSize / img.naturalHeight, 1);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = dataUrl;
  });
}

export async function saveReferenceImage(dataUrl: string, name?: string): Promise<ReferenceImage> {
  const thumbnailUrl = await generateThumbnail(dataUrl);
  const { width, height } = await getImageDimensions(dataUrl);
  const record: ReferenceImage = { dataUrl, thumbnailUrl, name: name || 'Untitled', width, height, createdAt: Date.now() };
  const { transaction, stores } = await tx('referenceImages', 'readwrite');
  const id = await reqToPromise(stores['referenceImages'].add(record)) as number;
  record.id = id;
  await txComplete(transaction);
  return record;
}

export async function getRecentReferenceImages(limit = 50): Promise<ReferenceImage[]> {
  const { stores } = await tx('referenceImages');
  const index = stores['referenceImages'].index('createdAt');
  const request = index.getAll();
  const results: ReferenceImage[] = await reqToPromise(request);
  return results.reverse().slice(0, limit);
}

export async function deleteReferenceImage(id: number): Promise<void> {
  const { transaction, stores } = await tx('referenceImages', 'readwrite');
  stores['referenceImages'].delete(id);
  await txComplete(transaction);
}

export async function clearAllReferenceImages(): Promise<void> {
  const { transaction, stores } = await tx('referenceImages', 'readwrite');
  stores['referenceImages'].clear();
  await txComplete(transaction);
}

// ===========================================================================
// Generations (replaces Prisma Generation model)
// ===========================================================================

export interface GenerationRecord {
  id: string;
  providerId: string;
  providerName: string;
  modelId: string;
  type: 'image' | 'video';
  prompt: string;
  negativePrompt?: string;
  params?: string; // JSON
  inputImageUrl?: string;
  resultUrl?: string;
  resultData?: string;
  thumbnailUrl?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  providerJobId?: string;
  parentGenerationId?: string;
  width?: number;
  height?: number;
  duration?: number;
  isFavorite: boolean;
  createdAt: number;
}

export async function saveGeneration(gen: GenerationRecord): Promise<void> {
  const { transaction, stores } = await tx('generations', 'readwrite');
  stores['generations'].put(gen);
  await txComplete(transaction);
}

export async function getGeneration(id: string): Promise<GenerationRecord | undefined> {
  const { stores } = await tx('generations');
  return reqToPromise(stores['generations'].get(id));
}

export async function updateGeneration(id: string, updates: Partial<GenerationRecord>): Promise<void> {
  const { transaction, stores } = await tx('generations', 'readwrite');
  const store = stores['generations'];
  const existing = await reqToPromise<GenerationRecord | undefined>(store.get(id));
  if (existing) {
    store.put({ ...existing, ...updates });
  }
  await txComplete(transaction);
}

export async function deleteGeneration(id: string): Promise<void> {
  const { transaction, stores } = await tx(['generations', 'collectionItems'], 'readwrite');
  stores['generations'].delete(id);
  // Also remove from collections
  const itemIndex = stores['collectionItems'].index('generationId');
  const items = await reqToPromise<{ id: string }[]>(itemIndex.getAll(id));
  for (const item of items) {
    stores['collectionItems'].delete(item.id);
  }
  await txComplete(transaction);
}

export async function getGenerations(options?: {
  filter?: 'all' | 'image' | 'video' | 'favorite';
  collectionId?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'asc' | 'desc';
}): Promise<{ generations: GenerationRecord[]; total: number }> {
  const { stores } = await tx(['generations', 'collectionItems']);
  const all: GenerationRecord[] = await reqToPromise(stores['generations'].getAll());

  let filtered = all;

  if (options?.filter === 'image') filtered = filtered.filter((g) => g.type === 'image');
  else if (options?.filter === 'video') filtered = filtered.filter((g) => g.type === 'video');
  else if (options?.filter === 'favorite') filtered = filtered.filter((g) => g.isFavorite);

  if (options?.collectionId) {
    const items = await reqToPromise<{ generationId: string }[]>(
      stores['collectionItems'].index('collectionId').getAll(options.collectionId)
    );
    const genIds = new Set(items.map((i) => i.generationId));
    filtered = filtered.filter((g) => genIds.has(g.id));
  }

  const total = filtered.length;

  // Sort by createdAt
  filtered.sort((a, b) =>
    options?.orderBy === 'asc' ? a.createdAt - b.createdAt : b.createdAt - a.createdAt
  );

  const offset = options?.offset || 0;
  const limit = options?.limit || filtered.length;
  filtered = filtered.slice(offset, offset + limit);

  return { generations: filtered, total };
}

export async function getGenerationsForTimeline(options?: {
  dateFilter?: 'today' | 'week' | 'month' | 'all';
  typeFilter?: 'all' | 'image' | 'video';
  providerFilter?: string;
}): Promise<GenerationRecord[]> {
  const { stores } = await tx('generations');
  const all: GenerationRecord[] = await reqToPromise(stores['generations'].getAll());

  let filtered = all.filter((g) => g.status === 'completed');

  if (options?.dateFilter && options.dateFilter !== 'all') {
    const now = new Date();
    let since: number;
    if (options.dateFilter === 'today') {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    } else if (options.dateFilter === 'week') {
      since = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    } else {
      since = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    }
    filtered = filtered.filter((g) => g.createdAt >= since);
  }

  if (options?.typeFilter === 'image') filtered = filtered.filter((g) => g.type === 'image');
  else if (options?.typeFilter === 'video') filtered = filtered.filter((g) => g.type === 'video');

  if (options?.providerFilter) filtered = filtered.filter((g) => g.providerId === options.providerFilter);

  return filtered;
}

export async function getStats(): Promise<{
  totalGenerations: number;
  totalImages: number;
  totalVideos: number;
  totalFavorites: number;
  recentCount: number;
  avgPerDay: number;
}> {
  const { stores } = await tx('generations');
  const all: GenerationRecord[] = await reqToPromise(stores['generations'].getAll());

  const totalGenerations = all.length;
  const totalImages = all.filter((g) => g.type === 'image').length;
  const totalVideos = all.filter((g) => g.type === 'video').length;
  const totalFavorites = all.filter((g) => g.isFavorite).length;

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentCount = all.filter((g) => g.createdAt >= weekAgo).length;

  let avgPerDay = 0;
  if (totalGenerations > 0) {
    const oldest = all.reduce((min, g) => Math.min(min, g.createdAt), all[0]?.createdAt || Date.now());
    const daysSinceFirst = Math.max(1, Math.ceil((Date.now() - oldest) / (1000 * 60 * 60 * 24)));
    avgPerDay = Math.round((totalGenerations / daysSinceFirst) * 10) / 10;
  }

  return { totalGenerations, totalImages, totalVideos, totalFavorites, recentCount, avgPerDay };
}

// ===========================================================================
// Prompts (replaces Prisma Prompt model)
// ===========================================================================

export interface PromptRecord {
  id: string;
  text: string;
  category: string;
  isFavorite: boolean;
  providerName?: string;
  modelName?: string;
  usageCount: number;
  createdAt: number;
  updatedAt: number;
}

export async function savePrompt(prompt: PromptRecord): Promise<void> {
  const { transaction, stores } = await tx('prompts', 'readwrite');
  stores['prompts'].put(prompt);
  await txComplete(transaction);
}

export async function getPrompt(id: string): Promise<PromptRecord | undefined> {
  const { stores } = await tx('prompts');
  return reqToPromise(stores['prompts'].get(id));
}

export async function getAllPrompts(): Promise<PromptRecord[]> {
  const { stores } = await tx('prompts');
  const all: PromptRecord[] = await reqToPromise(stores['prompts'].getAll());
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function updatePrompt(id: string, updates: Partial<PromptRecord>): Promise<void> {
  const { transaction, stores } = await tx('prompts', 'readwrite');
  const store = stores['prompts'];
  const existing = await reqToPromise<PromptRecord | undefined>(store.get(id));
  if (existing) {
    store.put({ ...existing, ...updates, updatedAt: Date.now() });
  }
  await txComplete(transaction);
}

export async function deletePrompt(id: string): Promise<void> {
  const { transaction, stores } = await tx('prompts', 'readwrite');
  stores['prompts'].delete(id);
  await txComplete(transaction);
}

// ===========================================================================
// Collections (replaces Prisma Collection + CollectionItem models)
// ===========================================================================

export interface CollectionRecord {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CollectionItemRecord {
  id: string;
  collectionId: string;
  generationId: string;
  addedAt: number;
}

export async function saveCollection(collection: CollectionRecord): Promise<void> {
  const { transaction, stores } = await tx('collections', 'readwrite');
  stores['collections'].put(collection);
  await txComplete(transaction);
}

export async function getCollection(id: string): Promise<CollectionRecord | undefined> {
  const { stores } = await tx('collections');
  return reqToPromise(stores['collections'].get(id));
}

export async function getAllCollections(): Promise<(CollectionRecord & { itemCount: number })[]> {
  const { stores } = await tx(['collections', 'collectionItems']);
  const collections: CollectionRecord[] = await reqToPromise(stores['collections'].getAll());
  const items: CollectionItemRecord[] = await reqToPromise(stores['collectionItems'].getAll());

  const countMap = new Map<string, number>();
  for (const item of items) {
    countMap.set(item.collectionId, (countMap.get(item.collectionId) || 0) + 1);
  }

  return collections
    .map((c) => ({ ...c, itemCount: countMap.get(c.id) || 0 }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function updateCollection(id: string, updates: Partial<CollectionRecord>): Promise<void> {
  const { transaction, stores } = await tx('collections', 'readwrite');
  const store = stores['collections'];
  const existing = await reqToPromise<CollectionRecord | undefined>(store.get(id));
  if (existing) {
    store.put({ ...existing, ...updates, updatedAt: Date.now() });
  }
  await txComplete(transaction);
}

export async function deleteCollection(id: string): Promise<void> {
  const { transaction, stores } = await tx(['collections', 'collectionItems'], 'readwrite');
  stores['collections'].delete(id);
  const itemIndex = stores['collectionItems'].index('collectionId');
  const items = await reqToPromise<CollectionItemRecord[]>(itemIndex.getAll(id));
  for (const item of items) {
    stores['collectionItems'].delete(item.id);
  }
  await txComplete(transaction);
}

export async function addToCollection(collectionId: string, generationId: string): Promise<CollectionItemRecord> {
  const { transaction, stores } = await tx('collectionItems', 'readwrite');
  // Check for existing
  const index = stores['collectionItems'].index('collectionId');
  const existing = await reqToPromise<CollectionItemRecord[]>(index.getAll(collectionId));
  const found = existing.find((i) => i.generationId === generationId);
  if (found) {
    await txComplete(transaction);
    return found;
  }
  const item: CollectionItemRecord = {
    id: crypto.randomUUID(),
    collectionId,
    generationId,
    addedAt: Date.now(),
  };
  stores['collectionItems'].add(item);
  await txComplete(transaction);
  return item;
}

export async function removeFromCollection(collectionId: string, generationId: string): Promise<void> {
  const { transaction, stores } = await tx('collectionItems', 'readwrite');
  const index = stores['collectionItems'].index('collectionId');
  const items = await reqToPromise<CollectionItemRecord[]>(index.getAll(collectionId));
  const found = items.find((i) => i.generationId === generationId);
  if (found) {
    stores['collectionItems'].delete(found.id);
  }
  await txComplete(transaction);
}

export async function getCollectionItems(generationIds: string[]): Promise<{ generationId: string; collectionId: string }[]> {
  const { stores } = await tx('collectionItems');
  const all: CollectionItemRecord[] = await reqToPromise(stores['collectionItems'].getAll());
  const idSet = new Set(generationIds);
  return all.filter((i) => idSet.has(i.generationId)).map((i) => ({ generationId: i.generationId, collectionId: i.collectionId }));
}

// ===========================================================================
// Custom Models (user-added models stored in IndexedDB)
// ===========================================================================

export interface CustomModelRecord {
  id: string;
  providerId: string;
  providerName: string;
  name: string;
  modelId: string;
  type: 'image' | 'video';
  capabilities: string;
  description?: string;
  priceInfo?: string;
  createdAt: number;
}

export async function saveCustomModel(model: Omit<CustomModelRecord, 'id' | 'createdAt'>): Promise<CustomModelRecord> {
  const record: CustomModelRecord = {
    ...model,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  const { transaction, stores } = await tx('customModels', 'readwrite');
  stores['customModels'].put(record);
  await txComplete(transaction);
  return record;
}

export async function getAllCustomModels(): Promise<CustomModelRecord[]> {
  const { stores } = await tx('customModels');
  const all: CustomModelRecord[] = await reqToPromise(stores['customModels'].getAll());
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function deleteCustomModel(id: string): Promise<void> {
  const { transaction, stores } = await tx('customModels', 'readwrite');
  stores['customModels'].delete(id);
  await txComplete(transaction);
}

export async function clearAllCustomModels(): Promise<void> {
  const { transaction, stores } = await tx('customModels', 'readwrite');
  stores['customModels'].clear();
  await txComplete(transaction);
}
