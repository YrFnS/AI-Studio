'use client';

import {
  getApprovedModelRegistrations,
  type ModelRegistrationRecord,
} from '@/lib/idb';
import {
  approvedRegistrationToContract,
  type ApprovedModelRegistration,
} from '@/lib/model-registration';
import {
  operationsToLegacyCapabilities,
  type GenerationOperationId,
  type GenerationRouteId,
  type ModelOperationContract,
} from '@/lib/generation-registry';
import { PROVIDERS } from '@/lib/providers-data';

interface ProviderCatalogModel {
  id: string;
  providerName?: string;
  name: string;
  modelId: string;
  type: string;
  capabilities?: string;
  operations?: readonly GenerationOperationId[];
  operationContracts?: readonly ModelOperationContract[];
  isDefault?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  createdAt?: string;
  [key: string]: unknown;
}

interface ProviderCatalogEntry {
  id: string;
  name: string;
  displayName: string;
  color?: string;
  models: ProviderCatalogModel[];
  operations?: readonly GenerationOperationId[];
  [key: string]: unknown;
}

export interface GenerationRequestRegistrationContext {
  operation: GenerationOperationId;
  route: GenerationRouteId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function resolveGenerationRequestRegistrationContext(
  pathname: string,
  payload: Record<string, unknown>,
): GenerationRequestRegistrationContext | null {
  switch (pathname) {
    case '/api/generate/image':
      return {
        operation: asString(payload.inputImageUrl)
          ? 'image-to-image'
          : 'text-to-image',
        route: 'image',
      };
    case '/api/generate/video':
      return {
        operation:
          asString(payload.imageUrl)
          || asString(payload.startFrameUrl)
            ? 'image-to-video'
            : 'text-to-video',
        route: 'video',
      };
    case '/api/generate/edit':
      return {
        operation: asString(payload.mask) ? 'inpaint' : 'edit',
        route: 'edit',
      };
    case '/api/generate/upscale':
      return { operation: 'upscale', route: 'upscale' };
    case '/api/generate/variations':
      return { operation: 'variation', route: 'variations' };
    case '/api/generate/img2vid':
      return { operation: 'image-to-video', route: 'img2vid' };
    default:
      return null;
  }
}

export async function findApprovedModelRegistration(options: {
  providerId: string;
  modelId: string;
  operation: GenerationOperationId;
  route: GenerationRouteId;
  registrations?: readonly ModelRegistrationRecord[];
}): Promise<ApprovedModelRegistration | null> {
  const registrations = options.registrations
    || await getApprovedModelRegistrations();
  return registrations.find((registration) => (
    registration.status === 'approved'
    && (registration.providerId === options.providerId
      || registration.providerName === options.providerId)
    && registration.modelId === options.modelId
    && registration.operation === options.operation
    && registration.route === options.route
  )) as ApprovedModelRegistration | undefined || null;
}

function groupRegistrations(
  registrations: readonly ModelRegistrationRecord[],
): Map<string, ApprovedModelRegistration[]> {
  const grouped = new Map<string, ApprovedModelRegistration[]>();
  for (const record of registrations) {
    if (record.status !== 'approved') continue;
    const registration = record as ApprovedModelRegistration;
    const key = `${registration.providerName}::${registration.modelId}`;
    const current = grouped.get(key) || [];
    current.push(registration);
    grouped.set(key, current);
  }
  return grouped;
}

function createProviderFromStatic(
  providerName: string,
): ProviderCatalogEntry | null {
  const provider = PROVIDERS.find((candidate) => (
    candidate.name === providerName || candidate.id === providerName
  ));
  if (!provider) return null;
  return {
    ...provider,
    models: [],
    operations: [],
  } as ProviderCatalogEntry;
}

export async function decorateProviderCatalogWithApprovedRegistrations(
  value: unknown,
  suppliedRegistrations?: readonly ModelRegistrationRecord[],
): Promise<ProviderCatalogEntry[]> {
  if (!Array.isArray(value)) return [];

  const providers = value
    .filter(isRecord)
    .map((provider) => ({
      ...provider,
      models: Array.isArray(provider.models)
        ? provider.models.filter(isRecord).map((model) => ({ ...model }))
        : [],
    })) as ProviderCatalogEntry[];

  const registrations = suppliedRegistrations
    || await getApprovedModelRegistrations();
  const grouped = groupRegistrations(registrations);

  for (const modelRegistrations of grouped.values()) {
    const first = modelRegistrations[0];
    let provider = providers.find((candidate) => (
      candidate.id === first.providerId
      || candidate.name === first.providerName
    ));

    if (!provider) {
      provider = createProviderFromStatic(first.providerName) || undefined;
      if (!provider) continue;
      providers.push(provider);
    }

    // Static registry entries remain authoritative and cannot be shadowed by a
    // locally reviewed registration with the same model id.
    if (provider.models.some((model) => model.modelId === first.modelId)) {
      continue;
    }

    const operations = [...new Set(
      modelRegistrations.map((registration) => registration.operation),
    )];
    const operationContracts = modelRegistrations.map(
      approvedRegistrationToContract,
    );

    provider.models.push({
      id: `reviewed-${first.id}`,
      providerName: first.providerName,
      name: first.modelName,
      modelId: first.modelId,
      type: first.type,
      capabilities: operationsToLegacyCapabilities(operations),
      operations,
      operationContracts,
      description:
        `Locally reviewed custom model. ${first.reviewNotes}`,
      priceInfo: 'User-reviewed provider contract',
      isDefault: false,
      isActive: true,
      sortOrder: 10_000,
      createdAt: new Date(first.createdAt).toISOString(),
      isReviewedRegistration: true,
      registrationIds: modelRegistrations.map((registration) => registration.id),
    });

    provider.operations = [...new Set([
      ...(provider.operations || []),
      ...operations,
    ])];
  }

  return providers;
}
