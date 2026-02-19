import { NextRequest } from 'next/server';
import { extractPlaces, generateTasteMatchBatch } from '@/lib/anthropic';
import { searchPlace, priceLevelToString } from '@/lib/places';
import { DEFAULT_USER_PROFILE } from '@/lib/taste';

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

        // ── 2. Extract place names ──────────────────────────────────────────
        let extracted: ExtractedPlace[] = [];
        let inferredRegion: string | null = null;

        if (detectedType === 'google-maps') {
          extracted = await extractFromGoogleMaps(trimmed);
        } else if (detectedType === 'url') {
          send({ type: 'progress', stage: 'fetching', label: 'Fetching article content…', percent: 10 });
          const articleText = await fetchAndClean(trimmed);
          if (!articleText) {
            send({ type: 'error', error: 'Could not fetch URL content' });
            controller.close();
            return;
          }
          send({ type: 'progress', stage: 'extracting', label: 'AI is reading the article…', percent: 20 });
          const extraction = await extractPlaces(articleText, true);
          extracted = extraction.places;
          inferredRegion = extraction.region;
        } else {
          send({ type: 'progress', stage: 'extracting', label: 'AI is finding places in your text…', percent: 15 });
          const extraction = await extractPlaces(trimmed, false);
          extracted = extraction.places;
          inferredRegion = extraction.region;
        }

        if (!extracted || extracted.length === 0) {
          send({ type: 'error', error: 'No places found in the content' });
          controller.close();
          return;
        }

        // ── 2b. Deduplicate ───────────────────────────────────────────────
        // Merge duplicates: keep the entry with richer data (longer description/context)
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

        // ── 3. Enrich with Google Places ────────────────────────────────────
        send({ type: 'progress', stage: 'enriching', label: 'Looking up details on Google…', percent: 40 });
        const enrichedPlaces = await enrichWithGooglePlaces(limited, detectedType, inferredRegion, (done, total) => {
          const enrichPercent = 40 + Math.round((done / total) * 30);
          send({
            type: 'progress',
            stage: 'enriching',
            label: `Enriching place ${done} of ${total}…`,
            percent: enrichPercent,
          });
        });

        send({ type: 'progress', stage: 'enriched', label: 'Google details added', percent: 72 });

        // ── 4. Batch taste matching ─────────────────────────────────────────
        send({ type: 'progress', stage: 'matching', label: 'Matching to your taste profile…', percent: 75 });

        const placesForMatching = enrichedPlaces.map(p => ({
          name: p.name,
          type: p.type,
          city: p.location,
        }));

        let tasteResults: Array<{
          matchScore?: number;
          matchBreakdown?: Record<string, number>;
          tasteNote?: string;
          terrazzoInsight?: { why: string; caveat: string };
        }> = [];

        try {
          tasteResults = await generateTasteMatchBatch(placesForMatching, DEFAULT_USER_PROFILE);
        } catch (e) {
          console.warn('Taste matching failed, continuing without scores:', e);
        }

        send({ type: 'progress', stage: 'finalizing', label: 'Compiling your results…', percent: 92 });

        // ── 5. Merge taste data ─────────────────────────────────────────────
        const finalPlaces = enrichedPlaces.map((place, i) => {
          const taste = tasteResults[i];
          if (taste && taste.matchScore) {
            return {
              ...place,
              matchScore: taste.matchScore || 0,
              matchBreakdown: taste.matchBreakdown || place.matchBreakdown,
              tasteNote: taste.tasteNote || place.tasteNote,
              terrazzoInsight: taste.terrazzoInsight || undefined,
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

  // Enrich in parallel (up to 30 places)
  const results = await Promise.allSettled(
    extracted.map(async (place, i) => {
      // Build search query with location context for Google Places accuracy
      // Use the place's city first, then fall back to the inferred region
      const locationHint = place.city || inferredRegion || '';
      const query = locationHint ? `${place.name} ${locationHint}` : place.name;
      const googleResult = await searchPlace(query);

      done++;
      onProgress?.(done, total);

      // Prefer Claude's type classification over Google's (Claude understands context better)
      const claudeType = place.type;
      const googleType = googleResult
        ? mapGoogleTypeToPlaceType(googleResult.primaryType || googleResult.types?.[0])
        : null;
      // Use Claude's type unless it said "activity" and Google has a more specific category
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
        // Pass through personal context from Claude extraction
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
    }),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<EnrichedPlace> => r.status === 'fulfilled')
    .map(r => r.value);
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
