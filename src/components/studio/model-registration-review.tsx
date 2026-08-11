'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  getAllCustomModels,
  getAllDiscoveredModels,
  getAllModelRegistrations,
  saveModelRegistration,
  type ModelRegistrationRecord,
} from '@/lib/idb';
import {
  approveModelRegistration,
  createDraftModelRegistration,
  getModelAdapterProfile,
  getModelAdapterProfiles,
  type ModelAdapterProfile,
  type ModelRegistrationSource,
} from '@/lib/model-registration';
import { getRegisteredModel } from '@/lib/generation-registry';
import { PROVIDERS } from '@/lib/providers-data';
import { useAppStore } from '@/lib/store';

interface ModelCandidate {
  key: string;
  source: ModelRegistrationSource;
  sourceId: string;
  providerId: string;
  providerName: string;
  providerDisplayName: string;
  modelId: string;
  modelName: string;
  type: 'image' | 'video';
  description?: string;
}

function candidateKey(providerName: string, modelId: string): string {
  return `${providerName}::${modelId}`;
}

function displayOperation(value: string): string {
  return value.split('-').map((word) => (
    word.charAt(0).toUpperCase() + word.slice(1)
  )).join(' ');
}

function statusBadge(status: ModelRegistrationRecord['status']) {
  switch (status) {
    case 'approved':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'draft':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    case 'rejected':
      return 'border-red-500/30 bg-red-500/10 text-red-300';
    case 'revoked':
      return 'border-muted bg-muted/20 text-muted-foreground';
  }
}

