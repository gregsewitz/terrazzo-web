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

import { computeMatchFromSignals } from '../../../src/lib/taste-match-v3';
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
 * Uses taste-match-v3 with geometric mean, no neutral floor, and keyword resonance.
 */
export function scoreUserAgainstProperties(
  user: SyntheticUserResult,
  properties: EnrichedProperty[],
  userMicroSignals?: Record<string, string[]>,
): PropertyMatch[] {
  // Extract the user's taste profile from synthesized profile
  const profile = user.synthesizedProfile;
  if (!profile) {
    console.warn(`  No synthesized profile for ${user.archetypeId} — using expected profile from archetype`);
    return [];
  }

  // Build TasteProfile from synthesized radarData or flat profile
  const userProfile = extractTasteProfile(profile);

  // Build v3 match options with keyword resonance
  const matchOptions: MatchOptions = {
    applyDecay: false, // synthetic properties don't have real timestamps
    applySourceCredibility: true,
    userMicroSignals,
  };

  return properties
    .filter(prop => (prop.signals?.length ?? 0) > 0) // skip properties with no signals
    .map(prop => {
      const matchResult = computeMatchFromSignals(
        prop.signals || [],
        prop.antiSignals || [],
        userProfile,
        matchOptions,
      );

      // v3: stretch picks determined by score pattern, not profile comparison
      // A property is a stretch pick if it scores well overall but has a contrarian
      // top dimension (one where the user is below median)
      const stretch = matchResult.overallScore >= 55 &&
        (userProfile[matchResult.topDimension] ?? 0.5) < 0.45;

      return {
        propertyId: prop.id,
        propertyName: prop.propertyName,
        overallScore: matchResult.overallScore,
        breakdown: matchResult.breakdown as Record<TasteDomain, number>,
        topDimension: matchResult.topDimension,
        isStretchPick: stretch,
      };
    }).sort((a, b) => b.overallScore - a.overallScore);
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

    // Extract micro-signals from the user's synthesized profile for keyword resonance
    const userMicroSignals = extractMicroSignals(user);
    const matches = scoreUserAgainstProperties(user, properties, userMicroSignals);
    const scores = matches.map(m => m.overallScore);
    const distribution = analyzeScoreDistribution(scores, config.thresholds.minScoreSpan);

    // Compute profile deviation if archetype has expected profile
    const archetype = archetypeLookup.get(user.archetypeId);
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
        // Compare first variation of each
        const aScores = aReports[0].matches.map(m => ({ propertyId: m.propertyId, score: m.overallScore }));
        const bScores = bReports[0].matches.map(m => ({ propertyId: m.propertyId, score: m.overallScore }));

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
