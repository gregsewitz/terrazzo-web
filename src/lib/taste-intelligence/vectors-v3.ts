/**
 * Taste Intelligence — Vector Computation (v3.5: Anti-Signal Integration)
 *
 * Uses learned semantic clusters with two-tier neighbor bleed for smoother taste matching.
 * Each of the 400 signal dimensions represents a meaningful taste concept.
 * When a signal activates cluster C, energy bleeds to neighbor clusters scaled by
 * cosine similarity of their centroids:
 *   - Intra-domain neighbors (up to 3): weight = similarity × 0.30
 *   - Cross-domain neighbors (up to 2): weight = similarity × 0.10
 *
 * Vector layout (400 dimensions):
 *   [0-399]   : 400 semantic cluster features (signal → cluster + neighbor bleed, IDF-weighted)
 *              Dimensions can be negative when anti-signals dominate a cluster.
 *
 * Domain information is implicitly encoded via cluster-to-domain assignments.
 *
 * Changes from v3.4:
 *   - Anti-signal integration: rejection signals and property antiSignals now create
 *     negative cluster activations at ANTI_SIGNAL_SCALE (0.5×), pushing vectors apart
 *     in clusters the user/property explicitly dislikes
 *   - Symmetric feature clamping: [-1.0, +1.0] instead of [0, +1.0]
 *   - User rejection signals (cat='Rejection') no longer filtered out
 *   - Property antiSignals parameter now used in computePropertyEmbeddingV3
 *
 * Changes from v3.5 (v3.6):
 *   - Removed domain weighting from computeUserTasteVectorV3(). MicroTasteSignals now
 *     use uniform confidence (1.0) instead of radarData-derived domain weights.
 *     Simulation showed cosine similarity 0.991, Spearman ρ 0.985 — negligible impact.
 *   - radarData still used for front-end display (radar charts, domain coverage analysis)
 *
 * Changes from v3.3 (v3.4):
 *   - Dropped 8 domain dims (408 → 400 dimensions)
 *   - Removed triple-normalization (domain + signal + combined); now single L2 norm
 */

import type { TasteDomain, BriefingSignal, GeneratedTasteProfile } from '@/types';
import { getSignalClusterMap } from './signal-clusters-loader';
import {
  ANTI_SIGNAL_SCALE as ANTI_SIGNAL_SCALE_CONST,
  BLEED_ONLY_DAMPEN as BLEED_ONLY_DAMPEN_CONST,
  CLUSTER_ACTIVATION_THRESHOLD,
  USER_SIGNAL_WEIGHT as USER_SIGNAL_WEIGHT_CONST,
} from '@/lib/constants';

// ─── Vector dimensions ──────────────────────────────────────────────────────

export const VECTOR_DIM_V3 = 400;
const SIGNAL_DIMS_V3 = 400;

/**
 * Anti-signal scale factor. Rejection/anti-signals contribute at this fraction
 * of their confidence as negative activations. 0.5 means a rejection at confidence
 * 0.97 acts like a -0.485 activation — strong enough to meaningfully push the vector
 * away from that cluster without overwhelming positive signals.
 */
export const ANTI_SIGNAL_SCALE = ANTI_SIGNAL_SCALE_CONST;

/**
 * Domain index mapping. Used by front-end display code (analyzeDomainCoverage,
 * getClusterIndicesForDomain) — NOT used for scoring/weighting.
 * Domain weighting was removed from scoring in v3.6 (see computeUserTasteVectorV3).
 */
const DOMAIN_INDEX: Record<TasteDomain, number> = {
  Design: 0, Atmosphere: 1, Character: 2, Service: 3,
  FoodDrink: 4, Geography: 5, Wellness: 6, Sustainability: 7,
};

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

// ─── Lazy cluster state ─────────────────────────────────────────────────────
// signal-clusters.json (17MB) is loaded from public/data/ on first use and
// cached for the process lifetime. Nothing is parsed at module-load time.

interface ClusterState {
  signalToCluster: Record<string, number>;
  clusterInfo: Record<string, { label: string; displayLabel?: string; domain?: string; topSignals: string[]; size?: number }>;
  clusterCentroids: Record<string, number[]> | null;
  intraBleedScale: number;
  crossBleedScale: number;
  legacyDecay: number;
  neighborMap: Map<number, Array<{ idx: number; weight: number }>>;
  domainClusterIndices: Map<string, number[]>;
  allDomains: string[];
}

