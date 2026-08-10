import { promises as fs } from 'node:fs';
import path from 'node:path';

const filePath = path.join(
  process.cwd(),
  'src/lib/server/image-input.ts',
);
let source = await fs.readFile(filePath, 'utf8');

const oldValue = '  let addresses: Awaited<ReturnType<typeof lookup>>;';
const newValue = '  let addresses: Array<{ address: string; family: number }>;';

if (!source.includes(newValue)) {
  if (!source.includes(oldValue)) {
    throw new Error('Could not locate image lookup result typing');
  }
  source = source.replace(oldValue, newValue);
}

await fs.writeFile(filePath, source, 'utf8');
