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

async function variationStability(params: { imageUrl: string; prompt: string; negativePrompt?: string; variationStrength: number; modelId: string; seed?: number }, apiKey: string, providerBaseUrl: string) {
  const imageBlob = await resolveImageBlob(params.imageUrl);
  const formData = new FormData();
  formData.append('prompt', params.prompt);
  if (params.negativePrompt) formData.append('negative_prompt', params.negativePrompt);
  formData.append('image', imageBlob, 'image.png');
  formData.append('strength', params.variationStrength.toString());
  formData.append('output_format', 'png');
  if (params.seed) formData.append('seed', params.seed.toString());
  const response = await fetch(`${providerBaseUrl}/v2beta/stable-image/generate/sd3`, { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'image/*' }, body: formData });
  if (!response.ok) { const error = await response.text(); throw new Error(`Stability Variation API error: ${response.status} - ${error}`); }
  const buffer = await response.arrayBuffer();
  return { urls: [`data:image/png;base64,${Buffer.from(buffer).toString('base64')}`], status: 'completed' as const };
}

async function variationReplicate(params: { imageUrl: string; prompt: string; negativePrompt?: string; variationStrength: number; modelId: string; seed?: number }, apiKey: string, providerBaseUrl: string) {
  const input: Record<string, unknown> = { prompt: params.prompt, image: params.imageUrl, strength: params.variationStrength, num_outputs: 1 };
  if (params.negativePrompt) input.negative_prompt = params.negativePrompt;
  if (params.seed) input.seed = params.seed;
  const response = await fetch(`${providerBaseUrl}/v1/predictions`, { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: params.modelId, input }) });
  if (!response.ok) { const error = await response.text(); throw new Error(`Replicate Variation API error: ${response.status} - ${error}`); }
  const data = await response.json();
  return { jobId: data.id, status: 'processing' as const };
}

async function variationFal(params: { imageUrl: string; prompt: string; negativePrompt?: string; variationStrength: number; modelId: string; seed?: number }, apiKey: string, providerBaseUrl: string) {
  const body: Record<string, unknown> = { prompt: params.prompt, image_url: params.imageUrl, strength: params.variationStrength };
  if (params.negativePrompt) body.negative_prompt = params.negativePrompt;
  if (params.seed) body.seed = params.seed;
  const response = await fetch(`${providerBaseUrl}/${params.modelId}/requests`, { method: 'POST', headers: { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) { const error = await response.text(); throw new Error(`Fal.ai Variation API error: ${response.status} - ${error}`); }
  const data = await response.json();
  return { jobId: data.request_id, status: 'processing' as const };
}

async function variationOpenAI(params: { imageUrl: string; prompt: string; modelId: string; variationStrength: number }, apiKey: string, providerBaseUrl: string) {
  const imageBlob = await resolveImageBlob(params.imageUrl);
  const formData = new FormData();
  formData.append('prompt', params.prompt);
  formData.append('image', imageBlob, 'image.png');
  formData.append('model', params.modelId || 'gpt-image-1');
  formData.append('n', '1');
  const response = await fetch(`${providerBaseUrl}/images/edits`, { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}` }, body: formData });
  if (!response.ok) { const error = await response.text(); throw new Error(`OpenAI Variation API error: ${response.status} - ${error}`); }
  const data = await response.json();
  return { urls: (data.data || []).map((img: { url?: string; b64_json?: string }) => img.url || `data:image/png;base64,${img.b64_json}`), status: 'completed' as const };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { providerId, modelId, imageUrl, prompt, negativePrompt, apiKey, variationStrength, seed } = body as {
      providerId?: string; modelId?: string; imageUrl?: string; prompt?: string; negativePrompt?: string; apiKey?: string; variationStrength?: number; seed?: number;
    };

    if (!providerId || !imageUrl || !prompt) return NextResponse.json({ error: 'providerId, imageUrl, and prompt are required' }, { status: 400 });
    if (!apiKey) return NextResponse.json({ error: 'API key is required' }, { status: 400 });

    const provider = await getProviderById(providerId);
    if (!provider) return NextResponse.json({ error: 'Provider not found' }, { status: 404 });

    const strength = Math.max(0.3, Math.min(1.0, variationStrength ?? 0.7));

    let result: { urls: string[]; status: 'completed' } | { jobId: string; status: 'processing' };
    switch (provider.name) {
      case 'stability': result = await variationStability({ imageUrl, prompt, negativePrompt, variationStrength: strength, modelId: modelId || 'stable-diffusion-3.5-large', seed }, apiKey, provider.baseUrl); break;
      case 'replicate': result = await variationReplicate({ imageUrl, prompt, negativePrompt, variationStrength: strength, modelId: modelId || '', seed }, apiKey, provider.baseUrl); break;
      case 'fal': result = await variationFal({ imageUrl, prompt, negativePrompt, variationStrength: strength, modelId: modelId || '', seed }, apiKey, provider.baseUrl); break;
      default: result = await variationOpenAI({ imageUrl, prompt, modelId: modelId || '', variationStrength: strength }, apiKey, provider.baseUrl);
    }

    if (!('urls' in result) && 'jobId' in result) {
      return NextResponse.json({ id: result.jobId, status: 'processing', jobId: result.jobId, message: 'Variation in progress. Poll /api/generate/status for results.' });
    }
    const urls = (result as { urls: string[] }).urls;
    return NextResponse.json({ status: 'completed', urls });
  } catch (error) {
    console.error('Variation image error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create variation' }, { status: 500 });
  }
}
