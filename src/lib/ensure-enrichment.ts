import { prisma } from '@/lib/prisma';

const PIPELINE_WORKER_URL = process.env.PIPELINE_WORKER_URL || '';

/**
 * Ensure a PlaceIntelligence record exists for this googlePlaceId and trigger
 * the enrichment pipeline if it hasn't run yet. Returns the intelligence ID
 * so we can link it to the SavedPlace.
 *
 * Enrichment is triggered directly via the Railway pipeline worker's /enrich
 * endpoint, which runs all stages internally with parallel execution and
 * writes results back to Supabase.
 *
 * This is fire-and-forget — pipeline runs in the background on Railway.
 * Subsequent saves of the same place (by any user) will find the existing
 * record and skip re-triggering.
 *
 * Error tracking: failures are written to the PlaceIntelligence record
 * (lastError, errorCount, lastErrorAt) for structured observability.
 */
export async function ensureEnrichment(
  googlePlaceId: string,
  propertyName: string,
  userId: string,
  trigger: string = 'user_import',
): Promise<string | null> {
  try {
    const existing = await prisma.placeIntelligence.findUnique({
      where: { googlePlaceId },
      select: { id: true, status: true, lastEnrichedAt: true, enrichmentTTL: true, errorCount: true },
    });

    if (existing) {
      // Already enriching or complete — link any unlinked places and return
      if (existing.status === 'enriching' || existing.status === 'complete') {
        console.log(`[ensureEnrichment] ${propertyName}: already ${existing.status}, skipping (id: ${existing.id})`);
        await linkPlacesToIntelligence(googlePlaceId, existing.id);
        return existing.id;
      }

      // Previous run failed or pending — reset and re-trigger
      console.log(`[ensureEnrichment] ${propertyName}: status=${existing.status}, re-triggering pipeline`);
      await prisma.placeIntelligence.update({
        where: { id: existing.id },
        data: {
          status: 'pending',
          propertyName,
          lastTriggeredBy: userId,
        },
      });

      await linkPlacesToIntelligence(googlePlaceId, existing.id);
      await triggerRailwayEnrichment(googlePlaceId, propertyName, existing.id);

      return existing.id;
    }

    // No intelligence record yet — create and trigger the pipeline
    console.log(`[ensureEnrichment] ${propertyName}: no existing record, creating + triggering pipeline`);
    const intel = await prisma.placeIntelligence.create({
      data: {
        googlePlaceId,
        propertyName,
        status: 'pending',
        signals: '[]',
        lastTriggeredBy: userId,
      },
    });

    await linkPlacesToIntelligence(googlePlaceId, intel.id);
    await triggerRailwayEnrichment(googlePlaceId, propertyName, intel.id);

    return intel.id;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Attempt to log the error to the PlaceIntelligence record
    try {
      await prisma.placeIntelligence.upsert({
        where: { googlePlaceId },
        update: {
          lastError: errorMessage,
          lastErrorAt: new Date(),
          errorCount: { increment: 1 },
          lastTriggeredBy: userId,
        },
        create: {
          googlePlaceId,
          propertyName,
          status: 'failed',
          signals: '[]',
          lastError: errorMessage,
          lastErrorAt: new Date(),
          errorCount: 1,
          lastTriggeredBy: userId,
        },
      });
    } catch (logErr) {
      console.error('[ensureEnrichment] Failed to log error to DB:', logErr);
    }

    console.error(`[ensureEnrichment] Failed for ${propertyName} (${googlePlaceId}):`, errorMessage);
    return null;
  }
}

/**
 * Fire-and-forget call to the Railway pipeline worker's /enrich endpoint.
 * The worker runs the full 12-stage pipeline asynchronously and writes
 * results directly to Supabase when complete.
 */
async function triggerRailwayEnrichment(
  googlePlaceId: string,
  propertyName: string,
  placeIntelligenceId: string,
  placeType?: string,
): Promise<void> {
  if (!PIPELINE_WORKER_URL) {
    console.error('[ensureEnrichment] PIPELINE_WORKER_URL not configured — enrichment will not run');
    return;
  }

  try {
    const res = await fetch(`${PIPELINE_WORKER_URL}/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        googlePlaceId,
        propertyName,
        placeIntelligenceId,
        placeType: placeType || undefined,
      }),
      signal: AbortSignal.timeout(10_000), // 10s — just needs to accept the job
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[ensureEnrichment] Railway /enrich returned ${res.status}: ${errText}`);
      return;
    }

    const { jobId } = await res.json() as { jobId: string };
    console.log(`[ensureEnrichment] ${propertyName}: Railway job started (jobId: ${jobId})`);
  } catch (err) {
    // Fire-and-forget — don't fail the caller if Railway is temporarily down
    console.error(`[ensureEnrichment] Failed to trigger Railway enrichment for ${propertyName}:`, err);
  }
}

/**
 * Link all SavedPlace and Place records that share a googlePlaceId
 * to the given PlaceIntelligence record. This is idempotent — only
 * updates rows where placeIntelligenceId is currently null.
 */
async function linkPlacesToIntelligence(googlePlaceId: string, intelligenceId: string): Promise<void> {
  try {
    const [savedResult, placeResult] = await Promise.all([
      prisma.savedPlace.updateMany({
        where: {
          googlePlaceId,
          placeIntelligenceId: null,
        },
        data: { placeIntelligenceId: intelligenceId },
      }),
      prisma.place.updateMany({
        where: {
          googlePlaceId,
          placeIntelligenceId: null,
        },
        data: { placeIntelligenceId: intelligenceId },
      }),
    ]);

    const total = savedResult.count + placeResult.count;
    if (total > 0) {
      console.log(`[ensureEnrichment] Linked ${savedResult.count} SavedPlace(s) + ${placeResult.count} Place(s) to intelligence ${intelligenceId}`);
    }
  } catch (err) {
    console.error(`[ensureEnrichment] Failed to link places for ${googlePlaceId}:`, err);
  }
}
