import { NextRequest, NextResponse } from 'next/server';

import {
  MAX_REFERENCE_IMAGE_BYTES,
  MAX_REFERENCE_IMAGE_LABEL,
  REFERENCE_IMAGE_MIME_TYPES,
} from '@/lib/reference-image-limits';

const MAX_MULTIPART_BYTES = MAX_REFERENCE_IMAGE_BYTES + 1024 * 1024;

function json(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(req: NextRequest) {
  try {
    const declaredLength = Number(req.headers.get('content-length') || 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_BYTES) {
      return json({
        error: `File exceeds the ${MAX_REFERENCE_IMAGE_LABEL} limit`,
        code: 'image_too_large',
      }, 413);
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return json({ error: 'No file provided', code: 'missing_file' }, 400);
    }

    if (!REFERENCE_IMAGE_MIME_TYPES.includes(
      file.type as (typeof REFERENCE_IMAGE_MIME_TYPES)[number],
    )) {
      return json({
        error: 'File must be PNG, JPEG, WebP, or GIF',
        code: 'unsupported_image_type',
      }, 400);
    }

    if (file.size > MAX_REFERENCE_IMAGE_BYTES) {
      return json({
        error: `File exceeds the ${MAX_REFERENCE_IMAGE_LABEL} limit`,
        code: 'image_too_large',
      }, 413);
    }

    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > MAX_REFERENCE_IMAGE_BYTES) {
      return json({
        error: `File exceeds the ${MAX_REFERENCE_IMAGE_LABEL} limit`,
        code: 'image_too_large',
      }, 413);
    }

    const base64 = Buffer.from(bytes).toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    return json({ url: dataUrl });
  } catch (error) {
    console.error('Upload error:', error);
    return json({ error: 'Upload failed', code: 'upload_failed' }, 500);
  }
}
