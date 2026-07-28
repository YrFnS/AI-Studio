import { NextRequest, NextResponse } from 'next/server';
import type { GenerateParams } from '@/lib/types';
import { PROVIDERS } from '@/lib/providers-data';
import { encodeGenerationJobToken } from '@/lib/generation-job';
import {
  generateOpenAI, generateStability, generateReplicate, generateFal,
  generateTogether, generateFireworks, generateIdeogram, generateHuggingFace,
  generateAIMLAPI, generateGoogle, generateLeonardo, generateRecraft, generateBFL,
} from '../handlers';

export const runtime = 'nodejs';

async function getProviderById(id: string) {
  return PROVIDERS.find((provider) => provider.id === id);
}

function json(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      providerId, modelId, prompt, negativePrompt, aspectRatio, quality, steps,
      guidance, seed, batchSize, inputImageUrl, style, width, height, size,
      output_format, strength, sampler, magicPrompt, styleType, renderingSpeed,
      clipGuidance, tileable, photoReal, alchemy, safetyFilter, scheduler,
      clipSkip, lighting, colorMood, cameraShot, hiresFix, hiresScale,
      hiresSteps, hiresDenoise, apiKey,
    } = body as GenerateParams & {
      providerId: string;
      modelId: string;
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

    const params: GenerateParams = {
      prompt,
      negativePrompt,
      model: modelId,
      provider: provider.name,
      aspectRatio,
      quality,
      steps,
      guidance,
      seed,
      batchSize,
      inputImageUrl,
      style,
      width,
      height,
      size,
      output_format,
      strength,
      sampler,
      magicPrompt,
      styleType,
      renderingSpeed,
      clipGuidance,
      tileable,
      photoReal,
      alchemy,
      safetyFilter,
      scheduler,
      clipSkip,
      lighting,
      colorMood,
      cameraShot,
      hiresFix,
      hiresScale,
      hiresSteps,
      hiresDenoise,
    };

    let result: string[] | { jobId: string; status: string };
    switch (provider.name) {
      case 'openai': result = await generateOpenAI(params, apiKey, provider.baseUrl); break;
      case 'stability': result = await generateStability(params, apiKey, provider.baseUrl); break;
      case 'replicate': result = await generateReplicate(params, apiKey, provider.baseUrl); break;
      case 'fal': result = await generateFal(params, apiKey, provider.baseUrl); break;
      case 'together': result = await generateTogether(params, apiKey, provider.baseUrl); break;
      case 'fireworks': result = await generateFireworks(params, apiKey, provider.baseUrl); break;
      case 'ideogram': result = await generateIdeogram(params, apiKey, provider.baseUrl); break;
      case 'huggingface': result = await generateHuggingFace(params, apiKey, provider.baseUrl); break;
      case 'aimlapi': result = await generateAIMLAPI(params, apiKey, provider.baseUrl); break;
      case 'bfl': result = await generateBFL(params, apiKey, provider.baseUrl); break;
      case 'google':
      case 'google-aistudio': result = await generateGoogle(params, apiKey, provider.baseUrl); break;
      case 'leonardo': result = await generateLeonardo(params, apiKey, provider.baseUrl); break;
      case 'recraft': result = await generateRecraft(params, apiKey, provider.baseUrl); break;
      case 'google-vertex':
        throw new Error('Google Vertex image generation requires project, location, and OAuth configuration and is not supported by the BYOK API-key flow yet.');
      default:
        throw new Error(`Image generation is not supported for provider: ${provider.displayName}`);
    }

    if (!Array.isArray(result) && typeof result === 'object' && 'jobId' in result) {
      const jobToken = encodeGenerationJobToken({
        providerId: provider.id,
        modelId,
        jobId: result.jobId,
        kind: 'image',
      });

      return json({
        id: jobToken,
        jobId: jobToken,
        status: 'processing',
        message: 'Generation in progress. Poll /api/generate/status for results.',
      });
    }

    return json({ status: 'completed', urls: result as string[] });
  } catch (error) {
    console.error('Generate image error:', error);
    return json({
      error: error instanceof Error ? error.message : 'Failed to generate image',
    }, 500);
  }
}
