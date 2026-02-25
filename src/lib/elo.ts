/**
 * Elo-style adaptive comparison engine for taste profiling.
 *
 * Used by onboarding Phase 8 (experience ranking) and Phase 9 (designer mood boards).
 * Items start at equal ratings; each forced choice updates both sides.
 * The pairing algorithm maximizes information gain:
 *   - Early rounds: cross-cluster (broad spectrum placement)
 *   - Mid rounds: close-rating (within-zone refinement)
 *   - Late rounds: low-comparison (fill gaps)
 */

import type { EloItem, EloState, TasteSignal } from '@/types';

// ─── Constants ───

const INITIAL_RATING = 1500;
const BASE_K = 40;         // Starting K-factor (aggressive early)
const MIN_K = 16;          // Minimum K-factor (conservative late)

// ─── Initialization ───

interface InitItemInput {
  id: string;
  cluster: string;
  signals: string[];
  category?: string;
  metadata: Record<string, unknown>;
}

export function initEloState(items: InitItemInput[]): EloState {
  return {
    items: items.map(item => ({
      ...item,
      rating: INITIAL_RATING,
      comparisons: 0,
    })),
    history: [],
    round: 0,
  };
}

// ─── Pairing Algorithm ───

/** Get the K-factor for the current round (decreases over time) */
function getKFactor(round: number, totalRounds: number): number {
  const progress = round / totalRounds;
  return BASE_K - (BASE_K - MIN_K) * progress;
}

/**
 * Inter-cluster distance matrix (computed from 6D centroid distances).
 * Higher values = more aesthetically opposed = better early matchups.
 * Keys are sorted alphabetical pair "clusterA|clusterB".
 */
const CLUSTER_DISTANCES: Record<string, number> = {
  'grand|quiet':        1.00,  // formal authority vs. contemplative restraint
  'expressive|quiet':   0.99,  // maximum visual opposition: loud vs. silent
  'grand|soulful':      0.81,  // institutional vs. human warmth
  'quiet|soulful':      0.77,  // contemplative vs. warm engagement
  'expressive|soulful': 0.70,  // decorative energy vs. textured warmth
  'expressive|grand':   0.59,  // both high-volume, differ on formality
};

/** Compute aesthetic distance between two clusters (0 = same, ~1 = opposite poles) */
function clusterDistance(a: string, b: string): number {
  if (a === b) return 0;
  const key = [a, b].sort().join('|');
  return CLUSTER_DISTANCES[key] ?? 0.5; // fallback for unknown clusters
}

/** Check if a pair has already been shown */
function pairShown(history: EloState['history'], idA: string, idB: string): boolean {
  return history.some(
    h => (h.winnerId === idA && h.loserId === idB) ||
         (h.winnerId === idB && h.loserId === idA)
  );
}

/**
 * Pick the next pair to show. Strategy varies by phase:
 *
 * For EXPERIENCE items (Phase 8): Uses `pairWith` metadata to always pair items
 * from the same dimension (e.g. "room service" vs "local café"). This ensures
 * coherent A/B comparisons. The algorithm shuffles dimension order and may
 * re-pair dimensions from different angles in later rounds.
 *
 * For DESIGNER items (Phase 9): Uses cluster distance for cross-aesthetic
 * comparisons (no pairWith metadata).
 *
 * Phase 1 (rounds 0-2): Cross-cluster — maximize cluster distance
 * Phase 2 (rounds 3-6): Refinement — pick items with closest ratings
 * Phase 3 (rounds 7+): Coverage — pick items with fewest comparisons
 */
