import type { GenerateParams } from '@/lib/types';
import { resolveImageBlob } from '@/lib/server/image-input';
import { submitReplicatePrediction } from '@/lib/server/replicate';

export async function generateOpenAI(
  params: GenerateParams,
  apiKey: string,
  providerBaseUrl: string,
) {
  const sizeMap: Record<string, string> = {
    '1:1': '1024x1024',
    '16:9': '1792x1024',
    '9:16': '1024x1792',
    landscape: '1536x1024',
    portrait: '1024x1536',
  };
  const isGptImage = params.model === 'gpt-image-1' || params.model === 'gpt-image-2';
  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    n: params.batchSize || 1,
  };
  if (params.size) body.size = params.size;
  else body.size = sizeMap[params.aspectRatio || '1:1'] || params.aspectRatio || '1024x1024';
  if (params.quality && isGptImage) body.quality = params.quality;
  if (params.output_format && params.model === 'gpt-image-2') body.output_format = params.output_format;
  if (params.style && params.model === 'dall-e-3') body.style = params.style;
  if (params.styleType && params.model === 'dall-e-3') body.style = params.styleType;
  if (!isGptImage) body.response_format = 'url';

  const response = await fetch(`${providerBaseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }
  const data = await response.json();
  return data.data?.map(
    (image: { url?: string; b64_json?: string }) =>
      image.url || `data:image/png;base64,${image.b64_json}`,
  ) || [];
}

export async function generateStability(
  params: GenerateParams,
  apiKey: string,
  providerBaseUrl: string,
): Promise<string[]> {
  const sd3Models: Record<string, string> = {
    'stable-diffusion-3.5-large': 'sd3.5-large',
    'stable-diffusion-3.5-large-turbo': 'sd3.5-large-turbo',
    'stable-diffusion-3.5-medium': 'sd3.5-medium',
  };
  const sd3Model = sd3Models[params.model];
  const endpoint = params.model === 'stable-image-ultra'
    ? 'ultra'
    : params.model === 'stable-image-core'
      ? 'core'
      : sd3Model
        ? 'sd3'
        : null;

  if (!endpoint) {
    throw new Error(`No Stability image adapter exists for ${params.model}.`);
  }

  const formData = new FormData();
  formData.append('prompt', params.prompt);
  if (params.negativePrompt) {
    formData.append('negative_prompt', params.negativePrompt);
  }
  formData.append('output_format', params.output_format || 'png');
  if (params.seed !== undefined) formData.append('seed', String(params.seed));

  if (params.inputImageUrl) {
    if (!sd3Model) {
      throw new Error(`${params.model} is not registered for Stability image-to-image generation.`);
    }
    const imageBlob = await resolveImageBlob(params.inputImageUrl);
    formData.append('image', imageBlob, 'image.png');
    formData.append('mode', 'image-to-image');
    formData.append('strength', String(params.strength ?? 0.65));
  } else if (params.aspectRatio) {
    formData.append('aspect_ratio', params.aspectRatio);
  }

  if (sd3Model) formData.append('model', sd3Model);

  const response = await fetch(
    `${providerBaseUrl}/v2beta/stable-image/generate/${endpoint}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'image/*',
      },
      body: formData,
    },
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Stability API error: ${response.status} - ${error}`);
  }

  const buffer = await response.arrayBuffer();
  return [`data:image/${params.output_format || 'png'};base64,${Buffer.from(buffer).toString('base64')}`];
}

export async function generateReplicate(
  params: GenerateParams,
  apiKey: string,
  providerBaseUrl: string,
): Promise<{ jobId: string; status: string }> {
  const input: Record<string, unknown> = {
    prompt: params.prompt,
    negative_prompt: params.negativePrompt,
    width: params.width,
    height: params.height,
    num_outputs: params.batchSize || 1,
    num_inference_steps: params.steps,
    guidance_scale: params.guidance,
    seed: params.seed,
    output_format: params.output_format,
  };
  if (params.inputImageUrl) {
    input.image = params.inputImageUrl;
    input.strength = params.strength ?? 0.65;
  }

  for (const key of Object.keys(input)) {
    if (input[key] === undefined || input[key] === '') delete input[key];
  }

  const data = await submitReplicatePrediction(
    providerBaseUrl,
    params.model,
    input,
    apiKey,
  );
  if (typeof data.id !== 'string') {
    throw new Error('Replicate did not return a prediction id');
  }

  return { jobId: data.id, status: 'processing' };
}

export async function generateFal(
  params: GenerateParams,
  apiKey: string,
  providerBaseUrl: string,
) {
  const body: Record<string, unknown> = { prompt: params.prompt };
  if (params.negativePrompt) body.negative_prompt = params.negativePrompt;
  if (params.aspectRatio) {
    const sizes: Record<string, string> = {
      '1:1': 'square',
      '16:9': 'landscape_16_9',
      '9:16': 'portrait_9_16',
      '4:3': 'landscape_4_3',
      '3:4': 'portrait_3_4',
    };
    body.image_size = sizes[params.aspectRatio] || 'square';
  }
  if (params.steps) body.num_inference_steps = params.steps;
  if (params.guidance) body.guidance_scale = params.guidance;
  if (params.seed) body.seed = params.seed;
  if (params.inputImageUrl) body.image_url = params.inputImageUrl;
  if (params.sampler) body.scheduler = params.sampler;
  if (params.scheduler) body.scheduler_type = params.scheduler;
  if (params.clipSkip && params.clipSkip > 1) body.clip_skip = params.clipSkip;
  if (params.strength !== undefined && params.inputImageUrl) body.strength = params.strength;
  if (params.output_format) body.output_format = params.output_format;

  const response = await fetch(`${providerBaseUrl}/${params.model}/requests`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Fal.ai API error: ${response.status} - ${error}`);
  }
  const data = await response.json();
  return { jobId: data.request_id, status: 'processing' };
}

