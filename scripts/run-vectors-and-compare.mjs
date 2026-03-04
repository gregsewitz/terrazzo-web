#!/usr/bin/env node
/**
 * Taste Intelligence: Backfill Vectors + Compare Signal vs Embedding Matching
 *
 * Standalone script using raw pg (bypasses Prisma engine binary issues).
 * Ports the vector computation logic from src/lib/taste-intelligence/vectors.ts
 * and the evaluation logic from evaluation.ts + discover-candidates.ts.
 *
 * Usage:
 *   node scripts/run-vectors-and-compare.mjs               # Full pipeline
 *   node scripts/run-vectors-and-compare.mjs --skip-backfill # Compare only
 *   node scripts/run-vectors-and-compare.mjs --backfill-only # Backfill only
 */

import pg from 'pg';
import { config } from 'dotenv';
import { writeFileSync } from 'fs';
import path from 'path';

config({ path: '.env.local' });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const args = process.argv.slice(2);
const skipBackfill = args.includes('--skip-backfill');
const backfillOnly = args.includes('--backfill-only');

// ═══ Vector Computation (ported from vectors.ts) ═══════════════════════════

const ALL_TASTE_DOMAINS = ['Design', 'Atmosphere', 'Character', 'Service', 'FoodDrink', 'Setting'];
const PREFERENCE_DIMS = ['Wellness', 'Sustainability'];
const VECTOR_DIM = 136; // 8 domains + 128 hash buckets (v2.1)
const HASH_BUCKETS = 128;
const HASH_OFFSET = 8;

// FNV-1a inspired hash for deterministic signal bucketing
function hashSignalToBucket(signal, numBuckets) {
  let hash = 2166136261;
  const normalized = signal.toLowerCase().trim();
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
    hash = hash >>> 0;
  }
  return hash % numBuckets;
}

function buildSignalFeatures(signals, numBuckets) {
  const features = new Float64Array(numBuckets);
  for (const sig of signals) {
    const bucket = hashSignalToBucket(sig.signal || sig.tag || '', numBuckets);
    features[bucket] += sig.confidence || 0.5;
  }
  return features;
}

function l2Normalize(vec) {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  const result = new Float64Array(vec.length);
  for (let i = 0; i < vec.length; i++) result[i] = vec[i] / norm;
  return result;
}

// Dimension → domain mapping (for pipeline signals)
const DIMENSION_TO_DOMAIN = {
  'Design Language': 'Design',
  'Architectural Style': 'Design',
  'Material Quality': 'Design',
  'Sensory Environment': 'Atmosphere',
  'Rhythm': 'Atmosphere',
  'Scale & Intimacy': 'Atmosphere',
  'Character & Identity': 'Character',
  'CulturalEngagement': 'Character',
  'Service Philosophy': 'Service',
  'Service Style': 'Service',
  'Food & Drink Identity': 'FoodDrink',
  'Menu Personality': 'FoodDrink',
  'Location & Context': 'Setting',
  'Location & Setting': 'Setting',
  'Sustainability': 'Sustainability',
};

function computePropertyEmbedding(signals, antiSignals = []) {
  const vec = new Float64Array(VECTOR_DIM);

  // Domain weights from signals
  const domainScores = {};
  for (const domain of [...ALL_TASTE_DOMAINS, ...PREFERENCE_DIMS]) {
    domainScores[domain] = { total: 0, count: 0 };
  }

  for (const sig of signals) {
    const domain = DIMENSION_TO_DOMAIN[sig.dimension] || 'Character';
    if (domainScores[domain]) {
      domainScores[domain].total += sig.confidence || 0.5;
      domainScores[domain].count += 1;
    }
  }

  // Fill domain dimensions (0-5: taste domains, 6-7: preference dims)
  const allDomains = [...ALL_TASTE_DOMAINS, ...PREFERENCE_DIMS];
  for (let i = 0; i < allDomains.length; i++) {
    const d = domainScores[allDomains[i]];
    vec[i] = d.count > 0 ? d.total / d.count : 0;
  }

  // Fill hash bucket features (8-33)
  const features = buildSignalFeatures(signals, HASH_BUCKETS);
  for (let i = 0; i < HASH_BUCKETS; i++) {
    vec[HASH_OFFSET + i] = features[i];
  }

  // Anti-signal penalty in hash buckets
  if (antiSignals.length > 0) {
    const antiFeatures = buildSignalFeatures(
      antiSignals.map(a => ({ signal: a.signal, confidence: a.confidence || 0.5 })),
      HASH_BUCKETS
    );
    for (let i = 0; i < HASH_BUCKETS; i++) {
      vec[HASH_OFFSET + i] -= antiFeatures[i] * 0.3;
    }
  }

  return l2Normalize(vec);
}