let _clusterState: ClusterState | null = null;

function getClusterState(): ClusterState {
  if (_clusterState) return _clusterState;

  const cm = getSignalClusterMap();

  const signalToCluster: Record<string, number> = cm.signalToCluster;
  const clusterInfo: Record<string, { label: string; domain?: string; topSignals: string[]; size?: number }> =
    cm.clusters;
  const clusterCentroids: Record<string, number[]> | null = cm.clusterCentroids ?? null;

  // Neighbor bleed map: cluster → [{cluster, similarity, tier}]
  // Bleed scales are read from signal-clusters.json (source of truth).
  // v3.5 reduced from 0.30/0.10 → 0.15/0.03 to prevent vector saturation;
  // the JSON has been updated accordingly. Fallbacks are a safety net only.
  const intraBleedScale: number = cm.intra_bleed_scale ?? 0.15;
  const crossBleedScale: number = cm.cross_bleed_scale ?? 0.03;
  // Backward compat: if signal-clusters.json is still v3.2 with flat weight/no tier
  const legacyDecay: number = cm.neighbor_decay ?? 0.12;

  const clusterNeighborsRaw: Record<string, Array<{ cluster: number; similarity: number; weight?: number; tier?: string }>> =
    cm.clusterNeighbors ?? {};

  /** Pre-built neighbor lookup: clusterIndex → Array<{idx: number; weight: number}> */
  const neighborMap: Map<number, Array<{ idx: number; weight: number }>> = new Map();
  for (const [cidStr, neighbors] of Object.entries(clusterNeighborsRaw)) {
    const cid = parseInt(cidStr, 10);
    neighborMap.set(
      cid,
      neighbors.map((n) => {
        if (n.tier) {
          // v3.3: similarity-scaled weight based on tier
          const scale = n.tier === 'cross' ? crossBleedScale : intraBleedScale;
          return { idx: n.cluster, weight: n.similarity * scale };
        }
        // v3.2 backward compat: use legacy flat weight
        return { idx: n.cluster, weight: n.weight ?? legacyDecay };
      }),
    );
  }

  // Pre-computed domain → cluster indices mapping
  const domainClusterIndices: Map<string, number[]> = new Map();
  for (const [cidStr, info] of Object.entries(clusterInfo)) {
    if (info.domain) {
      const existing = domainClusterIndices.get(info.domain) || [];
      existing.push(parseInt(cidStr, 10));
      domainClusterIndices.set(info.domain, existing);
    }
  }

  _clusterState = {
    signalToCluster,
    clusterInfo,
    clusterCentroids,
    intraBleedScale,
    crossBleedScale,
    legacyDecay,
    neighborMap,
    domainClusterIndices,
    allDomains: Array.from(domainClusterIndices.keys()),
  };
  return _clusterState;
}

/**
 * Look up which semantic cluster a signal belongs to.
 *
 * Resolution order:
 *   1. Direct lookup — covers corpus signals (freq >= 2) AND singleton signals
 *      that were mapped to nearest centroid during clustering. After a re-cluster
 *      with singleton mapping, this covers ~100% of known signals.
 *   2. Word-overlap fallback — for truly novel signals not seen during clustering.
 *      This is a last resort and known to produce poor results (e.g., routing
 *      "steam-room-offering" to the "room temperature issues" cluster because
 *      of the word "room"). It should rarely trigger after a proper re-cluster.
 *
 * For async embedding-based fallback (using clusterCentroids), use
 * lookupSignalClusterAsync() which calls OpenAI to embed the signal.
 */
