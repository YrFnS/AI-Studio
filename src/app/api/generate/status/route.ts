import { NextRequest, NextResponse } from 'next/server';

type StatusInput = {
  id?: string;
  jobId?: string;
  apiKey?: string;
  provider?: string;
  providerId?: string;
  modelId?: string;
};

function normalizeProvider(value?: string): string {
  if (value === 'google-aistudio') return 'google';
  return value || '';
}

async function pollStatus(input: StatusInput) {
  const jobId = input.id || input.jobId;
  const apiKey = input.apiKey;
  const providerName = normalizeProvider(input.provider || input.providerId);
  const modelId = input.modelId;

  if (!jobId) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  if (!apiKey) return NextResponse.json({ error: 'apiKey is required' }, { status: 400 });
  if (!providerName) return NextResponse.json({ error: 'provider is required' }, { status: 400 });

  let resultUrl: string | null = null;

  switch (providerName) {
    case 'replicate': {
      const res = await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(jobId)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const data = await res.json();
      if (!res.ok) return NextResponse.json({ status: 'failed', error: data.detail || data.error || 'Replicate status check failed' });
      if (data.status === 'succeeded') resultUrl = Array.isArray(data.output) ? data.output[0] : data.output;
      else if (data.status === 'failed' || data.status === 'canceled') return NextResponse.json({ status: 'failed', error: data.error || `Replicate job ${data.status}` });
      break;
    }
    case 'fal': {
      if (!modelId) return NextResponse.json({ error: 'modelId is required for Fal.ai status checks' }, { status: 400 });
      const res = await fetch(`https://queue.fal.run/${modelId}/requests/${encodeURIComponent(jobId)}`, {
        headers: { Authorization: `Key ${apiKey}` },
      });
      const data = await res.json();
      if (!res.ok) return NextResponse.json({ status: 'failed', error: data.detail || data.error || 'Fal.ai status check failed' });
      if (data.status === 'COMPLETED') resultUrl = data.images?.[0]?.url || data.video?.url || data.output?.url;
      else if (data.status === 'FAILED') return NextResponse.json({ status: 'failed', error: data.error || 'Fal.ai generation failed' });
      break;
    }
    case 'bfl': {
      const res = await fetch(`https://api.bfl.ml/v1/get_result?id=${encodeURIComponent(jobId)}`, {
        headers: { 'X-Key': apiKey },
      });
      const data = await res.json();
      if (!res.ok) return NextResponse.json({ status: 'failed', error: data.detail || data.error || 'BFL status check failed' });
      if (data.status === 'Ready') resultUrl = data.result?.sample;
      else if (data.status === 'Failed') return NextResponse.json({ status: 'failed', error: data.error || 'BFL generation failed' });
      break;
    }
    case 'leonardo': {
      const res = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${encodeURIComponent(jobId)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const data = await res.json();
      if (!res.ok) return NextResponse.json({ status: 'failed', error: data.error || 'Leonardo status check failed' });
      const generation = data.generations_by_pk;
      if (generation?.status === 'COMPLETE') resultUrl = generation.generated_images?.[0]?.url || null;
      else if (generation?.status === 'FAILED') return NextResponse.json({ status: 'failed', error: generation.failure_reason || 'Leonardo generation failed' });
      break;
    }
    case 'runway': {
      const res = await fetch(`https://api.dev.runwayml.com/v1/tasks/${encodeURIComponent(jobId)}`, {
        headers: { Authorization: `Bearer ${apiKey}`, 'X-Runway-API-Version': '2024-11-06' },
      });
      const data = await res.json();
      if (!res.ok) return NextResponse.json({ status: 'failed', error: data.error || 'Runway status check failed' });
      if (data.status === 'SUCCEEDED') resultUrl = Array.isArray(data.output) ? data.output[0] : data.output;
      else if (data.status === 'FAILED') return NextResponse.json({ status: 'failed', error: data.error || data.failure || 'Runway generation failed' });
      break;
    }
    case 'luma': {
      const res = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${encodeURIComponent(jobId)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const data = await res.json();
      if (!res.ok) return NextResponse.json({ status: 'failed', error: data.detail || data.error || 'Luma status check failed' });
      if (data.state === 'completed') resultUrl = data.assets?.video || null;
      else if (data.state === 'failed') return NextResponse.json({ status: 'failed', error: data.failure_reason || 'Luma generation failed' });
      break;
    }
    case 'google': {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${jobId}?key=${encodeURIComponent(apiKey)}`);
      const data = await res.json();
      if (!res.ok) return NextResponse.json({ status: 'failed', error: data.error?.message || 'Google status check failed' });
      if (data.done) {
        if (data.error) return NextResponse.json({ status: 'failed', error: data.error.message || 'Google video generation failed' });
        resultUrl = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
          || data.response?.video?.uri
          || data.response?.videos?.[0]?.signedUri
          || null;
        if (!resultUrl) {
          const bytes = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.bytesBase64Encoded;
          if (bytes) resultUrl = `data:video/mp4;base64,${bytes}`;
        }
      }
      break;
    }
    case 'google-vertex':
      return NextResponse.json({ status: 'failed', error: 'Google Vertex polling requires project and location configuration that is not available in the browser-key flow.' });
    default:
      return NextResponse.json({ error: `Status polling is not supported for provider: ${providerName}` }, { status: 400 });
  }

  if (resultUrl) return NextResponse.json({ status: 'completed', resultUrl, urls: [resultUrl] });
  return NextResponse.json({ status: 'processing' });
}

export async function POST(req: NextRequest) {
  try {
    return await pollStatus(await req.json() as StatusInput);
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to check status' }, { status: 500 });
  }
}

// Backward compatibility for older clients. New code uses POST so API keys do not appear in URLs.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    return await pollStatus({
      id: searchParams.get('id') || undefined,
      apiKey: searchParams.get('apiKey') || undefined,
      provider: searchParams.get('provider') || undefined,
      modelId: searchParams.get('modelId') || undefined,
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to check status' }, { status: 500 });
  }
}
