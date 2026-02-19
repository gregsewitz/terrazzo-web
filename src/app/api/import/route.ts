import { NextRequest } from 'next/server';
import { extractAndMatchPlaces } from '@/lib/anthropic';
import { searchPlace, priceLevelToString } from '@/lib/places';
import { DEFAULT_USER_PROFILE } from '@/lib/taste';

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

/**
 * Unified smart import endpoint — streams progress via SSE.
 * Each event is JSON: { type: 'progress' | 'result' | 'error', ... }
 */
export async function POST(request: NextRequest) {
  const { content } = await request.json();

  if (!content?.trim()) {
    return new Response(JSON.stringify({ error: 'Content is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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
        let extracted: ExtractedPlace[] = [];
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
            const result = await extractAndMatchPlaces(textContent, isUrl, DEFAULT_USER_PROFILE);
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
        const finalPlaces = enrichedPlaces.map((place, i) => {
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

// ─── Input type detection ───────────────────────────────────────────────────────

function detectInputType(input: string): 'url' | 'google-maps' | 'text' {
  if (/^https?:\/\//i.test(input) || /^www\./i.test(input)) {
    if (/google\.com\/maps/i.test(input) || /maps\.app\.goo/i.test(input)) {
      return 'google-maps';
    }
    return 'url';
  }
  return 'text';
}

// ─── Google Maps extraction ─────────────────────────────────────────────────────

async function extractFromGoogleMaps(url: string): Promise<Array<{ name: string; type: string; city: string }>> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Terrazzo/1.0' },
      redirect: 'follow',
    });
    const html = await res.text();

    let placeNames: string[] = [];

    // Try structured data first
    const nameMatches = html.match(/"([^"]{3,60})","https:\/\/maps\.google\.com/g);
    if (nameMatches) {
      placeNames = nameMatches
        .map(m => m.replace(/"([^"]+)".*/, '$1'))
        .filter(n => n.length > 2 && n.length < 60);
    }

    // Fallback: aria-label attributes
    if (placeNames.length === 0) {
      const titleMatches = html.match(/aria-label="([^"]{3,60})"/g);
      if (titleMatches) {
        placeNames = titleMatches
          .map(m => m.replace(/aria-label="([^"]+)"/, '$1'))
          .filter(n => !n.includes('Google') && n.length > 2);
      }
    }

    return placeNames.map(name => ({ name, type: 'activity', city: '' }));
  } catch {
    return [];
  }
}

// ─── URL fetching + HTML stripping ──────────────────────────────────────────────

