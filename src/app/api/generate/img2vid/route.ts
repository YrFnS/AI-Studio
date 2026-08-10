import { NextRequest, NextResponse } from 'next/server';

import { encodeGenerationJobToken } from '@/lib/generation-job';
import { PROVIDERS } from '@/lib/providers-data';
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

function runwayRatio(aspectRatio?: string): string {
  const ratios: Record<string, string> = {
    '16:9': '1280:720',
    '9:16': '720:1280',
    '1:1': '960:960',
    '4:3': '1104:832',
    '3:4': '832:1104',
  };
  return ratios[aspectRatio || '16:9'] || '1280:720';
}

function resolveFalImageToVideoEndpoint(modelId: string): string {
  if (modelId === 'bytedance/seedance-2.0/text-to-video') {
    return 'bytedance/seedance-2.0/image-to-video';
  }
  if (modelId === 'bytedance/seedance-2.0/fast/text-to-video') {
    return 'bytedance/seedance-2.0/fast/image-to-video';
  }
  return modelId;
}

async function img2vidRunway(
  params: {
    prompt: string;
    model: string;
    duration: number;
    imageUrl: string;
    aspectRatio?: string;
  },
  apiKey: string,
) {
  const body: Record<string, unknown> = {
    model: params.model,
    promptText: params.prompt,
    promptImage: params.imageUrl,
    duration: params.duration,
    ratio: runwayRatio(params.aspectRatio),
  };

  const response = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Runway-Version': '2024-11-06',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Runway img2vid API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  if (!data.id) throw new Error('Runway did not return a task id');
  return { jobId: data.id, status: 'processing' as const };
}

async function img2vidLuma(
  params: {
    prompt: string;
    imageUrl: string;
    aspectRatio?: string;
    model: string;
    duration: number;
  },
  apiKey: string,
) {
  if (params.imageUrl.startsWith('data:')) {
    throw new Error('Luma image-to-video requires a public HTTPS image URL.');
  }

  const maxDuration = params.model === 'ray-flash-2' ? 15 : 10;
  const body: Record<string, unknown> = {
    generation_type: 'video',
    prompt: params.prompt,
    aspect_ratio: params.aspectRatio || '16:9',
    model: params.model,
    resolution: '720p',
    duration: `${Math.min(maxDuration, Math.max(5, params.duration))}s`,
    keyframes: {
      frame0: { type: 'image', url: params.imageUrl },
    },
  };

  const response = await fetch(
    'https://api.lumalabs.ai/dream-machine/v1/generations/video',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Luma img2vid API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  if (!data.id) throw new Error('Luma did not return a generation id');
  return { jobId: data.id, status: 'processing' as const };
}

async function img2vidFal(
  params: {
    prompt: string;
    endpoint: string;
    imageUrl: string;
    duration: number;
    aspectRatio?: string;
  },
  apiKey: string,
) {
  const body: Record<string, unknown> = {
    prompt: params.prompt,
    image_url: params.imageUrl,
    duration: String(params.duration),
    aspect_ratio: params.aspectRatio || '16:9',
  };

  if (params.endpoint.includes('seedance-2.0')) {
    body.resolution = '720p';
    body.generate_audio = true;
  }

  const response = await fetch(`https://queue.fal.run/${params.endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Fal.ai img2vid API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  if (!data.request_id) throw new Error('Fal.ai did not return a request id');
  return { jobId: data.request_id, status: 'processing' as const };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      providerId,
      modelId,
      imageUrl,
      prompt,
      apiKey,
      duration,
      aspectRatio,
    } = body as {
      providerId?: string;
      modelId?: string;
      imageUrl?: string;
      prompt?: string;
      apiKey?: string;
      duration?: number;
      aspectRatio?: string;
    };

    if (!providerId || !modelId || !imageUrl || !prompt) {
      return json({
        error: 'providerId, modelId, imageUrl, and prompt are required',
      }, 400);
    }
    if (!apiKey) return json({ error: 'API key is required' }, 400);

    const provider = getProviderById(providerId);
    if (!provider) return json({ error: 'Provider not found' }, 404);

    requireModelOperation(
      provider.name,
      modelId,
      'image-to-video',
      'img2vid',
    );

    const videoDuration = Math.max(3, Math.min(10, duration || 5));
    let pollingModelId = modelId;
    let result: { jobId: string; status: 'processing' };

    switch (provider.name) {
      case 'runway':
        result = await img2vidRunway({
          prompt,
          model: modelId,
          duration: videoDuration,
          imageUrl,
          aspectRatio,
        }, apiKey);
        break;
      case 'luma':
        result = await img2vidLuma({
          prompt,
          imageUrl,
          aspectRatio,
          model: modelId,
          duration: videoDuration,
        }, apiKey);
        break;
      case 'fal': {
        const endpoint = resolveFalImageToVideoEndpoint(modelId);
        pollingModelId = endpoint;
        result = await img2vidFal({
          prompt,
          endpoint,
          imageUrl,
          duration: videoDuration,
          aspectRatio,
        }, apiKey);
        break;
      }
      default:
        return json({
          error: `No registered image-to-video adapter is available for ${provider.displayName}.`,
        }, 400);
    }

    const localJobId = encodeGenerationJobToken({
      providerId: provider.name,
      jobId: result.jobId,
      modelId: pollingModelId,
      kind: 'video',
    });

    return json({
      id: localJobId,
      jobId: localJobId,
      localJob: true,
      status: 'processing',
      message: 'Image-to-video generation in progress. Poll /api/generate/status for results.',
    });
  } catch (error) {
    if (error instanceof GenerationRegistryError) {
      return json({ error: error.message, code: error.code }, error.status);
    }

    console.error('img2vid error:', error);
    return json({
      error: error instanceof Error ? error.message : 'Failed to generate video from image',
    }, 500);
  }
}
