import { NextResponse } from 'next/server';

import { GenerationRegistryError } from '@/lib/generation-registry';
import { GenerationRequestError } from '@/lib/server/generation-request';
import { ImageInputError } from '@/lib/server/image-input';
import { ProviderRequestError } from '@/lib/server/provider-request';

export function noStoreJson(
  payload: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export function generationErrorResponse(
  error: unknown,
  options: {
    logLabel: string;
    fallbackMessage: string;
  },
): NextResponse {
  if (error instanceof GenerationRequestError) {
    return noStoreJson({
      error: error.message,
      code: error.code,
      ...(error.issues ? { issues: error.issues } : {}),
    }, error.status);
  }

  if (error instanceof GenerationRegistryError) {
    return noStoreJson({
      error: error.message,
      code: error.code,
    }, error.status);
  }

  if (error instanceof ImageInputError) {
    return noStoreJson({
      error: error.message,
      code: error.code,
    }, error.status);
  }

  if (error instanceof ProviderRequestError) {
    console.warn(`${options.logLabel}: ${error.code}`, {
      provider: error.provider,
      providerStatus: error.providerStatus,
      retryable: error.retryable,
      details: error.details,
    });

    return noStoreJson({
      error: error.message,
      code: error.code,
      provider: error.provider,
      retryable: error.retryable,
    }, error.status);
  }

  console.error(options.logLabel, error);
  return noStoreJson({
    error: options.fallbackMessage,
    code: 'internal_error',
  }, 500);
}
