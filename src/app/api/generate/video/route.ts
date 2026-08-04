import { NextRequest, NextResponse } from 'next/server';
import { PROVIDERS } from '@/lib/providers-data';
import { encodeGenerationJobToken } from '@/lib/generation-job';

export const runtime = 'nodejs';

type ProcessingResult = { jobId: string; status: 'processing' };
type CompletedResult = { urls: string[]; status: 'completed' };
type VideoGenerationResult = ProcessingResult | CompletedResult;

async function getProviderById(id: string) {
  return PROVIDERS.find((provider) => provider.id === id);
}

function json(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function generateRunwayVideo(
  params: { prompt: string; model: string; duration: number; ratio: string; imageUrl?: string },
  apiKey: string,
): Promise<ProcessingResult> {
  const body: Record<string, unknown> = {
    model: params.model,
    promptText: params.prompt,
  };
  if (params.duration) body.duration = params.duration;
  if (params.ratio) body.ratio = params.ratio;
  if (params.imageUrl) body.promptImage = params.imageUrl;

  const response = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Runway-API-Version': '2024-11-06',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Runway API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return { jobId: data.id, status: 'processing' };
}

async function generateLumaVideo(
  params: { prompt: string; aspectRatio: string; imageUrl?: string },
  apiKey: string,
): Promise<ProcessingResult> {
  const body: Record<string, unknown> = {
    prompt: params.prompt,
    aspect_ratio: params.aspectRatio || '16:9',
  };
  if (params.imageUrl) body.image_url = params.imageUrl;

  const response = await fetch('https://api.lumalabs.ai/dream-machine/v1/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Luma AI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return { jobId: data.id, status: 'processing' };
}

async function generateFalVideo(
  params: { prompt: string; model: string; imageUrl?: string },
  apiKey: string,
): Promise<ProcessingResult> {
  const body: Record<string, unknown> = { prompt: params.prompt };
  if (params.imageUrl) body.image_url = params.imageUrl;

  const response = await fetch(`https://queue.fal.run/${params.model}/requests`, {
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
  return { jobId: data.request_id, status: 'processing' };
}

async function generateGoogleVeoVideo(
  params: { prompt: string; model: string; aspectRatio?: string; imageUrl?: string; duration?: number },
  apiKey: string,
): Promise<VideoGenerationResult> {
  const instance: Record<string, unknown> = { prompt: params.prompt };
  if (params.imageUrl) {
    const base64Data = params.imageUrl.includes(',')
      ? params.imageUrl.split(',')[1]
      : params.imageUrl;
    instance.image = { bytesBase64Encoded: base64Data };
  }

  const body = {
    instances: [instance],
    parameters: {
      aspectRatio: params.aspectRatio || '16:9',
      sampleCount: 1,
      durationSeconds: params.duration,
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:predict`,
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
    throw new Error(`Google AI Studio (Veo) API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const directBytes = data.predictions?.[0]?.bytesBase64Encoded;
  if (directBytes) {
    return {
      status: 'completed',
      urls: [`data:video/mp4;base64,${directBytes}`],
    };
  }

  const operationName = data.predictions?.[0]?.videoName || data.name;
  if (operationName) return { jobId: operationName, status: 'processing' };

  throw new Error('Google Veo did not return a video or operation reference');
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
      apiKey,
    } = body as {
      providerId?: string;
      modelId?: string;
      prompt?: string;
      duration?: number | string;
      aspectRatio?: string;
      imageUrl?: string;
      startFrameUrl?: string;
      apiKey?: string;
    };

    if (!providerId || !modelId || !prompt) {
      return json({ error: 'providerId, modelId, and prompt are required' }, 400);
    }
    if (!apiKey) {
      return json({ error: 'API key is required. Please configure your API key in Settings.' }, 400);
    }

    const provider = await getProviderById(providerId);
    if (!provider) return json({ error: 'Provider not found' }, 404);

    const sourceImage = imageUrl || startFrameUrl;
    const parsedDuration = Number.parseInt(String(duration || 5), 10) || 5;

    let result: VideoGenerationResult;
    switch (provider.name) {
      case 'runway':
        result = await generateRunwayVideo({
          prompt,
          model: modelId,
          duration: parsedDuration,
          ratio: aspectRatio || '16:9',
          imageUrl: sourceImage,
        }, apiKey);
        break;
      case 'luma':
        result = await generateLumaVideo({
          prompt,
          aspectRatio: aspectRatio || '16:9',
          imageUrl: sourceImage,
        }, apiKey);
        break;
      case 'fal':
        result = await generateFalVideo({
          prompt,
          model: modelId,
          imageUrl: sourceImage,
        }, apiKey);
        break;
      case 'google':
      case 'google-aistudio':
        result = await generateGoogleVeoVideo({
          prompt,
          model: modelId,
          aspectRatio: aspectRatio || '16:9',
          imageUrl: sourceImage,
          duration: parsedDuration,
        }, apiKey);
        break;
      case 'google-vertex':
        throw new Error('Google Vertex video generation requires project, location, and OAuth configuration and is not supported by the BYOK API-key flow yet.');
      default:
        throw new Error(`Video generation is not supported for provider: ${provider.displayName}`);
    }

    if (result.status === 'completed') {
      return json({ status: 'completed', urls: result.urls });
    }

    const jobToken = encodeGenerationJobToken({
      providerId: provider.id,
      modelId,
      jobId: result.jobId,
      kind: 'video',
    });

    return json({
      id: jobToken,
      jobId: jobToken,
      status: 'processing',
      message: 'Video generation in progress. Poll /api/generate/status for results.',
    });
  } catch (error) {
    console.error('Generate video error:', error);
    return json({
      error: error instanceof Error ? error.message : 'Failed to generate video',
    }, 500);
  }
}
