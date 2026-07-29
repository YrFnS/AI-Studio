import { NextRequest, NextResponse } from 'next/server';

import {
  deleteGenerationJob,
  getGenerationJob,
  type GenerationJobContext,
} from '@/lib/server-generation-store';

interface LegacyStatusContext {
  provider?: string;
  modelId?: string;
  apiKey?: string;
}

class PermanentStatusError extends Error {}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function readProviderJson(response: Response, providerLabel: string) {
  if (!response.ok) {
    const message = `${providerLabel} status check failed (${response.status})`;
    if (response.status >= 400 && response.status < 500) {
      throw new PermanentStatusError(message);
    }
    throw new Error(message);
  }

  return response.json();
}

function extractReplicateUrl(output: unknown): string | null {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) {
    const first = output.find((item) => typeof item === 'string');
    if (typeof first === 'string') return first;
    return extractReplicateUrl(output[0]);
  }
  if (output && typeof output === 'object') {
    const record = output as Record<string, unknown>;
    if (typeof record.url === 'string') return record.url;
    if (typeof record.uri === 'string') return record.uri;
    if (record.video) return extractReplicateUrl(record.video);
    if (record.image) return extractReplicateUrl(record.image);
  }
  return null;
}

function extractFalUrl(data: Record<string, unknown>): string | null {
  const video = data.video as Record<string, unknown> | undefined;
  if (typeof video?.url === 'string') return video.url;

  const images = data.images as Array<Record<string, unknown>> | undefined;
  if (typeof images?.[0]?.url === 'string') return images[0].url as string;

  const image = data.image as Record<string, unknown> | undefined;
  if (typeof image?.url === 'string') return image.url;

  const output = data.output as Record<string, unknown> | string | undefined;
  return extractReplicateUrl(output) || (typeof data.url === 'string' ? data.url : null);
}

