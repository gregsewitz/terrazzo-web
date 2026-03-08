/**
 * @deprecated v2.1 backfill pipeline replaced by backfill-v3.ts in v4 architecture.
 * This file is preserved for reference only. Use backfill-v3.ts for all new code.
 *
 * Taste Intelligence — Backfill Pipeline
 *
 * TG-02:  Extract signals from User.allSignals JSON → TasteNode rows
 * TG-10:  Compute + store taste vectors for all existing users
 * PE-08:  Compute + store embeddings for all PlaceIntelligence records
 *
 * v2.1: Now computes IDF weights from the property corpus before generating vectors,
 *       so rare signals are weighted more heavily than common ones.
 */

import { prisma } from '@/lib/prisma';
import {
  computeUserVectorFromProfile,
  computePropertyEmbedding,
  vectorToSql,
  setIdfWeights,
} from './vectors';
import type {
  TasteSignal,
  TasteContradiction,
  ContextModifier,
  GeneratedTasteProfile,
  BriefingSignal,
  BriefingAntiSignal,
} from '@/types';
import { DIMENSION_TO_DOMAIN } from '@/types';

// ─── IDF Computation ─────────────────────────────────────────────────────────

/**
 * Compute IDF weights from all property signals in the corpus.
 * Must be called before generating any vectors.
 *
 * Scans all PlaceIntelligence.signals to build document frequency per signal,
 * then calls setIdfWeights() to make them available to vector computation.
 */
export async function computeAndSetIdfWeights(): Promise<{ totalDocs: number; uniqueSignals: number }> {
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

    // Track unique signals per document (each signal counts once per property)
    const seenInDoc = new Set<string>();
    for (const sig of signals) {
      const normalized = sig.signal.toLowerCase().trim();
      if (!seenInDoc.has(normalized)) {
        seenInDoc.add(normalized);
        signalDocFrequency.set(normalized, (signalDocFrequency.get(normalized) || 0) + 1);
      }
    }
  }

  setIdfWeights(signalDocFrequency, totalDocs);

  console.log(`[idf] Computed IDF weights: ${signalDocFrequency.size} unique signals across ${totalDocs} properties`);

  return { totalDocs, uniqueSignals: signalDocFrequency.size };
}

// ─── TG-02: Extract signals from User.allSignals → TasteNode ───────────────

export interface BackfillUserResult {
  userId: string;
  nodesCreated: number;
  contradictionsCreated: number;
  contextModifiersCreated: number;
  vectorComputed: boolean;
}

/**
 * Backfill taste graph data for a single user:
 * 1. Extract allSignals → TasteNode rows
 * 2. Extract allContradictions → ContradictionNode rows
 * 3. Extract contextModifiers → ContextModifier rows
 * 4. Compute and store tasteVector
 */
