import { NextRequest } from 'next/server';

import type { GenerateParams } from '@/lib/types';
import { encodeGenerationJobToken } from '@/lib/generation-job';
import { PROVIDERS } from '@/lib/providers-data';
import { requireModelOperation } from '@/lib/generation-registry';
import {
  imageGenerationRequestSchema,
  MAX_IMAGE_GENERATION_REQUEST_BYTES,
  parseGenerationRequest,
} from '@/lib/server/generation-request';
import {
  generationErrorResponse,
  noStoreJson,
} from '@/lib/server/generation-response';
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
    } = await parseGenerationRequest(
      req,
      imageGenerationRequestSchema,
      MAX_IMAGE_GENERATION_REQUEST_BYTES,
    );

    const provider = getProviderById(providerId);
    if (!provider) {
      return noStoreJson({
        error: 'Provider not found',
        code: 'provider_not_found',
      }, 404);
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
        return noStoreJson({
          error: `No image adapter is configured for ${provider.displayName}`,
          code: 'adapter_not_configured',
        }, 400);
    }

    if (!Array.isArray(result) && 'jobId' in result) {
      const localJobId = encodeGenerationJobToken({
        providerId: provider.name,
        jobId: result.jobId,
        modelId,
        kind: 'image',
      });

      return noStoreJson({
        id: localJobId,
        jobId: localJobId,
        localJob: true,
        status: 'processing',
        message: 'Generation in progress. Poll /api/generate/status for results.',
      });
    }

    return noStoreJson({ status: 'completed', urls: result });
  } catch (error) {
    return generationErrorResponse(error, {
      logLabel: 'Generate image error',
      fallbackMessage: 'Failed to generate image',
    });
  }
}
