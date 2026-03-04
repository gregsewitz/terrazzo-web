/**
 * Taste Intelligence — Vector Computation (v3: Semantic Clustering)
 *
 * Identical to v2.1 except signal dimensions use learned semantic clusters
 * instead of random FNV-1a hashing. Each of the 96 signal dimensions
 * represents a meaningful taste concept (e.g., "Nordic Design", "Wellness Rituals").
 *
 * Vector layout (104 dimensions):
 *   [0-7]    : 8 taste domains (same as v2.1)
 *   [8-103]  : 96 semantic cluster features (signal → cluster lookup, IDF-weighted)
 *
 * The only difference from v2.1 is how signals map to dimensions:
 *   v2.1: hashSignalToBucket(signal) → FNV-1a hash % 128
 *   v3:   lookupSignalCluster(signal) → JSON mapping from K-means clusters
 */

import type { TasteDomain, TasteProfile, BriefingSignal, GeneratedTasteProfile } from '@/types';
import { DIMENSION_TO_DOMAIN, ALL_TASTE_DOMAINS } from '@/types';
import clusterMap from './signal-clusters.json';

// ─── Vector dimensions ──────────────────────────────────────────────────────

export const VECTOR_DIM_V3 = 104;
const DOMAIN_DIMS = 8;
const SIGNAL_DIMS_V3 = 96;

const DOMAIN_WEIGHT = 0.30;
const SIGNAL_WEIGHT = 1.0 - DOMAIN_WEIGHT;

const DOMAIN_INDEX: Record<TasteDomain, number> = {
  Design: 0, Atmosphere: 1, Character: 2, Service: 3,
  FoodDrink: 4, Setting: 5, Wellness: 6, Sustainability: 7,
};

const ALL_DOMAINS: TasteDomain[] = ALL_TASTE_DOMAINS;

// ─── IDF (shared with v2.1) ─────────────────────────────────────────────────

let idfWeights: Map<string, number> | null = null;
let corpusSize: number = 0;

export function setIdfWeightsV3(signalDocFrequency: Map<string, number>, totalDocs: number): void {
  idfWeights = new Map();
  corpusSize = totalDocs;
  for (const [signal, df] of signalDocFrequency.entries()) {
    const idf = Math.log(1 + totalDocs / Math.max(df, 1));
    idfWeights.set(signal.toLowerCase().trim(), idf);
  }
}

function getIdfWeight(signalText: string): number {
  if (!idfWeights) return 1.0;
  const normalized = signalText.toLowerCase().trim();
  return idfWeights.get(normalized) ?? Math.log(1 + corpusSize);
}

export function clearIdfWeightsV3(): void {
  idfWeights = null;
  corpusSize = 0;
}

// ─── Semantic cluster lookup ────────────────────────────────────────────────

const signalToCluster: Record<string, number> = (clusterMap as any).signalToCluster;
const clusterInfo: Record<string, { label: string; domain?: string; topSignals: string[] }> =
  (clusterMap as any).clusters;

/**
 * Look up which semantic cluster a signal belongs to.
 * Falls back to word-overlap matching with cluster top signals for unseen signals.
 */
export function lookupSignalCluster(signal: string): number {
  const normalized = signal.toLowerCase().trim();

  // Direct lookup (covers all ~3,300 signals in the clustering corpus)
  const directMatch = signalToCluster[normalized];
  if (directMatch !== undefined) return directMatch;

  // Fallback: find the cluster whose top signals share the most words
  const signalWords = new Set(normalized.replace(/-/g, ' ').replace(/_/g, ' ').split(/\s+/));

  let bestCluster = 0;
  let bestOverlap = -1;

  for (const [cidStr, info] of Object.entries(clusterInfo)) {
    const cid = parseInt(cidStr, 10);
    let overlap = 0;

    for (const topSig of info.topSignals.slice(0, 10)) {
      const topWords = topSig.replace(/-/g, ' ').replace(/_/g, ' ').split(/\s+/);
      for (const w of topWords) {
        if (w.length > 3 && signalWords.has(w)) {
          overlap++;
        }
      }
    }

    // Bonus: if the cluster's domain matches signal words
    if (info.domain) {
      const domainLower = info.domain.toLowerCase();
      if (signalWords.has(domainLower)) overlap += 2;
    }

    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestCluster = cid;
    }
  }

  return bestCluster;
}

// ─── Signal features (same as v2.1, but using cluster lookup) ───────────────

