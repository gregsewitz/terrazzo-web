/**
 * Compare Signal-Based vs Embedding-Based Scoring
 *
 * Standalone script — connects directly to Supabase via pg.
 * Runs both scoring approaches and outputs analysis.
 */

import pg from 'pg';
const { Pool } = pg;

const USER_ID = 'cmlvca5sx000004lasyug8tqw';

// Direct connection (not pooler) for raw SQL
const pool = new Pool({
  connectionString: 'postgresql://postgres.wqbzfhlxvjppepkeudyd:wjd0cmx8DWF-qjn*udp@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

// ─── Taste Domain Mapping ───────────────────────────────────────────────────

const ALL_DOMAINS = ['Design', 'Atmosphere', 'Character', 'Service', 'FoodDrink', 'Setting', 'Wellness', 'Sustainability'];

const DIMENSION_TO_DOMAIN = {
  Design: 'Design', Atmosphere: 'Atmosphere', Character: 'Character',
  Service: 'Service', FoodDrink: 'FoodDrink', Setting: 'Setting',
  Wellness: 'Wellness', Sustainability: 'Sustainability',
  // Common sub-dimensions
  'interior_design': 'Design', 'architectural_style': 'Design', 'aesthetic': 'Design',
  'material_quality': 'Design', 'visual_identity': 'Design', 'color_palette': 'Design',
  'lighting_design': 'Design', 'furniture': 'Design', 'art_curation': 'Design',
  'spatial_design': 'Design', 'bathroom_design': 'Design', 'design_philosophy': 'Design',
  'vibe': 'Atmosphere', 'energy': 'Atmosphere', 'ambiance': 'Atmosphere',
  'mood': 'Atmosphere', 'sensory': 'Atmosphere', 'pace': 'Atmosphere',
  'sound': 'Atmosphere', 'scent': 'Atmosphere', 'music': 'Atmosphere',
  'story': 'Character', 'heritage': 'Character', 'identity': 'Character',
  'personality': 'Character', 'authenticity': 'Character', 'history': 'Character',
  'community': 'Character', 'culture': 'Character', 'ownership': 'Character',
  'hospitality': 'Service', 'staff': 'Service', 'attention_to_detail': 'Service',
  'personalization': 'Service', 'concierge': 'Service', 'check_in': 'Service',
  'food': 'FoodDrink', 'drink': 'FoodDrink', 'dining': 'FoodDrink',
  'restaurant': 'FoodDrink', 'bar': 'FoodDrink', 'breakfast': 'FoodDrink',
  'cuisine': 'FoodDrink', 'wine': 'FoodDrink', 'cocktails': 'FoodDrink',
  'coffee': 'FoodDrink', 'culinary': 'FoodDrink',
  'location': 'Setting', 'view': 'Setting', 'landscape': 'Setting',
  'neighborhood': 'Setting', 'surroundings': 'Setting', 'nature': 'Setting',
  'geography': 'Setting', 'beach': 'Setting', 'urban': 'Setting',
  'pool': 'Wellness', 'spa': 'Wellness', 'fitness': 'Wellness',
  'wellness_philosophy': 'Wellness', 'relaxation': 'Wellness', 'yoga': 'Wellness',
  'eco': 'Sustainability', 'sustainability_practices': 'Sustainability',
  'environmental': 'Sustainability', 'green': 'Sustainability',
};

// Source credibility boosts
const SOURCE_CREDIBILITY = {
  'editorial_verified': 0.08,
  'review_corroborated': 0.05,
  'instagram_visual': 0.02,
  'menu_extracted': 0.03,
  'award_verified': 0.06,
  'multi_source': 0.10,
};

// ─── Signal-Based Scoring (mirrors taste-match.ts) ──────────────────────────

function computeMatchFromSignals(signals, antiSignals, userProfile) {
  const byDomain = {};
  for (const d of ALL_DOMAINS) byDomain[d] = [];

  for (const sig of signals) {
    const domain = DIMENSION_TO_DOMAIN[sig.dimension];
    if (domain && byDomain[domain]) byDomain[domain].push(sig);
  }

  const breakdown = {};
  for (const domain of ALL_DOMAINS) {
    const domainSignals = byDomain[domain];
    if (domainSignals.length === 0) {
      breakdown[domain] = 50;
      continue;
    }

    const totalConf = domainSignals.reduce((sum, s) => {
      let conf = s.confidence || 0.7;
      if (s.review_corroborated) conf += 0.05;
      if (s.source_type && SOURCE_CREDIBILITY[s.source_type]) {
        conf += SOURCE_CREDIBILITY[s.source_type];
      }
      return sum + Math.min(conf, 1.0);
    }, 0);

    const avgConfidence = totalConf / domainSignals.length;
    const density = Math.min(domainSignals.length / 20, 1.0);
    const propertyStrength = avgConfidence * 0.6 + density * 0.4;
    breakdown[domain] = Math.round(propertyStrength * 100);
  }

  // Anti-signal penalties
  for (const anti of (antiSignals || [])) {
    const domain = DIMENSION_TO_DOMAIN[anti.dimension];
    if (domain && breakdown[domain] !== undefined) {
      breakdown[domain] = Math.max(0, breakdown[domain] - Math.round((anti.confidence || 0.5) * 5));
    }
  }

  // Weighted average by user profile
  let weightedSum = 0;
  let totalWeight = 0;
  for (const domain of ALL_DOMAINS) {
    const userWeight = userProfile[domain] || 0.5;
    weightedSum += userWeight * breakdown[domain];
    totalWeight += userWeight;
  }
  const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;

  return { overallScore, breakdown };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const client = await pool.connect();

  try {
    // 1. Get user taste profile + vector
    console.log('Loading user data...');
    const userRes = await client.query(
      `SELECT "tasteProfile", "allSignals", "tasteVector"::text as "tasteVectorStr"
       FROM "User" WHERE id = $1`,
      [USER_ID]
    );
    const user = userRes.rows[0];
    if (!user) throw new Error('User not found');

    // Parse user taste profile (radarData)
    const tasteProfile = user.tasteProfile;
    const radarData = tasteProfile?.radarData || {};
    const userProfile = {};
    for (const d of ALL_DOMAINS) {
      userProfile[d] = radarData[d] ?? 0.5;
    }
    console.log('User profile:', userProfile);

    const userSignalCount = Array.isArray(user.allSignals) ? user.allSignals.length : 0;
    console.log(`User has ${userSignalCount} signals`);

    if (!user.tasteVectorStr) {
      console.error('User has no taste vector!');
      process.exit(1);
    }

    // 2. Load all enriched places
    console.log('\nLoading enriched places...');
    const placesRes = await client.query(
      `SELECT "googlePlaceId", "propertyName", "signals", "antiSignals", "signalCount",
              ("embedding" <=> $1::vector) as distance
       FROM "PlaceIntelligence"
       WHERE status = 'complete' AND "signalCount" > 0 AND "embedding" IS NOT NULL
       ORDER BY "embedding" <=> $1::vector`,
      [user.tasteVectorStr]
    );
    const places = placesRes.rows;
    console.log(`Loaded ${places.length} enriched places with embeddings`);

    // 3. Score every place with BOTH methods
    const results = places.map((place) => {
      const signals = place.signals || [];
      const antiSignals = place.antiSignals || [];
      const vectorSimilarity = 1 - place.distance;
      const vectorScore = Math.round(vectorSimilarity * 100);
      const signalMatch = computeMatchFromSignals(signals, antiSignals, userProfile);
      const blended = Math.round(vectorScore * 0.6 + signalMatch.overallScore * 0.4);

      return {
        googlePlaceId: place.googlePlaceId,
        propertyName: place.propertyName,
        signalScore: signalMatch.overallScore,
        vectorScore,
        blendedScore: blended,
        signalCount: place.signalCount,
        vectorSimilarity: Math.round(vectorSimilarity * 1000) / 1000,
        breakdown: signalMatch.breakdown,
      };
    });

    // 4. Assign ranks
    const bySignal = [...results].sort((a, b) => b.signalScore - a.signalScore);
    bySignal.forEach((p, i) => { p.signalRank = i + 1; });

    const byVector = [...results].sort((a, b) => b.vectorScore - a.vectorScore);
    byVector.forEach((p, i) => { p.vectorRank = i + 1; });

    results.forEach((p) => { p.rankDelta = p.signalRank - p.vectorRank; });

    // 5. Analytics
    const n = results.length;
    const sumD2 = results.reduce((sum, p) => sum + p.rankDelta * p.rankDelta, 0);
    const spearman = 1 - (6 * sumD2) / (n * (n * n - 1));

    console.log('\n' + '='.repeat(80));
    console.log('SIGNAL vs EMBEDDING MATCH COMPARISON');
    console.log('='.repeat(80));

    console.log(`\nTotal places scored: ${n}`);
    console.log(`Spearman rank correlation: ${(spearman).toFixed(3)}`);

    // Score distributions
    const signalScores = results.map(r => r.signalScore);
    const vectorScores = results.map(r => r.vectorScore);
    const stats = (arr) => {
      const sorted = [...arr].sort((a, b) => a - b);
      return {
        min: sorted[0],
        max: sorted[sorted.length - 1],
        mean: Math.round(arr.reduce((s, v) => s + v, 0) / arr.length),
        median: sorted[Math.floor(sorted.length / 2)],
        p25: sorted[Math.floor(sorted.length * 0.25)],
        p75: sorted[Math.floor(sorted.length * 0.75)],
        stddev: Math.round(Math.sqrt(arr.reduce((s, v) => s + (v - arr.reduce((a, b) => a + b, 0) / arr.length) ** 2, 0) / arr.length)),
      };
    };

    console.log('\nScore Distribution:');
    console.log('  Signal scores:', JSON.stringify(stats(signalScores)));
    console.log('  Vector scores:', JSON.stringify(stats(vectorScores)));

    // Top-N overlap
    console.log('\nTop-N Overlap:');
    for (const k of [10, 20, 50]) {
      const sigTopK = new Set(bySignal.slice(0, k).map(p => p.googlePlaceId));
      const vecTopK = new Set(byVector.slice(0, k).map(p => p.googlePlaceId));
      const intersect = [...sigTopK].filter(id => vecTopK.has(id)).length;
      console.log(`  Top-${k}: ${intersect}/${k} overlap (${Math.round(intersect / k * 100)}%)`);
    }

    // Top 30 by each method
    console.log('\n' + '-'.repeat(80));
    console.log('TOP 30 BY BLENDED SCORE (60% vector + 40% signal):');
    console.log('-'.repeat(80));
    const byBlended = [...results].sort((a, b) => b.blendedScore - a.blendedScore);
    console.log('Rank | Property Name                          | Blend | Signal | Vector | SigRk | VecRk | Δ');
    byBlended.slice(0, 30).forEach((p, i) => {
      const name = p.propertyName.substring(0, 40).padEnd(40);
      console.log(`${String(i + 1).padStart(4)} | ${name} | ${String(p.blendedScore).padStart(5)} | ${String(p.signalScore).padStart(6)} | ${String(p.vectorScore).padStart(6)} | ${String(p.signalRank).padStart(5)} | ${String(p.vectorRank).padStart(5)} | ${String(p.rankDelta).padStart(4)}`);
    });

    console.log('\n' + '-'.repeat(80));
    console.log('TOP 30 BY SIGNAL SCORE ONLY:');
    console.log('-'.repeat(80));
    console.log('Rank | Property Name                          | Signal | Vector | VecRk | Δ');
    bySignal.slice(0, 30).forEach((p, i) => {
      const name = p.propertyName.substring(0, 40).padEnd(40);
      console.log(`${String(i + 1).padStart(4)} | ${name} | ${String(p.signalScore).padStart(6)} | ${String(p.vectorScore).padStart(6)} | ${String(p.vectorRank).padStart(5)} | ${String(p.rankDelta).padStart(4)}`);
    });

    console.log('\n' + '-'.repeat(80));
    console.log('TOP 30 BY VECTOR SCORE ONLY:');
    console.log('-'.repeat(80));
    console.log('Rank | Property Name                          | Vector | Signal | SigRk | Δ');
    byVector.slice(0, 30).forEach((p, i) => {
      const name = p.propertyName.substring(0, 40).padEnd(40);
      console.log(`${String(i + 1).padStart(4)} | ${name} | ${String(p.vectorScore).padStart(6)} | ${String(p.signalScore).padStart(6)} | ${String(p.signalRank).padStart(5)} | ${String(p.rankDelta).padStart(4)}`);
    });

    // Biggest divergences
    console.log('\n' + '-'.repeat(80));
    console.log('BIGGEST DIVERGENCES — Vector favors (vector ranks much higher than signal):');
    console.log('-'.repeat(80));
    const vecFavors = [...results].filter(p => p.rankDelta > 20).sort((a, b) => b.rankDelta - a.rankDelta).slice(0, 15);
    console.log('Property Name                          | SigRk → VecRk | Signal | Vector | Δ');
    vecFavors.forEach((p) => {
      const name = p.propertyName.substring(0, 40).padEnd(40);
      console.log(`${name} | ${String(p.signalRank).padStart(5)} → ${String(p.vectorRank).padStart(5)} | ${String(p.signalScore).padStart(6)} | ${String(p.vectorScore).padStart(6)} | ${String(p.rankDelta).padStart(4)}`);
    });

    console.log('\nBIGGEST DIVERGENCES — Signal favors (signal ranks much higher than vector):');
    console.log('-'.repeat(80));
    const sigFavors = [...results].filter(p => p.rankDelta < -20).sort((a, b) => a.rankDelta - b.rankDelta).slice(0, 15);
    console.log('Property Name                          | SigRk → VecRk | Signal | Vector | Δ');
    sigFavors.forEach((p) => {
      const name = p.propertyName.substring(0, 40).padEnd(40);
      console.log(`${name} | ${String(p.signalRank).padStart(5)} → ${String(p.vectorRank).padStart(5)} | ${String(p.signalScore).padStart(6)} | ${String(p.vectorScore).padStart(6)} | ${String(p.rankDelta).padStart(4)}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('DONE');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
