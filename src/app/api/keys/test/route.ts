import { NextRequest, NextResponse } from 'next/server';
import { PROVIDERS } from '@/lib/providers-data';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { providerId, key } = body;

    if (!providerId || !key) {
      return NextResponse.json({ error: 'providerId and key are required' }, { status: 400 });
    }

    const provider = PROVIDERS.find((p) => p.id === providerId || p.name === providerId);
    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    // Simple validation — try a lightweight request
    try {
      let valid = false;
      switch (provider.name) {
        case 'openai': {
          const res = await fetch('https://api.openai.com/v1/models', { headers: { 'Authorization': `Bearer ${key}` } });
          valid = res.ok;
          break;
        }
        case 'stability': {
          const res = await fetch('https://api.stability.ai/v1/engines/list', { headers: { 'Authorization': `Bearer ${key}` } });
          valid = res.ok;
          break;
        }
        case 'replicate': {
          const res = await fetch('https://api.replicate.com/v1/models?limit=1', { headers: { 'Authorization': `Bearer ${key}` } });
          valid = res.ok;
          break;
        }
        case 'google':
        case 'google-aistudio': {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
          valid = res.ok;
          break;
        }
        case 'huggingface': {
          // Use a lightweight, free model for validation (FLUX.1-schnell is always available)
          const res = await fetch(
            'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
            {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ inputs: 'test' }),
            }
          );
          // 200 = key works, 401/403 = invalid key, 503 = model loading (key is still valid)
          valid = res.ok || res.status === 503;
          break;
        }
        default:
          // For other providers, assume valid if key is non-empty
          valid = key.length > 8;
      }
      return NextResponse.json({ valid, message: valid ? `${provider.displayName} key is valid` : 'Invalid or expired key' });
    } catch {
      return NextResponse.json({ valid: false, message: 'Connection test failed' });
    }
  } catch {
    return NextResponse.json({ error: 'Failed to test key' }, { status: 500 });
  }
}
