import { promises as fs } from 'node:fs';
import path from 'node:path';

const filePath = path.join(process.cwd(), 'src/lib/generation-lifecycle.test.ts');
let source = await fs.readFile(filePath, 'utf8');

const oldQueueExpectation = "    expect(updates.at(-1)).toEqual({ status: 'failed' });\n";
const newQueueExpectation = "    expect(updates.at(-1)).toEqual({\n      status: 'failed',\n      detail: 'Provider rejected request',\n    });\n";
if (!source.includes(newQueueExpectation)) {
  if (!source.includes(oldQueueExpectation)) {
    throw new Error('Could not locate lifecycle queue failure expectation');
  }
  source = source.replace(oldQueueExpectation, newQueueExpectation);
}

const oldCancellationFixture = `      pollImpl: async (_request, options) => {
        startPolling?.();
        return await new Promise((_, reject) => {
          options?.signal?.addEventListener('abort', () => {
            reject(new GenerationPollingError('Generation polling was cancelled', {
              code: 'aborted',
            }));
          }, { once: true });
        });
      },
      failImpl: async (_generation, error) => { failures.push(error); },
`;
const newCancellationFixture = `      pollImpl: async (_request, options) => {
        startPolling?.();
        return await new Promise((_, reject) => {
          options?.signal?.addEventListener('abort', () => {
            reject(new GenerationPollingError('Generation polling was cancelled', {
              code: 'aborted',
            }));
          }, { once: true });
        });
      },
      cancelImpl: async () => ({
        outcome: 'requested',
        providerId: 'replicate',
        remoteAttempted: true,
        message: 'Cancelled from the comparison dialog',
      }),
      failImpl: async (_generation, error) => { failures.push(error); },
`;
if (!source.includes(newCancellationFixture)) {
  if (!source.includes(oldCancellationFixture)) {
    throw new Error('Could not locate lifecycle cancellation fixture');
  }
  source = source.replace(oldCancellationFixture, newCancellationFixture);
}

await fs.writeFile(filePath, source, 'utf8');
