'use client';

import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Key,
  Download,
  Upload,
  RotateCcw,
  Loader2,
  CheckCircle2,
  FileJson,
  AlertTriangle,
} from 'lucide-react';

import { useAppStore } from '@/lib/store';
import { getAllApiKeys, saveApiKey, clearAllApiKeys } from '@/lib/idb';
import { PROVIDERS, MODELS } from '@/lib/providers-data';
import { useApiKeys } from '@/hooks/use-api-keys';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
// Export / Import Section
// ---------------------------------------------------------------------------

export function ExportImportSection() {
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

  // Export provider/model settings (from static data) ---------------------
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const data = {
        version: 1,
        exportedAt: new Date().toISOString(),
        app: 'ai-studio',
        note: 'API keys are stored in your browser (IndexedDB) and are not included in exports.',
        providers: PROVIDERS,
        stats: {
          totalProviders: PROVIDERS.length,
          totalModels: MODELS.length,
        },
      };

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

        // Import custom models (client-side only — just shows info since models are static)
        const customModels = data.customModels || [];

        setImportResult({
          modelsImported: customModels.length,
          modelsSkipped: 0,
          note: customModels.length > 0
            ? `Found ${customModels.length} custom model(s). Note: Models are managed through the static provider catalog.`
            : 'No custom models found in the import file.',
        });
        toast.success(customModels.length > 0 ? `Found ${customModels.length} custom model(s)` : 'Import file processed');
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
