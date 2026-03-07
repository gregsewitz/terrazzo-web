/**
 * Match Runner
 *
 * Scores synthetic users against all enriched properties in the database.
 * Uses the same computeMatchFromSignals function as the real Discover feed.
 *
 * Can run in two modes:
 *   1. DB mode: Query Supabase for enriched properties with signals
 *   2. Fixture mode: Load from a local JSON fixture (for CI/offline testing)
 */

import { computeMatchFromSignals, normalizeScoresForDisplay } from '../../../src/lib/taste-match-v3';
import type { MatchOptions } from '../../../src/lib/taste-match-v3';
import type { TasteProfile, TasteDomain } from '../../../src/types';
import type { SyntheticUserResult } from './orchestrator';
import {
  computeProfileDeviation,
  analyzeScoreDistribution,
  computeDiscrimination,
  analyzeFeedHealth,
  type ProfileDeviation,
  type ScoreDistribution,
  type CrossArchetypeDiscrimination,
  type FeedHealth,
} from '../evaluator/metrics';
import type { TasteArchetype } from '../archetypes';
import type { SyntheticConfig } from '../config';
import {
  computeUserTasteVectorV3,
  computePropertyEmbeddingV3,
  cosineSimilarityV3,
  setIdfWeightsV3,
  type UserVectorInputV3,
} from '../../../src/lib/taste-intelligence/vectors-v3';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EnrichedProperty {
  id: string;
  propertyName: string;
  googlePlaceId: string;
  signals: Array<{
    dimension: string;
    confidence: number;
    signal: string;
    source_type?: string;
    review_corroborated?: boolean;
    extractedAt?: string;
  }>;
  antiSignals: Array<{
    dimension: string;
    confidence: number;
    signal: string;
  }>;
  sustainabilityScore?: number;
  placeType?: string;
}

export interface PropertyMatch {
  propertyId: string;
  propertyName: string;
  overallScore: number;
  /** Raw score before normalizeScoresForDisplay (for cross-archetype comparison) */
  rawScore: number;
  breakdown: Record<TasteDomain, number>;
  topDimension: TasteDomain;
  isStretchPick: boolean;
}

export interface UserMatchReport {
  archetypeId: string;
  variationSeed: number;
  /** All property matches, sorted by score descending */
  matches: PropertyMatch[];
  /** Score distribution analysis */
  distribution: Omit<ScoreDistribution, 'archetypeId'>;
  /** Profile deviation (expected vs synthesized) */
  profileDeviation: ProfileDeviation | null;
}

export interface CrossArchetypeReport {
  /** Per-archetype match reports */
  byArchetype: Record<string, UserMatchReport[]>;
  /** Pairwise cross-archetype discrimination */
  pairwiseDiscrimination: Array<{
    archetypeA: string;
    archetypeB: string;
    result: Omit<CrossArchetypeDiscrimination, 'archetypeA' | 'archetypeB'>;
  }>;
  /** Feed health analysis per archetype */
  feedHealth: Record<string, Omit<FeedHealth, 'userId' | 'archetypeId'>>;
}

// ─── Property Loading ─────────────────────────────────────────────────────────

/**
 * Load enriched properties from a JSON fixture file.
 * Expected format: array of EnrichedProperty objects.
 */
