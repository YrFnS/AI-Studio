'use client';

import { openAIStudioDatabase } from '@/lib/idb';
import { MAX_PROTECTED_MEDIA_BYTES } from '@/lib/protected-media';

export const AI_STUDIO_BACKUP_FORMAT = 'ai-studio-local-backup' as const;
export const AI_STUDIO_BACKUP_VERSION = 1 as const;
export const MAX_BACKUP_IMPORT_BYTES = 1024 * 1024 * 1024;

const BACKUP_STORE_NAMES = [
  'referenceImages',
  'generations',
  'prompts',
  'collections',
  'collectionItems',
  'customModels',
  'discoveredModels',
  'modelRegistrations',
  'mediaAssets',
] as const;

const REGULAR_STORE_NAMES = BACKUP_STORE_NAMES.filter(
  (name) => name !== 'mediaAssets',
) as Exclude<(typeof BACKUP_STORE_NAMES)[number], 'mediaAssets'>[];

const LOCAL_STORAGE_KEYS = [
  'ai-studio-prompt-history',
  'ai-studio-demo-data-v2',
  'ai-studio-p0-evidence-v1',
] as const;

const MAX_RECORDS_PER_STORE = 100_000;

type BackupStoreName = (typeof BACKUP_STORE_NAMES)[number];
type RegularBackupStoreName = Exclude<BackupStoreName, 'mediaAssets'>;

export interface BackupMediaAsset {
  id: string;
  generationId: string;
  mimeType: string;
  size: number;
  createdAt: number;
  base64: string;
}

export interface AIStudioBackupStores {
  referenceImages: Record<string, unknown>[];
  generations: Record<string, unknown>[];
  prompts: Record<string, unknown>[];
  collections: Record<string, unknown>[];
  collectionItems: Record<string, unknown>[];
  customModels: Record<string, unknown>[];
  discoveredModels: Record<string, unknown>[];
  modelRegistrations: Record<string, unknown>[];
  mediaAssets: BackupMediaAsset[];
}

export interface AIStudioLocalBackup {
  format: typeof AI_STUDIO_BACKUP_FORMAT;
  version: typeof AI_STUDIO_BACKUP_VERSION;
  app: 'ai-studio';
  exportedAt: string;
  databaseVersion: number;
  includesApiKeys: false;
  stores: AIStudioBackupStores;
  localStorage: Record<string, string | null>;
  summary: {
    totalRecords: number;
    mediaAssets: number;
    mediaBytes: number;
  };
}

export type BackupRestoreMode = 'replace' | 'merge';

export interface BackupRestoreSummary {
  mode: BackupRestoreMode;
  recordsImported: number;
  mediaAssetsImported: number;
  mediaBytesImported: number;
  storeCounts: Record<BackupStoreName, number>;
}

export class LocalBackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocalBackupError';
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(
      transaction.error || new Error('IndexedDB transaction was aborted'),
    );
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function expectString(
  record: Record<string, unknown>,
  key: string,
): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new LocalBackupError(`Backup media field ${key} is invalid`);
  }
  return value;
}


function validateGeneratedMediaMimeType(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length === 0
    || normalized.length > 128
    || (!normalized.startsWith('image/') && !normalized.startsWith('video/'))
  ) {
    throw new LocalBackupError('Backup media must use an image or video MIME type');
  }
  return normalized;
}

function expectFiniteNumber(
  record: Record<string, unknown>,
  key: string,
): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new LocalBackupError(`Backup media field ${key} is invalid`);
  }
  return value;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)),
    );
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw new LocalBackupError('Backup media contains invalid base64 data');
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function serializeBackupMediaAsset(
  value: unknown,
): Promise<BackupMediaAsset> {
  if (!isRecord(value) || !(value.blob instanceof Blob)) {
    throw new LocalBackupError('IndexedDB media asset is malformed');
  }

  const id = expectString(value, 'id');
  const generationId = expectString(value, 'generationId');
  const mimeType = validateGeneratedMediaMimeType(
    typeof value.mimeType === 'string' && value.mimeType.length > 0
      ? value.mimeType
      : value.blob.type,
  );
  const createdAt = expectFiniteNumber(value, 'createdAt');
  const size = value.blob.size;

  if (size > MAX_PROTECTED_MEDIA_BYTES) {
    throw new LocalBackupError(
      `Media asset ${id} exceeds the ${formatByteSize(MAX_PROTECTED_MEDIA_BYTES)} limit`,
    );
  }

  const base64 = bytesToBase64(new Uint8Array(await value.blob.arrayBuffer()));
  return { id, generationId, mimeType, size, createdAt, base64 };
}

