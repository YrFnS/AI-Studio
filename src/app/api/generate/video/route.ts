import { NextRequest, NextResponse } from 'next/server';
import { PROVIDERS } from '@/lib/providers-data';

async function getProviderById(id: string) {
  return PROVIDERS.find((provider) => provider.id === id);
}

type AsyncResult = { jobId: string; status: 'processing' };
type CompletedResult = { urls: string[]; status: 'completed' };
type VideoResult = AsyncResult | CompletedResult;

async function generateRunwayVideo(
  params: { prompt: string; model: string; duration: number; ratio: string; imageUrl?: string },
  apiKey: string,
): Promise<AsyncResult> {
  const body: Record<string, unknown> = { model: params.model, promptText: params.prompt };
  if (params.duration) body.duration = params.duration;
  if (params.ratio) body.ratio = params.ratio;
  if (params.imageUrl) body.promptImage = params.imageUrl;
  const response = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Runway-API-Version': '2024-11-06' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Runway API error: ${response.status} - ${await response.text()}`);
  const data = await response.json();
  return { jobId: data.id, status: 'processing' };
}

async function generateLumaVideo(
  params: { prompt: string; aspectRatio: string; imageUrl?: string },
  apiKey: string,
): Promise<AsyncResult> {
  const body: Record<string, unknown> = { prompt: params.prompt, aspect_ratio: params.aspectRatio || '16:9' };
  if (params.imageUrl) body.image_url = params.imageUrl;
  const response = await fetch('https://api.lumalabs.ai/dream-machine/v1/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Luma AI API error: ${response.status} - ${await response.text()}`);
  const data = await response.json();
  return { jobId: data.id, status: 'processing' };
}

async function generateFalVideo(
  params: { prompt: string; model: string; imageUrl?: string },
  apiKey: string,
): Promise<AsyncResult> {
  const body: Record<string, unknown> = { prompt: params.prompt };
  if (params.imageUrl) body.image_url = params.imageUrl;
  const response = await fetch(`https://queue.fal.run/${params.model}/requests`, {
    method: 'POST',
    headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Fal.ai video API error: ${response.status} - ${await response.text()}`);
  const data = await response.json();
  return { jobId: data.request_id, status: 'processing' };
}

async function generateGoogleVeoVideo(
  params: { prompt: string; model: string; aspectRatio?: string; imageUrl?: string },
  apiKey: string,
): Promise<VideoResult> {
  const instance: Record<string, unknown> = { prompt: params.prompt };
  if (params.imageUrl) {
    const base64Data = params.imageUrl.includes(',') ? params.imageUrl.split(',')[1] : params.imageUrl;
    instance.image = { bytesBase64Encoded: base64Data };
  }
  const body = {
    instances: [instance],
    parameters: { aspectRatio: params.aspectRatio || '16:9', sampleCount: 1 },
  };
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${params.model}:predict`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Google AI Studio (Veo) API error: ${response.status} - ${await response.text()}`);
  const data = await response.json();
  const videoName = data.predictions?.[0]?.videoName || data.name;
  if (videoName) return { jobId: videoName, status: 'processing' };
  const bytes = data.predictions?.[0]?.bytesBase64Encoded;
  if (bytes) return { urls: [`data:video/mp4;base64,${bytes}`], status: 'completed' };
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
    } = body;

    if (!providerId || !modelId || !prompt) {
      return NextResponse.json({ error: 'providerId, modelId, and prompt are required' }, { status: 400 });
    }
    if (!apiKey) return NextResponse.json({ error: 'API key is required. Please configure your API key in Settings.' }, { status: 400 });

    const provider = await getProviderById(providerId);
    if (!provider) return NextResponse.json({ error: 'Provider not found' }, { status: 404 });

    const referenceImage = imageUrl || startFrameUrl || undefined;
    const parsedDuration = Number.parseInt(String(duration || 5), 10) || 5;
    let result: VideoResult;

    switch (provider.name) {
      case 'runway':
        result = await generateRunwayVideo({ prompt, model: modelId, duration: parsedDuration, ratio: aspectRatio || '16:9', imageUrl: referenceImage }, apiKey);
        break;
      case 'luma':
        result = await generateLumaVideo({ prompt, aspectRatio: aspectRatio || '16:9', imageUrl: referenceImage }, apiKey);
        break;
      case 'fal':
        result = await generateFalVideo({ prompt, model: modelId, imageUrl: referenceImage }, apiKey);
        break;
      case 'google':
      case 'google-aistudio':
        result = await generateGoogleVeoVideo({ prompt, model: modelId, aspectRatio: aspectRatio || '16:9', imageUrl: referenceImage }, apiKey);
        break;
      case 'google-vertex':
        throw new Error('Google Vertex video generation requires project and location configuration and is not supported by the browser-key flow.');
      default:
        throw new Error(`Video generation is not supported for provider: ${provider.displayName}`);
    }

    if (result.status === 'completed') return NextResponse.json(result);
    return NextResponse.json({
      id: result.jobId,
      status: 'processing',
      jobId: result.jobId,
      message: 'Video generation in progress. Poll /api/generate/status for results.',
    });
  } catch (error) {
    console.error('Generate video error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to generate video' }, { status: 500 });
  }
}
