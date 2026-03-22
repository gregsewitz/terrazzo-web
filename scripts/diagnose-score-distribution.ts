/**
 * Diagnostic: Score Distribution & Cluster Activation Analysis
 *
 * Answers two questions:
 *   1. What does the actual matchScore distribution look like for a user?
 *      (Are scores compressed at the top? Is there meaningful spread?)
 *   2. How many of the 400 clusters actually activate meaningfully?
 *      (Are we wasting dimensionality on dead clusters?)
 *
 * Usage:
 *   npx tsx scripts/diagnose-score-distribution.ts [userId]
 *   (omit userId to analyze all users)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Inline helpers (avoid importing Next.js modules) ────────────────────────

function parsePgVector(text: string): number[] {
  return text.replace(/[\[\]]/g, '').split(',').map(Number);
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
  }
  return dot; // L2-normalized → dot = cosine
}

const ACTIVATION_THRESHOLD = 0.03;

// ── Score Distribution Analysis ─────────────────────────────────────────────

async function analyzeScoreDistribution(userId?: string) {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  PART 1: RAW SCORE DISTRIBUTION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Get user(s) with V3 vectors
  const users = await prisma.$queryRawUnsafe<Array<{ id: string; email: string; vec: string }>>(
    userId
      ? `SELECT id, email, "tasteVectorV3"::text as vec FROM "User" WHERE id = $1 AND "tasteVectorV3" IS NOT NULL`
      : `SELECT id, email, "tasteVectorV3"::text as vec FROM "User" WHERE "tasteVectorV3" IS NOT NULL LIMIT 10`,
    ...(userId ? [userId] : []),
  );

  if (users.length === 0) {
    console.log('No users with V3 taste vectors found.');
    return;
  }

  // Get all enriched property vectors
  const properties = await prisma.$queryRawUnsafe<Array<{ googlePlaceId: string; vec: string; name: string }>>(
    `SELECT pi."googlePlaceId", pi."embeddingV3"::text as vec,
            COALESCE((pi."googleData"->>'name')::text, pi."googlePlaceId") as name
     FROM "PlaceIntelligence" pi
     WHERE pi.status = 'complete' AND pi."embeddingV3" IS NOT NULL`,
  );

  console.log(`Found ${users.length} user(s), ${properties.length} enriched properties.\n`);

  for (const user of users) {
    const userVec = parsePgVector(user.vec);

    // Compute raw cosine×100 for every property
    const scores: Array<{ name: string; score: number }> = [];
    for (const prop of properties) {
      const propVec = parsePgVector(prop.vec);
      const raw = Math.round(cosineSim(userVec, propVec) * 100);
      scores.push({ name: prop.name, score: raw });
    }
    scores.sort((a, b) => b.score - a.score);

    // Distribution stats
    const vals = scores.map(s => s.score);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const stddev = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
    const min = vals[vals.length - 1];
    const max = vals[0];
    const p90 = vals[Math.floor(vals.length * 0.1)];
    const p75 = vals[Math.floor(vals.length * 0.25)];
    const p50 = vals[Math.floor(vals.length * 0.5)];
    const p25 = vals[Math.floor(vals.length * 0.75)];
    const p10 = vals[Math.floor(vals.length * 0.9)];

    console.log(`─── User: ${user.email} ───`);
    console.log(`  Scores computed against ${vals.length} properties`);
    console.log(`  Mean:   ${mean.toFixed(1)}    Stddev: ${stddev.toFixed(1)}`);
    console.log(`  Min:    ${min}      Max:    ${max}`);
    console.log(`  P10:    ${p10}      P25:    ${p25}      P50: ${p50}`);
    console.log(`  P75:    ${p75}      P90:    ${p90}`);
    console.log(`  Range:  ${max - min}     IQR: ${p75 - p25}`);

    // Histogram (bucket by 5)
    const buckets = new Map<number, number>();
    for (let b = -20; b <= 50; b += 5) buckets.set(b, 0);
    for (const v of vals) {
      const bucket = Math.floor(v / 5) * 5;
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    }

    console.log(`\n  Histogram (bucket size = 5):`);
    const maxCount = Math.max(...buckets.values());
    for (const [bucket, count] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
      if (count === 0) continue;
      const bar = '█'.repeat(Math.round((count / maxCount) * 40));
      const pct = ((count / vals.length) * 100).toFixed(1);
      console.log(`  ${String(bucket).padStart(4)}–${String(bucket + 4).padStart(3)}: ${bar} ${count} (${pct}%)`);
    }

    // Top 15 and bottom 5
    console.log(`\n  Top 15 matches:`);
    for (const s of scores.slice(0, 15)) {
      console.log(`    ${String(s.score).padStart(3)}  ${s.name}`);
    }
    console.log(`\n  Bottom 5:`);
    for (const s of scores.slice(-5)) {
      console.log(`    ${String(s.score).padStart(3)}  ${s.name}`);
    }

    // Tier distribution (using our new z-score thresholds)
    const tierCounts = { strong: 0, good: 0, worth_a_look: 0, mixed: 0, not_for_you: 0 };
    for (const v of vals) {
      const z = (v - mean) / stddev;
      // Using population z-thresholds from match-tier.ts
      const zPop = (v - 7) / 8.5;
      if (zPop >= 1.3) tierCounts.strong++;
      else if (zPop >= 0.3) tierCounts.good++;
      else if (zPop >= -0.5) tierCounts.worth_a_look++;
      else if (zPop >= -1.2) tierCounts.mixed++;
      else tierCounts.not_for_you++;
    }

    console.log(`\n  Tier distribution (population z-thresholds):`);
    for (const [tier, count] of Object.entries(tierCounts)) {
      const pct = ((count / vals.length) * 100).toFixed(1);
      console.log(`    ${tier.padEnd(14)} ${String(count).padStart(4)} (${pct}%)`);
    }

    // Spread in the top tier — are strong matches bunched or differentiated?
    const strongScores = vals.filter(v => ((v - 7) / 8.5) >= 1.3);
    if (strongScores.length > 1) {
      const sMin = strongScores[strongScores.length - 1];
      const sMax = strongScores[0];
      const sStddev = Math.sqrt(strongScores.reduce((s, v) => s + (v - strongScores.reduce((a, b) => a + b, 0) / strongScores.length) ** 2, 0) / strongScores.length);
      console.log(`\n  Within "Strong match" tier (${strongScores.length} places):`);
      console.log(`    Range: ${sMin}–${sMax}    Stddev: ${sStddev.toFixed(1)}`);
    }

    console.log('');
  }
}

// ── Cluster Activation Analysis ─────────────────────────────────────────────

async function analyzeClusterActivation(userId?: string) {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  PART 2: CLUSTER ACTIVATION PATTERNS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Load cluster metadata
  const fs = require('fs');
  const path = require('path');
  const clusterPath = path.join(process.cwd(), 'public', 'data', 'signal-clusters.json');

  if (!fs.existsSync(clusterPath)) {
    console.log('signal-clusters.json not found — skipping cluster analysis.');
    return;
  }

  const clusterMap = JSON.parse(fs.readFileSync(clusterPath, 'utf-8'));
  const clusterInfo: Record<string, { label: string; domain?: string; topSignals: string[] }> = clusterMap.clusters;

  // Get user vectors
  const users = await prisma.$queryRawUnsafe<Array<{ id: string; email: string; vec: string }>>(
    userId
      ? `SELECT id, email, "tasteVectorV3"::text as vec FROM "User" WHERE id = $1 AND "tasteVectorV3" IS NOT NULL`
      : `SELECT id, email, "tasteVectorV3"::text as vec FROM "User" WHERE "tasteVectorV3" IS NOT NULL LIMIT 10`,
    ...(userId ? [userId] : []),
  );

  // Get property vectors
  const properties = await prisma.$queryRawUnsafe<Array<{ vec: string }>>(
    `SELECT pi."embeddingV3"::text as vec
     FROM "PlaceIntelligence" pi
     WHERE pi.status = 'complete' AND pi."embeddingV3" IS NOT NULL`,
  );

  const totalClusters = 400;

  // ── User vector activation ────────────────────────────────────────────
  console.log('─── User Vector Activation ───\n');

  for (const user of users) {
    const vec = parsePgVector(user.vec);
    const absVals = vec.map(Math.abs);

    const activated = absVals.filter(v => v > ACTIVATION_THRESHOLD).length;
    const dead = totalClusters - activated;
    const meanAct = absVals.reduce((a, b) => a + b, 0) / totalClusters;

    // Sort by activation strength
    const indexed = absVals.map((v, i) => ({ i, v })).sort((a, b) => b.v - a.v);

    // Top 10% concentration
    const top10pct = indexed.slice(0, 40);
    const top10energy = top10pct.reduce((s, c) => s + c.v, 0);
    const totalEnergy = absVals.reduce((a, b) => a + b, 0);

    console.log(`  User: ${user.email}`);
    console.log(`    Activated clusters (|val| > ${ACTIVATION_THRESHOLD}): ${activated}/${totalClusters} (${((activated / totalClusters) * 100).toFixed(0)}%)`);
    console.log(`    Dead clusters: ${dead} (${((dead / totalClusters) * 100).toFixed(0)}%)`);
    console.log(`    Mean |activation|: ${meanAct.toFixed(4)}`);
    console.log(`    Top 10% clusters hold ${((top10energy / totalEnergy) * 100).toFixed(0)}% of total energy`);

    // Per-domain breakdown
    const domainStats: Record<string, { total: number; activated: number; energy: number }> = {};
    for (const [cidStr, info] of Object.entries(clusterInfo)) {
      const cid = parseInt(cidStr, 10);
      const domain = info.domain || 'Unknown';
      if (!domainStats[domain]) domainStats[domain] = { total: 0, activated: 0, energy: 0 };
      domainStats[domain].total++;
      domainStats[domain].energy += absVals[cid] || 0;
      if ((absVals[cid] || 0) > ACTIVATION_THRESHOLD) domainStats[domain].activated++;
    }

    console.log(`\n    Per-domain activation:`);
    for (const [domain, stats] of Object.entries(domainStats).sort((a, b) => a[0].localeCompare(b[0]))) {
      const pct = ((stats.activated / stats.total) * 100).toFixed(0);
      console.log(`      ${domain.padEnd(16)} ${String(stats.activated).padStart(3)}/${String(stats.total).padStart(3)} (${pct.padStart(3)}%)  energy: ${stats.energy.toFixed(2)}`);
    }

    // Top 10 strongest clusters
    console.log(`\n    Top 10 strongest clusters:`);
    for (const c of indexed.slice(0, 10)) {
      const info = clusterInfo[String(c.i)];
      const label = info?.label || `cluster-${c.i}`;
      const domain = info?.domain || '?';
      console.log(`      [${String(c.i).padStart(3)}] ${c.v.toFixed(4)}  ${domain.padEnd(14)} ${label}`);
    }
    console.log('');
  }

  // ── Property vector activation (aggregate) ────────────────────────────
  console.log('─── Property Vector Activation (Aggregate) ───\n');

  const clusterActivationCounts = new Array(totalClusters).fill(0);
  const clusterEnergySum = new Array(totalClusters).fill(0);

  for (const prop of properties) {
    const vec = parsePgVector(prop.vec);
    for (let i = 0; i < totalClusters; i++) {
      const abs = Math.abs(vec[i] || 0);
      if (abs > ACTIVATION_THRESHOLD) clusterActivationCounts[i]++;
      clusterEnergySum[i] += abs;
    }
  }

  const nProps = properties.length;
  const neverActivated: Array<{ i: number; label: string; domain: string }> = [];
  const rarelyActivated: Array<{ i: number; label: string; domain: string; pct: number }> = [];

  for (let i = 0; i < totalClusters; i++) {
    const pct = (clusterActivationCounts[i] / nProps) * 100;
    const info = clusterInfo[String(i)];
    const label = info?.label || `cluster-${i}`;
    const domain = info?.domain || '?';

    if (clusterActivationCounts[i] === 0) {
      neverActivated.push({ i, label, domain });
    } else if (pct < 5) {
      rarelyActivated.push({ i, label, domain, pct });
    }
  }

  // Activation frequency distribution
  const freqBuckets = new Map<string, number>();
  for (let i = 0; i < totalClusters; i++) {
    const pct = (clusterActivationCounts[i] / nProps) * 100;
    let bucket: string;
    if (pct === 0) bucket = '0% (never)';
    else if (pct < 5) bucket = '0-5% (rare)';
    else if (pct < 20) bucket = '5-20%';
    else if (pct < 50) bucket = '20-50%';
    else if (pct < 80) bucket = '50-80%';
    else bucket = '80-100% (near-universal)';
    freqBuckets.set(bucket, (freqBuckets.get(bucket) || 0) + 1);
  }

  console.log(`  Across ${nProps} properties:\n`);
  console.log(`  Cluster activation frequency:`);
  for (const [bucket, count] of [...freqBuckets.entries()]) {
    console.log(`    ${bucket.padEnd(25)} ${String(count).padStart(3)} clusters (${((count / totalClusters) * 100).toFixed(0)}%)`);
  }

  console.log(`\n  Never activated (${neverActivated.length} clusters):`);
  for (const c of neverActivated.slice(0, 20)) {
    console.log(`    [${String(c.i).padStart(3)}] ${c.domain.padEnd(14)} ${c.label}`);
  }
  if (neverActivated.length > 20) {
    console.log(`    ... and ${neverActivated.length - 20} more`);
  }

  console.log(`\n  Rarely activated (<5% of properties, ${rarelyActivated.length} clusters):`);
  rarelyActivated.sort((a, b) => a.pct - b.pct);
  for (const c of rarelyActivated.slice(0, 15)) {
    console.log(`    [${String(c.i).padStart(3)}] ${c.pct.toFixed(1)}%  ${c.domain.padEnd(14)} ${c.label}`);
  }
  if (rarelyActivated.length > 15) {
    console.log(`    ... and ${rarelyActivated.length - 15} more`);
  }

  // Summary stat
  const effectiveDims = totalClusters - neverActivated.length;
  const highUseDims = totalClusters - neverActivated.length - rarelyActivated.length;
  console.log(`\n  ── Summary ──`);
  console.log(`    Total clusters:       ${totalClusters}`);
  console.log(`    Never activated:      ${neverActivated.length} (${((neverActivated.length / totalClusters) * 100).toFixed(0)}%)`);
  console.log(`    Rarely activated:     ${rarelyActivated.length} (${((rarelyActivated.length / totalClusters) * 100).toFixed(0)}%)`);
  console.log(`    Effective dimensions: ${effectiveDims}`);
  console.log(`    High-use dimensions:  ${highUseDims}`);
  console.log(`    → ${((neverActivated.length + rarelyActivated.length) / totalClusters * 100).toFixed(0)}% of dimensions contribute minimally to cosine similarity`);
  console.log('');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const userId = process.argv[2] || undefined;

  try {
    await analyzeScoreDistribution(userId);
    await analyzeClusterActivation(userId);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