export async function generateTogether(
  params: GenerateParams,
  apiKey: string,
  providerBaseUrl: string,
) {
  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    n: params.batchSize || 1,
    response_format: 'url',
  };
  if (params.width) body.width = params.width;
  if (params.height) body.height = params.height;
  if (params.steps) body.steps = params.steps;
  if (params.seed) body.seed = params.seed;
  if (params.negativePrompt) body.negative_prompt = params.negativePrompt;
  if (params.guidance) body.guidance_scale = params.guidance;

  const response = await fetch(`${providerBaseUrl}/v1/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Together AI API error: ${response.status} - ${error}`);
  }
  const data = await response.json();
  return data.data?.map(
    (image: { url?: string; b64_json?: string }) =>
      image.url || `data:image/png;base64,${image.b64_json}`,
  ) || [];
}

export async function generateFireworks(
  params: GenerateParams,
  apiKey: string,
  providerBaseUrl: string,
) {
  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    n: params.batchSize || 1,
  };
  if (params.steps) body.steps = params.steps;
  if (params.guidance) body.cfg_scale = params.guidance;
  if (params.seed) body.seed = params.seed;

  const response = await fetch(`${providerBaseUrl}/v1/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Fireworks AI API error: ${response.status} - ${error}`);
  }
  const data = await response.json();
  return data.data?.map(
    (image: { url?: string; b64_json?: string }) =>
      image.url || `data:image/png;base64,${image.b64_json}`,
  ) || [];
}

