import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authHandler } from '@/lib/api-auth-handler';
import { validateBody, placeSchema } from '@/lib/api-validation';
import { inngest } from '@/lib/inngest';
import type { User } from '@prisma/client';

interface ImportSourceEntry {
  type: string;
  name: string;
  url?: string;
  importedAt: string;
}

/**
 * Ensure a PlaceIntelligence record exists for this googlePlaceId and trigger
 * the enrichment pipeline if it hasn't run yet. Returns the intelligence ID
 * so we can link it to the SavedPlace.
 *
 * This is fire-and-forget — pipeline runs in the background via Inngest.
 * Subsequent saves of the same place (by any user) will find the existing
 * record and skip re-triggering.
 */
async function ensureEnrichment(
  googlePlaceId: string,
  propertyName: string,
  userId: string,
): Promise<string | null> {
  try {
    const existing = await prisma.placeIntelligence.findUnique({
      where: { googlePlaceId },
      select: { id: true, status: true, lastEnrichedAt: true, enrichmentTTL: true },
    });

    if (existing) {
      // Already enriching or complete — just return the ID so we can link it
      if (existing.status === 'enriching' || existing.status === 'complete') {
        return existing.id;
      }

      // Previous run failed — reset and re-trigger
      await prisma.placeIntelligence.update({
        where: { id: existing.id },
        data: { status: 'pending', propertyName },
      });

      await inngest.send({
        name: 'pipeline/run',
        data: {
          googlePlaceId,
          propertyName,
          placeIntelligenceId: existing.id,
          trigger: 'user_import',
          triggeredByUserId: userId,
        },
      });

      return existing.id;
    }

    // No intelligence record yet — create and trigger the pipeline
    const intel = await prisma.placeIntelligence.create({
      data: {
        googlePlaceId,
        propertyName,
        status: 'pending',
        signals: '[]',
      },
    });

    await inngest.send({
      name: 'pipeline/run',
      data: {
        googlePlaceId,
        propertyName,
        placeIntelligenceId: intel.id,
        trigger: 'user_import',
        triggeredByUserId: userId,
      },
    });

    return intel.id;
  } catch (error) {
    // Enrichment is best-effort — never block the save
    console.error('Auto-enrichment trigger failed (non-blocking):', error);
    return null;
  }
}

export const POST = authHandler(async (req: NextRequest, _ctx, user: User) => {
  const body = await req.json();
  // Accept flat body or nested { place: {...} }
  const placeData = body.place || body;

  const result = await validateBody(placeData, placeSchema);
  if ('error' in result) return result.error;

  const place = result.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toNull = (v: any) => v === undefined ? null : v;

  // ── Provenance fields: write-once, never overwritten by re-imports ──
  const provenanceData = {
    source: toNull(place.source),
    ghostSource: toNull(place.ghostSource),
    friendAttribution: toNull(place.friendAttribution),
    savedDate: toNull(place.savedDate),
    importBatchId: toNull(place.importBatchId),
  };

  // ── Enrichment fields: always take the latest (data quality improves) ──
  const enrichmentData = {
    name: place.name,
    type: place.type,
    location: toNull(place.location),
    matchScore: toNull(place.matchScore),
    matchBreakdown: toNull(place.matchBreakdown),
    tasteNote: toNull(place.tasteNote),
    terrazzoInsight: toNull(place.terrazzoInsight),
    enrichment: toNull(place.enrichment),
    whatToOrder: toNull(place.whatToOrder),
    tips: toNull(place.tips),
    alsoKnownAs: toNull(place.alsoKnownAs),
    googleData: toNull(place.googleData),
  };

  // ── User-editable fields: only set on create, user owns these after ──
  const userEditableData = {
    userContext: toNull(place.userContext),
    timing: toNull(place.timing),
    travelWith: toNull(place.travelWith),
    intentStatus: toNull(place.intentStatus),
    rating: toNull(place.rating),
  };

  // Build the import source entry for the provenance log
  const newSourceEntry: ImportSourceEntry | null = place.source
    ? {
        type: String(place.source.type ?? ''),
        name: String(place.source.name ?? ''),
        url: place.source.url ? String(place.source.url) : undefined,
        importedAt: new Date().toISOString(),
      }
    : null;

  // Helper: cast ImportSourceEntry[] to Prisma-compatible JSON
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toJson = (v: ImportSourceEntry[]): any => v;

  if (place.googlePlaceId) {
    // Check if this place already exists in the user's library
    const existing = await prisma.savedPlace.findUnique({
      where: {
        userId_googlePlaceId: { userId: user.id, googlePlaceId: place.googlePlaceId },
      },
      select: { id: true, deletedAt: true, importSources: true, source: true },
    });

    if (existing) {
      // ── Re-import: preserve provenance, update enrichment, append source ──
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingSources = (existing.importSources as any as ImportSourceEntry[]) || [];

      // Append new source if it's not already in the log (dedup by type+name)
      let updatedSources = existingSources;
      if (newSourceEntry) {
        const alreadyLogged = existingSources.some(
          (s) => s.type === newSourceEntry.type && s.name === newSourceEntry.name,
        );
        if (!alreadyLogged) {
          updatedSources = [...existingSources, newSourceEntry];
        }
      }

      // Ensure intelligence exists and link it (fire-and-forget)
      const intelligenceId = await ensureEnrichment(place.googlePlaceId, place.name, user.id);

      const savedPlace = await prisma.savedPlace.update({
        where: { id: existing.id },
        data: {
          // Enrichment: always update (data gets better over time)
          ...enrichmentData,
          // Provenance: preserved — NOT overwritten
          // User-editable: preserved — NOT overwritten
          // Append to provenance log
          importSources: toJson(updatedSources),
          // Clear soft-delete if re-importing a deleted place
          deletedAt: null,
          // Link to global intelligence (idempotent)
          ...(intelligenceId ? { placeIntelligenceId: intelligenceId } : {}),
        },
      });

      return Response.json({
        place: savedPlace,
        alreadyInLibrary: true,
        wasRestored: existing.deletedAt !== null,
        existingSource: existing.source,
      });
    }

    // ── First import: create with everything ──
    // Ensure intelligence exists and trigger pipeline (fire-and-forget)
    const intelligenceId = await ensureEnrichment(place.googlePlaceId, place.name, user.id);

    const savedPlace = await prisma.savedPlace.upsert({
      where: {
        userId_googlePlaceId: { userId: user.id, googlePlaceId: place.googlePlaceId },
      },
      create: {
        userId: user.id,
        googlePlaceId: place.googlePlaceId,
        ...provenanceData,
        ...enrichmentData,
        ...userEditableData,
        importSources: toJson(newSourceEntry ? [newSourceEntry] : []),
        // Link to global intelligence
        ...(intelligenceId ? { placeIntelligenceId: intelligenceId } : {}),
      },
      // Fallback update (race condition safety) — same as re-import path
      update: {
        ...enrichmentData,
        deletedAt: null,
        ...(intelligenceId ? { placeIntelligenceId: intelligenceId } : {}),
      },
    });

    return Response.json({ place: savedPlace, alreadyInLibrary: false });
  }

  // ── No googlePlaceId: always create (can't dedup without canonical ID) ──
  const savedPlace = await prisma.savedPlace.create({
    data: {
      userId: user.id,
      ...provenanceData,
      ...enrichmentData,
      ...userEditableData,
      importSources: toJson(newSourceEntry ? [newSourceEntry] : []),
    },
  });

  return Response.json({ place: savedPlace, alreadyInLibrary: false });
});
