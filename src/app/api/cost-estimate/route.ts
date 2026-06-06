import { NextRequest, NextResponse } from 'next/server';
import { MODELS } from '@/lib/providers-data';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { providerId, modelId, params } = body;

    if (!providerId || !modelId) {
      return NextResponse.json({ error: 'providerId and modelId are required' }, { status: 400 });
    }

    // Find the model in static data
    const model = MODELS.find((m) => m.providerName === providerId && m.modelId === modelId);

    const priceInfo = model?.priceInfo;
    let estimatedCost: string;
    let unit: string;

    if (!priceInfo) {
      estimatedCost = 'varies';
      unit = '';
    } else {
      const costMatch = priceInfo.match(/\$([0-9.]+)\s*(?:-\s*\$([0-9.]+))?\s*\/\s*(\w+)/);
      if (costMatch) {
        const minCost = parseFloat(costMatch[1]);
        const maxCost = costMatch[2] ? parseFloat(costMatch[2]) : null;
        unit = costMatch[3];
        if (unit === 'second' || unit === 'seconds' || unit === 'sec') {
          const duration = params?.duration || 5;
          const minTotal = minCost * duration;
          const maxTotal = maxCost ? maxCost * duration : null;
          estimatedCost = maxTotal ? `$${minTotal.toFixed(2)} - $${maxTotal.toFixed(2)}` : `~$${minTotal.toFixed(2)}`;
        } else {
          const batchSize = params?.batchSize || 1;
          const minTotal = minCost * batchSize;
          const maxTotal = maxCost ? maxCost * batchSize : null;
          estimatedCost = maxTotal ? `$${minTotal.toFixed(2)} - $${maxTotal.toFixed(2)}` : `~$${minTotal.toFixed(2)}`;
        }
      } else {
        estimatedCost = priceInfo;
        unit = '';
      }
    }

    return NextResponse.json({ estimatedCost, unit, priceInfo: priceInfo || null, modelName: model?.name || modelId });
  } catch (error) {
    console.error('Cost estimate error:', error);
    return NextResponse.json({ error: 'Failed to estimate cost' }, { status: 500 });
  }
}
