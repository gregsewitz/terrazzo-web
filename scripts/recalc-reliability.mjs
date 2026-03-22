#!/usr/bin/env node
/**
 * recalc-reliability.mjs
 *
 * Recomputes reliability scores for all enriched PlaceIntelligence rows
 * using the v2 formula (Bayesian prior + per-issue cap + total cap).
 *
 * Reads quality_failures and reviewCount from stored PI data — no API calls,
 * no LLM re-runs. Safe to run anytime the formula changes.
 *
 * Usage:
 *   node scripts/recalc-reliability.mjs              # update all
 *   node scripts/recalc-reliability.mjs --dry-run     # preview changes
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");

// ── v2 reliability formula constants ──
const RELIABILITY_PRIOR = 0.75;
const RELIABILITY_K = 30;
const PER_ISSUE_CAP_PCT = 0.15;
const TOTAL_CAP_PCT = 0.80;

function computeReliability(qualityFailures, totalReviews) {
  if (!totalReviews || totalReviews === 0) return null;

  let raw;
  if (qualityFailures && qualityFailures.length > 0) {
    const perIssueCap = totalReviews * PER_ISSUE_CAP_PCT;
    let weightedFailures = 0;
    for (const q of qualityFailures) {
      const severityWeight =
        q.severity === "major" ? 2 : q.severity === "moderate" ? 1 : 0.5;
      const mentions = q.mention_count ?? 2;
      weightedFailures += Math.min(severityWeight * mentions, perIssueCap);
    }
    weightedFailures = Math.min(weightedFailures, totalReviews * TOTAL_CAP_PCT);
    raw = 1.0 - weightedFailures / totalReviews;
  } else {
    raw = 1.0;
  }

  // Bayesian blend toward prior
  return (RELIABILITY_PRIOR * RELIABILITY_K + raw * totalReviews) / (RELIABILITY_K + totalReviews);
}

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=minimal",
    },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  return res;
}

async function main() {
  console.log(`\n🔄 Reliability Score Recalculator${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  // Fetch all PI rows that have review data
  const res = await sbFetch(
    `PlaceIntelligence?select=id,propertyName,reviewCount,reliabilityScore,reviewIntel,reliability&reviewCount=gt.0&order=propertyName`,
    { prefer: "return=representation" }
  );
  const rows = await res.json();

  console.log(`  Found ${rows.length} places with reviews\n`);

  let updated = 0;
  let unchanged = 0;
  let changes = [];

  for (const row of rows) {
    const qf = row.reviewIntel?.quality_failures || [];
    const totalReviews = row.reviewCount;
    const newScore = Math.round(computeReliability(qf, totalReviews) * 1000) / 1000;
    const oldScore = row.reliabilityScore;

    if (oldScore === newScore) {
      unchanged++;
      continue;
    }

    const delta = newScore - (oldScore || 0);
    const arrow = delta > 0 ? "↑" : "↓";
    changes.push({
      id: row.id,
      name: row.propertyName,
      oldScore,
      newScore,
      delta,
      totalReviews,
      qfCount: qf.length,
    });

    console.log(
      `  ${row.propertyName}: ${oldScore ?? "null"} → ${newScore} (${arrow}${Math.abs(delta).toFixed(3)}) [${totalReviews} reviews, ${qf.length} issues]`
    );

    if (!DRY_RUN) {
      // Update both the top-level reliabilityScore and the reliability JSON
      const newReliabilityJson = {
        ...row.reliability,
        overall: newScore,
        totalReviews,
      };

      await sbFetch(`PlaceIntelligence?id=eq.${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          reliabilityScore: newScore,
          reliability: newReliabilityJson,
        }),
      });
      updated++;
    }
  }

  console.log(
    `\n📊 Results: ${DRY_RUN ? changes.length + " would change" : updated + " updated"}, ${unchanged} unchanged`
  );

  if (changes.length > 0) {
    const biggest = [...changes].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 5);
    console.log(`\n  Biggest changes:`);
    for (const c of biggest) {
      console.log(`    ${c.name}: ${c.oldScore ?? "null"} → ${c.newScore} (${c.delta > 0 ? "+" : ""}${c.delta.toFixed(3)})`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
