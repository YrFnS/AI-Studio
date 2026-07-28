import { NextRequest, NextResponse } from 'next/server';
import { decodeGenerationJobToken } from '@/lib/generation-job';

export const runtime = 'nodejs';

interface StatusInput {
  id?: string;
  apiKey?: string;
  provider?: string;
  modelId?: string;
}

function json(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function collectMediaUrls(value: unknown, depth = 0): string[] {
  if (depth > 5 || value === null || value === undefined) return [];

  if (typeof value === 'string') {
    if (
      value.startsWith('https://')
      || value.startsWith('http://')
      || value.startsWith('data:image/')
      || value.startsWith('data:video/')
      || value.startsWith('gs://')
    ) {
      return [value];
    }
    return [];
  }

  if (Array.isArray(value)) {
    return [...new Set(value.flatMap((item) => collectMediaUrls(item, depth + 1)))];
  }

  if (typeof value !== 'object') return [];

  const record = value as Record<string, unknown>;
  const preferredKeys = [
    'url', 'uri', 'resultUrl', 'sample', 'video', 'image', 'images', 'videos',
    'output', 'outputs', 'generatedVideos', 'generated_videos', 'assets',
    'predictions', 'response', 'data',
  ];

  const urls: string[] = [];
  for (const key of preferredKeys) {
    if (key in record) urls.push(...collectMediaUrls(record[key], depth + 1));
  }

  return [...new Set(urls)];
}

async function fetchJson(
  url: string,
  init: RequestInit,
  providerLabel: string,
): Promise<Record<string, unknown>> {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${providerLabel} status API error: ${response.status} - ${error}`);
  }
  return await response.json() as Record<string, unknown>;
}

async function readStatusInput(req: NextRequest): Promise<StatusInput> {
  const headerApiKey = req.headers.get('x-provider-api-key') || undefined;

  if (req.method === 'POST') {
    let body: StatusInput = {};
    try {
      body = await req.json() as StatusInput;
    } catch {
      body = {};
    }
    return { ...body, apiKey: headerApiKey || body.apiKey };
  }

  const { searchParams } = new URL(req.url);
  return {
    id: searchParams.get('id') || undefined,
    apiKey: headerApiKey || searchParams.get('apiKey') || undefined,
    provider: searchParams.get('provider') || undefined,
    modelId: searchParams.get('modelId') || undefined,
  };
}

async function pollProvider(
  providerId: string,
  jobId: string,
  modelId: string | undefined,
  apiKey: string,
): Promise<{ status: 'processing' | 'completed' | 'failed'; urls?: string[]; error?: string }> {
  switch (providerId) {
    case 'replicate': {
      const data = await fetchJson(
        `https://api.replicate.com/v1/predictions/${encodeURIComponent(jobId)}`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
        'Replicate',
      );
      const status = asString(data.status);
      if (status === 'succeeded') {
        return { status: 'completed', urls: collectMediaUrls(data.output) };
      }
      if (status === 'failed' || status === 'canceled') {
        return { status: 'failed', error: asString(data.error) || `Replicate job ${status}` };
      }
      return { status: 'processing' };
    }

    case 'fal': {
      if (!modelId) throw new Error('modelId is required to poll Fal.ai jobs');
      const baseUrl = `https://queue.fal.run/${modelId}/requests/${encodeURIComponent(jobId)}`;
      const headers = { Authorization: `Key ${apiKey}` };
      const statusData = await fetchJson(`${baseUrl}/status`, { headers }, 'Fal.ai');
      const status = asString(statusData.status)?.toUpperCase();

      if (status === 'COMPLETED') {
        const resultData = await fetchJson(baseUrl, { headers }, 'Fal.ai');
        return { status: 'completed', urls: collectMediaUrls(resultData) };
      }
      if (status === 'FAILED' || status === 'CANCELLED' || status === 'CANCELED') {
        return {
          status: 'failed',
          error: asString(statusData.error) || asString(statusData.detail) || `Fal.ai job ${status.toLowerCase()}`,
        };
      }
      return { status: 'processing' };
    }

    case 'bfl': {
      const data = await fetchJson(
        `https://api.bfl.ml/v1/get_result?id=${encodeURIComponent(jobId)}`,
        { headers: { 'X-Key': apiKey } },
        'Black Forest Labs',
      );
      const status = asString(data.status);
      if (status === 'Ready') return { status: 'completed', urls: collectMediaUrls(data.result) };
      if (status === 'Failed') {
        return { status: 'failed', error: asString(data.error) || 'BFL generation failed' };
      }
      return { status: 'processing' };
    }

    case 'leonardo': {
      const data = await fetchJson(
        `https://cloud.leonardo.ai/api/rest/v1/generations/${encodeURIComponent(jobId)}`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
        'Leonardo',
      );
      const generation = data.generations_by_pk as Record<string, unknown> | undefined;
      const status = asString(generation?.status);
      if (status === 'COMPLETE') {
        return { status: 'completed', urls: collectMediaUrls(generation?.generated_images) };
      }
      if (status === 'FAILED') {
        return {
          status: 'failed',
          error: asString(generation?.failure_reason) || 'Leonardo generation failed',
        };
      }
      return { status: 'processing' };
    }

    case 'runway': {
      const data = await fetchJson(
        `https://api.dev.runwayml.com/v1/tasks/${encodeURIComponent(jobId)}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'X-Runway-API-Version': '2024-11-06',
          },
        },
        'Runway',
      );
      const status = asString(data.status);
      if (status === 'SUCCEEDED') return { status: 'completed', urls: collectMediaUrls(data.output) };
      if (status === 'FAILED' || status === 'CANCELED') {
        return {
          status: 'failed',
          error: asString(data.error) || asString(data.failure) || `Runway job ${status.toLowerCase()}`,
        };
      }
      return { status: 'processing' };
    }

    case 'luma': {
      const data = await fetchJson(
        `https://api.lumalabs.ai/dream-machine/v1/generations/${encodeURIComponent(jobId)}`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
        'Luma',
      );
      const state = asString(data.state);
      if (state === 'completed') return { status: 'completed', urls: collectMediaUrls(data.assets) };
      if (state === 'failed') {
        return { status: 'failed', error: asString(data.failure_reason) || 'Luma generation failed' };
      }
      return { status: 'processing' };
    }

    case 'google':
    case 'google-aistudio': {
      const operationPath = jobId.replace(/^\/+/, '');
      const data = await fetchJson(
        `https://generativelanguage.googleapis.com/v1beta/${operationPath}`,
        { headers: { 'x-goog-api-key': apiKey } },
        'Google AI Studio',
      );

      if (data.done === true) {
        const error = data.error as Record<string, unknown> | undefined;
        if (error) {
          return {
            status: 'failed',
            error: asString(error.message) || 'Google Veo generation failed',
          };
        }

        const urls = collectMediaUrls(data.response);
        const response = data.response as Record<string, unknown> | undefined;
        const samples = response?.generateVideoResponse as Record<string, unknown> | undefined;
        const generatedSamples = samples?.generatedSamples as Array<Record<string, unknown>> | undefined;
        const video = generatedSamples?.[0]?.video as Record<string, unknown> | undefined;
        const bytes = asString(video?.bytesBase64Encoded);
        if (bytes) urls.push(`data:video/mp4;base64,${bytes}`);

        return { status: 'completed', urls: [...new Set(urls)] };
      }
      return { status: 'processing' };
    }

    default:
      throw new Error(`Status polling is not supported for provider: ${providerId}`);
  }
}

