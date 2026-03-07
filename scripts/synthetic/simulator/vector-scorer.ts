/**
 * Vector Scorer — Wraps production vectors-v3 for the synthetic pipeline.
 *
 * No new math: calls computeUserTasteVectorV3, computePropertyEmbeddingV3,
 * setIdfWeightsV3, and cosineSimilarityV3 directly.
 */

import {
  computeUserTasteVectorV3,
  computePropertyEmbeddingV3,
  cosineSimilarityV3,
  setIdfWeightsV3,
  type UserVectorInputV3,
  type PropertyEmbeddingInputV3,
} from '../../../src/lib/taste-intelligence/vectors-v3';
import type { TasteSignal } from '../../../src/types';
import type { TasteArchetype } from '../archetypes';

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
  }>;
  antiSignals: Array<{
    dimension: string;
    confidence: number;
    signal: string;
  }>;
  sustainabilityScore?: number;
  placeType?: string;
}

export interface VectorMatch {
  propertyId: string;
  propertyName: string;
  similarity: number;
  rank: number;
}

export interface ScoringResult {
  archetypeVectors: Map<string, number[]>;
  propertyVectors: Map<string, number[]>;
  matchesByArchetype: Map<string, VectorMatch[]>;
}

// ─── IDF Computation ──────────────────────────────────────────────────────────

function computeAndSetIdf(properties: EnrichedProperty[]): void {
  const docFreq = new Map<string, number>();
  for (const prop of properties) {
    const seen = new Set<string>();
    for (const sig of prop.signals) {
      const key = sig.signal.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        docFreq.set(key, (docFreq.get(key) || 0) + 1);
      }
    }
  }
  setIdfWeightsV3(docFreq, properties.length);
}

// ─── Property Embedding ───────────────────────────────────────────────────────

function buildPropertyVector(property: EnrichedProperty): number[] {
  const input: PropertyEmbeddingInputV3 = {
    signals: property.signals,
    antiSignals: property.antiSignals,
  };
  return computePropertyEmbeddingV3(input);
}

// ─── Archetype → User Vector ─────────────────────────────────────────────────

function buildArchetypeVector(
  archetype: TasteArchetype,
  signals: TasteSignal[],
): number[] {
  // radarData from expectedProfile (domain scores 0-1 → used as domain weights)
  const radarData: { axis: string; value: number }[] = [];
  const profile = archetype.expectedProfile as Record<string, number>;
  for (const [domain, value] of Object.entries(profile)) {
    radarData.push({ axis: domain, value });
  }

  // microTasteSignals from archetype.microSignals (per-domain tag lists)
  const microTasteSignals: Record<string, string[]> = {};
  const micro = archetype.microSignals as Record<string, string[]> | undefined;
  if (micro) {
    for (const [domain, tags] of Object.entries(micro)) {
      microTasteSignals[domain] = tags;
    }
  }

  const input: UserVectorInputV3 = {
    radarData,
    microTasteSignals,
    allSignals: signals,
  };

  return computeUserTasteVectorV3(input);
}

// ─── Main Scoring ─────────────────────────────────────────────────────────────

export function scoreAllArchetypes(
  archetypes: TasteArchetype[],
  signalMap: Map<string, TasteSignal[]>,
  properties: EnrichedProperty[],
): ScoringResult {
  // 1. Set IDF weights
  console.log('  Computing IDF weights from property corpus...');
  computeAndSetIdf(properties);

  // 2. Build property vectors
  console.log(`  Computing ${properties.length} property embeddings (400-dim)...`);
  const propertyVectors = new Map<string, number[]>();
  for (const prop of properties) {
    propertyVectors.set(prop.id, buildPropertyVector(prop));
  }

  // 3. Build archetype vectors and score against all properties
  console.log(`  Scoring ${archetypes.length} archetypes × ${properties.length} properties...`);
  const archetypeVectors = new Map<string, number[]>();
  const matchesByArchetype = new Map<string, VectorMatch[]>();

  for (const arch of archetypes) {
    const signals = signalMap.get(arch.id) || [];
    const userVec = buildArchetypeVector(arch, signals);
    archetypeVectors.set(arch.id, userVec);

    // Score against all properties
    const matches: VectorMatch[] = [];
    for (const prop of properties) {
      const propVec = propertyVectors.get(prop.id)!;
      const sim = cosineSimilarityV3(userVec, propVec);
      matches.push({
        propertyId: prop.id,
        propertyName: prop.propertyName,
        similarity: sim,
        rank: 0, // will fill below
      });
    }

    // Sort by similarity descending, assign ranks
    matches.sort((a, b) => b.similarity - a.similarity);
    matches.forEach((m, i) => { m.rank = i + 1; });

    matchesByArchetype.set(arch.id, matches);
  }

  return { archetypeVectors, propertyVectors, matchesByArchetype };
}