export function ModelRegistrationReview() {
  const refreshProviders = useAppStore((state) => state.refreshProviders);
  const providerVersion = useAppStore((state) => state.providerVersion);

  const [candidates, setCandidates] = useState<ModelCandidate[]>([]);
  const [registrations, setRegistrations] = useState<ModelRegistrationRecord[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [profileId, setProfileId] = useState('');
  const [docsUrl, setDocsUrl] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [custom, discovered, savedRegistrations] = await Promise.all([
        getAllCustomModels(),
        getAllDiscoveredModels(),
        getAllModelRegistrations(),
      ]);

      const candidateMap = new Map<string, ModelCandidate>();
      for (const model of discovered) {
        const provider = PROVIDERS.find((item) => item.name === model.providerName);
        if (getRegisteredModel(model.providerName, model.modelId)) continue;
        candidateMap.set(candidateKey(model.providerName, model.modelId), {
          key: candidateKey(model.providerName, model.modelId),
          source: 'discovered',
          sourceId: model.id,
          providerId: provider?.id || model.providerName,
          providerName: model.providerName,
          providerDisplayName: provider?.displayName || model.providerName,
          modelId: model.modelId,
          modelName: model.name,
          type: model.type,
          description: model.description,
        });
      }

      // A user-created candidate takes precedence over the cached discovered
      // metadata because it contains the user's chosen display name.
      for (const model of custom) {
        const provider = PROVIDERS.find((item) => (
          item.id === model.providerId || item.name === model.providerId
        ));
        const providerName = provider?.name || model.providerId;
        if (getRegisteredModel(providerName, model.modelId)) continue;
        candidateMap.set(candidateKey(providerName, model.modelId), {
          key: candidateKey(providerName, model.modelId),
          source: 'custom',
          sourceId: model.id,
          providerId: provider?.id || model.providerId,
          providerName,
          providerDisplayName: provider?.displayName || model.providerName,
          modelId: model.modelId,
          modelName: model.name,
          type: model.type,
          description: model.description,
        });
      }

      // Keep saved reviews manageable even after a discovered-model cache
      // entry expires. Static catalog entries remain excluded.
      for (const registration of savedRegistrations) {
        if (getRegisteredModel(registration.providerName, registration.modelId)) {
          continue;
        }
        const key = candidateKey(registration.providerName, registration.modelId);
        if (candidateMap.has(key)) continue;
        candidateMap.set(key, {
          key,
          source: registration.source,
          sourceId: registration.sourceId,
          providerId: registration.providerId,
          providerName: registration.providerName,
          providerDisplayName: registration.providerDisplayName,
          modelId: registration.modelId,
          modelName: registration.modelName,
          type: registration.type,
          description: 'Persisted review record; the original discovery cache entry is no longer present.',
        });
      }

      const nextCandidates = [...candidateMap.values()].sort((a, b) => (
        a.providerDisplayName.localeCompare(b.providerDisplayName)
        || a.modelName.localeCompare(b.modelName)
      ));
      setCandidates(nextCandidates);
      setRegistrations(savedRegistrations);
      setSelectedKey((current) => (
        nextCandidates.some((candidate) => candidate.key === current)
          ? current
          : nextCandidates[0]?.key || ''
      ));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load model review candidates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, providerVersion]);

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.key === selectedKey) || null,
    [candidates, selectedKey],
  );

  const profileOptions = useMemo(() => (
    selectedCandidate
      ? getModelAdapterProfiles({
          providerName: selectedCandidate.providerName,
          type: selectedCandidate.type,
        })
      : []
  ), [selectedCandidate]);

  const selectedProfile = useMemo<ModelAdapterProfile | null>(() => (
    getModelAdapterProfile(profileId)
  ), [profileId]);

  const selectedRegistration = useMemo(() => (
    selectedCandidate && profileId
      ? registrations.find((registration) => (
          registration.providerName === selectedCandidate.providerName
          && registration.modelId === selectedCandidate.modelId
          && registration.profileId === profileId
        )) || null
      : null
  ), [registrations, selectedCandidate, profileId]);

  useEffect(() => {
    if (!selectedCandidate) {
      setProfileId('');
      return;
    }

    const existing = registrations.find((registration) => (
      registration.providerName === selectedCandidate.providerName
      && registration.modelId === selectedCandidate.modelId
    ));
    const nextProfile = existing?.profileId || profileOptions[0]?.id || '';
    setProfileId(nextProfile);
  }, [selectedCandidate, profileOptions, registrations]);

  useEffect(() => {
    setDocsUrl(selectedRegistration?.docsUrl || '');
    setReviewNotes(selectedRegistration?.reviewNotes || '');
    setAcknowledged(selectedRegistration?.reviewerAcknowledged || false);
  }, [selectedRegistration]);

  const persist = useCallback(async (approve: boolean) => {
    if (!selectedCandidate || !selectedProfile) return;
    setSaving(true);
    try {
      const draft = createDraftModelRegistration({
        source: selectedCandidate.source,
        sourceId: selectedCandidate.sourceId,
        providerId: selectedCandidate.providerName,
        providerName: selectedCandidate.providerName,
        providerDisplayName: selectedCandidate.providerDisplayName,
        modelId: selectedCandidate.modelId,
        modelName: selectedCandidate.modelName,
        type: selectedCandidate.type,
        profileId: selectedProfile.id,
        docsUrl,
        reviewNotes,
        existing: selectedRegistration || undefined,
      });

      const record = approve
        ? approveModelRegistration(draft, {
            docsUrl,
            reviewNotes,
            reviewerAcknowledged: acknowledged,
          })
        : draft;

      await saveModelRegistration(record);
      toast.success(approve
        ? `${selectedCandidate.modelName} approved for local execution`
        : 'Model review draft saved');
      refreshProviders();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save the model review');
    } finally {
      setSaving(false);
    }
  }, [
    selectedCandidate,
    selectedProfile,
    docsUrl,
    reviewNotes,
    acknowledged,
    selectedRegistration,
    refreshProviders,
    load,
  ]);

  const revoke = useCallback(async (registration: ModelRegistrationRecord) => {
    setSaving(true);
    try {
      await saveModelRegistration({
        ...registration,
        status: 'revoked',
        updatedAt: Date.now(),
      });
      toast.warning(`${registration.modelName} was removed from executable selectors`);
      refreshProviders();
      await load();
    } finally {
      setSaving(false);
    }
  }, [refreshProviders, load]);

  const approved = registrations.filter((registration) => registration.status === 'approved');
  const drafts = registrations.filter((registration) => registration.status === 'draft');
  const profileBlocked = candidates.filter((candidate) => (
    getModelAdapterProfiles({
      providerName: candidate.providerName,
      type: candidate.type,
    }).length === 0
  )).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#d9ff00]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <ShieldCheck className="h-5 w-5 text-[#d9ff00]" />
            Model Registration Review
          </h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Custom and discovered models remain metadata-only until you map them to a known adapter profile, review the provider documentation, and approve the contract locally. Approval never counts as live verification.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh candidates
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Candidates', candidates.length],
          ['Approved', approved.length],
          ['Drafts', drafts.length],
          ['No safe profile', profileBlocked],
        ].map(([label, value]) => (
          <Card key={String(label)} className="border-border/40 bg-surface/40">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.4fr)]">
        <Card className="border-border/40 bg-surface/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Non-executable candidates</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[34rem]">
              <div className="space-y-1 p-3 pt-0">
                {candidates.map((candidate) => {
                  const candidateRegistrations = registrations.filter((registration) => (
                    registration.providerName === candidate.providerName
                    && registration.modelId === candidate.modelId
                  ));
                  const hasApproved = candidateRegistrations.some((item) => item.status === 'approved');
                  const hasProfile = getModelAdapterProfiles({
                    providerName: candidate.providerName,
                    type: candidate.type,
                  }).length > 0;
                  return (
                    <button
                      key={candidate.key}
                      type="button"
                      onClick={() => setSelectedKey(candidate.key)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        selectedKey === candidate.key
                          ? 'border-[#d9ff00]/40 bg-[#d9ff00]/5'
                          : 'border-border/30 bg-black/10 hover:border-border/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-foreground">
                            {candidate.modelName}
                          </p>
                          <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                            {candidate.modelId}
                          </p>
                        </div>
                        {hasApproved ? (
                          <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                        ) : hasProfile ? (
                          <FileSearch className="h-4 w-4 shrink-0 text-amber-300" />
                        ) : (
                          <Ban className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[9px]">
                          {candidate.providerDisplayName}
                        </Badge>
                        <Badge variant="outline" className="text-[9px]">
                          {candidate.source}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
                {candidates.length === 0 && (
                  <div className="px-3 py-12 text-center text-xs text-muted-foreground">
                    Add a custom model or discover models from a connected provider to create a review candidate.
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-surface/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {selectedCandidate ? selectedCandidate.modelName : 'Select a candidate'}
              {selectedRegistration && (
                <Badge className={statusBadge(selectedRegistration.status)}>
                  {selectedRegistration.status}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {!selectedCandidate ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Select a candidate to review its executable contract.
              </p>
            ) : profileOptions.length === 0 ? (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" />
                  <div>
                    <p className="text-sm font-medium text-foreground">No reviewed adapter profile exists</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      This model remains metadata-only. A developer must add and test a bounded adapter profile in source before local approval can expose it to generation selectors.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Adapter profile</Label>
                  <Select value={profileId} onValueChange={setProfileId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an adapter profile" />
                    </SelectTrigger>
                    <SelectContent>
                      {profileOptions.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedProfile && (
                    <div className="rounded-lg border border-border/30 bg-black/10 p-3 text-xs text-muted-foreground">
                      <p>{selectedProfile.description}</p>
                      <p className="mt-2">
                        <strong className="text-foreground">Operation:</strong>{' '}
                        {displayOperation(selectedProfile.operation)} · route {selectedProfile.route}
                      </p>
                      <p className="mt-1">
                        <strong className="text-foreground">Model id rule:</strong>{' '}
                        {selectedProfile.modelIdHint}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registration-docs">Provider documentation URL</Label>
                  <Input
                    id="registration-docs"
                    value={docsUrl}
                    onChange={(event) => setDocsUrl(event.target.value)}
                    placeholder="https://provider.example/docs/model"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registration-notes">Contract review notes</Label>
                  <Textarea
                    id="registration-notes"
                    value={reviewNotes}
                    onChange={(event) => setReviewNotes(event.target.value)}
                    rows={6}
                    placeholder="Record the documented endpoint, required input names, output shape, and any model-specific limits."
                  />
                  <p className="text-[10px] text-muted-foreground">
                    These notes are stored locally and are included in normal AI Studio backups.
                  </p>
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/40 bg-black/10 p-3">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(event) => setAcknowledged(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#d9ff00]"
                  />
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    I reviewed the HTTPS provider documentation and confirm that this model accepts the selected adapter profile’s request fields and response shape. This is a local contract approval, not a live-provider verification.
                  </span>
                </label>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={saving || !selectedProfile}
                    onClick={() => void persist(false)}
                    className="gap-2"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save draft
                  </Button>
                  <Button
                    disabled={saving || !selectedProfile}
                    onClick={() => void persist(true)}
                    className="gap-2 bg-[#d9ff00] text-black hover:bg-[#c8ef00]"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Approve local execution
                  </Button>
                  {selectedRegistration?.status === 'approved' && (
                    <Button
                      variant="destructive"
                      disabled={saving}
                      onClick={() => void revoke(selectedRegistration)}
                    >
                      Revoke selector access
                    </Button>
                  )}
                </div>

                {selectedRegistration?.docsUrl && (
                  <a
                    href={selectedRegistration.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-[#d9ff00] hover:underline"
                  >
                    Open reviewed documentation
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {approved.length > 0 && (
        <Card className="border-emerald-500/20 bg-emerald-500/[0.03]">
          <CardHeader>
            <CardTitle className="text-sm">Approved local contracts</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {approved.map((registration) => (
              <div key={registration.id} className="rounded-lg border border-emerald-500/20 bg-black/10 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">{registration.modelName}</p>
                    <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{registration.modelId}</p>
                  </div>
                  <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                    contract reviewed
                  </Badge>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {registration.providerDisplayName} · {displayOperation(registration.operation)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
