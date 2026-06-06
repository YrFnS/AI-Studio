import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ success: true, modelsImported: 0, modelsSkipped: 0, note: 'Models are now managed through the static provider catalog in src/lib/providers-data.ts' });
}
