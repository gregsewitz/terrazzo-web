import { NextRequest } from 'next/server';
import { searchPlace, priceLevelToString } from '@/lib/places';
import { generateTasteMatchBatch } from '@/lib/anthropic';
import { DEFAULT_USER_PROFILE } from '@/lib/taste';
import { getUserTasteProfile } from '@/lib/user-profile';

/**
 * Google Maps Saved List Import — Direct API approach (fast)
 *
 * Flow:
 * 1. Resolve shortened URL → extract list ID
 * 2. Call Google's internal /maps/preview/entitylist/getlist endpoint (instant)
 * 3. Immediately return basic results from getlist data (name, address, coords)
 * 4. Enrich in parallel via Google Places API (8 concurrent) + taste match
 * 5. Stream enriched results as they complete
 *
 * With lazy enrichment + parallel lookups:
 * - Initial results appear in <2s (vs 60-120s before)
 * - Full enrichment completes in ~10-15s for 100 places
 */

// ─── Concurrency helper ──────────────────────────────────────────────────────

async function parallelMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

export async function POST(request: NextRequest) {
  const { url } = await request.json();

  if (!url?.trim()) {
    return new Response(JSON.stringify({ error: 'URL is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Load real user profile if authenticated, else default
  const userProfile = await getUserTasteProfile(request);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        // ── 1. Resolve shortened URL ──
        send({
          type: 'progress',
          stage: 'starting',
          label: 'Resolving Google Maps link…',
          percent: 5,
        });

        let resolvedUrl = url.trim();

        if (resolvedUrl.includes('goo.gl') || resolvedUrl.includes('maps.app')) {
          try {
            const headRes = await fetch(resolvedUrl, { method: 'HEAD', redirect: 'follow' });
            if (headRes.url && headRes.url !== resolvedUrl) {
              resolvedUrl = headRes.url;
              console.log('[maps-list] Resolved URL:', resolvedUrl);
            }
          } catch {
            console.warn('[maps-list] Could not resolve short URL, using as-is');
          }
        }

        // ── 2. Extract list ID from the URL ──
        const listId = extractListId(resolvedUrl);
        if (!listId) {
          throw new Error(
            'Could not find a list ID in the URL. Make sure this is a Google Maps saved list link.'
          );
        }

        console.log('[maps-list] Extracted list ID:', listId);

        // ── 3. Call Google's internal getlist endpoint ──
        send({
          type: 'progress',
          stage: 'fetching',
          label: 'Fetching places from Google Maps…',
          percent: 15,
        });

        const getlistUrl =
          `https://www.google.com/maps/preview/entitylist/getlist` +
          `?authuser=0&hl=en&gl=us&pb=!1m4!1s${encodeURIComponent(listId)}!2e1!3m1!1e1!2e2!3e2!4i500!16b1`;

        const getlistRes = await fetch(getlistUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });

        if (!getlistRes.ok) {
          throw new Error(`Google Maps API returned ${getlistRes.status}`);
        }

        const rawText = await getlistRes.text();
        const jsonText = rawText.replace(/^\)\]\}'\n?/, '');
        let parsed: unknown[];

        try {
          parsed = JSON.parse(jsonText);
        } catch {
          console.error('[maps-list] Failed to parse getlist response. First 500 chars:', rawText.slice(0, 500));
          throw new Error('Failed to parse Google Maps response');
        }

        // ── 4. Extract places from the response ──
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const root = parsed as any;
        const listName: string = root?.[0]?.[4] || '';
        const rawPlaces: unknown[] = root?.[0]?.[8] || [];

        console.log('[maps-list] List name:', listName);
        console.log('[maps-list] Raw places count:', rawPlaces.length);

        if (rawPlaces.length === 0) {
          throw new Error(
            'No places found in the list. The Google Maps list may be empty or not publicly shared.'
          );
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapsPlaces = rawPlaces.map((p: any, i: number) => {
          const name = p?.[2] || `Place ${i + 1}`;
          const address = p?.[1]?.[2] || '';
          const lat = p?.[1]?.[5]?.[2];
          const lng = p?.[1]?.[5]?.[3];
          const cid = p?.[8]?.[1]?.[0] || '';
          const category = p?.[13]?.[0] || p?.[3] || '';
          return { name, address, lat, lng, cid, category };
        });

        // ── 5. Send IMMEDIATE results with getlist data (no enrichment yet) ──
        // This is the "lazy enrichment" approach — user sees results in <2s
        const basePlaces = mapsPlaces.map((mp, i) => ({
          id: `maps-list-${Date.now()}-${i}`,
          name: mp.name,
          type: guessTypeFromCategory(mp.category),
          location: mp.address,
          source: { type: 'google-maps' as const, name: 'Google Maps' },
          matchScore: 0,
          matchBreakdown: { Design: 0, Character: 0, Service: 0, Food: 0, Location: 0, Wellness: 0 },
          tasteNote: '',
          status: 'available' as const,
          google: {
            lat: mp.lat,
            lng: mp.lng,
            address: mp.address,
          },
          ghostSource: 'maps' as const,
        }));

        const placeNames = mapsPlaces.map(p => p.name);

        send({
          type: 'progress',
          stage: 'preview',
          label: `Found ${placeNames.length} places! Enriching details…`,
          percent: 30,
          placeNames: placeNames.slice(0, 20),
        });

        // Send the immediate preview so the UI can show results right away
        send({
          type: 'preview',
          places: basePlaces,
          listName: listName || null,
        });

        // ── 6. Parallel enrichment via Google Places API ──
        // 8 concurrent lookups — takes ~10-15s for 100 places instead of 100-200s serial
        let enrichedCount = 0;
        const totalPlaces = mapsPlaces.length;

        const enrichedPlaces = await parallelMap(
          mapsPlaces,
          async (mp, i) => {
            try {
              const addressParts = mp.address.split(',').map((s: string) => s.trim());
              const cityHint = addressParts.length > 1 ? addressParts.slice(-2).join(', ') : '';
              const query = cityHint ? `${mp.name}, ${cityHint}` : mp.name;

              const locationBias = (mp.lat && mp.lng)
                ? { lat: mp.lat, lng: mp.lng, radiusMeters: 2000 }
                : undefined;

              const googleResult = await searchPlace(query, locationBias);

              enrichedCount++;
              if (enrichedCount % 8 === 0 || enrichedCount === totalPlaces) {
                const pct = Math.min(30 + Math.round((enrichedCount / totalPlaces) * 40), 70);
                send({
                  type: 'progress',
                  stage: 'enriching',
                  label: `Enriched ${enrichedCount} of ${totalPlaces} places…`,
                  percent: pct,
                });
              }

              if (googleResult) {
                return {
                  id: `maps-list-${Date.now()}-${i}`,
                  name: googleResult.displayName?.text || mp.name,
                  type: mapGoogleTypeToPlaceType(
                    googleResult.primaryType || googleResult.types?.[0]
                  ),
                  location: googleResult.formattedAddress || mp.address,
                  source: { type: 'google-maps' as const, name: 'Google Maps' },
                  matchScore: 0,
                  matchBreakdown: { Design: 0, Character: 0, Service: 0, Food: 0, Location: 0, Wellness: 0 },
                  tasteNote: '',
                  status: 'available' as const,
                  google: {
                    placeId: googleResult.id,
                    rating: googleResult.rating,
                    reviewCount: googleResult.userRatingCount,
                    category:
                      googleResult.primaryTypeDisplayName?.text ||
                      googleResult.primaryType,
                    priceLevel: priceLevelToString(googleResult.priceLevel)
                      ? priceLevelToString(googleResult.priceLevel).length
                      : undefined,
                    hours: googleResult.regularOpeningHours?.weekdayDescriptions,
                    address: googleResult.formattedAddress,
                    lat: googleResult.location?.latitude,
                    lng: googleResult.location?.longitude,
                  },
                  ghostSource: 'maps' as const,
                };
              }
            } catch {
              console.warn(`Failed to enrich: ${mp.name}`);
            }

            // Fallback: use getlist data directly
            return basePlaces[i];
          },
          8 // concurrency limit
        );

        // ── 7. Taste matching ──
        send({
          type: 'progress',
          stage: 'taste',
          label: 'Matching to your taste profile…',
          percent: 75,
        });

        try {
          const tasteResults = await generateTasteMatchBatch(
            enrichedPlaces.map(p => ({ name: p.name, type: p.type, city: p.location })),
            userProfile
          );

          if (tasteResults && tasteResults.length === enrichedPlaces.length) {
            enrichedPlaces.forEach((place, i) => {
              const taste = tasteResults[i];
              if (taste) {
                place.matchScore = taste.matchScore || 0;
                place.matchBreakdown = taste.matchBreakdown || place.matchBreakdown;
                place.tasteNote = taste.tasteNote || '';
              }
            });
          }
        } catch (e) {
          console.warn('Taste matching failed, continuing without scores:', e);
        }

        // ── 8. Return final enriched results ──
        send({
          type: 'progress',
          stage: 'done',
          label: 'All done!',
          percent: 100,
        });

        send({
          type: 'result',
          places: enrichedPlaces,
          listName: listName || null,
        });
      } catch (err) {
        console.error('Maps list import error:', err);
        send({
          type: 'error',
          error: (err as Error).message || 'Failed to import Google Maps list',
        });
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractListId(url: string): string | null {
  const dataMatch = url.match(/!2s([A-Za-z0-9_-]+)/);
  if (dataMatch) return dataMatch[1];

  const placelistMatch = url.match(/\/maps\/placelists\/list\/([A-Za-z0-9_-]+)/);
  if (placelistMatch) return placelistMatch[1];

  const tokenMatch = url.match(/share_token=([A-Za-z0-9_-]+)/);
  if (tokenMatch) return tokenMatch[1];

  return null;
}

function mapGoogleTypeToPlaceType(googleType?: string): string {
  if (!googleType) return 'activity';
  const type = googleType.toLowerCase();
  if (type.includes('restaurant') || type.includes('food')) return 'restaurant';
  if (type.includes('bar') || type.includes('night_club') || type.includes('pub')) return 'bar';
  if (type.includes('cafe') || type.includes('coffee') || type.includes('bakery')) return 'cafe';
  if (type.includes('hotel') || type.includes('lodging') || type.includes('resort')) return 'hotel';
  if (type.includes('museum') || type.includes('art_gallery') || type.includes('church') || type.includes('landmark')) return 'museum';
  if (type.includes('store') || type.includes('shop') || type.includes('market')) return 'shop';
  if (type.includes('park') || type.includes('neighborhood') || type.includes('locality')) return 'neighborhood';
  return 'activity';
}

function guessTypeFromCategory(category?: string): string {
  if (!category) return 'activity';
  const c = category.toLowerCase();
  if (c.includes('restaurant') || c.includes('food') || c.includes('kitchen') || c.includes('butcher')) return 'restaurant';
  if (c.includes('bar') || c.includes('pub') || c.includes('inn') || c.includes('tavern')) return 'bar';
  if (c.includes('cafe') || c.includes('coffee') || c.includes('bakery')) return 'cafe';
  if (c.includes('hotel') || c.includes('lodging') || c.includes('resort') || c.includes('manor')) return 'hotel';
  if (c.includes('museum') || c.includes('gallery') || c.includes('church') || c.includes('cathedral')) return 'museum';
  if (c.includes('store') || c.includes('shop') || c.includes('market') || c.includes('antique')) return 'shop';
  if (c.includes('kingdom') || c.includes('village') || c.includes('town') || c.includes('city')) return 'neighborhood';
  return 'activity';
}
