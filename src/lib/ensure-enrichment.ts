import { prisma } from '@/lib/prisma';
import { inngest } from '@/lib/inngest';

/**
 * Ensure a PlaceIntelligence record exists for this googlePlaceId and trigger
 * the enrichment pipeline if it hasn't run yet. Returns the intelligence ID
 * so we can link it to the SavedPlace.
 *
 * This is fire-and-forget — pipeline runs in the background via Inngest.
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
      // Already enriching or complete — just return the ID so we can link it
      if (existing.status === 'enriching' || existing.status === 'complete') {
        console.log(`[ensureEnrichment] ${propertyName}: already ${existing.status}, skipping (id: ${existing.id})`);
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

      const sendResult = await inngest.send({
        name: 'pipeline/run',
        data: {
          googlePlaceId,
          propertyName,
          placeIntelligenceId: existing.id,
          trigger,
          triggeredByUserId: userId,
        },
      });
      console.log(`[ensureEnrichment] ${propertyName}: inngest.send result:`, JSON.stringify(sendResult));

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

    const sendResult = await inngest.send({
      name: 'pipeline/run',
      data: {
        googlePlaceId,
        propertyName,
        placeIntelligenceId: intel.id,
        trigger,
        triggeredByUserId: userId,
      },
    });
    console.log(`[ensureEnrichment] ${propertyName}: inngest.send result:`, JSON.stringify(sendResult));

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
      // If even logging fails, at least console.error
      console.error('[ensureEnrichment] Failed to log error to DB:', logErr);
    }

    console.error(`[ensureEnrichment] Failed for ${propertyName} (${googlePlaceId}):`, errorMessage);
    return null;
  }
}
