/**
 * Taste Intelligence — Vector Computation
 *
 * Converts user taste profiles and property signals into 32-dimensional vectors
 * that live in the same embedding space, enabling direct cosine similarity.
 *
 * Vector layout (32 dimensions):
 *   [0-5]   : 6 core taste domains (Design, Character, Service, Food, Location, Wellness)
 *   [6-31]  : 26 semantic signal hash features (signal text → deterministic bucket)
 *
 * TG-04: User taste vector from radarData + micro-signals
 * PE-02: Property embedding from PlaceIntelligence signals
 */

import type { TasteDomain, TasteProfile, BriefingSignal, GeneratedTasteProfile } from '@/types';
import { DIMENSION_TO_DOMAIN } from '@/types';

const VECTOR_DIM = 32;
const DOMAIN_DIMS = 6;     // indices 0-5
const SIGNAL_DIMS = 26;    // indices 6-31

const DOMAIN_INDEX: Record<TasteDomain, number> = {
  Design: 0,
  Character: 1,
  Service: 2,
  Food: 3,
  Location: 4,
  Wellness: 5,
};

const ALL_DOMAINS: TasteDomain[] = ['Design', 'Character', 'Service', 'Food', 'Location', 'Wellness'];

// ─── Deterministic signal hashing ────────────────────────────────────────────

/**
 * Hash a signal string into a bucket index [0, SIGNAL_DIMS).
 * Uses a simple but effective FNV-1a-inspired hash for determinism.
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
 * Build the signal feature portion of a vector (dimensions 6-31).
 * Each signal contributes its confidence to its hashed bucket.
 * Multiple signals can map to the same bucket (accumulates).
 * Final values are normalized to [0, 1].
 */
function buildSignalFeatures(signals: Array<{ text: string; confidence: number }>): number[] {
  const features = new Array(SIGNAL_DIMS).fill(0);
  const counts = new Array(SIGNAL_DIMS).fill(0);

  for (const { text, confidence } of signals) {
    const bucket = hashSignalToBucket(text);
    features[bucket] += confidence;
    counts[bucket] += 1;
  }

  // Normalize: average confidence per bucket, capped at 1.0
  for (let i = 0; i < SIGNAL_DIMS; i++) {
    if (counts[i] > 0) {
      features[i] = Math.min(features[i] / counts[i], 1.0);
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

// ─── User Taste Vector (TG-04) ──────────────────────────────────────────────

export interface UserVectorInput {
  /** 6-axis radar data from onboarding (axis → 0-1 value) */
  radarData: { axis: string; value: number }[];
  /** Micro-signals per domain from GeneratedTasteProfile */
  microTasteSignals: Record<string, string[]>;
  /** Optional: all extracted signals with confidence */
  allSignals?: Array<{ tag: string; cat: string; confidence: number }>;
}

/**
 * Compute a 32-dimensional taste vector for a user.
 *
 * Combines:
 * - radarData (mapped to 6 domain dimensions)
 * - microTasteSignals (hashed into 26 feature dimensions)
 * - allSignals confidence (if available, to boost signal features)
 */
export function computeUserTasteVector(input: UserVectorInput): number[] {
  const vector = new Array(VECTOR_DIM).fill(0);

  // Dimensions 0-5: radar axes mapped to domains
  // radarData axes use various names; map them to domains
  const axisToIndex: Record<string, number> = {
    design: 0, 'design language': 0,
    character: 1, 'character & identity': 1, 'scale & intimacy': 1,
    service: 2, 'service philosophy': 2,
    food: 3, 'food & drink': 3, 'food & drink identity': 3,
    location: 4, 'location & context': 4, 'location & setting': 4,
    wellness: 5, 'wellness & body': 5,
  };

  for (const { axis, value } of input.radarData) {
    const idx = axisToIndex[axis.toLowerCase()];
    if (idx !== undefined) {
      vector[idx] = Math.max(vector[idx], value); // take highest if duplicates
    }
  }

  // Dimensions 6-31: micro-signal hash features
  const signalInputs: Array<{ text: string; confidence: number }> = [];

  for (const [domain, signals] of Object.entries(input.microTasteSignals)) {
    for (const sig of signals) {
      // Use domain weight as base confidence for micro-signals
      const domainIdx = DOMAIN_INDEX[domain as TasteDomain];
      const domainWeight = domainIdx !== undefined ? vector[domainIdx] : 0.5;
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

  const signalFeatures = buildSignalFeatures(signalInputs);
  for (let i = 0; i < SIGNAL_DIMS; i++) {
    vector[DOMAIN_DIMS + i] = signalFeatures[i];
  }

  return l2Normalize(vector);
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
 * Compute a 32-dimensional embedding for a property.
 *
 * Lives in the same vector space as user taste vectors, enabling
 * direct cosine similarity for user-to-property matching.
 *
 * Dimensions 0-5: domain strength (signal density × confidence per domain)
 * Dimensions 6-31: signal text hash features (same hashing as user vectors)
 */
export function computePropertyEmbedding(input: PropertyEmbeddingInput): number[] {
  const vector = new Array(VECTOR_DIM).fill(0);
  const { signals, antiSignals = [] } = input;

  // Dimensions 0-5: per-domain strength from signals
  const domainSignals: Record<TasteDomain, BriefingSignal[]> = {
    Design: [], Character: [], Service: [], Food: [], Location: [], Wellness: [],
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
    // 60% confidence, 40% density — matches taste-match.ts scoring
    vector[DOMAIN_INDEX[domain]] = avgConf * 0.6 + density * 0.4;
  }

  // Apply anti-signal penalties to domain dimensions
  for (const anti of antiSignals) {
    const domain = DIMENSION_TO_DOMAIN[anti.dimension];
    if (domain) {
      const idx = DOMAIN_INDEX[domain];
      vector[idx] = Math.max(0, vector[idx] - anti.confidence * 0.1);
    }
  }

  // Dimensions 6-31: signal text hash features
  const signalInputs = signals.map((s) => ({
    text: s.signal,
    confidence: s.confidence,
  }));

  const signalFeatures = buildSignalFeatures(signalInputs);
  for (let i = 0; i < SIGNAL_DIMS; i++) {
    vector[DOMAIN_DIMS + i] = signalFeatures[i];
  }

  return l2Normalize(vector);
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
  // Map [-1, 1] → [0, 100] with emphasis on the useful range
  // similarity of 0.5 → ~50, 0.8 → ~85, 0.3 → ~30
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

export { VECTOR_DIM, DOMAIN_INDEX, ALL_DOMAINS };
