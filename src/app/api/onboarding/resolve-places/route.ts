import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { searchPlace, mapGoogleTypeToPlaceType } from '@/lib/places';
import { ensureEnrichment } from '@/lib/ensure-enrichment';
import { getUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import type { MentionedPlace, PropertyAnchor } from '@/types';

/**
 * POST /api/onboarding/resolve-places
 *
 * Resolves mentioned places from voice onboarding into PropertyAnchors.
 * For each MentionedPlace:
 *   1. Searches Google Places API to find the real property
 *   2. Checks if we already have a PlaceIntelligence record (and embedding)
 *   3. Triggers enrichment pipeline if needed (fire-and-forget)
 *   4. Returns a PropertyAnchor with blendWeight based on sentiment
 *
 * This is called fire-and-forget from the client after each analyze response.
 * It doesn't block the conversation — anchors are accumulated for later
 * vector blending when the user completes onboarding.
 */

/** Map sentiment to blend weight for vector computation */
function sentimentToBlendWeight(sentiment: MentionedPlace['sentiment']): number {
  switch (sentiment) {
    case 'love': return 0.8;
    case 'like': return 0.5;
    case 'visited': return 0.3;
    case 'dislike': return -0.3;
    default: return 0.3;
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip + ':resolve-places', { maxRequests: 20, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  try {
    const body = await req.json();
    const mentionedPlaces: MentionedPlace[] = body.mentionedPlaces || [];
    const phaseId: string | undefined = body.phaseId;

    // Extract userId from auth session (preferred) or body (fallback for CRON/admin)
    const authUser = await getUser(req);
    const userId: string | undefined = authUser?.id || body.userId;

    if (!mentionedPlaces.length) {
      return NextResponse.json({ anchors: [] });
    }

    const anchors: PropertyAnchor[] = [];

    // Place types that represent specific properties (matchable) vs broad destinations (not)
    const PROPERTY_PLACE_TYPES = new Set([
      'hotel', 'restaurant', 'bar', 'cafe', 'spa', 'activity',
      'lodging', 'resort', 'bed_and_breakfast', 'guest_house',
    ]);
    const DESTINATION_PLACE_TYPES = new Set([
      'city', 'country', 'region', 'neighborhood', 'island', 'state', 'continent',
    ]);

    // Process places in parallel (bounded concurrency via Promise.all)
    const resolvePromises = mentionedPlaces
      .filter((p) => p.confidence >= 0.5) // skip low-confidence mentions
      .filter((p) => {
        // Skip broad destinations — they're taste signals, not matchable properties
        if (p.placeType && DESTINATION_PLACE_TYPES.has(p.placeType)) {
          console.log(`[resolve-places] Skipping destination "${p.name}" (type=${p.placeType})`);
          return false;
        }
        return true;
      })
      .map(async (place): Promise<PropertyAnchor | null> => {
        try {
          // Build search query — combine name + location for better matching
          const query = place.location
            ? `${place.name}, ${place.location}`
            : place.name;

          const result = await searchPlace(query, place.location || undefined, place.name);

          if (!result) {
            console.log(`[resolve-places] No match for "${place.name}" (${place.location || 'no location'})`);
            return null;
          }

          const googlePlaceId = result.id;
          const propertyName = result.displayName?.text || place.name;
          const resolvedPlaceType = mapGoogleTypeToPlaceType(result.primaryType);

          // Post-resolution filter: skip if Google resolved this to a locality/region
          // (e.g., user said "Komodo" and Google returned the administrative area)
          const googleType = (result.primaryType || '').toLowerCase();
          const LOCALITY_GOOGLE_TYPES = ['locality', 'administrative_area_level_1', 'administrative_area_level_2',
            'country', 'sublocality', 'postal_code', 'geocode', 'natural_feature', 'archipelago',
            'colloquial_area', 'administrative_area_level_3', 'administrative_area_level_4'];
          if (LOCALITY_GOOGLE_TYPES.some(lt => googleType.includes(lt)) || (result.types || []).some((t: string) => t === 'locality' || t === 'country' || t === 'administrative_area_level_1')) {
            console.log(`[resolve-places] Skipping locality "${propertyName}" (googleType=${result.primaryType})`);
            return null;
          }

          // Check if we already have an embedding for this property
          // Use raw query because embeddingV3 is an Unsupported("vector(400)") type
          const embeddingCheck = await prisma.$queryRawUnsafe<Array<{ has_embedding: boolean }>>(
            `SELECT "embeddingV3" IS NOT NULL as has_embedding
             FROM "PlaceIntelligence"
             WHERE "googlePlaceId" = $1
             LIMIT 1`,
            googlePlaceId,
          );

          const hasEmbedding = embeddingCheck.length > 0 && embeddingCheck[0].has_embedding;

          // Trigger enrichment pipeline if needed (fire-and-forget)
          // This ensures the property will have signals + embedding for vector blending
          if (userId) {
            ensureEnrichment(
              googlePlaceId,
              propertyName,
              userId,
              'onboarding_mention',
              place.placeType || resolvedPlaceType,
            ).catch((err) => {
              console.error(`[resolve-places] ensureEnrichment failed for ${propertyName}:`, err);
            });
          }

          const anchor: PropertyAnchor = {
            googlePlaceId,
            propertyName,
            placeType: place.placeType || resolvedPlaceType,
            sentiment: place.sentiment,
            blendWeight: sentimentToBlendWeight(place.sentiment),
            sourcePhaseId: phaseId,
            hasEmbedding,
            resolvedAt: new Date().toISOString(),
          };

          console.log(`[resolve-places] Resolved "${place.name}" → "${propertyName}" (${googlePlaceId}) sentiment=${place.sentiment} hasEmbedding=${hasEmbedding}`);
          return anchor;
        } catch (err) {
          console.error(`[resolve-places] Failed to resolve "${place.name}":`, err);
          return null;
        }
      });

    const results = await Promise.all(resolvePromises);
    for (const anchor of results) {
      if (anchor) anchors.push(anchor);
    }

    // Name-level dedup: if multiple anchors have very similar names (e.g., Google returned
    // different IDs for "The Shelborne Apartments" vs "The Shelborne By Properties"),
    // keep only the one with the highest blendWeight
    const deduped: PropertyAnchor[] = [];
    const normalizedNames = new Map<string, number>(); // normalized name → index in deduped
    for (const anchor of anchors) {
      const normalized = anchor.propertyName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\b(hotel|resort|by|the|apartments?|suites?|inn|lodge|regency)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      const existingIdx = normalizedNames.get(normalized);
      if (existingIdx !== undefined) {
        // Keep higher blendWeight
        if (Math.abs(anchor.blendWeight) > Math.abs(deduped[existingIdx].blendWeight)) {
          deduped[existingIdx] = anchor;
        }
        console.log(`[resolve-places] Deduped "${anchor.propertyName}" (matches "${deduped[existingIdx].propertyName}")`);
      } else {
        normalizedNames.set(normalized, deduped.length);
        deduped.push(anchor);
      }
    }

    return NextResponse.json({ anchors: deduped });
  } catch (error) {
    console.error('[resolve-places] Error:', error);
    return NextResponse.json({ anchors: [] });
  }
}
