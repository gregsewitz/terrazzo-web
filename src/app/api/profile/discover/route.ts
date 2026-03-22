import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { validateBody, profileDiscoverSchema } from '@/lib/api-validation';
import { authHandler } from '@/lib/api-auth-handler';
import { ensureEnrichment } from '@/lib/ensure-enrichment';
import type { User } from '@prisma/client';
import type {
  TasteProfile,
  TasteDomain,
  TasteContradiction,
  GeneratedTasteProfile,
  OnboardingLifeContext,
} from '@/types';
import { ALL_TASTE_DOMAINS } from '@/types';
// v3.2: Default user profile for when radarData is missing
const DEFAULT_USER_PROFILE: TasteProfile = {
  Design: 0.85,
  Atmosphere: 0.75,
  Character: 0.8,
  Service: 0.6,
  FoodDrink: 0.75,
  Setting: 0.7,
  Wellness: 0.4,
  Sustainability: 0.3,
};

// RAG-grounded discover modules
import {
  fetchCandidateProperties,
  scoreAllCandidates,
  scoreWithVectors,
} from '@/lib/discover-candidates';
import {
  hasEnoughCandidates,
  allocateSlots,
} from '@/lib/discover-allocation';
import { generateEditorialCopy } from '@/lib/discover-editorial';
import { apiError, errorMessage } from '@/lib/api-error';

// ─── RAG-grounded flow ───────────────────────────────────────────────────────

async function generateGroundedFeed(
  userProfile: GeneratedTasteProfile,
  lifeContext: OnboardingLifeContext | null,
  userId?: string,
) {
  // 1. Retrieve enriched candidates (cached)
  const candidates = await fetchCandidateProperties();
  console.log(`[discover-rag] ${candidates.length} enriched candidates available`);

  // 2. Extract user signals for scoring
  const userMicroSignals = userProfile.microTasteSignals || {};
  const userContradictions: TasteContradiction[] = userProfile.contradictions || [];

  // Build a TasteProfile (domain weights) from radarData
  // radarData axes are v2 domain names (Design, Atmosphere, etc.) directly
  const validDomains = new Set<string>(ALL_TASTE_DOMAINS);
  const userTasteProfile: TasteProfile = { ...DEFAULT_USER_PROFILE };
  for (const r of userProfile.radarData || []) {
    if (validDomains.has(r.axis)) {
      userTasteProfile[r.axis as TasteDomain] = Math.max(userTasteProfile[r.axis as TasteDomain], r.value);
    }
  }

  // v3.2: Derive signal distribution from microTasteSignals (count per domain)
  // NOTE: microTasteSignals keys are category names (e.g. "service_ideals",
  // "material_obsessions") NOT domain names ("Design", "FoodDrink"). Only keys
  // that happen to match a valid TasteDomain are counted. When no keys match
  // (the common case), we pass undefined to fall back to raw radar weights
  // rather than crushing every domain to 30% via empty-distribution enhancement.
  const userSignalDistribution: Record<string, number> = {};
  for (const [domain, signals] of Object.entries(userMicroSignals)) {
    if (validDomains.has(domain) && Array.isArray(signals)) {
      userSignalDistribution[domain] = signals.length;
    }
  }
  const hasSignalDistribution = Object.keys(userSignalDistribution).length > 0;

  // v3.2: Extract rejection keywords from contradictions (stated preferences)
  // In production, explicit rejection keywords come from the contradictions' "stated" side
  // and any microTasteSignals key containing "rejection" or "anti" patterns
  const userRejectionKeywords: string[] = [];
  for (const c of userContradictions) {
    if (c.stated) userRejectionKeywords.push(c.stated);
  }

  // 3. Score all candidates — use vector-enhanced scoring when available
  const scoringContext = {
    applyDecay: true,
    userSignalDistribution: hasSignalDistribution ? userSignalDistribution : undefined,
    userRejectionKeywords: userRejectionKeywords.length > 0 ? userRejectionKeywords : undefined,
  };

  let scored;
  if (userId) {
    const { results, vectorEnabled } = await scoreWithVectors(
      userId,
      candidates,
      userTasteProfile,
      userMicroSignals,
      userContradictions,
      scoringContext,
    );
    scored = results;
    if (vectorEnabled) {
      console.log(`[discover-rag] Using vector-enhanced scoring for user ${userId}`);
    }
  } else {
    scored = scoreAllCandidates(
      candidates,
      userTasteProfile,
      userMicroSignals,
      userContradictions,
      scoringContext,
    );
  }

  // 4. Check if we have enough for a RAG-grounded feed
  if (!hasEnoughCandidates(scored.length)) {
    console.log(`[discover-rag] Only ${scored.length} candidates — falling back to legacy flow`);
    return null; // Signal caller to use legacy flow
  }

  console.log(`[discover-rag] Scoring complete. Top score: ${scored[0]?.overallScore}, bottom: ${scored[scored.length - 1]?.overallScore}`);

  // 5. Allocate to feed slots
  const allocated = allocateSlots(scored, userMicroSignals, userContradictions, lifeContext);

  // 6. Generate editorial copy (Claude writes about pre-selected properties)
  const feed = await generateEditorialCopy(allocated, userProfile, lifeContext);

  console.log(`[discover-rag] RAG-grounded feed generated successfully`);
  return feed;
}

