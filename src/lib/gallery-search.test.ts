/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';

import { matchesGenerationSearch } from './gallery-search';

const generation = {
  prompt: 'Cinematic neon city after rain',
  negativePrompt: 'blurry low quality',
  providerId: 'replicate',
  providerName: 'Replicate',
  modelId: 'black-forest-labs/flux-pro',
  type: 'image',
  status: 'completed',
};

describe('Gallery-wide search', () => {
  test('matches prompts across multiple terms', () => {
    expect(matchesGenerationSearch(generation, 'neon rain')).toBe(true);
  });

  test('matches provider, model, negative prompt, type, and status metadata', () => {
    expect(matchesGenerationSearch(generation, 'replicate flux-pro')).toBe(true);
    expect(matchesGenerationSearch(generation, 'blurry image completed')).toBe(true);
  });

  test('is case-insensitive and rejects missing terms', () => {
    expect(matchesGenerationSearch(generation, 'CINEMATIC')).toBe(true);
    expect(matchesGenerationSearch(generation, 'cinematic desert')).toBe(false);
  });

  test('treats an empty query as a match', () => {
    expect(matchesGenerationSearch(generation, '   ')).toBe(true);
  });
});
