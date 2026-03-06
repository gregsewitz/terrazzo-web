import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { searchPlace, mapGoogleTypeToPlaceType } from '@/lib/places';
import { ensureEnrichment } from '@/lib/ensure-enrichment';
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
    const userId: string | undefined = body.userId;
    const phaseId: string | undefined = body.phaseId;

    if (!mentionedPlaces.length) {
      return NextResponse.json({ anchors: [] });
    }

    const anchors: PropertyAnchor[] = [];

    // Process places in parallel (bounded concurrency via Promise.all)
    const resolvePromises = mentionedPlaces
      .filter((p) => p.confidence >= 0.5) // skip low-confidence mentions
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

    return NextResponse.json({ anchors });
  } catch (error) {
    console.error('[resolve-places] Error:', error);
    return NextResponse.json({ anchors: [] });
  }
}
