/**
 * Backfill SavedPlace matchScores using v3.2 taste matching.
 *
 * Usage: npx tsx scripts/backfill-scores-v32.ts
 *
 * Reads DATABASE_URL from .env.local via dotenv.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { computeMatchFromSignals, normalizeScoresForDisplay } from '../src/lib/taste-match-v3';
import type { MatchOptions } from '../src/lib/taste-match-v3';
import type { TasteProfile, TasteDomain, TasteContradiction } from '../src/types';
import { ALL_TASTE_DOMAINS } from '../src/types';

const prisma = new PrismaClient();
const VALID_DOMAINS = new Set<string>(ALL_TASTE_DOMAINS);

const DEFAULT_USER_PROFILE: TasteProfile = {
  Design: 0.85, Atmosphere: 0.75, Character: 0.8, Service: 0.6,
  FoodDrink: 0.75, Setting: 0.7, Wellness: 0.4, Sustainability: 0.3,
};

async function main() {
  console.log('=== v3.2 Score Backfill ===\n');

  // 1. Load all enriched property signals
  const allIntel = await prisma.placeIntelligence.findMany({
    where: { status: 'complete', signalCount: { gt: 0 } },
    select: { googlePlaceId: true, signals: true, antiSignals: true },
  });

  const intelMap = new Map<string, { signals: any[]; antiSignals: any[] }>();
  for (const intel of allIntel) {
    intelMap.set(intel.googlePlaceId, {
      signals: (intel.signals as any[]) || [],
      antiSignals: (intel.antiSignals as any[]) || [],
    });
  }
  console.log(`Loaded signals for ${intelMap.size} enriched properties\n`);

  // 2. Load users with profiles
  const users = await prisma.user.findMany({
    where: { tasteProfile: { not: undefined }, savedPlaces: { some: {} } },
    select: { id: true, tasteProfile: true },
  });

  console.log(`Found ${users.length} user(s) with profiles\n`);

  let totalUpdated = 0;

  for (const user of users) {
    const profileData = user.tasteProfile as any;
    if (!profileData?.radarData) {
      console.log(`  User ${user.id}: no radarData, skipping`);
      continue;
    }

    // Build TasteProfile
    const userProfile: TasteProfile = { ...DEFAULT_USER_PROFILE };
    for (const r of profileData.radarData || []) {
      if (r.axis && typeof r.value === 'number' && VALID_DOMAINS.has(r.axis)) {
        const val = r.value > 1 ? r.value / 100 : r.value;
        userProfile[r.axis as TasteDomain] = Math.max(userProfile[r.axis as TasteDomain], val);
      }
    }

    // v3.2 options
    const microSignals: Record<string, string[]> = profileData.microTasteSignals || {};
    const userSignalDistribution: Record<string, number> = {};
    for (const [domain, signals] of Object.entries(microSignals)) {
      if (VALID_DOMAINS.has(domain) && Array.isArray(signals)) {
        userSignalDistribution[domain] = signals.length;
      }
    }

    const contradictions: TasteContradiction[] = profileData.contradictions || [];
    const userRejectionKeywords: string[] = [];
    for (const c of contradictions) {
      if (c.stated) userRejectionKeywords.push(c.stated);
    }

    console.log(`  User ${user.id}:`);
    console.log(`    Signal distribution: ${JSON.stringify(userSignalDistribution)}`);
    console.log(`    Rejection keywords: ${userRejectionKeywords.length}`);

    // Load saved places
    const savedPlaces = await prisma.savedPlace.findMany({
      where: { userId: user.id },
      select: { id: true, googlePlaceId: true, name: true, matchScore: true },
    });

    // Score all places
    const rawScored: { savedPlaceId: string; name: string; overallScore: number; oldScore: number | null; breakdown: Record<string, number> }[] = [];

    for (const sp of savedPlaces) {
      if (!sp.googlePlaceId) continue;
      const intel = intelMap.get(sp.googlePlaceId);
      if (!intel || intel.signals.length === 0) continue;

      const matchOptions: MatchOptions = {
        userMicroSignals: microSignals,
        userSignalDistribution: Object.keys(userSignalDistribution).length > 0 ? userSignalDistribution : undefined,
        userRejectionKeywords: userRejectionKeywords.length > 0 ? userRejectionKeywords : undefined,
      };

      const match = computeMatchFromSignals(intel.signals, intel.antiSignals, userProfile, matchOptions);

      rawScored.push({
        savedPlaceId: sp.id,
        name: sp.name,
        overallScore: match.overallScore,
        oldScore: sp.matchScore,
        breakdown: match.breakdown,
      });
    }

    // Normalize
    const normalized = normalizeScoresForDisplay(rawScored);
    normalized.sort((a, b) => b.overallScore - a.overallScore);

    // Show top 15 and bottom 5
    console.log(`\n    Top 15 matches (v3.2 normalized):`);
    for (const s of normalized.slice(0, 15)) {
      console.log(`      ${s.overallScore}% (was ${s.oldScore ?? '?'}%) — ${s.name}`);
    }
    console.log(`    ...`);
    console.log(`    Bottom 5:`);
    for (const s of normalized.slice(-5)) {
      console.log(`      ${s.overallScore}% (was ${s.oldScore ?? '?'}%) — ${s.name}`);
    }

    // Write to database
    let userUpdated = 0;
    for (const scored of normalized) {
      const normalizedBreakdown: Record<string, number> = {};
      for (const [domain, score] of Object.entries(scored.breakdown)) {
        normalizedBreakdown[domain] = Math.round(score) / 100;
      }

      await prisma.savedPlace.update({
        where: { id: scored.savedPlaceId },
        data: {
          matchScore: scored.overallScore,
          matchBreakdown: normalizedBreakdown,
        },
      });
      userUpdated++;
    }

    totalUpdated += userUpdated;
    console.log(`\n    ✓ ${userUpdated} scores written to database`);
  }

  console.log(`\n=== Done: ${totalUpdated} total scores backfilled ===`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
