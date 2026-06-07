'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Plus,
  Loader2,
  Sparkles,
  Pencil,
  Telescope,
  AlertCircle,
  Cpu,
  Zap,
  Video,
  Image as ImageIcon,
} from 'lucide-react';

import { useApiKeys } from '@/hooks/use-api-keys';
import type { Provider } from '@/lib/types';
import { saveCustomModel } from '@/lib/idb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/dialog';
import { ProviderDot, CAPABILITY_COLORS, CAPABILITY_OPTIONS } from './settings-helpers';

// ---------------------------------------------------------------------------
// Add Custom Model Dialog
// ---------------------------------------------------------------------------

interface AddCustomModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: Provider[];
  models: { provider?: { name: string }; providerId?: string; type: string }[];
  apiKeysHook: ReturnType<typeof useApiKeys>;
  onModelAdded: () => void;
}

export function AddCustomModelDialog({
  open,
  onOpenChange,
  providers,
  models,
  apiKeysHook,
  onModelAdded,
}: AddCustomModelDialogProps) {
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
    const providerModels = models.filter((m) => m.provider?.name === providerId || m.providerId === providerId);
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
  }, [models, providers, getDefaultCapabilities]);

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

    const provider = providers.find((p) => p.id === formProviderId || p.name === formProviderId);
    const providerName = provider?.name || formProviderId;

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
      const provider = providers.find((p) => p.id === formProviderId);
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
      onOpenChange(false);
      onModelAdded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add model');
    } finally {
      setFormSubmitting(false);
    }
  }, [formProviderId, formName, formModelId, formType, formCapabilities, formDescription, resetForm, onOpenChange, onModelAdded]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              onOpenChange(false);
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
  );
}
