import type { GenerateParams } from '@/lib/types';

// Re-export all provider handlers for use by compare and other routes

export async function generateOpenAI(params: GenerateParams, apiKey: string, providerBaseUrl: string) {
  const sizeMap: Record<string, string> = {
    '1:1': '1024x1024', '16:9': '1792x1024', '9:16': '1024x1792',
    'landscape': '1536x1024', 'portrait': '1024x1536',
  };
  const isGptImage = params.model === 'gpt-image-1' || params.model === 'gpt-image-2';
  const body: Record<string, unknown> = { model: params.model, prompt: params.prompt, n: params.batchSize || 1 };
  if (params.size) body.size = params.size;
  else body.size = sizeMap[params.aspectRatio || '1:1'] || params.aspectRatio || '1024x1024';
  if (params.quality && isGptImage) body.quality = params.quality;
  if (params.output_format && params.model === 'gpt-image-2') body.output_format = params.output_format;
  if (params.style && params.model === 'dall-e-3') body.style = params.style;
  if (params.styleType && params.model === 'dall-e-3') body.style = params.styleType;
  if (!isGptImage) body.response_format = 'url';
  const response = await fetch(`${providerBaseUrl}/images/generations`, { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) { const error = await response.text(); throw new Error(`OpenAI API error: ${response.status} - ${error}`); }
  const data = await response.json();
  return data.data?.map((img: { url?: string; b64_json?: string }) => img.url || `data:image/png;base64,${img.b64_json}`) || [];
}

export async function generateStability(params: GenerateParams, apiKey: string, providerBaseUrl: string) {
  const modelEndpoints: Record<string, string> = {
    'stable-image-ultra': '/v2beta/stable-image/generate/ultra', 'stable-diffusion-3.5-large': '/v2beta/stable-image/generate/sd3',
    'stable-diffusion-3.5-large-turbo': '/v2beta/stable-image/generate/sd3', 'stable-image-core': '/v2beta/stable-image/generate/sd3', 'sdxl-1.0': '/v2beta/stable-image/generate/sd3',
  };
  const endpoint = modelEndpoints[params.model] || '/v2beta/stable-image/generate/ultra';
  const formData = new FormData();
  formData.append('prompt', params.prompt);
  if (params.negativePrompt) formData.append('negative_prompt', params.negativePrompt);
  if (params.aspectRatio) formData.append('aspect_ratio', params.aspectRatio);
  formData.append('output_format', params.output_format || 'png');
  if (params.seed) formData.append('seed', params.seed.toString());
  if (params.style) formData.append('style', params.style);
  if (params.clipGuidance && params.clipGuidance !== 'NONE') formData.append('clip_guidance_preset', params.clipGuidance);
  if (params.sampler) formData.append('sampler', params.sampler);
  if (params.scheduler) formData.append('scheduler', params.scheduler);
  if (params.clipSkip && params.clipSkip > 1) formData.append('clip_skip', params.clipSkip.toString());
  if (params.steps) formData.append('steps', params.steps.toString());
  if (params.guidance) formData.append('cfg_scale', params.guidance.toString());
  if (params.tileable) formData.append('tileable', 'true');
  if (params.strength !== undefined && params.inputImageUrl) formData.append('strength', params.strength.toString());
  if (params.safetyFilter === false) formData.append('safety', 'none');
  const response = await fetch(`${providerBaseUrl}${endpoint}`, { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'image/*' }, body: formData });
  if (!response.ok) { const error = await response.text(); throw new Error(`Stability API error: ${response.status} - ${error}`); }
  const buffer = await response.arrayBuffer();
  return [`data:image/${params.output_format || 'png'};base64,${Buffer.from(buffer).toString('base64')}`];
}

export async function generateReplicate(params: GenerateParams, apiKey: string, providerBaseUrl: string) {
  const input: Record<string, unknown> = { prompt: params.prompt };
  if (params.negativePrompt) input.negative_prompt = params.negativePrompt;
  if (params.aspectRatio) input.aspect_ratio = params.aspectRatio;
  if (params.steps) input.num_inference_steps = params.steps;
  if (params.guidance) input.guidance_scale = params.guidance;
  if (params.seed) input.seed = params.seed;
  if (params.inputImageUrl) input.image = params.inputImageUrl;
  if (params.sampler) input.scheduler = params.sampler;
  if (params.scheduler) input.scheduler_type = params.scheduler;
  if (params.clipSkip && params.clipSkip > 1) input.clip_skip = params.clipSkip;
  if (params.strength !== undefined && params.inputImageUrl) input.strength = params.strength;
  if (params.output_format) input.output_format = params.output_format;
  const response = await fetch(`${providerBaseUrl}/v1/predictions`, { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: params.model, input }) });
  if (!response.ok) { const error = await response.text(); throw new Error(`Replicate API error: ${response.status} - ${error}`); }
  const data = await response.json();
  return { jobId: data.id, status: 'processing' };
}