export function lookupSignalCluster(signal: string): number {
  const { signalToCluster, clusterInfo } = getClusterState();
  const normalized = signal.toLowerCase().trim();

  // Direct lookup — covers corpus + singleton signals mapped during clustering
  const directMatch = signalToCluster[normalized];
  if (directMatch !== undefined) return directMatch;

  // Fallback: word-overlap (last resort for truly novel signals)
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

/**
 * Async embedding-based cluster lookup for novel signals.
 * Uses OpenAI text-embedding-3-small to embed the signal, then finds the
 * nearest cluster centroid by cosine similarity.
 *
 * Only call this for signals that aren't in signalToCluster (direct lookup).
 * Requires clusterCentroids to be present in signal-clusters.json.
 *
 * Returns null if centroids aren't available or embedding fails.
 */
export async function lookupSignalClusterAsync(signal: string): Promise<number | null> {
  const { clusterCentroids, signalToCluster } = getClusterState();
  if (!clusterCentroids) return null;

  const normalized = signal.toLowerCase().trim();

  // Check direct lookup first
  const directMatch = signalToCluster[normalized];
  if (directMatch !== undefined) return directMatch;

  try {
    // Call OpenAI embedding API directly to avoid requiring the openai package
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: [normalized.replace(/-/g, ' ').replace(/_/g, ' ')],
      }),
    });

    if (!res.ok) return null;
    const json = await res.json();
    const embedding: number[] = json.data[0].embedding;

    // Find nearest centroid by cosine similarity
    let bestCluster = 0;
    let bestSim = -Infinity;

    for (const [cidStr, centroid] of Object.entries(clusterCentroids)) {
      const cid = parseInt(cidStr, 10);
      let dot = 0;
      let normA = 0;
      let normB = 0;
      for (let i = 0; i < embedding.length && i < centroid.length; i++) {
        dot += embedding[i] * centroid[i];
        normA += embedding[i] * embedding[i];
        normB += centroid[i] * centroid[i];
      }
      const sim = dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
      if (sim > bestSim) {
        bestSim = sim;
        bestCluster = cid;
      }
    }

    return bestCluster;
  } catch {
    // OpenAI unavailable or error — fall back to sync word-overlap
    return null;
  }
}

// ─── Semantic embedding cache ────────────────────────────────────────────────
// Caches signal → soft cluster activations discovered via OpenAI embedding.
// Each signal maps to its top-K cluster activations (weighted by cosine similarity
// to centroids) instead of a single hard cluster assignment.

interface SoftClusterActivation {
  clusterId: number;
  weight: number;  // cosine similarity to centroid, normalized so sum = 1.0
}

const _semanticClusterCache = new Map<string, SoftClusterActivation[]>();

/** Number of clusters to soft-activate per semantically routed signal */
const SOFT_ACTIVATION_TOP_K = 5;

/**
 * Minimum cosine similarity to a centroid to be included in soft activation.
 * Prevents very weak activations from adding noise.
 */
const SOFT_ACTIVATION_MIN_SIM = 0.15;

/**
 * Batch-embed novel signals and find their top-K nearest cluster centroids.
 * Uses a single OpenAI API call for all signals, then cosine-matches each
 * against the 400 cluster centroids.
 *
 * Returns soft activations: each signal maps to up to SOFT_ACTIVATION_TOP_K
 * clusters weighted by cosine similarity. This is critical for abstract user
 * signals like "mountain-views" which are semantically related to multiple
 * clusters across domains (Setting:mountain-wilderness, Design:floor-to-ceiling-glass,
 * Setting:remote-wilderness, etc.).
 *
 * Returns a Map from normalized signal text → SoftClusterActivation[].
 */
