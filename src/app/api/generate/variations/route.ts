import { NextRequest } from 'next/server';

import { PROVIDERS } from '@/lib/providers-data';
import { requireModelOperation } from '@/lib/generation-registry';
import {
  MAX_SINGLE_IMAGE_REQUEST_BYTES,
  parseGenerationRequest,
  variationGenerationRequestSchema,
} from '@/lib/server/generation-request';
import {
  generationErrorResponse,
  noStoreJson,
} from '@/lib/server/generation-response';
import { resolveImageBlob } from '@/lib/server/image-input';
import { providerFetch as fetch } from '@/lib/server/provider-request';

export const runtime = 'nodejs';

const STABILITY_MODEL_IDS: Record<string, string> = {
  'stable-diffusion-3.5-large': 'sd3.5-large',
  'stable-diffusion-3.5-large-turbo': 'sd3.5-large-turbo',
  'stable-diffusion-3.5-medium': 'sd3.5-medium',
};

function getProviderById(id: string) {
  return PROVIDERS.find((provider) => provider.id === id);
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
  if (params.seed !== undefined) formData.append('seed', params.seed.toString());

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

  const data = await response.json();
  return (data.data || []).map((image: { url?: string; b64_json?: string }) => (
    image.url || `data:image/png;base64,${image.b64_json}`
  ));
}

export async function POST(req: NextRequest) {
  try {
    const {
      providerId,
      modelId,
      imageUrl,
      prompt,
      negativePrompt,
      apiKey,
      variationStrength,
      seed,
    } = await parseGenerationRequest(
      req,
      variationGenerationRequestSchema,
      MAX_SINGLE_IMAGE_REQUEST_BYTES,
    );

    const provider = getProviderById(providerId);
    if (!provider) {
      return noStoreJson({
        error: 'Provider not found',
        code: 'provider_not_found',
      }, 404);
    }

    requireModelOperation(provider.name, modelId, 'variation', 'variations');

    let urls: string[];
    switch (provider.name) {
      case 'stability':
        urls = await variationStability({
          imageUrl,
          prompt,
          negativePrompt,
          variationStrength,
          modelId,
          seed,
        }, apiKey, provider.baseUrl);
        break;
      case 'openai':
        urls = await variationOpenAI({ imageUrl, prompt, modelId }, apiKey, provider.baseUrl);
        break;
      default:
        return noStoreJson({
          error: `No registered variation adapter is available for ${provider.displayName}.`,
          code: 'adapter_not_configured',
        }, 400);
    }

    return noStoreJson({ status: 'completed', urls });
  } catch (error) {
    return generationErrorResponse(error, {
      logLabel: 'Variation image error',
      fallbackMessage: 'Failed to create variation',
    });
  }
}
