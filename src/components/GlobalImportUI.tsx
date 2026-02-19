'use client';

import FloatingImportBar from '@/components/FloatingImportBar';

/**
 * GlobalImportUI — client component wrapper that renders the floating
 * import progress bar globally across all pages.
 * Mounted in root layout.tsx so it persists across page navigation.
 */
export default function GlobalImportUI() {
  return <FloatingImportBar />;
}
