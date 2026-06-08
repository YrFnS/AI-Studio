'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Search,
  Box,
  Loader2,
  Filter,
  Image as ImageIcon,
  Video,
  Sparkles,
  Zap,
} from 'lucide-react';

import { useApiKeys } from '@/hooks/use-api-keys';
import type { Provider, ModelWithProvider } from '@/lib/types';
import { saveCustomModel, getAllCustomModels, deleteCustomModel, type CustomModelRecord } from '@/lib/idb';
import { loadAllModels, getStaticProviders, providerSupportsDiscovery } from '@/lib/model-service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProviderDot, CAPABILITY_COLORS, CAPABILITY_OPTIONS } from './settings-helpers';
import { AddCustomModelDialog } from './add-custom-model-dialog';

// ---------------------------------------------------------------------------
// Custom Models Section
// ---------------------------------------------------------------------------

export function CustomModelsSection() {
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

  // Discover state
  const [discovering, setDiscovering] = useState(false);

  // Fetch models and providers ------------------------------------------------
  const fetchData = useCallback(async (options?: { fetchDynamic?: boolean }) => {
    try {
      setLoading(true);

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

      const staticProviders = getStaticProviders();
      const enrichedProviders = staticProviders.map((p) => ({
        ...p,
        hasKey: apiKeysHook.hasKey(p.id),
        supportsDiscovery: providerSupportsDiscovery(p.name),
      }));
      setProviders(enrichedProviders as Provider[]);
    } catch {
      toast.error('Failed to load models');
    } finally {
      setLoading(false);
    }
  }, [apiKeysHook]);

  const handleDiscover = useCallback(async () => {
    setDiscovering(true);
    try {
      await fetchData({ fetchDynamic: true });
      toast.success('Models refreshed from provider APIs');
    } catch {
      // error handled in fetchData
    } finally {
      setDiscovering(false);
    }
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  // Delete model -------------------------------------------------------------
  const handleDeleteModel = useCallback(
    async (modelId: string, modelName: string) => {
      setDeleting((prev) => ({ ...prev, [modelId]: true }));
      try {
        await deleteCustomModel(modelId);
        toast.success(`Model "${modelName}" removed`);
        fetchData();
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
        <Button
          onClick={() => setDialogOpen(true)}
          className="gap-2 bg-[#d9ff00] text-background hover:bg-[#c5eb00]"
        >
          <Plus className="h-4 w-4" />
          Add Custom Model
        </Button>
      </motion.div>

      {/* Add Custom Model Dialog */}
      <AddCustomModelDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        providers={providers}
        models={models}
        apiKeysHook={apiKeysHook}
        onModelAdded={fetchData}
      />

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
