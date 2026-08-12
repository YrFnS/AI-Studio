/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';

import {
  approveModelRegistration,
  createDraftModelRegistration,
  getModelAdapterProfile,
  getModelAdapterProfiles,
  requireApprovedModelRegistration,
  type ApprovedModelRegistration,
} from './model-registration';
import {
  decorateProviderCatalogWithApprovedRegistrations,
  findApprovedModelRegistration,
  resolveGenerationRequestRegistrationContext,
} from './model-registration-client';

function approvedReplicateModel(
  overrides: Partial<ApprovedModelRegistration> = {},
): ApprovedModelRegistration {
  const draft = createDraftModelRegistration({
    source: 'custom',
    sourceId: 'candidate-1',
    providerId: 'replicate',
    providerName: 'replicate',
    providerDisplayName: 'Replicate',
    modelId: 'owner/new-image-model',
    modelName: 'New Image Model',
    type: 'image',
    profileId: 'replicate.prediction.text-to-image',
    now: 1_000,
  });
  return {
    ...approveModelRegistration(draft, {
      docsUrl: 'https://replicate.com/owner/new-image-model/api',
      reviewNotes: 'Reviewed prompt input and the prediction output URL contract.',
      reviewerAcknowledged: true,
      now: 2_000,
    }),
    ...overrides,
  };
}

describe('reviewed model registration', () => {
  test('offers only explicitly bounded adapter profiles', () => {
    const replicate = getModelAdapterProfiles({
      providerName: 'replicate',
      type: 'image',
    });
    expect(replicate.map((profile) => profile.operation)).toEqual([
      'text-to-image',
      'image-to-image',
    ]);
    expect(getModelAdapterProfiles({ providerName: 'runway' })).toEqual([]);
    expect(getModelAdapterProfiles({ providerName: 'openai' })).toEqual([]);
  });

  test('creates inert drafts before approval', () => {
    const draft = createDraftModelRegistration({
      source: 'discovered',
      sourceId: 'discovered-1',
      providerId: 'huggingface',
      providerName: 'huggingface',
      providerDisplayName: 'Hugging Face',
      modelId: 'owner/model',
      modelName: 'Owner Model',
      type: 'image',
      profileId: 'huggingface.inference.text-to-image',
      now: 50,
    });

    expect(draft.status).toBe('draft');
    expect(draft.reviewerAcknowledged).toBe(false);
    expect(draft.operation).toBe('text-to-image');
    expect(draft.route).toBe('image');
  });

  test('requires HTTPS documentation, meaningful notes, and acknowledgement', () => {
    const draft = createDraftModelRegistration({
      source: 'custom',
      sourceId: 'candidate-1',
      providerId: 'fal',
      providerName: 'fal',
      providerDisplayName: 'fal',
      modelId: 'owner/model',
      modelName: 'Model',
      type: 'image',
      profileId: 'fal.queue.text-to-image',
    });

    expect(() => approveModelRegistration(draft, {
      docsUrl: 'http://example.com/model',
      reviewNotes: 'Too short',
      reviewerAcknowledged: false,
    })).toThrow();
  });

  test('server validation binds approval to provider, model, operation, and route', () => {
    const approved = approvedReplicateModel();
    expect(requireApprovedModelRegistration(approved, {
      providerName: 'replicate',
      modelId: 'owner/new-image-model',
      operation: 'text-to-image',
      route: 'image',
    }).id).toBe(approved.id);

    expect(() => requireApprovedModelRegistration(approved, {
      providerName: 'replicate',
      modelId: 'owner/new-image-model',
      operation: 'image-to-image',
      route: 'image',
    })).toThrow('does not match');
  });

  test('rejects unsafe or profile-incompatible model identifiers', () => {
    const profile = getModelAdapterProfile('replicate.prediction.text-to-image');
    expect(profile).not.toBeNull();
    expect(() => createDraftModelRegistration({
      source: 'custom',
      sourceId: 'candidate-1',
      providerId: 'replicate',
      providerName: 'replicate',
      providerDisplayName: 'Replicate',
      modelId: 'https://attacker.example/model',
      modelName: 'Unsafe',
      type: 'image',
      profileId: profile!.id,
    })).toThrow();
  });

  test('adds approved models to executable provider catalogs', async () => {
    const approved = approvedReplicateModel();
    const providers = await decorateProviderCatalogWithApprovedRegistrations([
      {
        id: 'replicate',
        name: 'replicate',
        displayName: 'Replicate',
        models: [],
      },
    ], [approved]);

    expect(providers[0].models[0]).toMatchObject({
      modelId: 'owner/new-image-model',
      operations: ['text-to-image'],
      isReviewedRegistration: true,
    });
  });

  test('never exposes drafts or revoked registrations', async () => {
    const approved = approvedReplicateModel();
    const found = await findApprovedModelRegistration({
      providerId: 'replicate',
      modelId: approved.modelId,
      operation: 'text-to-image',
      route: 'image',
      registrations: [
        { ...approved, status: 'draft' },
        { ...approved, status: 'revoked', id: `${approved.id}-revoked` },
      ],
    });
    expect(found).toBeNull();
  });

  test('maps generation endpoints to the exact reviewed operation', () => {
    expect(resolveGenerationRequestRegistrationContext(
      '/api/generate/image',
      { prompt: 'hello' },
    )).toEqual({ operation: 'text-to-image', route: 'image' });
    expect(resolveGenerationRequestRegistrationContext(
      '/api/generate/image',
      { prompt: 'hello', inputImageUrl: 'data:image/png;base64,abc' },
    )).toEqual({ operation: 'image-to-image', route: 'image' });
    expect(resolveGenerationRequestRegistrationContext(
      '/api/generate/cancel',
      {},
    )).toBeNull();
  });
});