async function fetchAndClean(url: string): Promise<string | null> {
  try {
    const fullUrl = url.startsWith('www.') ? `https://${url}` : url;
    const res = await fetch(fullUrl, {
      headers: { 'User-Agent': 'Terrazzo/1.0 (travel recommendation parser)' },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const html = await res.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 12000);
    return text;
  } catch {
    return null;
  }
}

// ─── Google Places enrichment ───────────────────────────────────────────────────

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

interface EnrichedPlace {
  id: string;
  name: string;
  type: string;
  location: string;
  source: { type: string; name: string };
  matchScore: number;
  matchBreakdown: Record<string, number>;
  tasteNote: string;
  status: string;
  google?: {
    placeId?: string;
    rating?: number;
    reviewCount?: number;
    category?: string;
    priceLevel?: number;
    hours?: string[];
    address?: string;
    website?: string;
    phone?: string;
    lat?: number;
    lng?: number;
  };
  enrichment?: { description?: string; confidence: number };
  ghostSource?: string;
  // Personal context from user's notes
  userContext?: string;
  travelWith?: string;
  timing?: string;
  intentStatus?: 'booked' | 'planning' | 'dreaming' | 'researching';
}

interface ExtractedPlace {
  name: string;
  type: string;
  city?: string;
  description?: string;
  userContext?: string;
  travelWith?: string;
  timing?: string;
  intentStatus?: 'booked' | 'planning' | 'dreaming' | 'researching';
  // Taste match data from combined Claude call
  matchScore?: number;
  matchBreakdown?: Record<string, number>;
  tasteNote?: string;
  terrazzoInsight?: { why: string; caveat: string };
}

async function enrichWithGooglePlaces(
  extracted: ExtractedPlace[],
  inputType: string,
  inferredRegion: string | null,
  onProgress?: (done: number, total: number) => void,
): Promise<EnrichedPlace[]> {
  const batchId = `import-${Date.now()}`;
  const sourceType = inputType === 'google-maps' ? 'google-maps' : inputType === 'url' ? 'url' : 'text';
  const sourceName = inputType === 'google-maps' ? 'Google Maps' : inputType === 'url' ? 'Article' : 'Pasted List';

  let done = 0;
  const total = extracted.length;

  // Enrich in parallel with concurrency limit of 8
  const results = await parallelMap(
    extracted,
    async (place, i) => {
      try {
        // Build search query with location context for Google Places accuracy
        const locationHint = place.city || inferredRegion || '';
        const query = locationHint ? `${place.name} ${locationHint}` : place.name;
        const googleResult = await searchPlace(query);

        done++;
        onProgress?.(done, total);

        // Prefer Claude's type classification over Google's
        const claudeType = place.type;
        const googleType = googleResult
          ? mapGoogleTypeToPlaceType(googleResult.primaryType || googleResult.types?.[0])
          : null;
        const finalType = (claudeType === 'activity' && googleType && googleType !== 'activity')
          ? googleType : claudeType;

        const enriched: EnrichedPlace = {
          id: `${sourceType}-${batchId}-${i}`,
          name: googleResult?.displayName?.text || place.name,
          type: finalType,
          location: googleResult?.formattedAddress || place.city || '',
          source: { type: sourceType, name: sourceName },
          matchScore: 0,
          matchBreakdown: { Design: 0, Character: 0, Service: 0, Food: 0, Location: 0, Wellness: 0 },
          tasteNote: place.description || '',
          status: 'available',
          ghostSource: sourceType === 'google-maps' ? 'maps' : 'article',
          userContext: place.userContext || undefined,
          travelWith: place.travelWith || undefined,
          timing: place.timing || undefined,
          intentStatus: place.intentStatus || undefined,
        };

        if (googleResult) {
          enriched.google = {
            placeId: googleResult.id,
            rating: googleResult.rating,
            reviewCount: googleResult.userRatingCount,
            category: googleResult.primaryTypeDisplayName?.text || googleResult.primaryType,
            priceLevel: priceLevelToString(googleResult.priceLevel)
              ? priceLevelToString(googleResult.priceLevel).length
              : undefined,
            hours: googleResult.regularOpeningHours?.weekdayDescriptions,
            address: googleResult.formattedAddress,
            lat: googleResult.location?.latitude,
            lng: googleResult.location?.longitude,
          };
        }

        if (place.description) {
          enriched.enrichment = { description: place.description, confidence: 0.8 };
        }

        return enriched;
      } catch (err) {
        console.warn(`Failed to enrich: ${place.name}`, err);
        done++;
        onProgress?.(done, total);
        // Fallback: return un-enriched place
        return {
          id: `${sourceType}-${batchId}-${i}`,
          name: place.name,
          type: place.type,
          location: place.city || '',
          source: { type: sourceType, name: sourceName },
          matchScore: 0,
          matchBreakdown: { Design: 0, Character: 0, Service: 0, Food: 0, Location: 0, Wellness: 0 },
          tasteNote: place.description || '',
          status: 'available',
          ghostSource: sourceType === 'google-maps' ? 'maps' : 'article',
        } as EnrichedPlace;
      }
    },
    8 // concurrency limit
  );

  return results;
}

// ─── Deduplication ──────────────────────────────────────────────────────────────

function deduplicatePlaces(places: ExtractedPlace[]): ExtractedPlace[] {
  const seen = new Map<string, ExtractedPlace>();

  for (const place of places) {
    // Normalize key: lowercase, strip common prefixes/suffixes, collapse whitespace
    const key = place.name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const existing = seen.get(key);
    if (existing) {
      // Merge: keep the entry with richer data
      const merged = { ...existing };
      // Keep longer description
      if ((place.description?.length || 0) > (merged.description?.length || 0)) {
        merged.description = place.description;
      }
      // Keep userContext from either (concatenate if both exist and differ)
      if (place.userContext && !merged.userContext) {
        merged.userContext = place.userContext;
      } else if (place.userContext && merged.userContext && place.userContext !== merged.userContext) {
        merged.userContext = `${merged.userContext}. ${place.userContext}`;
      }
      // Keep timing, travelWith, intentStatus if not already set
      if (place.timing && !merged.timing) merged.timing = place.timing;
      if (place.travelWith && !merged.travelWith) merged.travelWith = place.travelWith;
      if (place.intentStatus && merged.intentStatus === 'dreaming') merged.intentStatus = place.intentStatus;
      seen.set(key, merged);
    } else {
      seen.set(key, { ...place });
    }
  }

  return Array.from(seen.values());
}
