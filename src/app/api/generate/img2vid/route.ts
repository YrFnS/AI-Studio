import { NextRequest, NextResponse } from 'next/server';
import { PROVIDERS } from '@/lib/providers-data';

async function getProviderById(id: string) {
  return PROVIDERS.find((p) => p.id === id);
}

const I2V_PROVIDERS = ['runway', 'luma', 'fal', 'replicate', 'seedance'];

async function img2vidRunway(params: { prompt: string; model: string; duration: number; imageUrl: string; aspectRatio?: string }, apiKey: string) {
  const body: Record<string, unknown> = { model: params.model, promptText: params.prompt, promptImage: params.imageUrl };
  if (params.duration) body.duration = params.duration;
  const response = await fetch('https://api.dev.runwayml.com/v1/image_to_video', { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Runway-API-Version': '2024-11-06' }, body: JSON.stringify(body) });
  if (!response.ok) { const error = await response.text(); throw new Error(`Runway img2vid API error: ${response.status} - ${error}`); }
  const data = await response.json();
  return { jobId: data.id, status: 'processing' as const };
}

async function img2vidLuma(params: { prompt: string; imageUrl: string; aspectRatio?: string }, apiKey: string) {
  const body: Record<string, unknown> = { prompt: params.prompt, image_url: params.imageUrl, aspect_ratio: params.aspectRatio || '16:9' };
  const response = await fetch('https://api.lumalabs.ai/dream-machine/v1/generations', { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) { const error = await response.text(); throw new Error(`Luma img2vid API error: ${response.status} - ${error}`); }
  const data = await response.json();
  return { jobId: data.id, status: 'processing' as const };
}

async function img2vidFal(params: { prompt: string; model: string; imageUrl: string; duration: number }, apiKey: string) {
  const body: Record<string, unknown> = { prompt: params.prompt, image_url: params.imageUrl };
  if (params.duration) body.duration = params.duration;
  const response = await fetch(`https://queue.fal.run/${params.model}/requests`, { method: 'POST', headers: { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) { const error = await response.text(); throw new Error(`Fal.ai img2vid API error: ${response.status} - ${error}`); }
  const data = await response.json();
  return { jobId: data.request_id, status: 'processing' as const };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { providerId, modelId, imageUrl, prompt, apiKey, duration, aspectRatio } = body as {
      providerId?: string; modelId?: string; imageUrl?: string; prompt?: string; apiKey?: string; duration?: number; aspectRatio?: string;
    };

    if (!providerId || !imageUrl || !prompt) return NextResponse.json({ error: 'providerId, imageUrl, and prompt are required' }, { status: 400 });
    if (!apiKey) return NextResponse.json({ error: 'API key is required' }, { status: 400 });

    const provider = await getProviderById(providerId);
    if (!provider) return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    if (!I2V_PROVIDERS.includes(provider.name)) return NextResponse.json({ error: `Image-to-video not supported by ${provider.displayName}` }, { status: 400 });

    const videoDuration = Math.max(3, Math.min(10, duration || 5));
    let result: { jobId: string; status: 'processing' };

    switch (provider.name) {
      case 'runway': result = await img2vidRunway({ prompt, model: modelId || 'gen4-turbo', duration: videoDuration, imageUrl, aspectRatio }, apiKey); break;
      case 'luma': result = await img2vidLuma({ prompt, imageUrl, aspectRatio: aspectRatio || '16:9' }, apiKey); break;
      case 'fal': result = await img2vidFal({ prompt, model: modelId || 'fal-ai/kling-video/v1/standard', imageUrl, duration: videoDuration }, apiKey); break;
      default: throw new Error(`Image-to-video not supported for provider: ${provider.displayName}`);
    }

    return NextResponse.json({ id: result.jobId, status: 'processing', jobId: result.jobId, message: 'Image-to-video generation in progress. Poll /api/generate/status for results.' });
  } catch (error) {
    console.error('img2vid error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to generate video from image' }, { status: 500 });
  }
}
