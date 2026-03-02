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

// ─── Input type detection ───────────────────────────────────────────────────────

export function detectInputType(input: string): 'url' | 'google-maps' | 'text' {
  if (/^https?:\/\//i.test(input) || /^www\./i.test(input)) {
    if (/google\.com\/maps/i.test(input) || /maps\.app\.goo/i.test(input)) {
      return 'google-maps';
    }
    return 'url';
  }
  return 'text';
}

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
            // Firecrawl returns clean markdown — pass up to 30k chars to Claude
            return markdown.slice(0, 30000);
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
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 25000);
    return text;
  } catch {
    return null;
  }
}

// ─── Google Places enrichment ───────────────────────────────────────────────────

export interface EnrichmentProgress {
  (done: number, total: number): void;
}

export async function enrichWithGooglePlaces(
  extracted: ExtractedPlace[],
  inputType: string,
  inferredRegion: string | null,
  onProgress?: EnrichmentProgress,
): Promise<ImportedPlace[]> {
  const batchId = `import-${Date.now()}`;
  const sourceType = inputType === 'google-maps' ? 'google-maps' : inputType === 'url' ? 'url' : 'text';
  const sourceName = inputType === 'google-maps' ? 'Google Maps' : inputType === 'url' ? 'Article' : 'Pasted List';

  let done = 0;
  const total = extracted.length;

  // Google Places API dedup: cache results by query to avoid redundant API calls
  // when two extracted names resolve to the same search query
  const googleCache = new Map<string, Awaited<ReturnType<typeof searchPlace>>>();

  async function cachedSearchPlace(query: string) {
    const key = query.toLowerCase().trim();
    if (googleCache.has(key)) return googleCache.get(key)!;
    const result = await searchPlace(query);
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
        let googleResult = await cachedSearchPlace(query);

        // ── Geographic fencing (soft) ─────────────────────────────────────
        // If the article has a regional context (e.g., "Europe") and Google
        // resolved to a completely different region, the match is likely wrong.
        // Try once more with a tighter query. If that also misses, KEEP the
        // original result but flag it as low-confidence so the user can still
        // see it in the curation UI and decide for themselves.
        let geoConfidence: 'high' | 'low' = 'high';
        if (googleResult && inferredRegion && place.city) {
          const address = (googleResult.formattedAddress || '').toLowerCase();
          const cityLower = place.city.toLowerCase();
          const regionLower = inferredRegion.toLowerCase();
          // Split compound cities like "Brockenhurst, Hampshire" and check each part
          const cityParts = cityLower.split(/[,/]/).map(s => s.trim()).filter(Boolean);
          const addressMatchesContext =
            cityParts.some(part => address.includes(part)) ||
            address.includes(regionLower) ||
            // Also check country-level: if region is "Europe" check common European country names
            (regionLower === 'europe' && /\b(france|italy|spain|germany|uk|united kingdom|portugal|greece|austria|switzerland|netherlands|belgium|sweden|norway|denmark|croatia|ireland|czech|poland|hungary|romania|turkey)\b/.test(address)) ||
            (regionLower === 'asia' && /\b(japan|china|thailand|vietnam|indonesia|india|malaysia|singapore|south korea|taiwan|philippines|cambodia|sri lanka|nepal)\b/.test(address));
          if (!addressMatchesContext) {
            // Retry with a more specific query: "Name, City, Region"
            const tighterQuery = `${place.name}, ${place.city}, ${inferredRegion}`;
            const retry = await cachedSearchPlace(tighterQuery);
            if (retry) {
              const retryAddress = (retry.formattedAddress || '').toLowerCase();
              if (cityParts.some(part => retryAddress.includes(part)) || retryAddress.includes(regionLower)) {
                googleResult = retry;
              } else {
                // Both attempts missed — keep original but flag as low-confidence
                // so the curation UI can surface this to the user
                geoConfidence = 'low';
                console.warn(`[geo-fence] "${place.name}" in "${place.city}" — Google resolved to "${googleResult.formattedAddress}". Keeping with low confidence.`);
              }
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
          matchBreakdown: { Design: 0, Character: 0, Service: 0, Food: 0, Location: 0, Wellness: 0, Rhythm: 0.5, CulturalEngagement: 0.5 },
          tasteNote: place.description || '',
          status: 'available',
          ghostSource: (sourceType === 'google-maps' ? 'maps' : 'article') as ImportedPlace['ghostSource'],
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
          matchBreakdown: { Design: 0, Character: 0, Service: 0, Food: 0, Location: 0, Wellness: 0, Rhythm: 0.5, CulturalEngagement: 0.5 },
          tasteNote: place.description || '',
          status: 'available' as const,
          ghostSource: (sourceType === 'google-maps' ? 'maps' : 'article') as ImportedPlace['ghostSource'],
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