export async function generateIdeogram(
  params: GenerateParams,
  apiKey: string,
  providerBaseUrl: string,
) {
  const aspectRatios: Record<string, string> = {
    '1:1': 'ASPECT_1_1',
    '4:3': 'ASPECT_4_3',
    '3:4': 'ASPECT_3_4',
    '16:9': 'ASPECT_16_9',
    '9:16': 'ASPECT_9_16',
    '3:2': 'ASPECT_3_2',
    '2:3': 'ASPECT_2_3',
  };
  const body: Record<string, unknown> = {
    prompt: params.prompt,
    model: params.model,
    aspect_ratio: aspectRatios[params.aspectRatio || '1:1'] || 'ASPECT_1_1',
  };
  if (params.negativePrompt) body.negative_prompt = params.negativePrompt;
  if (params.seed) body.seed = params.seed;
  if (params.style) body.style_type = params.style;
  if (params.styleType) body.style_type = params.styleType;
  if (params.magicPrompt !== undefined) body.magic_prompt = params.magicPrompt;
  if (params.renderingSpeed) body.rendering_speed = params.renderingSpeed;
  if (params.safetyFilter === false) body.safety_tolerance = 0;

  const response = await fetch(`${providerBaseUrl}/api/generate`, {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ideogram API error: ${response.status} - ${error}`);
  }
  const data = await response.json();
  return data.data?.map((image: { url?: string }) => image.url).filter(Boolean) || [];
}

export async function generateHuggingFace(
  params: GenerateParams,
  apiKey: string,
  providerBaseUrl: string,
) {
  const body: Record<string, unknown> = {
    inputs: params.prompt,
    parameters: {} as Record<string, unknown>,
  };
  const parameters = body.parameters as Record<string, unknown>;
  if (params.negativePrompt) parameters.negative_prompt = params.negativePrompt;
  if (params.guidance) parameters.guidance_scale = params.guidance;
  if (params.steps) parameters.num_inference_steps = params.steps;
  if (params.seed) parameters.seed = params.seed;

  const response = await fetch(`${providerBaseUrl}/${params.model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HuggingFace API error: ${response.status} - ${error}`);
  }
  const buffer = await response.arrayBuffer();
  return [`data:image/png;base64,${Buffer.from(buffer).toString('base64')}`];
}

export async function generateAIMLAPI(
  params: GenerateParams,
  apiKey: string,
  providerBaseUrl: string,
) {
  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    n: params.batchSize || 1,
    size:
      params.aspectRatio === '16:9'
        ? '1792x1024'
        : params.aspectRatio === '9:16'
          ? '1024x1792'
          : '1024x1024',
  };
  const response = await fetch(`${providerBaseUrl}/v1/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI/ML API error: ${response.status} - ${error}`);
  }
  const data = await response.json();
  return data.data?.map(
    (image: { url?: string; b64_json?: string }) =>
      image.url || `data:image/png;base64,${image.b64_json}`,
  ) || [];
}

export async function generateGoogle(
  params: GenerateParams,
  apiKey: string,
  providerBaseUrl: string,
) {
  const isGeminiImage = params.model.startsWith('gemini-');

  if (isGeminiImage) {
    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text: params.prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    };
    const response = await fetch(
      `${providerBaseUrl}/models/${params.model}:generateContent`,
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
      throw new Error(`Google Gemini API error: ${response.status} - ${error}`);
    }
    const data = await response.json();
    const images: string[] = [];
    for (const candidate of data.candidates || []) {
      for (const part of candidate?.content?.parts || []) {
        if (part.inlineData?.data) {
          images.push(
            `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`,
          );
        }
      }
    }
    return images;
  }

  const body: Record<string, unknown> = {
    instances: [{ prompt: params.prompt }],
    parameters: {
      sampleCount: params.batchSize || 1,
      aspectRatio: params.aspectRatio || '1:1',
    },
  };
  if (params.negativePrompt) {
    (body.parameters as Record<string, unknown>).negativePrompt = params.negativePrompt;
  }
  if (params.seed) {
    (body.parameters as Record<string, unknown>).seed = params.seed;
  }

  const response = await fetch(`${providerBaseUrl}/models/${params.model}:predict`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Imagen API error: ${response.status} - ${error}`);
  }
  const data = await response.json();
  return (data.predictions || [])
    .map((prediction: { bytesBase64Encoded?: string }) =>
      prediction.bytesBase64Encoded
        ? `data:image/png;base64,${prediction.bytesBase64Encoded}`
        : null,
    )
    .filter(Boolean) as string[];
}

export async function generateLeonardo(
  params: GenerateParams,
  apiKey: string,
  providerBaseUrl: string,
) {
  const body: Record<string, unknown> = {
    prompt: params.prompt,
    modelId: params.model,
    width: params.width || 1024,
    height: params.height || 1024,
    num_images: params.batchSize || 1,
  };
  if (params.negativePrompt) body.negative_prompt = params.negativePrompt;
  if (params.seed) body.seed = params.seed;
  if (params.guidance) body.guidance_scale = params.guidance;

  const response = await fetch(`${providerBaseUrl}/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Leonardo API error: ${response.status} - ${error}`);
  }
  const data = await response.json();
  const generationId = data.sdGenerationJob?.generationId;
  if (!generationId) throw new Error('Leonardo API did not return a generation ID');
  return { jobId: generationId, status: 'processing' };
}

export async function generateRecraft(
  params: GenerateParams,
  apiKey: string,
  providerBaseUrl: string,
) {
  const body: Record<string, unknown> = {
    prompt: params.prompt,
    style: params.style || 'any',
    n: params.batchSize || 1,
  };
  if (params.negativePrompt) body.negative_prompt = params.negativePrompt;
  if (params.seed) body.seed = params.seed;

  const response = await fetch(`${providerBaseUrl}/v1/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Recraft API error: ${response.status} - ${error}`);
  }
  const data = await response.json();
  return data.data?.map(
    (image: { url?: string; b64_json?: string }) =>
      image.url || `data:image/png;base64,${image.b64_json}`,
  ) || [];
}

export async function generateBFL(
  params: GenerateParams,
  apiKey: string,
  providerBaseUrl: string,
) {
  const body: Record<string, unknown> = { prompt: params.prompt };
  if (params.steps) body.steps = params.steps;
  if (params.guidance) body.guidance = params.guidance;
  if (params.seed) body.seed = params.seed;
  if (params.width) body.width = params.width;
  if (params.height) body.height = params.height;
  const endpoint = params.model === 'flux-kontext-pro' ? '/flux-kontext-pro' : `/${params.model}`;

  const response = await fetch(`${providerBaseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'X-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`BFL API error: ${response.status} - ${error}`);
  }
  const data = await response.json();
  if (data.id) return { jobId: data.id, status: 'processing' };
  return [data.url || data.output?.url].filter(Boolean);
}
