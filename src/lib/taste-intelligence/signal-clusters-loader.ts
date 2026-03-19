/**
 * Lazy loader for signal-clusters.json
 *
 * The cluster map (17MB) lives in public/data/signal-clusters.json — outside
 * the webpack bundle — and is loaded from disk on first access, then cached
 * for the lifetime of the process (singleton). This means:
 *
 *  • The JSON is never bundled into the Next.js server bundle (no cold-parse
 *    at module-load time for every route that imports taste-intelligence).
 *  • It is NOT shipped to the browser (server-only utility via fs.readFileSync).
 *  • Updating the cluster map only requires replacing the file in public/data/;
 *    no code change or redeploy needed.
 *
 * Server-only: this module uses `fs` and will throw if imported in a client
 * component. Keep it in API routes and server-side lib only.
 */

import fs from 'fs';
import path from 'path';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ClusterInfo {
  label: string;
  displayLabel?: string;
  domain?: string;
  topSignals: string[];
  size?: number;
}

export interface ClusterNeighbor {
  cluster: number;
  similarity: number;
  weight?: number;
  tier?: string;
}

export interface SignalClusterMap {
  signalToCluster: Record<string, number>;
  clusters: Record<string, ClusterInfo>;
  clusterCentroids?: Record<string, number[]>;
  clusterNeighbors?: Record<string, ClusterNeighbor[]>;
  intra_bleed_scale?: number;
  cross_bleed_scale?: number;
  neighbor_decay?: number;
}

// ─── Singleton loader ─────────────────────────────────────────────────────────

let _cache: SignalClusterMap | null = null;

/**
 * Returns the parsed signal cluster map, loading it from disk on first call.
 * Subsequent calls return the same cached object — O(1) after warm-up.
 *
 * The file is resolved relative to process.cwd() (the Next.js project root),
 * which is stable in both local dev and Vercel deployments.
 */
export function getSignalClusterMap(): SignalClusterMap {
  if (_cache) return _cache;

  const filePath = path.join(process.cwd(), 'public', 'data', 'signal-clusters.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  _cache = JSON.parse(raw) as SignalClusterMap;
  return _cache;
}

/**
 * Clears the in-process cache. Useful in tests that need a fresh load.
 */
export function clearSignalClusterCache(): void {
  _cache = null;
}
