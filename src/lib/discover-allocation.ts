/**
 * Discover Allocation — map scored candidates into feed card slots.
 *
 * Takes a ranked list of ScoredCandidates and assigns them to the 8 feed sections
 * with diversity constraints (no property appears in more than one slot).
 */

import type { TasteDomain, TasteContradiction, OnboardingLifeContext } from '@/types';
import { DIMENSION_TO_DOMAIN } from '@/types';
import type { ScoredCandidate } from './discover-candidates';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AllocatedFeed {
  deepMatch: AllocatedDeepMatch;
  becauseYouCards: AllocatedBecauseYou[];
  signalThread: AllocatedSignalThread;
  tasteTension: AllocatedTasteTension | null;
  weeklyCollection: AllocatedWeeklyCollection;
  moodBoards: AllocatedMoodBoard[];
  stretchPick: AllocatedStretchPick | null;
  contextRecs: AllocatedContextRec[];
  contextLabel: string;
}

export interface AllocatedDeepMatch {
  candidate: ScoredCandidate;
}

export interface AllocatedBecauseYou {
  candidate: ScoredCandidate;
  signal: string;       // The specific user signal that drove this match
  signalDomain: string; // Domain of that signal
}

export interface AllocatedSignalThread {
  signal: string;       // The dominant user signal
  domain: TasteDomain;
  candidates: ScoredCandidate[];
}

export interface AllocatedTasteTension {
  contradiction: TasteContradiction;
  candidate: ScoredCandidate;
}

export interface AllocatedWeeklyCollection {
  dominantDomain: TasteDomain;
  candidates: ScoredCandidate[];
}

export interface AllocatedMoodBoard {
  domain: TasteDomain;
  candidates: ScoredCandidate[];
}

export interface AllocatedStretchPick {
  candidate: ScoredCandidate;
  strongDomain: TasteDomain;
  weakDomain: TasteDomain;
}

export interface AllocatedContextRec {
  candidate: ScoredCandidate;
}

// ─── Allocation logic ───────────────────────────────────────────────────────

const MIN_CANDIDATES_FOR_RAG = 15;

/**
 * Returns true if we have enough enriched candidates to generate a RAG-grounded feed.
 * If false, the caller should fall back to the LLM-only flow.
 */
export function hasEnoughCandidates(scoredCount: number): boolean {
  return scoredCount >= MIN_CANDIDATES_FOR_RAG;
}

/**
 * Allocate scored candidates into feed card slots.
 *
 * Ensures no property appears in more than one slot.
 * Returns a structured allocation that gets passed to Claude for editorial copy.
 */
