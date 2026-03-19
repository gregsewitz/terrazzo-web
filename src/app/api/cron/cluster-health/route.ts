/**
 * GET /api/cron/cluster-health
 *
 * Weekly cron job: monitors signal clustering health metrics and flags when
 * re-clustering is recommended. Checks three conditions:
 *
 *   1. Singleton accumulation — new signals that aren't in the corpus and
 *      were assigned via nearest-centroid fallback. High counts suggest the
 *      embedding space has shifted and centroids are stale.
 *
 *   2. Property catalog growth — significant new enrichments since the last
 *      clustering run mean the IDF weights and cluster compositions may be
 *      outdated.
 *
 *   3. Signal cache miss rate — the fraction of property signals that aren't
 *      in the pre-computed signal cache and require runtime centroid lookup.
 *      High miss rates indicate the corpus has drifted from the cache.
 *
 * When any threshold is exceeded, logs a warning and returns a recommendation.
 * Does not automatically trigger re-clustering — that's a manual pipeline
 * (see docs/recluster-handoff.md).
 *
 * Configured in vercel.json as a Vercel Cron running Mondays at 4am UTC.
 * Protected by CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSignalClusterMap } from '@/lib/taste-intelligence/signal-clusters-loader';

export const maxDuration = 60;

// ─── Thresholds ────────────────────────────────────────────────────────────
// These determine when re-clustering is recommended. Tuned for a corpus of
// ~7,600 signals and ~736 properties as of v3.4.

/** Flag if more than this many signals aren't in the frozen corpus */
const SINGLETON_THRESHOLD = 500;

/** Flag if properties have grown by more than this count since last clustering */
const NEW_PROPERTIES_THRESHOLD = 100;

/** Flag if more than this fraction of property signals miss the cache */
const CACHE_MISS_RATE_THRESHOLD = 0.05;

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const clusterMap = getSignalClusterMap();
    const frozenSignals = new Set(Object.keys(clusterMap.signalToCluster));
    const frozenCorpusSize = frozenSignals.size;

    // ── Check 1: Singleton accumulation ──────────────────────────────────
    // Count unique signals across all enriched properties that aren't in
    // the frozen signalToCluster mapping.

    const allIntelligence = await prisma.placeIntelligence.findMany({
      where: { status: 'complete', signalCount: { gt: 0 } },
      select: { signals: true },
    });

    const liveSignals = new Set<string>();
    let totalSignalInstances = 0;
    let missCount = 0;

    for (const record of allIntelligence) {
      const signals = (record.signals as unknown as Array<{ signal: string }>) || [];
      for (const sig of signals) {
        const normalized = sig.signal?.toLowerCase().trim();
        if (!normalized) continue;
        totalSignalInstances++;
        liveSignals.add(normalized);
        if (!frozenSignals.has(normalized)) {
          missCount++;
        }
      }
    }

    const newSingletons = [...liveSignals].filter(s => !frozenSignals.has(s));
    const singletonCount = newSingletons.length;
    const cacheMissRate = totalSignalInstances > 0 ? missCount / totalSignalInstances : 0;

    // ── Check 2: Property catalog growth ─────────────────────────────────
    // Compare current enriched property count against the count at clustering time.
    // The cluster JSON stores total_signals but not property count, so we infer
    // from the number of enriched properties.

    const currentPropertyCount = allIntelligence.length;

    // Estimate properties at clustering time from the JSON metadata
    // (v3.4 had 736 properties — stored as a rough reference)
    const clusteringPropertyCount = (clusterMap as unknown as Record<string, unknown>).property_count as number
      ?? 736; // fallback to known v3.4 count
    const newProperties = Math.max(0, currentPropertyCount - clusteringPropertyCount);

    // ── Evaluate ─────────────────────────────────────────────────────────

    const flags: string[] = [];

    if (singletonCount > SINGLETON_THRESHOLD) {
      flags.push(
        `Singleton accumulation: ${singletonCount} new signals not in frozen corpus ` +
        `(threshold: ${SINGLETON_THRESHOLD})`
      );
    }

    if (newProperties > NEW_PROPERTIES_THRESHOLD) {
      flags.push(
        `Property growth: ${newProperties} new enriched properties since clustering ` +
        `(threshold: ${NEW_PROPERTIES_THRESHOLD})`
      );
    }

    if (cacheMissRate > CACHE_MISS_RATE_THRESHOLD) {
      flags.push(
        `Cache miss rate: ${(cacheMissRate * 100).toFixed(1)}% of signal instances miss the cache ` +
        `(threshold: ${(CACHE_MISS_RATE_THRESHOLD * 100).toFixed(1)}%)`
      );
    }

    const needsReclustering = flags.length > 0;
    const status = needsReclustering ? 'reclustering_recommended' : 'healthy';

    if (needsReclustering) {
      console.warn(`[cron/cluster-health] RE-CLUSTERING RECOMMENDED:`);
      for (const flag of flags) {
        console.warn(`  - ${flag}`);
      }
    } else {
      console.log(
        `[cron/cluster-health] Healthy — ` +
        `${singletonCount} new singletons, ` +
        `${newProperties} new properties, ` +
        `${(cacheMissRate * 100).toFixed(1)}% cache miss rate`
      );
    }

    return NextResponse.json({
      status,
      timestamp: new Date().toISOString(),
      metrics: {
        frozenCorpusSize,
        liveUniqueSignals: liveSignals.size,
        newSingletons: singletonCount,
        singletonThreshold: SINGLETON_THRESHOLD,
        currentProperties: currentPropertyCount,
        clusteringProperties: clusteringPropertyCount,
        newProperties,
        propertyThreshold: NEW_PROPERTIES_THRESHOLD,
        totalSignalInstances,
        cacheMissCount: missCount,
        cacheMissRate: Math.round(cacheMissRate * 10000) / 10000,
        cacheMissThreshold: CACHE_MISS_RATE_THRESHOLD,
      },
      flags,
      recommendation: needsReclustering
        ? 'Run the re-clustering pipeline: see docs/recluster-handoff.md'
        : null,
    });
  } catch (error) {
    console.error('[cron/cluster-health] Failed:', error);
    return NextResponse.json(
      { error: 'Cluster health check failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}
