import { NextRequest, NextResponse } from 'next/server';

import { PROVIDERS } from '@/lib/providers-data';
import { supportsGeneration } from '@/lib/provider-capabilities';
import { registerGenerationJob } from '@/lib/server-generation-store';

type AsyncVideoResult = {
  jobId: string;
  modelId?: string;
};

type VideoRequestParams = {
  prompt: string;
  model: string;
  duration: number;
  aspectRatio: string;
  imageUrl?: string;
  endImageUrl?: string;
};

function getProviderById(id: string) {
  return PROVIDERS.find((provider) => provider.id === id);
}

function normalizeDuration(value: unknown, fallback = 5): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function runwayRatio(aspectRatio: string): string {
  const ratios: Record<string, string> = {
    '16:9': '1280:720',
    '9:16': '720:1280',
    '1:1': '960:960',
    '4:3': '1104:832',
    '3:4': '832:1104',
  };
  return ratios[aspectRatio] || '1280:720';
}

async function generateRunwayVideo(
  params: VideoRequestParams,
  apiKey: string,
): Promise<AsyncVideoResult> {
  const hasImage = Boolean(params.imageUrl);
  if (!hasImage && params.model === 'gen4_turbo') {
    throw new Error('Runway Gen-4 Turbo requires a starting image. Use Gen-4.5 for text-to-video.');
  }

  const body: Record<string, unknown> = {
    model: params.model,
    promptText: params.prompt,
    duration: Math.min(10, Math.max(2, params.duration)),
    ratio: runwayRatio(params.aspectRatio),
  };
  if (params.imageUrl) body.promptImage = params.imageUrl;

  const endpoint = hasImage ? 'image_to_video' : 'text_to_video';
  const response = await fetch(`https://api.dev.runwayml.com/v1/${endpoint}`, {
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
    throw new Error(`Runway API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  if (!data.id) throw new Error('Runway did not return a task id');
  return { jobId: data.id, modelId: params.model };
}

async function generateLumaVideo(
  params: VideoRequestParams,
  apiKey: string,
): Promise<AsyncVideoResult> {
  const body: Record<string, unknown> = {
    prompt: params.prompt,
    aspect_ratio: params.aspectRatio || '16:9',
    model: params.model,
  };
  if (params.imageUrl) body.image_url = params.imageUrl;

  const response = await fetch(
    'https://api.lumalabs.ai/dream-machine/v1/generations',
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
    throw new Error(`Luma AI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  if (!data.id) throw new Error('Luma did not return a generation id');
  return { jobId: data.id, modelId: params.model };
}

function resolveFalEndpoint(model: string, imageUrl?: string): string {
  if (!imageUrl) return model;

  if (model === 'bytedance/seedance-2.0/text-to-video') {
    return 'bytedance/seedance-2.0/image-to-video';
  }
  if (model === 'bytedance/seedance-2.0/fast/text-to-video') {
    return 'bytedance/seedance-2.0/fast/image-to-video';
  }

  return model;
}

async function generateFalVideo(
  params: VideoRequestParams,
  apiKey: string,
): Promise<AsyncVideoResult> {
  const endpoint = resolveFalEndpoint(params.model, params.imageUrl);
  const body: Record<string, unknown> = {
    prompt: params.prompt,
    duration: String(Math.min(15, Math.max(4, params.duration))),
    aspect_ratio: params.aspectRatio || '16:9',
  };

  if (endpoint.includes('seedance-2.0')) {
    body.resolution = '720p';
    body.generate_audio = true;
  }
  if (params.imageUrl) body.image_url = params.imageUrl;
  if (params.endImageUrl) body.end_image_url = params.endImageUrl;

  const response = await fetch(`https://queue.fal.run/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Fal.ai video API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  if (!data.request_id) throw new Error('Fal.ai did not return a request id');
  return { jobId: data.request_id, modelId: endpoint };
}

async function generateReplicateVideo(
  params: VideoRequestParams,
  apiKey: string,
  providerBaseUrl: string,
): Promise<AsyncVideoResult> {
  const input: Record<string, unknown> = {
    prompt: params.prompt,
    duration: Math.min(15, Math.max(4, params.duration)),
    resolution: '720p',
    aspect_ratio: params.aspectRatio || '16:9',
    generate_audio: true,
  };
  if (params.imageUrl) input.image = params.imageUrl;
  if (params.endImageUrl && params.imageUrl) input.last_frame_image = params.endImageUrl;

  const response = await fetch(`${providerBaseUrl}/v1/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ version: params.model, input }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Replicate video API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  if (!data.id) throw new Error('Replicate did not return a prediction id');
  return { jobId: data.id, modelId: params.model };
}

function parseDataImage(value?: string): { mimeType: string; data: string } | null {
  if (!value) return null;
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

async function generateGoogleVeoVideo(
  params: VideoRequestParams,
  apiKey: string,
  providerBaseUrl: string,
): Promise<AsyncVideoResult> {
  const instance: Record<string, unknown> = { prompt: params.prompt };
  const image = parseDataImage(params.imageUrl);
  if (image) {
    instance.image = {
      bytesBase64Encoded: image.data,
      mimeType: image.mimeType,
    };
  } else if (params.imageUrl) {
    throw new Error('Google Veo image-to-video currently requires an uploaded image, not a remote URL.');
  }

  const body: Record<string, unknown> = {
    instances: [instance],
    parameters: {
      aspectRatio: params.aspectRatio === '9:16' ? '9:16' : '16:9',
      sampleCount: 1,
    },
  };

  const response = await fetch(
    `${providerBaseUrl}/models/${params.model}:predictLongRunning`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Veo API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  if (!data.name) throw new Error('Google Veo did not return an operation name');
  return { jobId: data.name, modelId: params.model };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      providerId,
      modelId,
      prompt,
      duration,
      aspectRatio,
      imageUrl,
      startFrameUrl,
      endFrameUrl,
      apiKey,
    } = body as {
      providerId?: string;
      modelId?: string;
      prompt?: string;
      duration?: number | string;
      aspectRatio?: string;
      imageUrl?: string;
      startFrameUrl?: string;
      endFrameUrl?: string;
      apiKey?: string;
    };

    if (!providerId || !modelId || !prompt) {
      return NextResponse.json(
        { error: 'providerId, modelId, and prompt are required' },
        { status: 400 },
      );
    }
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required. Please configure your API key in Settings.' },
        { status: 400 },
      );
    }

    const provider = getProviderById(providerId);
    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }
    if (!supportsGeneration(provider.name, 'video')) {
      return NextResponse.json(
        { error: `Video generation is not supported for ${provider.displayName}` },
        { status: 400 },
      );
    }

    const params: VideoRequestParams = {
      prompt,
      model: modelId,
      duration: normalizeDuration(duration),
      aspectRatio: aspectRatio || '16:9',
      imageUrl: startFrameUrl || imageUrl,
      endImageUrl: endFrameUrl,
    };

    let result: AsyncVideoResult;
    switch (provider.name) {
      case 'replicate':
        result = await generateReplicateVideo(params, apiKey, provider.baseUrl);
        break;
      case 'fal':
        result = await generateFalVideo(params, apiKey);
        break;
      case 'runway':
        result = await generateRunwayVideo(params, apiKey);
        break;
      case 'luma':
        result = await generateLumaVideo(params, apiKey);
        break;
      case 'google-aistudio':
        result = await generateGoogleVeoVideo(params, apiKey, provider.baseUrl);
        break;
      default:
        return NextResponse.json(
          { error: `No video adapter is configured for ${provider.displayName}` },
          { status: 400 },
        );
    }

    const localJobId = registerGenerationJob({
      provider: provider.name,
      providerJobId: result.jobId,
      modelId: result.modelId || modelId,
      apiKey,
    });

    return NextResponse.json({
      id: localJobId,
      jobId: localJobId,
      localJob: true,
      status: 'processing',
      message: 'Video generation in progress. Poll /api/generate/status for results.',
    });
  } catch (error) {
    console.error('Generate video error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate video' },
      { status: 500 },
    );
  }
}
