'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, RotateCcw, Check, SwitchCamera, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface WebcamCaptureProps {
  onCapture?: (dataUrl: string) => void;
  onClose?: () => void;
}

export function WebcamCapture({ onCapture, onClose }: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);

  // Start camera
  const startCamera = useCallback(async (facing: 'user' | 'environment') => {
    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setCameraError(null);
    setIsStarting(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera access denied. Please allow camera permissions in your browser settings.'
          : err instanceof DOMException && err.name === 'NotFoundError'
            ? 'No camera found on this device.'
            : 'Unable to access camera. Please check permissions and try again.';
      setCameraError(message);
    } finally {
      setIsStarting(false);
    }
  }, []);

  // Start camera on mount and when facing mode changes
  useEffect(() => {
    startCamera(facingMode);
    return () => {
      // Cleanup: stop all tracks on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode, startCamera]);

  // Toggle facing mode
  const handleFlipCamera = useCallback(() => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
    setCapturedDataUrl(null);
  }, []);

  // Capture snapshot
  const handleCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror if front-facing camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedDataUrl(dataUrl);
  }, [facingMode]);

  // Retake
  const handleRetake = useCallback(() => {
    setCapturedDataUrl(null);
  }, []);

  // Confirm / use photo
  const handleConfirm = useCallback(() => {
    if (capturedDataUrl && onCapture) {
      onCapture(capturedDataUrl);
    }
  }, [capturedDataUrl, onCapture]);

  const isLiveView = !capturedDataUrl;

  return (
    <div className="flex flex-col gap-4">
      {/* Camera view */}
      <div className="relative overflow-hidden rounded-xl border border-border/40 bg-black">
        {cameraError ? (
          // Error state
          <div className="flex flex-col items-center justify-center gap-4 p-8 min-h-[300px]">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Camera Unavailable</p>
              <p className="mt-1 text-xs text-muted-foreground max-w-xs">{cameraError}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => startCamera(facingMode)}
              className="gap-1.5 border-border/50 text-xs"
            >
              <Camera className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        ) : (
          <>
            {/* Live video */}
            {isLiveView && (
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full aspect-video object-cover"
                  style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
                  onLoadedData={() => setIsStarting(false)}
                />
                {/* Pose guide SVG overlay */}
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox="0 0 640 480"
                  preserveAspectRatio="xMidYMid slice"
                >
                  {/* Center line (vertical) */}
                  <line x1="320" y1="40" x2="320" y2="440" stroke="rgba(217,255,0,0.2)" strokeWidth="1" strokeDasharray="8 6" />
                  {/* Eye line (horizontal) */}
                  <line x1="180" y1="180" x2="460" y2="180" stroke="rgba(217,255,0,0.2)" strokeWidth="1" strokeDasharray="8 6" />
                  {/* Head oval */}
                  <ellipse cx="320" cy="185" rx="75" ry="95" fill="none" stroke="rgba(217,255,0,0.3)" strokeWidth="1.5" strokeDasharray="6 4" />
                  {/* Shoulders outline */}
                  <path
                    d="M 220 310 Q 270 275 320 275 Q 370 275 420 310"
                    fill="none"
                    stroke="rgba(217,255,0,0.25)"
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                  />
                  {/* Label */}
                  <text x="320" y="460" textAnchor="middle" fill="rgba(217,255,0,0.3)" fontSize="11" fontFamily="system-ui">
                    Position yourself within the guide
                  </text>
                </svg>
                {/* Loading overlay */}
                {isStarting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <div className="flex flex-col items-center gap-2">
                      <Camera className="h-8 w-8 text-[#d9ff00] animate-pulse" />
                      <span className="text-xs text-white/70">Starting camera...</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Captured photo preview */}
            {!isLiveView && capturedDataUrl && (
              <div className="relative">
                <img
                  src={capturedDataUrl}
                  alt="Captured"
                  className="w-full aspect-video object-cover"
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Hidden canvas for capturing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Controls */}
      {!cameraError && (
        <div className="flex items-center justify-center gap-3">
          {isLiveView ? (
            <>
              {/* Flip camera button */}
              <Button
                variant="outline"
                size="icon"
                onClick={handleFlipCamera}
                className="h-10 w-10 rounded-full border-border/50 bg-surface/80 hover:border-[#d9ff00]/30 hover:bg-[#d9ff00]/5"
                title="Switch camera"
              >
                <SwitchCamera className="h-4 w-4 text-muted-foreground" />
              </Button>

              {/* Capture button */}
              <button
                type="button"
                onClick={handleCapture}
                disabled={isStarting}
                className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-[#d9ff00] bg-transparent hover:bg-[#d9ff00]/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <div className="h-12 w-12 rounded-full bg-[#d9ff00] group-hover:bg-[#c5eb00] transition-colors" />
              </button>

              {/* Close button */}
              {onClose && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onClose}
                  className="h-10 w-10 rounded-full border-border/50 bg-surface/80 hover:border-destructive/30 hover:bg-destructive/5"
                  title="Close"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
            </>
          ) : (
            <>
              {/* Retake */}
              <Button
                variant="outline"
                onClick={handleRetake}
                className="gap-2 border-border/50 bg-surface/80 hover:border-border/60"
              >
                <RotateCcw className="h-4 w-4" />
                Retake
              </Button>

              {/* Use Photo */}
              <Button
                onClick={handleConfirm}
                className="gap-2 bg-[#d9ff00] text-background hover:bg-[#c5eb00] font-semibold"
              >
                <Check className="h-4 w-4" />
                Use Photo
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
