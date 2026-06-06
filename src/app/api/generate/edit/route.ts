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

async function editOpenAI(params: { prompt: string; modelId: string; image: string; mask?: string; size?: string; quality?: string; n?: number }, apiKey: string, providerBaseUrl: string) {
  const imageBlob = base64ToBlob(params.image);
  const maskBlob = params.mask ? base64ToBlob(params.mask) : undefined;
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
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  });
  if (!response.ok) { const error = await response.text(); throw new Error(`OpenAI Edit API error: ${response.status} - ${error}`); }
  const data = await response.json();
  return { images: (data.data || []).map((img: { url?: string; b64_json?: string }) => img.url || `data:image/png;base64,${img.b64_json}`), status: 'completed' };
}

async function editStability(params: { prompt: string; modelId: string; image: string; mask?: string; negativePrompt?: string }, apiKey: string, providerBaseUrl: string) {
  const imageBlob = base64ToBlob(params.image);
  const maskBlob = params.mask ? base64ToBlob(params.mask) : undefined;
  const formData = new FormData();
  formData.append('prompt', params.prompt);
  if (params.negativePrompt) formData.append('negative_prompt', params.negativePrompt);
  formData.append('output_format', 'png');
  formData.append('image', imageBlob, 'image.png');
  if (maskBlob) formData.append('mask', maskBlob, 'mask.png');

  const response = await fetch(`${providerBaseUrl}/v2beta/stable-image/edit/inpaint`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'image/*' },
    body: formData,
  });
  if (!response.ok) { const error = await response.text(); throw new Error(`Stability Inpaint API error: ${response.status} - ${error}`); }
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return { images: [`data:image/png;base64,${base64}`], status: 'completed' };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { providerId, providerName, modelId, prompt, image, mask, size, quality, n, negativePrompt, apiKey } = body as {
      providerId?: string; providerName?: string; modelId: string; prompt: string; image: string;
      mask?: string; size?: string; quality?: string; n?: number; negativePrompt?: string; apiKey?: string;
    };

    if (!modelId || !prompt || !image) return NextResponse.json({ error: 'modelId, prompt, and image are required' }, { status: 400 });
    if (!apiKey) return NextResponse.json({ error: 'API key is required. Please configure your API key in Settings.' }, { status: 400 });

    let provider = providerId ? await getProviderById(providerId) : null;
    if (!provider && providerName) provider = PROVIDERS.find((p) => p.name === providerName) || null;
    if (!provider) return NextResponse.json({ error: 'Provider not found' }, { status: 404 });

    let result: { images: string[]; status: string };
    switch (provider.name) {
      case 'openai': result = await editOpenAI({ prompt, modelId, image, mask, size, quality, n }, apiKey, provider.baseUrl); break;
      case 'stability': result = await editStability({ prompt, modelId, image, mask, negativePrompt }, apiKey, provider.baseUrl); break;
      default: result = await editOpenAI({ prompt, modelId, image, mask, size, quality, n }, apiKey, provider.baseUrl);
    }

    return NextResponse.json({ status: 'completed', images: result.images });
  } catch (error) {
    console.error('Edit image error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to edit image' }, { status: 500 });
  }
}
