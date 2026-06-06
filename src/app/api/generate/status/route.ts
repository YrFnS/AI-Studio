import { NextRequest, NextResponse } from 'next/server';

// Poll for generation status (for async providers like Replicate, Fal.ai, BFL, Leonardo, Runway, Luma)
// The client sends the provider name and job ID to poll
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('id');
    const apiKey = searchParams.get('apiKey');
    const providerName = searchParams.get('provider');
    const modelId = searchParams.get('modelId');

    if (!jobId) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    if (!apiKey) return NextResponse.json({ error: 'apiKey is required' }, { status: 400 });
    if (!providerName) return NextResponse.json({ error: 'provider is required' }, { status: 400 });

    let resultUrl: string | null = null;

    switch (providerName) {
      case 'replicate': {
        const res = await fetch(`https://api.replicate.com/v1/predictions/${jobId}`, { headers: { 'Authorization': `Bearer ${apiKey}` } });
        const data = await res.json();
        if (data.status === 'succeeded') resultUrl = Array.isArray(data.output) ? data.output[0] : data.output;
        else if (data.status === 'failed') return NextResponse.json({ status: 'failed', error: data.error });
        break;
      }
      case 'fal': {
        const res = await fetch(`https://queue.fal.run/${modelId || ''}/requests/${jobId}`, { headers: { 'Authorization': `Key ${apiKey}` } });
        const data = await res.json();
        if (data.status === 'COMPLETED') resultUrl = data.images?.[0]?.url || data.video?.url || data.output?.url;
        else if (data.status === 'FAILED') return NextResponse.json({ status: 'failed', error: data.error });
        break;
      }
      case 'bfl': {
        const res = await fetch(`https://api.bfl.ml/v1/get_result?id=${jobId}`, { headers: { 'X-Key': apiKey } });
        const data = await res.json();
        if (data.status === 'Ready') resultUrl = data.result?.sample;
        else if (data.status === 'Failed') return NextResponse.json({ status: 'failed', error: data.error });
        break;
      }
      case 'leonardo': {
        const res = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${jobId}`, { headers: { 'Authorization': `Bearer ${apiKey}` } });
        const data = await res.json();
        const genData = data.generations_by_pk;
        if (genData?.status === 'COMPLETE') resultUrl = genData.generated_images?.[0]?.url || null;
        else if (genData?.status === 'FAILED') return NextResponse.json({ status: 'failed', error: genData?.failure_reason || 'Leonardo generation failed' });
        break;
      }
      case 'runway': {
        const res = await fetch(`https://api.dev.runwayml.com/v1/tasks/${jobId}`, { headers: { 'Authorization': `Bearer ${apiKey}`, 'X-Runway-API-Version': '2024-11-06' } });
        const data = await res.json();
        if (data.status === 'SUCCEEDED') resultUrl = Array.isArray(data.output) ? data.output[0] : data.output;
        else if (data.status === 'FAILED') return NextResponse.json({ status: 'failed', error: data.error || data.failure || 'Runway generation failed' });
        break;
      }
      case 'luma': {
        const res = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${jobId}`, { headers: { 'Authorization': `Bearer ${apiKey}` } });
        const data = await res.json();
        if (data.state === 'completed') resultUrl = data.assets?.video || null;
        else if (data.state === 'failed') return NextResponse.json({ status: 'failed', error: data.failure_reason || 'Luma generation failed' });
        break;
      }
      case 'google': {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${jobId}?key=${apiKey}`);
        const data = await res.json();
        if (data.done) {
          if (data.error) return NextResponse.json({ status: 'failed', error: data.error.message || 'Google Veo generation failed' });
          resultUrl = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri || data.response?.video?.uri || data.response?.videos?.[0]?.signedUri || null;
          if (!resultUrl) { const videoBytes = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.bytesBase64Encoded; if (videoBytes) resultUrl = `data:video/mp4;base64,${videoBytes}`; }
        }
        break;
      }
      default:
        break;
    }

    if (resultUrl) return NextResponse.json({ status: 'completed', resultUrl });
    return NextResponse.json({ status: 'processing' });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