export function pickNextPair(state: EloState, totalRounds: number = 10): [EloItem, EloItem] | null {
  const { items, history, round } = state;
  if (items.length < 2) return null;

  // Check if items have pairWith metadata (experience pool) vs not (designer pool)
  const hasPairWith = items.some(i => i.metadata?.pairWith);

  // Build all valid pairs (not yet shown)
  type Pair = [EloItem, EloItem];
  const validPairs: Pair[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (!pairShown(history, items[i].id, items[j].id)) {
        validPairs.push([items[i], items[j]]);
      }
    }
  }

  if (validPairs.length === 0) return null; // All pairs exhausted

  // ── Experience Pool (pairWith): prefer natural dimension pairs ──
  if (hasPairWith) {
    // Separate natural pairs (same dimension) from cross-dimension pairs
    const naturalPairs = validPairs.filter(
      ([a, b]) => a.metadata?.pairWith === b.id || b.metadata?.pairWith === a.id
    );
    const crossPairs = validPairs.filter(
      ([a, b]) => a.metadata?.pairWith !== b.id && b.metadata?.pairWith !== a.id
    );

    // Always prefer natural pairs first (covers all 8 dimensions in ~8 rounds)
    if (naturalPairs.length > 0) {
      // Score by fewest comparisons (ensure coverage) + some randomness
      const scored = naturalPairs.map(([a, b]) => ({
        pair: [a, b] as Pair,
        score: -(a.comparisons + b.comparisons) + Math.random() * 0.5,
      }));
      scored.sort((x, y) => y.score - x.score);
      return scored[0].pair;
    }

    // If all natural pairs shown, use cross-dimension pairs for refinement
    if (crossPairs.length > 0) {
      // Prefer items with close ratings from different dimensions
      const scored = crossPairs.map(([a, b]) => ({
        pair: [a, b] as Pair,
        score: -Math.abs(a.rating - b.rating) * 0.5
          + (1 / (1 + a.comparisons + b.comparisons)) * 30
          + (a.cluster !== b.cluster ? 5 : 0), // prefer cross-cluster
      }));
      scored.sort((x, y) => y.score - x.score);
      const topN = Math.min(3, scored.length);
      return scored[Math.floor(Math.random() * topN)].pair;
    }

    return null;
  }

  // ── Designer Pool (no pairWith): original cluster-distance strategy ──
  const phase = round < 3 ? 'cross-cluster' : round < 7 ? 'refine' : 'coverage';

  let scoredPairs: { pair: Pair; score: number }[];

  if (phase === 'cross-cluster') {
    // Maximize cluster distance, with slight preference for low-comparison items
    scoredPairs = validPairs.map(([a, b]) => ({
      pair: [a, b],
      score: clusterDistance(a.cluster, b.cluster) * 10
        + (1 / (1 + a.comparisons + b.comparisons)),
    }));
  } else if (phase === 'refine') {
    // Minimize rating difference (close matches reveal fine preferences)
    // Also prefer items that have been compared less
    scoredPairs = validPairs.map(([a, b]) => ({
      pair: [a, b],
      score: -Math.abs(a.rating - b.rating)
        + (1 / (1 + a.comparisons + b.comparisons)) * 50,
    }));
  } else {
    // Coverage: prefer items with fewest comparisons
    scoredPairs = validPairs.map(([a, b]) => ({
      pair: [a, b],
      score: -(a.comparisons + b.comparisons)
        + clusterDistance(a.cluster, b.cluster) * 2,
    }));
  }

  // Sort by score descending, pick the best
  scoredPairs.sort((x, y) => y.score - x.score);

  // Add a small amount of randomness: pick from top 3 candidates
  const topN = Math.min(3, scoredPairs.length);
  const pick = scoredPairs[Math.floor(Math.random() * topN)];
  return pick.pair;
}

// ─── Recording a Choice ───