// ─── Universal enrichment trigger ─────────────────────────────────────────────

export interface FeedPlace {
  googlePlaceId?: string;
  name?: string;
  place?: string; // becauseYouCards use "place" instead of "name"
  location?: string;
  type?: string;
}

/**
 * Walk ALL sections of a generated feed and collect every unique place.
 * Mirrors the structure of `extractPlaces` / `attachPlaceIds` but collects
 * googlePlaceIds for enrichment rather than attaching them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractAllFeedPlaces(feed: any): FeedPlace[] {
  const seen = new Set<string>();
  const places: FeedPlace[] = [];

  function add(obj: FeedPlace | undefined) {
    if (!obj) return;
    const name = obj.name || obj.place;
    if (!name) return;
    // Deduplicate by googlePlaceId when available, otherwise by name+location
    const key = obj.googlePlaceId || `${name}||${obj.location || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    places.push({ googlePlaceId: obj.googlePlaceId, name, location: obj.location, type: obj.type });
  }

  for (const card of feed.becauseYouCards || []) add(card);
  for (const p of feed.signalThread?.places || []) add(p);
  add(feed.tasteTension?.resolvedBy);
  for (const p of feed.weeklyCollection?.places || []) add(p);
  for (const board of feed.moodBoards || []) {
    for (const p of board.places || []) add(p);
  }
  add(feed.deepMatch);
  add(feed.stretchPick);
  for (const rec of feed.contextRecs || []) add(rec);

  return places;
}

/**
 * Fire-and-forget: ensure enrichment is triggered for every place in the feed.
 * Uses Promise.allSettled so one failure doesn't block others.
 */
export async function triggerEnrichmentBatch(
  places: FeedPlace[],
  userId: string,
  trigger: string,
): Promise<void> {
  const withIds = places.filter(p => p.googlePlaceId);
  if (withIds.length === 0) return;

  const results = await Promise.allSettled(
    withIds.map(p =>
      ensureEnrichment(
        p.googlePlaceId!,
        p.name || p.place || '',
        userId,
        trigger,
        (p.type as any) || undefined,
      ),
    ),
  );

  const triggered = results.filter(r => r.status === 'fulfilled' && r.value).length;
  const skipped = withIds.length - triggered;
  console.log(`[discover] Enrichment batch: ${triggered} triggered, ${skipped} already enriched (${places.length} total places, ${places.length - withIds.length} without googlePlaceId)`);
}

// ─── Route handler ───────────────────────────────────────────────────────────

export const POST = authHandler(async (req: NextRequest, _ctx, user: User) => {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip + ':ai', { maxRequests: 10, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  try {
    const validation = await validateBody(req, profileDiscoverSchema);
    if ('error' in validation) {
      return validation.error;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { userProfile, lifeContext } = validation.data as any;

    // RAG-grounded flow (legacy LLM-only path has been deprecated)
    const ragFeed = await generateGroundedFeed(
      userProfile as GeneratedTasteProfile,
      lifeContext as OnboardingLifeContext | null,
      user.id,
    );

    if (!ragFeed) {
      console.error('[discover] RAG flow returned null — not enough enriched candidates');
      return apiError('Not enough enriched places to build your discover feed yet. Please try again shortly.', 503);
    }

    // Defensive: ensure all surfaced places have enrichment triggered
    triggerEnrichmentBatch(extractAllFeedPlaces(ragFeed), user.id, 'discover_rag').catch((err: unknown) => console.warn('[discover] triggerEnrichmentBatch failed:', err));
    return NextResponse.json(ragFeed);
  } catch (error: unknown) {
    console.error('Discover generation error:', error);
    return apiError('Failed to generate discover content', 500, { details: errorMessage(error) });
  }
});
