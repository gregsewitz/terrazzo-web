# RAG-Grounded Discover Feed — Implementation Spec

**Goal:** Replace the current "Claude invents property names" discover flow with a retrieval-first approach where Claude writes editorial copy about real properties backed by real PlaceIntelligence data.

**Estimated effort:** 1–2 weeks for a single engineer
**Dependencies:** Existing PlaceIntelligence pipeline (already built), existing taste match logic (already built)

---

## Current Flow (What We're Replacing)

```
User profile → Claude (single call) → Invents ~25 property names → Google Places resolution → Trigger enrichment
```

Problems:
- Claude hallucates properties that may not exist or may not match
- No connection to the signal data we've already collected
- Google Places resolution sometimes fails or resolves to wrong place
- Match scores are invented by Claude, not computed
- Every feed generation is a cold start with zero real data

## Target Flow

```
User profile → Query PlaceIntelligence → Score & rank candidates → Select top ~25 → Claude (editorial only) → Attach googlePlaceIds
```

Benefits:
- Every property in the feed is a real place with real signal data
- Match scores are computed from actual signal overlap
- Claude writes about properties it has rich context on
- No post-hoc Google resolution needed (we already have googlePlaceIds)
- Feed quality improves automatically as PlaceIntelligence records get enriched

---

## Architecture

### Step 1: Candidate Retrieval

Query all PlaceIntelligence records with `status = 'complete'` and `signalCount > 0`.

```typescript
// src/lib/discover-candidates.ts

import { prisma } from '@/lib/prisma';
import { BriefingSignal, TasteDomain, DIMENSION_TO_DOMAIN } from '@/types';

interface CandidateProperty {
  googlePlaceId: string;
  propertyName: string;
  signals: BriefingSignal[];
  antiSignals: BriefingAntiSignal[];
  reliability: { overall: number; totalReviews: number } | null;
  facts: Record<string, unknown> | null;
  signalCount: number;
  reliabilityScore: number | null;
}

export async function fetchCandidateProperties(): Promise<CandidateProperty[]> {
  const records = await prisma.placeIntelligence.findMany({
    where: {
      status: 'complete',
      signalCount: { gt: 0 },
    },
    select: {
      googlePlaceId: true,
      propertyName: true,
      signals: true,
      antiSignals: true,
      reliability: true,
      facts: true,
      signalCount: true,
      reliabilityScore: true,
    },
  });

  return records.map(r => ({
    ...r,
    signals: (r.signals as BriefingSignal[]) || [],
    antiSignals: (r.antiSignals as BriefingAntiSignal[]) || [],
    reliability: r.reliability as CandidateProperty['reliability'],
    facts: r.facts as Record<string, unknown> | null,
  }));
}
```

**Caching:** This query should be cached (Upstash Redis, 5-minute TTL) since the PlaceIntelligence table changes slowly. Invalidate on pipeline completion events.

### Step 2: Taste-Aware Scoring

Adapt the existing `computeMatchFromSignals` logic to score every candidate against the user's profile.

```typescript
// src/lib/discover-scoring.ts

interface ScoredCandidate extends CandidateProperty {
  overallScore: number;          // 0-100
  domainBreakdown: Record<TasteDomain, number>;
  topMatchingSignals: BriefingSignal[];   // Top 5 signals that drove the match
  contradictionRelevance: string | null;  // Which user contradiction this property might resolve
}

export function scoreCandidate(
  candidate: CandidateProperty,
  userProfile: GeneratedTasteProfile,
  userSignals: TasteSignal[],
  userContradictions: TasteContradiction[],
): ScoredCandidate {
  // 1. Domain-level scoring
  //    For each of the 6 taste domains, compute signal overlap between
  //    the user's micro-signals and the property's enriched signals.
  //    Weight by the user's radar score for that domain (higher radar = more important).

  // 2. Anti-signal penalty
  //    If a property has antiSignals that match the user's positive signals,
  //    apply a penalty proportional to the antiSignal confidence.

  // 3. Contradiction resolution bonus
  //    If a property's signals span both sides of a user's contradiction
  //    (e.g., user wants "invisible service" but likes "personal warmth",
  //    and property has signals for both), give a bonus score.
  //    Track which contradiction it resolves.

  // 4. Reliability weight
  //    Properties with higher reliabilityScore and more reviews
  //    get a small confidence boost (not a score boost — we trust the match more).

  // 5. Compute top matching signals
  //    Find the 5 property signals with highest relevance to the user's profile.
  //    These become the "because you..." reasons in the feed cards.
}
```

### Step 3: Ranking & Slot Allocation