export async function backfillUser(userId: string): Promise<BackfillUserResult> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      allSignals: true,
      allContradictions: true,
      tasteProfile: true,
    },
  });

  const result: BackfillUserResult = {
    userId,
    nodesCreated: 0,
    contradictionsCreated: 0,
    contextModifiersCreated: 0,
    vectorComputed: false,
  };

  // 1. Extract signals → TasteNode
  const signals = (user.allSignals as unknown as TasteSignal[]) || [];
  if (signals.length > 0) {
    // Clear existing nodes for this user (idempotent re-run)
    await prisma.tasteNode.deleteMany({ where: { userId, source: 'onboarding' } });

    const nodes = signals
      .filter((s) => s.confidence > 0)
      .map((s) => {
        const domain = DIMENSION_TO_DOMAIN[s.cat] || s.cat;
        return {
          userId,
          domain,
          signal: s.tag,
          confidence: s.confidence,
          source: 'onboarding' as const,
          category: s.cat,
        };
      });

    if (nodes.length > 0) {
      await prisma.tasteNode.createMany({ data: nodes });
      result.nodesCreated = nodes.length;
    }
  }

  // 2. Extract contradictions → ContradictionNode
  const contradictions = (user.allContradictions as unknown as TasteContradiction[]) || [];
  if (contradictions.length > 0) {
    await prisma.contradictionNode.deleteMany({ where: { userId } });

    const contradictionNodes = contradictions.map((c) => ({
      userId,
      stated: c.stated,
      revealed: c.revealed,
      resolution: c.resolution,
      matchRule: c.matchRule,
      strength: 0.5,
    }));

    await prisma.contradictionNode.createMany({ data: contradictionNodes });
    result.contradictionsCreated = contradictionNodes.length;
  }

  // 3. Extract context modifiers
  const profile = user.tasteProfile as unknown as GeneratedTasteProfile | null;
  if (profile?.contextModifiers && profile.contextModifiers.length > 0) {
    await prisma.contextModifier.deleteMany({ where: { userId } });

    const modifiers = profile.contextModifiers.map((cm: ContextModifier) => ({
      userId,
      context: cm.context,
      shifts: cm.shifts,
    }));

    await prisma.contextModifier.createMany({ data: modifiers });
    result.contextModifiersCreated = modifiers.length;
  }

  // 4. Compute taste vector (IDF weights should already be set via computeAndSetIdfWeights)
  if (profile?.radarData && profile.radarData.length > 0) {
    const vector = computeUserVectorFromProfile(
      profile,
      signals.length > 0 ? signals : undefined
    );
    const vecSql = vectorToSql(vector);

    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET "tasteVector" = $1::vector, "tasteVectorUpdatedAt" = NOW() WHERE "id" = $2`,
      vecSql,
      userId,
    );
    result.vectorComputed = true;
  }

  return result;
}

// ─── TG-10: Backfill all users ──────────────────────────────────────────────

export async function backfillAllUsers(): Promise<BackfillUserResult[]> {
  const users = await prisma.user.findMany({
    where: { isOnboardingComplete: true },
    select: { id: true },
  });

  console.log(`[backfill] Processing ${users.length} onboarded users...`);
  const results: BackfillUserResult[] = [];

  for (const user of users) {
    try {
      const result = await backfillUser(user.id);
      results.push(result);
      console.log(
        `[backfill] User ${user.id}: ${result.nodesCreated} nodes, ` +
        `${result.contradictionsCreated} contradictions, vector=${result.vectorComputed}`
      );
    } catch (err) {
      console.error(`[backfill] Failed for user ${user.id}:`, err);
    }
  }

  return results;
}

// ─── PE-08: Backfill property embeddings ────────────────────────────────────

export interface BackfillPropertyResult {
  id: string;
  googlePlaceId: string;
  propertyName: string;
  embeddingComputed: boolean;
}

/**
 * Compute and store embedding for a single PlaceIntelligence record.
 */
export async function backfillPropertyEmbedding(
  placeIntelligenceId: string
): Promise<BackfillPropertyResult> {
  const pi = await prisma.placeIntelligence.findUniqueOrThrow({
    where: { id: placeIntelligenceId },
    select: {
      id: true,
      googlePlaceId: true,
      propertyName: true,
      signals: true,
      antiSignals: true,
      signalCount: true,
    },
  });

  const signals = (pi.signals as unknown as BriefingSignal[]) || [];
  const antiSignals = (pi.antiSignals as unknown as BriefingAntiSignal[]) || [];

  if (signals.length === 0) {
    return {
      id: pi.id,
      googlePlaceId: pi.googlePlaceId,
      propertyName: pi.propertyName,
      embeddingComputed: false,
    };
  }

  const embedding = computePropertyEmbedding({ signals, antiSignals });
  const vecSql = vectorToSql(embedding);

  await prisma.$executeRawUnsafe(
    `UPDATE "PlaceIntelligence" SET "embedding" = $1::vector, "embeddingUpdatedAt" = NOW() WHERE "id" = $2`,
    vecSql,
    pi.id,
  );

  return {
    id: pi.id,
    googlePlaceId: pi.googlePlaceId,
    propertyName: pi.propertyName,
    embeddingComputed: true,
  };
}

/**
 * Backfill embeddings for all enriched PlaceIntelligence records.
 */
export async function backfillAllPropertyEmbeddings(): Promise<{
  total: number;
  computed: number;
  skipped: number;
}> {
  const allRecords = await prisma.placeIntelligence.findMany({
    where: {
      status: 'complete',
      signalCount: { gt: 0 },
    },
    select: { id: true, propertyName: true, signals: true },
  });

  const records = allRecords.filter((r) => {
    const signals = r.signals as unknown as unknown[];
    return Array.isArray(signals) && signals.length > 0;
  });

  console.log(`[backfill] Computing embeddings for ${records.length} properties (${allRecords.length - records.length} skipped — empty signals JSON)...`);
  let computed = 0;
  let skipped = 0;

  for (const record of records) {
    try {
      const result = await backfillPropertyEmbedding(record.id);
      if (result.embeddingComputed) {
        computed++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`[backfill] Failed for property ${record.propertyName}:`, err);
      skipped++;
    }
  }

  console.log(`[backfill] Done: ${computed} embeddings computed, ${skipped} skipped`);
  return { total: records.length, computed, skipped };
}

// ─── Full Backfill ──────────────────────────────────────────────────────────

/**
 * Run the complete Phase 1 + Phase 2 backfill.
 * v2.1: Computes IDF weights first, then generates all vectors.
 */
export async function runFullBackfill() {
  console.log('═══ Taste Intelligence Backfill (v2.1: 136-dim) ═══');
  console.log('');

  // Step 0: Compute IDF weights from property corpus
  console.log('── Step 0: Computing IDF Weights ──');
  const idfStats = await computeAndSetIdfWeights();
  console.log(`IDF: ${idfStats.uniqueSignals} unique signals across ${idfStats.totalDocs} properties`);
  console.log('');

  console.log('── Phase 1: User Taste Graph ──');
  const userResults = await backfillAllUsers();
  const totalNodes = userResults.reduce((sum, r) => sum + r.nodesCreated, 0);
  const totalContradictions = userResults.reduce((sum, r) => sum + r.contradictionsCreated, 0);
  const totalVectors = userResults.filter((r) => r.vectorComputed).length;
  console.log(`Users: ${userResults.length} processed`);
  console.log(`TasteNodes: ${totalNodes} created`);
  console.log(`Contradictions: ${totalContradictions} created`);
  console.log(`Taste vectors: ${totalVectors} computed`);
  console.log('');

  console.log('── Phase 2: Property Embeddings ──');
  const propResults = await backfillAllPropertyEmbeddings();
  console.log(`Properties: ${propResults.total} total`);
  console.log(`Embeddings: ${propResults.computed} computed, ${propResults.skipped} skipped`);
  console.log('');

  console.log('═══ Backfill Complete ═══');

  return { userResults, propResults, idfStats };
}