async function batchEmbedSignalsToClusters(
  signals: string[],
): Promise<Map<string, SoftClusterActivation[]>> {
  const result = new Map<string, SoftClusterActivation[]>();
  if (signals.length === 0) return result;

  const { clusterCentroids } = getClusterState();
  if (!clusterCentroids) return result;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return result;

  // Deduplicate and normalize
  const uniqueSignals = [...new Set(signals.map(s => s.toLowerCase().trim()))];

  // Check cache first, collect uncached
  const uncached: string[] = [];
  for (const sig of uniqueSignals) {
    const cached = _semanticClusterCache.get(sig);
    if (cached !== undefined) {
      result.set(sig, cached);
    } else {
      uncached.push(sig);
    }
  }

  if (uncached.length === 0) return result;

  try {
    // Batch embed all uncached signals in one API call
    // OpenAI supports up to 2048 inputs per call
    const inputs = uncached.map(s => s.replace(/-/g, ' ').replace(/_/g, ' '));
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: inputs,
      }),
    });

    if (!res.ok) {
      console.warn(`[vectors-v3] OpenAI embedding batch failed: ${res.status}`);
      return result;
    }

    const json = await res.json();
    const embeddings: Array<{ embedding: number[] }> = json.data;

    // Pre-parse centroids into arrays for efficient repeated comparison
    const centroidEntries = Object.entries(clusterCentroids).map(([cidStr, centroid]) => ({
      cid: parseInt(cidStr, 10),
      centroid,
      norm: Math.sqrt(centroid.reduce((s, v) => s + v * v, 0)),
    }));

    for (let i = 0; i < uncached.length; i++) {
      const embedding = embeddings[i].embedding;
      const embNorm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));

      // Compute cosine similarity to ALL centroids
      const allSims: Array<{ cid: number; sim: number }> = [];
      for (const { cid, centroid, norm: centNorm } of centroidEntries) {
        let dot = 0;
        for (let j = 0; j < embedding.length && j < centroid.length; j++) {
          dot += embedding[j] * centroid[j];
        }
        const sim = dot / (embNorm * centNorm + 1e-10);
        if (sim >= SOFT_ACTIVATION_MIN_SIM) {
          allSims.push({ cid, sim });
        }
      }

      // Take top K by similarity
      allSims.sort((a, b) => b.sim - a.sim);
      const topK = allSims.slice(0, SOFT_ACTIVATION_TOP_K);

      // Normalize weights so they sum to 1.0
      const totalSim = topK.reduce((s, x) => s + x.sim, 0);
      const activations: SoftClusterActivation[] = topK.map(x => ({
        clusterId: x.cid,
        weight: totalSim > 0 ? x.sim / totalSim : 1.0 / topK.length,
      }));

      result.set(uncached[i], activations);
      _semanticClusterCache.set(uncached[i], activations);
    }
  } catch (err) {
    console.warn('[vectors-v3] Batch embedding failed, falling back to word-overlap:', err);
  }

  return result;
}

// ─── Signal features (cluster lookup + similarity-scaled two-tier neighbor bleed) ─
// Confidence can be negative (anti-signals). Negative values create negative cluster
// activations that push vectors apart in cosine similarity.
//
// v3.7: Now async — signals not in the direct signalToCluster mapping are batch-embedded
// via OpenAI and soft-activated across their top-K nearest cluster centroids. This fixes
// the vocabulary mismatch between user onboarding signals (e.g. "mountain-views") and
// property enrichment signals (e.g. "floor-to-ceiling-mountain-views") that previously
// caused semantically identical concepts to land in different clusters.
//
// Soft activation is critical for abstract user signals that span multiple domains:
// "mountain-views" should activate Setting:mountain-wilderness (primary),
// Setting:remote-wilderness, AND Design:floor-to-ceiling-glass — not just one.
// Property signals use hard (single-cluster) activation via direct lookup since
// they're already in the 131K mapping and are domain-specific by construction.

