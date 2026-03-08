/**
 * @deprecated v2.1 vectors replaced by V3 (400-dim semantic clusters) in v4 architecture.
 * This file is preserved for reference only. Use vectors-v3.ts for all new code.
 *
 * Taste Intelligence — Vector Computation (v2.1: High-Res Vectors)
 *
 * Converts user taste profiles and property signals into 136-dimensional vectors
 * that live in the same embedding space, enabling direct cosine similarity.
 *
 * v2.1 improvements over v2.0 (34-dim):
 *   1. 128 hash buckets (was 26) — dramatically reduces signal collision
 *   2. Independent normalization — domain dims guaranteed 30% of similarity
 *   3. IDF weighting — rare signals count more than common ones
 *
 * Vector layout (136 dimensions):
 *   [0-7]     : 8 taste domains (Design, Atmosphere, Character, Service, FoodDrink, Setting, Wellness, Sustainability)
 *   [8-135]   : 128 signal hash features (signal text → deterministic bucket, IDF-weighted)
 *
 * TG-04: User taste vector from radarData + micro-signals
 * PE-02: Property embedding from PlaceIntelligence signals
 */

import type { TasteDomain, TasteProfile, BriefingSignal, GeneratedTasteProfile } from '@/types';
import { DIMENSION_TO_DOMAIN, ALL_TASTE_DOMAINS } from '@/types';

// ─── Vector dimensions ──────────────────────────────────────────────────────

const VECTOR_DIM = 136;
const DOMAIN_DIMS = 8;      // indices 0-7
const SIGNAL_DIMS = 128;    // indices 8-135

/** Weight of domain dims in final vector (signal dims get 1 - this) */
const DOMAIN_WEIGHT = 0.30;
const SIGNAL_WEIGHT = 1.0 - DOMAIN_WEIGHT;

const DOMAIN_INDEX: Record<TasteDomain, number> = {
  Design: 0,
  Atmosphere: 1,
  Character: 2,
  Service: 3,
  FoodDrink: 4,
  Setting: 5,
  Wellness: 6,
  Sustainability: 7,
};

const ALL_DOMAINS: TasteDomain[] = ALL_TASTE_DOMAINS;

// ─── IDF (Inverse Document Frequency) ────────────────────────────────────────

/**
 * IDF weights per signal text, computed from the corpus of all properties.
 * Set once via setIdfWeights() before computing vectors.
 *
 * IDF(signal) = log(N / df(signal)) where:
 *   N = total properties in corpus
 *   df(signal) = number of properties containing that signal
 *
 * Falls back to 1.0 if not set (backward compatible).
 */
let idfWeights: Map<string, number> | null = null;
let corpusSize: number = 0;

/**
 * Set IDF weights from a pre-computed map of signal → document frequency.
 * Call this once before running backfill.
 */
export function setIdfWeights(signalDocFrequency: Map<string, number>, totalDocs: number): void {
  idfWeights = new Map();
  corpusSize = totalDocs;
  for (const [signal, df] of signalDocFrequency.entries()) {
    // Smoothed IDF: log(1 + N/df) to avoid extreme values
    const idf = Math.log(1 + totalDocs / Math.max(df, 1));
    idfWeights.set(signal.toLowerCase().trim(), idf);
  }
}

/**
 * Get IDF weight for a signal. Returns 1.0 if IDF not initialized.
 */
function getIdfWeight(signalText: string): number {
  if (!idfWeights) return 1.0;
  const normalized = signalText.toLowerCase().trim();
  return idfWeights.get(normalized) ?? Math.log(1 + corpusSize); // unseen signal gets max IDF
}

/**
 * Clear IDF weights (for testing).
 */
export function clearIdfWeights(): void {
  idfWeights = null;
  corpusSize = 0;
}

// ─── Deterministic signal hashing ────────────────────────────────────────────

/**
 * Hash a signal string into a bucket index [0, SIGNAL_DIMS).
 * Uses FNV-1a hash for determinism and good distribution.
 */
function hashSignalToBucket(signal: string): number {
  const normalized = signal.toLowerCase().trim();
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime, keep as uint32
  }
  return hash % SIGNAL_DIMS;
}

/**
 * Build the signal feature portion of a vector (128 dimensions).
 * Each signal contributes its IDF-weighted confidence to its hashed bucket.
 * Multiple signals can map to the same bucket (accumulates weighted average).
 */