function computeUserVector(radarData, microSignals = {}) {
  const vec = new Float64Array(VECTOR_DIM);

  // Radar data → domain dimensions
  const domainIndex = {};
  ALL_TASTE_DOMAINS.forEach((d, i) => { domainIndex[d] = i; });
  PREFERENCE_DIMS.forEach((d, i) => { domainIndex[d] = ALL_TASTE_DOMAINS.length + i; });

  for (const r of radarData || []) {
    const idx = domainIndex[r.axis];
    if (idx !== undefined) {
      vec[idx] = Math.max(vec[idx], r.value || 0);
    }
  }

  // Micro-signals → hash buckets
  const allSignals = [];
  for (const [domain, signals] of Object.entries(microSignals)) {
    if (Array.isArray(signals)) {
      for (const sig of signals) {
        allSignals.push({ signal: String(sig), confidence: 0.8 });
      }
    }
  }

  if (allSignals.length > 0) {
    const features = buildSignalFeatures(allSignals, HASH_BUCKETS);
    for (let i = 0; i < HASH_BUCKETS; i++) {
      vec[HASH_OFFSET + i] = features[i];
    }
  }

  return l2Normalize(vec);
}

function cosineSimilarity(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // Vectors are already L2-normalized
}

function similarityToScore(sim) {
  // Map [-1, 1] → [0, 100]
  return Math.round(Math.max(0, Math.min(100, (sim + 1) * 50)));
}

function vectorToSql(vec) {
  return '[' + Array.from(vec).map(v => v.toFixed(8)).join(',') + ']';
}

// ═══ Signal-Based Scoring (simplified from taste-match.ts) ═════════════════

function computeSignalScore(propertySignals, antiSignals, userProfile, userMicroSignals) {
  if (!propertySignals || propertySignals.length === 0) return { overallScore: 0, breakdown: {}, topDimension: 'Character' };

  const domainScores = {};
  const domainCounts = {};

  for (const domain of ALL_TASTE_DOMAINS) {
    domainScores[domain] = 0;
    domainCounts[domain] = 0;
  }

  // Flatten user micro-signals to keyword set
  const userKeywords = new Set();
  for (const signals of Object.values(userMicroSignals || {})) {
    if (Array.isArray(signals)) {
      for (const sig of signals) {
        for (const word of String(sig).toLowerCase().split(/\s+/)) {
          if (word.length > 3) userKeywords.add(word);
        }
      }
    }
  }

  for (const sig of propertySignals) {
    const domain = DIMENSION_TO_DOMAIN[sig.dimension] || 'Character';
    if (!domainScores.hasOwnProperty(domain)) continue;

    // Base score from confidence
    let score = (sig.confidence || 0.5) * 100;

    // Keyword overlap bonus
    const sigWords = (sig.signal || '').toLowerCase().split(/\s+/);
    const overlap = sigWords.filter(w => userKeywords.has(w)).length;
    if (overlap > 0) score *= 1 + overlap * 0.15;

    // Source credibility bonus
    if (sig.source === 'editorial_verified' || sig.source === 'award_verified') {
      score *= 1.1;
    }

    domainScores[domain] += score;
    domainCounts[domain]++;
  }

  // Anti-signal penalty
  for (const anti of (antiSignals || [])) {
    const domain = DIMENSION_TO_DOMAIN[anti.dimension] || 'Character';
    if (domainScores.hasOwnProperty(domain)) {
      const penalty = (anti.confidence || 0.5) * 100 * 0.3;
      const overlap = (anti.signal || '').toLowerCase().split(/\s+/).filter(w => userKeywords.has(w)).length;
      if (overlap > 0) {
        domainScores[domain] -= penalty * (1 + overlap * 0.2);
      }
    }
  }

  // Normalize domain scores
  const breakdown = {};
  for (const domain of ALL_TASTE_DOMAINS) {
    breakdown[domain] = domainCounts[domain] > 0
      ? Math.min(100, Math.max(0, domainScores[domain] / domainCounts[domain]))
      : 0;
  }

  // Weighted average using user radar profile
  let totalWeight = 0;
  let weightedSum = 0;
  for (const domain of ALL_TASTE_DOMAINS) {
    const weight = userProfile[domain] || 0.5;
    weightedSum += breakdown[domain] * weight;
    totalWeight += weight;
  }

  const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  // Top dimension
  let topDomain = 'Character';
  let topScore = -1;
  for (const [domain, score] of Object.entries(breakdown)) {
    if (score > topScore) { topScore = score; topDomain = domain; }
  }

  return { overallScore, breakdown, topDimension: topDomain };
}

