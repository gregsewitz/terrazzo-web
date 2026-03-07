/**
 * Vector Evaluation & Reporting
 *
 * Cross-archetype discrimination metrics and markdown report generation.
 * No expectedTopProperties/expectedBottomProperties exist in archetypes,
 * so evaluation is purely cross-archetype discrimination.
 */

import { cosineSimilarityV3 } from '../../../src/lib/taste-intelligence/vectors-v3';
import type { TasteArchetype } from '../archetypes';
import type { SignalGenerationResult } from './signal-generator-v2';
import type { ScoringResult, VectorMatch } from './vector-scorer';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArchetypeStats {
  id: string;
  name: string;
  signalTotal: number;
  signalPositive: number;
  signalRejection: number;
  uniqueTags: number;
  simRange: number;     // max - min similarity across all properties
  simMax: number;
  simMin: number;
  top5: Array<{ name: string; sim: number }>;
}

export interface PairwiseResult {
  archetypeA: string;
  archetypeB: string;
  vectorDistance: number;    // 1 - cosine(vecA, vecB)
  meanScoreDelta: number;   // mean |simA_i - simB_i| across all properties, ×100
  pass: boolean;
}

export interface EvaluationReport {
  timestamp: string;
  runtimeMs: number;
  archetypeCount: number;
  propertyCount: number;
  // Aggregate
  overallPassRate: number;    // fraction of pairs passing
  passingPairs: number;
  totalPairs: number;
  meanVectorDistance: number;
  meanScoreDelta: number;
  // Per-archetype
  archetypeStats: ArchetypeStats[];
  // Pairwise
  pairwise: PairwiseResult[];
  // Signal coverage
  totalUniqueTags: number;
  meanOverlap: number;  // avg Jaccard similarity between archetype tag sets
}

// ─── Evaluation Logic ─────────────────────────────────────────────────────────

const PASS_THRESHOLD = 5.0; // minimum mean Δ for a pair to pass

