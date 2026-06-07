import { NextResponse } from 'next/server';
import { PROVIDERS, MODELS } from '@/lib/providers-data';

export async function GET() {
  try {
    // Attach models to each provider
    const providersWithModels = PROVIDERS.map((p) => ({
      ...p,
      models: MODELS.filter((m) => m.providerName === p.name).map((m) => ({
        id: `${p.name}-${m.modelId}`,
        name: m.name,
        modelId: m.modelId,
        type: m.type,
        capabilities: m.capabilities,
        description: m.description,
        priceInfo: m.priceInfo,
        isDefault: m.isDefault,
      })),
    }));
    return NextResponse.json(providersWithModels);
  } catch (error) {
    console.error('Providers GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 });
  }
}
