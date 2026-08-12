import { NextRequest } from 'next/server';

import { PROVIDERS } from '@/lib/providers-data';
import { requireModelOperation } from '@/lib/generation-registry';
import {
  MAX_SINGLE_IMAGE_REQUEST_BYTES,
  parseGenerationRequest,
  upscaleGenerationRequestSchema,
} from '@/lib/server/generation-request';
import {
  generationErrorResponse,
  noStoreJson,
} from '@/lib/server/generation-response';
import { resolveImageBlob } from '@/lib/server/image-input';
import { providerFetch as fetch } from '@/lib/server/provider-request';

export const runtime = 'nodejs';

function getProviderById(id: string) {
  return PROVIDERS.find((provider) => provider.id === id);
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

  const buffer = await response.arrayBuffer();
  return [`data:image/png;base64,${Buffer.from(buffer).toString('base64')}`];
}

export async function POST(req: NextRequest) {
  try {
    const {
      providerId,
      modelId,
      imageUrl,
      prompt,
      negativePrompt,
      reviewedRegistration,
      apiKey,
      upscaleFactor,
    } = await parseGenerationRequest(
      req,
      upscaleGenerationRequestSchema,
      MAX_SINGLE_IMAGE_REQUEST_BYTES,
    );

    const provider = getProviderById(providerId);
    if (!provider) {
      return noStoreJson({
        error: 'Provider not found',
        code: 'provider_not_found',
      }, 404);
    }

    requireModelOperation(provider.name, modelId, 'upscale', 'upscale', reviewedRegistration);

    if (provider.name !== 'stability') {
      return noStoreJson({
        error: `No registered upscale adapter is available for ${provider.displayName}.`,
        code: 'adapter_not_configured',
      }, 400);
    }

    const urls = await upscaleStability({
      imageUrl,
      prompt: prompt || 'Upscale this image while preserving its composition and details',
      negativePrompt,
      upscaleFactor,
    }, apiKey, provider.baseUrl);

    return noStoreJson({ status: 'completed', urls });
  } catch (error) {
    return generationErrorResponse(error, {
      logLabel: 'Upscale image error',
      fallbackMessage: 'Failed to upscale image',
    });
  }
}
