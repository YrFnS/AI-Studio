// ===========================================================================
// Dynamic Model Discovery
// Fetches available models from provider APIs at runtime.
// Each discovery function uses the provider's native API + user's API key.
// Results are normalized to a common format.
// ===========================================================================

export interface DiscoveredModel {
  modelId: string;
  name: string;
  type: 'image' | 'video';
  capabilities: string[];       // e.g. ['t2i', 'i2i']
  description?: string;
  priceInfo?: string;
  contextLength?: number;
  // Raw provider data for debugging
  _raw?: unknown;
}

// ---------------------------------------------------------------------------
// OpenAI — GET https://api.openai.com/v1/models
// Returns all models; we filter to image-capable ones.
// ---------------------------------------------------------------------------
async function discoverOpenAI(apiKey: string): Promise<DiscoveredModel[]> {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const data = await res.json() as { data: Array<{ id: string; owned_by?: string }> };
    const models: DiscoveredModel[] = [];
    for (const m of data.data) {
      const id = m.id.toLowerCase();
      // Filter to image-generation models
      if (id.includes('image') || id.includes('dall-e') || id.includes('gpt-image')) {
        const caps: string[] = [];
        if (id.includes('dall-e-2')) caps.push('t2i');
        else if (id.includes('dall-e-3')) caps.push('t2i', 'i2i');
        else caps.push('t2i', 'i2i', 'edit', 'inpaint'); // GPT Image 1
        models.push({
          modelId: m.id,
          name: m.id,
          type: 'image',
          capabilities: caps,
        });
      }
    }
    return models;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Together AI — GET https://api.together.xyz/v1/models  (OpenAI-compatible)
// ---------------------------------------------------------------------------
async function discoverTogether(apiKey: string): Promise<DiscoveredModel[]> {
  try {
    const res = await fetch('https://api.together.xyz/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const data = await res.json() as Array<{
      id: string;
      type?: string;
      pricing?: { input?: number; output?: number };
    }>;
    return data
      .filter((m) => (m.type === 'image') || m.id.toLowerCase().includes('flux') || m.id.toLowerCase().includes('image'))
      .map((m) => {
        const caps = ['t2i'];
        return {
          modelId: m.id,
          name: m.id,
          type: 'image' as const,
          capabilities: caps,
          priceInfo: m.pricing ? `~$${m.pricing.input}/1K tokens` : undefined,
        };
      });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Fireworks AI — GET https://api.fireworks.ai/inference/v1/models
// ---------------------------------------------------------------------------
async function discoverFireworks(apiKey: string): Promise<DiscoveredModel[]> {
  try {
    const res = await fetch('https://api.fireworks.ai/inference/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const data = await res.json() as Array<{
      id: string;
      type?: string;
      htmlDisplayName?: string;
    }>;
    return data
      .filter((m) => (m.type === 'image') || m.id.toLowerCase().includes('flux') || m.id.toLowerCase().includes('image'))
      .map((m) => ({
        modelId: m.id,
        name: m.htmlDisplayName || m.id,
        type: 'image' as const,
        capabilities: ['t2i'],
      }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Replicate — GET https://api.replicate.com/v1/models (paginated)
// ---------------------------------------------------------------------------
async function discoverReplicate(apiKey: string): Promise<DiscoveredModel[]> {
  try {
    const models: DiscoveredModel[] = [];
    let url = 'https://api.replicate.com/v1/models?cursor=';
    for (let i = 0; i < 5; i++) { // max 5 pages
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) break;
      const data = await res.json() as {
        results?: Array<{
          owner: string;
          name: string;
          description?: string;
          visibility?: string;
          latest_version?: { id: string };
        }>;
        next?: string | null;
      };
      if (!data.results) break;
      for (const m of data.results) {
        // Heuristic: replicate models for image/video
        const fullName = `${m.owner}/${m.name}`.toLowerCase();
        if (fullName.includes('image') || m.description?.toLowerCase().includes('image') ||
            fullName.includes('flux') || m.name.includes('flux')) {
          models.push({
            modelId: `${m.owner}/${m.name}`,
            name: `${m.owner}/${m.name}`,
            type: 'image',
            capabilities: ['t2i'],
            description: m.description || undefined,
          });
        }
      }
      if (!data.next) break;
      url = data.next;
    }
    return models;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Fal.ai — uses their platform API for model discovery
// ---------------------------------------------------------------------------
async function discoverFal(apiKey: string): Promise<DiscoveredModel[]> {
  try {
    // Fal.ai uses a queue-based system; we can list user's submitted endpoints
    const res = await fetch('https://rest.alpha.fal.ai/models', {
      headers: { Authorization: `Key ${apiKey}` },
    });
    if (!res.ok) return [];
    const text = await res.text();
    // Fal returns a list of model objects
    let data: Array<{ endpoint_id?: string; name?: string; category?: string }>;
    try { data = JSON.parse(text); } catch { return []; }
    const models: DiscoveredModel[] = [];
    for (const m of (Array.isArray(data) ? data : [])) {
      const cat = (m.category || '').toLowerCase();
      const type: 'image' | 'video' = cat === 'video' ? 'video' : 'image';
      const caps = type === 'video' ? ['t2v'] : ['t2i'];
      if (m.endpoint_id) {
        models.push({
          modelId: m.endpoint_id,
          name: m.name || m.endpoint_id,
          type,
          capabilities: caps,
        });
      }
    }
    return models;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Google AI Studio (Gemini) — models are documented, but we can list via API
// ---------------------------------------------------------------------------
async function discoverGoogleAIStudio(apiKey: string): Promise<DiscoveredModel[]> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    if (!res.ok) return [];
    const data = await res.json() as {
      models?: Array<{
        name: string;
        displayName?: string;
        supportedGenerationMethods?: string[];
      }>;
    };
    return (data.models || [])
      .filter((m) =>
        m.supportedGenerationMethods?.some(
          (gm) => gm.includes('image') || gm.includes('generateContent')
        )
      )
      .map((m) => ({
        modelId: m.name.replace(/^models\//, ''),
        name: m.displayName || m.name,
        type: 'image' as const,
        capabilities: ['t2i', 'i2i'],
      }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// HuggingFace Inference API — no native list, returns empty (user adds manually)
// ---------------------------------------------------------------------------
async function discoverHuggingFace(_apiKey: string): Promise<DiscoveredModel[]> {
  // HuggingFace doesn't have a standard "list my models" endpoint
  // Users add models manually by ID
  return [];
}

// ---------------------------------------------------------------------------
// Stability AI — No public model list endpoint; returns known models
// ---------------------------------------------------------------------------
async function discoverStability(_apiKey: string): Promise<DiscoveredModel[]> {
  // Stability doesn't have a model discovery API
  // Return empty — user adds manually or we use static defaults
  return [];
}

// ---------------------------------------------------------------------------
// BFL (Black Forest Labs) — fixed model set, no discovery API
// ---------------------------------------------------------------------------
async function discoverBFL(_apiKey: string): Promise<DiscoveredModel[]> {
  return [];
}

// ---------------------------------------------------------------------------
// AI/ML API — aggregator with OpenAI-compatible endpoint
// ---------------------------------------------------------------------------
async function discoverAIMLAPI(apiKey: string): Promise<DiscoveredModel[]> {
  try {
    const res = await fetch('https://api.aimlapi.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const data = await res.json() as { data?: Array<{ id: string; type?: string }> };
    return (data.data || [])
      .filter((m) => !m.type || m.type === 'image' || m.id.toLowerCase().includes('image') || m.id.toLowerCase().includes('flux'))
      .map((m) => {
        const caps = ['t2i'];
        if (m.id.toLowerCase().includes('edit')) caps.push('edit', 'i2i');
        return {
          modelId: m.id,
          name: m.id,
          type: 'image' as const,
          capabilities: caps,
        };
      });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Leonardo, Recraft, Ideogram, Runway, Luma, Seedance — no public list APIs
// ---------------------------------------------------------------------------
async function discoverNoop(_apiKey: string): Promise<DiscoveredModel[]> {
  return [];
}

// ---------------------------------------------------------------------------
// Provider → discovery function map
// ---------------------------------------------------------------------------
const DISCOVERY_MAP: Record<string, (apiKey: string) => Promise<DiscoveredModel[]>> = {
  openai: discoverOpenAI,
  together: discoverTogether,
  fireworks: discoverFireworks,
  replicate: discoverReplicate,
  fal: discoverFal,
  'google-aistudio': discoverGoogleAIStudio,
  huggingface: discoverHuggingFace,
  stability: discoverStability,
  bfl: discoverBFL,
  aimlapi: discoverAIMLAPI,
  leonardo: discoverNoop,
  recraft: discoverNoop,
  ideogram: discoverNoop,
  runway: discoverNoop,
  luma: discoverNoop,
  seedance: discoverNoop,
  'google-vertex': discoverNoop,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Discover models for a single provider */
export async function discoverModels(
  providerName: string,
  apiKey: string
): Promise<DiscoveredModel[]> {
  const discover = DISCOVERY_MAP[providerName.toLowerCase()];
  if (!discover) return [];
  return discover(apiKey);
}

/** Discover models for multiple providers in parallel */
export async function discoverAllModels(
  providers: Array<{ name: string; apiKey: string }>
): Promise<Map<string, DiscoveredModel[]>> {
  const results = new Map<string, DiscoveredModel[]>();
  const entries = providers.filter((p) => p.apiKey);
  const promises = entries.map(async (p) => {
    const models = await discoverModels(p.name, p.apiKey);
    results.set(p.name, models);
  });
  await Promise.allSettled(promises);
  return results;
}

/** Check if a provider supports dynamic model discovery */
export function supportsDiscovery(providerName: string): boolean {
  const fn = DISCOVERY_MAP[providerName.toLowerCase()];
  if (!fn) return false;
  // Return true only for providers that actually fetch (not noop)
  return fn !== discoverNoop && fn !== discoverHuggingFace &&
         fn !== discoverStability && fn !== discoverBFL;
}
