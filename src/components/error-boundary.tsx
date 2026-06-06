'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] p-6">
          {/* Ambient glow effects */}
          <div
            className="pointer-events-none absolute left-1/4 top-1/4 h-[500px] w-[500px] rounded-full opacity-20 blur-[120px]"
            style={{ background: 'radial-gradient(circle, rgba(217,255,0,0.15) 0%, transparent 70%)' }}
          />
          <div
            className="pointer-events-none absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full opacity-15 blur-[100px]"
            style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.12) 0%, transparent 70%)' }}
          />

          <div className="relative z-10 flex flex-col items-center gap-6 text-center">
            {/* Error icon with glow */}
            <div className="relative">
              <div className="absolute inset-0 animate-pulse rounded-full bg-red-500/20 blur-xl" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl border border-red-500/20 bg-white/[0.03] backdrop-blur-xl">
                <AlertTriangle className="h-12 w-12 text-red-400" />
              </div>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">
                Something went wrong
              </h1>
              <p className="text-sm text-muted-foreground">
                An unexpected error occurred. Don&apos;t worry, your data is safe.
              </p>
            </div>

            {/* Error message card */}
            {this.state.error && (
              <div className="glass max-w-lg rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4">
                <p className="font-mono text-xs leading-relaxed text-red-300/80 break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            {/* Try Again button */}
            <Button
              onClick={this.handleReset}
              className="group gap-2 bg-[#d9ff00] text-background hover:bg-[#c5eb00] font-semibold rounded-xl px-6 h-11 transition-all duration-200 hover:shadow-[0_0_20px_rgba(217,255,0,0.3)]"
            >
              <RefreshCw className="h-4 w-4 transition-transform duration-300 group-hover:rotate-180" />
              Try Again
            </Button>

            {/* Subtle hint */}
            <p className="text-[11px] text-muted-foreground/40">
              If the problem persists, try refreshing the page
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