export function evaluate(
  archetypes: TasteArchetype[],
  scoring: ScoringResult,
  signalResults: Map<string, SignalGenerationResult>,
  runtimeMs: number,
): EvaluationReport {
  const timestamp = new Date().toISOString();
  const propertyCount = scoring.propertyVectors.size;

  // ── Per-archetype stats ──
  const archetypeStats: ArchetypeStats[] = [];
  for (const arch of archetypes) {
    const sigResult = signalResults.get(arch.id);
    const matches = scoring.matchesByArchetype.get(arch.id) || [];
    const sims = matches.map(m => m.similarity);
    const simMax = sims.length > 0 ? Math.max(...sims) : 0;
    const simMin = sims.length > 0 ? Math.min(...sims) : 0;

    archetypeStats.push({
      id: arch.id,
      name: (arch as any).name || arch.id,
      signalTotal: sigResult?.stats.total || 0,
      signalPositive: sigResult?.stats.positive || 0,
      signalRejection: sigResult?.stats.rejection || 0,
      uniqueTags: sigResult?.stats.uniqueTags || 0,
      simRange: simMax - simMin,
      simMax,
      simMin,
      top5: matches.slice(0, 5).map(m => ({ name: m.propertyName, sim: m.similarity })),
    });
  }

  // ── Pairwise discrimination ──
  const pairwise: PairwiseResult[] = [];
  const ids = archetypes.map(a => a.id);

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const aId = ids[i];
      const bId = ids[j];

      // Vector distance
      const vecA = scoring.archetypeVectors.get(aId)!;
      const vecB = scoring.archetypeVectors.get(bId)!;
      const vectorDistance = 1 - cosineSimilarityV3(vecA, vecB);

      // Mean score delta across all properties
      const aMatches = scoring.matchesByArchetype.get(aId)!;
      const bMatches = scoring.matchesByArchetype.get(bId)!;

      // Build property → similarity lookup for B
      const bSimMap = new Map<string, number>();
      for (const m of bMatches) {
        bSimMap.set(m.propertyId, m.similarity);
      }

      let deltaSum = 0;
      let count = 0;
      for (const m of aMatches) {
        const bSim = bSimMap.get(m.propertyId);
        if (bSim !== undefined) {
          deltaSum += Math.abs(m.similarity - bSim) * 100; // scale to 0-100
          count++;
        }
      }
      const meanScoreDelta = count > 0 ? deltaSum / count : 0;

      pairwise.push({
        archetypeA: aId,
        archetypeB: bId,
        vectorDistance,
        meanScoreDelta,
        pass: meanScoreDelta > PASS_THRESHOLD,
      });
    }
  }

  // Sort pairwise by meanScoreDelta descending (best discrimination first)
  pairwise.sort((a, b) => b.meanScoreDelta - a.meanScoreDelta);

  const passingPairs = pairwise.filter(p => p.pass).length;
  const totalPairs = pairwise.length;
  const overallPassRate = totalPairs > 0 ? passingPairs / totalPairs : 0;
  const meanVectorDistance = pairwise.length > 0
    ? pairwise.reduce((s, p) => s + p.vectorDistance, 0) / pairwise.length
    : 0;
  const meanScoreDelta = pairwise.length > 0
    ? pairwise.reduce((s, p) => s + p.meanScoreDelta, 0) / pairwise.length
    : 0;

  // ── Signal coverage / overlap ──
  const tagSets = new Map<string, Set<string>>();
  for (const arch of archetypes) {
    const sigResult = signalResults.get(arch.id);
    if (sigResult) {
      const positives = new Set(
        sigResult.signals.filter(s => s.cat !== 'Rejection').map(s => s.tag),
      );
      tagSets.set(arch.id, positives);
    }
  }

  const allTags = new Set<string>();
  for (const tags of tagSets.values()) {
    for (const t of tags) allTags.add(t);
  }

  // Mean Jaccard similarity between all archetype pairs
  let jaccardSum = 0;
  let jaccardCount = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = tagSets.get(ids[i]) || new Set<string>();
      const b = tagSets.get(ids[j]) || new Set<string>();
      let intersection = 0;
      for (const t of a) { if (b.has(t)) intersection++; }
      const union = a.size + b.size - intersection;
      if (union > 0) {
        jaccardSum += intersection / union;
        jaccardCount++;
      }
    }
  }
  const meanOverlap = jaccardCount > 0 ? jaccardSum / jaccardCount : 0;

  return {
    timestamp,
    runtimeMs,
    archetypeCount: archetypes.length,
    propertyCount,
    overallPassRate,
    passingPairs,
    totalPairs,
    meanVectorDistance,
    meanScoreDelta,
    archetypeStats,
    pairwise,
    totalUniqueTags: allTags.size,
    meanOverlap,
  };
}

// ─── Markdown Report ──────────────────────────────────────────────────────────

