/**
 * Resolve current display labels for stored matchExplanation data.
 *
 * matchExplanation is stored as JSON in SavedPlace records. If cluster labels
 * are updated (e.g., by running relabel-clusters.py), the stored labels become
 * stale. This utility resolves the current displayLabel for each cluster by ID,
 * ensuring users always see up-to-date labels regardless of when the match was
 * computed.
 *
 * Server-only: depends on signal-clusters-loader (uses fs).
 */

import { getSignalClusterMap } from '@/lib/taste-intelligence/signal-clusters-loader';
import { humanizeClusterLabel } from '@/lib/humanize-label';

interface StoredCluster {
  clusterId?: number;
  label: string;
  domain: string;
  score: number;
  signals: string[];
}

interface StoredMatchExplanation {
  topClusters: StoredCluster[];
  narrative: string;
}

/**
 * Given a stored matchExplanation (from the DB), resolve current display labels
 * for each cluster. If a cluster has a `clusterId`, looks up the current
 * displayLabel from the signal cluster map. Otherwise falls back to the stored
 * label (legacy data without clusterIds).
 *
 * Returns a new object — does not mutate the input.
 */
export function resolveExplanationLabels(
  explanation: StoredMatchExplanation | null | undefined,
): StoredMatchExplanation | null {
  if (!explanation?.topClusters?.length) return explanation ?? null;

  const clusterMap = getSignalClusterMap();

  const resolved = {
    ...explanation,
    topClusters: explanation.topClusters.map((c) => {
      // If we have a clusterId, look up the current label
      if (c.clusterId != null) {
        const info = clusterMap.clusters?.[String(c.clusterId)];
        if (info) {
          return {
            ...c,
            label: humanizeClusterLabel(info.label, info.displayLabel),
          };
        }
      }
      // No clusterId or cluster not found — return as-is
      return c;
    }),
  };

  return resolved;
}
