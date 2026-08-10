import { NextRequest, NextResponse } from 'next/server';

import { PROVIDERS } from '@/lib/providers-data';
import { resolveImageBlob } from '@/lib/server/image-input';
import {
  GenerationRegistryError,
  requireModelOperation,
} from '@/lib/generation-registry';

export const runtime = 'nodejs';

function getProviderById(id: string) {
  return PROVIDERS.find((provider) => provider.id === id);
}

function json(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function upscaleStability(
  params: {
    imageUrl: string;
    prompt: string;
    negativePrompt?: string;
    upscaleFactor: number;
  },
  apiKey: string,
  providerBaseUrl: string,
) {
  const imageBlob = await resolveImageBlob(params.imageUrl);
  const formData = new FormData();
  formData.append('prompt', params.prompt);
  if (params.negativePrompt) {
    formData.append('negative_prompt', params.negativePrompt);
  }
  formData.append('image', imageBlob, 'image.png');
  formData.append('output_format', 'png');
  formData.append('creativity', params.upscaleFactor === 4 ? '0.35' : '0.2');

  const response = await fetch(
    `${providerBaseUrl}/v2beta/stable-image/upscale/conservative`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'image/*',
      },
      body: formData,
    },
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Stability Upscale API error: ${response.status} - ${error}`);
  }

  const buffer = await response.arrayBuffer();
  return [`data:image/png;base64,${Buffer.from(buffer).toString('base64')}`];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      providerId,
      modelId,
      imageUrl,
      prompt,
      negativePrompt,
      apiKey,
      upscaleFactor,
    } = body as {
      providerId?: string;
      modelId?: string;
      imageUrl?: string;
      prompt?: string;
      negativePrompt?: string;
      apiKey?: string;
      upscaleFactor?: number;
    };

    if (!providerId || !modelId || !imageUrl) {
      return json({ error: 'providerId, modelId, and imageUrl are required' }, 400);
    }
    if (!apiKey) return json({ error: 'API key is required' }, 400);

    const provider = getProviderById(providerId);
    if (!provider) return json({ error: 'Provider not found' }, 404);

    requireModelOperation(provider.name, modelId, 'upscale', 'upscale');

    if (provider.name !== 'stability') {
      return json({
        error: `No registered upscale adapter is available for ${provider.displayName}.`,
      }, 400);
    }

    const urls = await upscaleStability({
      imageUrl,
      prompt: prompt || 'Upscale this image while preserving its composition and details',
      negativePrompt,
      upscaleFactor: upscaleFactor === 4 ? 4 : 2,
    }, apiKey, provider.baseUrl);

    return json({ status: 'completed', urls });
  } catch (error) {
    if (error instanceof GenerationRegistryError) {
      return json({ error: error.message, code: error.code }, error.status);
    }

    console.error('Upscale image error:', error);
    return json({
      error: error instanceof Error ? error.message : 'Failed to upscale image',
    }, 500);
  }
}
