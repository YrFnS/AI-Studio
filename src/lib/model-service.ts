// ===========================================================================
// Model Service — Unified model catalog combining:
//   1. Static provider definitions (from providers-data.ts)
//   2. Dynamically discovered models (from provider APIs via model-discovery.ts)
//   3. User-added custom models (from IndexedDB)
//   4. Cached discovered models (from IndexedDB)
// ===========================================================================

import { PROVIDERS, MODELS } from '@/lib/providers-data';
import type { Provider, ModelWithProvider } from '@/lib/types';
import { discoverModels, supportsDiscovery } from '@/lib/model-discovery';
import {
  getAllCustomModels,
  getAllDiscoveredModels,
  saveDiscoveredModels,
  type CustomModelRecord,
  type DiscoveredModelCache,
} from '@/lib/idb';

// ---------------------------------------------------------------------------
// Convert raw static MODELS to ModelWithProvider format
// ---------------------------------------------------------------------------
function mapStaticModel(m: (typeof MODELS)[number], providerDisplayName: string): ModelWithProvider {
  return {
    id: `${m.providerName}-${m.modelId}`,
    name: m.name,
    modelId: m.modelId,
    type: m.type as 'image' | 'video',
    capabilities: m.capabilities,
    description: m.description || '',
    priceInfo: m.priceInfo || '',
    isDefault: m.isDefault,
    isActive: true,
    sortOrder: m.sortOrder || 0,
    createdAt: new Date(0).toISOString(), // static models have no creation date
    provider: {
      name: m.providerName,
      displayName: providerDisplayName,
    },
  };
}

// ---------------------------------------------------------------------------
// Convert discovered model cache → ModelWithProvider
// ---------------------------------------------------------------------------
function mapDiscoveredModel(m: DiscoveredModelCache): ModelWithProvider {
  return {
    id: m.id,
    name: m.name,
    modelId: m.modelId,
    type: m.type,
    capabilities: m.capabilities,
    description: m.description || '',
    priceInfo: m.priceInfo || '',
    isDefault: false,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date(m.fetchedAt).toISOString(),
    provider: {
      name: m.providerName,
      displayName: m.providerName,
    },
  };
}

// ---------------------------------------------------------------------------
// Convert custom model record → ModelWithProvider
// ---------------------------------------------------------------------------
function mapCustomModel(m: CustomModelRecord): ModelWithProvider {
  return {
    id: m.id,
    name: m.name,
    modelId: m.modelId,
    type: m.type,
    capabilities: m.capabilities,
    description: m.description || '',
    priceInfo: m.priceInfo || '',
    isDefault: false,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date(m.createdAt).toISOString(),
    provider: {
      name: m.providerName,
      displayName: m.providerName,
    },
  };
}

// ---------------------------------------------------------------------------
// Provider info (static — this never changes)
// ---------------------------------------------------------------------------
export function getStaticProviders(): Provider[] {
  return PROVIDERS.map((p) => ({
    id: p.id,
    name: p.name,
    displayName: p.displayName,
    description: p.description,
    baseUrl: p.baseUrl,
    authHeader: p.authHeader,
    authPrefix: p.authPrefix,
    keyFormat: p.keyFormat,
    icon: p.icon,
    color: p.color,
    website: p.website,
    sortOrder: p.sortOrder,
    isActive: true,
    models: [], // models loaded separately
  }));
}

export function getProviderByName(name: string): Provider | undefined {
  const p = PROVIDERS.find((p) => p.id === name || p.name === name);
  if (!p) return undefined;
  return {
    id: p.id,
    name: p.name,
    displayName: p.displayName,
    description: p.description,
    baseUrl: p.baseUrl,
    authHeader: p.authHeader,
    authPrefix: p.authPrefix,
    keyFormat: p.keyFormat,
    icon: p.icon,
    color: p.color,
    website: p.website,
    sortOrder: p.sortOrder,
    isActive: true,
    models: [],
  };
}