export function allocateSlots(
  scored: ScoredCandidate[],
  userMicroSignals: Record<string, string[]>,
  userContradictions: TasteContradiction[],
  lifeContext: OnboardingLifeContext | null,
): AllocatedFeed {
  const used = new Set<string>(); // track used googlePlaceIds

  function takeFirst(
    candidates: ScoredCandidate[],
    filter?: (c: ScoredCandidate) => boolean,
  ): ScoredCandidate | null {
    for (const c of candidates) {
      if (used.has(c.googlePlaceId)) continue;
      if (filter && !filter(c)) continue;
      used.add(c.googlePlaceId);
      return c;
    }
    return null;
  }

  function takeN(
    candidates: ScoredCandidate[],
    n: number,
    filter?: (c: ScoredCandidate) => boolean,
  ): ScoredCandidate[] {
    const result: ScoredCandidate[] = [];
    for (const c of candidates) {
      if (result.length >= n) break;
      if (used.has(c.googlePlaceId)) continue;
      if (filter && !filter(c)) continue;
      used.add(c.googlePlaceId);
      result.push(c);
    }
    return result;
  }

  // ── 1. Deep Match: highest overall score ──
  const deepMatchCandidate = takeFirst(scored)!;
  const deepMatch: AllocatedDeepMatch = { candidate: deepMatchCandidate };

  // ── 2. Because You Cards: next 3, diversified by domain ──
  const becauseYouCards: AllocatedBecauseYou[] = [];
  const usedDomains = new Set<TasteDomain>();

  for (const c of scored) {
    if (becauseYouCards.length >= 3) break;
    if (used.has(c.googlePlaceId)) continue;

    // Prefer domain diversity
    if (becauseYouCards.length > 0 && usedDomains.has(c.topDimension)) continue;

    used.add(c.googlePlaceId);
    usedDomains.add(c.topDimension);

    // Pick the top matching signal as the "because you..." reason
    const topSig = c.topMatchingSignals[0];
    becauseYouCards.push({
      candidate: c,
      signal: topSig?.signal || `Strong ${c.topDimension} alignment`,
      signalDomain: topSig?.dimension
        ? (DIMENSION_TO_DOMAIN[topSig.dimension] || c.topDimension)
        : c.topDimension,
    });
  }

  // If we didn't get 3 with diversity, fill remaining without constraint
  for (const c of scored) {
    if (becauseYouCards.length >= 3) break;
    if (used.has(c.googlePlaceId)) continue;
    used.add(c.googlePlaceId);
    const topSig = c.topMatchingSignals[0];
    becauseYouCards.push({
      candidate: c,
      signal: topSig?.signal || `Strong ${c.topDimension} alignment`,
      signalDomain: topSig?.dimension
        ? (DIMENSION_TO_DOMAIN[topSig.dimension] || c.topDimension)
        : c.topDimension,
    });
  }

  // ── 3. Taste Tension: best contradiction resolver ──
  let tasteTension: AllocatedTasteTension | null = null;
  if (userContradictions.length > 0) {
    const tensionCandidate = takeFirst(scored, (c) =>
      c.contradictionRelevance?.coversBothSides === true,
    );
    if (tensionCandidate && tensionCandidate.contradictionRelevance) {
      tasteTension = {
        contradiction: tensionCandidate.contradictionRelevance.contradiction,
        candidate: tensionCandidate,
      };
    }
  }

  // ── 4. Signal Thread: find dominant micro-signal shared by multiple candidates ──
  const signalThread = allocateSignalThread(scored, used, userMicroSignals);

  // ── 5. Stretch Pick: high on one domain, low overall ──
  let stretchPick: AllocatedStretchPick | null = null;
  const stretchCandidate = takeFirst(scored, (c) => {
    if (c.overallScore > 60) return false; // should feel like a stretch
    const domains = Object.entries(c.domainBreakdown) as [TasteDomain, number][];
    const strong = domains.find(([, v]) => v >= 75);
    const weak = domains.find(([, v]) => v <= 40);
    return !!strong && !!weak;
  });
  if (stretchCandidate) {
    const domains = Object.entries(stretchCandidate.domainBreakdown) as [TasteDomain, number][];
    const strong = domains.sort(([, a], [, b]) => b - a)[0];
    const weak = domains.sort(([, a], [, b]) => a - b)[0];
    stretchPick = {
      candidate: stretchCandidate,
      strongDomain: strong[0],
      weakDomain: weak[0],
    };
  }

  // ── 6. Weekly Collection: 4-6 properties with thematic coherence ──
  const weeklyDomain = findDominantUnusedDomain(scored, used);
  const weeklyCollection: AllocatedWeeklyCollection = {
    dominantDomain: weeklyDomain,
    candidates: takeN(scored, 5, (c) => c.topDimension === weeklyDomain),
  };
  // Fill if needed
  if (weeklyCollection.candidates.length < 3) {
    const extra = takeN(scored, 5 - weeklyCollection.candidates.length);
    weeklyCollection.candidates.push(...extra);
  }

  // ── 7. Mood Boards: 2 groups of 3 from different domains ──
  const moodBoards: AllocatedMoodBoard[] = [];
  const remainingDomains = (['Design', 'Atmosphere', 'Character', 'Service', 'FoodDrink', 'Setting'] as TasteDomain[])
    .filter((d) => d !== weeklyDomain);

  for (const domain of remainingDomains) {
    if (moodBoards.length >= 2) break;
    const candidates = takeN(scored, 3, (c) => c.topDimension === domain);
    if (candidates.length >= 2) {
      moodBoards.push({ domain, candidates });
    }
  }

  // ── 8. Context Recs: 3-4 based on life context ──
  // Prefer places whose bestMonths include the current month
  const currentMonthName = ['January','February','March','April','May','June','July','August','September','October','November','December'][new Date().getMonth()];
  const currentMonthShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][new Date().getMonth()];

  // Sort remaining candidates: bestMonths-matching first, then by score
  const contextCandidates = scored
    .filter((c) => !used.has(c.googlePlaceId))
    .map((c) => {
      const bestMonths = (c as any).bestMonths as string[] | undefined;
      const isSeasonalMatch = bestMonths?.some(
        (m: string) => m.toLowerCase() === currentMonthName.toLowerCase() || m.toLowerCase() === currentMonthShort.toLowerCase()
      ) ?? false;
      return { ...c, isSeasonalMatch };
    })
    .sort((a, b) => {
      if (a.isSeasonalMatch && !b.isSeasonalMatch) return -1;
      if (!a.isSeasonalMatch && b.isSeasonalMatch) return 1;
      return b.overallScore - a.overallScore;
    });

  const contextRecs: AllocatedContextRec[] = contextCandidates.slice(0, 4).map((c) => ({ candidate: c }));

  // ── Context label — richer than binary Summer/Winter ──
  const companion = lifeContext?.primaryCompanions?.[0] || 'solo';
  const hasSeasonalMatches = contextCandidates.slice(0, 4).some((c) => c.isSeasonalMatch);
  let contextLabel: string;
  if (companion !== 'solo') {
    contextLabel = `With ${companion}`;
  } else if (hasSeasonalMatches) {
    contextLabel = `Perfect for ${currentMonthName}`;
  } else {
    const month = new Date().getMonth();
    const season = month >= 4 && month <= 9 ? 'Summer' : 'Winter';
    contextLabel = season;
  }

  return {
    deepMatch,
    becauseYouCards,
    signalThread,
    tasteTension,
    weeklyCollection,
    moodBoards,
    stretchPick,
    contextRecs,
    contextLabel,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function allocateSignalThread(
  scored: ScoredCandidate[],
  used: Set<string>,
  userMicroSignals: Record<string, string[]>,
): AllocatedSignalThread {
  // Find the user micro-signal that appears most across candidate top signals
  const signalFrequency = new Map<string, { domain: TasteDomain; count: number; candidates: ScoredCandidate[] }>();

  for (const c of scored) {
    if (used.has(c.googlePlaceId)) continue;
    for (const sig of c.topMatchingSignals.slice(0, 3)) {
      const domain = DIMENSION_TO_DOMAIN[sig.dimension] || c.topDimension;
      const key = sig.signal.toLowerCase().slice(0, 50); // normalize

      if (!signalFrequency.has(key)) {
        signalFrequency.set(key, { domain, count: 0, candidates: [] });
      }
      const entry = signalFrequency.get(key)!;
      entry.count++;
      if (!entry.candidates.includes(c)) entry.candidates.push(c);
    }
  }

  // Pick the signal shared by the most candidates
  let bestSignal = '';
  let bestDomain: TasteDomain = 'Design';
  let bestCandidates: ScoredCandidate[] = [];
  let bestCount = 0;

  for (const [signal, entry] of signalFrequency) {
    if (entry.count > bestCount && entry.candidates.length >= 2) {
      bestSignal = signal;
      bestDomain = entry.domain;
      bestCandidates = entry.candidates;
      bestCount = entry.count;
    }
  }

  // Take up to 3 candidates for the thread
  const threadCandidates: ScoredCandidate[] = [];
  for (const c of bestCandidates) {
    if (threadCandidates.length >= 3) break;
    if (used.has(c.googlePlaceId)) continue;
    used.add(c.googlePlaceId);
    threadCandidates.push(c);
  }

  // Fallback if no shared signal found
  if (!bestSignal) {
    const firstUserDomain = Object.keys(userMicroSignals)[0] || 'Design';
    const firstSignal = userMicroSignals[firstUserDomain]?.[0] || 'distinctive character';
    bestSignal = firstSignal;
    bestDomain = firstUserDomain as TasteDomain;
  }

  return {
    signal: bestSignal,
    domain: bestDomain,
    candidates: threadCandidates,
  };
}

// ─── Partial allocation for /discover/more ────────────────────────────────────

/**
 * Partial feed allocation — only fills the sections listed in `requestedSections`.
 * Same logic as allocateSlots() but scoped to the requested section types.
 * Used by /discover/more to allocate different editorial templates per page.
 */
export function allocateMoreSlots(
  scored: ScoredCandidate[],
  requestedSections: string[],
  userMicroSignals: Record<string, string[]>,
  userContradictions: TasteContradiction[],
  lifeContext: OnboardingLifeContext | null,
): Partial<AllocatedFeed> & { contextLabel: string } {
  const used = new Set<string>();
  const sections = new Set(requestedSections);

  function takeFirst(
    candidates: ScoredCandidate[],
    filter?: (c: ScoredCandidate) => boolean,
  ): ScoredCandidate | null {
    for (const c of candidates) {
      if (used.has(c.googlePlaceId)) continue;
      if (filter && !filter(c)) continue;
      used.add(c.googlePlaceId);
      return c;
    }
    return null;
  }

  function takeN(
    candidates: ScoredCandidate[],
    n: number,
    filter?: (c: ScoredCandidate) => boolean,
  ): ScoredCandidate[] {
    const result: ScoredCandidate[] = [];
    for (const c of candidates) {
      if (result.length >= n) break;
      if (used.has(c.googlePlaceId)) continue;
      if (filter && !filter(c)) continue;
      used.add(c.googlePlaceId);
      result.push(c);
    }
    return result;
  }

  const result: Partial<AllocatedFeed> = {};

  // Deep Match
  if (sections.has('deepMatch')) {
    const candidate = takeFirst(scored);
    if (candidate) result.deepMatch = { candidate };
  }

  // Because You Cards
  if (sections.has('becauseYouCards')) {
    const cards: AllocatedBecauseYou[] = [];
    const usedDomains = new Set<TasteDomain>();
    for (const c of scored) {
      if (cards.length >= 3) break;
      if (used.has(c.googlePlaceId)) continue;
      if (cards.length > 0 && usedDomains.has(c.topDimension)) continue;
      used.add(c.googlePlaceId);
      usedDomains.add(c.topDimension);
      const topSig = c.topMatchingSignals[0];
      cards.push({
        candidate: c,
        signal: topSig?.signal || `Strong ${c.topDimension} alignment`,
        signalDomain: topSig?.dimension
          ? (DIMENSION_TO_DOMAIN[topSig.dimension] || c.topDimension)
          : c.topDimension,
      });
    }
    // Fill remaining without domain constraint
    for (const c of scored) {
      if (cards.length >= 3) break;
      if (used.has(c.googlePlaceId)) continue;
      used.add(c.googlePlaceId);
      const topSig = c.topMatchingSignals[0];
      cards.push({
        candidate: c,
        signal: topSig?.signal || `Strong ${c.topDimension} alignment`,
        signalDomain: topSig?.dimension
          ? (DIMENSION_TO_DOMAIN[topSig.dimension] || c.topDimension)
          : c.topDimension,
      });
    }
    result.becauseYouCards = cards;
  }

  // Taste Tension
  if (sections.has('tasteTension') && userContradictions.length > 0) {
    const tensionCandidate = takeFirst(scored, (c) =>
      c.contradictionRelevance?.coversBothSides === true,
    );
    if (tensionCandidate && tensionCandidate.contradictionRelevance) {
      result.tasteTension = {
        contradiction: tensionCandidate.contradictionRelevance.contradiction,
        candidate: tensionCandidate,
      };
    }
  }

  // Signal Thread
  if (sections.has('signalThread')) {
    result.signalThread = allocateSignalThread(scored, used, userMicroSignals);
  }

  // Stretch Pick
  if (sections.has('stretchPick')) {
    const stretchCandidate = takeFirst(scored, (c) => {
      if (c.overallScore > 60) return false;
      const domains = Object.entries(c.domainBreakdown) as [TasteDomain, number][];
      const strong = domains.find(([, v]) => v >= 75);
      const weak = domains.find(([, v]) => v <= 40);
      return !!strong && !!weak;
    });
    if (stretchCandidate) {
      const domains = Object.entries(stretchCandidate.domainBreakdown) as [TasteDomain, number][];
      const strong = domains.sort(([, a], [, b]) => b - a)[0];
      const weak = domains.sort(([, a], [, b]) => a - b)[0];
      result.stretchPick = {
        candidate: stretchCandidate,
        strongDomain: strong[0],
        weakDomain: weak[0],
      };
    }
  }

  // Weekly Collection
  if (sections.has('weeklyCollection')) {
    const weeklyDomain = findDominantUnusedDomain(scored, used);
    const collection: AllocatedWeeklyCollection = {
      dominantDomain: weeklyDomain,
      candidates: takeN(scored, 5, (c) => c.topDimension === weeklyDomain),
    };
    if (collection.candidates.length < 3) {
      const extra = takeN(scored, 5 - collection.candidates.length);
      collection.candidates.push(...extra);
    }
    result.weeklyCollection = collection;
  }

  // Mood Boards
  if (sections.has('moodBoards')) {
    const boards: AllocatedMoodBoard[] = [];
    const allDomains = (['Design', 'Atmosphere', 'Character', 'Service', 'FoodDrink', 'Setting'] as TasteDomain[]);
    for (const domain of allDomains) {
      if (boards.length >= 2) break;
      const candidates = takeN(scored, 3, (c) => c.topDimension === domain);
      if (candidates.length >= 2) {
        boards.push({ domain, candidates });
      }
    }
    result.moodBoards = boards;
  }

  // Context Recs
  if (sections.has('contextRecs')) {
    result.contextRecs = takeN(scored, 4).map((c) => ({ candidate: c }));
  }

  // Context label
  const companion = lifeContext?.primaryCompanions?.[0] || 'solo';
  const month = new Date().getMonth();
  const season = month >= 4 && month <= 9 ? 'Summer' : 'Winter';
  const contextLabel = companion !== 'solo' ? `With ${companion}` : season;

  return { ...result, contextLabel };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function findDominantUnusedDomain(
  scored: ScoredCandidate[],
  used: Set<string>,
): TasteDomain {
  const domainCounts: Record<string, number> = {};
  for (const c of scored) {
    if (used.has(c.googlePlaceId)) continue;
    domainCounts[c.topDimension] = (domainCounts[c.topDimension] || 0) + 1;
  }
  const sorted = Object.entries(domainCounts).sort(([, a], [, b]) => b - a);
  return (sorted[0]?.[0] as TasteDomain) || 'Design';
}