```typescript
// src/lib/discover-allocation.ts

interface AllocatedFeed {
  becauseYouCandidates: ScoredCandidate[];     // Top 3 by overall score
  signalThreadCandidate: {                      // Best cluster of a single signal
    signal: string;
    domain: TasteDomain;
    properties: ScoredCandidate[];              // 3-4 properties sharing this signal
  };
  deepMatchCandidate: ScoredCandidate;          // Highest overall score
  tasteTensionCandidate: ScoredCandidate;       // Highest contradiction resolution score
  stretchPickCandidate: ScoredCandidate;        // Intentionally lower overall but high on one axis
  weeklyCollectionCandidates: ScoredCandidate[];// 4-6 properties with thematic coherence
  moodBoardCandidates: ScoredCandidate[][];     // 2 mood groups × 3 properties
  contextRecCandidates: ScoredCandidate[];      // 3-4 filtered by life context
}

export function allocateSlots(
  scored: ScoredCandidate[],
  userProfile: GeneratedTasteProfile,
  lifeContext: OnboardingLifeContext,
): AllocatedFeed {
  // Sort by overallScore descending
  const ranked = [...scored].sort((a, b) => b.overallScore - a.overallScore);

  // Deep match = #1 ranked
  // becauseYou = #2, #3, #4 (ensure domain diversity)
  // tasteTension = highest contradictionRelevance score
  // stretchPick = find property scoring 85+ on one domain but 50- overall
  // signalThread = find the micro-signal that appears in most top-50 properties
  // weeklyCollection = thematic cluster from ranked[5:20]
  // moodBoards = group remaining by dominant domain
  // contextRecs = filter by life context (kids → family-friendly, solo → solo-traveler-friendly)

  // DIVERSITY CONSTRAINT: no property appears in more than one slot
}
```

### Step 4: Editorial Generation (Claude)

Restructure the prompt so Claude receives pre-selected properties with their computed data and writes editorial copy only.

```typescript
// Modified /api/profile/discover/route.ts

const GROUNDED_DISCOVER_PROMPT = `You are Terrazzo's editorial voice...

You are NOT selecting properties. Properties have already been selected by our matching engine.
Your job is to write warm, specific, second-person editorial copy for each card.

For each property, you receive:
- Property name and location
- Computed match score (real, not estimated)
- The specific taste signals that drove the match
- Which user contradiction the property resolves (if any)
- The user's full taste profile for narrative context

Write as if you have intimate knowledge of both the user and the property.
Reference specific signals in your copy. Never be generic or promotional.

Return valid JSON matching the existing feed schema. Scores should use the computed values provided, not invented ones.`;

const contextMessage = `
USER'S TASTE PROFILE:
${JSON.stringify(userProfile)}

ALLOCATED FEED (pre-selected by matching engine):
${JSON.stringify(allocatedFeed, null, 2)}

Write editorial copy for each card slot. Use the computed scores provided.
The properties, scores, and match reasons are final — your job is the narrative voice.`;
```

### Step 5: Wire It Up

```typescript
// Updated /api/profile/discover/route.ts — simplified flow

export async function POST(req: Request) {
  // 1. Auth + validation (same as current)

  // 2. NEW: Retrieve & score candidates
  const candidates = await fetchCandidateProperties();  // cached
  const scored = candidates.map(c => scoreCandidate(c, userProfile, allSignals, contradictions));

  // 3. NEW: Allocate to feed slots
  const allocated = allocateSlots(scored, userProfile, lifeContext);

  // 4. MODIFIED: Claude writes editorial only
  const feed = await generateEditorialCopy(allocated, userProfile, lifeContext);

  // 5. SIMPLIFIED: No Google Places resolution needed — we already have googlePlaceIds
  // 6. SIMPLIFIED: No ensureEnrichment needed — candidates are already enriched

  return NextResponse.json(feed);
}
```

---

## Migration Strategy

Don't rip out the old flow immediately. Run them in parallel:

1. **Week 1:** Build Steps 1-3 (retrieval, scoring, allocation). Test with the persona harness.
2. **Week 2:** Build Step 4 (editorial prompt). A/B test: 50% of users get RAG-grounded feed, 50% get current LLM-only feed.
3. **Week 3:** Measure engagement (card taps, saves, dismisses). If RAG outperforms, roll to 100%.

### Fallback

If a user's taste profile produces fewer than 15 scored candidates above a minimum threshold (e.g., score > 40), fall back to the current LLM-only flow. This handles the cold-start case where PlaceIntelligence doesn't have enough enriched properties yet.

---

## What This Unblocks

Once this RAG layer is live, adding Phases 1-2-4 from the roadmap becomes incremental:

- **Phase 1 (Taste Graph):** Replace the naive signal-overlap scoring with vector similarity. The retrieval + allocation structure stays the same.
- **Phase 2 (Property Embeddings):** Replace the SQL query with a pgvector nearest-neighbor query. Same structure, better retrieval.
- **Phase 4 (Behavioral Feedback):** Feed interaction events adjust the scoring weights. Same structure, smarter ranking.

The RAG layer IS the skeleton that the full recommendation engine grows into.

---

## Open Questions

1. **How many complete PlaceIntelligence records exist today?** If <50, the feed will feel thin. May need a backfill sprint first.
2. **Should we expose the computed match score vs. the current LLM-estimated score?** Computed scores will be more honest (and often lower). This might be jarring if users are used to seeing 95+ on everything.
3. **Location filtering:** Should we factor in user's home city or upcoming trip dates to prefer geographically relevant properties? Or keep it global discovery?
4. **Freshness diversity:** Should recently enriched properties get a small boost to keep the feed feeling fresh week over week?