export function deserializeBackupMediaAsset(
  value: unknown,
): Record<string, unknown> & { blob: Blob } {
  if (!isRecord(value)) {
    throw new LocalBackupError('Backup media asset is malformed');
  }

  const id = expectString(value, 'id');
  const generationId = expectString(value, 'generationId');
  const mimeType = validateGeneratedMediaMimeType(
    expectString(value, 'mimeType'),
  );
  const declaredSize = expectFiniteNumber(value, 'size');
  const createdAt = expectFiniteNumber(value, 'createdAt');
  const base64 = expectString(value, 'base64');
  const bytes = base64ToBytes(base64);

  if (bytes.byteLength !== declaredSize) {
    throw new LocalBackupError(`Backup media asset ${id} failed its size check`);
  }
  if (bytes.byteLength > MAX_PROTECTED_MEDIA_BYTES) {
    throw new LocalBackupError(
      `Backup media asset ${id} exceeds the ${formatByteSize(MAX_PROTECTED_MEDIA_BYTES)} limit`,
    );
  }

  const blobBytes = new Uint8Array(bytes.byteLength);
  blobBytes.set(bytes);

  return {
    id,
    generationId,
    mimeType,
    size: bytes.byteLength,
    createdAt,
    blob: new Blob([blobBytes.buffer], { type: mimeType }),
  };
}

function validateRegularStore(
  stores: Record<string, unknown>,
  name: RegularBackupStoreName,
): Record<string, unknown>[] {
  const value = stores[name];
  if (!Array.isArray(value)) {
    throw new LocalBackupError(`Backup store ${name} is missing`);
  }
  if (value.length > MAX_RECORDS_PER_STORE) {
    throw new LocalBackupError(`Backup store ${name} contains too many records`);
  }
  if (!value.every(isRecord)) {
    throw new LocalBackupError(`Backup store ${name} contains invalid records`);
  }
  return value;
}

export function validateAIStudioBackupDocument(
  value: unknown,
): AIStudioLocalBackup {
  if (!isRecord(value)) {
    throw new LocalBackupError('Backup must be a JSON object');
  }
  if (value.format !== AI_STUDIO_BACKUP_FORMAT || value.app !== 'ai-studio') {
    throw new LocalBackupError('This is not an AI Studio local backup');
  }
  if (value.version !== AI_STUDIO_BACKUP_VERSION) {
    throw new LocalBackupError(
      `Unsupported backup version: ${String(value.version)}`,
    );
  }
  if (value.includesApiKeys !== false) {
    throw new LocalBackupError(
      'Local data backups must not contain API keys. Import keys separately.',
    );
  }
  if (!isRecord(value.stores)) {
    throw new LocalBackupError('Backup stores are missing');
  }
  if (Object.prototype.hasOwnProperty.call(value.stores, 'api-keys')) {
    throw new LocalBackupError(
      'This backup unexpectedly contains API keys. Import keys separately.',
    );
  }

  const stores = value.stores;
  const regular = Object.fromEntries(
    REGULAR_STORE_NAMES.map((name) => [name, validateRegularStore(stores, name)]),
  ) as Omit<AIStudioBackupStores, 'mediaAssets'>;

  if (!Array.isArray(stores.mediaAssets)) {
    throw new LocalBackupError('Backup store mediaAssets is missing');
  }
  if (stores.mediaAssets.length > MAX_RECORDS_PER_STORE) {
    throw new LocalBackupError('Backup contains too many media assets');
  }
  for (const asset of stores.mediaAssets) {
    if (!isRecord(asset)) {
      throw new LocalBackupError('Backup contains an invalid media asset');
    }
  }

  const localStorageValues: Record<string, string | null> = {};
  if (isRecord(value.localStorage)) {
    for (const key of LOCAL_STORAGE_KEYS) {
      const entry = value.localStorage[key];
      localStorageValues[key] = typeof entry === 'string' ? entry : null;
    }
  }

  const mediaAssets = stores.mediaAssets as BackupMediaAsset[];
  const mediaBytes = mediaAssets.reduce((sum, asset) => {
    const size = typeof asset.size === 'number' && Number.isFinite(asset.size)
      ? asset.size
      : 0;
    return sum + Math.max(0, size);
  }, 0);
  const totalRecords = REGULAR_STORE_NAMES.reduce(
    (sum, name) => sum + regular[name].length,
    mediaAssets.length,
  );

  return {
    format: AI_STUDIO_BACKUP_FORMAT,
    version: AI_STUDIO_BACKUP_VERSION,
    app: 'ai-studio',
    exportedAt: typeof value.exportedAt === 'string'
      ? value.exportedAt
      : new Date(0).toISOString(),
    databaseVersion: typeof value.databaseVersion === 'number'
      ? value.databaseVersion
      : 0,
    includesApiKeys: false,
    stores: { ...regular, mediaAssets },
    localStorage: localStorageValues,
    summary: {
      totalRecords,
      mediaAssets: mediaAssets.length,
      mediaBytes,
    },
  };
}