// ═══ Pipeline Functions ════════════════════════════════════════════════════

async function backfillPropertyEmbeddings() {
  console.log('\n── Phase 2: Property Embeddings ──');

  const { rows: properties } = await pool.query(`
    SELECT id, "googlePlaceId", "propertyName", signals, "antiSignals", "signalCount"
    FROM "PlaceIntelligence"
    WHERE status = 'complete' AND "signalCount" > 0
  `);

  console.log(`  Found ${properties.length} enriched properties`);

  let computed = 0, skipped = 0;

  for (const prop of properties) {
    const signals = prop.signals || [];
    const antiSignals = prop.antiSignals || [];

    if (!Array.isArray(signals) || signals.length === 0) {
      skipped++;
      continue;
    }

    try {
      const embedding = computePropertyEmbedding(signals, antiSignals);
      const vecSql = vectorToSql(embedding);

      await pool.query(
        `UPDATE "PlaceIntelligence" SET "embedding" = $1::vector, "embeddingUpdatedAt" = NOW() WHERE "id" = $2`,
        [vecSql, prop.id]
      );
      computed++;
    } catch (err) {
      console.error(`  ✗ Failed: ${prop.propertyName}: ${err.message}`);
      skipped++;
    }
  }

  console.log(`  ✓ Embeddings: ${computed} computed, ${skipped} skipped`);
  return { total: properties.length, computed, skipped };
}