// ---------------------------------------------------------------------------
// Unified model loader — merges static + dynamic + custom
// ---------------------------------------------------------------------------
export interface ModelLoadOptions {
  providerName?: string;
  type?: 'image' | 'video';
  fetchDynamic?: boolean;  // whether to call provider APIs
  apiKeyMap?: Record<string, string>;  // provider name → api key
}

export async function loadAllModels(
  options: ModelLoadOptions = {}
): Promise<ModelWithProvider[]> {
  const { providerName, type, fetchDynamic = false, apiKeyMap = {} } = options;

  // 1. Load static models
  let staticModels: ModelWithProvider[] = MODELS.map((m) => {
    const prov = PROVIDERS.find((p) => p.name === m.providerName);
    return mapStaticModel(m, prov?.displayName || m.providerName);
  });

  if (providerName) staticModels = staticModels.filter((m) => m.provider?.name === providerName);
  if (type) staticModels = staticModels.filter((m) => m.type === type);

  // 2. Load cached discovered models
  const cachedDiscovered = await getAllDiscoveredModels();
  let discoveredModels = cachedDiscovered.map(mapDiscoveredModel);
  if (providerName) discoveredModels = discoveredModels.filter((m) => m.provider?.name === providerName);
  if (type) discoveredModels = discoveredModels.filter((m) => m.type === type);

  // 3. Fetch live dynamic models (if requested and API keys provided)
  if (fetchDynamic && Object.keys(apiKeyMap).length > 0) {
    const dynamicResults: ModelWithProvider[] = [];
    const cacheEntries: DiscoveredModelCache[] = [];

    const providersToFetch = providerName ? [providerName] : Object.keys(apiKeyMap);

    await Promise.allSettled(
      providersToFetch.map(async (pName) => {
        const apiKey = apiKeyMap[pName];
        if (!apiKey || !supportsDiscovery(pName)) return;

        const discovered = await discoverModels(pName, apiKey);
        for (const d of discovered) {
          dynamicResults.push({
            id: `discovered-${pName}-${d.modelId}`,
            name: d.name,
            modelId: d.modelId,
            type: d.type,
            capabilities: d.capabilities.join(','),
            description: d.description || '',
            priceInfo: d.priceInfo || '',
            isDefault: false,
            isActive: true,
            sortOrder: 0,
            createdAt: new Date().toISOString(),
            provider: { name: pName, displayName: pName },
          });
          cacheEntries.push({
            id: `discovered-${pName}-${d.modelId}`,
            providerName: pName,
            modelId: d.modelId,
            name: d.name,
            type: d.type,
            capabilities: d.capabilities.join(','),
            description: d.description,
            priceInfo: d.priceInfo,
            fetchedAt: Date.now(),
          });
        }
      })
    );

    if (cacheEntries.length > 0) {
      await saveDiscoveredModels(cacheEntries);
    }

    // Replace cached discovered with fresh dynamic results
    discoveredModels = providerName
      ? dynamicResults
      : [...dynamicResults, ...discoveredModels.filter((dm) =>
          !providersToFetch.includes(dm.provider?.name || '')
        )];
  }

  // 4. Load custom models from IndexedDB
  const customModels = (await getAllCustomModels()).map(mapCustomModel);
  let filteredCustom = customModels;
  if (providerName) filteredCustom = filteredCustom.filter((m) => m.provider?.name === providerName);
  if (type) filteredCustom = filteredCustom.filter((m) => m.type === type);

  // 5. Merge: custom first, then discovered, then static
  //    (deduplicate by providerName + modelId, preferring custom > discovered > static)
  const seen = new Set<string>();
  const merged: ModelWithProvider[] = [];

  for (const m of [...filteredCustom, ...discoveredModels, ...staticModels]) {
    const key = `${m.provider?.name || 'unknown'}:${m.modelId}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(m);
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Check if a provider supports dynamic discovery
// ---------------------------------------------------------------------------
export function providerSupportsDiscovery(providerName: string): boolean {
  return supportsDiscovery(providerName);
}
