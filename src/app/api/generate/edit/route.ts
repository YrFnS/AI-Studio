import { NextRequest } from 'next/server';

import { PROVIDERS } from '@/lib/providers-data';
import { requireModelOperation } from '@/lib/generation-registry';
import {
  editGenerationRequestSchema,
  MAX_EDIT_REQUEST_BYTES,
  parseGenerationRequest,
} from '@/lib/server/generation-request';
import {
  generationErrorResponse,
  noStoreJson,
} from '@/lib/server/generation-response';
import { resolveImageBlob } from '@/lib/server/image-input';
import { providerFetch as fetch } from '@/lib/server/provider-request';

function getProviderById(id: string) {
  return PROVIDERS.find((provider) => provider.id === id);
}

async function editOpenAI(
  params: {
    prompt: string;
    modelId: string;
    image: string;
    mask?: string;
    size?: string;
    quality?: string;
    n?: number;
  },
  apiKey: string,
  providerBaseUrl: string,
) {
  const imageBlob = await resolveImageBlob(params.image);
  const maskBlob = params.mask ? await resolveImageBlob(params.mask) : undefined;
  const formData = new FormData();
  formData.append('prompt', params.prompt);
  formData.append('image', imageBlob, 'image.png');
  if (maskBlob) formData.append('mask', maskBlob, 'mask.png');
  formData.append('model', params.modelId);
  if (params.size) formData.append('size', params.size);
  if (params.quality) formData.append('quality', params.quality);
  if (params.n) formData.append('n', String(params.n));

  const response = await fetch(`${providerBaseUrl}/images/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  const data = await response.json();
  return {
    images: (data.data || []).map(
      (image: { url?: string; b64_json?: string }) =>
        image.url || `data:image/png;base64,${image.b64_json}`,
    ),
  };
}

async function editStability(
  params: {
    prompt: string;
    image: string;
    mask?: string;
    negativePrompt?: string;
  },
  apiKey: string,
  providerBaseUrl: string,
) {
  const imageBlob = await resolveImageBlob(params.image);
  const maskBlob = params.mask ? await resolveImageBlob(params.mask) : undefined;
  const formData = new FormData();
  formData.append('prompt', params.prompt);
  if (params.negativePrompt) {
    formData.append('negative_prompt', params.negativePrompt);
  }
  formData.append('output_format', 'png');
  formData.append('image', imageBlob, 'image.png');
  if (maskBlob) formData.append('mask', maskBlob, 'mask.png');

  const response = await fetch(
    `${providerBaseUrl}/v2beta/stable-image/edit/inpaint`,
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
  return {
    images: [`data:image/png;base64,${Buffer.from(buffer).toString('base64')}`],
  };
}

export async function POST(req: NextRequest) {
  try {
    const {
      providerId,
      providerName,
      modelId,
      prompt,
      image,
      mask,
      size,
      quality,
      n,
      negativePrompt,
      apiKey,
    } = await parseGenerationRequest(
      req,
      editGenerationRequestSchema,
      MAX_EDIT_REQUEST_BYTES,
    );

    let provider = providerId ? getProviderById(providerId) : null;
    if (!provider && providerName) {
      provider = PROVIDERS.find((candidate) => candidate.name === providerName) || null;
    }
    if (!provider) {
      return noStoreJson({
        error: 'Provider not found',
        code: 'provider_not_found',
      }, 404);
    }

    requireModelOperation(
      provider.name,
      modelId,
      mask ? 'inpaint' : 'edit',
      'edit',
    );

    let images: string[];
    switch (provider.name) {
      case 'openai':
        images = (await editOpenAI(
          { prompt, modelId, image, mask, size, quality, n },
          apiKey,
          provider.baseUrl,
        )).images;
        break;
      case 'stability':
        images = (await editStability(
          { prompt, image, mask, negativePrompt },
          apiKey,
          provider.baseUrl,
        )).images;
        break;
      default:
        return noStoreJson({
          error: `Image editing is not supported for ${provider.displayName}`,
          code: 'adapter_not_configured',
        }, 400);
    }

    return noStoreJson({ status: 'completed', images });
  } catch (error) {
    return generationErrorResponse(error, {
      logLabel: 'Edit image error',
      fallbackMessage: 'Failed to edit image',
    });
  }
}
