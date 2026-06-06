import { NextRequest, NextResponse } from 'next/server';
import { MODELS } from '@/lib/providers-data';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const providerName = searchParams.get('providerName');
    const type = searchParams.get('type');

    let models = MODELS;
    if (providerName) models = models.filter((m) => m.providerName === providerName);
    if (type) models = models.filter((m) => m.type === type);

    return NextResponse.json(models);
  } catch (error) {
    console.error('Models GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
  }
}

// POST — no-op (models are now static, defined in providers-data.ts)
export async function POST() {
  return NextResponse.json({ message: 'Models are now managed through the static provider catalog. Edit src/lib/providers-data.ts to add custom models.' });
}

// DELETE — no-op
export async function DELETE() {
  return NextResponse.json({ success: true, message: 'Models are now managed through the static provider catalog.' });
}