export async function generateFal(params: GenerateParams, apiKey: string, providerBaseUrl: string) {
  const body: Record<string, unknown> = { prompt: params.prompt };
  if (params.negativePrompt) body.negative_prompt = params.negativePrompt;
  if (params.aspectRatio) { const m: Record<string, string> = { '1:1': 'square', '16:9': 'landscape_16_9', '9:16': 'portrait_9_16', '4:3': 'landscape_4_3', '3:4': 'portrait_3_4' }; body.image_size = m[params.aspectRatio] || 'square'; }
  if (params.steps) body.num_inference_steps = params.steps;
  if (params.guidance) body.guidance_scale = params.guidance;
  if (params.seed) body.seed = params.seed;
  if (params.inputImageUrl) body.image_url = params.inputImageUrl;
  if (params.sampler) body.scheduler = params.sampler;
  if (params.scheduler) body.scheduler_type = params.scheduler;
  if (params.clipSkip && params.clipSkip > 1) body.clip_skip = params.clipSkip;
  if (params.strength !== undefined && params.inputImageUrl) body.strength = params.strength;
  if (params.output_format) body.output_format = params.output_format;
  const response = await fetch(`${providerBaseUrl}/${params.model}/requests`, { method: 'POST', headers: { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) { const error = await response.text(); throw new Error(`Fal.ai API error: ${response.status} - ${error}`); }
  const data = await response.json();
  return { jobId: data.request_id, status: 'processing' };
}

export async function generateTogether(params: GenerateParams, apiKey: string, providerBaseUrl: string) {
  const body: Record<string, unknown> = { model: params.model, prompt: params.prompt, n: params.batchSize || 1, response_format: 'url' };
  if (params.width) body.width = params.width;
  if (params.height) body.height = params.height;
  if (params.steps) body.steps = params.steps;
  if (params.seed) body.seed = params.seed;
  if (params.negativePrompt) body.negative_prompt = params.negativePrompt;
  if (params.guidance) body.guidance_scale = params.guidance;
  const response = await fetch(`${providerBaseUrl}/v1/images/generations`, { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) { const error = await response.text(); throw new Error(`Together AI API error: ${response.status} - ${error}`); }
  const data = await response.json();
  return data.data?.map((img: { url?: string; b64_json?: string }) => img.url || `data:image/png;base64,${img.b64_json}`) || [];
}

export async function generateFireworks(params: GenerateParams, apiKey: string, providerBaseUrl: string) {
  const body: Record<string, unknown> = { model: params.model, prompt: params.prompt, n: params.batchSize || 1 };
  if (params.steps) body.steps = params.steps;
  if (params.guidance) body.cfg_scale = params.guidance;
  if (params.seed) body.seed = params.seed;
  const response = await fetch(`${providerBaseUrl}/v1/images/generations`, { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) { const error = await response.text(); throw new Error(`Fireworks AI API error: ${response.status} - ${error}`); }
  const data = await response.json();
  return data.data?.map((img: { url?: string; b64_json?: string }) => img.url || `data:image/png;base64,${img.b64_json}`) || [];
}

export async function generateIdeogram(params: GenerateParams, apiKey: string, providerBaseUrl: string) {
  const arMap: Record<string, string> = { '1:1': 'ASPECT_1_1', '4:3': 'ASPECT_4_3', '3:4': 'ASPECT_3_4', '16:9': 'ASPECT_16_9', '9:16': 'ASPECT_9_16', '3:2': 'ASPECT_3_2', '2:3': 'ASPECT_2_3' };
  const body: Record<string, unknown> = { prompt: params.prompt, model: params.model, aspect_ratio: arMap[params.aspectRatio || '1:1'] || 'ASPECT_1_1' };
  if (params.negativePrompt) body.negative_prompt = params.negativePrompt;
  if (params.seed) body.seed = params.seed;
  if (params.style) body.style_type = params.style;
  if (params.styleType) body.style_type = params.styleType;
  if (params.magicPrompt !== undefined) body.magic_prompt = params.magicPrompt;
  if (params.renderingSpeed) body.rendering_speed = params.renderingSpeed;
  if (params.safetyFilter === false) body.safety_tolerance = 0;
  const response = await fetch(`${providerBaseUrl}/api/generate`, { method: 'POST', headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) { const error = await response.text(); throw new Error(`Ideogram API error: ${response.status} - ${error}`); }
  const data = await response.json();
  return data.data?.map((img: { url?: string }) => img.url).filter(Boolean) || [];
}

export async function generateHuggingFace(params: GenerateParams, apiKey: string, providerBaseUrl: string) {
  const body: Record<string, unknown> = { inputs: params.prompt, parameters: {} as Record<string, unknown> };
  if (params.negativePrompt) (body.parameters as Record<string, unknown>).negative_prompt = params.negativePrompt;
  if (params.guidance) (body.parameters as Record<string, unknown>).guidance_scale = params.guidance;
  if (params.steps) (body.parameters as Record<string, unknown>).num_inference_steps = params.steps;
  if (params.seed) (body.parameters as Record<string, unknown>).seed = params.seed;
  const response = await fetch(`${providerBaseUrl}/${params.model}`, { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) { const error = await response.text(); throw new Error(`HuggingFace API error: ${response.status} - ${error}`); }
  const buffer = await response.arrayBuffer();
  return [`data:image/png;base64,${Buffer.from(buffer).toString('base64')}`];
}

export async function generateAIMLAPI(params: GenerateParams, apiKey: string, providerBaseUrl: string) {
  const body: Record<string, unknown> = { model: params.model, prompt: params.prompt, n: params.batchSize || 1, size: params.aspectRatio === '16:9' ? '1792x1024' : params.aspectRatio === '9:16' ? '1024x1792' : '1024x1024' };
  const response = await fetch(`${providerBaseUrl}/v1/images/generations`, { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) { const error = await response.text(); throw new Error(`AI/ML API error: ${response.status} - ${error}`); }
  const data = await response.json();
  return data.data?.map((img: { url?: string; b64_json?: string }) => img.url || `data:image/png;base64,${img.b64_json}`) || [];
}

export async function generateGoogle(params: GenerateParams, apiKey: string, providerBaseUrl: string) {
  // Gemini image models (e.g. gemini-2.5-flash-image) use generateContent endpoint
  // Imagen models (e.g. imagen-4.0-generate-001) use :predict endpoint
  const isGeminiImage = params.model.startsWith('gemini-');

  if (isGeminiImage) {
    // Gemini API format — uses contents/parts
    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text: params.prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    };
    const response = await fetch(`${providerBaseUrl}/models/${params.model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) { const error = await response.text(); throw new Error(`Google Gemini API error: ${response.status} - ${error}`); }
    const data = await response.json();
    // Extract inline image data from candidates
    const images: string[] = [];
    for (const candidate of (data.candidates || [])) {
      for (const part of (candidate?.content?.parts || [])) {
        if (part.inlineData?.data) {
          images.push(`data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`);
        }
      }
    }
    return images;
  }

  // Imagen API format — uses instances/parameters with :predict
  const body: Record<string, unknown> = { instances: [{ prompt: params.prompt }], parameters: { sampleCount: params.batchSize || 1, aspectRatio: params.aspectRatio || '1:1' } };
  if (params.negativePrompt) (body.parameters as Record<string, unknown>).negativePrompt = params.negativePrompt;
  if (params.seed) (body.parameters as Record<string, unknown>).seed = params.seed;
  const response = await fetch(`${providerBaseUrl}/models/${params.model}:predict`, { method: 'POST', headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) { const error = await response.text(); throw new Error(`Google Imagen API error: ${response.status} - ${error}`); }
  const data = await response.json();
  return (data.predictions || []).map((p: { bytesBase64Encoded?: string }) => p.bytesBase64Encoded ? `data:image/png;base64,${p.bytesBase64Encoded}` : null).filter(Boolean) as string[];
}

export async function generateLeonardo(params: GenerateParams, apiKey: string, providerBaseUrl: string) {
  const body: Record<string, unknown> = { prompt: params.prompt, modelId: params.model, width: params.width || 1024, height: params.height || 1024, num_images: params.batchSize || 1 };
  if (params.negativePrompt) body.negative_prompt = params.negativePrompt;
  if (params.seed) body.seed = params.seed;
  if (params.guidance) body.guidance_scale = params.guidance;
  const response = await fetch(`${providerBaseUrl}/generations`, { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) { const error = await response.text(); throw new Error(`Leonardo API error: ${response.status} - ${error}`); }
  const data = await response.json();
  const generationId = data.sdGenerationJob?.generationId;
  if (!generationId) throw new Error('Leonardo API did not return a generation ID');
  return { jobId: generationId, status: 'processing' };
}

export async function generateRecraft(params: GenerateParams, apiKey: string, providerBaseUrl: string) {
  const body: Record<string, unknown> = { prompt: params.prompt, style: params.style || 'any', n: params.batchSize || 1 };
  if (params.negativePrompt) body.negative_prompt = params.negativePrompt;
  if (params.seed) body.seed = params.seed;
  const response = await fetch(`${providerBaseUrl}/v1/images/generations`, { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) { const error = await response.text(); throw new Error(`Recraft API error: ${response.status} - ${error}`); }
  const data = await response.json();
  return data.data?.map((img: { url?: string; b64_json?: string }) => img.url || `data:image/png;base64,${img.b64_json}`) || [];
}

export async function generateBFL(params: GenerateParams, apiKey: string, providerBaseUrl: string) {
  const body: Record<string, unknown> = { prompt: params.prompt };
  if (params.steps) body.steps = params.steps;
  if (params.guidance) body.guidance = params.guidance;
  if (params.seed) body.seed = params.seed;
  if (params.width) body.width = params.width;
  if (params.height) body.height = params.height;
  const endpoint = params.model === 'flux-kontext-pro' ? '/flux-kontext-pro' : `/${params.model}`;
  const response = await fetch(`${providerBaseUrl}${endpoint}`, { method: 'POST', headers: { 'X-Key': apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) { const error = await response.text(); throw new Error(`BFL API error: ${response.status} - ${error}`); }
  const data = await response.json();
  if (data.id) return { jobId: data.id, status: 'processing' };
  return [data.url || data.output?.url].filter(Boolean);
}
