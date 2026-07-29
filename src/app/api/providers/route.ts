import { NextResponse } from 'next/server';

import { PROVIDERS, MODELS } from '@/lib/providers-data';
import {
  getSupportedGenerationKinds,
  supportsGeneration,
  type GenerationKind,
} from '@/lib/provider-capabilities';

export async function GET() {
  try {
    const providersWithModels = PROVIDERS.map((provider) => ({
      ...provider,
      supportedGenerationKinds: getSupportedGenerationKinds(provider.name),
      models: MODELS.filter((model) => {
        if (model.providerName !== provider.name) return false;
        return supportsGeneration(provider.name, model.type as GenerationKind);
      }).map((model) => ({
        id: `${provider.name}-${model.modelId}`,
        name: model.name,
        modelId: model.modelId,
        type: model.type,
        capabilities: model.capabilities,
        description: model.description,
        priceInfo: model.priceInfo,
        isDefault: model.isDefault,
      })),
    })).filter((provider) => provider.models.length > 0);

    return NextResponse.json(providersWithModels, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Providers GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch providers' },
      { status: 500 },
    );
  }
}
