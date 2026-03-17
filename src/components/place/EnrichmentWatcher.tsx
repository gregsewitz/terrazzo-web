'use client';

import { useEnrichmentPolling } from '@/hooks/useEnrichmentPolling';

/**
 * Headless component that watches for under-enriched places in the store
 * and polls the server for updated data. Mounted once in the root layout
 * so ALL views (library, collections, picks strip, rail, etc.) get
 * automatic updates when the Railway enrichment pipeline completes.
 */
export default function EnrichmentWatcher() {
  useEnrichmentPolling();
  return null;
}