async function buildSignalFeaturesV3(signals: Array<{ text: string; confidence: number }>): Promise<number[]> {
  const { neighborMap, signalToCluster } = getClusterState();
  const features = new Array(SIGNAL_DIMS_V3).fill(0);
  // Track which clusters have DIRECT signal hits (not just bleed)
  const directHits = new Set<number>();

  // Partition signals into mapped (direct lookup) and unmapped (need embedding)
  const mapped: Array<{ text: string; confidence: number; bucket: number }> = [];
  const unmappedSignals: string[] = [];
  const unmappedEntries: Array<{ text: string; confidence: number }> = [];

  for (const { text, confidence } of signals) {
    const normalized = text.toLowerCase().trim();
    const directMatch = signalToCluster[normalized];
    if (directMatch !== undefined) {
      mapped.push({ text, confidence, bucket: directMatch });
    } else {
      unmappedSignals.push(normalized);
      unmappedEntries.push({ text, confidence });
    }
  }

  // Batch-embed all unmapped signals in one API call → soft cluster activations
  const semanticMappings = unmappedSignals.length > 0
    ? await batchEmbedSignalsToClusters(unmappedSignals)
    : new Map<string, SoftClusterActivation[]>();

  // Process mapped signals (direct lookup → hard single-cluster activation)
  for (const { text, confidence, bucket } of mapped) {
    const idf = getIdfWeight(text);
    const weightedConfidence = confidence * idf;
    features[bucket] += weightedConfidence;
    directHits.add(bucket);

    const neighbors = neighborMap.get(bucket);
    if (neighbors) {
      for (const { idx, weight } of neighbors) {
        features[idx] += weightedConfidence * weight;
      }
    }
  }

  // Process unmapped signals (semantic soft activation across top-K clusters)
  for (const { text, confidence } of unmappedEntries) {
    const normalized = text.toLowerCase().trim();
    const activations = semanticMappings.get(normalized);
    if (!activations || activations.length === 0) {
      // Embedding failed for this signal — fall back to word-overlap
      const fallbackBucket = lookupSignalCluster(text);
      const idf = getIdfWeight(text);
      const weightedConfidence = confidence * idf;
      features[fallbackBucket] += weightedConfidence;
      directHits.add(fallbackBucket);
      const neighbors = neighborMap.get(fallbackBucket);
      if (neighbors) {
        for (const { idx, weight } of neighbors) {
          features[idx] += weightedConfidence * weight;
        }
      }
      continue;
    }

    const idf = getIdfWeight(text);
    const weightedConfidence = confidence * idf;

    // Soft-activate each of the top-K clusters, weighted by centroid similarity
    for (const { clusterId, weight: clusterWeight } of activations) {
      features[clusterId] += weightedConfidence * clusterWeight;
      directHits.add(clusterId);

      // Neighbor bleed from each soft-activated cluster
      const neighbors = neighborMap.get(clusterId);
      if (neighbors) {
        for (const { idx, weight: neighWeight } of neighbors) {
          features[idx] += weightedConfidence * clusterWeight * neighWeight;
        }
      }
    }
  }

  // Sublinear dampening (log1p) — replaces the old weighted-average normalization.
  //
  // The old approach divided each dimension by total weight, producing a weighted
  // average that saturated to ~1.0 whenever ANY signal hit a cluster. This made
  // property vectors binary: 80-88% of dims at max, no gradient.
  //
  // Log1p preserves signal DENSITY while preventing unbounded growth:
  //   1 signal  (raw ≈ 0.8) → log1p(0.8) ≈ 0.59
  //   5 signals (raw ≈ 4.0) → log1p(4.0) ≈ 1.61
  //   20 signals (raw ≈ 16) → log1p(16)  ≈ 2.83
  //
  // This is the same principle behind BM25/TF-IDF sublinear term frequency:
  // diminishing returns without information loss.
  for (let i = 0; i < SIGNAL_DIMS_V3; i++) {
    if (features[i] !== 0) {
      features[i] = Math.sign(features[i]) * Math.log1p(Math.abs(features[i]));
    }
  }

  // Sparsity preservation: attenuate bleed-only clusters.
  // Clusters that only received energy via neighbor bleed (no direct signal hit)
  // get dampened to prevent vector saturation for users with 300+ signals.
  // This ensures the vector retains discriminative structure even as signal
  // count grows — direct preferences stay strong, inferred adjacencies stay weak.
  const BLEED_ONLY_DAMPEN = BLEED_ONLY_DAMPEN_CONST; // bleed-only clusters retain 8% of their value (was 30%)
  for (let i = 0; i < SIGNAL_DIMS_V3; i++) {
    if (!directHits.has(i) && features[i] !== 0) {
      features[i] *= BLEED_ONLY_DAMPEN;
    }
  }

  return features;
}

// ─── Mean-centering ─────────────────────────────────────────────────────────
// Removes the shared "uniform" component from vectors before L2 normalization.
// Without this, 90%+ of every cosine score comes from the shared direction where
// both vectors have positive values — making all cosines cluster near 0.83 with
// only a 0.02 spread. Mean-centering makes cosine distance equivalent to
// "adjusted cosine", dramatically improving discrimination (spread → 0.10+).

function meanCenter(vec: number[]): number[] {
  const mean = vec.reduce((a, b) => a + b, 0) / vec.length;
  return vec.map(v => v - mean);
}

