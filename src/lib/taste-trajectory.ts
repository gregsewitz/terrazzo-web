/**
 * Taste Trajectory Detection
 *
 * Compares current vs historical signal clusters per domain to detect
 * how a user's taste is evolving over time.
 *
 * Four trajectory directions:
 * - REFINING: Depth increases without breadth (same domains, higher confidence)
 * - EXPANDING: New domains or signals gaining presence
 * - SHIFTING: Dominant signals moving from one pattern to another
 * - STABLE: Minimal change detected
 */

import type {
  TasteDomain,
  TrajectoryDirection,
  TasteTrajectoryShift,
  ALL_TASTE_DOMAINS,
} from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SignalSnapshot {
  domain: string;
  signal: string;
  confidence: number;
  extractedAt?: string;
}

interface DomainCluster {
  domain: TasteDomain;
  topSignals: string[];   // top 3 signal tags by confidence
  avgConfidence: number;
  signalCount: number;
}

export interface TrajectoryAnalysis {
  direction: TrajectoryDirection;
  shifts: Omit<TasteTrajectoryShift, 'id'>[];
  description: string;
  confidence: number; // 0-1, how confident we are in this trajectory assessment
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clusterByDomain(signals: SignalSnapshot[]): Map<string, DomainCluster> {
  const grouped = new Map<string, SignalSnapshot[]>();

  for (const sig of signals) {
    const existing = grouped.get(sig.domain) || [];
    existing.push(sig);
    grouped.set(sig.domain, existing);
  }

  const clusters = new Map<string, DomainCluster>();
  for (const [domain, sigs] of grouped) {
    const sorted = [...sigs].sort((a, b) => b.confidence - a.confidence);
    clusters.set(domain, {
      domain: domain as TasteDomain,
      topSignals: sorted.slice(0, 3).map(s => s.signal),
      avgConfidence: sigs.reduce((sum, s) => sum + s.confidence, 0) / sigs.length,
      signalCount: sigs.length,
    });
  }

  return clusters;
}

/**
 * Compute overlap between two sets of signal tags.
 * Returns 0-1 (1 = identical sets, 0 = no overlap).
 */
function signalOverlap(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const setA = new Set(a.map(s => s.toLowerCase()));
  const setB = new Set(b.map(s => s.toLowerCase()));
  let overlap = 0;
  for (const item of setA) {
    if (setB.has(item)) overlap++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? overlap / union : 0;
}

// ─── Core Detection ──────────────────────────────────────────────────────────

/**
 * Detect trajectory shifts by comparing current signals against a historical snapshot.
 *
 * @param currentSignals  - Recent signals (e.g., last 90 days)
 * @param historicalSignals - Older signals (e.g., 90-270 days ago)
 * @param domains - List of domains to analyze
 */
export function detectTrajectoryShifts(
  currentSignals: SignalSnapshot[],
  historicalSignals: SignalSnapshot[],
  domains: readonly string[] | string[],
): Omit<TasteTrajectoryShift, 'id'>[] {
  const currentClusters = clusterByDomain(currentSignals);
  const historicalClusters = clusterByDomain(historicalSignals);

  const shifts: Omit<TasteTrajectoryShift, 'id'>[] = [];

  for (const domain of domains) {
    const current = currentClusters.get(domain);
    const historical = historicalClusters.get(domain);

    // No data in either period — skip
    if (!current && !historical) continue;

    // New domain emerging (signals exist now but didn't before)
    if (current && !historical && current.signalCount >= 2) {
      shifts.push({
        domain: domain as TasteDomain,
        fromPattern: '(none)',
        toPattern: current.topSignals.join(', '),
        detectedAt: new Date().toISOString(),
      });
      continue;
    }

    // Domain going dormant (had signals before, few or none now)
    if (historical && (!current || current.signalCount === 0)) {
      shifts.push({
        domain: domain as TasteDomain,
        fromPattern: historical.topSignals.join(', '),
        toPattern: '(dormant)',
        detectedAt: new Date().toISOString(),
      });
      continue;
    }

    // Both periods have data — check if top signals shifted
    if (current && historical) {
      const overlap = signalOverlap(current.topSignals, historical.topSignals);

      // Low overlap = the dominant signals have changed
      if (overlap < 0.3 && current.signalCount >= 2 && historical.signalCount >= 2) {
        shifts.push({
          domain: domain as TasteDomain,
          fromPattern: historical.topSignals.join(', '),
          toPattern: current.topSignals.join(', '),
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  return shifts;
}

/**
 * Determine the overall trajectory direction from detected shifts.
 */
export function classifyTrajectory(
  currentSignals: SignalSnapshot[],
  historicalSignals: SignalSnapshot[],
  shifts: Omit<TasteTrajectoryShift, 'id'>[],
): TrajectoryDirection {
  const currentClusters = clusterByDomain(currentSignals);
  const historicalClusters = clusterByDomain(historicalSignals);

  // Count domains that gained vs lost signals
  let domainsGained = 0;
  let domainsLost = 0;
  let confidenceIncrease = 0;
  let confidenceDecrease = 0;

  for (const [domain, current] of currentClusters) {
    const historical = historicalClusters.get(domain);
    if (!historical) {
      domainsGained++;
    } else {
      if (current.avgConfidence > historical.avgConfidence + 0.1) confidenceIncrease++;
      if (current.avgConfidence < historical.avgConfidence - 0.1) confidenceDecrease++;
    }
  }
  for (const domain of historicalClusters.keys()) {
    if (!currentClusters.has(domain)) domainsLost++;
  }

  // Few or no shifts = STABLE
  if (shifts.length === 0) return 'STABLE';

  // New domains appearing without losing old ones = EXPANDING
  if (domainsGained > domainsLost && shifts.some(s => s.fromPattern === '(none)')) {
    return 'EXPANDING';
  }

  // Confidence increasing, same domains = REFINING
  if (confidenceIncrease > confidenceDecrease && domainsGained <= 1) {
    return 'REFINING';
  }

  // Multiple shifts with signal changes = SHIFTING
  if (shifts.length >= 2) return 'SHIFTING';

  return 'STABLE';
}

/**
 * Full trajectory analysis: detect shifts, classify direction, generate description.
 */
export function analyzeTrajectory(
  currentSignals: SignalSnapshot[],
  historicalSignals: SignalSnapshot[],
  domains: readonly string[] | string[],
): TrajectoryAnalysis {
  const shifts = detectTrajectoryShifts(currentSignals, historicalSignals, domains);
  const direction = classifyTrajectory(currentSignals, historicalSignals, shifts);

  // Generate human-readable description
  let description: string;
  switch (direction) {
    case 'REFINING':
      description = 'Your taste is deepening — same preferences, stronger convictions.';
      break;
    case 'EXPANDING':
      description = 'Your palate is broadening — new domains are emerging in your taste profile.';
      break;
    case 'SHIFTING':
      description = `Your preferences are evolving across ${shifts.length} domain${shifts.length > 1 ? 's' : ''}.`;
      break;
    case 'STABLE':
    default:
      description = 'Your taste profile is consistent — strong signal stability.';
  }

  // Confidence based on data quality
  const totalSignals = currentSignals.length + historicalSignals.length;
  const confidence = Math.min(1, totalSignals / 20); // Need ~20 signals for high confidence

  return { direction, shifts, description, confidence };
}
