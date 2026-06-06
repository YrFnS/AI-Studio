import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Download a file from URL
// ---------------------------------------------------------------------------

export async function downloadFile(url: string, type: string): Promise<void> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `ai-studio-${Date.now()}.${type === 'video' ? 'mp4' : 'png'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    toast.success('Downloaded');
  } catch {
    window.open(url, '_blank');
  }
}

// ---------------------------------------------------------------------------
// Copy text to clipboard
// ---------------------------------------------------------------------------

export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Prompt copied to clipboard');
  } catch {
    toast.error('Failed to copy prompt');
  }
}