async function handleStatus(req: NextRequest) {
  try {
    const input = await readStatusInput(req);
    if (!input.id) return json({ error: 'id is required' }, 400);
    if (!input.apiKey) return json({ error: 'API key is required' }, 400);

    const token = decodeGenerationJobToken(input.id);
    const providerId = token?.providerId || input.provider;
    const modelId = token?.modelId || input.modelId;
    const jobId = token?.jobId || input.id;

    if (!providerId) {
      return json({
        error: 'provider is required for legacy job IDs. Start a new generation to receive a provider-aware job token.',
      }, 400);
    }

    const result = await pollProvider(providerId, jobId, modelId, input.apiKey);
    if (result.status === 'completed') {
      const urls = result.urls || [];
      if (urls.length === 0) {
        return json({ status: 'failed', error: 'Provider completed the job without returning a media URL' });
      }
      return json({ status: 'completed', resultUrl: urls[0], urls });
    }
    if (result.status === 'failed') {
      return json({ status: 'failed', error: result.error || 'Generation failed' });
    }
    return json({ status: 'processing' });
  } catch (error) {
    console.error('Status check error:', error);
    return json({
      error: error instanceof Error ? error.message : 'Failed to check status',
    }, 500);
  }
}

export async function GET(req: NextRequest) {
  return handleStatus(req);
}

export async function POST(req: NextRequest) {
  return handleStatus(req);
}
