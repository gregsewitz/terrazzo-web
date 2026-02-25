import { NextRequest } from 'next/server';
import { extractAndMatchPlaces } from '@/lib/anthropic';
import { getUserTasteProfile } from '@/lib/user-profile';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { getUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import {
  detectInputType,
  extractFromGoogleMaps,
  fetchAndClean,
  enrichWithGooglePlaces,
  deduplicatePlaces,
} from '@/lib/import-pipeline';

/**
 * Unified smart import endpoint — streams progress via SSE.
 * Each event is JSON: { type: 'progress' | 'result' | 'error', ... }
 */
export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request.headers);
  const rl = rateLimit(clientIp, { maxRequests: 5, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  const { content } = await request.json();

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
        send({
          type: 'progress',
          stage: 'detecting',
          label: detectedType === 'url' ? 'Link detected — fetching article…'
            : detectedType === 'google-maps' ? 'Google Maps link detected…'
            : 'Reading your text…',
          percent: 5,
        });

        // ── 2. Extract places + taste match (single Claude call) ──────────
        let extracted: any[] = [];
        let inferredRegion: string | null = null;

        if (detectedType === 'google-maps') {
          // Google Maps URLs don't go through Claude — just scrape place names
          extracted = await extractFromGoogleMaps(trimmed);
        } else {
          // For URLs, fetch the article text first
          let textContent = trimmed;
          const isUrl = detectedType === 'url';

          if (isUrl) {
            send({ type: 'progress', stage: 'fetching', label: 'Fetching article content…', percent: 10 });
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
            label: isUrl ? 'AI is reading & matching the article…' : 'AI is finding & matching places…',
            percent: isUrl ? 20 : 15,
          });

          try {
            const result = await extractAndMatchPlaces(textContent, isUrl, userProfile);
            extracted = result.places;
            inferredRegion = result.region;
          } catch (e) {
            console.error('Combined extraction failed:', e);
            send({ type: 'error', error: 'AI extraction failed' });
            controller.close();
            return;
          }
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
        send({ type: 'progress', stage: 'enriching', label: 'Looking up details on Google…', percent: 40 });
        const enrichedPlaces = await enrichWithGooglePlaces(limited, detectedType, inferredRegion, (done, total) => {
          const enrichPercent = 40 + Math.round((done / total) * 50);
          send({
            type: 'progress',
            stage: 'enriching',
            label: `Enriching place ${done} of ${total}…`,
            percent: enrichPercent,
          });
        });

        send({ type: 'progress', stage: 'finalizing', label: 'Compiling your results…', percent: 95 });

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

            const existingByGoogleId = new Map(
              existingPlaces.map((p) => [p.googlePlaceId, p]),
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