async function backfillUserVectors() {
  console.log('\n── Phase 1: User Taste Vectors ──');

  const { rows: users } = await pool.query(`
    SELECT id, name, "tasteProfile", "allSignals", "allContradictions"
    FROM "User"
    WHERE "isOnboardingComplete" = true
  `);

  console.log(`  Found ${users.length} onboarded users`);

  let vectorsComputed = 0, nodesCreated = 0;

  for (const user of users) {
    const profile = user.tasteProfile;
    if (!profile?.radarData) {
      console.log(`  ⚠ User ${user.name || user.id.slice(0, 8)}: no radarData, skipping`);
      continue;
    }

    // Extract signals → TasteNode rows
    const signals = user.allSignals || [];
    if (Array.isArray(signals) && signals.length > 0) {
      await pool.query(`DELETE FROM "TasteNode" WHERE "userId" = $1 AND source = 'onboarding'`, [user.id]);

      const validNodes = signals.filter(s => (s.confidence || 0) > 0);
      for (const s of validNodes) {
        const domain = DIMENSION_TO_DOMAIN[s.cat] || s.cat || 'Character';
        await pool.query(
          `INSERT INTO "TasteNode" (id, "userId", domain, signal, confidence, source, category, "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, 'onboarding', $5, NOW(), NOW())`,
          [user.id, domain, s.tag || s.signal || '', s.confidence || 0.5, s.cat || '']
        );
        nodesCreated++;
      }
    }

    // Extract contradictions → ContradictionNode
    const contradictions = user.allContradictions || [];
    if (Array.isArray(contradictions) && contradictions.length > 0) {
      await pool.query(`DELETE FROM "ContradictionNode" WHERE "userId" = $1`, [user.id]);
      for (const c of contradictions) {
        await pool.query(
          `INSERT INTO "ContradictionNode" (id, "userId", stated, revealed, resolution, "matchRule", strength, "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 0.5, NOW(), NOW())`,
          [user.id, c.stated || '', c.revealed || '', c.resolution || '', c.matchRule || '']
        );
      }
    }

    // Compute taste vector
    const vector = computeUserVector(profile.radarData, profile.microTasteSignals || {});
    const vecSql = vectorToSql(vector);

    await pool.query(
      `UPDATE "User" SET "tasteVector" = $1::vector, "tasteVectorUpdatedAt" = NOW() WHERE "id" = $2`,
      [vecSql, user.id]
    );
    vectorsComputed++;

    console.log(`  ✓ ${user.name || user.id.slice(0, 8)}: ${signals.length} signals, vector computed`);
  }

  console.log(`  ✓ Users: ${users.length} processed, ${vectorsComputed} vectors, ${nodesCreated} nodes`);
  return { total: users.length, vectorsComputed, nodesCreated };
}

// ═══ Comparison / Evaluation ═══════════════════════════════════════════════

