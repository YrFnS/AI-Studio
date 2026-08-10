export const MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_REFERENCE_IMAGE_LABEL = '10MB';

export const REFERENCE_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;

const REFERENCE_IMAGE_MIME_TYPE_SET = new Set<string>(
  REFERENCE_IMAGE_MIME_TYPES,
);

export interface ReferenceImageFileLike {
  size: number;
  type: string;
}

export function formatReferenceImageSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateReferenceImageFile(
  file: ReferenceImageFileLike,
): string | null {
  if (!REFERENCE_IMAGE_MIME_TYPE_SET.has(file.type)) {
    return 'Unsupported image type. Use PNG, JPEG, WebP, or GIF.';
  }

  if (!Number.isFinite(file.size) || file.size < 0) {
    return 'The selected image has an invalid size.';
  }

  if (file.size > MAX_REFERENCE_IMAGE_BYTES) {
    return `Image exceeds the ${MAX_REFERENCE_IMAGE_LABEL} limit (${formatReferenceImageSize(file.size)}).`;
  }

  return null;
}
