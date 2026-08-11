'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FlaskConical,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  P0_EVIDENCE_GATES,
  createP0EvidenceCheckpoint,
  downloadP0EvidencePacket,
  loadP0EvidenceRecords,
  saveP0EvidenceRecords,
  summarizeP0Evidence,
  verifyP0EvidenceRecord,
  type P0EvidenceGate,
  type P0EvidenceManualAssertions,
  type P0EvidenceRecord,
} from '@/lib/p0-evidence';
import { GENERATION_OPERATIONS, type GenerationOperationId } from '@/lib/generation-registry';
import { getGenerations, type GenerationRecord } from '@/lib/idb';
import type { GenerationCancellationOutcome } from '@/lib/generation-cancellation';

const GATE_COPY: Record<P0EvidenceGate, { title: string; description: string }> = {
  'immediate-image-single-record': {
    title: 'Immediate image integrity',
    description: 'Proves one immediate image request produced one completed durable Gallery record.',
  },
  'async-image-restart': {
    title: 'Async image restart recovery',
    description: 'Capture while processing, restart the local server, reload, then verify the same job completed once.',
  },
  'async-video-restart': {
    title: 'Async video restart recovery',
    description: 'Proves an asynchronous video job survived a local-server restart and completed without duplication.',
  },
  'protected-media-restart': {
    title: 'Protected media restart',
    description: 'Verifies authenticated video media remained in IndexedDB and reopened through a local Blob URL.',
  },
  'provider-cancellation': {
    title: 'Provider cancellation',
    description: 'Records both the local terminal state and provider-side confirmation for a real cancellation attempt.',
  },
  'contract-smoke': {
    title: 'Live contract smoke test',
    description: 'Records that a specific provider/model/operation accepted the reviewed request and returned the expected result.',
  },
};

const CANCELLATION_OUTCOMES: GenerationCancellationOutcome[] = [
  'requested',
  'already-terminal',
  'unsupported',
  'local-only',
  'failed',
];

function statusClass(status: P0EvidenceRecord['status']): string {
  switch (status) {
    case 'passed':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'failed':
      return 'border-red-500/30 bg-red-500/10 text-red-300';
    case 'draft':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  }
}

function formatTime(value?: number): string {
  return value ? new Date(value).toLocaleString() : 'Not verified';
}

function ManualToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/40 bg-surface/40 p-3 text-xs text-muted-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[#d9ff00]"
      />
      <span>{label}</span>
    </label>
  );
}

