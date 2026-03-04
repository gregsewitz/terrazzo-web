#!/usr/bin/env node
/**
 * One-shot v2 profile migration script.
 * Run from terrazzo-web root: node scripts/migrate-profile-v2.mjs
 *
 * 1. Reads your signals from Supabase
 * 2. Calls the production synthesize API
 * 3. Writes the v2 profile back to the DB
 */

import { createClient } from '@supabase/supabase-js';

// ── Config ──────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
// Default to localhost — production Vercel functions may timeout on long synthesis calls
const APP_URL = process.env.MIGRATE_URL || 'http://localhost:3000';
const USER_EMAIL = 'gsewitz@gmail.com';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE env vars. Run with: npx dotenv -e .env.local -- node scripts/migrate-profile-v2.mjs');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Step 1: Read signals from DB ────────────────────────────────
console.log('📖 Reading signals from DB...');
const { data: user, error: readErr } = await supabase
  .from('User')
  .select('id, allSignals, allContradictions, profileVersion, tasteProfile')
  .eq('email', USER_EMAIL)
  .single();

if (readErr || !user) {
  console.error('Failed to read user:', readErr);
  process.exit(1);
}

console.log(`   Found ${user.allSignals.length} signals, current profileVersion: ${user.profileVersion}`);

// ── Step 2: Build v2 certainties from signal density ────────────
const counts = {};
for (const s of user.allSignals) {
  counts[s.cat] = (counts[s.cat] || 0) + 1;
}
console.log('   Signal distribution:', counts);

const certainties = {
  Design: Math.min(95, 5 + (counts['Design'] || 0) * 1.5),
  Atmosphere: Math.min(95, 5 + (counts['Atmosphere'] || 0) * 1.5),
  Character: Math.min(95, 5 + (counts['Character'] || 0) * 1.5),
  Service: Math.min(95, 5 + (counts['Service'] || 0) * 1.5),
  FoodDrink: Math.min(95, 5 + (counts['FoodDrink'] || 0) * 1.5),
  Setting: Math.min(95, 5 + (counts['Setting'] || 0) * 1.5),
  Wellness: Math.min(95, 10 + (counts['Wellness'] || 0) * 1.5),
  Sustainability: Math.min(95, 10 + (counts['Sustainability'] || 0) * 1.5),
};

// ── Step 3: Call synthesize API ─────────────────────────────────
const payload = {
  signals: user.allSignals,
  messages: [],
  contradictions: user.allContradictions || [],
  certainties,
};

console.log(`\n🧠 Calling ${APP_URL}/api/onboarding/synthesize ...`);
console.log('   (this takes 30-60s — Claude is synthesizing your profile)\n');

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min timeout

let res;
try {
  res = await fetch(`${APP_URL}/api/onboarding/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal,
  });
} catch (err) {
  if (err.name === 'AbortError') {
    console.error('❌ Request timed out after 2 minutes');
  } else {
    console.error('❌ Fetch failed:', err.message);
  }
  process.exit(1);
} finally {
  clearTimeout(timeout);
}

if (!res.ok) {
  const errText = await res.text();
  console.error(`❌ API error ${res.status}:`, errText);
  process.exit(1);
}

const profile = await res.json();
console.log('\n✅ Synthesis complete!');
console.log('   Archetype:', profile.overallArchetype);
console.log('   Radar:', profile.radarData?.map(r => `${r.axis}=${r.value}`).join(', '));
console.log('   Version:', profile.profileVersion);
console.log('   Trajectory:', profile.tasteTrajectory?.direction);
console.log('   Sustainability:', profile.sustainabilityProfile?.sensitivity);

// ── Step 4: Write v2 profile to DB ──────────────────────────────
console.log('\n💾 Saving to DB...');

const updatePayload = {
  tasteProfile: profile,
  profileVersion: profile.profileVersion || 2,
  lastProfileSynthesizedAt: new Date().toISOString(),
};

// Extract sustainability fields to top-level columns if present
if (profile.sustainabilityProfile) {
  updatePayload.sustainabilitySensitivity = profile.sustainabilityProfile.sensitivity || 'PASSIVE';
  updatePayload.sustainabilityPriorities = profile.sustainabilityProfile.priorities || [];
  updatePayload.sustainabilityDealbreakers = profile.sustainabilityProfile.dealbreakers || [];
  updatePayload.sustainabilityWillingnessToPayPremium = profile.sustainabilityProfile.willingnessToPayPremium ?? null;
}

// Extract taste trajectory to top-level columns if present
if (profile.tasteTrajectory) {
  updatePayload.tasteTrajectoryDirection = profile.tasteTrajectory.direction || null;
  updatePayload.tasteTrajectoryDescription = profile.tasteTrajectory.description || null;
}

const { error: writeErr } = await supabase
  .from('User')
  .update(updatePayload)
  .eq('id', user.id);

if (writeErr) {
  console.error('Failed to save:', writeErr);
  // Still save the JSON locally as backup
  const fs = await import('fs');
  fs.writeFileSync('scripts/new-profile-backup.json', JSON.stringify(profile, null, 2));
  console.log('⚠️  Profile saved to scripts/new-profile-backup.json as backup');
  process.exit(1);
}

console.log('\n🎉 Done! Profile migrated to v2.');
console.log('   profileVersion:', updatePayload.profileVersion);
console.log('   sustainabilitySensitivity:', updatePayload.sustainabilitySensitivity);
console.log('   tasteTrajectory:', updatePayload.tasteTrajectoryDirection);
