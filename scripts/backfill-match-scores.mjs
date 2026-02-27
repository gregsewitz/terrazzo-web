/**
 * One-time backfill: compute taste match scores for all SavedPlaces
 * linked to a complete PlaceIntelligence record but missing matchScore.
 *
 * Usage: node scripts/backfill-match-scores.mjs
 * Requires: DATABASE_URL in .env
 */

import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ─── Radar → Domain mapping (mirrors src/lib/user-profile.ts) ───
const RADAR_TO_DOMAIN = {
  Sensory: 'Design',
  Material: 'Design',
  Authenticity: 'Character',
  Social: 'Service',
  Cultural: 'Location',
  Spatial: 'Wellness',
};

const DEFAULT_PROFILE = {
  Design: 0.85, Character: 0.8, Service: 0.6,
  Food: 0.75, Location: 0.7, Wellness: 0.4,
};

const ALL_DOMAINS = ['Design', 'Character', 'Service', 'Food', 'Location', 'Wellness'];

const DIMENSION_TO_DOMAIN = {
  'Design Language': 'Design',
  'Character & Identity': 'Character',
  'Service Philosophy': 'Service',
  'Food & Drink Identity': 'Food',
  'Location & Context': 'Location',
  'Wellness & Body': 'Wellness',
  'Design & Aesthetic': 'Design',
  'Scale & Intimacy': 'Character',
  'Culture & Character': 'Character',
  'Food & Drink': 'Food',
  'Location & Setting': 'Location',
  'Rhythm & Pace': 'Character',
};

function parseTasteProfile(raw) {
  if (!raw?.radarData?.length) return DEFAULT_PROFILE;
  const result = { ...DEFAULT_PROFILE };
  for (const r of raw.radarData) {
    const domain = RADAR_TO_DOMAIN[r.axis];
    if (domain) result[domain] = Math.max(result[domain], r.value);
  }
  return result;
}

function computeMatchFromSignals(signals, antiSignals, userProfile) {
  const byDomain = {};
  for (const d of ALL_DOMAINS) byDomain[d] = [];
  for (const sig of signals) {
    const domain = DIMENSION_TO_DOMAIN[sig.dimension];
    if (domain) byDomain[domain].push(sig);
  }

  const breakdown = {};
  for (const domain of ALL_DOMAINS) {
    const ds = byDomain[domain];
    if (ds.length === 0) { breakdown[domain] = 50; continue; }
    const totalConf = ds.reduce((sum, s) => sum + Math.min((s.confidence || 0) + (s.review_corroborated ? 0.05 : 0), 1.0), 0);
    const avgConf = totalConf / ds.length;
    const density = Math.min(ds.length / 20, 1.0);
    breakdown[domain] = Math.round((avgConf * 0.6 + density * 0.4) * 100);
  }

  for (const anti of antiSignals) {
    const domain = DIMENSION_TO_DOMAIN[anti.dimension];
    if (domain && breakdown[domain] !== undefined) {
      breakdown[domain] = Math.max(0, breakdown[domain] - Math.round((anti.confidence || 0) * 5));
    }
  }

  let weightedSum = 0, totalWeight = 0;
  for (const domain of ALL_DOMAINS) {
    const w = userProfile[domain] || 0.5;
    weightedSum += w * breakdown[domain];
    totalWeight += w;
  }

  return {
    overallScore: totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50,
    breakdown,
  };
}

async function main() {
  const client = await pool.connect();

  try {
    // Find SavedPlaces needing backfill, joined with their PlaceIntelligence
    const { rows: places } = await client.query(`
      SELECT
        sp.id as sp_id, sp.name, sp."userId",
        pi.status as pi_status, pi.signals, pi."antiSignals", pi."signalCount"
      FROM "SavedPlace" sp
      JOIN "PlaceIntelligence" pi ON sp."placeIntelligenceId" = pi.id
      WHERE sp."deletedAt" IS NULL
        AND pi.status = 'complete'
        AND pi."signalCount" > 0
        AND (sp."matchScore" IS NULL OR sp."matchScore" = 0)
    `);

    console.log(`Found ${places.length} SavedPlaces needing match score backfill`);

    // Cache user profiles
    const userProfiles = new Map();

    let updated = 0;
    for (const row of places) {
      const signals = row.signals || [];
      const antiSignals = row.antiSignals || [];

      if (!userProfiles.has(row.userId)) {
        const { rows: users } = await client.query(
          `SELECT "tasteProfile" FROM "User" WHERE id = $1`, [row.userId]
        );
        userProfiles.set(row.userId, parseTasteProfile(users[0]?.tasteProfile));
      }

      const profile = userProfiles.get(row.userId);
      const match = computeMatchFromSignals(signals, antiSignals, profile);

      await client.query(
        `UPDATE "SavedPlace" SET "matchScore" = $1, "matchBreakdown" = $2 WHERE id = $3`,
        [match.overallScore, JSON.stringify(match.breakdown), row.sp_id]
      );

      console.log(`  ✓ ${row.name}: ${match.overallScore}%`);
      updated++;
    }

    console.log(`\nDone. Updated ${updated} records.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
