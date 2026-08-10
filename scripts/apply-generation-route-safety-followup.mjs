import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function replaceRequired(source, oldValue, newValue, label) {
  if (source.includes(newValue)) return source;
  if (!source.includes(oldValue)) {
    throw new Error(`Could not locate ${label}`);
  }
  return source.replace(oldValue, newValue);
}

async function patchHandlers() {
  const filePath = path.join(root, 'src/app/api/generate/handlers.ts');
  let source = await fs.readFile(filePath, 'utf8');
  source = replaceRequired(
    source,
    "import { submitReplicatePrediction } from '@/lib/server/replicate';\n",
    "import { submitReplicatePrediction } from '@/lib/server/replicate';\nimport { providerFetch as fetch } from '@/lib/server/provider-request';\n",
    'provider request import in generation handlers',
  );
  await fs.writeFile(filePath, source, 'utf8');
}

async function patchImageUpload() {
  const filePath = path.join(root, 'src/components/studio/image-upload.tsx');
  let source = await fs.readFile(filePath, 'utf8');

  source = replaceRequired(
    source,
    "} from '@/components/ui/dialog';\n",
    "} from '@/components/ui/dialog';\nimport {\n  formatReferenceImageSize as formatFileSize,\n  MAX_REFERENCE_IMAGE_LABEL,\n  validateReferenceImageFile,\n} from '@/lib/reference-image-limits';\n",
    'shared image limit import in ImageUpload',
  );

  source = replaceRequired(
    source,
    `const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const ACCEPTED_EXTENSIONS = '.png,.jpeg,.jpg,.webp,.gif';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_FILE_SIZE_LABEL = '20MB';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return \`${'${bytes}'} B\`;
  if (bytes < 1024 * 1024) return \`${'${(bytes / 1024).toFixed(1)}'} KB\`;
  return \`${'${(bytes / (1024 * 1024)).toFixed(1)}'} MB\`;
}

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return \`Unsupported file type "${'${file.type}'}". Accepted: PNG, JPEG, WebP, GIF.\`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return \`File exceeds ${'${MAX_FILE_SIZE_LABEL}'} limit (${'${formatFileSize(file.size)}'}).\`;
  }
  return null;
}`,
    `const ACCEPTED_EXTENSIONS = '.png,.jpeg,.jpg,.webp,.gif';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateFile(file: File): string | null {
  return validateReferenceImageFile(file);
}`,
    'ImageUpload local file limits',
  );

  source = source.replaceAll('MAX_FILE_SIZE_LABEL', 'MAX_REFERENCE_IMAGE_LABEL');
  await fs.writeFile(filePath, source, 'utf8');
}

async function patchVideoStudio() {
  const filePath = path.join(root, 'src/components/studio/video-studio.tsx');
  let source = await fs.readFile(filePath, 'utf8');

  source = replaceRequired(
    source,
    "import { saveReferenceImage } from '@/lib/idb';\n",
    "import { saveReferenceImage } from '@/lib/idb';\nimport {\n  MAX_REFERENCE_IMAGE_LABEL,\n  validateReferenceImageFile,\n} from '@/lib/reference-image-limits';\n",
    'shared image limit import in Video Studio',
  );

  source = replaceRequired(
    source,
    `  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };`,
    `  const handleFile = (file: File) => {
    const error = validateReferenceImageFile(file);
    if (error) {
      toast.error(error);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };`,
    'Video Studio pre-FileReader validation',
  );

  source = source.replace(
    'PNG, JPG, WebP</p>',
    'PNG, JPG, WebP • Max {MAX_REFERENCE_IMAGE_LABEL}</p>',
  );
  await fs.writeFile(filePath, source, 'utf8');
}

async function patchImageStudio() {
  const filePath = path.join(root, 'src/components/studio/image-studio.tsx');
  let source = await fs.readFile(filePath, 'utf8');

  source = replaceRequired(
    source,
    "import { saveReferenceImage } from '@/lib/idb';\n",
    "import { saveReferenceImage } from '@/lib/idb';\nimport { validateReferenceImageFile } from '@/lib/reference-image-limits';\n",
    'shared image limit import in Image Studio',
  );

  source = replaceRequired(
    source,
    `                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          const reader = new FileReader();`,
    `                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          const error = validateReferenceImageFile(file);
                          if (error) {
                            toast.error(error);
                            return;
                          }
                          const reader = new FileReader();`,
    'Image Studio outfit picker validation',
  );

  source = replaceRequired(
    source,
    `                      const file = e.dataTransfer.files?.[0];
                      if (file && file.type.startsWith('image/')) {
                        const reader = new FileReader();`,
    `                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        const error = validateReferenceImageFile(file);
                        if (error) {
                          toast.error(error);
                          return;
                        }
                        const reader = new FileReader();`,
    'Image Studio outfit drop validation',
  );

  await fs.writeFile(filePath, source, 'utf8');
}

await patchHandlers();
await patchImageUpload();
await patchVideoStudio();
await patchImageStudio();
