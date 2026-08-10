import { NextResponse } from 'next/server';

import { PROVIDERS, MODELS } from '@/lib/providers-data';
import { getSupportedGenerationKinds } from '@/lib/provider-capabilities';
import { decorateRegisteredProviders } from '@/lib/generation-registry';

export async function GET() {
  try {
    const catalog = PROVIDERS.map((provider) => ({
      ...provider,
      models: MODELS.filter((model) => model.providerName === provider.name)
        .map((model) => ({
          id: `${provider.name}-${model.modelId}`,
          providerName: model.providerName,
          name: model.name,
          modelId: model.modelId,
          type: model.type,
          capabilities: model.capabilities,
          description: model.description,
          priceInfo: model.priceInfo,
          isDefault: model.isDefault,
        })),
    }));

    const providersWithModels = decorateRegisteredProviders(catalog)
      .map((provider) => ({
        ...provider,
        supportedGenerationKinds: getSupportedGenerationKinds(provider.name),
      }));

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
