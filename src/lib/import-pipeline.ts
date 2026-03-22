/**
 * Import Pipeline Module
 *
 * Extracted processing stages from the SSE import endpoint.
 * These functions handle place detection, enrichment, and deduplication.
 */

import { extractAndMatchPlaces, ExtractedPlace } from '@/lib/anthropic';
import { searchPlace, priceLevelToString, mapGoogleTypeToPlaceType } from '@/lib/places';
import type { ImportedPlace } from '@/types';

// ─── Concurrency helper ──────────────────────────────────────────────────────

export async function parallelMap<T, R>(
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

// Re-export from shared module (was duplicated here and in import-helpers.ts)
export { detectInputType } from './detect-input';

// ─── Google Maps extraction ─────────────────────────────────────────────────────

export async function extractFromGoogleMaps(url: string): Promise<Array<{ name: string; type: string; city: string }>> {
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

// ─── HTML stripping utility ──────────────────────────────────────────────────────

/**
 * Strip HTML tags, scripts, styles, nav/footer chrome, and decode common entities.
 * Used for both the raw-fetch fallback and file-upload HTML handling.
 */
export function stripHtml(html: string, maxLength = 60000): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

// ─── URL fetching via Firecrawl (with raw fallback) ─────────────────────────────

/**
 * Fetch article content using Firecrawl for clean, structured markdown.
 * Falls back to raw HTML stripping if Firecrawl is unavailable or fails.
 * Firecrawl preserves headings, lists, and semantic structure — critical for
 * Claude to distinguish featured places from supporting text.
 */
export async function fetchAndClean(url: string): Promise<string | null> {
  const fullUrl = url.startsWith('www.') ? `https://${url}` : url;

  // Try Firecrawl first (produces clean markdown with preserved structure)
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (firecrawlKey) {
    // Attempt 1: standard scrape with JS rendering wait
    for (const waitMs of [3000, 8000]) {
      try {
        const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${firecrawlKey}`,
          },
          body: JSON.stringify({
            url: fullUrl,
            formats: ['markdown'],
            onlyMainContent: true,
            waitFor: waitMs,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const markdown = data?.data?.markdown;
          if (markdown && markdown.length > 500) {
            // Firecrawl returns clean markdown — pass up to 60k chars to Claude
            // (gallery-style articles like CN Traveler have 20+ hotels × 300 words each)
            return markdown.slice(0, 60000);
          }
        }
        // If first attempt returned too little content, try again with longer wait
        if (waitMs === 3000) {
          console.warn(`[fetchAndClean] Firecrawl returned insufficient content with ${waitMs}ms wait, retrying with longer wait...`);
          continue;
        }
      } catch (err) {
        if (waitMs === 8000) {
          console.warn('[fetchAndClean] Firecrawl failed, falling back to raw fetch:', err);
        }
      }
    }
    console.warn('[fetchAndClean] Firecrawl returned insufficient content after retries, falling back to raw fetch');
  }

  // Fallback: raw fetch + HTML stripping
  try {
    const res = await fetch(fullUrl, {
      headers: { 'User-Agent': 'Terrazzo/1.0 (travel recommendation parser)' },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const html = await res.text();
    return stripHtml(html, 50000);
  } catch {
    return null;
  }
}

// ─── Google Places enrichment ───────────────────────────────────────────────────

export interface EnrichmentProgress {
  (done: number, total: number): void;
}

export async function enrichExtractedPlaces(
  extracted: ExtractedPlace[],
  inputType: string,
  inferredRegion: string | null,
  onProgress?: EnrichmentProgress,
  sourceOverride?: string,
): Promise<ImportedPlace[]> {
  const batchId = `import-${Date.now()}`;
  const sourceType = (inputType === 'google-maps-list' || inputType === 'google-maps-place' || inputType === 'google-maps') ? 'google-maps' : inputType === 'url' ? 'url' : inputType === 'file' ? 'file' : 'text';
  // Smart defaults: URLs → "Article", Maps lists → "Google Maps"
  // Pasted text, file uploads & single place lookups → empty (user can optionally set a source)
  const defaultSourceName = (inputType === 'google-maps-list') ? 'Google Maps' : inputType === 'url' ? 'Article' : '';
  const sourceName = sourceOverride || defaultSourceName;

  let done = 0;
  const total = extracted.length;

  // Google Places API dedup: cache results by query to avoid redundant API calls
  // when two extracted names resolve to the same search query
  const googleCache = new Map<string, Awaited<ReturnType<typeof searchPlace>>>();

  async function cachedSearchPlace(
    query: string,
    locationBias?: { lat: number; lng: number; radiusMeters?: number },
    nameHint?: string,
  ) {
    // Include lat/lng in cache key so different locations don't collide
    const biasKey = locationBias ? `@${locationBias.lat},${locationBias.lng}` : '';
    const key = query.toLowerCase().trim() + biasKey;
    if (googleCache.has(key)) return googleCache.get(key)!;
    const result = await searchPlace(query, locationBias, nameHint);
    googleCache.set(key, result);
    // Also cache by placeId to catch different queries resolving to same place
    if (result?.id) {
      googleCache.set(`pid:${result.id}`, result);
    }
    return result;
  }

  // Enrich in parallel with concurrency limit of 8
  const results = await parallelMap(
    extracted,
    async (place, i) => {
      try {
        // Build search query with location context for Google Places accuracy
        const locationHint = place.city || inferredRegion || '';
        const query = locationHint ? `${place.name} ${locationHint}` : place.name;

        // Use lat/lng as locationBias when available (e.g. from Google Maps imports)
        // This prevents ambiguous names like "Hunan" from resolving to the wrong entity
        const locationBias = (place.lat && place.lng)
          ? { lat: place.lat, lng: place.lng, radiusMeters: 2000 }
          : undefined;

        let googleResult = await cachedSearchPlace(query, locationBias, place.name);

        // ── Geographic fencing with deep-resolve cascade ────────────────
        // If the article has a regional context and Google resolved to a
        // different region, try progressively more specific queries to find
        // the right place. No user-visible badge — we resolve it silently.
        let geoConfidence: 'high' | 'low' = 'high';
        if (googleResult && inferredRegion && place.city) {
          const cityLower = place.city.toLowerCase();
          const regionLower = inferredRegion.toLowerCase();
          const cityParts = cityLower.split(/[,/]/).map(s => s.trim()).filter(Boolean);
          const cityPrefixes = cityParts.filter(p => p.length >= 5).map(p => p.slice(0, 5));

          // Check if an address matches the expected geographic context
          const addressMatchesGeo = (addr: string) => {
            const a = addr.toLowerCase();
            return (
              cityParts.some(part => a.includes(part)) ||
              cityPrefixes.some(prefix => a.includes(prefix)) ||
              a.includes(regionLower) ||
              (regionLower.length >= 5 && a.includes(regionLower.slice(0, 5))) ||
              (regionLower === 'europe' && /\b(france|italy|spain|germany|uk|united kingdom|portugal|greece|austria|switzerland|netherlands|belgium|sweden|norway|denmark|croatia|ireland|czech|poland|hungary|romania|turkey)\b/.test(a)) ||
              (regionLower === 'asia' && /\b(japan|china|thailand|vietnam|indonesia|india|malaysia|singapore|south korea|taiwan|philippines|cambodia|sri lanka|nepal)\b/.test(a)) ||
              (/\b(africa|morocco|maroc|egypt|kenya|south africa|tanzania|tunisia|algeria|senegal|ghana|nigeria|ethiopia)\b/.test(regionLower) && /\b(morocco|maroc|egypt|kenya|south africa|tanzania|tunisia|algeria|senegal|ghana|nigeria|ethiopia)\b/.test(a))
            );
          };

          if (!addressMatchesGeo(googleResult.formattedAddress || '')) {
            // ── Deep-resolve cascade: try progressively more specific queries ──
            const typeHint = place.type || 'place';
            const deepQueries = [
              `${place.name}, ${place.city}, ${inferredRegion}`,                // "Izza, Marrakech, Morocco"
              `${place.name} ${typeHint} ${place.city}`,                        // "Izza hotel Marrakech"
              `"${place.name}" ${place.city} ${inferredRegion}`,                // exact name + full context
            ];

            let resolved = false;
            for (const dq of deepQueries) {
              const retry = await cachedSearchPlace(dq, locationBias, place.name);
              if (retry && addressMatchesGeo(retry.formattedAddress || '')) {
                googleResult = retry;
                resolved = true;
                break;
              }
            }

            if (!resolved) {
              // All retries missed — flag internally but don't surface to user.
              // Keep the best result we have; it may still be correct (just an
              // address format that doesn't match our geo-fence heuristic).
              geoConfidence = 'low';
              console.warn(`[geo-fence] "${place.name}" in "${place.city}" — resolved to "${googleResult.formattedAddress}" after ${deepQueries.length} retries. Accepting with low internal confidence.`);
            }
          }
        }

        done++;
        onProgress?.(done, total);

        // Prefer Claude's type classification over Google's
        const claudeType = place.type;
        const googleType = googleResult
          ? mapGoogleTypeToPlaceType(googleResult.primaryType || googleResult.types?.[0])
          : null;
        const finalType = (claudeType === 'activity' && googleType && googleType !== 'activity')
          ? googleType : claudeType;

        const enriched: ImportedPlace = {
          id: `${sourceType}-${batchId}-${i}`,
          name: googleResult?.displayName?.text || place.name,
          type: finalType as ImportedPlace['type'],
          location: googleResult?.formattedAddress || place.city || '',
          source: { type: sourceType as ImportedPlace['source']['type'], name: sourceName },
          matchScore: 0,
          matchBreakdown: { Design: 0, Atmosphere: 0.5, Character: 0, Service: 0, FoodDrink: 0, Setting: 0, Wellness: 0, Sustainability: 0.5 },
          tasteNote: place.description || '',
          status: 'available',
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

        if (place.description || geoConfidence === 'low') {
          enriched.enrichment = {
            description: place.description || '',
            confidence: geoConfidence === 'low' ? 0.4 : 0.8,
          };
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
          type: place.type as ImportedPlace['type'],
          location: place.city || '',
          source: { type: sourceType as ImportedPlace['source']['type'], name: sourceName },
          matchScore: 0,
          matchBreakdown: { Design: 0, Atmosphere: 0.5, Character: 0, Service: 0, FoodDrink: 0, Setting: 0, Wellness: 0, Sustainability: 0.5 },
          tasteNote: place.description || '',
          status: 'available' as const,
        } as ImportedPlace;
      }
    },
    8 // concurrency limit
  );

  // Post-enrichment dedup: merge places that resolved to the same Google Place ID
  const seenPlaceIds = new Map<string, number>();
  const deduped: ImportedPlace[] = [];
  for (const place of results) {
    const gid = place.google?.placeId;
    if (gid && seenPlaceIds.has(gid)) {
      // Merge userContext onto the first occurrence
      const firstIdx = seenPlaceIds.get(gid)!;
      const first = deduped[firstIdx];
      if (place.userContext && !first.userContext) {
        first.userContext = place.userContext;
      }
      continue; // skip duplicate
    }
    if (gid) seenPlaceIds.set(gid, deduped.length);
    deduped.push(place);
  }

  return deduped;
}

// ─── Deduplication ──────────────────────────────────────────────────────────────

export function normalizeForDedup(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function deduplicatePlaces(places: ExtractedPlace[]): ExtractedPlace[] {
  const seen = new Map<string, ExtractedPlace>();

  for (const place of places) {
    // Normalize key: lowercase, strip common prefixes/suffixes, collapse whitespace
    const key = normalizeForDedup(place.name);

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