export function parseAIStudioBackupText(text: string): AIStudioLocalBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new LocalBackupError('Backup file does not contain valid JSON');
  }
  return validateAIStudioBackupDocument(parsed);
}

async function readStoreRecords(
  database: IDBDatabase,
  name: RegularBackupStoreName,
): Promise<Record<string, unknown>[]> {
  const transaction = database.transaction(name, 'readonly');
  const records = await requestToPromise<unknown[]>(
    transaction.objectStore(name).getAll(),
  );
  await transactionComplete(transaction);
  if (!records.every(isRecord)) {
    throw new LocalBackupError(`IndexedDB store ${name} contains invalid data`);
  }
  return records;
}

export async function createAIStudioBackup(): Promise<AIStudioLocalBackup> {
  const database = await openAIStudioDatabase();
  const regularEntries = await Promise.all(
    REGULAR_STORE_NAMES.map(async (name) => [
      name,
      await readStoreRecords(database, name),
    ] as const),
  );
  const regular = Object.fromEntries(regularEntries) as Omit<
    AIStudioBackupStores,
    'mediaAssets'
  >;

  const mediaTransaction = database.transaction('mediaAssets', 'readonly');
  const rawMedia = await requestToPromise<unknown[]>(
    mediaTransaction.objectStore('mediaAssets').getAll(),
  );
  await transactionComplete(mediaTransaction);
  const mediaAssets = await Promise.all(rawMedia.map(serializeBackupMediaAsset));

  const localStorageValues: Record<string, string | null> = {};
  for (const key of LOCAL_STORAGE_KEYS) {
    localStorageValues[key] = window.localStorage.getItem(key);
  }

  const mediaBytes = mediaAssets.reduce((sum, asset) => sum + asset.size, 0);
  const totalRecords = REGULAR_STORE_NAMES.reduce(
    (sum, name) => sum + regular[name].length,
    mediaAssets.length,
  );

  return {
    format: AI_STUDIO_BACKUP_FORMAT,
    version: AI_STUDIO_BACKUP_VERSION,
    app: 'ai-studio',
    exportedAt: new Date().toISOString(),
    databaseVersion: database.version,
    includesApiKeys: false,
    stores: { ...regular, mediaAssets },
    localStorage: localStorageValues,
    summary: {
      totalRecords,
      mediaAssets: mediaAssets.length,
      mediaBytes,
    },
  };
}

export function downloadAIStudioBackup(backup: AIStudioLocalBackup): void {
  const blob = new Blob([JSON.stringify(backup)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `ai-studio-backup-${backup.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function readAIStudioBackupFile(
  file: File,
): Promise<AIStudioLocalBackup> {
  if (file.size > MAX_BACKUP_IMPORT_BYTES) {
    throw new LocalBackupError(
      `Backup file exceeds the ${formatByteSize(MAX_BACKUP_IMPORT_BYTES)} import limit`,
    );
  }
  return parseAIStudioBackupText(await file.text());
}

export async function restoreAIStudioBackup(
  backupInput: unknown,
  options: { mode?: BackupRestoreMode } = {},
): Promise<BackupRestoreSummary> {
  const backup = validateAIStudioBackupDocument(backupInput);
  const mode = options.mode || 'replace';
  const mediaAssets = backup.stores.mediaAssets.map(deserializeBackupMediaAsset);
  const database = await openAIStudioDatabase();
  const transaction = database.transaction([...BACKUP_STORE_NAMES], 'readwrite');

  if (mode === 'replace') {
    for (const name of BACKUP_STORE_NAMES) {
      transaction.objectStore(name).clear();
    }
  }

  for (const name of REGULAR_STORE_NAMES) {
    const store = transaction.objectStore(name);
    for (const record of backup.stores[name]) store.put(record);
  }
  const mediaStore = transaction.objectStore('mediaAssets');
  for (const asset of mediaAssets) mediaStore.put(asset);

  await transactionComplete(transaction);

  for (const key of LOCAL_STORAGE_KEYS) {
    const value = backup.localStorage[key];
    if (value === null || value === undefined) {
      if (mode === 'replace') window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  }
  // Prevent demo data from being added to a restored database on the next load.
  window.localStorage.setItem('ai-studio-demo-data-v2', 'seeded');

  const storeCounts = Object.fromEntries(
    BACKUP_STORE_NAMES.map((name) => [name, backup.stores[name].length]),
  ) as Record<BackupStoreName, number>;

  return {
    mode,
    recordsImported: Object.values(storeCounts).reduce((sum, count) => sum + count, 0),
    mediaAssetsImported: mediaAssets.length,
    mediaBytesImported: mediaAssets.reduce(
      (sum, asset) => sum + Number(asset.size || 0),
      0,
    ),
    storeCounts,
  };
}

export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / (1024 ** unitIndex);
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}
