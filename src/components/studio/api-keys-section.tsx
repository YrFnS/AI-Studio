'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Key,
  Plus,
  Trash2,
  ExternalLink,
  Search,
  Shield,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  AlertCircle,
  FlaskConical,
  Globe,
  Lock,
} from 'lucide-react';

import { useAppStore } from '@/lib/store';
import { useApiKeys } from '@/hooks/use-api-keys';
import type { Provider } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  getKeyValidationHint,
  validateKeyFormat,
  maskKey,
  ProviderDot,
  getProviderEmoji,
} from './settings-helpers';

// ---------------------------------------------------------------------------
// API Keys Section
// ---------------------------------------------------------------------------

type FilterMode = 'all' | 'configured' | 'not-configured';

export function ApiKeysSection() {
  const { refreshProviders } = useAppStore();
  const apiKeysHook = useApiKeys();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [keyLabels, setKeyLabels] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | null>>({});
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

  // Fetch providers (metadata only — keys are now in IndexedDB) ----------------
  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/providers');
      if (!res.ok) throw new Error('Failed to fetch');
      const data: Provider[] = await res.json();
      setProviders(data);
    } catch {
      toast.error('Failed to load providers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // Filter & sort providers — use IndexedDB keys for key status ----------------
  const filteredProviders = useMemo(() => {
    let result = providers;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.displayName.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }

    if (filterMode === 'configured') {
      result = result.filter((p) => apiKeysHook.hasKey(p.id));
    } else if (filterMode === 'not-configured') {
      result = result.filter((p) => !apiKeysHook.hasKey(p.id));
    }

    // Group: with keys first, then without
    const withKeys = result.filter((p) => apiKeysHook.hasKey(p.id));
    const withoutKeys = result.filter((p) => !apiKeysHook.hasKey(p.id));

    return [...withKeys, ...withoutKeys];
  }, [providers, searchQuery, filterMode, apiKeysHook]);

  const configuredCount = apiKeysHook.configuredCount;
  const totalProviders = providers.length;

  // Save key — stored in IndexedDB (never sent to server for storage) ---------
  const handleSaveKey = useCallback(
    async (provider: Provider) => {
      const rawKey = keyInputs[provider.id]?.trim();
      if (!rawKey) {
        toast.error('Please enter an API key');
        return;
      }

      const validation = validateKeyFormat(rawKey, provider.keyFormat);
      if (!validation.valid) {
        toast.error(validation.message || 'Invalid key format');
        return;
      }

      setSaving((prev) => ({ ...prev, [provider.id]: true }));
      try {
        await apiKeysHook.saveKey(
          provider.id,
          rawKey,
          keyLabels[provider.id]?.trim() || `${provider.displayName} Key`
        );

        toast.success(`API key saved for ${provider.displayName}`);
        setKeyInputs((prev) => {
          const next = { ...prev };
          delete next[provider.id];
          return next;
        });
        setKeyLabels((prev) => {
          const next = { ...prev };
          delete next[provider.id];
          return next;
        });
        refreshProviders();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save key');
      } finally {
        setSaving((prev) => ({ ...prev, [provider.id]: false }));
      }
    },
    [keyInputs, keyLabels, apiKeysHook, refreshProviders]
  );

  // Remove key — from IndexedDB ------------------------------------------------
  const handleRemoveKey = useCallback(
    async (providerId: string, providerName: string) => {
      setDeleting((prev) => ({ ...prev, [providerId]: true }));
      try {
        await apiKeysHook.removeKey(providerId);
        toast.success(`API key removed from ${providerName}`);
        refreshProviders();
      } catch {
        toast.error('Failed to remove key');
      } finally {
        setDeleting((prev) => ({ ...prev, [providerId]: false }));
      }
    },
    [apiKeysHook, refreshProviders]
  );

  // Test key — sends key from IndexedDB to test endpoint -----------------------
  const handleTestKey = useCallback(
    async (provider: Provider) => {
      const storedKey = apiKeysHook.getKey(provider.id);
      if (!storedKey) return;

      setTesting((prev) => ({ ...prev, [provider.id]: true }));
      setTestResults((prev) => ({ ...prev, [provider.id]: null }));

      try {
        const res = await fetch('/api/keys/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providerId: provider.id, key: storedKey.key }),
        });
        const data = await res.json();

        if (data.valid) {
          setTestResults((prev) => ({ ...prev, [provider.id]: 'success' }));
          toast.success(data.message || `${provider.displayName} key is valid`);
        } else {
          setTestResults((prev) => ({ ...prev, [provider.id]: 'error' }));
          toast.error(data.message || `Key test failed for ${provider.displayName}`);
        }
      } catch {
        setTestResults((prev) => ({ ...prev, [provider.id]: 'error' }));
        toast.error('Connection test failed');
      } finally {
        setTesting((prev) => ({ ...prev, [provider.id]: false }));
        setTimeout(() => {
          setTestResults((prev) => ({ ...prev, [provider.id]: null }));
        }, 4000);
      }
    },
    [apiKeysHook]
  );

  // Render -------------------------------------------------------------------
  if (loading || apiKeysHook.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#d9ff00]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Key className="h-5 w-5 text-[#d9ff00]" />
            API Keys
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Keys are stored in your browser (IndexedDB) and never sent to our server. This is the BYOK security model.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className="gap-1.5 border-border bg-[#d9ff00]/5 text-sm px-3 py-1"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-[#d9ff00]" />
            <span className="text-[#d9ff00] font-bold">{configuredCount}</span>
            <span className="text-muted-foreground">/ {totalProviders}</span>
            <span className="text-muted-foreground">configured</span>
          </Badge>
        </div>
      </motion.div>

      {/* Search & Filters */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search providers..."
            className="pl-10 bg-surface border-border/60 placeholder:text-muted-foreground/50 input-neon-focus"
          />
        </div>
        <div className="flex items-center gap-1 bg-surface border border-border/40 rounded-lg p-1">
          {(['all', 'configured', 'not-configured'] as FilterMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                filterMode === mode
                  ? 'bg-[#d9ff00]/10 text-[#d9ff00] shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover'
              }`}
            >
              {mode === 'all' ? 'All' : mode === 'configured' ? 'Configured' : 'Missing'}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredProviders.map((provider, idx) => {
            const hasKey = apiKeysHook.hasKey(provider.id);
            const storedKey = apiKeysHook.getKey(provider.id);
            const keyValue = keyInputs[provider.id] || '';
            const labelValue = keyLabels[provider.id] || '';
            const isSaving = saving[provider.id] || false;
            const isDeleting = deleting[provider.id] || false;
            const isKeyVisible = showKeys[provider.id] || false;
            const isExpanded = expandedProvider === provider.id;
            const validation = keyValue ? validateKeyFormat(keyValue, provider.keyFormat) : null;
            const validationHint = getKeyValidationHint(provider.keyFormat);

            return (
              <motion.div
                key={provider.id}
                layout
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.25, type: 'spring', stiffness: 300, damping: 25, delay: idx * 0.02 }}
              >
                <Card
                  className={`glass overflow-hidden transition-all duration-300 card-hover-lift group relative ${
                    hasKey
                      ? 'border-[#d9ff00]/20 hover:border-[#d9ff00]/40 provider-card-configured'
                      : 'border-border/40 hover:border-border/70'
                  }`}
                >
                  {/* Provider color accent - top border */}
                  <div
                    className="h-1 w-full"
                    style={{
                      background: provider.color
                        ? `linear-gradient(90deg, ${provider.color}, ${provider.color}40)`
                        : 'linear-gradient(90deg, #666, #66640)',
                    }}
                  />

                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface border border-border/30 shrink-0 text-lg">
                          {getProviderEmoji(provider.name)}
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-base font-semibold text-foreground leading-tight flex items-center gap-2">
                            <ProviderDot color={provider.color} />
                            {provider.displayName}
                          </CardTitle>
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {provider.description}
                          </p>
                        </div>
                      </div>
                      {hasKey ? (
                        <Badge className="shrink-0 gap-1 bg-[#d9ff00]/10 text-[#d9ff00] border-[#d9ff00]/20 hover:bg-[#d9ff00]/15 badge-configured-pulse">
                          <Shield className="h-3 w-3" />
                          Configured
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="shrink-0 gap-1">
                          <AlertCircle className="h-3 w-3" />
                          No key
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {/* Key format hint & website link */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {provider.keyFormat && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface/80 border border-border/30 text-muted-foreground">
                          Format: {provider.keyFormat}
                        </span>
                      )}
                      {provider.website && (
                        <a
                          href={provider.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-muted-foreground hover:text-[#d9ff00] transition-colors flex items-center gap-1 ml-auto"
                        >
                          <Globe className="h-3 w-3" />
                          Get API Key
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>

                    {/* Existing key info */}
                    {hasKey && storedKey && (
                      <div className="rounded-lg bg-surface/80 border border-border/30 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Lock className="h-3 w-3" />
                            {storedKey.label || 'API Key'}
                          </Label>
                          <button
                            type="button"
                            onClick={() =>
                              setShowKeys((prev) => ({
                                ...prev,
                                [provider.id]: !prev[provider.id],
                              }))
                            }
                            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-surface-hover"
                          >
                            {isKeyVisible ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        <code className="block text-xs font-mono text-foreground/80 break-all">
                          {isKeyVisible ? storedKey.key : maskKey(storedKey.key)}
                        </code>
                      </div>
                    )}

                    {/* Expandable key input area */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-2 pt-1">
                            <Label htmlFor={`key-${provider.id}`} className="text-xs text-muted-foreground">
                              {hasKey ? 'Update API Key' : 'Add API Key'}
                            </Label>
                            <div className="relative">
                              <Input
                                id={`key-${provider.id}`}
                                type={showKeys[`${provider.id}-input`] ? 'text' : 'password'}
                                value={keyValue}
                                onChange={(e) =>
                                  setKeyInputs((prev) => ({ ...prev, [provider.id]: e.target.value }))
                                }
                                placeholder={`Enter ${provider.displayName} API key`}
                                className="bg-surface border-border/60 text-sm placeholder:text-muted-foreground/40 focus-visible:ring-[#d9ff00]/30 pr-10"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setShowKeys((prev) => ({
                                    ...prev,
                                    [`${provider.id}-input`]: !prev[`${provider.id}-input`],
                                  }))
                                }
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {showKeys[`${provider.id}-input`] ? (
                                  <EyeOff className="h-3.5 w-3.5" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>

                            {/* Validation hint */}
                            {(validationHint || validation) && (
                              <div className="flex items-center gap-1.5">
                                {validation ? (
                                  validation.valid ? (
                                    <CheckCircle2 className="h-3 w-3 text-[#d9ff00] shrink-0" />
                                  ) : (
                                    <XCircle className="h-3 w-3 text-destructive shrink-0" />
                                  )
                                ) : (
                                  <AlertCircle className="h-3 w-3 text-muted-foreground shrink-0" />
                                )}
                                <span
                                  className={`text-[11px] ${
                                    validation
                                      ? validation.valid
                                        ? 'text-[#d9ff00]'
                                        : 'text-destructive'
                                      : 'text-muted-foreground'
                                  }`}
                                >
                                  {validation
                                    ? validation.valid
                                      ? 'Valid format'
                                      : validation.message
                                    : `Format: ${provider.keyFormat || 'any'}`}
                                </span>
                              </div>
                            )}

                            {/* Optional label input */}
                            <Input
                              value={labelValue}
                              onChange={(e) =>
                                setKeyLabels((prev) => ({ ...prev, [provider.id]: e.target.value }))
                              }
                              placeholder="Label (optional, e.g. 'Work key')"
                              className="bg-surface border-border/60 text-sm placeholder:text-muted-foreground/40 focus-visible:ring-[#d9ff00]/30"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {!isExpanded && !hasKey && (
                        <Button
                          size="sm"
                          onClick={() => setExpandedProvider(provider.id)}
                          className="gap-1.5 bg-[#d9ff00] text-background hover:bg-[#c5eb00] disabled:opacity-50 btn-glow"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Key
                        </Button>
                      )}
                      {!isExpanded && hasKey && (
                        <Button
                          size="sm"
                          onClick={() => setExpandedProvider(provider.id)}
                          variant="outline"
                          className="gap-1.5 border-border/60 text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                        >
                          <Key className="h-3.5 w-3.5" />
                          Edit Key
                        </Button>
                      )}
                      {isExpanded && (
                        <Button
                          size="sm"
                          onClick={() => handleSaveKey(provider)}
                          disabled={isSaving || !keyValue.trim()}
                          className="gap-1.5 bg-[#d9ff00] text-background hover:bg-[#c5eb00] disabled:opacity-50 btn-glow"
                        >
                          {isSaving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Key className="h-3.5 w-3.5" />
                          )}
                          Save Key
                        </Button>
                      )}
                      {isExpanded && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setExpandedProvider(null);
                            setKeyInputs((prev) => { const n = { ...prev }; delete n[provider.id]; return n; });
                            setKeyLabels((prev) => { const n = { ...prev }; delete n[provider.id]; return n; });
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </Button>
                      )}
                      {hasKey && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTestKey(provider)}
                            disabled={testing[provider.id]}
                            className={`gap-1.5 border-border/60 transition-all duration-300 ${
                              testResults[provider.id] === 'success'
                                ? 'border-[#d9ff00]/40 text-[#d9ff00] bg-[#d9ff00]/5'
                                : testResults[provider.id] === 'error'
                                ? 'border-destructive/40 text-destructive bg-destructive/5'
                                : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover'
                            }`}
                          >
                            {testing[provider.id] ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : testResults[provider.id] === 'success' ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : testResults[provider.id] === 'error' ? (
                              <XCircle className="h-3.5 w-3.5" />
                            ) : (
                              <FlaskConical className="h-3.5 w-3.5" />
                            )}
                            {testing[provider.id] ? 'Testing...' : testResults[provider.id] === 'success' ? 'Valid' : testResults[provider.id] === 'error' ? 'Failed' : 'Test'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRemoveKey(provider.id, provider.displayName)}
                            disabled={isDeleting}
                            className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            {isDeleting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Remove
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredProviders.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-3 py-12 text-center"
        >
          <Search className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No providers match your search</p>
          {filterMode !== 'all' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFilterMode('all')}
              className="text-muted-foreground"
            >
              Show all providers
            </Button>
          )}
        </motion.div>
      )}
    </div>
  );
}
