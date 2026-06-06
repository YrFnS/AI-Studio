import { NextRequest, NextResponse } from 'next/server';
import { PROVIDERS } from '@/lib/providers-data';

async function getProviderById(id: string) {
  return PROVIDERS.find((p) => p.id === id);
}

// Runway video generation
async function generateRunwayVideo(params: { prompt: string; model: string; duration: number; ratio: string; imageUrl?: string }, apiKey: string) {
  const body: Record<string, unknown> = { model: params.model, promptText: params.prompt };
  if (params.duration) body.duration = params.duration;
  if (params.ratio) body.ratio = params.ratio;
  if (params.imageUrl) body.promptImage = params.imageUrl;
  const response = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Runway-API-Version': '2024-11-06' },
    body: JSON.stringify(body),
  });
  if (!response.ok) { const error = await response.text(); throw new Error(`Runway API error: ${response.status} - ${error}`); }
  const data = await response.json();
  return { jobId: data.id, status: 'processing' };
}

// Luma AI video generation
async function generateLumaVideo(params: { prompt: string; aspectRatio: string; imageUrl?: string }, apiKey: string) {
  const body: Record<string, unknown> = { prompt: params.prompt, aspect_ratio: params.aspectRatio || '16:9' };
  if (params.imageUrl) body.image_url = params.imageUrl;
  const response = await fetch('https://api.lumalabs.ai/dream-machine/v1/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) { const error = await response.text(); throw new Error(`Luma AI API error: ${response.status} - ${error}`); }
  const data = await response.json();
  return { jobId: data.id, status: 'processing' };
}

// Fal.ai video generation
async function generateFalVideo(params: { prompt: string; model: string; imageUrl?: string; [key: string]: unknown }, apiKey: string) {
  const body: Record<string, unknown> = { prompt: params.prompt };
  if (params.imageUrl) body.image_url = params.imageUrl;
  const response = await fetch(`https://queue.fal.run/${params.model}/requests`, {
    method: 'POST',
    headers: { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) { const error = await response.text(); throw new Error(`Fal.ai video API error: ${response.status} - ${error}`); }
  const data = await response.json();
  return { jobId: data.request_id, status: 'processing' };
}

// Google AI Studio (Veo) video generation
async function generateGoogleVeoVideo(params: { prompt: string; model: string; aspectRatio?: string; imageUrl?: string; duration?: number }, apiKey: string) {
  const body: Record<string, unknown> = { instances: [{ prompt: params.prompt }], parameters: { aspectRatio: params.aspectRatio || '16:9', sampleCount: 1 } };
  if (params.imageUrl) { const base64Data = params.imageUrl.includes(',') ? params.imageUrl.split(',')[1] : params.imageUrl; (body.instances as Array<Record<string, unknown>>)[0].image = { bytesBase64Encoded: base64Data }; }
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${params.model}:predict`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) { const error = await response.text(); throw new Error(`Google AI Studio (Veo) API error: ${response.status} - ${error}`); }
  const data = await response.json();
  const videoName = data.predictions?.[0]?.videoName || data.name;
  if (videoName) return { jobId: videoName, status: 'processing' };
  if (data.predictions?.[0]?.bytesBase64Encoded) return { jobId: `direct-${Date.now()}`, status: 'completed' };
  throw new Error('Google Veo: No video reference returned from API');
}

// Google Vertex AI (Veo) video generation
async function generateGoogleVertexVeoVideo(params: { prompt: string; model: string; aspectRatio?: string; imageUrl?: string; duration?: number }, accessToken: string, providerBaseUrl: string) {
  const body: Record<string, unknown> = { instances: [{ prompt: params.prompt }], parameters: { aspectRatio: params.aspectRatio || '16:9', sampleCount: 1 } };
  if (params.imageUrl) { const base64Data = params.imageUrl.includes(',') ? params.imageUrl.split(',')[1] : params.imageUrl; (body.instances as Array<Record<string, unknown>>)[0].image = { bytesBase64Encoded: base64Data }; }
  const endpoint = `${providerBaseUrl}/publishers/google/models/${params.model}:predict`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) { const error = await response.text(); throw new Error(`Google Vertex AI (Veo) API error: ${response.status} - ${error}`); }
  const data = await response.json();
  const videoName = data.predictions?.[0]?.videoName || data.name;
  if (videoName) return { jobId: videoName, status: 'processing' };
  if (data.predictions?.[0]?.bytesBase64Encoded) return { jobId: `direct-${Date.now()}`, status: 'completed' };
  throw new Error('Google Vertex AI Veo: No video reference returned from API');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { providerId, modelId, prompt, duration, aspectRatio, imageUrl, apiKey } = body;
    if (!providerId || !modelId || !prompt) return NextResponse.json({ error: 'providerId, modelId, and prompt are required' }, { status: 400 });
    if (!apiKey) return NextResponse.json({ error: 'API key is required. Please configure your API key in Settings.' }, { status: 400 });

    const provider = await getProviderById(providerId);
    if (!provider) return NextResponse.json({ error: 'Provider not found' }, { status: 404 });

    let result: { jobId: string; status: string };
    switch (provider.name) {
      case 'runway': result = await generateRunwayVideo({ prompt, model: modelId, duration: parseInt(duration) || 5, ratio: aspectRatio || '16:9', imageUrl }, apiKey); break;
      case 'luma': result = await generateLumaVideo({ prompt, aspectRatio: aspectRatio || '16:9', imageUrl }, apiKey); break;
      case 'fal': result = await generateFalVideo({ prompt, model: modelId, imageUrl }, apiKey); break;
      case 'google': result = await generateGoogleVeoVideo({ prompt, model: modelId, aspectRatio: aspectRatio || '16:9', imageUrl, duration: parseInt(duration) || 5 }, apiKey); break;
      case 'google-aistudio': result = await generateGoogleVeoVideo({ prompt, model: modelId, aspectRatio: aspectRatio || '16:9', imageUrl, duration: parseInt(duration) || 5 }, apiKey); break;
      case 'google-vertex': result = await generateGoogleVertexVeoVideo({ prompt, model: modelId, aspectRatio: aspectRatio || '16:9', imageUrl, duration: parseInt(duration) || 5 }, apiKey, provider.baseUrl); break;
      default: throw new Error(`Video generation not supported for provider: ${provider.displayName}`);
    }

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
