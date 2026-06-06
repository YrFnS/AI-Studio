import { NextRequest, NextResponse } from 'next/server';
import { PROVIDERS } from '@/lib/providers-data';

async function getProviderById(id: string) {
  return PROVIDERS.find((p) => p.id === id);
}

function base64ToBlob(base64: string, contentType = 'image/png'): Blob {
  const raw = base64.includes(',') ? base64.split(',')[1] : base64;
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

async function imageUrlToBlob(imageUrl: string): Promise<Blob> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
  return response.blob();
}

async function resolveImageBlob(imageUrl: string): Promise<Blob> {
  if (imageUrl.startsWith('data:')) return base64ToBlob(imageUrl);
  return imageUrlToBlob(imageUrl);
}

async function upscaleStability(params: { imageUrl: string; prompt: string; negativePrompt?: string; upscaleFactor: number }, apiKey: string, providerBaseUrl: string) {
  const imageBlob = await resolveImageBlob(params.imageUrl);
  const formData = new FormData();
  formData.append('prompt', params.prompt);
  if (params.negativePrompt) formData.append('negative_prompt', params.negativePrompt);
  formData.append('image', imageBlob, 'image.png');
  formData.append('output_format', 'png');
  if (params.upscaleFactor === 4) formData.append('creativity', '0.5');
  const response = await fetch(`${providerBaseUrl}/v2beta/stable-image/upscale/creative`, { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'image/*' }, body: formData });
  if (!response.ok) { const error = await response.text(); throw new Error(`Stability Upscale API error: ${response.status} - ${error}`); }
  const buffer = await response.arrayBuffer();
  return { urls: [`data:image/png;base64,${Buffer.from(buffer).toString('base64')}`], status: 'completed' as const };
}

async function upscaleReplicate(params: { imageUrl: string; prompt: string; negativePrompt?: string; upscaleFactor: number; modelId: string }, apiKey: string, providerBaseUrl: string) {
  const input: Record<string, unknown> = { prompt: params.prompt, image: params.imageUrl };
  if (params.negativePrompt) input.negative_prompt = params.negativePrompt;
  const response = await fetch(`${providerBaseUrl}/v1/predictions`, { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: params.modelId, input }) });
  if (!response.ok) { const error = await response.text(); throw new Error(`Replicate Upscale API error: ${response.status} - ${error}`); }
  const data = await response.json();
  return { jobId: data.id, status: 'processing' as const };
}

async function upscaleFal(params: { imageUrl: string; prompt: string; negativePrompt?: string; upscaleFactor: number; modelId: string }, apiKey: string, providerBaseUrl: string) {
  const body: Record<string, unknown> = { prompt: params.prompt, image_url: params.imageUrl };
  if (params.negativePrompt) body.negative_prompt = params.negativePrompt;
  const response = await fetch(`${providerBaseUrl}/${params.modelId}/requests`, { method: 'POST', headers: { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) { const error = await response.text(); throw new Error(`Fal.ai Upscale API error: ${response.status} - ${error}`); }
  const data = await response.json();
  return { jobId: data.request_id, status: 'processing' as const };
}

async function upscaleOpenAI(params: { imageUrl: string; prompt: string; modelId: string; upscaleFactor: number }, apiKey: string, providerBaseUrl: string) {
  const imageBlob = await resolveImageBlob(params.imageUrl);
  const formData = new FormData();
  formData.append('prompt', `upscale this image to higher resolution, preserve all details: ${params.prompt}`);
  formData.append('image', imageBlob, 'image.png');
  formData.append('model', params.modelId || 'gpt-image-1');
  formData.append('size', params.upscaleFactor === 4 ? '2048x2048' : '1536x1536');
  formData.append('n', '1');
  const response = await fetch(`${providerBaseUrl}/images/edits`, { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}` }, body: formData });
  if (!response.ok) { const error = await response.text(); throw new Error(`OpenAI Upscale API error: ${response.status} - ${error}`); }
  const data = await response.json();
  return { urls: (data.data || []).map((img: { url?: string; b64_json?: string }) => img.url || `data:image/png;base64,${img.b64_json}`), status: 'completed' as const };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { providerId, modelId, imageUrl, prompt, negativePrompt, apiKey, upscaleFactor } = body as {
      providerId?: string; modelId?: string; imageUrl?: string; prompt?: string; negativePrompt?: string; apiKey?: string; upscaleFactor?: number;
    };

    if (!providerId || !imageUrl) return NextResponse.json({ error: 'providerId and imageUrl are required' }, { status: 400 });
    if (!apiKey) return NextResponse.json({ error: 'API key is required' }, { status: 400 });

    const provider = await getProviderById(providerId);
    if (!provider) return NextResponse.json({ error: 'Provider not found' }, { status: 404 });

    const factor = upscaleFactor || 2;
    const upscalePrompt = prompt || 'upscale this image, enhance details, maintain original composition';

    let result: { urls: string[]; status: 'completed' } | { jobId: string; status: 'processing' };
    switch (provider.name) {
      case 'stability': result = await upscaleStability({ imageUrl, prompt: upscalePrompt, negativePrompt, upscaleFactor: factor }, apiKey, provider.baseUrl); break;
      case 'replicate': result = await upscaleReplicate({ imageUrl, prompt: upscalePrompt, negativePrompt, upscaleFactor: factor, modelId: modelId || '' }, apiKey, provider.baseUrl); break;
      case 'fal': result = await upscaleFal({ imageUrl, prompt: upscalePrompt, negativePrompt, upscaleFactor: factor, modelId: modelId || '' }, apiKey, provider.baseUrl); break;
      default: result = await upscaleOpenAI({ imageUrl, prompt: upscalePrompt, modelId: modelId || '', upscaleFactor: factor }, apiKey, provider.baseUrl);
    }

    if (!('urls' in result) && 'jobId' in result) {
      return NextResponse.json({ id: result.jobId, status: 'processing', jobId: result.jobId, message: 'Upscale in progress. Poll /api/generate/status for results.' });
    }
    const urls = (result as { urls: string[] }).urls;
    return NextResponse.json({ status: 'completed', urls });
  } catch (error) {
    console.error('Upscale image error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to upscale image' }, { status: 500 });
  }
}
