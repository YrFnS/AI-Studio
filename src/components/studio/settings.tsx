'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Key,
  Plus,
  Trash2,
  ExternalLink,
  Search,
  Shield,
  Box,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  AlertCircle,
  Cpu,
  Globe,
  Zap,
  FlaskConical,
  Download,
  Upload,
  RotateCcw,
  Keyboard,
  Filter,
  Image as ImageIcon,
  Video,
  Settings2,
  ChevronDown,
  ChevronUp,
  FileJson,
  AlertTriangle,
  Lock,
  Sparkles,
  Pencil,
  Telescope,
} from 'lucide-react';

import { useAppStore } from '@/lib/store';
import { maskKey as idbMaskKey, getAllApiKeys, saveApiKey, deleteApiKey, clearAllApiKeys, saveCustomModel, getAllCustomModels, deleteCustomModel, type CustomModelRecord, clearDiscoveredModelsCache } from '@/lib/idb';
import { loadAllModels, getStaticProviders, providerSupportsDiscovery } from '@/lib/model-service';
import { useApiKeys } from '@/hooks/use-api-keys';
import type { ApiKeyRecord, ProviderModel, Provider, ModelWithProvider } from '@/lib/types';
import { CAPABILITY_OPTIONS } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ---------------------------------------------------------------------------
// Key format validation
// ---------------------------------------------------------------------------

const KEY_VALIDATION: Record<string, { pattern: RegExp; hint: string }> = {
  'sk-': { pattern: /^sk-[a-zA-Z0-9-_]{20,}$/, hint: 'Must start with sk- followed by 20+ characters' },
  'r8_': { pattern: /^r8_[a-zA-Z0-9-_]{10,}$/, hint: 'Must start with r8_ followed by 10+ characters' },
  'hf_': { pattern: /^hf_[a-zA-Z0-9-_]{10,}$/, hint: 'Must start with hf_ followed by 10+ characters' },
  'AIza': { pattern: /^(AIza[a-zA-Z0-9-_]{30,}|AQ[a-zA-Z0-9._-]{30,}|[a-zA-Z0-9._-]{35,})$/, hint: 'Google API key (AIza..., AQ..., or 35+ char key)' },
};

function getKeyValidationHint(keyFormat: string | undefined): string | null {
  if (!keyFormat) return null;
  for (const [prefix, val] of Object.entries(KEY_VALIDATION)) {
    if (keyFormat.startsWith(prefix)) return val.hint;
  }
  return null;
}

function validateKeyFormat(key: string, keyFormat: string | undefined): { valid: boolean; message?: string } {
  if (!key || key.trim().length < 8) {
    return { valid: false, message: 'Key must be at least 8 characters' };
  }
  if (!keyFormat) return { valid: true };

  for (const [prefix, val] of Object.entries(KEY_VALIDATION)) {
    if (keyFormat.startsWith(prefix)) {
      if (val.pattern.test(key)) return { valid: true };
      return { valid: false, message: val.hint };
    }
  }
  return { valid: true };
}

function maskKey(key: string): string {
  return idbMaskKey(key);
}

// ---------------------------------------------------------------------------
// Provider icon dot
// ---------------------------------------------------------------------------

function ProviderDot({ color, size = 'sm' }: { color?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'h-3 w-3', md: 'h-4 w-4', lg: 'h-5 w-5' };
  return (
    <span
      className={`inline-block rounded-full shrink-0 ring-2 ring-white/10 ${sizeClasses[size]}`}
      style={{ backgroundColor: color || '#888' }}
    />
  );
}

// ---------------------------------------------------------------------------
// Provider emoji map
// ---------------------------------------------------------------------------

const PROVIDER_EMOJIS: Record<string, string> = {
  openai: '🟢',
  stability: '🟣',
  replicate: '🔵',
  fal: '🟠',
  together: '🟡',
  fireworks: '🔴',
  huggingface: '🤗',
  ideogram: '🟤',
  leonardo: '🎨',
  recraft: '🔷',
  runway: '🎬',
  luma: '✨',
  seedance: '🌱',
  google: '🔵',
  'google-aistudio': '🔵',
  'google-vertex': '🟩',
  aimlapi: '🔑',
  bfl: '🔑',
  anthropic: '🟧',
  midjourney: '⛵',
};

function getProviderEmoji(name: string): string {
  return PROVIDER_EMOJIS[name.toLowerCase()] || '🔑';
}

// ---------------------------------------------------------------------------
// Capability badge colors
// ---------------------------------------------------------------------------

const CAPABILITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  t2i: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
  i2i: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  inpaint: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  upscale: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
  edit: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' },
  t2v: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  i2v: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
};

// ---------------------------------------------------------------------------
// API Keys Section
// ---------------------------------------------------------------------------

type FilterMode = 'all' | 'configured' | 'not-configured';

