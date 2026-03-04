#!/usr/bin/env npx tsx
/**
 * Run full taste intelligence backfill + evaluation comparison.
 *
 * Usage:
 *   npx tsx scripts/run-backfill-and-evaluate.mts                 # Full backfill + evaluation
 *   npx tsx scripts/run-backfill-and-evaluate.mts --skip-backfill # Evaluation only
 *   npx tsx scripts/run-backfill-and-evaluate.mts --skip-eval     # Backfill only
 *   npx tsx scripts/run-backfill-and-evaluate.mts --compare-only  # Detailed per-place comparison spreadsheet
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { runFullBackfill } from '../src/lib/taste-intelligence/backfill.js';
import { evaluateAll, evaluateUser } from '../src/lib/taste-intelligence/evaluation.js';
import { fetchCandidateProperties, scoreAllCandidates, scoreWithVectors } from '../src/lib/discover-candidates.js';
import { prisma } from '../src/lib/prisma.js';
import { DEFAULT_USER_PROFILE } from '../src/lib/taste-match.js';
import type { TasteProfile, TasteDomain, TasteContradiction } from '../src/types/index.js';
import { ALL_TASTE_DOMAINS } from '../src/types/index.js';
import * as fs from 'fs';

const args = process.argv.slice(2);
const skipBackfill = args.includes('--skip-backfill');
const skipEval = args.includes('--skip-eval');
const compareOnly = args.includes('--compare-only');

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Taste Intelligence — Backfill & Evaluation Pipeline    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // ── Step 1: Run Full Backfill ──────────────────────────────────
  if (!skipBackfill && !compareOnly) {
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  PHASE 1 & 2: Full Backfill (Users + Property Embeds)  │');
    console.log('└─────────────────────────────────────────────────────────┘');
    console.log('');

    const startTime = Date.now();
    const { userResults, propResults } = await runFullBackfill();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('');
    console.log(`⏱  Backfill completed in ${elapsed}s`);
    console.log(`   Users processed: ${userResults.length}`);
    console.log(`   Vectors computed: ${userResults.filter(r => r.vectorComputed).length}`);
    console.log(`   Properties embedded: ${propResults.computed} / ${propResults.total}`);
    console.log('');
  }

  // ── Step 2: Run Evaluation ─────────────────────────────────────
  if (!skipEval && !compareOnly) {
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  EVALUATION: Signal-Based vs Vector-Enhanced Matching   │');
    console.log('└─────────────────────────────────────────────────────────┘');
    console.log('');

    const evalStart = Date.now();
    const evalResults = await evaluateAll();
    const evalElapsed = ((Date.now() - evalStart) / 1000).toFixed(1);

    console.log(`⏱  Evaluation completed in ${evalElapsed}s`);
    console.log('');

    // ── Aggregate Results ────────────────────────────────────────
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  AGGREGATE RESULTS                                      │');
    console.log('└─────────────────────────────────────────────────────────┘');
    const agg = evalResults.aggregate;
    console.log(`  Avg Overlap@10:        ${(agg.avgOverlapAt10 * 100).toFixed(1)}%`);
    console.log(`  Avg Rank Correlation:  ${agg.avgRankCorrelation.toFixed(3)} (Spearman)`);
    console.log(`  Avg Blended Delta:     ${agg.avgBlendedDelta.toFixed(2)} pts`);
    console.log(`  Avg Embedding Coverage:${(agg.avgEmbeddingCoverage * 100).toFixed(1)}%`);
    console.log(`  Vector Enabled Rate:   ${(agg.vectorEnabledRate * 100).toFixed(0)}%`);
    console.log('');

    // ── Per-User Results ─────────────────────────────────────────
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  PER-USER BREAKDOWN                                     │');
    console.log('└─────────────────────────────────────────────────────────┘');
    for (const ur of evalResults.userResults) {
      console.log(`  User: ${ur.userId.slice(0, 8)}...`);
      console.log(`    Candidates:       ${ur.candidateCount}`);
      console.log(`    Embedding Cover:  ${(ur.embeddingCoverage * 100).toFixed(1)}%`);
      console.log(`    Overlap@5/10/20:  ${(ur.overlapAt5 * 100).toFixed(0)}% / ${(ur.overlapAt10 * 100).toFixed(0)}% / ${(ur.overlapAt20 * 100).toFixed(0)}%`);
      console.log(`    Rank Correlation: ${ur.rankCorrelation.toFixed(3)}`);
      console.log(`    Signal Mean:      ${ur.signalOnly.mean.toFixed(1)} (σ=${ur.signalOnly.stdDev.toFixed(1)})`);
      console.log(`    Vector Mean:      ${ur.vectorEnhanced.mean.toFixed(1)} (σ=${ur.vectorEnhanced.stdDev.toFixed(1)})`);
      console.log(`    Blended Delta:    ${ur.blendedDelta >= 0 ? '+' : ''}${ur.blendedDelta.toFixed(2)}`);
      console.log('');
    }

    // Save results to JSON
    const outputPath = 'evaluation-results.json';
    fs.writeFileSync(outputPath, JSON.stringify(evalResults, null, 2));
    console.log(`📄 Full results saved to ${outputPath}`);
    console.log('');
  }

  // ── Step 3: Detailed Per-Place Comparison ──────────────────────
  if (compareOnly || (!skipEval && !skipBackfill)) {
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  DETAILED PER-PLACE COMPARISON (Signal vs Embedding)   │');
    console.log('└─────────────────────────────────────────────────────────┘');
    console.log('');

    await generateDetailedComparison();
  }

  await prisma.$disconnect();
  console.log('✅ Done.');
}

/**
 * Generate the detailed per-place comparison spreadsheet described in taste-taxonomy-v2-spec.md:
 * Place name, city, signal-based score, embedding cosine score, delta, signal count,
 * top signal domain, top embedding domain — sorted by delta descending.
 */
