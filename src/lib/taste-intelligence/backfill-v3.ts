/**
 * Taste Intelligence — Backfill Pipeline (v3: Semantic Clustering)
 *
 * Computes v3.5 vectors (400-dim, signal-only with neighbor bleed + anti-signals)
 * and stores them in parallel columns: embeddingV3, tasteVectorV3.
 *
 * v3.5: Anti-signals now create negative cluster activations, improving discrimination
 * by pushing vectors apart where rejection preferences exist.
 *
 * Reuses IDF computation from v2.1 backfill.
 * Reads signals from TasteNode (canonical store) to compute vectors.
 */

import { prisma } from '@/lib/prisma';
import {
  computeUserTasteVectorV3,
  computePropertyEmbeddingV3,
  blendPropertyAnchors,
  vectorToSqlV3,
  setIdfWeightsV3,
  VECTOR_DIM_V3,
} from './vectors-v3';
import type { PropertyAnchorForBlending } from './vectors-v3';
import type {
  TasteSignal,
  GeneratedTasteProfile,
  BriefingSignal,
  BriefingAntiSignal,
  PropertyAnchor,
} from '@/types';

// ─── IDF Computation (shared logic, sets v3 IDF state) ──────────────────────

export async function computeAndSetIdfWeightsV3(): Promise<{ totalDocs: number; uniqueSignals: number }> {
  const allRecords = await prisma.placeIntelligence.findMany({
    where: { status: 'complete', signalCount: { gt: 0 } },
    select: { signals: true },
  });

  const signalDocFrequency = new Map<string, number>();
  let totalDocs = 0;

  for (const record of allRecords) {
    const signals = (record.signals as unknown as BriefingSignal[]) || [];
    if (signals.length === 0) continue;
    totalDocs++;

    const seenInDoc = new Set<string>();
    for (const sig of signals) {
      const normalized = sig.signal.toLowerCase().trim();
      if (!seenInDoc.has(normalized)) {
        seenInDoc.add(normalized);
        signalDocFrequency.set(normalized, (signalDocFrequency.get(normalized) || 0) + 1);
      }
    }
  }

  setIdfWeightsV3(signalDocFrequency, totalDocs);
  console.log(`[v3-idf] ${signalDocFrequency.size} unique signals across ${totalDocs} properties`);

  return { totalDocs, uniqueSignals: signalDocFrequency.size };
}

// ─── User vectors (v3) ──────────────────────────────────────────────────────

export async function backfillUserV3(userId: string): Promise<{ vectorComputed: boolean; anchorsBlended: number }> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      tasteProfile: true,
    },
  });

  const profile = user.tasteProfile as unknown as GeneratedTasteProfile | null;
  if (!profile?.radarData || profile.radarData.length === 0) {
    return { vectorComputed: false, anchorsBlended: 0 };
  }

  // Read signals from TasteNode (canonical store) instead of User.allSignals JSON
  const tasteNodes = await prisma.tasteNode.findMany({
    where: { userId, isActive: true },
    select: { signal: true, domain: true, confidence: true },
  });
  const signals: TasteSignal[] = tasteNodes.map((tn: { signal: string; domain: string; confidence: number }) => ({
    tag: tn.signal,
    cat: tn.domain,
    confidence: tn.confidence,
  }));

  // Step 1: Compute base taste vector from signals
  let vector = await computeUserTasteVectorV3({
    radarData: profile.radarData,
    microTasteSignals: profile.microTasteSignals || {},
    allSignals: signals.length > 0 ? signals : undefined,
  });

  // Step 2: Blend property anchor embeddings if available
  // Use raw query to fetch propertyAnchors JSON column (avoids Prisma client regeneration requirement)
  const anchorRows = await prisma.$queryRawUnsafe<Array<{ propertyAnchors: PropertyAnchor[] | null }>>(
    `SELECT "propertyAnchors" FROM "User" WHERE "id" = $1`,
    userId,
  );
  const rawAnchors = (anchorRows[0]?.propertyAnchors as PropertyAnchor[]) || [];
  let anchorsBlended = 0;

  if (rawAnchors.length > 0) {
    // Fetch V3 embeddings for all anchored properties
    const anchorGooglePlaceIds = rawAnchors.map((a) => a.googlePlaceId);
    const anchorEmbeddings = await prisma.$queryRawUnsafe<Array<{
      googlePlaceId: string;
      embeddingV3: string;
    }>>(
      `SELECT "googlePlaceId", "embeddingV3"::text
       FROM "PlaceIntelligence"
       WHERE "googlePlaceId" = ANY($1)
         AND "embeddingV3" IS NOT NULL`,
      anchorGooglePlaceIds,
    );

    const embeddingMap = new Map<string, number[]>();
    for (const row of anchorEmbeddings) {
      // Parse pgvector text representation: "[0.1,0.2,...]"
      const nums = row.embeddingV3
        .replace(/^\[/, '').replace(/\]$/, '')
        .split(',')
        .map(Number);
      if (nums.length === VECTOR_DIM_V3) {
        embeddingMap.set(row.googlePlaceId, nums);
      }
    }

    const anchorsForBlending: PropertyAnchorForBlending[] = [];
    for (const anchor of rawAnchors) {
      const embedding = embeddingMap.get(anchor.googlePlaceId);
      if (embedding) {
        anchorsForBlending.push({
          embedding,
          blendWeight: anchor.blendWeight,
        });
      }
    }

    if (anchorsForBlending.length > 0) {
      vector = blendPropertyAnchors(vector, anchorsForBlending);
      anchorsBlended = anchorsForBlending.length;
      console.log(`[v3-backfill] Blended ${anchorsBlended} property anchor(s) for user ${userId}`);
    }
  }

  const vecSql = vectorToSqlV3(vector);

  await prisma.$executeRawUnsafe(
    `UPDATE "User" SET "tasteVectorV3" = $1::vector WHERE "id" = $2`,
    vecSql,
    userId,
  );

  return { vectorComputed: true, anchorsBlended };
}

