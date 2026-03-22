/**
 * Eval History — Score Tracking & Diff Reporting
 * ────────────────────────────────────────────────
 * Stores scored results after each eval run so you can track improvements
 * and regressions over time. The flywheel: change → run → compare → improve.
 */

import fs from 'fs';
import path from 'path';

const HISTORY_PATH = path.join(__dirname, 'history.json');

export interface HistoryEntry {
  timestamp: string;          // ISO 8601
  label?: string;             // optional run label (e.g., "softened-geo-fencing")
  results: Record<string, number>;  // testId → overallScore
  overall: number;            // average across all tests
  testCount: number;
}

export function loadHistory(): HistoryEntry[] {
  try {
    if (!fs.existsSync(HISTORY_PATH)) return [];
    const raw = fs.readFileSync(HISTORY_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveEntry(entry: HistoryEntry): void {
  const history = loadHistory();
  history.push(entry);
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
}

export function getLastEntry(): HistoryEntry | null {
  const history = loadHistory();
  return history.length > 0 ? history[history.length - 1] : null;
}

export interface ScoreDiff {
  testId: string;
  current: number;
  previous: number | null;  // null = new test
  delta: number;
}

export function computeDiffs(
  current: Record<string, number>,
  previous: HistoryEntry | null,
): { diffs: ScoreDiff[]; overallDelta: number | null } {
  if (!previous) {
    return {
      diffs: Object.entries(current).map(([id, score]) => ({
        testId: id, current: score, previous: null, delta: 0,
      })),
      overallDelta: null,
    };
  }

  const diffs: ScoreDiff[] = [];
  for (const [id, score] of Object.entries(current)) {
    const prev = previous.results[id] ?? null;
    diffs.push({
      testId: id,
      current: score,
      previous: prev,
      delta: prev !== null ? score - prev : 0,
    });
  }

  const currentOverall = Object.values(current).reduce((a, b) => a + b, 0) / Object.values(current).length;
  const overallDelta = currentOverall - previous.overall;

  return { diffs, overallDelta };
}

export function formatDiffLine(diff: ScoreDiff): string {
  if (diff.previous === null) return '\x1b[36m← NEW\x1b[0m';
  if (Math.abs(diff.delta) < 0.005) return '';
  const pct = (diff.delta * 100).toFixed(0);
  const sign = diff.delta > 0 ? '+' : '';
  const color = diff.delta > 0 ? '\x1b[32m' : '\x1b[31m';
  return `${color}← was ${(diff.previous * 100).toFixed(0)}%, ${sign}${pct}%\x1b[0m`;
}
