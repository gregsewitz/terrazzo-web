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
 * When triggerRailwayEnrichment fails, the PI record is marked 'failed'
 * so the orphan-sweep can retry it with exponential backoff.
 */
export async function ensureEnrichment(
  googlePlaceId: string,
  propertyName: string,
  userId: string,
  trigger: string = 'user_import',
  placeType?: string,
): Promise<string | null> {
  try {
    const existing = await prisma.placeIntelligence.findUnique({
      where: { googlePlaceId },
      select: { id: true, status: true, lastEnrichedAt: true, enrichmentTTL: true, errorCount: true, placeType: true },
    });

    if (existing) {
      // Already enriching or complete — link any unlinked places and return
      if (existing.status === 'enriching' || existing.status === 'complete') {
        console.log(`[ensureEnrichment] ${propertyName}: already ${existing.status}, skipping (id: ${existing.id})`);

        // Backfill placeType if we have it now but the record doesn't
        if (placeType && !existing.placeType) {
          await prisma.placeIntelligence.update({
            where: { id: existing.id },
            data: { placeType },
          }).catch((err: unknown) => {
            console.error(`[ensureEnrichment] Failed to backfill placeType for ${existing.id}:`, err);
          });
        }

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
          ...(placeType ? { placeType } : {}),
        },
      });

      await linkPlacesToIntelligence(googlePlaceId, existing.id);

      const triggered = await triggerRailwayEnrichment(googlePlaceId, propertyName, existing.id, placeType);
      if (!triggered) {
        // Mark as failed so orphan-sweep can retry later
        await markTriggerFailed(existing.id, 'Railway trigger failed or PIPELINE_WORKER_URL not configured');
      }

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
        ...(placeType ? { placeType } : {}),
      },
    });

    await linkPlacesToIntelligence(googlePlaceId, intel.id);

    const triggered = await triggerRailwayEnrichment(googlePlaceId, propertyName, intel.id, placeType);
    if (!triggered) {
      // Mark as failed so orphan-sweep can retry later
      await markTriggerFailed(intel.id, 'Railway trigger failed or PIPELINE_WORKER_URL not configured');
    }

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
          ...(placeType ? { placeType } : {}),
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
 * Mark a PlaceIntelligence record as 'failed' when the Railway trigger
 * didn't succeed. This ensures the orphan-sweep picks it up for retry
 * instead of leaving it stuck in 'pending' forever.
 */
async function markTriggerFailed(intelligenceId: string, reason: string): Promise<void> {
  try {
    await prisma.placeIntelligence.update({
      where: { id: intelligenceId },
      data: {
        status: 'failed',
        lastError: reason,
        lastErrorAt: new Date(),
        errorCount: { increment: 1 },
      },
    });
  } catch (err) {
    console.error(`[ensureEnrichment] Failed to mark trigger failure for ${intelligenceId}:`, err);
  }
}

/**
 * Fire-and-forget call to the Railway pipeline worker's /enrich endpoint.
 * The worker runs the full 14-stage pipeline asynchronously and writes
 * results directly to Supabase when complete.
 *
 * Returns true if the trigger was accepted by Railway, false if it failed.
 * Callers should mark the PI record as 'failed' when this returns false.
 */
async function triggerRailwayEnrichment(
  googlePlaceId: string,
  propertyName: string,
  placeIntelligenceId: string,
  placeType?: string,
): Promise<boolean> {
  if (!PIPELINE_WORKER_URL) {
    console.error('[ensureEnrichment] PIPELINE_WORKER_URL not configured — enrichment will not run');
    return false;
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
      return false;
    }

    const { jobId } = await res.json() as { jobId: string };
    console.log(`[ensureEnrichment] ${propertyName}: Railway job started (jobId: ${jobId})`);
    return true;
  } catch (err) {
    console.error(`[ensureEnrichment] Failed to trigger Railway enrichment for ${propertyName}:`, err);
    return false;
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