export async function backfillAllUsersV3(): Promise<{ total: number; computed: number }> {
  const users = await prisma.user.findMany({
    where: { isOnboardingComplete: true },
    select: { id: true, email: true },
  });

  console.log(`[v3-backfill] Processing ${users.length} users...`);
  let computed = 0;

  for (const user of users) {
    try {
      const result = await backfillUserV3(user.id);
      if (result.vectorComputed) computed++;
      console.log(`[v3-backfill] User ${user.email}: vector=${result.vectorComputed}`);
    } catch (err) {
      console.error(`[v3-backfill] Failed for ${user.email}:`, err);
    }
  }

  return { total: users.length, computed };
}

// ─── Property embeddings (v3) ───────────────────────────────────────────────

export async function backfillPropertyEmbeddingV3(placeIntelligenceId: string): Promise<boolean> {
  const pi = await prisma.placeIntelligence.findUniqueOrThrow({
    where: { id: placeIntelligenceId },
    select: {
      id: true,
      propertyName: true,
      signals: true,
      antiSignals: true,
    },
  });

  const signals = (pi.signals as unknown as BriefingSignal[]) || [];
  const antiSignals = (pi.antiSignals as unknown as BriefingAntiSignal[]) || [];

  if (signals.length === 0) return false;

  const embedding = await computePropertyEmbeddingV3({ signals, antiSignals });
  const vecSql = vectorToSqlV3(embedding);

  await prisma.$executeRawUnsafe(
    `UPDATE "PlaceIntelligence" SET "embeddingV3" = $1::vector WHERE "id" = $2`,
    vecSql,
    pi.id,
  );

  return true;
}

export async function backfillAllPropertyEmbeddingsV3(): Promise<{
  total: number;
  computed: number;
  skipped: number;
}> {
  // Only fetch records that are missing V3 embeddings (pgvector column not queryable via Prisma)
  const missing = await prisma.$queryRaw<Array<{ id: string; propertyName: string | null }>>`
    SELECT "id", "propertyName"
    FROM "PlaceIntelligence"
    WHERE "status" = 'complete'
      AND "signalCount" > 0
      AND "embeddingV3" IS NULL
  `;

  // Also count total eligible for reporting
  const totalEligible = await prisma.placeIntelligence.count({
    where: { status: 'complete', signalCount: { gt: 0 } },
  });

  console.log(`[v3-backfill] ${missing.length} properties missing v3 embeddings (${totalEligible} total eligible)`);
  let computed = 0;
  let skipped = 0;

  for (const record of missing) {
    try {
      const success = await backfillPropertyEmbeddingV3(record.id);
      if (success) computed++;
      else skipped++;
    } catch (err) {
      console.error(`[v3-backfill] Failed: ${record.propertyName}:`, err);
      skipped++;
    }
  }

  console.log(`[v3-backfill] Done: ${computed} v3 embeddings, ${skipped} skipped`);
  return { total: totalEligible, computed, skipped };
}

// ─── Batched property backfill (for serverless environments) ─────────────────

export async function backfillPropertyEmbeddingsBatchV3(
  offset: number,
  limit: number,
): Promise<{ total: number; computed: number; skipped: number; offset: number; limit: number }> {
  // Fetch ALL eligible records missing V3 embeddings, then slice
  const missing = await prisma.$queryRaw<Array<{ id: string; propertyName: string | null }>>`
    SELECT "id", "propertyName"
    FROM "PlaceIntelligence"
    WHERE "status" = 'complete'
      AND "signalCount" > 0
      AND "embeddingV3" IS NULL
    ORDER BY "id"
    OFFSET ${offset}
    LIMIT ${limit}
  `;

  const totalMissing = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT count(*) FROM "PlaceIntelligence"
    WHERE "status" = 'complete' AND "signalCount" > 0 AND "embeddingV3" IS NULL
  `;
  const total = Number(totalMissing[0]?.count ?? 0);

  console.log(`[v3-batch] Processing ${missing.length} properties (offset=${offset}, total missing=${total})`);
  let computed = 0;
  let skipped = 0;

  for (const record of missing) {
    try {
      const success = await backfillPropertyEmbeddingV3(record.id);
      if (success) computed++;
      else skipped++;
    } catch (err) {
      console.error(`[v3-batch] Failed: ${record.propertyName}:`, err);
      skipped++;
    }
  }

  console.log(`[v3-batch] Done: ${computed} computed, ${skipped} skipped`);
  return { total, computed, skipped, offset, limit };
}

// ─── Full v3 backfill ───────────────────────────────────────────────────────

export async function runFullBackfillV3() {
  console.log('═══ V3.5 Semantic Clustering Backfill (400-dim, anti-signals + property anchor blending) ═══\n');

  console.log('── Step 0: IDF Weights ──');
  const idf = await computeAndSetIdfWeightsV3();
  console.log('');

  console.log('── Step 1: User Taste Vectors (v3) ──');
  const users = await backfillAllUsersV3();
  console.log(`${users.computed}/${users.total} user vectors computed\n`);

  console.log('── Step 2: Property Embeddings (v3) ──');
  const props = await backfillAllPropertyEmbeddingsV3();
  console.log(`${props.computed}/${props.total} property embeddings computed\n`);

  console.log('═══ V3 Backfill Complete ═══');
  return { idf, users, props };
}
