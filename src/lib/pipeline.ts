/**
 * Place Intelligence Pipeline — Inngest durable function
 *
 * Orchestrates the multi-stage pipeline as background steps.
 * Each step is independently retryable and observable in the Inngest dashboard.
 *
 * Stages are config-driven: add/reorder/remove stages by editing STAGES[].
 */

import { inngest } from './inngest';
import { prisma } from './prisma';
import { computeMatchFromSignals } from './taste-match';
import { parseTasteProfile } from './user-profile';

const PIPELINE_WORKER_URL = process.env.PIPELINE_WORKER_URL || '';

// ─── Helper: call the Python pipeline worker ───

const WORKER_TIMEOUT_MS = 300_000; // 5 minutes — editorial & review stages can need 3+ min for Apify + GPT

async function callWorker(stage: string, payload: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${PIPELINE_WORKER_URL}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage, ...payload }),
    signal: AbortSignal.timeout(WORKER_TIMEOUT_MS),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Pipeline worker error (${stage}): ${res.status} — ${error}`);
  }

  return res.json();
}

// ─── Helper: update stage progress ───

async function updateStage(runId: string, stage: string, completedStages: string[]) {
  await prisma.pipelineRun.update({
    where: { id: runId },
    data: { currentStage: stage, stagesCompleted: completedStages },
  });
}

// ─── Types ───

interface PipelineEventData {
  googlePlaceId: string;
  propertyName: string;
  placeIntelligenceId: string;
  placeType?: string;
  trigger: 'user_import' | 'manual' | 'refresh' | 'backfill';
  triggeredByUserId?: string;
}

interface PipelineSignal {
  dimension: string;
  confidence: number;
  signal: string;
  source_type?: string;
  review_corroborated?: boolean;
}

interface PipelineAntiSignal {
  dimension: string;
  confidence: number;
  signal: string;
}

interface PipelineResult {
  signals: PipelineSignal[];
  antiSignals: PipelineAntiSignal[];
  reliability: { overall: number; categories: Record<string, unknown>; totalReviews: number };
  facts: Record<string, unknown>;
  reviewIntelSummary: Record<string, unknown>;
  sourceSummary: Record<string, unknown>;
}

/** Accumulated results from previous pipeline stages. */
type StageResults = Record<string, unknown>;

interface StageConfig {
  /** Worker endpoint name (e.g. 'google_places'). */
  id: string;
  /** Inngest step name — must be unique. */
  stepName: string;
  /** The stage name shown in progress while THIS stage runs (next stage after completion). */
  nextStage: string;
  /** When true, failures are logged and skipped instead of aborting the pipeline. */
  optional: boolean;
  /** Fallback value returned when an optional stage fails. */
  fallback?: unknown;
  /** Build the worker payload from base context + accumulated results. */
  buildPayload: (base: Record<string, unknown>, results: StageResults) => Record<string, unknown>;
}

// ─── Stage Configuration ───────────────────────────────────────────────────────

const STAGES: StageConfig[] = [
  {
    id: 'google_places',
    stepName: 'stage-google-places',
    nextStage: 'reviews',
    optional: false,
    buildPayload: (base) => ({ googlePlaceId: base.googlePlaceId, propertyName: base.propertyName, placeType: base.placeType }),
  },
  {
    id: 'scrape_reviews',
    stepName: 'stage-scrape-reviews',
    nextStage: 'editorial',
    optional: true,
    fallback: { reviews: [], totalCount: 0 },
    buildPayload: (base, r) => ({ propertyName: base.propertyName, googlePlaceId: base.googlePlaceId, placeType: base.placeType, placesData: r.google_places }),
  },
  {
    id: 'editorial_extraction',
    stepName: 'stage-editorial-extraction',
    nextStage: 'instagram',
    optional: true,
    fallback: { signals: [], antiSignals: [] },
    buildPayload: (base, r) => ({ propertyName: base.propertyName, googlePlaceId: base.googlePlaceId, placeType: base.placeType, reviews: r.scrape_reviews, placesData: r.google_places }),
  },
  {
    id: 'instagram_analysis',
    stepName: 'stage-instagram-analysis',
    nextStage: 'menu',
    optional: true,
    fallback: { signals: [] },
    buildPayload: (base) => ({ propertyName: base.propertyName, googlePlaceId: base.googlePlaceId, placeType: base.placeType }),
  },
  {
    id: 'menu_analysis',
    stepName: 'stage-menu-analysis',
    nextStage: 'awards',
    optional: true,
    fallback: { signals: [] },
    buildPayload: (base, r) => ({ propertyName: base.propertyName, googlePlaceId: base.googlePlaceId, placeType: base.placeType, placesData: r.google_places }),
  },
  {
    id: 'award_positioning',
    stepName: 'stage-award-positioning',
    nextStage: 'review_intelligence',
    optional: true,
    fallback: { signals: [], cluster: '' },
    buildPayload: (base) => ({ propertyName: base.propertyName, googlePlaceId: base.googlePlaceId, placeType: base.placeType }),
  },
  {
    id: 'review_intelligence',
    stepName: 'stage-review-intelligence',
    nextStage: 'merge',
    optional: true,
    fallback: {},
    buildPayload: (base, r) => ({
      propertyName: base.propertyName, googlePlaceId: base.googlePlaceId, placeType: base.placeType,
      reviews: r.scrape_reviews,
      existingSignals: (r.editorial_extraction as { signals?: unknown[] })?.signals ?? [],
    }),
  },
  {
    id: 'merge',
    stepName: 'stage-merge',
    nextStage: 'save',
    optional: false,
    buildPayload: (base, r) => ({
      propertyName: base.propertyName, googlePlaceId: base.googlePlaceId, placeType: base.placeType,
      editorial: r.editorial_extraction,
      instagram: r.instagram_analysis,
      menu: r.menu_analysis,
      awards: r.award_positioning,
      reviewIntel: r.review_intelligence,
      placesData: r.google_places,
    }),
  },
];

// ─── The Pipeline Function ───

export const placeIntelligencePipeline = inngest.createFunction(
  {
    id: 'place-intelligence-pipeline',
    retries: 2,
    concurrency: { limit: 5 },
    onFailure: async ({ event, error }) => {
      const data = event.data.event.data as PipelineEventData;
      const errorMessage = error?.message || 'Unknown error (retries exhausted)';

      console.error(
        `[pipeline/onFailure] Pipeline failed for ${data.propertyName} (${data.googlePlaceId}): ${errorMessage}`
      );

      // Mark any "running" PipelineRun records for this intelligence ID as failed
      await prisma.pipelineRun.updateMany({
        where: {
          placeIntelligenceId: data.placeIntelligenceId,
          status: 'running',
        },
        data: {
          status: 'failed',
          completedAt: new Date(),
        },
      });

      // Reset PlaceIntelligence so it can be re-triggered
      await prisma.placeIntelligence.update({
        where: { id: data.placeIntelligenceId },
        data: {
          status: 'failed',
          lastError: errorMessage,
          lastErrorAt: new Date(),
          errorCount: { increment: 1 },
        },
      });
    },
  },
  { event: 'pipeline/run' },
  async ({ event, step }) => {
    const {
      googlePlaceId, propertyName, placeIntelligenceId, placeType, trigger, triggeredByUserId,
    } = event.data as PipelineEventData;

    const completedStages: string[] = [];
    const base = { googlePlaceId, propertyName, placeType };

    // ── Create pipeline run record ──
    const run = await step.run('create-run', async () => {
      const r = await prisma.pipelineRun.create({
        data: {
          placeIntelligenceId,
          status: 'running',
          triggerSource: trigger,
          triggeredByUserId: triggeredByUserId || null,
          startedAt: new Date(),
          currentStage: STAGES[0].id,
        },
      });
      await prisma.placeIntelligence.update({
        where: { id: placeIntelligenceId },
        data: { status: 'enriching' },
      });
      return { id: r.id, startedAt: r.startedAt!.getTime() };
    }) as { id: string; startedAt: number };

    // ── Run all stages via config-driven loop ──
    const results: StageResults = {};

    for (const stage of STAGES) {
      const result = await step.run(stage.stepName, async () => {
        try {
          const payload = stage.buildPayload(base, results);
          const res = await callWorker(stage.id, payload);
          completedStages.push(stage.id);
          await updateStage(run.id, stage.nextStage, completedStages);
          return res;
        } catch (e) {
          if (!stage.optional) throw e;
          const errMsg = e instanceof Error ? e.message : String(e);
          const isTimeout = errMsg.includes('abort') || errMsg.includes('timeout') || errMsg.includes('TimeoutError');
          console.error(`[pipeline] ${stage.id} FAILED for ${base.propertyName} (${base.googlePlaceId}): ${isTimeout ? 'TIMEOUT' : 'ERROR'} — ${errMsg}`);
          completedStages.push(`${stage.id}_skipped`);
          const fb = (typeof stage.fallback === 'object' && stage.fallback !== null ? stage.fallback : {}) as Record<string, unknown>;
          return { ...fb, _stageError: { stage: stage.id, error: errMsg, isTimeout } };
        }
      });
      results[stage.id] = result;
    }

    const merged = results.merge as PipelineResult;

    // ── Build enriched source diagnostics ──
    const scrapeResult = results.scrape_reviews as Record<string, unknown> | undefined;

    // Collect stage errors from any stages that used fallbacks
    const stageErrors: Record<string, unknown> = {};
    for (const stage of STAGES) {
      const r = results[stage.id] as Record<string, unknown> | undefined;
      if (r?._stageError) stageErrors[stage.id] = r._stageError;
    }

    const sourceDiagnostics = {
      ...(merged.sourceSummary || {}),
      reviewScraper: {
        totalCount: (scrapeResult as { totalCount?: number })?.totalCount ?? 0,
        googleCount: (scrapeResult as { googleCount?: number })?.googleCount ?? 0,
        tripadvisorCount: (scrapeResult as { tripadvisorCount?: number })?.tripadvisorCount ?? 0,
        reviewsReturned: Array.isArray((scrapeResult as { reviews?: unknown[] })?.reviews)
          ? (scrapeResult as { reviews: unknown[] }).reviews.length : 0,
        urlsAttempted: (scrapeResult as { urlsAttempted?: unknown })?.urlsAttempted ?? null,
        skipped: completedStages.includes('scrape_reviews_skipped'),
        rawKeys: scrapeResult ? Object.keys(scrapeResult) : [],
      },
      ...(Object.keys(stageErrors).length > 0 ? { stageErrors } : {}),
    };

    // ── Save to Database ──
    await step.run('save-to-database', async () => {
      await prisma.placeIntelligence.update({
        where: { id: placeIntelligenceId },
        data: {
          status: 'complete',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          signals: JSON.parse(JSON.stringify(merged.signals)) as any,
          antiSignals: JSON.parse(JSON.stringify(merged.antiSignals)) as any,
          reliability: JSON.parse(JSON.stringify(merged.reliability)) as any,
          facts: JSON.parse(JSON.stringify(merged.facts)) as any,
          reviewIntel: JSON.parse(JSON.stringify(merged.reviewIntelSummary)) as any,
          signalCount: merged.signals.length,
          antiSignalCount: merged.antiSignals.length,
          reviewCount: merged.reliability?.totalReviews ?? 0,
          reliabilityScore: merged.reliability?.overall ?? null,
          sourcesProcessed: JSON.parse(JSON.stringify(sourceDiagnostics)) as any,
          lastEnrichedAt: new Date(),
        },
      });

      await prisma.pipelineRun.update({
        where: { id: run.id },
        data: {
          status: 'complete',
          currentStage: null,
          stagesCompleted: completedStages,
          completedAt: new Date(),
          durationMs: Date.now() - run.startedAt,
        },
      });
    });

    // ── Compute & persist taste match for all linked SavedPlaces ──
    await step.run('compute-taste-match', async () => {
      // Find all users who have this place saved
      const savedPlaces = await prisma.savedPlace.findMany({
        where: { placeIntelligenceId, deletedAt: null },
        select: { id: true, userId: true },
      });

      for (const sp of savedPlaces) {
        const user = await prisma.user.findUnique({
          where: { id: sp.userId },
          select: { tasteProfile: true },
        });

        if (!user?.tasteProfile) continue;
        const profile = parseTasteProfile(user.tasteProfile);
        const match = computeMatchFromSignals(merged.signals, merged.antiSignals, profile);

        await prisma.savedPlace.update({
          where: { id: sp.id },
          data: {
            matchScore: match.overallScore,
            matchBreakdown: match.breakdown as any,
          },
        });
      }
    });

    return {
      success: true,
      signalCount: merged.signals.length,
      antiSignalCount: merged.antiSignals.length,
      reliabilityScore: merged.reliability?.overall,
      stages: completedStages,
    };
  }
);
