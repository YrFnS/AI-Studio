import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const filePath = path.join(root, 'src/lib/model-registration.ts');
let source = await fs.readFile(filePath, 'utf8');

const openAIProfile = `  {
    id: 'openai.images-generations.text-to-image',
    providerName: 'openai',
    type: 'image',
    operation: 'text-to-image',
    route: 'image',
    adapterId: 'openai.text-to-image',
    displayName: 'OpenAI Images · Text to Image',
    description: 'Uses the OpenAI Images generations request shape.',
    modelIdPattern: '^(?:gpt-image|dall-e)-[A-Za-z0-9._-]+$',
    modelIdHint: 'Use an OpenAI image model id beginning with gpt-image- or dall-e-.',
  },
`;

if (source.includes(openAIProfile)) {
  source = source.replace(openAIProfile, '');
}
if (source.includes('openai.images-generations.text-to-image')) {
  throw new Error('The over-broad OpenAI adapter profile remains after removal');
}

await fs.writeFile(filePath, source, 'utf8');