// ─── L2 normalization ────────────────────────────────────────────────────────

function l2Normalize(vec: number[]): number[] {
  const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (magnitude === 0) return vec;
  return vec.map((v) => v / magnitude);
}

// ─── User Taste Vector ──────────────────────────────────────────────────────

export interface UserVectorInputV3 {
  /** @deprecated No longer used for scoring (v3.6). Kept for backward compat with callers. */
  radarData?: { axis: string; value: number }[];
  microTasteSignals: Record<string, string[]>;
  allSignals?: Array<{ tag: string; cat: string; confidence: number }>;
}

export async function computeUserTasteVectorV3(input: UserVectorInputV3): Promise<number[]> {
  // v3.7: Now async — unmapped signals are batch-embedded via OpenAI for
  // semantic cluster routing. See buildSignalFeaturesV3 for details.
  //
  // v3.6: All signals use uniform confidence (1.0) for microTasteSignals.
  // Domain weighting has been removed from scoring — radarData is only used
  // for front-end display (radar charts, domain coverage, editorial framing).
  // Simulation confirmed negligible impact: cosine 0.991, Spearman ρ 0.985.

  const signalInputs: Array<{ text: string; confidence: number }> = [];

  // MicroTasteSignals: uniform confidence (1.0) regardless of domain
  for (const [, signals] of Object.entries(input.microTasteSignals)) {
    for (const sig of signals) {
      signalInputs.push({ text: sig, confidence: 1.0 });
    }
  }

  // AllSignals from TasteNode table: use their own confidence values
  if (input.allSignals) {
    for (const sig of input.allSignals) {
      if (sig.cat === 'Context') {
        // Context signals (life/personal) are not taste-relevant — skip
        continue;
      }
      if (sig.cat === 'Rejection') {
        // Rejection signals become negative activations at ANTI_SIGNAL_SCALE
        // e.g. "Anti-Instagram-aesthetic" at confidence 0.97 → -0.485
        signalInputs.push({ text: sig.tag, confidence: -sig.confidence * ANTI_SIGNAL_SCALE });
      } else {
        signalInputs.push({ text: sig.tag, confidence: sig.confidence });
      }
    }
  }

  const signalDims = await buildSignalFeaturesV3(signalInputs);
  return l2Normalize(meanCenter(signalDims));
}

// ─── Property Embedding ─────────────────────────────────────────────────────

export interface PropertyEmbeddingInputV3 {
  signals: BriefingSignal[];
  antiSignals?: Array<{ dimension: string; confidence: number; signal: string }>;
}

export async function computePropertyEmbeddingV3(input: PropertyEmbeddingInputV3): Promise<number[]> {
  const { signals, antiSignals } = input;

  const signalInputs: Array<{ text: string; confidence: number }> = signals.map((s) => ({
    text: s.signal,
    confidence: s.confidence,
  }));

  // Anti-signals create negative cluster activations at ANTI_SIGNAL_SCALE
  if (antiSignals && antiSignals.length > 0) {
    for (const anti of antiSignals) {
      signalInputs.push({
        text: anti.signal,
        confidence: -anti.confidence * ANTI_SIGNAL_SCALE,
      });
    }
  }

  const signalDims = await buildSignalFeaturesV3(signalInputs);
  return l2Normalize(meanCenter(signalDims));
}

// ─── Property Anchor Blending ────────────────────────────────────────────────
// When users mention real places during onboarding ("I love Aman Tokyo"),
// those resolved property embeddings are blended into the user's taste vector.
// This provides a strong "show, don't tell" signal — actual property preferences
// are far more informative than abstract taste descriptions.

export interface PropertyAnchorForBlending {
  embedding: number[];  // 400-dim V3 embedding
  blendWeight: number;  // sentiment-derived: love=0.8, like=0.5, visited=0.3, dislike=-0.3
}

/**
 * Blend property anchor embeddings into a base user taste vector.
 *
 * Algorithm:
 *   1. Start with the user's signal-derived taste vector (computed normally)
 *   2. For each property anchor, add its embedding scaled by blendWeight
 *   3. The USER_SIGNAL_WEIGHT controls how much the original signal-based
 *      vector dominates vs. property anchors (default: 0.6 = 60% signal, 40% anchors)
 *   4. Re-normalize to unit length
 *
 * Dislike anchors (negative blendWeight) push the user vector AWAY from
 * those properties in embedding space — "I don't like The Standard" makes
 * the user vector less similar to The Standard's embedding.
 */
