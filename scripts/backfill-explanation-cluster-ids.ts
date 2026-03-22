#!/usr/bin/env npx tsx
/**
 * Backfill clusterId into stored matchExplanation records.
 *
 * After running relabel-clusters.py, the signal-clusters.json has updated
 * displayLabels, but the matchExplanation JSON stored in SavedPlace records
 * still has old labels and no clusterIds. This script:
 *
 *   1. Builds a reverse map from all known label forms → clusterId
 *   2. Scans all SavedPlace records with matchExplanation
 *   3. For resolvable clusters: adds clusterId + current displayLabel
 *   4. For unresolvable records (from older clustering runs): nulls the
 *      matchExplanation so it gets recomputed on next rescore
 *   5. Collects affected user IDs and triggers a rescore for each
 *
 * Usage:
 *   npx tsx scripts/backfill-explanation-cluster-ids.ts          # dry-run
 *   npx tsx scripts/backfill-explanation-cluster-ids.ts --apply  # write to DB + rescore
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 10_000,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const apply = process.argv.includes('--apply');

interface ClusterInfo {
  label: string;
  displayLabel?: string;
  oldLabel?: string;
  domain?: string;
  topSignals: string[];
}

interface StoredCluster {
  clusterId?: number;
  label: string;
  domain: string;
  score: number;
  signals: string[];
}

interface StoredExplanation {
  topClusters: StoredCluster[];
  narrative: string;
}

// ─── Build reverse label → clusterId map ────────────────────────────────────

function buildReverseMap(clusters: Record<string, ClusterInfo>): Map<string, number> {
  const map = new Map<string, number>();

  for (const [cid, info] of Object.entries(clusters)) {
    const id = parseInt(cid, 10);

    // Map all known label forms to this cluster ID
    for (const labelField of ['label', 'oldLabel'] as const) {
      const rawLabel = (info as any)[labelField] as string | undefined;
      if (!rawLabel) continue;

      map.set(rawLabel, id); // "Atmosphere:barefoot-cool-design"

      if (rawLabel.includes(':')) {
        const hyphenated = rawLabel.split(':', 2)[1];
        map.set(hyphenated, id); // "barefoot-cool-design"

        // Title-cased version (what humanizeLabel produces)
        const titled = hyphenated
          .replace(/-/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());
        map.set(titled, id); // "Barefoot Cool Design"

        // Version with generic words stripped (matches component humanizeLabel)
        const stripped = hyphenated
          .replace(/-/g, ' ')
          .replace(/\b(format|style|emphasis|preference|level)\b/gi, '')
          .trim()
          .replace(/\s+/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());
        if (stripped !== titled) {
          map.set(stripped, id);
        }
      }
    }

    if (info.displayLabel) {
      map.set(info.displayLabel, id); // "Tactile Design"
    }
  }

  return map;
}

function getCurrentLabel(clusterId: number, clusters: Record<string, ClusterInfo>): string {
  const info = clusters[String(clusterId)];
  if (!info) return `cluster-${clusterId}`;
  return info.displayLabel || info.label || `cluster-${clusterId}`;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Backfill matchExplanation cluster IDs (${apply ? 'APPLY' : 'DRY RUN'})\n`);

  // Load current cluster data
  const filePath = path.join(process.cwd(), 'src', 'lib', 'taste-intelligence', 'signal-clusters.json');
  const clusterData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const clusters: Record<string, ClusterInfo> = clusterData.clusters;

  const reverseMap = buildReverseMap(clusters);
  console.log(`Built reverse label map: ${reverseMap.size} entries`);

  // Fetch all SavedPlace records that have a matchExplanation
  const places = await prisma.$queryRawUnsafe<Array<{
    id: string;
    userId: string;
    matchExplanation: StoredExplanation;
  }>>(
    `SELECT id, "userId", "matchExplanation"
     FROM "SavedPlace"
     WHERE "matchExplanation" IS NOT NULL
       AND "matchExplanation" != 'null'::jsonb`,
  );

  console.log(`Found ${places.length} SavedPlace records with matchExplanation\n`);

  let fullyResolved = 0;
  let partiallyResolved = 0;
  let alreadyCurrent = 0;
  let nulledOut = 0;
  const usersNeedingRescore = new Set<string>();

  for (const place of places) {
    const explanation = place.matchExplanation;
    if (!explanation?.topClusters?.length) continue;

    let needsUpdate = false;
    let hasUnresolved = false;

    const resolvedClusters = explanation.topClusters.map(c => {
      // Already has a valid clusterId — just refresh the label
      if (c.clusterId != null && c.clusterId >= 0) {
        const currentLabel = getCurrentLabel(c.clusterId, clusters);
        if (currentLabel !== c.label) {
          needsUpdate = true;
          return { ...c, label: currentLabel };
        }
        return c;
      }

      // Try to resolve clusterId from stored label
      const clusterId = reverseMap.get(c.label);
      if (clusterId != null) {
        needsUpdate = true;
        return {
          ...c,
          clusterId,
          label: getCurrentLabel(clusterId, clusters),
        };
      }

      // Unresolvable — from an older clustering run
      hasUnresolved = true;
      return c;
    });

    if (hasUnresolved) {
      // Any unresolved cluster means the whole explanation is from a stale
      // clustering epoch. Null it out — it'll be regenerated on next rescore.
      if (apply) {
        await prisma.$executeRawUnsafe(
          `UPDATE "SavedPlace" SET "matchExplanation" = NULL WHERE id = $1`,
          place.id,
        );
      }
      nulledOut++;
      usersNeedingRescore.add(place.userId);
    } else if (needsUpdate) {
      const newExplanation = { ...explanation, topClusters: resolvedClusters };
      if (apply) {
        await prisma.$executeRawUnsafe(
          `UPDATE "SavedPlace" SET "matchExplanation" = $1::jsonb WHERE id = $2`,
          JSON.stringify(newExplanation),
          place.id,
        );
      }
      fullyResolved++;
    } else {
      alreadyCurrent++;
    }
  }

  console.log(`\nResults:`);
  console.log(`  Already current (has clusterIds + correct labels): ${alreadyCurrent}`);
  console.log(`  Resolved (added clusterIds + updated labels):      ${fullyResolved}`);
  console.log(`  Nulled out (stale clustering, needs rescore):      ${nulledOut}`);
  console.log(`  Users needing rescore:                             ${usersNeedingRescore.size}`);

  // ─── Rescore affected users ───────────────────────────────────────────────
  if (apply && usersNeedingRescore.size > 0) {
    console.log(`\nRescoring ${usersNeedingRescore.size} users to regenerate explanations...`);

    // Dynamic import to get the rescore function (uses server-side deps)
    // We can't use the full rescoreAllSavedPlacesV3 because it imports from
    // Next.js modules. Instead, do a minimal inline rescore.
    const { computeVectorMatch, breakdownToNormalized } = await import('../src/lib/taste-match-vectors.js');
    const { getSignalClusterMap } = await import('../src/lib/taste-intelligence/signal-clusters-loader.js');

    // Warm up the cluster map
    getSignalClusterMap();

    let totalRescored = 0;

    for (const userId of usersNeedingRescore) {
      // Fetch user vector
      const userRow = await prisma.$queryRawUnsafe<Array<{ vec: string | null }>>(
        `SELECT "tasteVectorV3"::text as vec FROM "User" WHERE id = $1`,
        userId,
      );
      const userVecRaw = userRow[0]?.vec;
      if (!userVecRaw) {
        console.log(`  User ${userId}: no V3 vector, skipping`);
        continue;
      }
      const userVector = parsePgVector(userVecRaw);

      // Fetch their saved places that need rescoring (ones we just nulled)
      const userPlaces = await prisma.$queryRawUnsafe<
        Array<{ spId: string; propVec: string }>
      >(
        `SELECT sp.id as "spId", pi."embeddingV3"::text as "propVec"
         FROM "SavedPlace" sp
         JOIN "PlaceIntelligence" pi ON pi."googlePlaceId" = sp."googlePlaceId"
         WHERE sp."userId" = $1
           AND sp."matchExplanation" IS NULL
           AND pi.status = 'complete'
           AND pi."embeddingV3" IS NOT NULL`,
        userId,
      );

      if (userPlaces.length === 0) {
        console.log(`  User ${userId}: no places to rescore`);
        continue;
      }

      // Compute matches
      const rawMatches: Array<{ spId: string; result: any; overallScore: number }> = [];
      for (const p of userPlaces) {
        try {
          const propVector = parsePgVector(p.propVec);
          const result = computeVectorMatch(userVector, propVector);
          rawMatches.push({ spId: p.spId, result, overallScore: result.overallScore });
        } catch (err) {
          // skip
        }
      }

      // Write raw scores back (no normalization — tiers derived at read time)
      let userRescored = 0;
      for (const match of rawMatches) {
        try {
          await prisma.$executeRawUnsafe(
            `UPDATE "SavedPlace"
             SET "matchScore" = $1,
                 "matchBreakdown" = $2::jsonb,
                 "matchExplanation" = $3::jsonb
             WHERE id = $4`,
            match.overallScore,
            JSON.stringify(breakdownToNormalized(match.result.breakdown)),
            JSON.stringify(match.result.explanation),
            match.spId,
          );
          userRescored++;
        } catch (err) {
          // skip
        }
      }

      totalRescored += userRescored;
      console.log(`  User ${userId}: rescored ${userRescored}/${userPlaces.length} places`);
    }

    console.log(`\nRescore complete: ${totalRescored} places updated`);
  } else if (!apply && usersNeedingRescore.size > 0) {
    console.log(`\n(Rescore will run automatically when --apply is used)`);
  }

  if (!apply && (fullyResolved > 0 || nulledOut > 0)) {
    console.log(`\nDry run complete. To apply changes + rescore, run with --apply`);
  }

  await prisma.$disconnect();
  await pool.end();
}

/** Parse pgvector text format "[0.1,0.2,...]" → number[] */
function parsePgVector(text: string): number[] {
  return text.replace(/[\[\]]/g, '').split(',').map(Number);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