export function P0EvidenceLab() {
  const [records, setRecords] = useState<P0EvidenceRecord[]>([]);
  const [generations, setGenerations] = useState<GenerationRecord[]>([]);
  const [gate, setGate] = useState<P0EvidenceGate>('immediate-image-single-record');
  const [generationId, setGenerationId] = useState('');
  const [operation, setOperation] = useState<GenerationOperationId>('text-to-image');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const persist = useCallback((next: P0EvidenceRecord[]) => {
    setRecords(next);
    saveP0EvidenceRecords(next);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const stored = loadP0EvidenceRecords();
      const { generations: recent } = await getGenerations({
        limit: 100,
        offset: 0,
        orderBy: 'desc',
      });
      setRecords(stored);
      setGenerations(recent.filter((generation) => generation.providerId !== 'demo'));
      setGenerationId((current) => (
        current && recent.some((generation) => generation.id === current)
          ? current
          : recent.find((generation) => generation.providerId !== 'demo')?.id || ''
      ));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load local evidence data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => summarizeP0Evidence(records), [records]);

  const createCheckpoint = useCallback(async () => {
    if (!generationId) {
      toast.error('Select a generation record before creating evidence.');
      return;
    }
    setCreating(true);
    try {
      const checkpoint = await createP0EvidenceCheckpoint({
        gate,
        generationId,
        operation: gate === 'contract-smoke' ? operation : undefined,
        notes,
      });
      persist([checkpoint, ...records]);
      setNotes('');
      toast.success('Evidence checkpoint created.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create checkpoint');
    } finally {
      setCreating(false);
    }
  }, [gate, generationId, operation, notes, persist, records]);

  const patchManual = useCallback((
    id: string,
    patch: Partial<P0EvidenceManualAssertions>,
  ) => {
    persist(records.map((record) => (
      record.id === id
        ? {
            ...record,
            manual: { ...record.manual, ...patch },
            status: 'draft',
            checks: [],
            updatedAt: Date.now(),
          }
        : record
    )));
  }, [persist, records]);

  const verify = useCallback(async (record: P0EvidenceRecord) => {
    setVerifyingId(record.id);
    try {
      const verified = await verifyP0EvidenceRecord(record);
      persist(records.map((candidate) => (
        candidate.id === verified.id ? verified : candidate
      )));
      if (verified.status === 'passed') {
        toast.success(`${GATE_COPY[verified.gate].title} passed.`);
      } else {
        toast.error('The evidence gate is not complete. Review the failed checks.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Evidence verification failed');
    } finally {
      setVerifyingId(null);
    }
  }, [persist, records]);

  const remove = useCallback((id: string) => {
    persist(records.filter((record) => record.id !== id));
  }, [persist, records]);

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
            <ClipboardCheck className="h-5 w-5 text-[#d9ff00]" />
            P0 Live Evidence Lab
          </h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Capture credential-free checkpoints for real provider tests. AI Studio verifies durable IndexedDB state and requires explicit confirmation for facts it cannot observe, such as a local-server restart or provider-side cancellation.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              try {
                downloadP0EvidencePacket(records);
                toast.success('Credential-free evidence packet exported.');
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Evidence export failed');
              }
            }}
            disabled={records.length === 0}
            className="gap-2"
          >
            <Download className="h-3.5 w-3.5" />
            Export packet
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Passed', summary.passed, 'text-emerald-300'],
          ['Draft', summary.draft, 'text-amber-300'],
          ['Failed', summary.failed, 'text-red-300'],
          ['Gates remaining', summary.pendingGates.length, 'text-[#d9ff00]'],
        ].map(([label, value, color]) => (
          <Card key={String(label)} className="border-border/40 bg-surface/40">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-[#d9ff00]/20 bg-[#d9ff00]/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="h-4 w-4 text-[#d9ff00]" />
            Create checkpoint
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Evidence gate</Label>
              <Select value={gate} onValueChange={(value) => setGate(value as P0EvidenceGate)}>
                <SelectTrigger className="bg-surface">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {P0_EVIDENCE_GATES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {GATE_COPY[value].title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{GATE_COPY[gate].description}</p>
            </div>

            <div className="space-y-2">
              <Label>Generation record</Label>
              <Select value={generationId} onValueChange={setGenerationId}>
                <SelectTrigger className="bg-surface">
                  <SelectValue placeholder="Select a recent generation" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {generations.map((generation) => (
                    <SelectItem key={generation.id} value={generation.id}>
                      {generation.status} · {generation.providerName} · {generation.modelId} · {generation.id.slice(-12)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {generations.length === 0 && (
                <p className="text-xs text-amber-300">Run a real generation first, then refresh this panel.</p>
              )}
            </div>
          </div>

          {gate === 'contract-smoke' && (
            <div className="space-y-2">
              <Label>Operation under test</Label>
              <Select value={operation} onValueChange={(value) => setOperation(value as GenerationOperationId)}>
                <SelectTrigger className="bg-surface">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GENERATION_OPERATIONS.map((value) => (
                    <SelectItem key={value} value={value}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes without credentials</Label>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Record provider dashboard observations, expected media kind, or restart timing. Never paste an API key."
              className="min-h-24 bg-surface"
            />
          </div>

          <Button
            onClick={() => void createCheckpoint()}
            disabled={creating || !generationId}
            className="gap-2 bg-[#d9ff00] text-background hover:bg-[#c5eb00]"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Create checkpoint
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {records.length === 0 ? (
          <Card className="border-dashed border-border/50 bg-surface/20">
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <ClipboardCheck className="h-9 w-9 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">No evidence checkpoints yet</p>
              <p className="max-w-xl text-xs text-muted-foreground">
                Start with an immediate image result, or create a processing checkpoint before restarting the local server during an asynchronous job.
              </p>
            </CardContent>
          </Card>
        ) : records.map((record) => (
          <Card key={record.id} className="border-border/40 bg-surface/30">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{GATE_COPY[record.gate].title}</CardTitle>
                    <Badge className={statusClass(record.status)}>{record.status}</Badge>
                    {record.operation && <Badge variant="outline">{record.operation}</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {record.providerName || record.providerId || 'Unknown provider'} · {record.modelId || 'Unknown model'}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground/70">
                    {record.generationId || 'No generation id'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => void verify(record)}
                    disabled={verifyingId === record.id}
                    className="gap-2 bg-[#d9ff00] text-background hover:bg-[#c5eb00]"
                  >
                    {verifyingId === record.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <BadgeCheck className="h-3.5 w-3.5" />}
                    Verify now
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => remove(record.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {(record.gate === 'async-image-restart'
                || record.gate === 'async-video-restart'
                || record.gate === 'protected-media-restart') && (
                <ManualToggle
                  checked={record.manual.restartConfirmed === true}
                  onChange={(checked) => patchManual(record.id, { restartConfirmed: checked })}
                  label="I restarted the local AI Studio server after creating this processing checkpoint, then reloaded this page."
                />
              )}

              {record.gate === 'contract-smoke' && (
                <ManualToggle
                  checked={record.manual.providerAcceptedResult === true}
                  onChange={(checked) => patchManual(record.id, { providerAcceptedResult: checked })}
                  label="The live provider accepted the reviewed request contract and returned the expected media kind."
                />
              )}

              {record.gate === 'provider-cancellation' && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Observed cancellation outcome</Label>
                    <Select
                      value={record.manual.cancellationOutcome || 'none'}
                      onValueChange={(value) => patchManual(record.id, {
                        cancellationOutcome: value === 'none'
                          ? undefined
                          : value as GenerationCancellationOutcome,
                      })}
                    >
                      <SelectTrigger className="bg-surface"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not recorded</SelectItem>
                        {CANCELLATION_OUTCOMES.map((value) => (
                          <SelectItem key={value} value={value}>{value}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <ManualToggle
                    checked={record.manual.providerTerminalConfirmed === true}
                    onChange={(checked) => patchManual(record.id, { providerTerminalConfirmed: checked })}
                    label="The provider dashboard or status endpoint confirmed that the job stopped or was already terminal."
                  />
                </div>
              )}

              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                <span>Checkpoint: {formatTime(record.startedAt)}</span>
                <span>Verified: {formatTime(record.verifiedAt)}</span>
                <span>Start status: {record.startSnapshot?.generationStatus || 'unknown'}</span>
              </div>

              {record.notes && (
                <div className="rounded-lg border border-border/30 bg-background/30 p-3 text-xs text-muted-foreground">
                  {record.notes}
                </div>
              )}

              {record.checks.length > 0 && (
                <div className="space-y-2">
                  {record.checks.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-start gap-2 rounded-lg border p-3 ${
                        item.passed
                          ? 'border-emerald-500/20 bg-emerald-500/5'
                          : 'border-red-500/20 bg-red-500/5'
                      }`}
                    >
                      {item.passed
                        ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />}
                      <div>
                        <p className="text-xs font-medium text-foreground">{item.label}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {records.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              persist([]);
              toast.info('Local evidence records cleared.');
            }}
            className="gap-2 text-muted-foreground hover:text-destructive"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear evidence records
          </Button>
        </div>
      )}
    </div>
  );
}