function buildSignalFeatures(signals: Array<{ text: string; confidence: number }>): number[] {
  const features = new Array(SIGNAL_DIMS).fill(0);
  const totalWeights = new Array(SIGNAL_DIMS).fill(0);

  for (const { text, confidence } of signals) {
    const bucket = hashSignalToBucket(text);
    const idf = getIdfWeight(text);
    const weightedConfidence = confidence * idf;
    features[bucket] += weightedConfidence;
    totalWeights[bucket] += idf;
  }

  // Normalize: weighted average per bucket, capped at max IDF value
  for (let i = 0; i < SIGNAL_DIMS; i++) {
    if (totalWeights[i] > 0) {
      features[i] = features[i] / totalWeights[i];
      // Cap at 1.0 — the IDF weighting changes relative importance between buckets,
      // but each bucket's value should still be in [0, 1]
      features[i] = Math.min(features[i], 1.0);
    }
  }

  return features;
}

// ─── L2 normalization ────────────────────────────────────────────────────────

/**
 * L2-normalize a vector so cosine similarity becomes a dot product.
 * Returns zero vector if input is zero.
 */
function l2Normalize(vec: number[]): number[] {
  const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (magnitude === 0) return vec;
  return vec.map((v) => v / magnitude);
}

// ─── Independent normalization + weighting ───────────────────────────────────

/**
 * Normalize domain and signal portions independently, then combine with weights.
 * This ensures domain dims always contribute DOMAIN_WEIGHT (30%) of similarity
 * regardless of how many signal dims there are.
 *
 * final = concat(DOMAIN_WEIGHT × L2norm(domains), SIGNAL_WEIGHT × L2norm(signals))
 * Then L2-normalize the combined vector.
 */
function normalizeWithWeighting(domainDims: number[], signalDims: number[]): number[] {
  const normDomains = l2Normalize(domainDims);
  const normSignals = l2Normalize(signalDims);

  const weighted = [
    ...normDomains.map((v) => v * DOMAIN_WEIGHT),
    ...normSignals.map((v) => v * SIGNAL_WEIGHT),
  ];

  return l2Normalize(weighted);
}

// ─── User Taste Vector (TG-04) ──────────────────────────────────────────────

export interface UserVectorInput {
  /** 8-axis radar data from onboarding (axis → 0-1 value) */
  radarData: { axis: string; value: number }[];
  /** Micro-signals per domain from GeneratedTasteProfile */
  microTasteSignals: Record<string, string[]>;
  /** Optional: all extracted signals with confidence */
  allSignals?: Array<{ tag: string; cat: string; confidence: number }>;
}

/**
 * Compute a 136-dimensional taste vector for a user.
 *
 * Combines:
 * - radarData (mapped to 8 domain dimensions, independently normalized)
 * - microTasteSignals + allSignals (hashed into 128 IDF-weighted features, independently normalized)
 * - Domain and signal portions weighted 30/70 to guarantee domain dims matter
 */
export function computeUserTasteVector(input: UserVectorInput): number[] {
  const domainDims = new Array(DOMAIN_DIMS).fill(0);

  // Dimensions 0-7: radar axes mapped to domains
  const axisToIndex: Record<string, number> = {
    design: 0, 'design language': 0,
    atmosphere: 1, 'sensory environment': 1,
    character: 2, 'character & identity': 2,
    service: 3, 'service philosophy': 3,
    fooddrink: 4, 'food & drink': 4, 'food & drink identity': 4, food: 4,
    setting: 5, 'location & context': 5, 'location & setting': 5, location: 5,
    wellness: 6, 'wellness & body': 6,
    sustainability: 7,
  };

  for (const { axis, value } of input.radarData) {
    const idx = axisToIndex[axis.toLowerCase()];
    if (idx !== undefined) {
      domainDims[idx] = Math.max(domainDims[idx], value);
    }
  }

  // Signal hash features
  const signalInputs: Array<{ text: string; confidence: number }> = [];

  const signalCategoryToDomain: Record<string, TasteDomain> = {
    architectural_attraction: 'Design',
    material_obsessions: 'Design',
    social_dynamics: 'Character',
    service_ideals: 'Service',
    cultural_indicators: 'Character',
    spatial_preferences: 'Setting',
    wellness_essentials: 'Wellness',
    rejection_signals: 'Character',
  };

  for (const [domain, signals] of Object.entries(input.microTasteSignals)) {
    for (const sig of signals) {
      const resolvedDomain = signalCategoryToDomain[domain] || (domain as TasteDomain);
      const domainIdx = DOMAIN_INDEX[resolvedDomain];
      const domainWeight = domainIdx !== undefined ? domainDims[domainIdx] : 0.5;
      signalInputs.push({ text: sig, confidence: domainWeight });
    }
  }

  // Also hash allSignals if available (with their native confidence)
  if (input.allSignals) {
    for (const sig of input.allSignals) {
      if (sig.cat !== 'Rejection' && sig.cat !== 'Context') {
        signalInputs.push({ text: sig.tag, confidence: sig.confidence });
      }
    }
  }

  const signalDims = buildSignalFeatures(signalInputs);

  return normalizeWithWeighting(domainDims, signalDims);
}