async function pollProvider(job: GenerationJobContext) {
  const { provider, providerJobId, modelId, apiKey } = job;

  switch (provider) {
    case 'replicate': {
      const response = await fetch(
        `https://api.replicate.com/v1/predictions/${encodeURIComponent(providerJobId)}`,
        { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
      );
      const data = await readProviderJson(response, 'Replicate');

      if (data.status === 'succeeded') {
        const resultUrl = extractReplicateUrl(data.output);
        if (!resultUrl) {
          return { status: 'failed', error: 'Replicate completed without a media URL' };
        }
        return { status: 'completed', resultUrl, urls: [resultUrl] };
      }
      if (data.status === 'failed' || data.status === 'canceled') {
        return { status: 'failed', error: data.error || `Replicate job ${data.status}` };
      }
      return { status: 'processing' };
    }

    case 'fal': {
      if (!modelId) {
        return { status: 'failed', error: 'Fal model id is missing from the job' };
      }

      const base = `https://queue.fal.run/${modelId}/requests/${encodeURIComponent(providerJobId)}`;
      const statusResponse = await fetch(`${base}/status`, {
        headers: { Authorization: `Key ${apiKey}` },
        cache: 'no-store',
      });
      const statusData = await readProviderJson(statusResponse, 'Fal.ai');

      if (statusData.status === 'COMPLETED') {
        const resultResponse = await fetch(`${base}/response`, {
          headers: { Authorization: `Key ${apiKey}` },
          cache: 'no-store',
        });
        const resultData = (await readProviderJson(
          resultResponse,
          'Fal.ai result',
        )) as Record<string, unknown>;
        const resultUrl = extractFalUrl(resultData);
        if (!resultUrl) {
          return { status: 'failed', error: 'Fal.ai completed without a media URL' };
        }
        return { status: 'completed', resultUrl, urls: [resultUrl] };
      }
      if (statusData.status === 'FAILED') {
        return { status: 'failed', error: statusData.error || 'Fal.ai generation failed' };
      }
      return { status: 'processing' };
    }

    case 'bfl': {
      const response = await fetch(
        `https://api.bfl.ml/v1/get_result?id=${encodeURIComponent(providerJobId)}`,
        { headers: { 'X-Key': apiKey }, cache: 'no-store' },
      );
      const data = await readProviderJson(response, 'Black Forest Labs');
      if (data.status === 'Ready') {
        const resultUrl = data.result?.sample;
        return resultUrl
          ? { status: 'completed', resultUrl, urls: [resultUrl] }
          : { status: 'failed', error: 'BFL completed without a media URL' };
      }
      if (data.status === 'Failed') {
        return { status: 'failed', error: data.error || 'BFL generation failed' };
      }
      return { status: 'processing' };
    }

    case 'leonardo': {
      const response = await fetch(
        `https://cloud.leonardo.ai/api/rest/v1/generations/${encodeURIComponent(providerJobId)}`,
        { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
      );
      const data = await readProviderJson(response, 'Leonardo');
      const generation = data.generations_by_pk;
      if (generation?.status === 'COMPLETE') {
        const resultUrl = generation.generated_images?.[0]?.url;
        return resultUrl
          ? { status: 'completed', resultUrl, urls: [resultUrl] }
          : { status: 'failed', error: 'Leonardo completed without a media URL' };
      }
      if (generation?.status === 'FAILED') {
        return {
          status: 'failed',
          error: generation.failure_reason || 'Leonardo generation failed',
        };
      }
      return { status: 'processing' };
    }

    case 'runway': {
      const response = await fetch(
        `https://api.dev.runwayml.com/v1/tasks/${encodeURIComponent(providerJobId)}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'X-Runway-API-Version': '2024-11-06',
          },
          cache: 'no-store',
        },
      );
      const data = await readProviderJson(response, 'Runway');
      if (data.status === 'SUCCEEDED') {
        const resultUrl = extractReplicateUrl(data.output);
        return resultUrl
          ? { status: 'completed', resultUrl, urls: [resultUrl] }
          : { status: 'failed', error: 'Runway completed without a media URL' };
      }
      if (data.status === 'FAILED' || data.status === 'CANCELED') {
        return { status: 'failed', error: data.error || data.failure || 'Runway generation failed' };
      }
      return { status: 'processing' };
    }

    case 'luma': {
      const response = await fetch(
        `https://api.lumalabs.ai/dream-machine/v1/generations/${encodeURIComponent(providerJobId)}`,
        { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
      );
      const data = await readProviderJson(response, 'Luma');
      if (data.state === 'completed') {
        const resultUrl = data.assets?.video;
        return resultUrl
          ? { status: 'completed', resultUrl, urls: [resultUrl] }
          : { status: 'failed', error: 'Luma completed without a media URL' };
      }
      if (data.state === 'failed') {
        return { status: 'failed', error: data.failure_reason || 'Luma generation failed' };
      }
      return { status: 'processing' };
    }

    case 'google':
    case 'google-aistudio': {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${providerJobId}`,
        {
          headers: { 'x-goog-api-key': apiKey },
          cache: 'no-store',
        },
      );
      const data = await readProviderJson(response, 'Google Veo');
      if (data.done) {
        if (data.error) {
          return {
            status: 'failed',
            error: data.error.message || 'Google Veo generation failed',
          };
        }

        const resultUrl =
          data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
          data.response?.generatedVideos?.[0]?.video?.uri ||
          null;

        return resultUrl
          ? { status: 'completed', resultUrl, urls: [resultUrl] }
          : { status: 'failed', error: 'Google Veo completed without a media URL' };
      }
      return { status: 'processing' };
    }

    default:
      return { status: 'failed', error: `Status polling is not supported for ${provider}` };
  }
}

export async function POST(req: NextRequest) {
  let localToken: string | null = null;

  try {
    const body = (await req.json()) as { id?: string } & LegacyStatusContext;
    if (!body.id) return jsonResponse({ error: 'id is required' }, 400);

    localToken = body.id;
    const storedJob = getGenerationJob(body.id);
    const job: GenerationJobContext | null = storedJob ?? (
      body.provider && body.apiKey
        ? {
            provider: body.provider,
            providerJobId: body.id,
            modelId: body.modelId,
            apiKey: body.apiKey,
            createdAt: Date.now(),
          }
        : null
    );

    if (!job) {
      return jsonResponse(
        { status: 'failed', error: 'Generation job context is unavailable. Start the generation again.' },
        404,
      );
    }

    const result = await pollProvider(job);
    if (storedJob && (result.status === 'completed' || result.status === 'failed')) {
      deleteGenerationJob(body.id);
    }

    return jsonResponse(result);
  } catch (error) {
    if (localToken && error instanceof PermanentStatusError) {
      deleteGenerationJob(localToken);
      return jsonResponse({ status: 'failed', error: error.message });
    }

    console.error('Status check error:', error);
    return jsonResponse({ error: 'Failed to check generation status' }, 502);
  }
}

export async function GET() {
  return jsonResponse(
    { error: 'Status checks must use POST so credentials are never placed in the URL.' },
    405,
  );
}
