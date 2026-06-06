import { NextRequest, NextResponse } from 'next/server';
import { PROVIDERS } from '@/lib/providers-data';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { providerId, apiKey } = body as { providerId: string; apiKey: string };

    if (!providerId || !apiKey) {
      return NextResponse.json({ error: 'providerId and apiKey are required' }, { status: 400 });
    }

    const provider = PROVIDERS.find((p) => p.name === providerId);
    if (!provider) {
      return NextResponse.json({ error: `Provider "${providerId}" not found` }, { status: 404 });
    }

    // Return the static models for this provider as "discovered"
    const { MODELS } = await import('@/lib/providers-data');
    const providerModels = MODELS.filter((m) => m.providerName === providerId);

    const models = providerModels.map((m) => ({
      id: m.modelId,
      name: m.name,
      type: m.type,
      capabilities: m.capabilities.split(',').map((c) => c.trim()),
      description: m.description || `${provider.displayName} model: ${m.modelId}`,
      alreadyAdded: true,
    }));

    return NextResponse.json({
      success: true,
      providerId,
      providerName: provider.displayName,
      models,
      totalFound: models.length,
      totalNew: 0,
    });
  } catch (error) {
    console.error('Models discover error:', error);
    return NextResponse.json({ error: 'Failed to discover models' }, { status: 500 });
  }
}