function ApiKeysSection() {
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
  const [savedProviderId, setSavedProviderId] = useState<string | null>(null);
  const [shakeProviderId, setShakeProviderId] = useState<string | null>(null);

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
        setShakeProviderId(provider.id);
        setTimeout(() => setShakeProviderId(null), 600);
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
        setSavedProviderId(provider.id);
        setTimeout(() => setSavedProviderId(null), 800);
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
                      ? 'border-[#d9ff00]/20 hover:border-[#d9ff00]/40 gradient-border-flow'
                      : 'border-border/40 hover:border-border/70'
                  } ${shakeProviderId === provider.id ? 'shake-animate' : ''}`}
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
                          <span className={savedProviderId === provider.id ? 'checkmark-pop' : ''}>
                            <Shield className="h-3 w-3" />
                          </span>
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

// ---------------------------------------------------------------------------
// Custom Models Section
// ---------------------------------------------------------------------------

function CustomModelsSection() {
  const apiKeysHook = useApiKeys();
  const [models, setModels] = useState<ModelWithProvider[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

  // Filter state
  const [modelSearch, setModelSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [capabilityFilter, setCapabilityFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Form state
  const [formProviderId, setFormProviderId] = useState('');
  const [formName, setFormName] = useState('');
  const [formModelId, setFormModelId] = useState('');
  const [formType, setFormType] = useState<'image' | 'video'>('image');
  const [formCapabilities, setFormCapabilities] = useState<string[]>(['t2i', 'i2i']);
  const [formDescription, setFormDescription] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [showCapabilityOverride, setShowCapabilityOverride] = useState(false);

  // Auto-detect & Discover state
  const [isAutoDetectedType, setIsAutoDetectedType] = useState(false);
  const [isAutoDetectedCapabilities, setIsAutoDetectedCapabilities] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveredModels, setDiscoveredModels] = useState<Array<{
    id: string;
    name: string;
    type: 'image' | 'video';
    capabilities: string[];
    alreadyAdded: boolean;
    description: string;
  }>>([]);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [selectedDiscoveredId, setSelectedDiscoveredId] = useState<string>('');

  // Discover state
  const [discovering, setDiscovering] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const hasFetchedRef = useRef(false);

  // Fetch models and providers ------------------------------------------------
  const fetchData = useCallback(async (options?: { fetchDynamic?: boolean; force?: boolean }) => {
    if (!options?.force && hasFetchedRef.current && !options?.fetchDynamic) return;
    try {
      setLoading(true);
      setRefreshError(null);

      // Get API keys for dynamic discovery
      const keys = apiKeysHook.keys;
      const apiKeyMap: Record<string, string> = {};
      for (const key of keys) {
        apiKeyMap[key.providerId] = key.key;
      }

      const allModels = await loadAllModels({
        fetchDynamic: options?.fetchDynamic ?? false,
        apiKeyMap,
      });

      setModels(allModels);

      // Load static provider definitions (for provider metadata like color, baseUrl)
      const staticProviders = getStaticProviders();
      // Enrich with API-key status
      const enrichedProviders = staticProviders.map((p) => ({
        ...p,
        hasKey: apiKeysHook.hasKey(p.id),
        supportsDiscovery: providerSupportsDiscovery(p.name),
      }));
      setProviders(enrichedProviders as Provider[]);
      hasFetchedRef.current = true;
    } catch {
      toast.error('Failed to load models');
    } finally {
      setLoading(false);
    }
  }, [apiKeysHook]);

  // Discover models from provider APIs
  const handleDiscover = useCallback(async () => {
    setDiscovering(true);
    setDiscoverError(null);
    try {
      await fetchData({ fetchDynamic: true, force: true });
      toast.success('Models refreshed from provider APIs');
    } catch {
      setRefreshError('Failed to discover models from providers');
    } finally {
      setDiscovering(false);
    }
  }, [fetchData]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Model stats ---------------------------------------------------------------
  const modelStats = useMemo(() => {
    const imageModels = models.filter((m) => m.type === 'image');
    const videoModels = models.filter((m) => m.type === 'video');
    const customModels = models.filter((m) => !m.isDefault);
    const allCapabilities = new Set(models.flatMap((m) => m.capabilities?.split(',').filter(Boolean) || []));
    return {
      total: models.length,
      image: imageModels.length,
      video: videoModels.length,
      custom: customModels.length,
      capabilities: allCapabilities.size,
    };
  }, [models]);

  // Filtered models -----------------------------------------------------------
  const filteredModels = useMemo(() => {
    let result = models;

    if (modelSearch.trim()) {
      const q = modelSearch.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.modelId.toLowerCase().includes(q) ||
          (m.description && m.description.toLowerCase().includes(q))
      );
    }

    if (providerFilter !== 'all') {
      result = result.filter((m) => m.provider?.name === providerFilter);
    }

    if (typeFilter !== 'all') {
      result = result.filter((m) => m.type === typeFilter);
    }

    if (capabilityFilter !== 'all') {
      result = result.filter((m) =>
        m.capabilities?.split(',').includes(capabilityFilter)
      );
    }

    return result;
  }, [models, modelSearch, providerFilter, typeFilter, capabilityFilter]);

  // Group models by provider --------------------------------------------------
  const groupedModels = useMemo(() => {
    const groups: Record<string, { provider: { name: string; displayName: string; color?: string }; models: ModelWithProvider[] }> = {};

    for (const model of filteredModels) {
      const pName = model.provider?.name || 'unknown';
      if (!groups[pName]) {
        groups[pName] = {
          provider: {
            name: pName,
            displayName: model.provider?.displayName || pName,
            color: model.provider?.color,
          },
          models: [],
        };
      }
      groups[pName].models.push(model);
    }

    const sorted = Object.entries(groups).sort(([, a], [, b]) => {
      const aUser = a.models.some((m) => !m.isDefault);
      const bUser = b.models.some((m) => !m.isDefault);
      if (aUser && !bUser) return -1;
      if (!aUser && bUser) return 1;
      return a.provider.displayName.localeCompare(b.provider.displayName);
    });

    return sorted;
  }, [filteredModels]);

  // Get default capabilities for a given type --------------------------------
  const getDefaultCapabilities = useCallback((type: 'image' | 'video'): string[] => {
    if (type === 'video') return ['t2v', 'i2v'];
    return ['t2i', 'i2i'];
  }, []);

  // Auto-detect type & capabilities from model ID patterns -------------------
  const detectFromModelId = useCallback((modelId: string): { type: 'image' | 'video'; capabilities: string[] } | null => {
    const id = modelId.toLowerCase();
    // Video patterns
    if (/video|vid|animate|cogvideox|modelscope|stable-video|svd|runway|luma|kling/.test(id)) {
      return { type: 'video', capabilities: ['t2v', 'i2v'] };
    }
    // Image with additional capabilities
    const caps: string[] = ['t2i', 'i2i'];
    let detected = false;
    if (/inpaint|fill/.test(id)) { caps.push('inpaint'); detected = true; }
    if (/upscale|upscaler/.test(id)) { caps.push('upscale'); detected = true; }
    if (/edit|instruct/.test(id)) { caps.push('edit'); detected = true; }
    if (detected) {
      return { type: 'image', capabilities: caps };
    }
    // Default: image with standard capabilities — no pattern override needed
    return null;
  }, []);

  // Auto-detect type when provider changes (based on existing models) ----------
  const handleProviderChange = useCallback((providerId: string) => {
    setFormProviderId(providerId);
    setDiscoveredModels([]);
    setDiscoverError(null);
    setSelectedDiscoveredId('');

    // Look at provider's existing models to determine primary type
    const providerModels = models.filter((m) => m.provider?.name === providerId);
    if (providerModels.length > 0) {
      const imageCount = providerModels.filter((m) => m.type === 'image').length;
      const videoCount = providerModels.filter((m) => m.type === 'video').length;
      const dominantType: 'image' | 'video' = videoCount > imageCount ? 'video' : 'image';
      const defaultCaps = getDefaultCapabilities(dominantType);
      setFormType(dominantType);
      setFormCapabilities(defaultCaps);
      setIsAutoDetectedType(true);
      setIsAutoDetectedCapabilities(true);
    } else {
      // No existing models for this provider — check provider name patterns
      const provider = providers.find((p) => p.id === providerId || p.name === providerId);
      const pName = (provider?.name || providerId).toLowerCase();
      if (/runway|luma|kling|seedance|cogvideo|modelscope/.test(pName)) {
        setFormType('video');
        setFormCapabilities(['t2v', 'i2v']);
      } else {
        setFormType('image');
        setFormCapabilities(['t2i', 'i2i']);
      }
      setIsAutoDetectedType(true);
      setIsAutoDetectedCapabilities(true);
    }
  }, [models, providers]);

  // Auto-detect from model ID input -------------------------------------------
  const handleModelIdChange = useCallback((value: string) => {
    setFormModelId(value);
    const detected = detectFromModelId(value);
    if (detected) {
      setFormType(detected.type);
      setFormCapabilities(detected.capabilities);
      setIsAutoDetectedType(true);
      setIsAutoDetectedCapabilities(true);
    }
  }, [detectFromModelId]);

  // Discover models from provider API -----------------------------------------
  const handleDiscoverModels = useCallback(async () => {
    if (!formProviderId) return;

    // Find the provider to get the provider name for the API call
    const provider = providers.find((p) => p.id === formProviderId || p.name === formProviderId);
    const providerName = provider?.name || formProviderId;

    // Check if user has API key
    const storedKey = apiKeysHook.getKey(formProviderId);
    if (!storedKey) {
      setDiscoverError('No API key found for this provider. Add an API key first.');
      return;
    }

    setIsDiscovering(true);
    setDiscoverError(null);
    setDiscoveredModels([]);
    setSelectedDiscoveredId('');

    try {
      const res = await fetch('/api/models/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: providerName, apiKey: storedKey.key }),
      });
      const data = await res.json();

      if (data.error) {
        setDiscoverError(data.error);
        return;
      }

      if (!data.success) {
        setDiscoverError(data.message || 'Discovery not supported for this provider.');
        return;
      }

      if (data.models && data.models.length > 0) {
        setDiscoveredModels(data.models);
        toast.success(`Found ${data.totalFound} models (${data.totalNew} new)`);
      } else {
        setDiscoverError(data.message || 'No models found for this provider.');
      }
    } catch {
      setDiscoverError('Failed to connect to discovery service.');
    } finally {
      setIsDiscovering(false);
    }
  }, [formProviderId, providers, apiKeysHook]);

  // Handle discovered model selection -----------------------------------------
  const handleSelectDiscovered = useCallback((modelId: string) => {
    setSelectedDiscoveredId(modelId);
    const model = discoveredModels.find((m) => m.id === modelId);
    if (model) {
      setFormName(model.name);
      setFormModelId(model.id);
      setFormType(model.type);
      // Use ALL capabilities from discovered model, not just primary
      const caps = model.capabilities.length > 0
        ? model.capabilities
        : getDefaultCapabilities(model.type);
      setFormCapabilities(caps);
      if (model.description) {
        setFormDescription(model.description);
      }
      setIsAutoDetectedType(true);
      setIsAutoDetectedCapabilities(true);
      setShowCapabilityOverride(false);
    }
  }, [discoveredModels, getDefaultCapabilities]);

  // Override auto-detected type -----------------------------------------------
  const handleTypeOverride = useCallback(() => {
    setIsAutoDetectedType(false);
    setIsAutoDetectedCapabilities(false);
  }, []);

  // Reset form ---------------------------------------------------------------
  const resetForm = useCallback(() => {
    setFormProviderId('');
    setFormName('');
    setFormModelId('');
    setFormType('image');
    setFormCapabilities(['t2i', 'i2i']);
    setFormDescription('');
    setIsAutoDetectedType(false);
    setIsAutoDetectedCapabilities(false);
    setShowCapabilityOverride(false);
    setDiscoveredModels([]);
    setDiscoverError(null);
    setSelectedDiscoveredId('');
  }, []);

  // Submit form --------------------------------------------------------------
  const handleSubmit = useCallback(async () => {
    if (!formProviderId) {
      toast.error('Please select a provider');
      return;
    }
    if (!formName.trim()) {
      toast.error('Please enter a model name');
      return;
    }
    if (!formModelId.trim()) {
      toast.error('Please enter a model ID');
      return;
    }
    if (formCapabilities.length === 0) {
      toast.error('At least one capability is required');
      return;
    }
    setFormSubmitting(true);
    try {
      const capabilities = formCapabilities.join(',');
      const provider = providers.find((p) => p.id === formProviderId || p.name === formProviderId);
      const providerName = provider?.displayName || provider?.name || formProviderId;

      await saveCustomModel({
        providerId: formProviderId,
        providerName,
        name: formName.trim(),
        modelId: formModelId.trim(),
        type: formType,
        capabilities,
        description: formDescription.trim() || undefined,
      });

      toast.success(`Model "${formName}" added successfully`);
      resetForm();
      setDialogOpen(false);
      fetchData({ force: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add model');
    } finally {
      setFormSubmitting(false);
    }
  }, [formProviderId, formName, formModelId, formType, formCapabilities, formDescription, resetForm, fetchData, providers]);

  // Delete model -------------------------------------------------------------
  const handleDeleteModel = useCallback(
    async (modelId: string, modelName: string) => {
      setDeleting((prev) => ({ ...prev, [modelId]: true }));
      try {
        await deleteCustomModel(modelId);
        toast.success(`Model "${modelName}" removed`);
        fetchData({ force: true });
      } catch {
        toast.error('Failed to delete model');
      } finally {
        setDeleting((prev) => ({ ...prev, [modelId]: false }));
      }
    },
    [fetchData]
  );

  // Render -------------------------------------------------------------------
  if (loading) {
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
            <Box className="h-5 w-5 text-[#d9ff00]" />
            Models
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and manage {modelStats.total} models across {providers.length} providers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleDiscover}
            disabled={discovering}
            variant="outline"
            className="gap-2 border-border/50 text-xs hover:border-[#d9ff00]/40 hover:text-[#d9ff00]"
          >
            {discovering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            {discovering ? 'Refreshing…' : 'Refresh from APIs'}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-[#d9ff00] text-background hover:bg-[#c5eb00]">
                <Plus className="h-4 w-4" />
                Add Custom Model
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-strong sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">Add Custom Model</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Add a new model to a provider. Make sure the model ID matches the API identifier.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Provider
                </Label>
                <Select value={formProviderId} onValueChange={handleProviderChange}>
                  <SelectTrigger className="bg-surface border-border/60">
                    <SelectValue placeholder="Select provider…" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-border/60">
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2">
                          <ProviderDot color={p.color} />
                          {p.displayName}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Discover from Provider */}
              {formProviderId && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Telescope className="h-3.5 w-3.5 text-[#d9ff00]" />
                      Discover from Provider
                    </Label>
                    {apiKeysHook.hasKey(formProviderId) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDiscoverModels}
                        disabled={isDiscovering}
                        className="gap-1.5 border-[#d9ff00]/30 text-[#d9ff00] hover:bg-[#d9ff00]/10 hover:text-[#d9ff00] h-7 text-xs px-2.5"
                      >
                        {isDiscovering ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Telescope className="h-3 w-3" />
                        )}
                        {isDiscovering ? 'Discovering…' : 'Discover Models'}
                      </Button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Add API key first to discover
                      </span>
                    )}
                  </div>
                  {discoverError && (
                    <div className="flex items-start gap-2 rounded-md bg-destructive/5 border border-destructive/20 p-2.5">
                      <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                      <p className="text-[11px] text-destructive/80">{discoverError}</p>
                    </div>
                  )}
                  {discoveredModels.length > 0 && (
                    <div className="space-y-2">
                      <Select value={selectedDiscoveredId} onValueChange={handleSelectDiscovered}>
                        <SelectTrigger className="bg-surface border-border/60">
                          <SelectValue placeholder={`Select from ${discoveredModels.length} discovered models…`} />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a1a] border-border/60 max-h-60">
                          {discoveredModels.map((m) => (
                            <SelectItem key={m.id} value={m.id} disabled={m.alreadyAdded}>
                              <span className="flex items-center gap-2">
                                {m.type === 'video' ? (
                                  <Video className="h-3 w-3 text-purple-400" />
                                ) : (
                                  <ImageIcon className="h-3 w-3 text-cyan-400" />
                                )}
                                <span className="truncate max-w-[200px]">{m.name}</span>
                                {m.alreadyAdded && (
                                  <Badge className="text-[9px] px-1 py-0 h-4 bg-muted text-muted-foreground border-0">
                                    Added
                                  </Badge>
                                )}
                                {!m.alreadyAdded && (
                                  <Badge className="text-[9px] px-1 py-0 h-4 bg-[#d9ff00]/10 text-[#d9ff00] border-[#d9ff00]/20">
                                    New
                                  </Badge>
                                )}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground/60">
                        {discoveredModels.filter((m) => !m.alreadyAdded).length} new · {discoveredModels.filter((m) => m.alreadyAdded).length} already added
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Model Name (Display)
                </Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. FLUX Pro v2"
                  className="bg-surface border-border/60 placeholder:text-muted-foreground/40 focus-visible:ring-[#d9ff00]/30"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Model ID (API Identifier)
                </Label>
                <Input
                  value={formModelId}
                  onChange={(e) => handleModelIdChange(e.target.value)}
                  placeholder="e.g. black-forest-labs/flux-pro-v2"
                  className="bg-surface border-border/60 font-mono text-sm placeholder:text-muted-foreground/40 focus-visible:ring-[#d9ff00]/30"
                />
                {formModelId && detectFromModelId(formModelId) && (
                  <p className="text-[10px] text-[#d9ff00]/70 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Type & capability auto-detected from model ID
                  </p>
                )}
              </div>
              {/* Auto-detected Type & Capabilities (read-only badges) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-[#d9ff00]" />
                    Model Type & Capabilities
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowCapabilityOverride(!showCapabilityOverride)}
                    className="text-muted-foreground hover:text-[#d9ff00] transition-colors flex items-center gap-1 text-[10px]"
                    title="Manually override auto-detected capabilities"
                  >
                    <Pencil className="h-3 w-3" />
                    {showCapabilityOverride ? 'Hide Override' : 'Override'}
                  </button>
                </div>

                {/* Auto-detected info card */}
                <div className="rounded-lg border border-border/30 bg-surface/50 p-3 space-y-2">
                  {/* Type badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Type:</span>
                    <Badge className={`gap-1 text-[10px] font-semibold ${
                      formType === 'image'
                        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                        : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                    }`}>
                      {formType === 'image' ? <Zap className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}
                      {formType === 'image' ? 'Image' : 'Video'}
                    </Badge>
                    {isAutoDetectedType && (
                      <span className="text-[9px] text-[#d9ff00]/60 flex items-center gap-0.5">
                        <Sparkles className="h-2.5 w-2.5" />
                        Auto-detected
                      </span>
                    )}
                  </div>

                  {/* Capabilities badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Caps:</span>
                    {formCapabilities.map((cap) => {
                      const capStyle = CAPABILITY_COLORS[cap] || { bg: 'bg-surface-hover', text: 'text-muted-foreground', border: 'border-border/30' };
                      const capLabel = CAPABILITY_OPTIONS.find((c) => c.id === cap)?.label || cap;
                      return (
                        <Badge
                          key={cap}
                          className={`text-[9px] font-medium ${capStyle.bg} ${capStyle.text} border ${capStyle.border}`}
                        >
                          {capLabel}
                        </Badge>
                      );
                    })}
                    {isAutoDetectedCapabilities && (
                      <span className="text-[9px] text-[#d9ff00]/60 flex items-center gap-0.5">
                        <Sparkles className="h-2.5 w-2.5" />
                        Auto
                      </span>
                    )}
                  </div>

                  {/* Explanation */}
                  <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
                    Type and capabilities are auto-detected from the provider and model ID.
                    {formCapabilities.length > 1 && ' This model supports multiple capabilities.'}
                  </p>
                </div>

                {/* Override section (collapsible) */}
                <AnimatePresence>
                  {showCapabilityOverride && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-lg border border-[#d9ff00]/20 bg-[#d9ff00]/5 p-3 space-y-3">
                        <p className="text-[10px] text-[#d9ff00]/70 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Manual override — only change if auto-detection is wrong
                        </p>

                        {/* Type override */}
                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Model Type</Label>
                          <Select
                            value={formType}
                            onValueChange={(v) => {
                              const newType = v as 'image' | 'video';
                              setFormType(newType);
                              setFormCapabilities(getDefaultCapabilities(newType));
                              setIsAutoDetectedType(false);
                              setIsAutoDetectedCapabilities(false);
                            }}
                          >
                            <SelectTrigger className="bg-surface border-border/60 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a1a1a] border-border/60">
                              <SelectItem value="image">
                                <span className="flex items-center gap-2">
                                  <Zap className="h-3.5 w-3.5" />
                                  Image
                                </span>
                              </SelectItem>
                              <SelectItem value="video">
                                <span className="flex items-center gap-2">
                                  <Cpu className="h-3.5 w-3.5" />
                                  Video
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Capabilities checkboxes */}
                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Capabilities</Label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {(formType === 'image'
                              ? [
                                  { id: 't2i', label: 'Text-to-Image' },
                                  { id: 'i2i', label: 'Image-to-Image' },
                                  { id: 'inpaint', label: 'Inpainting' },
                                  { id: 'upscale', label: 'Upscale' },
                                  { id: 'edit', label: 'Edit' },
                                ]
                              : [
                                  { id: 't2v', label: 'Text-to-Video' },
                                  { id: 'i2v', label: 'Image-to-Video' },
                                ]
                            ).map((cap) => (
                              <label
                                key={cap.id}
                                className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 cursor-pointer transition-all text-[11px] ${
                                  formCapabilities.includes(cap.id)
                                    ? 'border-[#d9ff00]/40 bg-[#d9ff00]/10 text-[#d9ff00]'
                                    : 'border-border/30 bg-surface text-muted-foreground hover:border-border/60'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={formCapabilities.includes(cap.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFormCapabilities((prev) => [...prev, cap.id]);
                                    } else {
                                      setFormCapabilities((prev) => prev.filter((c) => c !== cap.id));
                                    }
                                    setIsAutoDetectedCapabilities(false);
                                  }}
                                  className="sr-only"
                                />
                                <span className={`h-3 w-3 rounded border flex items-center justify-center ${
                                  formCapabilities.includes(cap.id)
                                    ? 'border-[#d9ff00] bg-[#d9ff00]'
                                    : 'border-border/50'
                                }`}>
                                  {formCapabilities.includes(cap.id) && (
                                    <svg className="h-2 w-2 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </span>
                                {cap.label}
                              </label>
                            ))}
                          </div>
                          {formCapabilities.length === 0 && (
                            <p className="text-[10px] text-destructive">At least one capability is required</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Description (Optional)
                </Label>
                <Input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description of the model"
                  className="bg-surface border-border/60 placeholder:text-muted-foreground/40 focus-visible:ring-[#d9ff00]/30"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  resetForm();
                  setDialogOpen(false);
                }}
                className="border-border/60 bg-surface hover:bg-surface-hover"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={formSubmitting || !formProviderId || !formName.trim() || !formModelId.trim() || formCapabilities.length === 0}
                className="gap-2 bg-[#d9ff00] text-background hover:bg-[#c5eb00] disabled:opacity-50"
              >
                {formSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add Model
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>{/* closes flex items-center gap-2 */}
      </motion.div>

      {/* Stats Bar */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 sm:grid-cols-5 gap-3"
      >
        {[
          { label: 'Total', value: modelStats.total, icon: Box, color: 'text-[#d9ff00]' },
          { label: 'Image', value: modelStats.image, icon: ImageIcon, color: 'text-cyan-400' },
          { label: 'Video', value: modelStats.video, icon: Video, color: 'text-purple-400' },
          { label: 'Custom', value: modelStats.custom, icon: Sparkles, color: 'text-[#d9ff00]' },
          { label: 'Capabilities', value: modelStats.capabilities, icon: Zap, color: 'text-orange-400' },
        ].map((stat) => (
          <Card key={stat.label} className="glass-light border-border/30 p-3">
            <div className="flex items-center gap-2">
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
              <div>
                <p className="text-lg font-bold text-foreground">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </motion.div>

      {/* Search & Filters */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-3"
      >
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={modelSearch}
              onChange={(e) => setModelSearch(e.target.value)}
              placeholder="Search models..."
              className="pl-10 bg-surface border-border/60 placeholder:text-muted-foreground/50 input-neon-focus"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={`gap-1.5 border-border/60 transition-colors ${
              showFilters ? 'bg-[#d9ff00]/5 text-[#d9ff00] border-[#d9ff00]/20' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {(providerFilter !== 'all' || typeFilter !== 'all' || capabilityFilter !== 'all') && (
              <Badge className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[9px] bg-[#d9ff00] text-background">
                !
              </Badge>
            )}
          </Button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-3 p-3 rounded-lg bg-surface/60 border border-border/30">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Provider</Label>
                  <Select value={providerFilter} onValueChange={setProviderFilter}>
                    <SelectTrigger className="h-8 w-[160px] bg-surface border-border/40 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-border/60">
                      <SelectItem value="all">All Providers</SelectItem>
                      {providers.map((p) => (
                        <SelectItem key={p.id} value={p.name}>
                          <span className="flex items-center gap-2">
                            <ProviderDot color={p.color} size="sm" />
                            {p.displayName}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Type</Label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-8 w-[120px] bg-surface border-border/40 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-border/60">
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Capability</Label>
                  <Select value={capabilityFilter} onValueChange={setCapabilityFilter}>
                    <SelectTrigger className="h-8 w-[160px] bg-surface border-border/40 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-border/60">
                      <SelectItem value="all">All Capabilities</SelectItem>
                      {CAPABILITY_OPTIONS.map((cap) => (
                        <SelectItem key={cap.id} value={cap.id}>
                          {cap.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setProviderFilter('all');
                      setTypeFilter('all');
                      setCapabilityFilter('all');
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Showing count */}
        <p className="text-xs text-muted-foreground">
          Showing {filteredModels.length} of {models.length} models
        </p>
      </motion.div>

      {/* Models grouped by provider */}
      <div className="space-y-6">
        {groupedModels.map(([providerName, group]) => (
          <div key={providerName} className="space-y-3">
            <div className="flex items-center gap-3">
              <ProviderDot color={group.provider.color} size="md" />
              <h4 className="text-sm font-semibold text-foreground">{group.provider.displayName}</h4>
              <Badge variant="secondary" className="text-[10px] bg-surface border-border text-muted-foreground">
                {group.models.length} {group.models.length === 1 ? 'model' : 'models'}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-6">
              {group.models.map((model, idx) => {
                const isUserCreated = !model.isDefault;
                const capabilities = model.capabilities
                  ? model.capabilities.split(',').filter(Boolean)
                  : [];

                return (
                  <motion.div
                    key={model.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: idx * 0.01 }}
                  >
                    <Card className="glass-light border-border/30 hover:border-border/50 transition-all duration-200 group/card">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-foreground">
                                {model.name}
                              </span>
                              <Badge
                                variant="secondary"
                                className={`text-[9px] ${
                                  model.type === 'video'
                                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                    : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                                }`}
                              >
                                {model.type}
                              </Badge>
                              {isUserCreated && (
                                <Badge className="text-[9px] bg-[#d9ff00]/10 text-[#d9ff00] border-[#d9ff00]/20">
                                  custom
                                </Badge>
                              )}
                            </div>

                            <code className="block text-[11px] font-mono text-muted-foreground/70 truncate">
                              {model.modelId}
                            </code>

                            {/* Capability badges */}
                            <div className="flex flex-wrap gap-1">
                              {capabilities.map((cap) => {
                                const colors = CAPABILITY_COLORS[cap] || { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' };
                                return (
                                  <Badge
                                    key={cap}
                                    className={`text-[8px] px-1.5 py-0 ${colors.bg} ${colors.text} border ${colors.border}`}
                                  >
                                    {cap}
                                  </Badge>
                                );
                              })}
                            </div>

                            {model.priceInfo && (
                              <p className="text-[10px] text-muted-foreground/60">{model.priceInfo}</p>
                            )}
                          </div>

                          {isUserCreated && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteModel(model.id, model.name)}
                              disabled={deleting[model.id]}
                              className="opacity-0 group-hover/card:opacity-100 transition-opacity h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            >
                              {deleting[model.id] ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {filteredModels.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Search className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No models match your filters</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setModelSearch('');
              setProviderFilter('all');
              setTypeFilter('all');
              setCapabilityFilter('all');
            }}
            className="text-muted-foreground"
          >
            Clear all filters
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export / Import Section
// ---------------------------------------------------------------------------

function ExportImportSection() {
  const { refreshProviders } = useAppStore();
  const apiKeysHook = useApiKeys();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [importResult, setImportResult] = useState<{ modelsImported: number; modelsSkipped: number; note: string } | null>(null);
  const [exportKeysDialogOpen, setExportKeysDialogOpen] = useState(false);
  const [exportingKeys, setExportingKeys] = useState(false);
  const [importKeysDialogOpen, setImportKeysDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export full settings (no keys) ------------------------------------------
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/settings/export');
      if (!res.ok) throw new Error('Failed to export');
      const data = await res.json();

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-studio-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Settings exported successfully');
    } catch {
      toast.error('Failed to export settings');
    } finally {
      setExporting(false);
    }
  }, []);

  // Export API keys (client-side, since they're in IndexedDB) ----------------
  const handleExportKeys = useCallback(async () => {
    setExportingKeys(true);
    try {
      const keys = await getAllApiKeys();
      const exportData = {
        version: 1,
        type: 'api-keys',
        exportedAt: new Date().toISOString(),
        app: 'ai-studio',
        warning: 'This file contains API keys in plain text. Store it securely and delete after import.',
        keys: keys.map((k) => ({
          providerId: k.providerId,
          key: k.key,
          label: k.label,
        })),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-studio-keys-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${keys.length} API key(s)`);
      setExportKeysDialogOpen(false);
    } catch {
      toast.error('Failed to export API keys');
    } finally {
      setExportingKeys(false);
    }
  }, []);

  // Import models -----------------------------------------------------------
  const handleImportModels = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setImporting(true);
      setImportResult(null);
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        const res = await fetch('/api/settings/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        const result = await res.json();
        if (!res.ok) {
          throw new Error(result.error || 'Import failed');
        }

        setImportResult({
          modelsImported: result.modelsImported,
          modelsSkipped: result.modelsSkipped,
          note: result.note || '',
        });
        toast.success(`Imported ${result.modelsImported} custom model(s)`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to import settings');
      } finally {
        setImporting(false);
      }
    };
    input.click();
  }, []);

  // Import API keys -----------------------------------------------------------
  const handleImportKeys = useCallback(async () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.click();
  }, []);

  const handleKeysFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.type !== 'api-keys' || data.app !== 'ai-studio') {
        throw new Error('Invalid API keys file format');
      }

      let imported = 0;
      for (const keyEntry of data.keys || []) {
        await saveApiKey(keyEntry.providerId, keyEntry.key, keyEntry.label || 'Imported Key');
        imported++;
      }

      toast.success(`Imported ${imported} API key(s). Refresh to see changes.`);
      apiKeysHook.refresh();
      refreshProviders();
      setImportKeysDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to import API keys');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [apiKeysHook, refreshProviders]);

  // Reset all settings -------------------------------------------------------
  const handleResetAll = useCallback(async () => {
    setResetting(true);
    try {
      await clearAllApiKeys();
      apiKeysHook.refresh();
      refreshProviders();
      toast.success('All API keys cleared. You may need to refresh the page.');
      setResetDialogOpen(false);
    } catch {
      toast.error('Failed to reset settings');
    } finally {
      setResetting(false);
    }
  }, [apiKeysHook, refreshProviders]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Download className="h-5 w-5 text-[#d9ff00]" />
          Export / Import
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Transfer your configuration between devices or back up your settings.
        </p>
      </motion.div>

      {/* Security warning */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 flex gap-3"
      >
        <AlertTriangle className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Security Notice</p>
          <p className="text-xs text-muted-foreground">
            API keys are stored in your browser (IndexedDB) and never leave your device by default.
            When exporting keys, they will be written in <strong className="text-foreground">plain text</strong> to the JSON file.
            Store exported files securely and delete them after importing.
          </p>
        </div>
      </motion.div>

      {/* Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Export Configuration */}
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="glass border-border/40 hover:border-border/70 transition-all duration-300 h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#d9ff00]/10">
                  <Download className="h-4 w-4 text-[#d9ff00]" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-foreground">Export Configuration</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Provider setup & custom models
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="rounded-lg bg-surface/80 border border-border/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Exports provider metadata, custom models, and capabilities. <strong className="text-foreground">API keys are not included.</strong>
                  </p>
                </div>
                <Button
                  onClick={handleExport}
                  disabled={exporting}
                  className="gap-2 bg-[#d9ff00] text-background hover:bg-[#c5eb00] disabled:opacity-50 w-full"
                >
                  {exporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileJson className="h-4 w-4" />
                  )}
                  {exporting ? 'Exporting...' : 'Export Configuration'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Export API Keys */}
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="glass border-border/40 hover:border-orange-500/30 transition-all duration-300 h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10">
                  <Key className="h-4 w-4 text-orange-400" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                    Export API Keys
                    <Badge className="text-[8px] bg-orange-500/10 text-orange-400 border-orange-500/20 px-1.5">
                      CAUTION
                    </Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    All keys in plain text
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="rounded-lg bg-orange-500/5 border border-orange-500/20 p-3">
                  <p className="text-xs text-orange-400/80">
                    <AlertTriangle className="h-3 w-3 inline mr-1" />
                    Keys will be exported in <strong>plain text</strong>. Delete the file after importing.
                  </p>
                </div>
                <Button
                  onClick={() => setExportKeysDialogOpen(true)}
                  disabled={exportingKeys || apiKeysHook.configuredCount === 0}
                  className="gap-2 border-border/60 bg-surface hover:bg-surface-hover text-foreground w-full"
                  variant="outline"
                >
                  {exportingKeys ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Key className="h-4 w-4" />
                  )}
                  {exportingKeys ? 'Exporting...' : `Export ${apiKeysHook.configuredCount} Key(s)`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Import Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Import Models */}
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass border-border/40 hover:border-border/70 transition-all duration-300 h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10">
                  <Upload className="h-4 w-4 text-cyan-400" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-foreground">Import Configuration</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Custom models from previous export
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="rounded-lg bg-surface/80 border border-border/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Import will add custom models. Existing models will not be overwritten.
                  </p>
                </div>
                <Button
                  onClick={() => setImportDialogOpen(true)}
                  disabled={importing}
                  className="gap-2 border-border/60 bg-surface hover:bg-surface-hover text-foreground w-full"
                  variant="outline"
                >
                  {importing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {importing ? 'Importing...' : 'Import Models'}
                </Button>

                {importResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border border-[#d9ff00]/30 bg-[#d9ff00]/5 p-3 space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#d9ff00]" />
                      <span className="text-sm font-medium text-foreground">Import Complete</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {importResult.modelsImported} model(s) imported, {importResult.modelsSkipped} skipped
                    </p>
                  </motion.div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Import API Keys */}
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="glass border-border/40 hover:border-border/70 transition-all duration-300 h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Key className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-foreground">Import API Keys</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Keys from a previous export
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="rounded-lg bg-surface/80 border border-border/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Import keys from a previously exported API keys file. Keys will be added to your browser storage.
                  </p>
                </div>
                <Button
                  onClick={() => setImportKeysDialogOpen(true)}
                  disabled={importing}
                  className="gap-2 border-border/60 bg-surface hover:bg-surface-hover text-foreground w-full"
                  variant="outline"
                >
                  {importing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Key className="h-4 w-4" />
                  )}
                  {importing ? 'Importing...' : 'Import Keys'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleKeysFileSelected}
                  className="hidden"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Reset All */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Separator className="mb-6" />
        <Card className="glass border-destructive/20 hover:border-destructive/40 transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
                  <RotateCcw className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Reset All Settings</p>
                  <p className="text-xs text-muted-foreground">
                    Clear all API keys from browser storage. This cannot be undone.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => setResetDialogOpen(true)}
                className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Export keys confirmation dialog */}
      <AlertDialog open={exportKeysDialogOpen} onOpenChange={setExportKeysDialogOpen}>
        <AlertDialogContent className="glass-strong">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-400" />
              Export API Keys?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Your API keys will be written to a JSON file in <strong>plain text</strong>.
              Anyone with access to this file can use your API keys.
              Make sure to store it securely and delete it after importing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border/60 bg-surface hover:bg-surface-hover">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExportKeys}
              className="bg-orange-500 text-white hover:bg-orange-600 gap-2"
            >
              {exportingKeys ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              I understand, export keys
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import models confirmation dialog */}
      <AlertDialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <AlertDialogContent className="glass-strong">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Import Configuration</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Select a previously exported AI Studio JSON file to import custom models. API keys will not be imported.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border/60 bg-surface hover:bg-surface-hover">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setImportDialogOpen(false);
                handleImportModels();
              }}
              className="bg-[#d9ff00] text-background hover:bg-[#c5eb00]"
            >
              Select File
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import keys confirmation dialog */}
      <AlertDialog open={importKeysDialogOpen} onOpenChange={setImportKeysDialogOpen}>
        <AlertDialogContent className="glass-strong">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Import API Keys</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Select a previously exported API keys JSON file. Keys will be added to your browser storage and may overwrite existing keys for the same providers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border/60 bg-surface hover:bg-surface-hover">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setImportKeysDialogOpen(false);
                handleImportKeys();
              }}
              className="bg-[#d9ff00] text-background hover:bg-[#c5eb00]"
            >
              Select File
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset all confirmation dialog */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent className="glass-strong">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Reset All Settings?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will permanently delete all API keys from your browser storage. This action cannot be undone.
              You will need to re-enter all your API keys.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border/60 bg-surface hover:bg-surface-hover">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetAll}
              disabled={resetting}
              className="bg-destructive text-white hover:bg-destructive/90 gap-2"
            >
              {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Reset All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Keyboard Shortcuts Section
// ---------------------------------------------------------------------------

const KEYBOARD_SHORTCUTS = [
  { keys: ['Ctrl', 'Enter'], description: 'Generate image / video', context: 'Image Studio' },
  { keys: ['Ctrl', 'K'], description: 'Search gallery', context: 'Gallery' },
  { keys: ['Ctrl', 'E'], description: 'AI enhance prompt', context: 'Image Studio' },
  { keys: ['Ctrl', 'S'], description: 'Download result', context: 'Result View' },
  { keys: ['Ctrl', 'Z'], description: 'Undo last action', context: 'Global' },
  { keys: ['Esc'], description: 'Close dialog / lightbox', context: 'Global' },
  { keys: ['←', '→'], description: 'Navigate gallery images', context: 'Lightbox' },
  { keys: ['F'], description: 'Toggle favorite', context: 'Gallery' },
  { keys: ['D'], description: 'Download current image', context: 'Lightbox' },
  { keys: ['R'], description: 'Regenerate with same settings', context: 'Result View' },
  { keys: ['?'], description: 'Show keyboard shortcuts', context: 'Global' },
];

function KeyboardShortcutsSection() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="space-y-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-3 w-full text-left group"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface border border-border/30 group-hover:border-[#d9ff00]/30 transition-colors">
          <Keyboard className="h-4 w-4 text-muted-foreground group-hover:text-[#d9ff00] transition-colors" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">Keyboard Shortcuts</h3>
          <p className="text-xs text-muted-foreground">
            Quick shortcuts for faster workflow
          </p>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Card className="glass-light border-border/30">
              <CardContent className="p-0">
                <div className="divide-y divide-border/20">
                  {KEYBOARD_SHORTCUTS.map((shortcut, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-surface/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-foreground">{shortcut.description}</span>
                        <Badge variant="secondary" className="text-[9px] bg-surface border-border text-muted-foreground">
                          {shortcut.context}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, kIdx) => (
                          <span key={kIdx} className="flex items-center gap-1">
                            <kbd className="inline-flex items-center justify-center h-6 min-w-[28px] px-2 text-[11px] font-mono font-medium text-foreground/80 bg-surface border border-border/50 rounded-md shadow-sm">
                              {key}
                            </kbd>
                            {kIdx < shortcut.keys.length - 1 && (
                              <span className="text-muted-foreground/50 text-xs">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Settings Component
// ---------------------------------------------------------------------------

export function Settings() {
  const { settingsTab, setSettingsTab } = useAppStore();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ScrollArea className="flex-1 h-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          {/* Page header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-6"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#d9ff00]/20 to-[#d9ff00]/5 border border-[#d9ff00]/20">
              <Settings2 className="h-5 w-5 text-[#d9ff00]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Settings</h2>
              <p className="text-sm text-muted-foreground">
                Configure API keys, manage models, and transfer settings
              </p>
            </div>
          </motion.div>

          {/* Tabs */}
          <Tabs
            value={settingsTab}
            onValueChange={(v) => setSettingsTab(v as 'providers' | 'models' | 'transfer')}
            className="w-full"
          >
            <TabsList className="bg-surface border border-border/40 p-1 rounded-xl">
              <TabsTrigger
                value="providers"
                className="rounded-lg gap-2 data-[state=active]:bg-[#d9ff00]/10 data-[state=active]:text-[#d9ff00] data-[state=active]:shadow-none px-4 transition-all duration-200"
              >
                <Key className="h-4 w-4" />
                API Keys
              </TabsTrigger>
              <TabsTrigger
                value="models"
                className="rounded-lg gap-2 data-[state=active]:bg-[#d9ff00]/10 data-[state=active]:text-[#d9ff00] data-[state=active]:shadow-none px-4 transition-all duration-200"
              >
                <Box className="h-4 w-4" />
                Models
              </TabsTrigger>
              <TabsTrigger
                value="transfer"
                className="rounded-lg gap-2 data-[state=active]:bg-[#d9ff00]/10 data-[state=active]:text-[#d9ff00] data-[state=active]:shadow-none px-4 transition-all duration-200"
              >
                <Download className="h-4 w-4" />
                Transfer
              </TabsTrigger>
            </TabsList>

            <TabsContent value="providers" className="mt-6">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ApiKeysSection />
              </motion.div>
            </TabsContent>

            <TabsContent value="models" className="mt-6">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
              >
                <CustomModelsSection />
              </motion.div>
            </TabsContent>

            <TabsContent value="transfer" className="mt-6">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ExportImportSection />
              </motion.div>
            </TabsContent>
          </Tabs>

          {/* Keyboard Shortcuts - always visible at bottom */}
          <div className="mt-8">
            <KeyboardShortcutsSection />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
