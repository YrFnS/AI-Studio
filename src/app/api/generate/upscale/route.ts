import { NextRequest, NextResponse } from 'next/server';
import { PROVIDERS } from '@/lib/providers-data';
import { encodeGenerationJobToken } from '@/lib/generation-job';
import { resolveImageBlob } from '@/lib/server/image-input';

export const runtime = 'nodejs';

async function getProviderById(id: string) {
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
  if (params.negativePrompt) formData.append('negative_prompt', params.negativePrompt);
  formData.append('image', imageBlob, 'image.png');
  formData.append('output_format', 'png');
  if (params.upscaleFactor === 4) formData.append('creativity', '0.5');

  const response = await fetch(`${providerBaseUrl}/v2beta/stable-image/upscale/creative`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'image/*',
    },
    body: formData,
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Stability Upscale API error: ${response.status} - ${error}`);
  }

  const buffer = await response.arrayBuffer();
  return {
    urls: [`data:image/png;base64,${Buffer.from(buffer).toString('base64')}`],
    status: 'completed' as const,
  };
}

async function upscaleReplicate(
  params: {
    imageUrl: string;
    prompt: string;
    negativePrompt?: string;
    modelId: string;
  },
  apiKey: string,
  providerBaseUrl: string,
) {
  const input: Record<string, unknown> = {
    prompt: params.prompt,
    image: params.imageUrl,
  };
  if (params.negativePrompt) input.negative_prompt = params.negativePrompt;

  const response = await fetch(`${providerBaseUrl}/v1/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: params.modelId, input }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Replicate Upscale API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return { jobId: data.id, status: 'processing' as const };
}

async function upscaleFal(
  params: {
    imageUrl: string;
    prompt: string;
    negativePrompt?: string;
    modelId: string;
  },
  apiKey: string,
  providerBaseUrl: string,
) {
  const body: Record<string, unknown> = {
    prompt: params.prompt,
    image_url: params.imageUrl,
  };
  if (params.negativePrompt) body.negative_prompt = params.negativePrompt;

  const response = await fetch(`${providerBaseUrl}/${params.modelId}/requests`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Fal.ai Upscale API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return { jobId: data.request_id, status: 'processing' as const };
}

async function upscaleOpenAI(
  params: {
    imageUrl: string;
    prompt: string;
    modelId: string;
    upscaleFactor: number;
  },
  apiKey: string,
  providerBaseUrl: string,
) {
  const imageBlob = await resolveImageBlob(params.imageUrl);
  const formData = new FormData();
  formData.append('prompt', `Upscale this image and preserve its composition and details: ${params.prompt}`);
  formData.append('image', imageBlob, 'image.png');
  formData.append('model', params.modelId || 'gpt-image-1');
  formData.append('size', params.upscaleFactor === 4 ? '2048x2048' : '1536x1536');
  formData.append('n', '1');

  const response = await fetch(`${providerBaseUrl}/images/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI Upscale API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    urls: (data.data || []).map((image: { url?: string; b64_json?: string }) => (
      image.url || `data:image/png;base64,${image.b64_json}`
    )),
    status: 'completed' as const,
  };
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

    if (!providerId || !imageUrl) {
      return json({ error: 'providerId and imageUrl are required' }, 400);
    }
    if (!apiKey) return json({ error: 'API key is required' }, 400);

    const provider = await getProviderById(providerId);
    if (!provider) return json({ error: 'Provider not found' }, 404);

    const factor = upscaleFactor === 4 ? 4 : 2;
    const upscalePrompt = prompt || 'Upscale this image, enhance details, and maintain the original composition';
    const effectiveModelId = modelId || 'gpt-image-1';

    let result:
      | { urls: string[]; status: 'completed' }
      | { jobId: string; status: 'processing' };

    switch (provider.name) {
      case 'stability':
        result = await upscaleStability({
          imageUrl,
          prompt: upscalePrompt,
          negativePrompt,
          upscaleFactor: factor,
        }, apiKey, provider.baseUrl);
        break;
      case 'replicate':
        result = await upscaleReplicate({
          imageUrl,
          prompt: upscalePrompt,
          negativePrompt,
          modelId: effectiveModelId,
        }, apiKey, provider.baseUrl);
        break;
      case 'fal':
        result = await upscaleFal({
          imageUrl,
          prompt: upscalePrompt,
          negativePrompt,
          modelId: effectiveModelId,
        }, apiKey, provider.baseUrl);
        break;
      case 'openai':
        result = await upscaleOpenAI({
          imageUrl,
          prompt: upscalePrompt,
          modelId: effectiveModelId,
          upscaleFactor: factor,
        }, apiKey, provider.baseUrl);
        break;
      default:
        throw new Error(`Image upscaling is not supported for provider: ${provider.displayName}`);
    }

    if (result.status === 'processing') {
      const jobToken = encodeGenerationJobToken({
        providerId: provider.id,
        modelId: effectiveModelId,
        jobId: result.jobId,
        kind: 'image',
      });
      return json({
        id: jobToken,
        jobId: jobToken,
        status: 'processing',
        message: 'Upscale in progress. Poll /api/generate/status for results.',
      });
    }

    return json({ status: 'completed', urls: result.urls });
  } catch (error) {
    console.error('Upscale image error:', error);
    return json({
      error: error instanceof Error ? error.message : 'Failed to upscale image',
    }, 500);
  }
}