async function runComparison() {
  console.log('\n┌─────────────────────────────────────────────────────────┐');
  console.log('│  COMPARISON: Signal-Based vs Embedding Cosine Scores   │');
  console.log('└─────────────────────────────────────────────────────────┘');

  // Fetch users
  const { rows: users } = await pool.query(`
    SELECT id, name, "tasteProfile", "tasteVector"::text as "tasteVectorStr"
    FROM "User"
    WHERE "isOnboardingComplete" = true AND "tasteVector" IS NOT NULL
  `);

  // Fetch properties with embeddings
  const { rows: properties } = await pool.query(`
    SELECT id, "googlePlaceId", "propertyName", signals, "antiSignals",
           "signalCount", "reliabilityScore", embedding::text as "embeddingStr"
    FROM "PlaceIntelligence"
    WHERE status = 'complete' AND "signalCount" > 0
  `);

  console.log(`\n  Users with vectors: ${users.length}`);
  console.log(`  Properties: ${properties.length}`);
  console.log(`  Properties with embeddings: ${properties.filter(p => p.embeddingStr).length}`);

  if (users.length === 0) {
    console.log('  ⚠ No users with taste vectors. Run backfill first.');
    return;
  }

  const allComparisonData = [];

  for (const user of users) {
    const profile = user.tasteProfile;
    if (!profile?.radarData) continue;

    const userMicroSignals = profile.microTasteSignals || {};
    const userContradictions = profile.contradictions || [];

    // Build user taste profile for signal scoring
    const userTasteProfile = {};
    for (const d of ALL_TASTE_DOMAINS) userTasteProfile[d] = 0.5; // default
    for (const r of profile.radarData || []) {
      if (ALL_TASTE_DOMAINS.includes(r.axis)) {
        userTasteProfile[r.axis] = Math.max(userTasteProfile[r.axis], r.value || 0);
      }
    }

    // Parse user vector
    const userVector = parseVector(user.tasteVectorStr);
    if (!userVector) {
      console.log(`  ⚠ User ${user.name}: invalid vector, skipping`);
      continue;
    }

    const rows = [];

    for (const prop of properties) {
      const signals = prop.signals || [];
      const antiSignals = prop.antiSignals || [];

      if (!Array.isArray(signals) || signals.length === 0) continue;

      // Signal-based score
      const signalResult = computeSignalScore(signals, antiSignals, userTasteProfile, userMicroSignals);

      // Vector-based score
      let vectorScore = null;
      let blendedScore = null;
      const propVector = parseVector(prop.embeddingStr);

      if (propVector && userVector) {
        const sim = cosineSimilarity(userVector, propVector);
        vectorScore = similarityToScore(sim);
        blendedScore = Math.round(vectorScore * 0.6 + signalResult.overallScore * 0.4);
      }

      const delta = vectorScore !== null ? Math.abs(vectorScore - signalResult.overallScore) : null;

      rows.push({
        propertyName: prop.propertyName,
        googlePlaceId: prop.googlePlaceId,
        signalScore: signalResult.overallScore,
        vectorScore,
        blendedScore,
        delta,
        signalCount: prop.signalCount,
        topSignalDomain: signalResult.topDimension,
      });
    }

    // Sort by delta descending
    rows.sort((a, b) => (b.delta || 0) - (a.delta || 0));

    const userName = user.name || user.id.slice(0, 8);
    const withVectors = rows.filter(r => r.vectorScore !== null);
    const withoutVectors = rows.filter(r => r.vectorScore === null);

    console.log(`\n  ══ ${userName} ══ (${withVectors.length} with embeddings, ${withoutVectors.length} without)`);

    // Aggregate stats
    if (withVectors.length > 0) {
      const signalScores = withVectors.map(r => r.signalScore);
      const vectorScores = withVectors.map(r => r.vectorScore);
      const deltas = withVectors.map(r => r.delta);

      const avgSignal = (signalScores.reduce((a, b) => a + b, 0) / signalScores.length).toFixed(1);
      const avgVector = (vectorScores.reduce((a, b) => a + b, 0) / vectorScores.length).toFixed(1);
      const avgDelta = (deltas.reduce((a, b) => a + b, 0) / deltas.length).toFixed(1);
      const maxDelta = Math.max(...deltas).toFixed(1);

      // Rank correlation (Spearman)
      const signalRanking = [...withVectors].sort((a, b) => b.signalScore - a.signalScore).map(r => r.googlePlaceId);
      const vectorRanking = [...withVectors].sort((a, b) => b.vectorScore - a.vectorScore).map(r => r.googlePlaceId);
      const rankCorr = spearmanCorrelation(signalRanking, vectorRanking);

      // Overlap@K
      const overlapAtK = (k) => {
        const n = Math.min(k, withVectors.length);
        const signalTopK = new Set(signalRanking.slice(0, n));
        const vectorTopK = vectorRanking.slice(0, n);
        return vectorTopK.filter(id => signalTopK.has(id)).length / n;
      };

      console.log(`  Avg Signal Score: ${avgSignal}`);
      console.log(`  Avg Vector Score: ${avgVector}`);
      console.log(`  Avg Delta:        ${avgDelta}  (max: ${maxDelta})`);
      console.log(`  Rank Correlation: ${rankCorr.toFixed(3)} (Spearman)`);
      console.log(`  Overlap@5:        ${(overlapAtK(5) * 100).toFixed(0)}%`);
      console.log(`  Overlap@10:       ${(overlapAtK(10) * 100).toFixed(0)}%`);
      console.log(`  Overlap@20:       ${(overlapAtK(20) * 100).toFixed(0)}%`);
    }

    // Print table header
    console.log(`\n  ${'#'.padStart(3)} ${'Property'.padEnd(42)} | Signal | Vector | Blend | Delta | Sigs | TopDomain`);
    console.log('  ' + '─'.repeat(110));

    for (let i = 0; i < Math.min(rows.length, 50); i++) {
      const r = rows[i];
      const num = (i + 1).toString().padStart(3);
      const name = r.propertyName.slice(0, 41).padEnd(42);
      const sig = r.signalScore.toString().padStart(6);
      const vec = r.vectorScore !== null ? r.vectorScore.toString().padStart(6) : '   N/A';
      const blend = r.blendedScore !== null ? r.blendedScore.toString().padStart(5) : '  N/A';
      const delta = r.delta !== null ? r.delta.toFixed(1).padStart(5) : '  N/A';
      const sigs = r.signalCount.toString().padStart(4);
      const topD = r.topSignalDomain;

      console.log(`  ${num} ${name} | ${sig} | ${vec} | ${blend} | ${delta} | ${sigs} | ${topD}`);
    }

    // Save CSV
    const csvHeader = 'Rank,Property Name,Google Place ID,Signal Score,Vector Score,Blended Score,Delta,Signal Count,Top Signal Domain';
    const csvRows = rows.map((r, i) =>
      `${i + 1},"${r.propertyName.replace(/"/g, '""')}",${r.googlePlaceId},${r.signalScore},${r.vectorScore ?? ''},${r.blendedScore ?? ''},${r.delta !== null ? r.delta.toFixed(1) : ''},${r.signalCount},${r.topSignalDomain}`
    );

    const csvPath = `comparison-${userName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.csv`;
    writeFileSync(csvPath, [csvHeader, ...csvRows].join('\n'));
    console.log(`\n  📄 Saved: ${csvPath}`);

    // Top-20 divergent
    const divergent = withVectors.slice(0, 20);
    if (divergent.length > 0) {
      console.log(`\n  ── Top ${Math.min(20, divergent.length)} Most Divergent (Signal vs Vector) ──`);
      for (let i = 0; i < Math.min(20, divergent.length); i++) {
        const r = divergent[i];
        const dir = r.vectorScore > r.signalScore ? '▲ vector higher' : '▼ signal higher';
        console.log(`  ${(i + 1).toString().padStart(3)}. ${r.propertyName.slice(0, 38).padEnd(38)} Signal:${r.signalScore.toString().padStart(3)} Vector:${r.vectorScore.toString().padStart(3)} Δ=${r.delta.toFixed(1).padStart(5)} ${dir}`);
      }
    }

    allComparisonData.push({ userName, rows, withVectors: withVectors.length, withoutVectors: withoutVectors.length });
  }

  // Save full results JSON
  const resultsPath = 'comparison-results.json';
  writeFileSync(resultsPath, JSON.stringify(allComparisonData, null, 2));
  console.log(`\n📄 Full results: ${resultsPath}`);

  return allComparisonData;
}