export async function loadPropertiesFromFixture(fixturePath: string): Promise<EnrichedProperty[]> {
  const fs = await import('fs');
  const raw = fs.readFileSync(fixturePath, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Load enriched properties from Supabase.
 * Queries the placeIntelligence table for all places with signals.
 */
export async function loadPropertiesFromDb(supabaseUrl: string, supabaseKey: string): Promise<EnrichedProperty[]> {
  const res = await fetch(`${supabaseUrl}/rest/v1/PlaceIntelligence?select=id,propertyName,googlePlaceId,signals,antiSignals,sustainabilityScore,placeType&signals=not.is.null`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Supabase query failed: ${res.status} ${await res.text()}`);
  }

  const rows = await res.json();
  return rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    propertyName: row.propertyName as string,
    googlePlaceId: row.googlePlaceId as string,
    signals: (row.signals || []) as EnrichedProperty['signals'],
    antiSignals: (row.antiSignals || []) as EnrichedProperty['antiSignals'],
    sustainabilityScore: row.sustainabilityScore as number | undefined,
    placeType: row.placeType as string | undefined,
  }));
}

// ─── Match Scoring ────────────────────────────────────────────────────────────

/**
 * Score a synthetic user against all properties.
 * Uses taste-match-v3.2 with signal-density weighted profiles, w² alignment,
 * keyword resonance, and anti-keyword penalty.
 *
 * v3.2.2: When `expectedProfile` is provided (from archetype definition), use it
 * directly as the radar profile instead of the LLM-synthesized one. LLM synthesis
 * produces nearly flat profiles (cosine sim 0.95-0.99 between all archetypes),
 * which collapses differentiation. The archetype's expectedProfile has sharp,
 * hand-tuned weights (e.g., budget-backpacker: Design=0.15, Service=0.10).
 *
 * The signal-density enhancement (Step 0) is still applied on top of the
 * expectedProfile, so signal distribution from onboarding still influences scoring.
 */
export function scoreUserAgainstProperties(
  user: SyntheticUserResult,
  properties: EnrichedProperty[],
  userMicroSignals?: Record<string, string[]>,
  expectedProfile?: Record<string, number>,
): PropertyMatch[] {
  // v3.2.2: Prefer archetype's expectedProfile over LLM-synthesized profile.
  // The synthesized profile is nearly flat (all domains 0.85-1.0), which collapses
  // stretch picks (requires profile[domain] < 0.45) and cross-archetype discrimination.
  let userProfile: TasteProfile;

  if (expectedProfile) {
    // Use the sharp, hand-tuned archetype weights
    userProfile = fillDefaults(expectedProfile as Partial<TasteProfile>);
  } else if (user.synthesizedProfile) {
    // Fallback to LLM-synthesized profile
    userProfile = extractTasteProfile(user.synthesizedProfile);
  } else {
    console.warn(`  No profile available for ${user.archetypeId} — skipping`);
    return [];
  }

  // v3.2: Extract signal distribution per domain and rejection keywords
  const userSignalDistribution = extractSignalDistribution(user);
  const userRejectionKeywords = extractRejectionKeywords(user);

  // Build v3.2 match options
  const matchOptions: MatchOptions = {
    applyDecay: false, // synthetic properties don't have real timestamps
    applySourceCredibility: true,
    userMicroSignals,
    userSignalDistribution,
    userRejectionKeywords,
  };

  const rawMatches = properties.map(prop => {
      const matchResult = computeMatchFromSignals(
        prop.signals ?? [],
        prop.antiSignals ?? [],
        userProfile,
        matchOptions,
      );

      // v3: stretch picks determined by score pattern, not profile comparison
      // A property is a stretch pick if it scores well overall but has a contrarian
      // top dimension (one where the user is below median)
      // v3.2.2: With expectedProfile, this actually works — budget-backpacker has
      // Design=0.15, Service=0.10, so properties led by those domains qualify.
      const stretch = matchResult.overallScore >= 55 &&
        (userProfile[matchResult.topDimension] ?? 0.5) < 0.45;

      return {
        propertyId: prop.id,
        propertyName: prop.propertyName,
        overallScore: matchResult.overallScore,
        rawScore: matchResult.overallScore, // preserve raw before normalization
        breakdown: matchResult.breakdown as Record<TasteDomain, number>,
        topDimension: matchResult.topDimension,
        isStretchPick: stretch,
      };
    });

  // v3.2: Curve raw scores into user-friendly display range (top → ~93, bottom → ~35)
  const normalized = normalizeScoresForDisplay(rawMatches);
  return normalized.sort((a, b) => b.overallScore - a.overallScore);
}

/**
 * Extract a flat TasteProfile from a synthesized profile object.
 * Handles both radarData format and flat profile format.
 */
function extractTasteProfile(profile: Record<string, unknown>): TasteProfile {
  // Try radarData first (array of { axis, value })
  const radarData = profile.radarData as Array<{ axis: string; value: number }> | undefined;
  if (radarData?.length) {
    const tp: Partial<TasteProfile> = {};
    for (const { axis, value } of radarData) {
      tp[axis as TasteDomain] = value;
    }
    return fillDefaults(tp);
  }

  // Try flat profile keys
  const domains = ['Design', 'Atmosphere', 'Character', 'Service', 'FoodDrink', 'Setting', 'Wellness', 'Sustainability'];
  const tp: Partial<TasteProfile> = {};
  for (const d of domains) {
    if (typeof profile[d] === 'number') {
      tp[d as TasteDomain] = profile[d] as number;
    }
  }

  return fillDefaults(tp);
}

/**
 * Extract radarData array from synthesized profile for metric functions that expect it.
 */
function extractRadarData(profile: Record<string, unknown>): Array<{ axis: string; value: number }> {
  const radarData = profile.radarData as Array<{ axis: string; value: number }> | undefined;
  if (radarData?.length) return radarData;

  // Build from flat keys
  const domains = ['Design', 'Atmosphere', 'Character', 'Service', 'FoodDrink', 'Setting', 'Wellness', 'Sustainability'];
  return domains.map(d => ({
    axis: d,
    value: typeof profile[d] === 'number' ? profile[d] as number : 0.5,
  }));
}

function fillDefaults(partial: Partial<TasteProfile>): TasteProfile {
  return {
    Design: partial.Design ?? 0.5,
    Atmosphere: partial.Atmosphere ?? 0.5,
    Character: partial.Character ?? 0.5,
    Service: partial.Service ?? 0.5,
    FoodDrink: partial.FoodDrink ?? 0.5,
    Setting: partial.Setting ?? 0.5,
    Wellness: partial.Wellness ?? 0.5,
    Sustainability: partial.Sustainability ?? 0.5,
  };
}

/**
 * Extract micro-signals grouped by domain from the user's accumulated signals.
 * These feed v3's keyword resonance bonus — direct signal name overlap between
 * user and property signals adds points.
 */
function extractMicroSignals(user: SyntheticUserResult): Record<string, string[]> {
  const byDomain: Record<string, string[]> = {};
  for (const sig of user.allSignals) {
    const domain = sig.cat;
    if (!byDomain[domain]) byDomain[domain] = [];
    byDomain[domain].push(sig.tag);
  }
  return byDomain;
}

/**
 * v3.2: Extract signal count per TasteDomain from the user's allSignals.
 * Excludes "Rejection" and "Core" categories which aren't taste domains.
 * This is used to modulate flat radar weights with actual signal density.
 */
function extractSignalDistribution(user: SyntheticUserResult): Record<string, number> {
  const counts: Record<string, number> = {};
  const excludedCats = new Set(['Rejection', 'Core']);

  for (const sig of user.allSignals) {
    if (excludedCats.has(sig.cat)) continue;
    counts[sig.cat] = (counts[sig.cat] || 0) + 1;
  }

  return counts;
}

/**
 * v3.2: Extract rejection keywords from the user's allSignals.
 * Signals with cat === 'Rejection' have tags like "anti-luxury-amenities",
 * "anti-pretentious-service", etc. We extract the tag text for matching
 * against property signal text.
 */
function extractRejectionKeywords(user: SyntheticUserResult): string[] {
  return user.allSignals
    .filter(sig => sig.cat === 'Rejection')
    .map(sig => sig.tag);
}

// ─── Full Evaluation ──────────────────────────────────────────────────────────

/**
 * Run match evaluation for all synthetic users against all properties.
 * Returns per-user reports and cross-archetype analysis.
 */
export function evaluateAllMatches(
  userResults: SyntheticUserResult[],
  archetypes: TasteArchetype[],
  properties: EnrichedProperty[],
  config: SyntheticConfig,
): CrossArchetypeReport {
  const byArchetype: Record<string, UserMatchReport[]> = {};

  // Build archetype lookup
  const archetypeLookup = new Map(archetypes.map(a => [a.id, a]));

  for (const user of userResults) {
    if (!byArchetype[user.archetypeId]) {
      byArchetype[user.archetypeId] = [];
    }

    // v3.2.2: Use archetype's expectedProfile for sharp differentiation
    const archetype = archetypeLookup.get(user.archetypeId);
    const expectedProfile = archetype?.expectedProfile as Record<string, number> | undefined;

    // Extract micro-signals from the user's synthesized profile for keyword resonance
    const userMicroSignals = extractMicroSignals(user);
    const matches = scoreUserAgainstProperties(user, properties, userMicroSignals, expectedProfile);
    const scores = matches.map(m => m.overallScore);
    const distribution = analyzeScoreDistribution(scores, config.thresholds.minScoreSpan);

    // Compute profile deviation if archetype has expected profile
    let profileDeviation: ProfileDeviation | null = null;
    if (archetype?.expectedProfile && user.synthesizedProfile) {
      const radarData = extractRadarData(user.synthesizedProfile);
      profileDeviation = computeProfileDeviation(
        archetype.expectedProfile as unknown as Record<string, number>,
        radarData,
        config.thresholds.maxProfileDeviation,
      );
      profileDeviation.userId = `${user.archetypeId}-v${user.variation.seed}`;
      profileDeviation.archetypeId = user.archetypeId;
    }

    const report: UserMatchReport = {
      archetypeId: user.archetypeId,
      variationSeed: user.variation.seed,
      matches,
      distribution,
      profileDeviation,
    };

    byArchetype[user.archetypeId].push(report);
  }

  // Pairwise cross-archetype discrimination
  const archetypeIds = Object.keys(byArchetype);
  const pairwiseDiscrimination: CrossArchetypeReport['pairwiseDiscrimination'] = [];

  for (let i = 0; i < archetypeIds.length; i++) {
    for (let j = i + 1; j < archetypeIds.length; j++) {
      const aId = archetypeIds[i];
      const bId = archetypeIds[j];
      const aReports = byArchetype[aId];
      const bReports = byArchetype[bId];

      if (aReports.length > 0 && bReports.length > 0) {
        // v3.2.2: Compare using RAW scores (before normalizeScoresForDisplay).
        // Per-user normalization maps each archetype's scores independently to
        // 35-93, which compresses cross-archetype differences. Raw scores preserve
        // the actual scoring differences between archetypes.
        const aScores = aReports[0].matches.map(m => ({ propertyId: m.propertyId, score: m.rawScore }));
        const bScores = bReports[0].matches.map(m => ({ propertyId: m.propertyId, score: m.rawScore }));

        const disc = computeDiscrimination(
          aScores,
          bScores,
          config.thresholds.minCrossArchetypeDiscrimination,
        );

        pairwiseDiscrimination.push({ archetypeA: aId, archetypeB: bId, result: disc });
      }
    }
  }

  // Feed health per archetype (using top 20 matches as simulated feed allocation)
  const feedHealth: Record<string, Omit<FeedHealth, 'userId' | 'archetypeId'>> = {};
  for (const [archetypeId, reports] of Object.entries(byArchetype)) {
    if (reports.length > 0) {
      const topMatches = reports[0].matches.slice(0, 20);

      // Build a simplified feed allocation from top matches
      const allocation: Record<string, any[]> = {
        deepMatch: topMatches.filter(m => !m.isStretchPick).slice(0, 8).map(m => ({
          propertyId: m.propertyId,
          topDimension: m.topDimension,
        })),
        stretchPick: topMatches.filter(m => m.isStretchPick).slice(0, 3).map(m => ({
          propertyId: m.propertyId,
          topDimension: m.topDimension,
        })),
      };

      feedHealth[archetypeId] = analyzeFeedHealth(
        allocation,
        config.thresholds.minFeedSectionsPopulated,
      );
    }
  }

  return { byArchetype, pairwiseDiscrimination, feedHealth };
}

// ─── Vector Cosine Scoring ───────────────────────────────────────────────────
//
// Scores synthetic users against properties using the 400-dim semantic cluster
// vector system (vectors-v3). This is the content-based matching path — it maps
// signals to learned clusters and computes cosine similarity, so two users with
// different signal content will genuinely score differently even on signal-rich
// properties.

/**
 * Compute IDF weights from the property corpus.
 * Must be called once before any vector scoring to weight rare signals higher.
 */
export function computeIdfFromProperties(properties: EnrichedProperty[]): void {
  const signalDocFrequency = new Map<string, number>();
  const totalDocs = properties.length;

  for (const prop of properties) {
    // Collect unique signal texts per property
    const seen = new Set<string>();
    for (const sig of (prop.signals ?? [])) {
      const key = sig.signal.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        signalDocFrequency.set(key, (signalDocFrequency.get(key) ?? 0) + 1);
      }
    }
    for (const sig of (prop.antiSignals ?? [])) {
      const key = sig.signal.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        signalDocFrequency.set(key, (signalDocFrequency.get(key) ?? 0) + 1);
      }
    }
  }

  setIdfWeightsV3(signalDocFrequency, totalDocs);
}

/**
 * Precompute 400-dim embeddings for all properties.
 * Returns a map of propertyId → embedding vector.
 */
export function computePropertyEmbeddings(
  properties: EnrichedProperty[],
): Map<string, number[]> {
  const embeddings = new Map<string, number[]>();

  for (const prop of properties) {
    const embedding = computePropertyEmbeddingV3({
      signals: prop.signals.map(s => ({
        dimension: s.dimension,
        confidence: s.confidence,
        signal: s.signal,
        source_type: s.source_type,
        review_corroborated: s.review_corroborated,
      })),
      antiSignals: prop.antiSignals,
    });
    embeddings.set(prop.id, embedding);
  }

  return embeddings;
}

/**
 * Build a 400-dim user taste vector from synthetic user signals + expectedProfile.
 *
 * CRITICAL: The structured signal generator emits both chosen (0.7) and rejected (0.3)
 * signals from binary A/B choices. If we pass all signals, every archetype activates
 * the same 400-dim clusters (just at different magnitudes), which collapses to near-
 * identical vectors after L2 normalization.
 *
 * Fix: Treat low-confidence signals (≤ 0.35) from A/B choices as rejection signals.
 * These become negative activations in the vector space, pushing the user vector
 * AWAY from those clusters. High-confidence signals (> 0.35) remain positive.
 * This creates genuine directional differences between archetype vectors.
 */
function buildUserVector(
  user: SyntheticUserResult,
  expectedProfile?: Record<string, number>,
): number[] {
  // Build radarData from expectedProfile (or synthesizedProfile fallback)
  const profileSource = expectedProfile
    ?? (user.synthesizedProfile as Record<string, number> | undefined)
    ?? {};

  const radarData: { axis: string; value: number }[] = [];
  const domains = ['Design', 'Atmosphere', 'Character', 'Service', 'FoodDrink', 'Setting', 'Wellness', 'Sustainability'];
  for (const d of domains) {
    radarData.push({ axis: d, value: profileSource[d] ?? 0.5 });
  }

  // Signals now arrive properly categorized from structured-inputs.ts:
  // - Positive signals: cat = domain, confidence 0.4-0.9
  // - Rejection signals: cat = 'Rejection', tag = 'Anti-...', confidence 0.6-0.7
  // No threshold hack needed — just pass them through.

  // Build microTasteSignals from positive signals only
  const microTasteSignals: Record<string, string[]> = {};
  for (const sig of user.allSignals) {
    if (sig.cat === 'Rejection') continue;
    if (!microTasteSignals[sig.cat]) microTasteSignals[sig.cat] = [];
    microTasteSignals[sig.cat].push(sig.tag);
  }

  // computeUserTasteVectorV3 handles cat='Rejection' by creating negative
  // cluster activations at ANTI_SIGNAL_SCALE (0.5×)
  const input: UserVectorInputV3 = {
    radarData,
    microTasteSignals,
    allSignals: user.allSignals,
  };

  return computeUserTasteVectorV3(input);
}

export interface VectorPropertyMatch {
  propertyId: string;
  propertyName: string;
  /** Cosine similarity (0-1), higher = better match */
  cosineSim: number;
  /** Display score mapped to user-friendly range */
  displayScore: number;
}

/**
 * Score a synthetic user against all properties using 400-dim vector cosine similarity.
 *
 * Returns matches sorted by cosine similarity descending.
 */
export function scoreUserAgainstPropertiesVector(
  user: SyntheticUserResult,
  properties: EnrichedProperty[],
  propertyEmbeddings: Map<string, number[]>,
  expectedProfile?: Record<string, number>,
): VectorPropertyMatch[] {
  const userVector = buildUserVector(user, expectedProfile);

  const matches: VectorPropertyMatch[] = [];

  for (const prop of properties) {
    const propVector = propertyEmbeddings.get(prop.id);
    if (!propVector) continue;

    const sim = cosineSimilarityV3(userVector, propVector);

    matches.push({
      propertyId: prop.id,
      propertyName: prop.propertyName,
      cosineSim: sim,
      displayScore: 0, // will be set after normalization
    });
  }

  // Sort by cosine similarity descending
  matches.sort((a, b) => b.cosineSim - a.cosineSim);

  // Map cosine similarity to display range.
  // Typical cosine sims for taste vectors cluster 0.0-0.6 range.
  // We map the actual min-max range to ~35-93 for readability.
  if (matches.length > 0) {
    const maxSim = matches[0].cosineSim;
    const minSim = matches[matches.length - 1].cosineSim;
    const range = maxSim - minSim;

    for (const m of matches) {
      if (range > 0.001) {
        // Linear map: minSim → 35, maxSim → 93
        m.displayScore = 35 + ((m.cosineSim - minSim) / range) * 58;
      } else {
        m.displayScore = 65; // all the same
      }
    }
  }

  return matches;
}

/**
 * Run vector cosine evaluation for all synthetic users against all properties.
 * Returns a CrossArchetypeReport using cosine similarity as the scoring metric.
 */
export function evaluateAllMatchesVector(
  userResults: SyntheticUserResult[],
  archetypes: TasteArchetype[],
  properties: EnrichedProperty[],
  config: SyntheticConfig,
): CrossArchetypeReport {
  // Step 1: Compute IDF weights from property corpus
  console.log('  Computing IDF weights from property corpus...');
  computeIdfFromProperties(properties);

  // Step 2: Precompute all property embeddings
  console.log('  Computing property embeddings (400-dim)...');
  const propertyEmbeddings = computePropertyEmbeddings(properties);
  console.log(`  Computed ${propertyEmbeddings.size} property embeddings\n`);

  // Step 3: Score each user
  const archetypeLookup = new Map(archetypes.map(a => [a.id, a]));
  const byArchetype: Record<string, UserMatchReport[]> = {};

  for (const user of userResults) {
    if (!byArchetype[user.archetypeId]) {
      byArchetype[user.archetypeId] = [];
    }

    const archetype = archetypeLookup.get(user.archetypeId);
    const expectedProfile = archetype?.expectedProfile as Record<string, number> | undefined;

    const vectorMatches = scoreUserAgainstPropertiesVector(
      user, properties, propertyEmbeddings, expectedProfile,
    );

    // Convert VectorPropertyMatch → PropertyMatch for compatibility with report generator
    const matches: PropertyMatch[] = vectorMatches.map(vm => ({
      propertyId: vm.propertyId,
      propertyName: vm.propertyName,
      overallScore: vm.displayScore,
      rawScore: vm.cosineSim * 100, // scale cosine to 0-100 for cross-archetype comparison
      breakdown: {} as Record<TasteDomain, number>, // no domain breakdown in vector mode
      topDimension: 'Design' as TasteDomain, // placeholder — not meaningful in vector mode
      isStretchPick: false, // not applicable in vector mode
    }));

    const scores = matches.map(m => m.overallScore);
    const distribution = analyzeScoreDistribution(scores, config.thresholds.minScoreSpan);

    // Profile deviation (still meaningful — compares archetype expected vs synthesized)
    let profileDeviation: ProfileDeviation | null = null;
    if (archetype?.expectedProfile && user.synthesizedProfile) {
      const radarData = extractRadarDataForVector(user.synthesizedProfile);
      profileDeviation = computeProfileDeviation(
        archetype.expectedProfile as unknown as Record<string, number>,
        radarData,
        config.thresholds.maxProfileDeviation,
      );
      profileDeviation.userId = `${user.archetypeId}-v${user.variation.seed}`;
      profileDeviation.archetypeId = user.archetypeId;
    }

    byArchetype[user.archetypeId].push({
      archetypeId: user.archetypeId,
      variationSeed: user.variation.seed,
      matches,
      distribution,
      profileDeviation,
    });
  }

  // Step 4: Pairwise cross-archetype discrimination (using raw cosine × 100)
  const archetypeIds = Object.keys(byArchetype);
  const pairwiseDiscrimination: CrossArchetypeReport['pairwiseDiscrimination'] = [];

  for (let i = 0; i < archetypeIds.length; i++) {
    for (let j = i + 1; j < archetypeIds.length; j++) {
      const aId = archetypeIds[i];
      const bId = archetypeIds[j];
      const aReports = byArchetype[aId];
      const bReports = byArchetype[bId];

      if (aReports.length > 0 && bReports.length > 0) {
        const aScores = aReports[0].matches.map(m => ({ propertyId: m.propertyId, score: m.rawScore }));
        const bScores = bReports[0].matches.map(m => ({ propertyId: m.propertyId, score: m.rawScore }));

        const disc = computeDiscrimination(
          aScores, bScores,
          config.thresholds.minCrossArchetypeDiscrimination,
        );

        pairwiseDiscrimination.push({ archetypeA: aId, archetypeB: bId, result: disc });
      }
    }
  }

  // Step 5: Feed health per archetype
  const feedHealth: Record<string, Omit<FeedHealth, 'userId' | 'archetypeId'>> = {};
  for (const [archetypeId, reports] of Object.entries(byArchetype)) {
    if (reports.length > 0) {
      const topMatches = reports[0].matches.slice(0, 20);
      const allocation: Record<string, any[]> = {
        deepMatch: topMatches.slice(0, 8).map(m => ({
          propertyId: m.propertyId,
          topDimension: m.topDimension,
        })),
        stretchPick: [],
      };
      feedHealth[archetypeId] = analyzeFeedHealth(
        allocation,
        config.thresholds.minFeedSectionsPopulated,
      );
    }
  }

  return { byArchetype, pairwiseDiscrimination, feedHealth };
}

/** Helper to extract radarData from a synthesized profile */
function extractRadarDataForVector(profile: Record<string, unknown>): Array<{ axis: string; value: number }> {
  const radarData = profile.radarData as Array<{ axis: string; value: number }> | undefined;
  if (radarData?.length) return radarData;

  const domains = ['Design', 'Atmosphere', 'Character', 'Service', 'FoodDrink', 'Setting', 'Wellness', 'Sustainability'];
  return domains.map(d => ({
    axis: d,
    value: typeof profile[d] === 'number' ? profile[d] as number : 0.5,
  }));
}
