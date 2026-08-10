import { promises as fs } from 'node:fs';
import path from 'node:path';

const filePath = path.join(
  process.cwd(),
  'src/components/studio/video-studio.tsx',
);
let source = await fs.readFile(filePath, 'utf8');

const oldValue = `    const requiredCapability = referenceImageUrl || state.videoStartFrameUrl ? 'i2v' : 't2v';
    const vModels = provData?.models.filter((model) => (
      model.type === 'video'
      && (model.capabilities || '').split(',').includes(requiredCapability)
    )) ?? [];`;
const newValue = `    const vModels = provData?.models.filter((model) => (
      model.type === 'video'
      && (model.capabilities || '').split(',').includes(requiredCapability)
    )) ?? [];`;

if (!source.includes(oldValue)) {
  throw new Error('Could not locate duplicate Video Studio registry capability declaration');
}
source = source.replace(oldValue, newValue);
await fs.writeFile(filePath, source, 'utf8');
