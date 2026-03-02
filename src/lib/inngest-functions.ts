/**
 * Inngest Functions — Scheduled and event-driven jobs for Taste Intelligence.
 *
 * PE-07: Embedding refresh after pipeline enrichment
 * TG-12: Taste vector recomputation after profile changes
 */

import { inngest } from './inngest';
import {
  backfillPropertyEmbedding,
  backfillAllPropertyEmbeddings,
  backfillUser,
  backfillAllUsers,
} from './taste-intelligence';
import { prisma } from './prisma';

// ─── PE-07: Property Embedding Refresh ──────────────────────────────────────

/**
 * Triggered when a property's enrichment pipeline completes.
 * Recomputes the embedding vector for that property.
 */
export const refreshPropertyEmbedding = inngest.createFunction(
  {
    id: 'refresh-property-embedding',
    name: 'Refresh Property Embedding',
    retries: 2,
  },
  { event: 'pipeline/enrichment.completed' },
  async ({ event, step }) => {
    const { placeIntelligenceId, googlePlaceId } = event.data;

    const result = await step.run('compute-embedding', async () => {
      return backfillPropertyEmbedding(placeIntelligenceId);
    });

    return {
      placeIntelligenceId,
      googlePlaceId,
      embeddingComputed: result.embeddingComputed,
      embeddingDimensions: 34,
    };
  },
);

/**
 * Scheduled: Recompute embeddings for all properties.
 * Runs weekly to catch any stale embeddings.
 */
export const refreshAllPropertyEmbeddings = inngest.createFunction(
  {
    id: 'refresh-all-property-embeddings',
    name: 'Weekly Property Embedding Refresh',
    retries: 1,
  },
  { cron: '0 3 * * 0' }, // Sundays at 3am
  async ({ step }) => {
    const result = await step.run('backfill-all-embeddings', async () => {
      return backfillAllPropertyEmbeddings();
    });

    return {
      total: result.total,
      computed: result.computed,
      skipped: result.skipped,
    };
  },
);

// ─── TG-12: Taste Vector Recomputation ──────────────────────────────────────

/**
 * Triggered when a user's profile is updated (re-synthesis, refinement, etc.)
 * Recomputes their taste vector to keep it in sync with the latest profile.
 */
export const recomputeUserVector = inngest.createFunction(
  {
    id: 'recompute-user-vector',
    name: 'Recompute User Taste Vector',
    retries: 2,
  },
  { event: 'user/profile.updated' },
  async ({ event, step }) => {
    const { userId } = event.data;

    const result = await step.run('recompute-vector', async () => {
      return backfillUser(userId);
    });

    return {
      userId,
      vectorComputed: result.vectorComputed,
      nodesCreated: result.nodesCreated,
      vectorDimensions: 34,
    };
  },
);

/**
 * Scheduled: Recompute taste vectors for all users.
 * Runs weekly to catch drift from signal decay.
 */
export const refreshAllUserVectors = inngest.createFunction(
  {
    id: 'refresh-all-user-vectors',
    name: 'Weekly User Vector Refresh',
    retries: 1,
  },
  { cron: '0 2 * * 0' }, // Sundays at 2am (before property refresh at 3am)
  async ({ step }) => {
    const results = await step.run('backfill-all-users', async () => {
      return backfillAllUsers();
    });

    const successful = results.filter((r) => r.vectorComputed).length;
    const failed = results.filter((r) => !r.vectorComputed).length;

    return { total: results.length, successful, failed };
  },
);

// ─── Signal Decay Recomputation ─────────────────────────────────────────────

/**
 * Daily job: recompute decayed confidence on all taste nodes.
 * Uses the 180-day half-life from signal-decay.ts.
 */
export const recomputeSignalDecay = inngest.createFunction(
  {
    id: 'recompute-signal-decay',
    name: 'Daily Signal Decay Computation',
    retries: 1,
  },
  { cron: '0 2 * * *' }, // Daily at 2am
  async ({ step }) => {
    const result = await step.run('decay-computation', async () => {
      // Update ageInDays and decayedConfidence for all TasteNodes
      // Formula: decayed = confidence * 0.5^(ageInDays/180)
      const updated = await prisma.$executeRaw`
        UPDATE "TasteNode"
        SET
          "ageInDays" = EXTRACT(DAY FROM NOW() - "extractedAt")::int,
          "decayedConfidence" = "confidence" * POWER(0.5, EXTRACT(DAY FROM NOW() - "extractedAt") / 180.0)
        WHERE "extractedAt" IS NOT NULL
      `;
      return { updatedNodes: updated };
    });

    return result;
  },
);

// ─── Export all functions for Inngest serve endpoint ─────────────────────────

export const allFunctions = [
  refreshPropertyEmbedding,
  refreshAllPropertyEmbeddings,
  recomputeUserVector,
  refreshAllUserVectors,
  recomputeSignalDecay,
];
