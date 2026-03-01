#!/usr/bin/env node
/**
 * enrich-pending.mjs
 * Calls the Railway pipeline worker directly for pending PlaceIntelligence records.
 * No Inngest, no Vercel — Railway runs the full pipeline and writes to Supabase.
 *
 * Uses async job submission + polling to avoid Railway's 5-min proxy timeout.
 *
 * Usage:
 *   node scripts/enrich-pending.mjs         # all pending
 *   node scripts/enrich-pending.mjs 10      # first 10 pending
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const PIPELINE_WORKER_URL = process.env.PIPELINE_WORKER_URL;
const DATABASE_URL = process.env.DATABASE_URL;
const CONCURRENCY = 5; // max parallel enrichments
const POLL_INTERVAL_MS = 15_000; // check status every 15s
const JOB_TIMEOUT_MS = 1200_000; // 20 minutes max per place

if (!PIPELINE_WORKER_URL || !DATABASE_URL) {
  console.error('Missing PIPELINE_WORKER_URL or DATABASE_URL in .env.local');
  console.error('Set PIPELINE_WORKER_URL to your Railway worker URL (e.g. https://terrazzo-pipeline-worker-production.up.railway.app)');
  process.exit(1);
}

async function enrichPlace(place) {
  // Step 1: Submit job (returns immediately)
  let jobId;
  try {
    const res = await fetch(`${PIPELINE_WORKER_URL}/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        googlePlaceId: place.googlePlaceId,
        propertyName: place.propertyName,
        placeIntelligenceId: place.id,
        placeType: 'restaurant',
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, propertyName: place.propertyName, error: `Submit ${res.status}: ${text.slice(0, 200)}` };
    }

    const data = await res.json();
    jobId = data.jobId;
  } catch (e) {
    return { success: false, propertyName: place.propertyName, error: `Submit failed: ${e.message}` };
  }

  // Step 2: Poll for completion
  const deadline = Date.now() + JOB_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    try {
      const res = await fetch(`${PIPELINE_WORKER_URL}/enrich/status/${jobId}`);
      if (!res.ok) continue; // retry on transient error

      const status = await res.json();

      if (status.status === 'complete') {
        return {
          success: true,
          propertyName: place.propertyName,
          signalCount: status.result?.signalCount ?? 0,
          durationMs: status.result?.durationMs ?? status.elapsedSeconds * 1000,
        };
      }

      if (status.status === 'failed') {
        return { success: false, propertyName: place.propertyName, error: status.error || 'Pipeline failed' };
      }

      // Still running — log stage
    } catch {
      // Network blip — keep polling
    }
  }

  return { success: false, propertyName: place.propertyName, error: `Timed out after ${JOB_TIMEOUT_MS / 1000}s` };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Enrich Pending — Direct Railway (no Inngest)       ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  await pool.query('SELECT 1');
  console.log('✓ Connected to database');
  console.log(`✓ Worker: ${PIPELINE_WORKER_URL}\n`);

  // Fetch pending records
  const limit = parseInt(process.argv[2], 10);
  const query = limit > 0
    ? `SELECT id, "googlePlaceId", "propertyName" FROM "PlaceIntelligence" WHERE status = 'pending' ORDER BY "updatedAt" ASC LIMIT ${limit}`
    : `SELECT id, "googlePlaceId", "propertyName" FROM "PlaceIntelligence" WHERE status = 'pending' ORDER BY "updatedAt" ASC`;
  const { rows } = await pool.query(query);

  console.log(`Found ${rows.length} pending records\n`);

  if (rows.length === 0) {
    console.log('Nothing to enrich!');
    await pool.end();
    return;
  }

  // Process with bounded concurrency
  let completed = 0;
  let failed = 0;
  const startTime = Date.now();

  const queue = [...rows];
  const active = new Map(); // propertyName -> currentStage

  function logProgress() {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const total = rows.length;
    const activeNames = [...active.keys()].join(', ');
    console.log(`  ⏳ ${elapsed}s — ${completed + failed}/${total} done (${completed} ✓, ${failed} ✗, ${active.size} active, ${queue.length} queued)`);
    if (active.size > 0) console.log(`     Active: ${activeNames}`);
  }

  const progressInterval = setInterval(logProgress, 30000);

  async function processNext() {
    while (queue.length > 0) {
      const place = queue.shift();
      active.set(place.propertyName, 'starting');
      console.log(`  → Starting: ${place.propertyName}`);

      const result = await enrichPlace(place);

      active.delete(place.propertyName);

      if (result.success) {
        completed++;
        console.log(`  ✓ ${result.propertyName}: ${result.signalCount} signals (${(result.durationMs / 1000).toFixed(0)}s)`);
      } else {
        failed++;
        console.log(`  ✗ ${result.propertyName}: ${result.error}`);
      }
    }
  }

  // Launch concurrent workers
  const workers = [];
  for (let i = 0; i < Math.min(CONCURRENCY, rows.length); i++) {
    workers.push(processNext());
  }
  await Promise.all(workers);

  clearInterval(progressInterval);

  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Done! ${completed} complete, ${failed} failed in ${totalTime}s`);
  console.log(`  Avg: ${(totalTime / rows.length).toFixed(1)}s per place`);
  console.log(`${'═'.repeat(60)}\n`);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
