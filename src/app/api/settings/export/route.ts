import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ success: true, message: 'Settings export is no longer needed. All data is stored locally in your browser.' });
}