export function recordChoice(
  state: EloState,
  winnerId: string,
  loserId: string,
  totalRounds: number = 10,
): EloState {
  const K = getKFactor(state.round, totalRounds);
  const winner = state.items.find(i => i.id === winnerId);
  const loser = state.items.find(i => i.id === loserId);
  if (!winner || !loser) return state;

  // Standard Elo formula
  const expectedWin = 1 / (1 + Math.pow(10, (loser.rating - winner.rating) / 400));
  const expectedLose = 1 - expectedWin;

  const newWinnerRating = winner.rating + K * (1 - expectedWin);
  const newLoserRating = loser.rating + K * (0 - expectedLose);

  return {
    items: state.items.map(item => {
      if (item.id === winnerId) {
        return { ...item, rating: newWinnerRating, comparisons: item.comparisons + 1 };
      }
      if (item.id === loserId) {
        return { ...item, rating: newLoserRating, comparisons: item.comparisons + 1 };
      }
      return item;
    }),
    history: [...state.history, { winnerId, loserId, round: state.round }],
    round: state.round + 1,
  };
}

// ─── Signal Extraction ───

/**
 * Convert final Elo rankings into weighted TasteSignals.
 *
 * Items are sorted by rating. Top items emit signals at high confidence,
 * middle items at moderate confidence, bottom items as rejection signals.
 */
export function extractSignals(state: EloState): TasteSignal[] {
  const sorted = [...state.items]
    .filter(i => i.comparisons > 0) // Only items that were actually shown
    .sort((a, b) => b.rating - a.rating);

  if (sorted.length === 0) return [];

  const signals: TasteSignal[] = [];
  const totalItems = sorted.length;

  sorted.forEach((item, idx) => {
    const position = idx / (totalItems - 1); // 0 = top, 1 = bottom

    let confidence: number;
    let isRejection = false;

    if (position <= 0.25) {
      // Top quartile: strong positive signal
      confidence = 0.9 - position * 0.2; // 0.9 → 0.85
    } else if (position <= 0.5) {
      // Second quartile: moderate positive
      confidence = 0.7 - (position - 0.25) * 0.4; // 0.7 → 0.6
    } else if (position <= 0.75) {
      // Third quartile: weak signal, skip
      confidence = 0.4;
    } else {
      // Bottom quartile: rejection signal
      confidence = 0.6 + (position - 0.75) * 0.8; // 0.6 → 0.8
      isRejection = true;
    }

    // Only emit signals for items with meaningful confidence
    if (confidence >= 0.5 || isRejection) {
      item.signals.forEach(tag => {
        signals.push({
          tag: isRejection ? `Anti-${tag}` : tag,
          cat: isRejection ? 'Rejection' : (item.category || 'Design'),
          confidence: Math.round(confidence * 100) / 100,
        });
      });
    }
  });

  return signals;
}

// ─── Taste Axes Extraction (Phase 9 specific) ───

import type { TasteAxes, DesignerItem } from '@/types';

/**
 * Compute weighted taste axes from Elo rankings of designers.
 * Each designer has known axis positions; the user's position is
 * a weighted average based on Elo rating (higher rated = more weight).
 */
export function extractTasteAxes(
  state: EloState,
  designerPool: DesignerItem[],
): TasteAxes {
  const shownItems = state.items.filter(i => i.comparisons > 0);
  if (shownItems.length === 0) {
    return { volume: 0.5, temperature: 0.5, time: 0.5, formality: 0.5, culture: 0.5, mood: 0.5 };
  }

  // Compute softmax weights from ratings
  const maxRating = Math.max(...shownItems.map(i => i.rating));
  const weights = shownItems.map(i => Math.exp((i.rating - maxRating) / 100));
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  const normalizedWeights = weights.map(w => w / totalWeight);

  const axes: TasteAxes = { volume: 0, temperature: 0, time: 0, formality: 0, culture: 0, mood: 0 };
  const axisKeys: (keyof TasteAxes)[] = ['volume', 'temperature', 'time', 'formality', 'culture', 'mood'];

  shownItems.forEach((item, idx) => {
    const designer = designerPool.find(d => d.id === item.id);
    if (!designer) return;

    axisKeys.forEach(axis => {
      axes[axis] += designer.axes[axis] * normalizedWeights[idx];
    });
  });

  return axes;
}

// ─── Completion Check ───

export function isComplete(state: EloState, minRounds: number): boolean {
  return state.round >= minRounds;
}