async function generateDetailedComparison() {
  // Get all onboarded users
  const users = await prisma.user.findMany({
    where: { isOnboardingComplete: true },
    select: {
      id: true,
      name: true,
      tasteProfile: true,
      allSignals: true,
    },
  });

  if (users.length === 0) {
    console.log('  ⚠ No onboarded users found. Skipping detailed comparison.');
    return;
  }

  const candidates = await fetchCandidateProperties();
  console.log(`  Found ${candidates.length} enriched properties and ${users.length} users`);

  for (const user of users) {
    const profile = user.tasteProfile as any;
    if (!profile?.radarData) continue;

    const userMicroSignals = profile.microTasteSignals || {};
    const userContradictions: TasteContradiction[] = profile.contradictions || [];
    const userTasteProfile: TasteProfile = { ...DEFAULT_USER_PROFILE };

    const validDomains = new Set<string>(ALL_TASTE_DOMAINS);
    for (const r of profile.radarData || []) {
      if (validDomains.has(r.axis)) {
        userTasteProfile[r.axis as TasteDomain] = Math.max(
          userTasteProfile[r.axis as TasteDomain], r.value
        );
      }
    }

    // Signal-only scoring
    const signalResults = scoreAllCandidates(
      candidates, userTasteProfile, userMicroSignals, userContradictions
    );

    // Vector-enhanced scoring
    const { results: vectorResults, vectorEnabled } = await scoreWithVectors(
      user.id, candidates, userTasteProfile, userMicroSignals, userContradictions
    );

    // Build comparison rows
    const signalMap = new Map(signalResults.map(r => [r.googlePlaceId, r]));
    const vectorMap = new Map(vectorResults.map(r => [r.googlePlaceId, r]));

    interface ComparisonRow {
      propertyName: string;
      googlePlaceId: string;
      signalScore: number;
      vectorScore: number | undefined;
      blendedScore: number | undefined;
      delta: number;
      signalCount: number;
      topSignalDomain: string;
      topVectorDomain: string;
    }

    const rows: ComparisonRow[] = [];

    for (const candidate of candidates) {
      const sig = signalMap.get(candidate.googlePlaceId);
      const vec = vectorMap.get(candidate.googlePlaceId);

      if (!sig) continue;

      const signalScore = sig.overallScore;
      const vectorScore = vec?.vectorScore;
      const blendedScore = vec?.blendedScore;
      const delta = vectorScore !== undefined ? Math.abs(vectorScore - signalScore) : 0;

      rows.push({
        propertyName: candidate.propertyName,
        googlePlaceId: candidate.googlePlaceId,
        signalScore,
        vectorScore,
        blendedScore,
        delta,
        signalCount: candidate.signalCount,
        topSignalDomain: sig.topDimension,
        topVectorDomain: vec?.topDimension || 'N/A',
      });
    }

    // Sort by delta descending (biggest disagreements first)
    rows.sort((a, b) => b.delta - a.delta);

    const userName = user.name || user.id.slice(0, 8);
    console.log(`\n  ══ User: ${userName} (vectorEnabled: ${vectorEnabled}) ══`);
    console.log(`  ${'Property'.padEnd(45)} | Signal | Vector | Blend | Delta | Signals | TopSigDomain  | TopVecDomain`);
    console.log('  ' + '─'.repeat(130));

    for (const row of rows.slice(0, 50)) {  // Show top 50
      const name = row.propertyName.slice(0, 44).padEnd(45);
      const sig = row.signalScore.toString().padStart(6);
      const vec = row.vectorScore !== undefined ? row.vectorScore.toFixed(0).padStart(6) : '   N/A';
      const blend = row.blendedScore !== undefined ? row.blendedScore.toFixed(0).padStart(5) : '  N/A';
      const delta = row.delta.toFixed(1).padStart(5);
      const sigCount = row.signalCount.toString().padStart(7);
      const topSig = row.topSignalDomain.padEnd(14);
      const topVec = row.topVectorDomain;

      console.log(`  ${name} | ${sig} | ${vec} | ${blend} | ${delta} |${sigCount} | ${topSig}| ${topVec}`);
    }

    // Save full CSV for this user
    const csvRows = [
      'Property Name,Google Place ID,Signal Score,Vector Score,Blended Score,Delta,Signal Count,Top Signal Domain,Top Vector Domain',
      ...rows.map(r =>
        `"${r.propertyName.replace(/"/g, '""')}",${r.googlePlaceId},${r.signalScore},${r.vectorScore ?? ''},${r.blendedScore ?? ''},${r.delta.toFixed(1)},${r.signalCount},${r.topSignalDomain},${r.topVectorDomain}`
      ),
    ];

    const csvPath = `comparison-${userName.replace(/\s+/g, '-').toLowerCase()}.csv`;
    fs.writeFileSync(csvPath, csvRows.join('\n'));
    console.log(`\n  📄 Full comparison saved to ${csvPath}`);

    // Print top-20 divergent cases (as specified in taste-taxonomy-v2-spec.md)
    const divergent = rows.filter(r => r.vectorScore !== undefined).slice(0, 20);
    if (divergent.length > 0) {
      console.log(`\n  ── Top ${divergent.length} Most Divergent Cases ──`);
      for (let i = 0; i < divergent.length; i++) {
        const r = divergent[i];
        console.log(`  ${(i + 1).toString().padStart(3)}. ${r.propertyName.slice(0, 40)} — Signal: ${r.signalScore}, Vector: ${r.vectorScore?.toFixed(0)}, Δ=${r.delta.toFixed(1)}`);
      }
    }
  }
}

main().catch((err) => {
  console.error('❌ Pipeline failed:', err);
  process.exit(1);
});