/**
 * Convenience: compute user vector from a full GeneratedTasteProfile + allSignals.
 */
export function computeUserVectorFromProfile(
  profile: GeneratedTasteProfile,
  allSignals?: Array<{ tag: string; cat: string; confidence: number }>
): number[] {
  return computeUserTasteVector({
    radarData: profile.radarData || [],
    microTasteSignals: profile.microTasteSignals || {},
    allSignals,
  });
}

// ─── Property Embedding (PE-02) ─────────────────────────────────────────────

export interface PropertyEmbeddingInput {
  /** Pipeline signals from PlaceIntelligence.signals */
  signals: BriefingSignal[];
  /** Pipeline anti-signals from PlaceIntelligence.antiSignals */
  antiSignals?: Array<{ dimension: string; confidence: number; signal: string }>;
}

/**
 * Compute a 136-dimensional embedding for a property.
 *
 * Lives in the same vector space as user taste vectors, enabling
 * direct cosine similarity for user-to-property matching.
 *
 * Dimensions 0-7: domain strength (signal density × confidence per domain)
 * Dimensions 8-135: IDF-weighted signal text hash features
 */
export function computePropertyEmbedding(input: PropertyEmbeddingInput): number[] {
  const domainDims = new Array(DOMAIN_DIMS).fill(0);
  const { signals, antiSignals = [] } = input;

  // Dimensions 0-7: per-domain strength from signals
  const domainSignals: Record<TasteDomain, BriefingSignal[]> = {
    Design: [], Atmosphere: [], Character: [], Service: [], FoodDrink: [], Setting: [], Wellness: [], Sustainability: [],
  };

  for (const sig of signals) {
    const domain = DIMENSION_TO_DOMAIN[sig.dimension];
    if (domain) {
      domainSignals[domain].push(sig);
    }
  }

  for (const domain of ALL_DOMAINS) {
    const sigs = domainSignals[domain];
    if (sigs.length === 0) continue;

    const avgConf = sigs.reduce((sum, s) => {
      const boost = s.review_corroborated ? 0.05 : 0;
      return sum + Math.min(s.confidence + boost, 1.0);
    }, 0) / sigs.length;

    const density = Math.min(sigs.length / 20, 1.0);
    domainDims[DOMAIN_INDEX[domain]] = avgConf * 0.6 + density * 0.4;
  }

  // Apply anti-signal penalties to domain dimensions
  for (const anti of antiSignals) {
    const domain = DIMENSION_TO_DOMAIN[anti.dimension];
    if (domain) {
      const idx = DOMAIN_INDEX[domain];
      domainDims[idx] = Math.max(0, domainDims[idx] - anti.confidence * 0.1);
    }
  }

  // Signal text hash features (IDF-weighted)
  const signalInputs = signals.map((s) => ({
    text: s.signal,
    confidence: s.confidence,
  }));

  const signalDims = buildSignalFeatures(signalInputs);

  return normalizeWithWeighting(domainDims, signalDims);
}

// ─── Similarity ─────────────────────────────────────────────────────────────

/**
 * Compute cosine similarity between two vectors (both should be L2-normalized).
 * Returns value in [-1, 1], where 1 = identical, 0 = orthogonal, -1 = opposite.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

/**
 * Convert cosine similarity [-1, 1] to a 0-100 match score.
 * Uses a sigmoid-like mapping that emphasizes differences in the 0.3-0.8 range.
 */
export function similarityToScore(similarity: number): number {
  const score = Math.round(((similarity + 1) / 2) * 100);
  return Math.max(0, Math.min(100, score));
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/** Format a vector as a Postgres-compatible string: '[0.1, 0.2, ...]' */
export function vectorToSql(vec: number[]): string {
  return '[' + vec.map((v) => v.toFixed(8)).join(',') + ']';
}

/** Parse a Postgres vector string back to a number array */
export function sqlToVector(sql: string): number[] {
  return sql.replace(/[\[\]]/g, '').split(',').map(Number);
}

export { VECTOR_DIM, SIGNAL_DIMS, DOMAIN_DIMS, DOMAIN_WEIGHT, SIGNAL_WEIGHT, DOMAIN_INDEX, ALL_DOMAINS, hashSignalToBucket };
