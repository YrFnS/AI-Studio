'use client';

import type { ReactNode } from 'react';
import { GenerationRuntimeBridge } from '@/components/generation-runtime-bridge';

export default function Template({ children }: { children: ReactNode }) {
  return <GenerationRuntimeBridge>{children}</GenerationRuntimeBridge>;
}
