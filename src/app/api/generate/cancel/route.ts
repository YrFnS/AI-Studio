import { NextRequest } from 'next/server';

import {
  type GenerationCancellationResult,
} from '@/lib/generation-cancellation';
import { decodeGenerationJobToken } from '@/lib/generation-job';
import {
  deleteGenerationJob,
  getGenerationJob,
  type GenerationJobContext,
} from '@/lib/server-generation-store';
import {
  cancelGenerationRequestSchema,
  MAX_CANCEL_REQUEST_BYTES,
  parseGenerationRequest,
} from '@/lib/server/generation-request';
import {
  generationErrorResponse,
  noStoreJson,
} from '@/lib/server/generation-response';
import { cancelProviderGeneration } from '@/lib/server/generation-cancel';
import { ProviderRequestError } from '@/lib/server/provider-request';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function failedCancellation(
  providerId: string,
  error: ProviderRequestError,
): GenerationCancellationResult {
  return {
    outcome: 'failed',
    providerId,
    remoteAttempted: true,
    message: error.message,
  };
}

function cancellationPayload(
  result: GenerationCancellationResult,
): Record<string, unknown> {
  return {
    outcome: result.outcome,
    providerId: result.providerId,
    remoteAttempted: result.remoteAttempted,
    message: result.message,
  };
}

export async function POST(req: NextRequest) {
  let storedToken: string | null = null;
  let providerId = 'unknown';

  try {
    const body = await parseGenerationRequest(
      req,
      cancelGenerationRequestSchema,
      MAX_CANCEL_REQUEST_BYTES,
    );
    providerId = body.providerId;

    const storedJob = getGenerationJob(body.id);
    if (storedJob) storedToken = body.id;

    const decodedJob = decodeGenerationJobToken(body.id);
    if (decodedJob && decodedJob.providerId !== body.providerId) {
      return noStoreJson({
        error: 'The cancellation provider does not match the generation job.',
        code: 'provider_mismatch',
      }, 400);
    }

    const statelessJob: GenerationJobContext | null = decodedJob
      ? {
          provider: decodedJob.providerId,
          providerJobId: decodedJob.jobId,
          modelId: decodedJob.modelId,
          apiKey: body.apiKey,
          createdAt: Date.now(),
        }
      : null;

    const rawJob: GenerationJobContext = {
      provider: body.providerId,
      providerJobId: body.id,
      modelId: body.modelId,
      apiKey: body.apiKey,
      createdAt: Date.now(),
    };

    const job = storedJob ?? statelessJob ?? rawJob;
    const result = await cancelProviderGeneration({
      providerId: job.provider,
      providerJobId: job.providerJobId,
      modelId: job.modelId || body.modelId,
      apiKey: job.apiKey,
    });

    if (
      storedToken
      && (result.outcome === 'requested' || result.outcome === 'already-terminal')
    ) {
      deleteGenerationJob(storedToken);
    }

    return noStoreJson(cancellationPayload(result));
  } catch (error) {
    if (error instanceof ProviderRequestError) {
      return noStoreJson(cancellationPayload(
        failedCancellation(providerId, error),
      ));
    }

    return generationErrorResponse(error, {
      logLabel: 'Generation cancellation error',
      fallbackMessage: 'Failed to cancel the generation',
    });
  }
}

export async function GET() {
  return noStoreJson(
    { error: 'Generation cancellation must use POST.' },
    405,
  );
}
