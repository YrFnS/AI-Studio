import { NextRequest, NextResponse } from 'next/server';

import { PROVIDERS } from '@/lib/providers-data';
import { resolveImageBlob } from '@/lib/server/image-input';
import {
  GenerationRegistryError,
  requireModelOperation,
} from '@/lib/generation-registry';

export const runtime = 'nodejs';

const STABILITY_MODEL_IDS: Record<string, string> = {
  'stable-diffusion-3.5-large': 'sd3.5-large',
  'stable-diffusion-3.5-large-turbo': 'sd3.5-large-turbo',
  'stable-diffusion-3.5-medium': 'sd3.5-medium',
};

function getProviderById(id: string) {
  return PROVIDERS.find((provider) => provider.id === id);
}

function json(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function variationStability(
  params: {
    imageUrl: string;
    prompt: string;
    negativePrompt?: string;
    variationStrength: number;
    modelId: string;
    seed?: number;
  },
  apiKey: string,
  providerBaseUrl: string,
) {
  const providerModel = STABILITY_MODEL_IDS[params.modelId];
  if (!providerModel) {
    throw new Error(`No Stability variation adapter exists for ${params.modelId}.`);
  }

  const imageBlob = await resolveImageBlob(params.imageUrl);
  const formData = new FormData();
  formData.append('prompt', params.prompt);
  if (params.negativePrompt) {
    formData.append('negative_prompt', params.negativePrompt);
  }
  formData.append('image', imageBlob, 'image.png');
  formData.append('mode', 'image-to-image');
  formData.append('model', providerModel);
  formData.append('strength', params.variationStrength.toString());
  formData.append('output_format', 'png');
  if (params.seed) formData.append('seed', params.seed.toString());

  const response = await fetch(
    `${providerBaseUrl}/v2beta/stable-image/generate/sd3`,
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
    throw new Error(`Stability Variation API error: ${response.status} - ${error}`);
  }

  const buffer = await response.arrayBuffer();
  return [`data:image/png;base64,${Buffer.from(buffer).toString('base64')}`];
}

async function variationOpenAI(
  params: { imageUrl: string; prompt: string; modelId: string },
  apiKey: string,
  providerBaseUrl: string,
) {
  const imageBlob = await resolveImageBlob(params.imageUrl);
  const formData = new FormData();
  formData.append('prompt', params.prompt);
  formData.append('image', imageBlob, 'image.png');
  formData.append('model', params.modelId);
  formData.append('n', '1');

  const response = await fetch(`${providerBaseUrl}/images/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI Variation API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return (data.data || []).map((image: { url?: string; b64_json?: string }) => (
    image.url || `data:image/png;base64,${image.b64_json}`
  ));
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
      variationStrength,
      seed,
    } = body as {
      providerId?: string;
      modelId?: string;
      imageUrl?: string;
      prompt?: string;
      negativePrompt?: string;
      apiKey?: string;
      variationStrength?: number;
      seed?: number;
    };

    if (!providerId || !modelId || !imageUrl || !prompt) {
      return json({
        error: 'providerId, modelId, imageUrl, and prompt are required',
      }, 400);
    }
    if (!apiKey) return json({ error: 'API key is required' }, 400);

    const provider = getProviderById(providerId);
    if (!provider) return json({ error: 'Provider not found' }, 404);

    requireModelOperation(provider.name, modelId, 'variation', 'variations');

    const strength = Math.max(0.3, Math.min(1, variationStrength ?? 0.7));
    let urls: string[];

    switch (provider.name) {
      case 'stability':
        urls = await variationStability({
          imageUrl,
          prompt,
          negativePrompt,
          variationStrength: strength,
          modelId,
          seed,
        }, apiKey, provider.baseUrl);
        break;
      case 'openai':
        urls = await variationOpenAI({ imageUrl, prompt, modelId }, apiKey, provider.baseUrl);
        break;
      default:
        return json({
          error: `No registered variation adapter is available for ${provider.displayName}.`,
        }, 400);
    }

    return json({ status: 'completed', urls });
  } catch (error) {
    if (error instanceof GenerationRegistryError) {
      return json({ error: error.message, code: error.code }, error.status);
    }

    console.error('Variation image error:', error);
    return json({
      error: error instanceof Error ? error.message : 'Failed to create variation',
    }, 500);
  }
}