export const USER_SIGNAL_WEIGHT = USER_SIGNAL_WEIGHT_CONST;

export function blendPropertyAnchors(
  baseVector: number[],
  anchors: PropertyAnchorForBlending[],
): number[] {
  if (anchors.length === 0) return baseVector;

  const blended = new Array(VECTOR_DIM_V3).fill(0);

  // Base vector contribution (weighted)
  for (let i = 0; i < VECTOR_DIM_V3; i++) {
    blended[i] = baseVector[i] * USER_SIGNAL_WEIGHT;
  }

  // Anchor contributions — distribute remaining weight across all anchors
  // Total anchor budget = 1 - USER_SIGNAL_WEIGHT
  const anchorBudget = 1 - USER_SIGNAL_WEIGHT;
  const totalAbsWeight = anchors.reduce((sum, a) => sum + Math.abs(a.blendWeight), 0);

  if (totalAbsWeight > 0) {
    for (const anchor of anchors) {
      // Each anchor gets a share of the anchor budget proportional to its |blendWeight|
      // The sign of blendWeight determines whether we add or subtract
      const share = (anchor.blendWeight / totalAbsWeight) * anchorBudget;
      for (let i = 0; i < VECTOR_DIM_V3; i++) {
        blended[i] += anchor.embedding[i] * share;
      }
    }
  }

  return l2Normalize(meanCenter(blended));
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
  const { clusterInfo } = getClusterState();
  const clusterId = lookupSignalCluster(signal);
  const info = clusterInfo[String(clusterId)];
  return info?.label ?? null;
}

/** Get all cluster labels and their IDs */
export function getAllClusterLabels(): Array<{ id: number; label: string; displayLabel?: string; domain?: string; size: number }> {
  const { clusterInfo } = getClusterState();
  return Object.entries(clusterInfo).map(([id, info]) => ({
    id: parseInt(id, 10),
    label: info.label,
    displayLabel: info.displayLabel,
    domain: info.domain,
    size: info.size ?? 0,
  }));
}

// ─── Domain Coverage Analysis ──────────────────────────────────────────────

/** Get cluster indices for a domain (exposed for queries) */
export function getClusterIndicesForDomain(domain: string): number[] {
  return getClusterState().domainClusterIndices.get(domain) || [];
}

/**
 * All taste domains present in the cluster map (derived from cluster metadata).
 * Lazily resolved on first call from the loaded cluster JSON.
 */
export function getAllDomains(): string[] {
  return getClusterState().allDomains;
}


export interface DomainCoverage {
  domain: string;
  /** Total clusters in this domain */
  totalClusters: number;
  /** Clusters with |activation| > threshold */
  activatedClusters: number;
  /** Coverage ratio: activatedClusters / totalClusters (0-1) */
  coverage: number;
  /** Mean |activation| across all domain clusters */
  meanActivation: number;
  /** Std dev of activations within domain (higher = more specific taste) */
  spread: number;
  /** Strongest activated cluster labels in this domain (top 3) */
  strongestClusters: Array<{ label: string; activation: number }>;
  /** Weakest / zero clusters that could be gap-filled */
  coldClusters: Array<{ index: number; label: string }>;
}

export interface CoverageAnalysis {
  domains: DomainCoverage[];
  /** Overall coverage (weighted mean across domains) */
  overallCoverage: number;
  /** Domains sorted by coverage ascending (worst first) */
  gapDomains: string[];
  /** Total activated clusters across all domains */
  totalActivated: number;
}

export const ACTIVATION_THRESHOLD = CLUSTER_ACTIVATION_THRESHOLD; // Cluster is "activated" if |value| > this

/**
 * Analyze domain-level coverage of a 400-dim V3 taste vector.
 * Returns per-domain coverage metrics + overall gaps.
 *
 * Use cases:
 *   - After Act 1 to decide if gap-fill questions are needed
 *   - After each phase to track signal accumulation
 *   - At onboarding completion to compute TasteStructure
 */
