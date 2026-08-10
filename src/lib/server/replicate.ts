export interface ReplicatePredictionRequest {
  url: string;
  body: {
    input: Record<string, unknown>;
    version?: string;
  };
}

const VERSION_ID = /^[a-f0-9]{32,}$/i;
const OFFICIAL_MODEL = /^([^/:]+)\/([^/:]+)$/;
const VERSIONED_MODEL = /^([^/:]+)\/([^/:]+):([a-f0-9]{32,})$/i;

export class ReplicateModelReferenceError extends Error {
  constructor(modelId: string) {
    super(
      `Replicate model ${modelId} is not an official owner/name model or an immutable version reference.`,
    );
    this.name = 'ReplicateModelReferenceError';
  }
}

export function buildReplicatePredictionRequest(
  providerBaseUrl: string,
  modelId: string,
  input: Record<string, unknown>,
): ReplicatePredictionRequest {
  const baseUrl = providerBaseUrl.replace(/\/$/, '');
  const official = modelId.match(OFFICIAL_MODEL);
  if (official) {
    const owner = encodeURIComponent(official[1]);
    const name = encodeURIComponent(official[2]);
    return {
      url: `${baseUrl}/v1/models/${owner}/${name}/predictions`,
      body: { input },
    };
  }

  const versioned = modelId.match(VERSIONED_MODEL);
  if (versioned) {
    return {
      url: `${baseUrl}/v1/predictions`,
      body: { version: versioned[3], input },
    };
  }

  if (VERSION_ID.test(modelId)) {
    return {
      url: `${baseUrl}/v1/predictions`,
      body: { version: modelId, input },
    };
  }

  throw new ReplicateModelReferenceError(modelId);
}

export async function submitReplicatePrediction(
  providerBaseUrl: string,
  modelId: string,
  input: Record<string, unknown>,
  apiKey: string,
): Promise<Record<string, unknown>> {
  const request = buildReplicatePredictionRequest(
    providerBaseUrl,
    modelId,
    input,
  );
  const response = await fetch(request.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request.body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Replicate API error: ${response.status} - ${error}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}
