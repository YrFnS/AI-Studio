import { NextRequest, NextResponse } from 'next/server';
import { PROVIDERS } from '@/lib/providers-data';
import type { GenerateParams } from '@/lib/types';
import {
  generateOpenAI, generateStability, generateReplicate, generateFal,
  generateTogether, generateFireworks, generateIdeogram, generateHuggingFace,
  generateAIMLAPI, generateGoogle, generateLeonardo, generateRecraft, generateBFL,
} from '../handlers';

function dispatchGeneration(providerName: string, params: GenerateParams, apiKey: string, providerBaseUrl: string) {
  switch (providerName) {
    case 'openai': return generateOpenAI(params, apiKey, providerBaseUrl);
    case 'stability': return generateStability(params, apiKey, providerBaseUrl);
    case 'replicate': return generateReplicate(params, apiKey, providerBaseUrl);
    case 'fal': return generateFal(params, apiKey, providerBaseUrl);
    case 'together': return generateTogether(params, apiKey, providerBaseUrl);
    case 'fireworks': return generateFireworks(params, apiKey, providerBaseUrl);
    case 'ideogram': return generateIdeogram(params, apiKey, providerBaseUrl);
    case 'huggingface': return generateHuggingFace(params, apiKey, providerBaseUrl);
    case 'aimlapi': return generateAIMLAPI(params, apiKey, providerBaseUrl);
    case 'bfl': return generateBFL(params, apiKey, providerBaseUrl);
    case 'google': return generateGoogle(params, apiKey, providerBaseUrl);
    case 'leonardo': return generateLeonardo(params, apiKey, providerBaseUrl);
    case 'recraft': return generateRecraft(params, apiKey, providerBaseUrl);
    default: return generateOpenAI(params, apiKey, providerBaseUrl);
  }
}

interface CompareModelRequest { providerName: string; modelId: string; apiKey: string; }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, negativePrompt, models, params } = body as {
      prompt: string; negativePrompt?: string; models: CompareModelRequest[];
      params?: { aspectRatio?: string; quality?: string; steps?: number; guidance?: number; seed?: number; batchSize?: number; style?: string; width?: number; height?: number; };
    };

    if (!prompt || !models || models.length === 0) return NextResponse.json({ error: 'prompt and models are required' }, { status: 400 });
    if (models.length > 4) return NextResponse.json({ error: 'Maximum 4 models for comparison' }, { status: 400 });

    const results = await Promise.allSettled(
      models.map(async (model) => {
        const startTime = Date.now();
        try {
          const provider = PROVIDERS.find((p) => p.name === model.providerName);
          if (!provider) return { providerName: model.providerName, modelId: model.modelId, status: 'failed' as const, error: `Provider "${model.providerName}" not found`, duration: Date.now() - startTime };
          if (!model.apiKey) return { providerName: model.providerName, modelId: model.modelId, status: 'failed' as const, error: 'API key is required', duration: Date.now() - startTime };

          const generateParams: GenerateParams = {
            prompt, negativePrompt, model: model.modelId, provider: provider.name,
            aspectRatio: params?.aspectRatio, quality: params?.quality, steps: params?.steps,
            guidance: params?.guidance, seed: params?.seed, batchSize: params?.batchSize || 1,
            style: params?.style, width: params?.width, height: params?.height,
          };

          const result = await dispatchGeneration(provider.name, generateParams, model.apiKey, provider.baseUrl);
          const duration = Date.now() - startTime;

          if (!Array.isArray(result) && typeof result === 'object' && 'jobId' in result) {
            return { providerName: provider.displayName || provider.name, modelId: model.modelId, status: 'processing' as const, duration, jobId: result.jobId };
          }
          const urls = result as string[];
          return { providerName: provider.displayName || provider.name, modelId: model.modelId, status: 'completed' as const, resultUrl: urls[0], duration };
        } catch (err) {
          return { providerName: model.providerName, modelId: model.modelId, status: 'failed' as const, error: err instanceof Error ? err.message : 'Unknown error', duration: Date.now() - startTime };
        }
      })
    );

    const response = results.map((r) => {
      if (r.status === 'fulfilled') return r.value;
      return { providerName: 'unknown', modelId: 'unknown', status: 'failed' as const, error: r.reason?.message || 'Unexpected error', duration: 0 };
    });

    return NextResponse.json({ results: response });
  } catch (error) {
    console.error('Compare generation error:', error);
    return NextResponse.json({ error: 'Failed to run comparison' }, { status: 500 });
  }
}
