import { NextRequest } from 'next/server';

import { getProtectedMedia } from '@/lib/server-media-store';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const media = getProtectedMedia(token);

  if (!media) {
    return Response.json(
      { error: 'Media link expired or was not found' },
      { status: 404 },
    );
  }

  const headers = new Headers(media.headers);
  const range = req.headers.get('range');
  if (range) headers.set('Range', range);

  const upstream = await fetch(media.url, {
    headers,
    redirect: 'follow',
    cache: 'no-store',
  });

  if (!upstream.ok && upstream.status !== 206) {
    return Response.json(
      { error: `Provider media request failed (${upstream.status})` },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  for (const name of [
    'accept-ranges',
    'content-length',
    'content-range',
    'content-type',
    'etag',
    'last-modified',
  ]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  responseHeaders.set('Cache-Control', 'private, no-store');
  responseHeaders.set('Content-Disposition', 'inline');

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
