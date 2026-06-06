'use client';

import { useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

import { useAppStore } from '@/lib/store';
import { useApiKeys } from '@/hooks/use-api-keys';

// ---------------------------------------------------------------------------
// usePostGenActions — handles post-generation actions (upscale, variation, etc.)
// ---------------------------------------------------------------------------

interface UsePostGenActionsParams {
  selectedImageProvider: string;
  selectedImageModel: string;
  hasApiKey: boolean;
  apiKeysHook: ReturnType<typeof useApiKeys>;
}

export function usePostGenActions({
  selectedImageProvider,
  selectedImageModel,
  hasApiKey,
  apiKeysHook,
}: UsePostGenActionsParams) {
  // Refs -------------------------------------------------------------------
  const postGenPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const postGenPollCountRef = useRef(0);

  // Store setters (stable references) ---------------------------------------
  const setIsPostGenProcessing = useAppStore((s) => s.setIsPostGenProcessing);
  const setPostGenAction = useAppStore((s) => s.setPostGenAction);
  const setLatestResult = useAppStore((s) => s.setLatestResult);

  // Post-generation action handler -------------------------------------------
  const handlePostGenAction = useCallback(async (action: 'upscale' | 'variation' | 'improve' | 'img2vid') => {
    // Read fresh state from store for image URLs and prompts
    const s = useAppStore.getState();
    const latestResult = s.latestResult;
    const generationResults = s.generationResults;
    const selectedResultIndex = s.selectedResultIndex;
    const activeImageUrl = generationResults.length > 1
      ? generationResults[selectedResultIndex] || latestResult
      : latestResult;
    const imagePrompt = s.imagePrompt;
    const imageNegativePrompt = s.imageNegativePrompt;

    if (!activeImageUrl) {
      toast.error('No image to process');
      return;
    }
    if (!hasApiKey) {
      toast.error('No API key configured. Add one in Settings.');
      return;
    }
    if (!selectedImageProvider || !selectedImageModel) {
      toast.error('Please select a provider and model first');
      return;
    }

    setPostGenAction(action);
    setIsPostGenProcessing(true);


    try {
      const apiKey = await apiKeysHook.getKeyForProvider(selectedImageProvider);
      if (!apiKey) {
        toast.error('No API key found for this provider');
        setIsPostGenProcessing(false);
        setPostGenAction(null);
        return;
      }

      let endpoint = '';
      let body: Record<string, unknown> = {};

      switch (action) {
        case 'upscale': {
          endpoint = '/api/generate/upscale';
          body = {
            providerId: selectedImageProvider,
            modelId: selectedImageModel,
            imageUrl: activeImageUrl,
            upscaleFactor: 2,
            apiKey,
          };
          break;
        }
        case 'variation': {
          endpoint = '/api/generate/variations';
          body = {
            providerId: selectedImageProvider,
            modelId: selectedImageModel,
            imageUrl: activeImageUrl,
            prompt: imagePrompt || 'Generate a variation of this image',
            variationStrength: 0.7,
            negativePrompt: imageNegativePrompt || undefined,
            apiKey,
          };
          break;
        }
        case 'improve': {
          endpoint = '/api/generate/variations';
          body = {
            providerId: selectedImageProvider,
            modelId: selectedImageModel,
            imageUrl: activeImageUrl,
            prompt: `Enhanced, improved quality, better details, higher resolution version of: ${imagePrompt}`,
            variationStrength: 0.4,
            negativePrompt: 'low quality, blurry, distorted, deformed, ugly, bad anatomy',
            apiKey,
          };
          break;
        }
        case 'img2vid': {
          endpoint = '/api/generate/img2vid';
          body = {
            providerId: selectedImageProvider,
            modelId: selectedImageModel,
            imageUrl: activeImageUrl,
            prompt: imagePrompt || 'Animate this image',
            duration: 5,
            apiKey,
          };
          break;
        }
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `${action} failed`);

      if (data.status === 'completed' && data.urls?.[0]) {
        setLatestResult(data.urls[0]);
        toast.success(`${action === 'upscale' ? 'Upscaled' : action === 'variation' ? 'Variation created' : action === 'improve' ? 'Image improved' : 'Video conversion started'}!`);
      } else if (data.status === 'completed' && data.images?.[0]) {
        setLatestResult(data.images[0]);
        toast.success(`${action === 'upscale' ? 'Upscaled' : action === 'variation' ? 'Variation created' : 'Image improved'}!`);
      } else if (data.status === 'processing' && data.id) {
        toast.info('Processing… This may take a moment.');
        postGenPollCountRef.current = 0;
        const pollInterval = setInterval(async () => {
          postGenPollCountRef.current += 1;
          if (postGenPollCountRef.current > 60) {
            clearInterval(pollInterval);
            postGenPollRef.current = null;
            setIsPostGenProcessing(false);
            setPostGenAction(null);
            toast.error('Processing timed out. Check your gallery for results.');
            return;
          }
          try {
            const sr = await fetch(`/api/generate/status?id=${data.id}${apiKey ? `&apiKey=${encodeURIComponent(apiKey)}` : ''}`);
            const sd = await sr.json();
            if (sd.status === 'completed') {
              clearInterval(pollInterval);
              postGenPollRef.current = null;
              const resultUrl = sd.resultUrl || sd.urls?.[0];
              if (resultUrl) {
                setLatestResult(resultUrl);
              }
              setIsPostGenProcessing(false);
              setPostGenAction(null);
              toast.success(`${action === 'upscale' ? 'Upscaled' : action === 'variation' ? 'Variation created' : action === 'improve' ? 'Image improved' : 'Video generated'}!`);
            } else if (sd.status === 'failed') {
              clearInterval(pollInterval);
              postGenPollRef.current = null;
              setIsPostGenProcessing(false);
              setPostGenAction(null);
              toast.error(sd.error || `${action} failed`);
            }
          } catch {
            // retry next interval
          }
        }, 3000);
        postGenPollRef.current = pollInterval;
        return;
      } else {
        throw new Error('Unexpected response');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${action} failed`);
    }
    setIsPostGenProcessing(false);
    setPostGenAction(null);
  }, [hasApiKey, selectedImageProvider, selectedImageModel, apiKeysHook, setLatestResult, setPostGenAction, setIsPostGenProcessing]);

  // Cleanup post-gen polling on unmount
  useEffect(() => {
    return () => {
      if (postGenPollRef.current) {
        clearInterval(postGenPollRef.current);
        postGenPollRef.current = null;
      }
    };
  }, []);

  return {
    handlePostGenAction,
    isPostGenProcessing: useAppStore((s) => s.isPostGenProcessing),
  };
}
