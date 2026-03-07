/**
 * Standalone backfill: re-score all SavedPlace records with v3.2 algorithm.
 * Usage: node scripts/backfill-v32.mjs
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 10_000,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Constants ─────────────────────────────────────────────────────────────

const ALL_DOMAINS = ['Design', 'Atmosphere', 'Character', 'Service', 'FoodDrink', 'Setting', 'Wellness', 'Sustainability'];
const VALID = new Set(ALL_DOMAINS);

const DIMENSION_TO_DOMAIN = {
  'Design & Architecture': 'Design', 'design & architecture': 'Design', 'Design': 'Design', design: 'Design',
  'Atmosphere & Vibe': 'Atmosphere', 'atmosphere & vibe': 'Atmosphere', 'Atmosphere': 'Atmosphere', atmosphere: 'Atmosphere',
  'Character & Identity': 'Character', 'character & identity': 'Character', 'Character': 'Character', character: 'Character',
  'Service Philosophy': 'Service', 'service philosophy': 'Service', 'Service': 'Service', service: 'Service',
  'Food & Drink': 'FoodDrink', 'food & drink': 'FoodDrink', 'FoodDrink': 'FoodDrink', fooddrink: 'FoodDrink',
  'Setting & Location': 'Setting', 'setting & location': 'Setting', 'Setting': 'Setting', setting: 'Setting',
  'Wellness & Activities': 'Wellness', 'wellness & activities': 'Wellness', 'Wellness': 'Wellness', wellness: 'Wellness',
  'Sustainability & Ethics': 'Sustainability', 'sustainability & ethics': 'Sustainability', 'Sustainability': 'Sustainability', sustainability: 'Sustainability',
};

const DEFAULT_PROFILE = {
  Design: 0.85, Atmosphere: 0.75, Character: 0.8, Service: 0.6,
  FoodDrink: 0.75, Setting: 0.7, Wellness: 0.4, Sustainability: 0.3,
};

const SOURCE_CREDIBILITY = {
  'editorial_verified': 0.08, 'review_corroborated': 0.05, 'instagram_visual': 0.02,
  'menu_extracted': 0.03, 'award_verified': 0.06, 'multi_source': 0.10,
};

// ─── v3.2 Scoring (inlined) ────────────────────────────────────────────────

function computeMatch(signals, antiSignals, userProfile, opts = {}) {
  const { userMicroSignals, userSignalDistribution, userRejectionKeywords } = opts;

  // Step 0: Profile enhancement
  const enhancedProfile = {};
  if (userSignalDistribution) {
    const maxSig = Math.max(...Object.values(userSignalDistribution), 1);
    for (const d of ALL_DOMAINS) {
      const radar = userProfile[d] || 0;
      const share = (userSignalDistribution[d] || 0) / maxSig;
      enhancedProfile[d] = radar * (0.3 + 0.7 * share);
    }
  } else {
    for (const d of ALL_DOMAINS) enhancedProfile[d] = userProfile[d] || 0;
  }

  // Step 1: Per-domain raw scoring
  const byDomain = {};
  for (const d of ALL_DOMAINS) byDomain[d] = [];
  for (const sig of signals) {
    const domain = DIMENSION_TO_DOMAIN[sig.dimension];
    if (domain) byDomain[domain].push(sig);
  }

  const breakdown = {};
  for (const domain of ALL_DOMAINS) {
    const ds = byDomain[domain];
    if (ds.length === 0) { breakdown[domain] = 0; continue; }
    const confs = ds.map(s => {
      let c = s.confidence;
      if (s.review_corroborated) c += 0.05;
      if (s.source_type) c += SOURCE_CREDIBILITY[s.source_type] || 0;
      return Math.min(c, 1.0);
    });
    const rms = Math.sqrt(confs.reduce((s, c) => s + c * c, 0) / confs.length);
    const density = Math.min(Math.log2(ds.length + 1) / Math.log2(20), 1.0);
    breakdown[domain] = Math.round(rms * (0.85 + density * 0.15) * 100);
  }

  // Step 1.5: w² alignment
  for (const d of ALL_DOMAINS) {
    if (breakdown[d] > 0) {
      const w = enhancedProfile[d] || 0;
      breakdown[d] = Math.round(breakdown[d] * Math.max(w * w, 0.05));
    }
  }

  // Step 2: Weighted geometric mean
  const priority = ALL_DOMAINS
    .map(d => ({ domain: d, weight: enhancedProfile[d] || 0 }))
    .filter(d => d.weight > 0.10)
    .sort((a, b) => b.weight - a.weight);

  let logSum = 0, weightSum = 0;
  for (const { domain, weight } of priority) {
    const sharpW = Math.pow(weight, 2.0);
    const score = breakdown[domain];
    if (score <= 0) {
      logSum += sharpW * 0.1 * Math.log(40);
      weightSum += sharpW * 0.1;
    } else {
      logSum += sharpW * Math.log(score);
      weightSum += sharpW;
    }
  }
  const geoBase = weightSum > 0 ? Math.exp(logSum / weightSum) : 50;

  // Step 3: Top-domain bonus
  let topBonus = 0;
  if (priority[0]) {
    const ts = breakdown[priority[0].domain];
    if (ts > 60) topBonus = Math.round((ts - 60) * 0.25 * priority[0].weight);
  }

  // Step 4: Keyword resonance
  let resonance = 0;
  if (userMicroSignals) {
    const uKeywords = new Set();
    for (const sigs of Object.values(userMicroSignals)) {
      for (const s of sigs) for (const w of s.toLowerCase().split(/\s+/)) if (w.length > 3) uKeywords.add(w);
    }
    let mc = 0; const matched = new Set();
    for (const sig of signals) {
      for (const w of sig.signal.toLowerCase().split(/\s+/)) {
        if (uKeywords.has(w) && !matched.has(w)) { matched.add(w); mc++; }
      }
    }
    resonance = Math.min(Math.round(Math.log2(mc + 1) * 4.5), 15);
  }

  // Step 4.5: Anti-keyword penalty
  let antiKeyPen = 0;
  if (userRejectionKeywords?.length > 0 && signals.length > 0) {
    const rejWords = new Set();
    for (const kw of userRejectionKeywords) {
      for (const p of kw.toLowerCase().replace(/^anti-/, '').split(/[-_\s]+/)) if (p.length > 3) rejWords.add(p);
    }
    let mc = 0; const matched = new Set();
    for (const sig of signals) {
      for (const w of sig.signal.toLowerCase().split(/[\s-_]+/)) {
        if (rejWords.has(w) && !matched.has(w)) { matched.add(w); mc++; }
      }
    }
    antiKeyPen = Math.min(Math.round(Math.log2(mc + 1) * 3.5), 12);
  }

  // Step 5: Anti-signal penalty
  let antiSigPen = 0;
  if (antiSignals.length > 0 && signals.length > 0) {
    let antiSum = 0;
    for (const a of antiSignals) {
      const d = DIMENSION_TO_DOMAIN[a.dimension];
      if (d) {
        antiSum += a.confidence * (enhancedProfile[d] || 0.5);
        breakdown[d] = Math.max(0, breakdown[d] - Math.round(a.confidence * 5));
      }
    }
    antiSigPen = Math.min(Math.round((antiSum / Math.max(signals.length * 0.5, 1)) * 20), 20);
  }

  const raw = geoBase + topBonus + resonance - antiKeyPen - antiSigPen;
  return {
    overallScore: Math.max(0, Math.min(100, Math.round(raw))),
    breakdown,
  };
}

function normalizeScores(scores, ceiling = 93, floor = 35) {
  if (scores.length <= 1) return scores.map(s => ({ ...s, overallScore: ceiling }));
  const rawScores = scores.map(s => s.overallScore);
  const maxR = Math.max(...rawScores), minR = Math.min(...rawScores);
  const range = maxR - minR;
  if (range === 0) return scores.map(s => ({ ...s, overallScore: ceiling }));
  const dRange = ceiling - floor;
  return scores.map(s => {
    const pct = (s.overallScore - minR) / range;
    const curved = Math.pow(pct, 0.7);
    return { ...s, overallScore: Math.max(floor, Math.min(ceiling, Math.round(floor + curved * dRange))) };
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== v3.2 Score Backfill ===\n');

  // Load all enriched property signals
  const allIntel = await prisma.placeIntelligence.findMany({
    where: { status: 'complete', signalCount: { gt: 0 } },
    select: { googlePlaceId: true, signals: true, antiSignals: true },
  });
  const intelMap = new Map();
  for (const i of allIntel) intelMap.set(i.googlePlaceId, { signals: i.signals || [], antiSignals: i.antiSignals || [] });
  console.log(`Loaded signals for ${intelMap.size} properties\n`);

  // Load users
  const users = await prisma.user.findMany({
    where: { savedPlaces: { some: {} } },
    select: { id: true, tasteProfile: true },
  });
  console.log(`Found ${users.length} user(s)\n`);

  let totalUpdated = 0;

  for (const user of users) {
    const pd = user.tasteProfile;
    if (!pd?.radarData) { console.log(`  User ${user.id}: no radarData, skipping`); continue; }

    // Build profile
    const profile = { ...DEFAULT_PROFILE };
    for (const r of pd.radarData || []) {
      if (r.axis && typeof r.value === 'number' && VALID.has(r.axis)) {
        const val = r.value > 1 ? r.value / 100 : r.value;
        profile[r.axis] = Math.max(profile[r.axis], val);
      }
    }

    // v3.2 options
    const microSignals = pd.microTasteSignals || {};
    const signalDist = {};
    for (const [d, s] of Object.entries(microSignals)) {
      if (VALID.has(d) && Array.isArray(s)) signalDist[d] = s.length;
    }
    const contradictions = pd.contradictions || [];
    const rejKeywords = contradictions.filter(c => c.stated).map(c => c.stated);

    console.log(`  User ${user.id}:`);
    console.log(`    Signal dist: ${JSON.stringify(signalDist)}`);
    console.log(`    Rejection keywords: ${rejKeywords.length}`);

    // Load saved places
    const savedPlaces = await prisma.savedPlace.findMany({
      where: { userId: user.id },
      select: { id: true, googlePlaceId: true, name: true, matchScore: true },
    });

    // Score each
    const rawScored = [];
    let skipped = 0;
    for (const sp of savedPlaces) {
      if (!sp.googlePlaceId) { skipped++; continue; }
      const intel = intelMap.get(sp.googlePlaceId);
      if (!intel || intel.signals.length === 0) { skipped++; continue; }

      const match = computeMatch(intel.signals, intel.antiSignals, profile, {
        userMicroSignals: microSignals,
        userSignalDistribution: Object.keys(signalDist).length > 0 ? signalDist : undefined,
        userRejectionKeywords: rejKeywords.length > 0 ? rejKeywords : undefined,
      });

      rawScored.push({ savedPlaceId: sp.id, name: sp.name, oldScore: sp.matchScore, overallScore: match.overallScore, breakdown: match.breakdown });
    }

    // Normalize
    const normalized = normalizeScores(rawScored);
    normalized.sort((a, b) => b.overallScore - a.overallScore);

    // Display
    console.log(`\n    Top 15 (v3.2):`);
    for (const s of normalized.slice(0, 15)) console.log(`      ${String(s.overallScore).padStart(2)}% (was ${String(s.oldScore ?? '?').padStart(2)}%) — ${s.name}`);
    if (normalized.length > 20) {
      console.log(`    ...`);
      console.log(`    Bottom 5:`);
      for (const s of normalized.slice(-5)) console.log(`      ${String(s.overallScore).padStart(2)}% (was ${String(s.oldScore ?? '?').padStart(2)}%) — ${s.name}`);
    }

    // Write to DB
    let updated = 0;
    for (const scored of normalized) {
      const nb = {};
      for (const [d, v] of Object.entries(scored.breakdown)) nb[d] = Math.round(v) / 100;
      await prisma.savedPlace.update({
        where: { id: scored.savedPlaceId },
        data: { matchScore: scored.overallScore, matchBreakdown: nb },
      });
      updated++;
    }
    totalUpdated += updated;
    console.log(`\n    ✓ ${updated} scores written (${skipped} skipped — no intel)\n`);
  }

  console.log(`=== Done: ${totalUpdated} total scores backfilled ===`);
}

main().catch(console.error).finally(async () => { await prisma.$disconnect(); await pool.end(); });