// Spearman rank correlation
function spearmanCorrelation(ranking1, ranking2) {
  const set1 = new Set(ranking1);
  const set2 = new Set(ranking2);
  const common = ranking1.filter(id => set2.has(id));
  if (common.length < 2) return 0;

  const rank1 = new Map(ranking1.map((id, i) => [id, i + 1]));
  const rank2 = new Map(ranking2.map((id, i) => [id, i + 1]));

  let dSquaredSum = 0;
  for (const id of common) {
    const d = (rank1.get(id) ?? 0) - (rank2.get(id) ?? 0);
    dSquaredSum += d * d;
  }

  const n = common.length;
  return 1 - (6 * dSquaredSum) / (n * (n * n - 1));
}

function parseVector(str) {
  if (!str) return null;
  try {
    const nums = str.replace(/[[\]]/g, '').split(',').map(Number);
    if (nums.length !== VECTOR_DIM || nums.some(isNaN)) return null;
    return new Float64Array(nums);
  } catch {
    return null;
  }
}

// ═══ Main ══════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Taste Intelligence — Vector Backfill & Comparison     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const startTime = Date.now();

  // Test connection
  const { rows: [{ now }] } = await pool.query('SELECT NOW()');
  console.log(`\n  Connected to database at ${now}`);

  if (!skipBackfill) {
    await backfillUserVectors();
    await backfillPropertyEmbeddings();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n  ⏱ Backfill completed in ${elapsed}s`);
  }

  if (!backfillOnly) {
    await runComparison();
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Done in ${totalElapsed}s`);

  await pool.end();
}

main().catch(err => {
  console.error('❌ Pipeline failed:', err);
  pool.end();
  process.exit(1);
});
