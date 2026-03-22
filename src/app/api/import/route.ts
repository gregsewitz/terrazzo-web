import { NextRequest } from 'next/server';
import { extractAndMatchPlaces } from '@/lib/anthropic';
import { getUserTasteProfile } from '@/lib/user-profile';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { getUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { detectInputType } from '@/lib/detect-input';
import { getPlatformLabel } from '@/lib/detect-input';
import {
  fetchAndClean,
  enrichExtractedPlaces,
  deduplicatePlaces,
} from '@/lib/import-pipeline';

// Allow up to 120s — Claude extraction + Google Places enrichment for 30+ places
export const maxDuration = 120;

/**
 * Unified smart import endpoint — streams progress via SSE.
 * Each event is JSON: { type: 'progress' | 'result' | 'error', ... }
 */
export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request.headers);
  const rl = rateLimit(clientIp, { maxRequests: 5, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  const { content, platform } = await request.json();

  if (!content?.trim()) {
    return new Response(JSON.stringify({ error: 'Content is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Load real user profile if authenticated, else default
  const userProfile = await getUserTasteProfile(request);

  const trimmed = content.trim();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Helper to send an SSE event
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        // ── 1. Detect input type ────────────────────────────────────────────
        const detectedType = detectInputType(trimmed);

        // Google Maps saved-list links should be routed to /api/import/maps-list by the client.
        // If one arrives here, reject it rather than silently failing.
        if (detectedType === 'google-maps-list') {
          send({ type: 'error', error: 'Google Maps list links should use the maps-list endpoint' });
          controller.close();
          return;
        }

        // Single Google Maps place links are fine here — they'll be fetched and parsed normally.
        // The client may also pre-extract the place name and send that as text instead.

        const isUrl = detectedType === 'url' || detectedType === 'google-maps-place';
        send({
          type: 'progress',
          stage: 'detecting',
          label: isUrl ? 'Opening the article…' : 'Reading your list…',
          percent: 5,
        });

        // ── 2. Extract places + taste match (single Claude call) ──────────
        let extracted: any[] = [];
        let inferredRegion: string | null = null;

        // For URLs, fetch the article text first
        let textContent = trimmed;

        if (isUrl) {
          send({ type: 'progress', stage: 'fetching', label: 'Reading the article…', percent: 10 });
          const articleText = await fetchAndClean(trimmed);
          if (!articleText) {
            send({ type: 'error', error: 'Could not fetch URL content' });
            controller.close();
            return;
          }
          textContent = articleText;
        }

        // Single Claude call: extract places AND generate taste scores together
        send({
          type: 'progress',
          stage: 'extracting',
          label: isUrl ? 'Pulling out the places…' : 'Finding the places…',
          percent: isUrl ? 20 : 15,
        });

        try {
          const result = await extractAndMatchPlaces(textContent, isUrl, userProfile);
          extracted = result.places;
          inferredRegion = result.region;
        } catch (e) {
          console.error('Combined extraction failed:', e);
          send({ type: 'error', error: 'Something went wrong — try again in a moment' });
          controller.close();
          return;
        }

        if (!extracted || extracted.length === 0) {
          send({ type: 'error', error: 'No places found in the content' });
          controller.close();
          return;
        }

        // ── 2b. Deduplicate ───────────────────────────────────────────────
        const deduped = deduplicatePlaces(extracted);
        if (deduped.length < extracted.length) {
          send({
            type: 'progress',
            stage: 'deduplicating',
            label: `Merged ${extracted.length - deduped.length} duplicate${extracted.length - deduped.length > 1 ? 's' : ''}`,
            percent: 30,
          });
        }

        const limited = deduped.slice(0, 30);
        send({
          type: 'progress',
          stage: 'extracted',
          label: `Found ${limited.length} place${limited.length === 1 ? '' : 's'}${inferredRegion ? ` in ${inferredRegion}` : ''}`,
          percent: 35,
          placeNames: limited.map((p: { name: string }) => p.name),
        });

        // ── 3. Enrich with Google Places (8 concurrent) ───────────────────
        // Derive a human-readable source name from the platform hint
        const platformSourceName = platform
          ? getPlatformLabel(platform)
          : undefined;

        send({ type: 'progress', stage: 'enriching', label: 'Looking up each place…', percent: 40 });
        const enrichedPlaces = await enrichExtractedPlaces(limited, detectedType, inferredRegion, (done, total) => {
          const enrichPercent = 40 + Math.round((done / total) * 50);
          send({
            type: 'progress',
            stage: 'enriching',
            label: `Looking up ${done} of ${total}…`,
            percent: enrichPercent,
          });
        }, platformSourceName);

        send({ type: 'progress', stage: 'finalizing', label: 'Finishing up…', percent: 95 });

        // ── 4. Merge taste data from combined call onto enriched places ────
        const mergedPlaces = enrichedPlaces.map((place, i) => {
          // Find the matching extracted place by name to get taste data
          const source = limited[i];
          if (source && source.matchScore) {
            return {
              ...place,
              matchScore: source.matchScore || 0,
              matchBreakdown: source.matchBreakdown || place.matchBreakdown,
              tasteNote: source.tasteNote || place.tasteNote,
              terrazzoInsight: source.terrazzoInsight || undefined,
            };
          }
          return place;
        });

        // ── 5. Cross-reference against user's library ─────────────────────
        // Tag each place with alreadyInLibrary + existing source info so the
        // frontend can show "Already in your library (from Infatuation)"
        type ExistingPlace = { googlePlaceId: string; source: string | null; importSources: string[] | null };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let finalPlaces: any[] = mergedPlaces;
        const user = await getUser(request);
        if (user) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const googlePlaceIds = mergedPlaces
            .map((p: any) => p.google?.placeId)
            .filter((id: any): id is string => !!id);

          if (googlePlaceIds.length > 0) {
            const existingPlaces = await prisma.savedPlace.findMany({
              where: {
                userId: user.id,
                googlePlaceId: { in: googlePlaceIds },
                deletedAt: null,
              },
              select: { googlePlaceId: true, source: true, importSources: true },
            });

            const existingByGoogleId = new Map<string, ExistingPlace>(
              existingPlaces.map((p: any) => [p.googlePlaceId, p]),
            );

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            finalPlaces = mergedPlaces.map((place: any) => {
              const gpId = place.google?.placeId;
              const existing = gpId ? existingByGoogleId.get(gpId) : null;
              if (existing) {
                return {
                  ...place,
                  alreadyInLibrary: true,
                  existingSource: existing.source,
                  existingImportSources: existing.importSources,
                };
              }
              return place;
            });
          }
        }

        // ── Done ────────────────────────────────────────────────────────────
        send({
          type: 'result',
          places: finalPlaces,
          detectedType,
          percent: 100,
        });
      } catch (error) {
        console.error('Import error:', error);
        send({ type: 'error', error: 'Import failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
