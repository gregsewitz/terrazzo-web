/**
 * Taste Intelligence — Backfill Pipeline (v3: Semantic Clustering)
 *
 * Computes v3 vectors (104-dim, semantic cluster based) and stores them
 * in parallel columns: embeddingV3, tasteVectorV3.
 *
 * Reuses IDF computation from v2.1 backfill.
 * Does NOT touch user graph (TasteNode, ContradictionNode) — only vectors.
 */

import { prisma } from '@/lib/prisma';
import {
  computeUserTasteVectorV3,
  computePropertyEmbeddingV3,
  vectorToSqlV3,
  setIdfWeightsV3,
} from './vectors-v3';
import type {
  TasteSignal,
  GeneratedTasteProfile,
  BriefingSignal,
  BriefingAntiSignal,
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

export async function backfillUserV3(userId: string): Promise<{ vectorComputed: boolean }> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      allSignals: true,
      tasteProfile: true,
    },
  });

  const profile = user.tasteProfile as unknown as GeneratedTasteProfile | null;
  if (!profile?.radarData || profile.radarData.length === 0) {
    return { vectorComputed: false };
  }

  const signals = (user.allSignals as unknown as TasteSignal[]) || [];

  const vector = computeUserTasteVectorV3({
    radarData: profile.radarData,
    microTasteSignals: profile.microTasteSignals || {},
    allSignals: signals.length > 0 ? signals : undefined,
  });

  const vecSql = vectorToSqlV3(vector);

  await prisma.$executeRawUnsafe(
    `UPDATE "User" SET "tasteVectorV3" = $1::vector WHERE "id" = $2`,
    vecSql,
    userId,
  );

  return { vectorComputed: true };
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

  const embedding = computePropertyEmbeddingV3({ signals, antiSignals });
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
  const records = await prisma.placeIntelligence.findMany({
    where: { status: 'complete', signalCount: { gt: 0 } },
    select: { id: true, propertyName: true, signals: true },
  });

  const valid = records.filter((r) => {
    const signals = r.signals as unknown as unknown[];
    return Array.isArray(signals) && signals.length > 0;
  });

  console.log(`[v3-backfill] Computing v3 embeddings for ${valid.length} properties...`);
  let computed = 0;
  let skipped = 0;

  for (const record of valid) {
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
  return { total: valid.length, computed, skipped };
}

// ─── Full v3 backfill ───────────────────────────────────────────────────────

export async function runFullBackfillV3() {
  console.log('═══ V3 Semantic Clustering Backfill (104-dim) ═══\n');

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