function buildSignalFeaturesV3(signals: Array<{ text: string; confidence: number }>): number[] {
  const features = new Array(SIGNAL_DIMS_V3).fill(0);
  const totalWeights = new Array(SIGNAL_DIMS_V3).fill(0);

  for (const { text, confidence } of signals) {
    const bucket = lookupSignalCluster(text);
    const idf = getIdfWeight(text);
    const weightedConfidence = confidence * idf;
    features[bucket] += weightedConfidence;
    totalWeights[bucket] += idf;
  }

  for (let i = 0; i < SIGNAL_DIMS_V3; i++) {
    if (totalWeights[i] > 0) {
      features[i] = features[i] / totalWeights[i];
      features[i] = Math.min(features[i], 1.0);
    }
  }

  return features;
}

// ─── L2 normalization ────────────────────────────────────────────────────────

function l2Normalize(vec: number[]): number[] {
  const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (magnitude === 0) return vec;
  return vec.map((v) => v / magnitude);
}

function normalizeWithWeighting(domainDims: number[], signalDims: number[]): number[] {
  const normDomains = l2Normalize(domainDims);
  const normSignals = l2Normalize(signalDims);
  const weighted = [
    ...normDomains.map((v) => v * DOMAIN_WEIGHT),
    ...normSignals.map((v) => v * SIGNAL_WEIGHT),
  ];
  return l2Normalize(weighted);
}

// ─── User Taste Vector ──────────────────────────────────────────────────────

export interface UserVectorInputV3 {
  radarData: { axis: string; value: number }[];
  microTasteSignals: Record<string, string[]>;
  allSignals?: Array<{ tag: string; cat: string; confidence: number }>;
}

export function computeUserTasteVectorV3(input: UserVectorInputV3): number[] {
  const domainDims = new Array(DOMAIN_DIMS).fill(0);

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

  if (input.allSignals) {
    for (const sig of input.allSignals) {
      if (sig.cat !== 'Rejection' && sig.cat !== 'Context') {
        signalInputs.push({ text: sig.tag, confidence: sig.confidence });
      }
    }
  }

  const signalDims = buildSignalFeaturesV3(signalInputs);
  return normalizeWithWeighting(domainDims, signalDims);
}

// ─── Property Embedding ─────────────────────────────────────────────────────

export interface PropertyEmbeddingInputV3 {
  signals: BriefingSignal[];
  antiSignals?: Array<{ dimension: string; confidence: number; signal: string }>;
}

export function computePropertyEmbeddingV3(input: PropertyEmbeddingInputV3): number[] {
  const domainDims = new Array(DOMAIN_DIMS).fill(0);
  const { signals, antiSignals = [] } = input;

  const domainSignals: Record<TasteDomain, BriefingSignal[]> = {
    Design: [], Atmosphere: [], Character: [], Service: [],
    FoodDrink: [], Setting: [], Wellness: [], Sustainability: [],
  };

  for (const sig of signals) {
    const domain = DIMENSION_TO_DOMAIN[sig.dimension];
    if (domain) domainSignals[domain].push(sig);
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

  for (const anti of antiSignals) {
    const domain = DIMENSION_TO_DOMAIN[anti.dimension];
    if (domain) {
      const idx = DOMAIN_INDEX[domain];
      domainDims[idx] = Math.max(0, domainDims[idx] - anti.confidence * 0.1);
    }
  }

  const signalInputs = signals.map((s) => ({
    text: s.signal,
    confidence: s.confidence,
  }));

  const signalDims = buildSignalFeaturesV3(signalInputs);
  return normalizeWithWeighting(domainDims, signalDims);
}

// ─── Utilities ──────────────────────────────────────────────────────────────

export function vectorToSqlV3(vec: number[]): string {
  return '[' + vec.map((v) => v.toFixed(8)).join(',') + ']';
}

export function cosineSimilarityV3(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

/** Get human-readable cluster label for a signal */
export function getSignalClusterLabel(signal: string): string | null {
  const clusterId = lookupSignalCluster(signal);
  const info = clusterInfo[String(clusterId)];
  return info?.label ?? null;
}

/** Get all cluster labels and their IDs */
export function getAllClusterLabels(): Array<{ id: number; label: string; domain?: string; size: number }> {
  return Object.entries(clusterInfo).map(([id, info]) => ({
    id: parseInt(id, 10),
    label: info.label,
    domain: (info as any).domain,
    size: (info as any).size ?? 0,
  }));
}