export function generateReport(report: EvaluationReport): string {
  const lines: string[] = [];
  const ln = (s = '') => lines.push(s);

  ln(`# Vector-Cosine Synthetic Pipeline Report`);
  ln();
  ln(`**Generated:** ${report.timestamp}`);
  ln(`**Runtime:** ${(report.runtimeMs / 1000).toFixed(2)}s`);
  ln(`**Archetypes:** ${report.archetypeCount}  |  **Properties:** ${report.propertyCount}`);
  ln();

  // ── Summary ──
  ln(`## Summary`);
  ln();
  ln(`| Metric | Value |`);
  ln(`|--------|-------|`);
  ln(`| Pass Rate (pairs) | ${report.passingPairs}/${report.totalPairs} (${(report.overallPassRate * 100).toFixed(1)}%) |`);
  ln(`| Mean Pairwise Δ | ${report.meanScoreDelta.toFixed(2)} |`);
  ln(`| Mean Vector Distance | ${report.meanVectorDistance.toFixed(4)} |`);
  ln(`| Unique Signal Tags | ${report.totalUniqueTags} |`);
  ln(`| Mean Tag Overlap (Jaccard) | ${(report.meanOverlap * 100).toFixed(1)}% |`);
  ln(`| Pass Threshold | mean Δ > ${PASS_THRESHOLD} |`);
  ln();

  // ── Per-Archetype ──
  ln(`## Per-Archetype Stats`);
  ln();
  ln(`| Archetype | Signals | +/− | Unique | Sim Range | Top Property |`);
  ln(`|-----------|---------|-----|--------|-----------|-------------|`);
  for (const a of report.archetypeStats) {
    const topProp = a.top5[0]?.name || '—';
    const topSim = a.top5[0]?.sim.toFixed(3) || '—';
    ln(`| ${a.name} | ${a.signalTotal} | ${a.signalPositive}/${a.signalRejection} | ${a.uniqueTags} | ${a.simRange.toFixed(3)} | ${topProp} (${topSim}) |`);
  }
  ln();

  // ── Top-5 per archetype ──
  ln(`## Top-5 Properties per Archetype`);
  ln();
  for (const a of report.archetypeStats) {
    ln(`**${a.name}**`);
    for (let i = 0; i < a.top5.length; i++) {
      ln(`  ${i + 1}. ${a.top5[i].name} (${a.top5[i].sim.toFixed(3)})`);
    }
    ln();
  }

  // ── Pairwise Discrimination ──
  ln(`## Pairwise Discrimination (sorted best → worst)`);
  ln();
  ln(`| # | Archetype A | Archetype B | Mean Δ | Vec Dist | Pass |`);
  ln(`|---|------------|------------|--------|----------|------|`);

  // Show top 20 + bottom 20 if >40 pairs
  const showAll = report.pairwise.length <= 40;
  const topN = showAll ? report.pairwise : report.pairwise.slice(0, 20);
  const bottomN = showAll ? [] : report.pairwise.slice(-20);

  for (let i = 0; i < topN.length; i++) {
    const p = topN[i];
    const nameA = report.archetypeStats.find(a => a.id === p.archetypeA)?.name || p.archetypeA;
    const nameB = report.archetypeStats.find(a => a.id === p.archetypeB)?.name || p.archetypeB;
    ln(`| ${i + 1} | ${nameA} | ${nameB} | ${p.meanScoreDelta.toFixed(2)} | ${p.vectorDistance.toFixed(4)} | ${p.pass ? '✓' : '✗'} |`);
  }

  if (bottomN.length > 0) {
    ln(`| ... | ... | ... | ... | ... | ... |`);
    for (let i = 0; i < bottomN.length; i++) {
      const idx = report.pairwise.length - bottomN.length + i + 1;
      const p = bottomN[i];
      const nameA = report.archetypeStats.find(a => a.id === p.archetypeA)?.name || p.archetypeA;
      const nameB = report.archetypeStats.find(a => a.id === p.archetypeB)?.name || p.archetypeB;
      ln(`| ${idx} | ${nameA} | ${nameB} | ${p.meanScoreDelta.toFixed(2)} | ${p.vectorDistance.toFixed(4)} | ${p.pass ? '✓' : '✗'} |`);
    }
  }
  ln();

  // ── Interpretation ──
  ln(`## Interpretation`);
  ln();
  ln(`- **Pass Rate**: ${(report.overallPassRate * 100).toFixed(0)}% of archetype pairs produce meaningfully different property rankings`);
  ln(`- **Mean Tag Overlap**: ${(report.meanOverlap * 100).toFixed(0)}% Jaccard similarity between positive tag sets (lower = more diverse)`);
  ln(`- **Vector Distance**: ${report.meanVectorDistance.toFixed(3)} mean distance (0 = identical, 2 = opposite)`);
  if (report.overallPassRate < 0.5) {
    ln(`- ⚠️ Less than 50% pass rate — signal generation may need tuning`);
  }
  if (report.meanOverlap > 0.6) {
    ln(`- ⚠️ High tag overlap — archetypes may share too many signal tags`);
  }
  ln();

  return lines.join('\n');
}
