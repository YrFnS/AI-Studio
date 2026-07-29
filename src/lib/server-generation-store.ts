import { randomUUID } from 'node:crypto';

export interface GenerationJobContext {
  provider: string;
  providerJobId: string;
  modelId?: string;
  apiKey: string;
  createdAt: number;
}

type GenerationJobRegistryGlobal = typeof globalThis & {
  __aiStudioGenerationJobs?: Map<string, GenerationJobContext>;
};

const globalRegistry = globalThis as GenerationJobRegistryGlobal;
const generationJobs =
  globalRegistry.__aiStudioGenerationJobs ?? new Map<string, GenerationJobContext>();

if (!globalRegistry.__aiStudioGenerationJobs) {
  globalRegistry.__aiStudioGenerationJobs = generationJobs;
}

const JOB_TTL_MS = 2 * 60 * 60 * 1000;

function removeExpiredJobs(now = Date.now()): void {
  for (const [token, job] of generationJobs.entries()) {
    if (now - job.createdAt > JOB_TTL_MS) {
      generationJobs.delete(token);
    }
  }
}

export function registerGenerationJob(
  job: Omit<GenerationJobContext, 'createdAt'>,
): string {
  removeExpiredJobs();

  const token = randomUUID();
  generationJobs.set(token, {
    ...job,
    createdAt: Date.now(),
  });

  return token;
}

export function getGenerationJob(token: string): GenerationJobContext | null {
  removeExpiredJobs();
  return generationJobs.get(token) ?? null;
}

export function deleteGenerationJob(token: string): void {
  generationJobs.delete(token);
}
