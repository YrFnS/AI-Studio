'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  saveApiKey as idbSaveKey,
  deleteApiKey as idbDeleteKey,
  getAllApiKeys,
  getApiKeyForProvider,
  StoredApiKey,
} from '@/lib/idb';

export function useApiKeys() {
  const [keys, setKeys] = useState<StoredApiKey[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const allKeys = await getAllApiKeys();
      setKeys(allKeys);
    } catch {
      // IndexedDB not available (SSR)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveKey = useCallback(
    async (providerId: string, key: string, label: string) => {
      await idbSaveKey(providerId, key, label);
      await refresh();
    },
    [refresh]
  );

  const removeKey = useCallback(
    async (providerId: string) => {
      await idbDeleteKey(providerId);
      await refresh();
    },
    [refresh]
  );

  const getKeyForProvider = useCallback(async (providerId: string) => {
    return getApiKeyForProvider(providerId);
  }, []);

  const configuredCount = keys.length;
  const configuredProviderIds = keys.map((k) => k.providerId);

  const hasKey = useCallback(
    (providerId: string) => {
      return keys.some((k) => k.providerId === providerId);
    },
    [keys]
  );

  const getKey = useCallback(
    (providerId: string) => {
      return keys.find((k) => k.providerId === providerId) || null;
    },
    [keys]
  );

  return {
    keys,
    loading,
    saveKey,
    removeKey,
    getKeyForProvider,
    configuredCount,
    configuredProviderIds,
    hasKey,
    getKey,
    refresh,
  };
}
