import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { authHandler } from '@/lib/api-auth-handler';
import { searchPlace, getPhotoUrl, mapGoogleTypeToPlaceType, priceLevelToString } from '@/lib/places';
import { ensureEnrichment } from '@/lib/ensure-enrichment';
import { computeTasteScore } from '@/lib/taste-score';
// normalizeSingleVectorScore removed — raw scores used directly
import { prisma } from '@/lib/prisma';
import { CLAUDE_SONNET } from '@/lib/models';
import type { User, Prisma } from '@prisma/client';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * POST /api/places/resolve-quick-entry
 *
 * Attempts to resolve a free-text quick entry into a real place.
 *
 * Two-step process:
 *   1. Claude classifies whether the text references a specific, visitable place
 *      and extracts the clean place name if so.
 *   2. Google Places search with destination location bias resolves to a real place.
 *
 * Returns either { resolved: true, place: {...} } or { resolved: false, reason: string }.
 */
export const POST = authHandler(async (req: NextRequest, _ctx, user: User) => {
  const { text, label, category, destination, lat, lng } = await req.json();

  if (!text && !label) {
    return NextResponse.json({ error: 'text or label is required' }, { status: 400 });
  }

  const inputText = label || text;

  // ─── Step 1: Claude classification ───────────────────────────────────────
  // Ask Claude if this text references a specific, visitable place and extract
  // the clean place name. This catches restaurants, bars, cafes, neighborhoods,
  // parks, shops, markets, galleries, beaches, hotels — anything with a
  // physical location someone could visit.

  let placeName: string | null = null;
  let confidence: number = 0;

  try {
    const classifyResponse = await client.messages.create({
      model: CLAUDE_SONNET,
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Does this trip planner entry reference a specific, visitable place (restaurant, bar, cafe, neighborhood, park, shop, market, gallery, museum, beach, hotel, spa, etc.)?

Entry: "${inputText}"
${destination ? `Trip destination: ${destination}` : ''}

Respond with ONLY a JSON object, no markdown:
{"isPlace": true/false, "placeName": "cleaned place name or null", "confidence": 0.0-1.0}

Rules:
- Extract just the place name, stripping action words like "Dinner at", "Walk around", "Visit", "Grab coffee at", "Check out"
- Transportation, transit, and logistics notes that mention places should NOT be classified as places — they are notes about getting somewhere, not about visiting the place itself
- "Dinner at the Brasserie at Estelle Manor" → {"isPlace": true, "placeName": "Brasserie at Estelle Manor", "confidence": 0.95}
- "Walk around Shoreditch" → {"isPlace": true, "placeName": "Shoreditch", "confidence": 0.85}
- "The Connaught Bar" → {"isPlace": true, "placeName": "The Connaught Bar", "confidence": 0.95}
- "Pack bags" → {"isPlace": false, "placeName": null, "confidence": 0.95}
- "Massages" → {"isPlace": false, "placeName": null, "confidence": 0.7}
- "Massages at COMO Shambhala" → {"isPlace": true, "placeName": "COMO Shambhala", "confidence": 0.9}
- "1:10pm flight to Iguazu" → {"isPlace": false, "placeName": null, "confidence": 0.95}
- "Drive to the Cotswolds" → {"isPlace": false, "placeName": null, "confidence": 0.9}
- "Train to Oxford at 9am" → {"isPlace": false, "placeName": null, "confidence": 0.95}
- "Uber to airport" → {"isPlace": false, "placeName": null, "confidence": 0.95}
- "Pickup rental car from Sixt Liverpool St at 2pm" → {"isPlace": false, "placeName": null, "confidence": 0.9}
- "Car service to Heathrow" → {"isPlace": false, "placeName": null, "confidence": 0.95}
- "Check out of hotel by 11am" → {"isPlace": false, "placeName": null, "confidence": 0.9}
- Confidence reflects how certain you are in the classification`,
      }],
    });

    const responseText = classifyResponse.content[0]?.type === 'text'
      ? classifyResponse.content[0].text.trim()
      : '';

    // Parse JSON — handle potential markdown wrapping
    const jsonStr = responseText.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    if (parsed.isPlace && parsed.placeName && parsed.confidence >= 0.7) {
      placeName = parsed.placeName;
      confidence = parsed.confidence;
    } else {
      return NextResponse.json({
        resolved: false,
        reason: parsed.isPlace ? 'low_confidence' : 'not_a_place',
        confidence: parsed.confidence || 0,
      });
    }
  } catch (err) {
    console.error('[resolve-quick-entry] Claude classification failed:', err);
    return NextResponse.json({
      resolved: false,
      reason: 'classification_error',
    });
  }

  // ─── Step 2: Google Places resolution ────────────────────────────────────

  // placeName is guaranteed non-null here (early return above if classification failed)
  const resolvedPlaceName = placeName!;
  const query = destination ? `${resolvedPlaceName}, ${destination}` : resolvedPlaceName;
  const locationBias = (lat && lng)
    ? { lat: Number(lat), lng: Number(lng), radiusMeters: 5000 }
    : undefined;

  let googleResult;
  try {
    googleResult = await searchPlace(query, locationBias, resolvedPlaceName);
  } catch (err) {
    console.error('[resolve-quick-entry] Google Places search failed:', err);
    return NextResponse.json({
      resolved: false,
      reason: 'search_error',
      placeName,
    });
  }

  if (!googleResult) {
    return NextResponse.json({
      resolved: false,
      reason: 'not_found',
      placeName,
      confidence,
    });
  }

  const googlePlaceId = googleResult.id;
  const resolvedName = googleResult.displayName?.text || resolvedPlaceName;
  const resolvedPlaceType = mapGoogleTypeToPlaceType(googleResult.primaryType);

  // ─── Step 3: Name similarity check ──────────────────────────────────────
  // Verify the Google result is reasonably close to what Claude extracted.
  // This prevents "The Fox" from resolving to "Fox News HQ" in New York.

  const queryTokens = new Set(resolvedPlaceName.toLowerCase().split(/\s+/).filter(t => t.length > 2));
  const resultTokens = new Set(resolvedName.toLowerCase().split(/\s+/).filter(t => t.length > 2));
  const overlap = [...queryTokens].filter(t => resultTokens.has(t)).length;
  const similarity = queryTokens.size > 0 ? overlap / queryTokens.size : 0;

  if (similarity < 0.3 && confidence < 0.9) {
    console.log(`[resolve-quick-entry] Low name similarity: "${placeName}" → "${resolvedName}" (${similarity.toFixed(2)})`);
    return NextResponse.json({
      resolved: false,
      reason: 'low_similarity',
      placeName,
      googleName: resolvedName,
      similarity,
    });
  }

  // ─── Step 4: Ensure enrichment & compute match ──────────────────────────

  const intelligenceId = await ensureEnrichment(
    googlePlaceId, resolvedName, user.id, 'user_import', resolvedPlaceType
  );

  // Check if user already has this saved
  const savedPlace = await prisma.savedPlace.findUnique({
    where: { userId_googlePlaceId: { userId: user.id, googlePlaceId } },
    select: {
      id: true, matchScore: true, matchBreakdown: true,
      matchExplanation: true as any, enrichment: true, tasteNote: true,
    },
  });

  // Compute taste match if intelligence is ready
  let matchScore: number | null = savedPlace?.matchScore || null;
  let matchBreakdown: Record<string, number> | null = null;

  if (intelligenceId && !matchScore) {
    try {
      const intel = await prisma.placeIntelligence.findUnique({
        where: { id: intelligenceId },
        select: { status: true, signals: true, antiSignals: true },
      });
      if (intel?.status === 'complete') {
        const score = await computeTasteScore(
          user.id, googlePlaceId,
          (intel.signals as any[]) || [],
          (intel.antiSignals as any[]) || [],
        );
        if (score) {
          matchScore = score.overallScore;
          matchBreakdown = score.breakdown;
        }
      }
    } catch (err) {
      console.error('[resolve-quick-entry] Taste score failed:', err);
    }
  }

  // Use existing saved score as-is (raw cosine×100)
  if (savedPlace?.matchScore && !matchBreakdown) {
    matchScore = savedPlace.matchScore;
  }

  // ─── Step 5: Build response ─────────────────────────────────────────────

  const photoUrl = googleResult.photos?.[0]?.name
    ? getPhotoUrl(googleResult.photos[0].name, 800)
    : null;

  return NextResponse.json({
    resolved: true,
    confidence,
    place: {
      googlePlaceId,
      name: resolvedName,
      type: resolvedPlaceType,
      location: googleResult.formattedAddress || null,
      source: { type: 'quick_entry', name: 'Quick Entry' },
      matchScore: matchScore || 0,
      matchBreakdown: matchBreakdown || savedPlace?.matchBreakdown || {},
      google: {
        placeId: googlePlaceId,
        address: googleResult.formattedAddress || null,
        rating: googleResult.rating || null,
        reviewCount: googleResult.userRatingCount || null,
        priceLevel: priceLevelToString(googleResult.priceLevel),
        hours: googleResult.regularOpeningHours?.weekdayDescriptions || null,
        photoUrl,
        lat: googleResult.location?.latitude || null,
        lng: googleResult.location?.longitude || null,
        category: googleResult.primaryTypeDisplayName?.text || null,
        editorialSummary: (googleResult as any).editorialSummary?.text || null,
      },
      enrichment: (savedPlace?.enrichment as any) || null,
      savedPlaceId: savedPlace?.id || null,
      intelligenceId: intelligenceId || null,
    },
  });
});