export function analyzeDomainCoverage(vector: number[]): CoverageAnalysis {
  const { domainClusterIndices, clusterInfo } = getClusterState();
  const domains: DomainCoverage[] = [];

  for (const [domain, indices] of domainClusterIndices) {
    const activations = indices.map((idx) => vector[idx] || 0);
    const absActivations = activations.map(Math.abs);

    const activated = absActivations.filter((v) => v > ACTIVATION_THRESHOLD).length;
    const total = indices.length;
    const coverage = total > 0 ? activated / total : 0;

    const sum = absActivations.reduce((a, b) => a + b, 0);
    const mean = total > 0 ? sum / total : 0;

    // Std dev
    const variance = total > 0
      ? absActivations.reduce((acc, v) => acc + (v - mean) ** 2, 0) / total
      : 0;
    const spread = Math.sqrt(variance);

    // Top 3 strongest clusters
    const indexedActivations = indices.map((idx, i) => ({
      index: idx,
      label: clusterInfo[String(idx)]?.label || `cluster-${idx}`,
      activation: absActivations[i],
    }));
    indexedActivations.sort((a, b) => b.activation - a.activation);

    const strongestClusters = indexedActivations.slice(0, 3).map((c) => ({
      label: c.label,
      activation: c.activation,
    }));

    // Cold clusters — zero or near-zero activation, good candidates for gap-fill
    const coldClusters = indexedActivations
      .filter((c) => c.activation <= ACTIVATION_THRESHOLD)
      .slice(0, 10) // Cap at 10 to keep payload reasonable
      .map((c) => ({ index: c.index, label: c.label }));

    domains.push({
      domain,
      totalClusters: total,
      activatedClusters: activated,
      coverage,
      meanActivation: mean,
      spread,
      strongestClusters,
      coldClusters,
    });
  }

  // Sort by coverage ascending (worst gaps first)
  domains.sort((a, b) => a.coverage - b.coverage);

  const totalActivated = domains.reduce((sum, d) => sum + d.activatedClusters, 0);
  const overallCoverage = VECTOR_DIM_V3 > 0
    ? totalActivated / VECTOR_DIM_V3
    : 0;

  // Per-domain gap-fill thresholds.
  //
  // Larger domains (Service: 84 clusters) need a lower coverage bar — you
  // don't need opinions on 25% of 84 sub-topics to have meaningful taste.
  // Smaller domains need a higher bar relative to their size.
  //
  // Formula: threshold = 0.20 + 0.15 × (1 - domainSize/maxDomainSize)
  //   Large  (84 clusters): 0.20 + 0.15×0.00 = 0.20  → need 17 clusters
  //   Medium (48 clusters): 0.20 + 0.15×0.43 = 0.26  → need 13 clusters
  //
  // Wellness (28) and Sustainability (14) are supplementary domains, not
  // core taste pillars. Users shouldn't be prompted to flesh these out —
  // having *any* signal there is enough. We exempt them from gap-fill.
  const SUPPLEMENTARY_DOMAINS = new Set(['Wellness', 'Sustainability']);
  const maxDomainSize = Math.max(...domains.map(d => d.totalClusters), 1);
  const gapDomains = domains
    .filter((d) => {
      if (SUPPLEMENTARY_DOMAINS.has(d.domain)) return false;
      const sizeRatio = 1 - d.totalClusters / maxDomainSize;
      const threshold = 0.20 + 0.15 * sizeRatio;
      return d.coverage < threshold;
    })
    .map((d) => d.domain);

  return {
    domains,
    overallCoverage,
    gapDomains,
    totalActivated,
  };
}

/**
 * Compute effective activation including neighbor-received energy.
 * A cluster may have zero direct activation but receive significant
 * energy from activated neighbors — this corrects for that.
 */
export function computeEffectiveActivation(vector: number[]): number[] {
  const { neighborMap } = getClusterState();
  const effective = [...vector];

  for (let i = 0; i < VECTOR_DIM_V3; i++) {
    const neighbors = neighborMap.get(i);
    if (neighbors) {
      for (const { idx, weight } of neighbors) {
        effective[i] += vector[idx] * weight;
      }
    }
  }

  return effective;
}
