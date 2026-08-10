import { NextRequest, NextResponse } from 'next/server';

import type { GenerateParams } from '@/lib/types';
import { encodeGenerationJobToken } from '@/lib/generation-job';
import { PROVIDERS } from '@/lib/providers-data';
import {
  GenerationRegistryError,
  requireModelOperation,
} from '@/lib/generation-registry';
import {
  generateOpenAI,
  generateStability,
  generateReplicate,
  generateFal,
  generateTogether,
  generateFireworks,
  generateIdeogram,
  generateHuggingFace,
  generateAIMLAPI,
  generateGoogle,
  generateRecraft,
  generateBFL,
} from '../handlers';

function getProviderById(id: string) {
  return PROVIDERS.find((provider) => provider.id === id);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      providerId,
      modelId,
      prompt,
      negativePrompt,
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
      apiKey,
    } = body as GenerateParams & {
      providerId: string;
      modelId: string;
      apiKey?: string;
    };

    if (!providerId || !modelId || !prompt) {
      return NextResponse.json(
        { error: 'providerId, modelId, and prompt are required' },
        { status: 400 },
      );
    }
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required. Please configure your API key in Settings.' },
        { status: 400 },
      );
    }

    const provider = getProviderById(providerId);
    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    requireModelOperation(
      provider.name,
      modelId,
      inputImageUrl ? 'image-to-image' : 'text-to-image',
      'image',
    );

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
      case 'openai':
        result = await generateOpenAI(params, apiKey, provider.baseUrl);
        break;
      case 'stability':
        result = await generateStability(params, apiKey, provider.baseUrl);
        break;
      case 'replicate':
        result = await generateReplicate(params, apiKey, provider.baseUrl);
        break;
      case 'fal':
        result = await generateFal(params, apiKey, provider.baseUrl);
        break;
      case 'together':
        result = await generateTogether(params, apiKey, provider.baseUrl);
        break;
      case 'fireworks':
        result = await generateFireworks(params, apiKey, provider.baseUrl);
        break;
      case 'ideogram':
        result = await generateIdeogram(params, apiKey, provider.baseUrl);
        break;
      case 'huggingface':
        result = await generateHuggingFace(params, apiKey, provider.baseUrl);
        break;
      case 'aimlapi':
        result = await generateAIMLAPI(params, apiKey, provider.baseUrl);
        break;
      case 'bfl':
        result = await generateBFL(params, apiKey, provider.baseUrl);
        break;
      case 'google-aistudio':
        result = await generateGoogle(params, apiKey, provider.baseUrl);
        break;
      case 'recraft':
        result = await generateRecraft(params, apiKey, provider.baseUrl);
        break;
      default:
        return NextResponse.json(
          { error: `No image adapter is configured for ${provider.displayName}` },
          { status: 400 },
        );
    }

    if (!Array.isArray(result) && 'jobId' in result) {
      const localJobId = encodeGenerationJobToken({
        providerId: provider.name,
        jobId: result.jobId,
        modelId,
        kind: 'image',
      });

      return NextResponse.json({
        id: localJobId,
        jobId: localJobId,
        localJob: true,
        status: 'processing',
        message: 'Generation in progress. Poll /api/generate/status for results.',
      });
    }

    return NextResponse.json(
      { status: 'completed', urls: result },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof GenerationRegistryError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    console.error('Generate image error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image' },
      { status: 500 },
    );
  }
}
