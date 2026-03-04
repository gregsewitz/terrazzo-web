import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '../..');

// Load .env.local
const envPath = path.join(rootDir, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

console.log('Supabase URL:', supabaseUrl);
console.log('Key type:', env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon');

// Query placeIntelligence for all properties with signals
const res = await fetch(
  `${supabaseUrl}/rest/v1/placeIntelligence?select=id,name,googlePlaceId,signals,antiSignals,profile&signals=not.is.null&limit=1000`,
  {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
  }
);

console.log('Status:', res.status);

if (!res.ok) {
  const text = await res.text();
  console.error('Failed:', text.slice(0, 500));
  process.exit(1);
}

const rows = await res.json();

if (!Array.isArray(rows)) {
  console.error('Unexpected response:', JSON.stringify(rows).slice(0, 500));
  process.exit(1);
}

console.log(`Fetched ${rows.length} properties with signals`);

// Save to fixture
const fixturePath = path.join(__dirname, 'fixtures/enriched-properties.json');
fs.writeFileSync(fixturePath, JSON.stringify(rows, null, 2));
console.log(`Saved to ${fixturePath}`);

// Quick stats
const withProfile = rows.filter(r => r.profile).length;
const avgSignals = rows.length > 0
  ? (rows.reduce((s, r) => s + (r.signals?.length || 0), 0) / rows.length).toFixed(1)
  : 0;
const withAntiSignals = rows.filter(r => r.antiSignals?.length > 0).length;

console.log(`\nStats:`);
console.log(`  Properties with profile: ${withProfile}/${rows.length}`);
console.log(`  Properties with anti-signals: ${withAntiSignals}/${rows.length}`);
console.log(`  Avg signals per property: ${avgSignals}`);

// Show a few names
console.log(`\nSample properties:`);
for (const row of rows.slice(0, 10)) {
  console.log(`  ${row.name} — ${row.signals?.length || 0} signals`);
}
