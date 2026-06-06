import { NextResponse } from 'next/server';
import { PROVIDERS } from '@/lib/providers-data';

export async function GET() {
  try {
    return NextResponse.json(PROVIDERS);
  } catch (error) {
    console.error('Providers GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 });
  }
}
