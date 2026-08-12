import { NextRequest, NextResponse } from 'next/server';
import { PROVIDERS } from '@/lib/providers-data';

const TEST_TIMEOUT_MS = 10_000;

function json(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function providerFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timeout);
  }
}

function verificationResult(
  response: Response,
  providerName: string,
): Record<string, unknown> {
  if (response.ok) {
    return {
      valid: true,
      message: `${providerName} accepted the API key`,
    };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      valid: false,
      message: `${providerName} rejected the API key`,
    };
  }

  return {
    valid: false,
    message: `${providerName} could not be verified (${response.status})`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      providerId?: unknown;
      key?: unknown;
    };
    const providerId = typeof body.providerId === 'string'
      ? body.providerId.trim()
      : '';
    const key = typeof body.key === 'string' ? body.key.trim() : '';

    if (!providerId || !key) {
      return json({ error: 'providerId and key are required' }, 400);
    }

    const provider = PROVIDERS.find(
      (item) => item.id === providerId || item.name === providerId,
    );
    if (!provider) {
      return json({ error: 'Provider not found' }, 404);
    }

    try {
      let response: Response | null = null;

      switch (provider.name) {
        case 'openai':
          response = await providerFetch('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${key}` },
          });
          break;
        case 'stability':
          response = await providerFetch('https://api.stability.ai/v1/engines/list', {
            headers: { Authorization: `Bearer ${key}` },
          });
          break;
        case 'replicate':
          response = await providerFetch('https://api.replicate.com/v1/models?limit=1', {
            headers: { Authorization: `Bearer ${key}` },
          });
          break;
        case 'google':
        case 'google-aistudio':
          response = await providerFetch(
            'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',
            { headers: { 'x-goog-api-key': key } },
          );
          break;
        case 'huggingface':
          response = await providerFetch('https://huggingface.co/api/whoami-v2', {
            headers: { Authorization: `Bearer ${key}` },
          });
          break;
        case 'together':
          response = await providerFetch('https://api.together.xyz/v1/models', {
            headers: { Authorization: `Bearer ${key}` },
          });
          break;
        case 'fireworks':
          response = await providerFetch(
            'https://api.fireworks.ai/inference/v1/models',
            { headers: { Authorization: `Bearer ${key}` } },
          );
          break;
        case 'aimlapi':
          response = await providerFetch('https://api.aimlapi.com/v1/models', {
            headers: { Authorization: `Bearer ${key}` },
          });
          break;
        default:
          return json({
            valid: false,
            unsupported: true,
            message: `Live key validation is not implemented for ${provider.displayName}. The key has not been verified.`,
          });
      }

      return json(verificationResult(response, provider.displayName));
    } catch (error) {
      const message = error instanceof Error && error.name === 'AbortError'
        ? `${provider.displayName} key test timed out`
        : `${provider.displayName} key test could not connect`;
      return json({ valid: false, message });
    }
  } catch {
    return json({ error: 'Failed to test key' }, 500);
  }
}
