/**
 * GET /api/cron/type-cleanup
 *
 * Weekly cron job: fix PlaceIntelligence records with wrong or missing placeType.
 * Also detects description–type mismatches and nulls contaminated descriptions
 * to prevent bad data from reaching users.
 *
 * Four passes:
 *   1. Reclassify from Google data: PI has googleData with types but placeType
 *      is 'activity' or null — resolve from Google types + name fallback.
 *   2. Reclassify non-standard types: PI has placeType not in the canonical set
 *      (e.g., 'experience', 'event') — map to nearest standard type.
 *   3. Null contaminated descriptions: PI where description keywords strongly
 *      contradict the placeType (e.g., restaurant description on a shop).
 *   4. Re-trigger stale: PI that still has null googleData after 24+ hours —
 *      these had a pipeline failure at the google_places stage. Re-trigger
 *      enrichment so they get proper Google data and type resolution.
 *
 * Configured in vercel.json as a Vercel Cron running weekly on Sundays at 4:30am UTC.
 * Protected by CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveGooglePlaceType } from '@/lib/places';
import { ensureEnrichment } from '@/lib/ensure-enrichment';

export const maxDuration = 120; // 2 min

const CANONICAL_TYPES = new Set([
  'hotel', 'restaurant', 'bar', 'cafe', 'museum', 'shop', 'neighborhood', 'activity',
]);

// Non-standard type → best canonical mapping
const TYPE_REMAP: Record<string, string> = {
  experience: 'hotel',
  cultural_event: 'museum',
  event: 'activity',
  island_destination: 'neighborhood',
  attraction: 'activity',
  landmark: 'museum',
  spa: 'hotel',
  resort: 'hotel',
};

// Keyword patterns for detecting contaminated descriptions
const FOOD_KEYWORDS = /\b(chef|prix[- ]?fixe|tasting menu|sommelier|courses?\s+menu|wine list|michelin|culinary|à la carte|omakase|degustation)\b/i;
const RETAIL_KEYWORDS = /\b(shopping|retail|fashion|boutique|clothing|garments?|designer|runway|couture|apparel)\b/i;
const HOTEL_KEYWORDS = /\b(check[- ]?in|concierge|lobby|rooms?\s+rate|suite|housekeeping|front desk|minibar|turndown)\b/i;

function countMatches(text: string, pattern: RegExp): number {
  return (text.match(new RegExp(pattern, 'gi')) || []).length;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stats = {
    reclassifiedFromGoogle: 0,
    reclassifiedNonStandard: 0,
    descriptionsNulled: 0,
    staleRetriggered: 0,
  };

  try {
    // ── Pass 1: Reclassify from Google data ──────────────────────────────
    // Find PI records typed as 'activity' or null that have Google data available
    const mistyped = await prisma.placeIntelligence.findMany({
      where: {
        status: 'complete',
        OR: [
          { placeType: 'activity' },
          { placeType: null },
        ],
        googleData: { not: null as any },
      },
      select: {
        id: true,
        propertyName: true,
        placeType: true,
        googleData: true,
      },
      take: 200,
    });

    for (const pi of mistyped) {
      const gd = pi.googleData as Record<string, any> | null;
      if (!gd) continue;

      // Extract types from googleData — may be stored as 'types' array or 'category' string
      const types: string[] = gd.types || (gd.category ? [gd.category] : []);
      const resolved = resolveGooglePlaceType(undefined, types, pi.propertyName);

      if (resolved !== 'activity' && resolved !== pi.placeType) {
        await prisma.placeIntelligence.update({
          where: { id: pi.id },
          data: { placeType: resolved },
        });
        console.log(`[type-cleanup] Reclassified '${pi.propertyName}': ${pi.placeType} → ${resolved}`);
        stats.reclassifiedFromGoogle++;
      }
    }

    // ── Pass 2: Reclassify non-standard types ────────────────────────────
    // Find PI records with types not in the canonical set
    const nonStandard = await prisma.placeIntelligence.findMany({
      where: {
        status: 'complete',
        NOT: {
          placeType: { in: [...CANONICAL_TYPES] },
        },
        placeType: { not: null },
      },
      select: {
        id: true,
        propertyName: true,
        placeType: true,
      },
      take: 100,
    });

    for (const pi of nonStandard) {
      const remapped = TYPE_REMAP[pi.placeType!] || 'activity';
      await prisma.placeIntelligence.update({
        where: { id: pi.id },
        data: { placeType: remapped },
      });
      console.log(`[type-cleanup] Remapped '${pi.propertyName}': ${pi.placeType} → ${remapped}`);
      stats.reclassifiedNonStandard++;
    }

    // ── Pass 3: Null contaminated descriptions ───────────────────────────
    // Find non-food places with heavy food-specific language in descriptions
    const nonFoodWithDescriptions = await prisma.placeIntelligence.findMany({
      where: {
        status: 'complete',
        placeType: { in: ['shop', 'museum', 'neighborhood'] },
        description: { not: null },
      },
      select: {
        id: true,
        propertyName: true,
        placeType: true,
        description: true,
        googleData: true,
      },
      take: 500,
    });

    for (const pi of nonFoodWithDescriptions) {
      if (!pi.description) continue;
      const gd = pi.googleData as Record<string, any> | null;
      const gtypes = (gd?.types || []).join(' ').toLowerCase();
      const googleSaysFood = /restaurant|food|cafe|bar|bakery|meal/.test(gtypes);

      // Skip if Google types confirm it's actually a food place (mistyped — Pass 1 handles)
      if (googleSaysFood) continue;

      const foodHits = countMatches(pi.description, FOOD_KEYWORDS);
      if (foodHits >= 2) {
        await prisma.placeIntelligence.update({
          where: { id: pi.id },
          data: { description: null, whatToOrder: null, tips: null },
        });
        console.log(`[type-cleanup] Nulled description for '${pi.propertyName}' (${pi.placeType}): ${foodHits} food keywords`);
        stats.descriptionsNulled++;
      }
    }

    // Also check food places for heavy non-food language
    const foodWithDescriptions = await prisma.placeIntelligence.findMany({
      where: {
        status: 'complete',
        placeType: { in: ['restaurant', 'bar', 'cafe'] },
        description: { not: null },
      },
      select: {
        id: true,
        propertyName: true,
        placeType: true,
        description: true,
        googleData: true,
      },
      take: 500,
    });

    for (const pi of foodWithDescriptions) {
      if (!pi.description) continue;
      const gd = pi.googleData as Record<string, any> | null;
      const gtypes = (gd?.types || []).join(' ').toLowerCase();
      const googleSaysShop = /store|shop|clothing|retail|boutique/.test(gtypes);
      const googleSaysHotel = /hotel|lodging|resort|motel/.test(gtypes);

      if (!googleSaysShop && !googleSaysHotel) continue; // Only flag when Google types also contradict

      const retailHits = countMatches(pi.description, RETAIL_KEYWORDS);
      const hotelHits = countMatches(pi.description, HOTEL_KEYWORDS);

      if (retailHits >= 2 || hotelHits >= 2) {
        await prisma.placeIntelligence.update({
          where: { id: pi.id },
          data: { description: null, whatToOrder: null, tips: null },
        });
        console.log(`[type-cleanup] Nulled description for '${pi.propertyName}' (${pi.placeType}): retail=${retailHits}, hotel=${hotelHits} keywords`);
        stats.descriptionsNulled++;
      }
    }

    // ── Pass 4: Re-trigger stale PI with null googleData ─────────────────
    // These had a pipeline failure at the google_places stage — enrichment
    // started but never fetched Google data.
    const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stale = await prisma.placeIntelligence.findMany({
      where: {
        googleData: null as any,
        status: { in: ['complete', 'failed'] },
        createdAt: { lt: staleThreshold },
        errorCount: { lt: 3 }, // Don't retry places that keep failing
      },
      select: {
        id: true,
        googlePlaceId: true,
        propertyName: true,
        placeType: true,
        lastTriggeredBy: true,
      },
      take: 50,
    });

    for (const pi of stale) {
      try {
        await ensureEnrichment(
          pi.googlePlaceId,
          pi.propertyName,
          pi.lastTriggeredBy || 'cron-type-cleanup',
          'type_cleanup_retry',
          pi.placeType || undefined,
        );
        console.log(`[type-cleanup] Re-triggered enrichment for '${pi.propertyName}' (no googleData)`);
        stats.staleRetriggered++;
      } catch (err) {
        console.error(`[type-cleanup] Re-trigger failed for ${pi.id}:`, err);
      }
    }

    console.log(`[type-cleanup] Complete: ${JSON.stringify(stats)}`);
    return NextResponse.json({ success: true, stats });

  } catch (error) {
    console.error('[type-cleanup] Cron error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
