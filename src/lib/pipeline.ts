/**
 * Place Intelligence Pipeline — Inngest durable function
 *
 * Orchestrates the 8-stage pipeline as background steps.
 * Each step is independently retryable and observable in the Inngest dashboard.
 */

import { inngest } from './inngest';
import { prisma } from './prisma';

const PIPELINE_WORKER_URL = process.env.PIPELINE_WORKER_URL || '';

// ─── Helper: call the Python pipeline worker ───

async function callWorker(stage: string, payload: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${PIPELINE_WORKER_URL}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage, ...payload }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Pipeline worker error (${stage}): ${res.status} — ${error}`);
  }

  return res.json();
}

// ─── Helper: update stage progress ───

async function updateStage(
  runId: string,
  placeIntelligenceId: string,
  stage: string,
  completedStages: string[]
) {
  await prisma.pipelineRun.update({
    where: { id: runId },
    data: {
      currentStage: stage,
      stagesCompleted: JSON.stringify(completedStages),
    },
  });
}

// ─── Types ───

interface PipelineEventData {
  googlePlaceId: string;
  propertyName: string;
  placeIntelligenceId: string;
  trigger: 'user_import' | 'manual' | 'refresh' | 'backfill';
  triggeredByUserId?: string;
}

interface PipelineResult {
  signals: unknown[];
  antiSignals: unknown[];
  reliability: { overall: number; categories: Record<string, unknown>; totalReviews: number };
  facts: Record<string, unknown>;
  reviewIntelSummary: Record<string, unknown>;
  sourceSummary: Record<string, unknown>;
}

// ─── The Pipeline Function ───

export const placeIntelligencePipeline = inngest.createFunction(
  {
    id: 'place-intelligence-pipeline',
    retries: 2,
    concurrency: { limit: 5 }, // max 5 properties enriching simultaneously
  },
  { event: 'pipeline/run' },
  async ({ event, step }) => {
    const {
      googlePlaceId,
      propertyName,
      placeIntelligenceId,
      trigger,
      triggeredByUserId,
    } = event.data as PipelineEventData;

    const completedStages: string[] = [];

    // ── Create pipeline run record ──
    const run = await step.run('create-run', async () => {
      const r = await prisma.pipelineRun.create({
        data: {
          placeIntelligenceId,
          status: 'running',
          triggerSource: trigger,
          triggeredByUserId: triggeredByUserId || null,
          startedAt: new Date(),
          currentStage: 'google_places',
        },
      });
      await prisma.placeIntelligence.update({
        where: { id: placeIntelligenceId },
        data: { status: 'enriching' },
      });
      return { id: r.id, startedAt: r.startedAt!.getTime() };
    }) as { id: string; startedAt: number };

    // ── STAGE 1: Google Places (~2s) ──
    const placesData = await step.run('stage-google-places', async () => {
      const result = await callWorker('google_places', { googlePlaceId, propertyName });
      completedStages.push('google_places');
      await updateStage(run.id as string, placeIntelligenceId, 'reviews', completedStages);
      return result as Record<string, unknown>;
    });

    // ── STAGE 2: Review Scraping (~60s) ──
    const reviews = await step.run('stage-scrape-reviews', async () => {
      try {
        const result = await callWorker('scrape_reviews', {
          propertyName,
          googlePlaceId,
          location: placesData.location,
        });
        completedStages.push('reviews');
        await updateStage(run.id, placeIntelligenceId, 'editorial', completedStages);
        return result as Record<string, unknown>;
      } catch (e) {
        // Graceful failure — continue without reviews
        console.error('Review scraping failed, continuing:', e);
        completedStages.push('reviews_skipped');
        return { reviews: [], totalCount: 0 };
      }
    });

    // ── STAGE 3: Editorial Extraction (~15s) ──
    const editorial = await step.run('stage-editorial-extraction', async () => {
      try {
        const result = await callWorker('editorial_extraction', {
          propertyName,
          googlePlaceId,
          reviews,
          placesData,
        });
        completedStages.push('editorial');
        await updateStage(run.id, placeIntelligenceId, 'instagram', completedStages);
        return result as { signals: unknown[]; antiSignals: unknown[] };
      } catch (e) {
        console.error('Editorial extraction failed, continuing:', e);
        completedStages.push('editorial_skipped');
        return { signals: [], antiSignals: [] };
      }
    });

    // ── STAGE 4: Instagram Scrape + Vision (~90s) ──
    const instagram = await step.run('stage-instagram-analysis', async () => {
      try {
        const result = await callWorker('instagram_analysis', {
          propertyName,
          googlePlaceId,
        });
        completedStages.push('instagram');
        await updateStage(run.id, placeIntelligenceId, 'menu', completedStages);
        return result as { signals: unknown[] };
      } catch (e) {
        console.error('Instagram analysis failed, continuing:', e);
        completedStages.push('instagram_skipped');
        return { signals: [] };
      }
    });

    // ── STAGE 5: Menu Analysis (~10s) ──
    const menu = await step.run('stage-menu-analysis', async () => {
      try {
        const result = await callWorker('menu_analysis', {
          propertyName,
          googlePlaceId,
          placesData,
        });
        completedStages.push('menu');
        await updateStage(run.id, placeIntelligenceId, 'awards', completedStages);
        return result as { signals: unknown[] };
      } catch (e) {
        console.error('Menu analysis failed, continuing:', e);
        completedStages.push('menu_skipped');
        return { signals: [] };
      }
    });

    // ── STAGE 6: Award Positioning (~5s) ──
    const awards = await step.run('stage-award-positioning', async () => {
      try {
        const result = await callWorker('award_positioning', {
          propertyName,
          googlePlaceId,
        });
        completedStages.push('awards');
        await updateStage(run.id, placeIntelligenceId, 'review_intelligence', completedStages);
        return result as { signals: unknown[]; cluster: string };
      } catch (e) {
        console.error('Award positioning failed, continuing:', e);
        completedStages.push('awards_skipped');
        return { signals: [], cluster: '' };
      }
    });

    // ── STAGE 7: Review Intelligence 3-Tier (~60s) ──
    const reviewIntel = await step.run('stage-review-intelligence', async () => {
      try {
        const result = await callWorker('review_intelligence', {
          propertyName,
          googlePlaceId,
          reviews,
          existingSignals: editorial.signals,
        });
        completedStages.push('review_intelligence');
        await updateStage(run.id, placeIntelligenceId, 'merge', completedStages);
        return result as Record<string, unknown>;
      } catch (e) {
        console.error('Review intelligence failed, continuing:', e);
        completedStages.push('review_intelligence_skipped');
        return {};
      }
    });

    // ── STAGE 8: Merge All Signals ──
    const merged = await step.run('stage-merge', async () => {
      const result = await callWorker('merge', {
        propertyName,
        googlePlaceId,
        editorial,
        instagram,
        menu,
        awards,
        reviewIntel,
        placesData,
      });
      completedStages.push('merge');
      return result as PipelineResult;
    });

    // ── STAGE 9: Save to Database ──
    await step.run('save-to-database', async () => {
      await prisma.placeIntelligence.update({
        where: { id: placeIntelligenceId },
        data: {
          status: 'complete',
          signals: JSON.stringify(merged.signals),
          antiSignals: JSON.stringify(merged.antiSignals),
          reliability: JSON.stringify(merged.reliability),
          facts: JSON.stringify(merged.facts),
          reviewIntel: JSON.stringify(merged.reviewIntelSummary),
          signalCount: merged.signals.length,
          antiSignalCount: merged.antiSignals.length,
          reviewCount: merged.reliability?.totalReviews || 0,
          reliabilityScore: merged.reliability?.overall || null,
          sourcesProcessed: JSON.stringify(merged.sourceSummary),
          lastEnrichedAt: new Date(),
        },
      });

      await prisma.pipelineRun.update({
        where: { id: run.id },
        data: {
          status: 'complete',
          currentStage: null,
          stagesCompleted: JSON.stringify(completedStages),
          completedAt: new Date(),
          durationMs: Date.now() - run.startedAt,
        },
      });
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