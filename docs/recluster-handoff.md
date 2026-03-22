# V3 Re-Clustering Pipeline: End-to-End Runbook

## What This Is

When the property catalog grows (new places finish enrichment), the v3 semantic clustering pipeline needs to be re-run to incorporate new signals. This document is a complete, copy-pasteable runbook — it covers every step from corpus extraction through quality verification. It includes lessons learned from v3.1 → v3.2 migration, the v3.6 full singleton mapping + lowercase key fix + BLEED_ONLY_DAMPEN tuning, and architectural notes on the hotel scoring gap. Feed this entire document to Claude when running the next re-cluster.

## Current State (as of March 22, 2026)

- **1,189 enriched properties** in the DB
- **v3.6 clustering**: 400 clusters, **400-dim signal-only vectors** (domain dims removed in v3.4)
- **Neighbor bleed**: Two-tier similarity-scaled bleed (v3.3+), with bleed scales read from signal-clusters.json:
  - **Intra-domain**: up to 3 neighbors per cluster, weight = similarity × 0.30 (threshold > 0.3)
  - **Cross-domain**: up to 2 neighbors per cluster, weight = similarity × 0.10 (threshold > 0.5)
  - **BLEED_ONLY_DAMPEN = 0.25** (in `constants.ts`): clusters that only receive energy via bleed (no direct signal) are attenuated by this factor. Raised from 0.08 to improve hotel scoring.
  - **Runtime fallback**: `vectors-v3.ts` falls back to intra=0.15, cross=0.03 if the JSON lacks bleed scale fields
- **signal-clusters.json**: Generated from **162,398 signals** (11,833 corpus + 150,565 singletons mapped to nearest centroids). All keys are lowercased at load time in `getClusterState()`.
- **signal-clusters.json locations** (must be kept in sync):
  - `/signal-clusters.json` (root — gitignored, used by clustering scripts)
  - `/src/lib/taste-intelligence/signal-clusters.json` (bundled with code)
  - `/public/data/signal-clusters.json` (runtime loader reads from here)
- **DB columns**: `PlaceIntelligence.embeddingV3 vector(400)` and `User.tasteVectorV3 vector(400)` — all populated
- **DB staging tables**: `v3_signal_cluster_map`, `v3_cluster_domain` (400 rows), `v3_cluster_neighbors` (~1,200 intra + cross-domain rows, with `tier` column). Note: staging tables may be stale — v3.6 backfill runs via TypeScript (`vector-refresh` cron), not PL/pgSQL.
- **Vector computation**: Handled by TypeScript in `vectors-v3.ts` via the `vector-refresh` cron endpoint. PL/pgSQL functions (`compute_property_embedding_v3`, etc.) still exist in the DB but are no longer the primary backfill path.
- **Normalization pipeline**: log1p sublinear dampening → BLEED_ONLY_DAMPEN → mean-centering → L2 normalize
- **Fallback chain for unmapped signals**: direct lookup → OpenAI batch embedding → skip (logged). Word-overlap fallback has been removed.
- **Skipped signal tracking**: `GET /api/intelligence/skipped-signals` returns signals that failed both direct lookup and OpenAI embedding.
- **Population stats**: mean=0.160, stddev=0.082 (2,378 scored pairs). Defaults in `match-tier.ts`.
- **Domain rename**: `Geography` → `Setting` (in TasteNode and clustering corpus). The extraction script maps this automatically.
- **Domain weighting removed (v3.6)**: radarData no longer affects scoring. All signals use uniform confidence (1.0). radarData is only used for front-end display (radar charts).

## Architecture Overview

```
Vector layout (v3.4+): [0-399] = 400 signal cluster dims (signal-only, no domain dims)
  (v3.3 was: [0-7] domain + [8-407] signal = 408; domain dims dropped in v3.4)

Signal → Cluster: signal-clusters.json (domain-aware hierarchical K-means on OpenAI embeddings)
  162K+ signalToCluster entries (corpus + singletons mapped to nearest centroid)
  Keys are lowercased at load time in getClusterState() to match .toLowerCase() lookups
Cluster → Dimension: cluster_id IS the dim index (direct, no offset)
Neighbor bleed (v3.3+ — two-tier, similarity-scaled):
  Primary cluster: activated at 100%
  Intra-domain neighbors (up to 3): weight = similarity × intra_bleed_scale (threshold > 0.3)
  Cross-domain neighbors (up to 2): weight = similarity × cross_bleed_scale (threshold > 0.5)
  Bleed scales stored in signal-clusters.json (currently: intra=0.30, cross=0.10)
  Runtime fallback in vectors-v3.ts: intra=0.15, cross=0.03
IDF weighting: ln(1 + N/df) per signal across all properties
Normalization pipeline (in order):
  1. Signal features: IDF-weighted confidence per cluster + neighbor bleed
  2. Log1p sublinear dampening: preserves signal density, prevents unbounded growth
  3. BLEED_ONLY_DAMPEN (0.25): attenuates clusters with only bleed energy (no direct hit)
  4. Mean-centering: removes shared "uniform" component, improves discrimination
  5. L2 normalization: unit vector for cosine similarity
User domain preference: REMOVED in v3.6 — all signals use uniform confidence (1.0)
  (radarData still used for front-end display only)

Domain assignment (contiguous cluster ranges — shift whenever re-clustered):
  Atmosphere (0-43), Character (44-113), Design (114-152), FoodDrink (153-232),
  Rejection (233), Service (234-311), Setting (312-362), Sustainability (363-375),
  Wellness (376-399)
  (these are the v3.6 ranges — note Geography→Setting rename, Rejection domain added)
```

## Key Files

| File | Purpose |
|------|---------|
| `scripts/extract-signal-corpus.mjs` | Extracts signals from DB → `signal-corpus.json` + `signal-singletons.json` + `signal-dimensions.json`. Pulls from both PlaceIntelligence and TasteNode. Maps Geography→Setting. |
| `scripts/cluster-signals-v3.py` | Embeds signals via OpenAI, runs K-means, maps singletons to nearest centroids → `signal-clusters.json`. Use `--k 400` to match VECTOR_DIM_V3. |
| `scripts/surgery-clusters.py` | Post-clustering surgery: dissolve/split/auto-split clusters |
| `scripts/sync-db-after-surgery.py` | Syncs DB staging tables + recomputes all vectors after surgery |
| `public/data/signal-clusters.json` | **Runtime source of truth** — the singleton loader reads from here. Must be kept in sync with root and src/lib/ copies. |
| `src/lib/taste-intelligence/signal-clusters.json` | Bundled copy (for imports). Must match public/data/ copy. |
| `src/lib/taste-intelligence/signal-clusters-loader.ts` | Singleton loader that reads from `public/data/`. Cached for process lifetime — restart dev server to pick up changes. |
| `src/lib/taste-intelligence/vectors-v3.ts` | TypeScript vector computation (runtime / API use). Lowercases signalToCluster keys on load. Contains skipped signal tracking. |
| `src/lib/taste-intelligence/backfill-v3.ts` | TypeScript backfill orchestrator (used by vector-refresh cron) |
| `src/lib/taste-intelligence/queries-v3.ts` | Vector similarity queries |
| `src/lib/constants.ts` | BLEED_ONLY_DAMPEN (0.25), ANTI_SIGNAL_SCALE, CLUSTER_ACTIVATION_THRESHOLD |
| `src/lib/match-tier.ts` | Population stats defaults (mean, stddev), z-score tier classification |
| `src/app/api/cron/vector-refresh/route.ts` | Cron endpoint: recomputes IDF, all user vectors, all property embeddings, refreshes population stats |
| `src/app/api/intelligence/rescore/route.ts` | Rescore endpoint: recomputes user vector (optional) + rescores all saved places |
| `src/app/api/intelligence/skipped-signals/route.ts` | GET: returns skipped signals. POST: clears cache. |
| `prisma/schema.prisma` | DB schema (embeddingV3, tasteVectorV3 columns) |

## Supabase Project

- **Project ID**: `wqbzfhlxvjppepkeudyd`
- All DB operations can be done via Supabase MCP `execute_sql` tool or direct `psql` connection


---

## End-to-End Re-Clustering Process

### Step 1: Extract Signal Corpus

Run locally from the `terrazzo-web` directory (needs `DATABASE_URL` in `.env.local`):

```bash
node scripts/extract-signal-corpus.mjs
```

This extracts signals from **both** PlaceIntelligence (property signals) and TasteNode (user signals) so both vocabularies get assigned to the same clusters. It also maps `Geography` → `Setting` for the domain rename.

**Outputs:**
- `signal-corpus.json` — `[{s: "signal-name", d: "Domain", df: 5}, ...]` (signals with freq ≥ 2, used for K-means clustering)
- `signal-singletons.json` — `[{s: "signal-name", d: "Domain"}, ...]` (signals with freq = 1, mapped to nearest centroid in Step 2)
- `signal-dimensions.json` — `[{s: "signal-name", d: "Domain"}, ...]` (all signals with domain mapping)

**Sanity checks:**
- Total corpus signal count should grow with new properties (was 5,047 at 360 places, 7,628 at 736 places, 11,833 at 1,189 places)
- Singleton count will be much larger (150K+ at 1,189 places) — these are property-specific long-form signals
- Domain distribution: Service > FoodDrink > Character > Design > Setting > Atmosphere > Wellness > Sustainability
- Note: domain is now `Setting` (not `Geography`)

### Step 2: Run Clustering

```bash
export OPENAI_API_KEY=$(grep OPENAI_API_KEY .env.local | cut -d= -f2)
pip install openai scikit-learn numpy  # if not installed

# Option A: Full silhouette sweep (recommended for major corpus changes)
python3 scripts/cluster-signals-v3.py --sweep

# Option B: Direct clustering at specific K (RECOMMENDED — always match VECTOR_DIM_V3)
python3 scripts/cluster-signals-v3.py --k 400
```

**CRITICAL**: Always use `--k 400` (or whatever `VECTOR_DIM_V3` is in `vectors-v3.ts`). If the script produces more clusters than `VECTOR_DIM_V3`, cluster IDs beyond the limit write beyond array bounds, producing NaN vectors that break pgvector. If you want to change K, update `VECTOR_DIM_V3` and `SIGNAL_DIMS_V3` first.

**How to choose K:**
- Rule of thumb: `K ≈ sqrt(num_signals) * 1.5`, min 200, max 500
- For ~5K signals → K=250-350
- For ~8K signals → K=300-400
- For ~12K signals → K=350-500
- The sweep shows silhouette scores per K; pick the peak (silhouette > 0.10 is good for this data)

**The script:**
1. Loads `signal-corpus.json`, `signal-singletons.json`, and `signal-dimensions.json`
2. Embeds all corpus signals with `text-embedding-3-small` (cached in `signal-embeddings-cache.json` — delete cache to re-embed)
3. Runs domain-aware hierarchical K-means on corpus signals (allocates sub-clusters proportionally per domain)
4. Computes nearest neighbor clusters within each domain (for neighbor bleed) and cross-domain
5. **Embeds all singletons** via OpenAI and maps each to its nearest cluster centroid by cosine similarity
6. Outputs `signal-clusters.json` to both `src/lib/taste-intelligence/` and project root
7. **You must also copy to `public/data/`** — the runtime loader reads from there (the script doesn't do this automatically)

```bash
cp signal-clusters.json public/data/signal-clusters.json
```

**Output format** (`signal-clusters.json`):
```json
{
  "version": "v3.4",
  "method": "domain-hierarchical-openai-kmeans",
  "embedding_model": "text-embedding-3-small",
  "k": 400,
  "avg_silhouette": 0.0922,
  "total_signals": 162398,
  "intra_bleed_scale": 0.30,
  "cross_bleed_scale": 0.10,
  "created": "2026-03-22",
  "clusters": { "0": { "label": "...", "domain": "...", "size": 15, "topSignals": [...] }, ... },
  "signalToCluster": { "signal-name": 0, ... },  // 162K+ entries (corpus + singletons)
  "clusterNeighbors": { "0": [{"cluster": 1, "similarity": 0.89, "tier": "intra"}, ...], ... },
  "clusterCentroids": { "0": [0.01, -0.03, ...], ... }  // 1536-dim OpenAI embeddings per cluster
}
```

### Step 3: Recompute IDF Weights

IDF values change whenever the property corpus grows. Always recompute.

```sql
TRUNCATE _idf_weights;

INSERT INTO _idf_weights (signal_text, idf_weight, doc_freq)
WITH prop_count AS (
  SELECT COUNT(*)::float as n
  FROM "PlaceIntelligence"
  WHERE status = 'complete' AND "signalCount" > 0
),
signal_freq AS (
  SELECT
    lower(trim(s->>'signal')) as signal_text,
    COUNT(DISTINCT pi.id) as doc_freq
  FROM "PlaceIntelligence" pi,
    jsonb_array_elements(pi.signals::jsonb) s
  WHERE pi.status = 'complete' AND pi."signalCount" > 0
    AND s->>'signal' IS NOT NULL AND trim(s->>'signal') != ''
  GROUP BY lower(trim(s->>'signal'))
)
SELECT
  sf.signal_text,
  ln(1.0 + pc.n / sf.doc_freq::float) as idf_weight,
  sf.doc_freq
FROM signal_freq sf, prop_count pc;
```

### Step 4: Database Migration (only if K changed)

If K is the same as before (currently 400), **skip this step**. Only needed when the dimension count changes.

```sql
-- Drop existing indexes
DROP INDEX IF EXISTS "PlaceIntelligence_embeddingV3_hnsw_idx";
DROP INDEX IF EXISTS "User_tasteVectorV3_hnsw_idx";

-- Drop and re-add columns with new dimension
ALTER TABLE "PlaceIntelligence" DROP COLUMN IF EXISTS "embeddingV3";
ALTER TABLE "User" DROP COLUMN IF EXISTS "tasteVectorV3";

ALTER TABLE "PlaceIntelligence" ADD COLUMN "embeddingV3" vector(NEW_DIM);
ALTER TABLE "User" ADD COLUMN "tasteVectorV3" vector(NEW_DIM);

-- Recreate HNSW indexes
CREATE INDEX "PlaceIntelligence_embeddingV3_hnsw_idx"
  ON "PlaceIntelligence" USING hnsw ("embeddingV3" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX "User_tasteVectorV3_hnsw_idx"
  ON "User" USING hnsw ("tasteVectorV3" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

Also update these files if K changed:
- `vectors-v3.ts`: `VECTOR_DIM_V3 = NEW_K`, `SIGNAL_DIMS_V3 = NEW_K` (these are the same value since domain dims were dropped in v3.4)
- `queries-v3.ts`: update vector dimension comments
- `backfill-v3.ts`: update dimension/cluster count comments
- `prisma/schema.prisma`: `vector(NEW_DIM)` annotations

### Step 5: Load Cluster Data into Staging Tables

This step loads `signal-clusters.json` data into three DB staging tables used by the PL/pgSQL backfill functions. **This was the most error-prone step in v3.2.** The section below describes the improved approach.

#### 5a. Create / truncate staging tables

```sql
-- Signal → cluster mapping
CREATE TABLE IF NOT EXISTS v3_signal_cluster_map (
  signal TEXT PRIMARY KEY,
  cluster_id INT NOT NULL
);

-- Cluster → domain mapping
CREATE TABLE IF NOT EXISTS v3_cluster_domain (
  cluster_id INT PRIMARY KEY,
  domain TEXT NOT NULL
);

-- Cluster → neighbor mapping (v3.3: two-tier with similarity-scaled weights)
CREATE TABLE IF NOT EXISTS v3_cluster_neighbors (
  cluster_id INT NOT NULL,
  neighbor_id INT NOT NULL,
  similarity FLOAT NOT NULL,
  weight FLOAT NOT NULL,            -- pre-computed: similarity × bleed_scale
  tier TEXT NOT NULL DEFAULT 'intra', -- 'intra' (within-domain) or 'cross' (cross-domain)
  PRIMARY KEY (cluster_id, neighbor_id)
);

-- Truncate for a clean load
TRUNCATE v3_signal_cluster_map, v3_cluster_domain, v3_cluster_neighbors;
```

#### 5b. Generate SQL batch files (improved approach)

The previous approach generated 16 batch files of ~500 signals each. This works but is tedious to execute one-by-one through the Supabase MCP. Here's the improved generator:

```python
#!/usr/bin/env python3
"""
generate-staging-sql.py — Generate SQL batch files from signal-clusters.json
for loading into v3_signal_cluster_map, v3_cluster_domain, and v3_cluster_neighbors.

Improvements over the v3.2 process:
- Generates a single compact domain file and a single compact neighbors file
- Generates signal batches of ~500 signals in compacted (single-line VALUES) format
  to stay under the Supabase execute_sql ~1MB limit
- Generates a loader script that can run all batches via Supabase MCP automatically
"""
import json
import os

with open('src/lib/taste-intelligence/signal-clusters.json') as f:
    data = json.load(f)

os.makedirs('staging-sql', exist_ok=True)

# ── 1. Signal-to-cluster batches ──────────────────────────────────────────
stc = data['signalToCluster']
signals = sorted(stc.items())
BATCH_SIZE = 500

batch_files = []
for i in range(0, len(signals), BATCH_SIZE):
    batch = signals[i:i + BATCH_SIZE]
    values = ','.join(
        f"('{s.replace(chr(39), chr(39)*2)}',{cid})"
        for s, cid in batch
    )
    sql = (
        f"INSERT INTO v3_signal_cluster_map (signal, cluster_id) VALUES "
        f"{values} ON CONFLICT (signal) DO UPDATE SET cluster_id = EXCLUDED.cluster_id;"
    )
    fname = f'staging-sql/batch_signals_{i // BATCH_SIZE:02d}.sql'
    with open(fname, 'w') as f:
        f.write(sql)
    batch_files.append(fname)

print(f"Generated {len(batch_files)} signal batch files ({len(signals)} signals)")

# ── 2. Cluster-domain mapping (single file) ──────────────────────────────
clusters = data['clusters']
values = ','.join(
    f"({cid},'{c['domain']}')"
    for cid, c in sorted(clusters.items(), key=lambda x: int(x[0]))
)
sql = (
    f"INSERT INTO v3_cluster_domain (cluster_id, domain) VALUES "
    f"{values} ON CONFLICT (cluster_id) DO UPDATE SET domain = EXCLUDED.domain;"
)
with open('staging-sql/cluster_domains.sql', 'w') as f:
    f.write(sql)
print(f"Generated cluster_domains.sql ({len(clusters)} clusters)")

# ── 3. Cluster-neighbors mapping (single file, v3.3 two-tier format) ─────
INTRA_BLEED_SCALE = 0.30
CROSS_BLEED_SCALE = 0.10
neighbors = data.get('clusterNeighbors', {})
rows = []
for cid_str, neighbor_list in sorted(neighbors.items(), key=lambda x: int(x[0])):
    for n in neighbor_list:
        tier = n.get('tier', 'intra')
        sim = n['similarity']
        # Pre-compute weight: similarity × scale (PL/pgSQL reads weight directly)
        scale = CROSS_BLEED_SCALE if tier == 'cross' else INTRA_BLEED_SCALE
        weight = round(sim * scale, 6)
        rows.append(f"({cid_str},{n['cluster']},{sim},{weight},'{tier}')")
values = ','.join(rows)
sql = (
    f"INSERT INTO v3_cluster_neighbors (cluster_id, neighbor_id, similarity, weight, tier) VALUES "
    f"{values} ON CONFLICT (cluster_id, neighbor_id) DO UPDATE "
    f"SET similarity = EXCLUDED.similarity, weight = EXCLUDED.weight, tier = EXCLUDED.tier;"
)
with open('staging-sql/cluster_neighbors.sql', 'w') as f:
    f.write(sql)
print(f"Generated cluster_neighbors.sql ({len(rows)} rows)")

# ── 4. Summary ────────────────────────────────────────────────────────────
print(f"\nFiles in staging-sql/:")
print(f"  batch_signals_00.sql through batch_signals_{(len(signals)-1)//BATCH_SIZE:02d}.sql")
print(f"  cluster_domains.sql")
print(f"  cluster_neighbors.sql")
print(f"\nExecution order:")
print(f"  1. cluster_domains.sql")
print(f"  2. cluster_neighbors.sql")
print(f"  3. batch_signals_*.sql (any order, can be parallelized)")
```

#### 5c. Execute the generated SQL

Run each file through `execute_sql`. The domain and neighbor files are small enough for a single call each. The signal batches can be executed in parallel.

**Verification after loading:**
```sql
SELECT 'signal_map' as tbl, count(*) as rows FROM v3_signal_cluster_map
UNION ALL
SELECT 'domain', count(*) FROM v3_cluster_domain
UNION ALL
SELECT 'neighbors', count(*) FROM v3_cluster_neighbors;
```

Expected: signal_map ≈ total_signals, domain = K, neighbors = K × 3.

#### 5d. Add trigram index for cache population (Step 7)

```sql
-- Enable pg_trgm if not already
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index for fuzzy matching during cache build
CREATE INDEX IF NOT EXISTS idx_v3_scm_trgm
  ON v3_signal_cluster_map USING gin (signal gin_trgm_ops);
```

### Step 6: Update PL/pgSQL Backfill Functions (LEGACY — only if using SQL-side backfill)

**Note**: The v3.6+ pipeline uses TypeScript for all vector computation (via the `vector-refresh` cron endpoint). PL/pgSQL functions are no longer the primary backfill path and can be skipped unless you specifically need SQL-side computation.

If K changed and you need to update the PL/pgSQL functions, recreate these four with the new array sizes:

- `lookup_signal_cluster_v3(signal_text, num_clusters)` — cache → direct → trigram → hash fallback
- `compute_property_embedding_v3(prop_id)` — K dim, neighbor bleed via `v3_cluster_neighbors`
- `compute_user_vector_v3(uid)` — same layout, processes `tasteProfile` + `TasteNode` signals
- `compute_signal_match_v3(...)` — scoring function with ratio-based anti-signal penalty

Key dimensions to update in each function:
- `signal_feats` / `signal_weights` array size: K
- `final_vec` array size: K (domain dims were dropped in v3.4)
- All loop bounds: `FOR i IN 0..K-1`
- Vector cast: `final_vec::vector(K)`

The functions live in the database — re-create them with `CREATE OR REPLACE FUNCTION`.

### Step 7: Build the Signal Cache (CRITICAL for backfill performance)

**This is the most important optimization.** Properties contain ~112K+ unique signals, but only ~7K appear in the canonical cluster corpus. The other ~106K are property-specific long-form signals that need to be matched to clusters via trigram similarity.

Without the cache, the PL/pgSQL backfill calls `lookup_signal_cluster_v3` once per signal, and each trigram-fallback call scans 7K+ rows. This makes even 5 properties timeout at the Supabase 60-second limit.

The solution: pre-compute all signal→cluster mappings into `v3_signal_cache` once, then the backfill functions do O(1) hash lookups.

#### 7a. Create the cache table

```sql
CREATE TABLE IF NOT EXISTS v3_signal_cache (
  signal TEXT PRIMARY KEY,
  cluster_id INT NOT NULL
);
```

#### 7b. Seed with direct matches

```sql
-- Seed cache from canonical corpus (exact matches)
INSERT INTO v3_signal_cache (signal, cluster_id)
SELECT signal, cluster_id FROM v3_signal_cluster_map
ON CONFLICT DO NOTHING;
```

#### 7c. Collect unmapped signals

```sql
-- Create persistent (not temp!) table of signals needing trigram matching
CREATE TABLE IF NOT EXISTS v3_unmapped_signals (signal TEXT PRIMARY KEY);
TRUNCATE v3_unmapped_signals;

INSERT INTO v3_unmapped_signals (signal)
SELECT DISTINCT lower(trim(s->>'signal'))
FROM "PlaceIntelligence" pi,
LATERAL jsonb_array_elements(pi.signals::jsonb) s
WHERE pi.status = 'complete' AND pi."signalCount" > 0
  AND lower(trim(s->>'signal')) NOT IN (SELECT signal FROM v3_signal_cache)
ON CONFLICT DO NOTHING;

SELECT count(*) FROM v3_unmapped_signals;
-- Expect ~100K+
```

#### 7d. Batch-populate cache using trigram similarity

Process in batches of ~20,000. The `%` operator uses the GIN trigram index and runs at ~2.4ms per signal (vs ~55ms without the index). Each batch takes 30-50 seconds.

```sql
-- Repeat this pattern until v3_unmapped_signals is empty:

INSERT INTO v3_signal_cache (signal, cluster_id)
SELECT u.signal, COALESCE(m.cluster_id, abs(hashtext(u.signal)) % K) as cluster_id
FROM (SELECT signal FROM v3_unmapped_signals ORDER BY signal LIMIT 20000) u
LEFT JOIN LATERAL (
  SELECT scm.cluster_id
  FROM v3_signal_cluster_map scm
  WHERE scm.signal % u.signal          -- uses GIN trigram index
  ORDER BY scm.signal <-> u.signal     -- distance operator
  LIMIT 1
) m ON true
ON CONFLICT (signal) DO NOTHING;

-- Remove processed signals
DELETE FROM v3_unmapped_signals
WHERE signal IN (SELECT signal FROM v3_signal_cache);

-- Check remaining
SELECT count(*) FROM v3_unmapped_signals;
```

For ~106K unmapped signals, this takes about 6 batches (106K / 20K). Total time: ~3-5 minutes.

**IMPORTANT:** Replace `K` in `abs(hashtext(u.signal)) % K` with the actual cluster count (e.g., 400).

#### 7e. Update lookup function to use cache

```sql
CREATE OR REPLACE FUNCTION lookup_signal_cluster_v3(
  signal_text text,
  num_clusters int DEFAULT 400  -- update this default when K changes
) RETURNS int AS $$
DECLARE
  normalized text;
  result int;
BEGIN
  normalized := lower(trim(signal_text));

  -- 1. Pre-computed cache (covers all ~113K+ signals)
  SELECT cluster_id INTO result FROM v3_signal_cache WHERE signal = normalized;
  IF result IS NOT NULL THEN RETURN result; END IF;

  -- 2. Direct cluster map lookup (for any brand-new signals)
  SELECT cluster_id INTO result FROM v3_signal_cluster_map WHERE signal = normalized;
  IF result IS NOT NULL THEN
    INSERT INTO v3_signal_cache (signal, cluster_id) VALUES (normalized, result) ON CONFLICT DO NOTHING;
    RETURN result;
  END IF;

  -- 3. Trigram similarity fallback (rare — only for truly new signals post-cache)
  SELECT scm.cluster_id INTO result
  FROM v3_signal_cluster_map scm
  WHERE scm.signal % normalized
  ORDER BY scm.signal <-> normalized
  LIMIT 1;
  IF result IS NOT NULL THEN
    INSERT INTO v3_signal_cache (signal, cluster_id) VALUES (normalized, result) ON CONFLICT DO NOTHING;
    RETURN result;
  END IF;

  -- 4. Hash fallback
  result := abs(hashtext(normalized)) % num_clusters;
  INSERT INTO v3_signal_cache (signal, cluster_id) VALUES (normalized, result) ON CONFLICT DO NOTHING;
  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

#### 7f. Verify cache and clean up

```sql
-- Should have ~113K+ rows (canonical + all property signals)
SELECT count(*) FROM v3_signal_cache;

-- Check cluster distribution isn't degenerate
SELECT cluster_id, count(*) as n
FROM v3_signal_cache
GROUP BY cluster_id
ORDER BY n DESC
LIMIT 10;
-- Top clusters should have 500-800 signals; not 50K+ (which would indicate hash fallback dominated)

-- Clean up
DROP TABLE IF EXISTS v3_unmapped_signals;
```

### Step 8: Run the Backfill

#### Preferred method: TypeScript via vector-refresh cron (v3.6+)

First null all property embeddings to force recompute:
```sql
UPDATE "PlaceIntelligence" SET "embeddingV3" = NULL;
```

Then run the cron (dev server must be running locally):
```bash
curl -X GET http://localhost:3000/api/cron/vector-refresh \
  -H "Authorization: Bearer $CRON_SECRET"
```

This recomputes IDF weights, all user vectors, all property embeddings, and refreshes population stats in one call. For 1,189 properties + 6 users, completes in ~2-3 minutes.

**Important**: The dev server must have been restarted after updating signal-clusters.json (Step 3) to clear the singleton cluster state cache.

#### Legacy method: PL/pgSQL (only if TypeScript path unavailable)

With the signal cache populated, backfill via SQL:

```sql
-- 8a. Property embeddings
SELECT count(*) FROM (
  SELECT compute_property_embedding_v3(id)
  FROM "PlaceIntelligence"
  WHERE status = 'complete' AND "signalCount" > 0 AND "embeddingV3" IS NULL
) sub;
```

```sql
-- 8b. User taste vectors
SELECT compute_user_vector_v3(id)
FROM "User"
WHERE "isOnboardingComplete" = true AND "tasteVectorV3" IS NULL;
```

**Note**: The PL/pgSQL path requires Steps 5-7 (staging tables + signal cache) to be completed first. The TypeScript path does not.

### Step 9: Verify

```sql
-- Coverage check
SELECT
  'Properties' as entity,
  count(*) FILTER (WHERE "embeddingV3" IS NOT NULL) as has_v3,
  count(*) FILTER (WHERE "embeddingV3" IS NULL) as missing_v3
FROM "PlaceIntelligence"
WHERE status = 'complete' AND "signalCount" > 0;

SELECT
  'Users' as entity,
  count(*) FILTER (WHERE "tasteVectorV3" IS NOT NULL) as has_v3,
  count(*) FILTER (WHERE "tasteVectorV3" IS NULL) as missing_v3
FROM "User"
WHERE "isOnboardingComplete" = true;

-- Dimension check
SELECT vector_dims("embeddingV3") FROM "PlaceIntelligence" WHERE "embeddingV3" IS NOT NULL LIMIT 1;
SELECT vector_dims("tasteVectorV3") FROM "User" WHERE "tasteVectorV3" IS NOT NULL LIMIT 1;
```

### Step 10: Quality Check — Compare v(old) vs v(new)

Run these queries to compare ranking quality between the old and new vectors:

```sql
-- Score distribution comparison
WITH v3_scores AS (
  SELECT
    pi."propertyName",
    round(((1 - (u."tasteVectorV3" <=> pi."embeddingV3")) * 100)::numeric, 1) as score
  FROM "User" u
  CROSS JOIN "PlaceIntelligence" pi
  WHERE u."isOnboardingComplete" = true
    AND u."tasteVectorV3" IS NOT NULL AND pi."embeddingV3" IS NOT NULL
)
SELECT
  min(score) as min_score,
  round(avg(score)::numeric, 1) as avg_score,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY score)::numeric(5,1) as median,
  max(score) as max_score,
  round(stddev(score)::numeric, 2) as std_dev
FROM v3_scores;
```

**What to look for:**
- Higher top scores than previous version (more discrimination)
- Standard deviation ≥ 4.0 (scores aren't all clustered together)
- The top-10 properties should be subjectively good matches for the test user

```sql
-- Top 20 matches for the test user
SELECT pi."propertyName",
  round(((1 - (u."tasteVectorV3" <=> pi."embeddingV3")) * 100)::numeric, 1) as score
FROM "User" u CROSS JOIN "PlaceIntelligence" pi
WHERE u."isOnboardingComplete" = true
  AND u."tasteVectorV3" IS NOT NULL AND pi."embeddingV3" IS NOT NULL
ORDER BY u."tasteVectorV3" <=> pi."embeddingV3"
LIMIT 20;

-- Property-to-property: check semantic coherence
-- (pick a property you know well and see if its neighbors make taste sense)
SELECT p2."propertyName",
  round((1 - (p1."embeddingV3" <=> p2."embeddingV3"))::numeric, 4) as sim
FROM "PlaceIntelligence" p1 CROSS JOIN "PlaceIntelligence" p2
WHERE p1."propertyName" = 'YOUR PROPERTY HERE'
  AND p2."propertyName" != p1."propertyName"
  AND p1."embeddingV3" IS NOT NULL AND p2."embeddingV3" IS NOT NULL
ORDER BY p1."embeddingV3" <=> p2."embeddingV3"
LIMIT 10;
```


---

## Quick Reference: If K Doesn't Change (v3.6+ process)

If re-running with the same K (e.g., still 400) but more signals from new properties:

1. `node scripts/extract-signal-corpus.mjs`
2. Delete `signal-embeddings-cache.json` (to embed new signals)
3. `export OPENAI_API_KEY=$(grep OPENAI_API_KEY .env.local | cut -d= -f2)`
4. `python3 scripts/cluster-signals-v3.py --k 400`
5. Copy signal-clusters.json to all three locations:
   ```bash
   cp signal-clusters.json src/lib/taste-intelligence/signal-clusters.json
   cp signal-clusters.json public/data/signal-clusters.json
   ```
6. Restart dev server (to clear the singleton cluster state cache)
7. Null all property embeddings: `UPDATE "PlaceIntelligence" SET "embeddingV3" = NULL`
8. Run vector refresh cron (recomputes IDF, user vectors, property embeddings, population stats)
9. Check skipped signals (`GET /api/intelligence/skipped-signals`)
10. Rescore a test user and verify benchmark hotels
11. Update population stats defaults in `match-tier.ts`

No staging table loads, no signal cache builds, no PL/pgSQL function updates needed. The TypeScript pipeline handles everything.

## Quick Reference: If K Changes

Everything in the "K doesn't change" checklist, plus (BEFORE running the pipeline):

1. Update `VECTOR_DIM_V3` and `SIGNAL_DIMS_V3` in `vectors-v3.ts`
2. Update comments in `queries-v3.ts` and `backfill-v3.ts`
3. Update `prisma/schema.prisma` vector dimensions
4. Run DB migration (Step 4 — drop + recreate vector columns)
5. Run `npx prisma generate` to sync the Prisma client


---

## Lessons Learned / Design Notes for Next Time

### The Singleton Signal Problem (SOLVED in v3.6)

Properties produce ~150-300 signals each, but the canonical clustering corpus only includes signals appearing in 2+ properties (the `freq ≥ 2` filter in `extract-signal-corpus.mjs`). This meant roughly 60-70% of all distinct property signals were *not* in the cluster map. In v3.2, only 6,073 of 112,127 unique signals were direct matches (5.4%).

**v3.2-v3.5 fix**: Pre-compute all signal→cluster mappings into `v3_signal_cache` using batch trigram similarity with a GIN index. This handled the performance problem but trigram matching produced semantic errors (e.g., "steam-room-offering" → "room temperature issues" cluster).

**v3.6 fix (current)**: The clustering script now:
1. Extracts both corpus (freq≥2) AND singleton (freq=1) signals from the DB
2. Clusters the corpus signals via K-means as before
3. Embeds ALL singletons via OpenAI `text-embedding-3-small` and maps each to its nearest cluster centroid by cosine similarity
4. Outputs all 162K+ signal→cluster mappings in `signalToCluster`

This gives ~100% direct lookup coverage. The DB-side `v3_signal_cache` and trigram matching are no longer needed for the TypeScript backfill path. The PL/pgSQL functions still exist but are not the primary backfill mechanism — the TypeScript `vector-refresh` cron is.

**Remaining edge case**: Truly novel signals generated after the last re-cluster (e.g., new onboarding signals) won't have direct lookup entries. These fall through to OpenAI batch embedding at runtime (in `buildSignalFeaturesV3`), or are skipped if OpenAI is unavailable. Check `/api/intelligence/skipped-signals` to see what's falling through.

### Batch SQL Execution via Supabase MCP

The Supabase MCP `execute_sql` tool has a 60-second timeout and an approximate 1MB payload limit. For the signal map (~7,600 signals), this means:

- **Batch size of ~500 signals works** (each batch is ~30-50KB of SQL)
- **Single-line VALUES format is essential** — multi-line pretty-printed SQL hits the payload limit much faster
- **The compaction script should produce files ready to `cat` directly into execute_sql** — no manual editing needed
- **Execute domain + neighbor files first** (they're small and independent), then signal batches in any order

### Trigram Index Performance

The `pg_trgm` GIN index on `v3_signal_cluster_map.signal` improved batch cache population from ~55ms/signal (sequential scan) to ~2.4ms/signal (GIN-accelerated). The key is using the `%` operator and `<->` distance operator in the query, which Postgres can service with the GIN index. The `similarity()` function alone does NOT use the GIN index.

```sql
-- BAD: similarity() function forces sequential scan (~55ms/signal)
WHERE similarity(u.signal, scm.signal) > 0.15
ORDER BY similarity(u.signal, scm.signal) DESC

-- GOOD: % operator + <-> distance uses GIN index (~2.4ms/signal)
WHERE scm.signal % u.signal
ORDER BY scm.signal <-> u.signal
```

### Neighbor Bleed Design (v3.3+: Two-Tier Similarity-Scaled)

**v3.2 (deprecated):** Flat 0.25 decay, within-domain only, 3 neighbors.

**v3.3+ (current):** Two-tier, similarity-scaled weights:
- **Intra-domain** (tier 1): Up to 3 neighbors within same domain, weight = similarity × intra_bleed_scale (threshold > 0.3). Range: 0.09–0.27 at scale=0.30.
- **Cross-domain** (tier 2): Up to 2 neighbors across domains, weight = similarity × cross_bleed_scale (threshold > 0.5). Range: 0.05–0.09 at scale=0.10.

**Where bleed scales live:**
- **signal-clusters.json**: `intra_bleed_scale` and `cross_bleed_scale` fields (source of truth)
- **vectors-v3.ts**: Reads from JSON; falls back to hardcoded 0.15/0.03 if fields missing
- **v3_cluster_neighbors table**: Pre-computed `weight` column (used by PL/pgSQL functions only)
- **BLEED_ONLY_DAMPEN** in `constants.ts` (0.25): Separate from bleed scales — this attenuates clusters that only received energy via bleed (no direct signal hit). This is the key lever for hotel scoring.

**Why similarity-scaled?** With soft cluster boundaries (avg silhouette ~0.09), high-similarity neighbors represent genuine taste gradients — clusters that almost merged during K-means. These should bleed more. Low-similarity neighbors are genuinely distinct and should bleed less. The old flat 0.25 treated a 0.91-similarity neighbor the same as a 0.38-similarity one, losing information.

**Why cross-domain?** Some taste patterns are inherently cross-domain: "raw alpine materiality" (Design) co-occurs with "mountain silence" (Atmosphere). Without cross-domain bleed, these patterns require direct signal in both domains. The 0.10 scale keeps cross-domain bleed gentle (max weight ~0.09) to prevent semantic confusion.

If you want to tune:
- **BLEED_ONLY_DAMPEN (0.25)**: The most impactful lever. Controls how much bleed-only clusters contribute. 0.08 was too low for hotels; 0.25 works well. In `constants.ts`.
- **Intra scale (0.30)**: Controls within-domain smoothing. Higher = smoother, lower = sharper. In signal-clusters.json.
- **Cross scale (0.10)**: Controls cross-domain bridging. Keep low to avoid spurious connections. In signal-clusters.json.
- **Cross threshold (0.5)**: Only high-similarity cross-domain pairs qualify. Lower = more bridges, more noise risk. In the clustering script.
- **Audit cross-domain links** after regenerating: check that "Japanese garden" (Setting) doesn't bleed to "Japanese breakfast" (FoodDrink) via surface vocabulary overlap.

## DB Tables Reference

| Table | Rows (v3.6) | Purpose | Still Used? |
|-------|-------------|---------|-------------|
| `v3_signal_cluster_map` | 7,627 | Canonical signal → cluster_id (from clustering corpus) | Only by PL/pgSQL functions (not primary path) |
| `v3_cluster_domain` | 400 | Cluster → taste domain name | Only by PL/pgSQL functions |
| `v3_cluster_neighbors` | ~1,200+ | Cluster → neighbors + similarity + weight + tier | Only by PL/pgSQL functions |
| `v3_signal_cache` | 113,907 | Pre-computed lookup for ALL property signals | Only by PL/pgSQL functions — TypeScript uses signal-clusters.json directly |
| `_idf_weights` | 112,050 | Signal → IDF weight + doc frequency | Only by PL/pgSQL functions — TypeScript computes IDF in memory |

**Note**: The v3.6 pipeline runs entirely via TypeScript (`vectors-v3.ts` + `backfill-v3.ts` + `vector-refresh` cron). The DB staging tables and PL/pgSQL functions are legacy from when backfill was done SQL-side. They still work but are not the primary path. Steps 5-7 in the old process (load staging tables, build signal cache) can be skipped when using the TypeScript pipeline.

Tables that can be safely dropped: `_signal_cluster_map_v3` (legacy), `_signal_token_index` (legacy).

## Cluster Surgery (Post-Clustering Fixes)

Sometimes individual clusters need to be dissolved (bad grouping) or split (too heterogeneous) without re-running the full pipeline. The surgery scripts handle this.

### When to Use

- A cluster groups semantically unrelated signals (dissolve it — scatter signals to nearest remaining centroids)
- A cluster is too broad / has low coherence (auto-split — move outlier signals below coherence threshold to nearest neighbors)
- You want to remove a cluster entirely without re-clustering from scratch

### Process

**Step 1: Run surgery on `signal-clusters.json`**

```bash
# Dissolve clusters (scatter all signals to nearest centroids):
python3 scripts/surgery-clusters.py dissolve 88 98

# Auto-split (move outlier signals below coherence threshold):
python3 scripts/surgery-clusters.py auto-split 37 128
python3 scripts/surgery-clusters.py auto-split 71 351 374 375
```

The surgery script modifies `signal-clusters.json` in-place and prints an "IMPORTANT: After surgery, recompute vectors" message.

**Step 2: Sync DB staging tables + recompute vectors**

```bash
python3 scripts/sync-db-after-surgery.py
```

This script reads the updated `signal-clusters.json` and:
1. Reloads `v3_cluster_domain` (400 rows)
2. Reloads `v3_cluster_neighbors` (~1,988 rows — unchanged by surgery)
3. Reloads `v3_signal_cluster_map` (canonical corpus)
4. Updates `v3_signal_cache` (deletes stale entries for affected clusters, re-seeds from corpus, remaps orphans via trigram similarity)
5. Verifies all staging table row counts
6. Nulls and recomputes all `embeddingV3` and `tasteVectorV3` vectors

Options:
- `--dry-run` — show what would happen without modifying the DB
- `--skip-backfill` — sync staging tables only, skip vector recompute
- `--batch-size N` — properties per batch during backfill (default 100)

Typical runtime: ~2-3 minutes for ~1,100 properties + 6 users.

### Critical: Do NOT Use Manual MCP Batch Inserts

The sync script **must be run locally** via direct Postgres connection (`DIRECT_URL` in `.env.local`). Do NOT attempt to sync staging tables via Supabase MCP `execute_sql` batches — this approach is:
- Extremely slow (hours vs seconds for staging table loads)
- Error-prone (batch truncation, timeout issues, partial loads)
- Painful to debug and recover from

The local script completes the entire sync in ~2-3 minutes. The MCP approach took hours of manual babysitting and still produced partial/incorrect results. Always use the script.

### v3.5 Surgery Log (March 19, 2026)

Operations performed:
- `dissolve 88 98` — dissolved 2 clusters (scattered signals to nearest centroids)
- `auto-split 37 128` — split outlier signals from 2 clusters
- `auto-split 71 351 374 375` — split outlier signals from 4 clusters

Result: 8 affected clusters (37, 71, 88, 98, 128, 351, 374, 375) — all emptied/redistributed. Canonical corpus went from ~6,914 to 6,598 signals (redistributed, not lost). 131,643 total signalToCluster entries preserved. All 1,161 property vectors and 6 user vectors recomputed successfully.

## Version History

| Version | Date | K | Dims | Signals | Properties | Notes |
|---------|------|---|------|---------|------------|-------|
| v3.0 | 2025 | 96 | 104 | 3,300 | ~250 | Original, hash-based |
| v3.1 | Mar 2026 | 300 | 308 | 5,047 | 360 | Semantic K-means, no neighbor bleed |
| v3.2 | Mar 2026 | 400 | 408 | 7,628 | 736 | + neighbor bleed, signal cache, trigram optimization |
| v3.3 | Mar 2026 | 400 | 408 | 7,628 | 736 | + two-tier similarity-scaled bleed, cross-domain neighbors |
| v3.4 | Mar 2026 | 400 | 400 | 7,628 | 736 | Dropped domain dims (signal-only), single L2 norm, std_dev 3.79→4.07 |
| v3.5 | Mar 2026 | 400 | 400 | 6,598 | 1,161 | Cluster surgery: dissolved 88/98, auto-split 37/71/128/351/374/375 |
| v3.6 | Mar 2026 | 400 | 400 | 162,398 | 1,189 | Full singleton mapping, Geography→Setting rename, lowercase key fix, BLEED_ONLY_DAMPEN=0.25 |

---

## v3.6 Session Learnings (March 22, 2026)

This section documents the full end-to-end re-cluster + rescore run that produced v3.6, and all the bugs, fixes, and architectural insights discovered along the way. Feed this entire document (including this section) to Claude for the next re-cluster.

### What Changed in v3.6

1. **Full singleton mapping**: `extract-signal-corpus.mjs` now outputs `signal-singletons.json` (freq=1 signals) alongside the existing `signal-corpus.json` (freq≥2). The clustering script embeds all singletons via OpenAI and maps each to its nearest cluster centroid by cosine similarity. This grew `signalToCluster` from ~6,598 to **162,398 entries** — essentially 100% coverage of all known signals.

2. **Geography→Setting domain rename**: The `Geography` domain was renamed to `Setting` in `TasteNode` but the extraction script was still using the old name. `extract-signal-corpus.mjs` now maps `Geography` → `Setting` during extraction.

3. **Three-location sync for signal-clusters.json**: The file must exist in three places, all identical:
   - `/signal-clusters.json` (root — gitignored, used by clustering scripts)
   - `/src/lib/taste-intelligence/signal-clusters.json` (bundled with code)
   - `/public/data/signal-clusters.json` (runtime loader reads from here via `signal-clusters-loader.ts`)

   **CRITICAL**: The runtime loader (`getSignalClusterMap()`) reads from `public/data/`. If you only update the root and `src/lib/` copies, the running server will use stale data. Always copy to all three locations after clustering.

4. **BLEED_ONLY_DAMPEN raised from 0.08 to 0.25** in `/src/lib/constants.ts`. This constant controls how much energy cross-domain neighbor bleed contributes to a signal's cluster activation. The old value was too conservative — hotels that spread signals across many domains (Wellness + Setting + Design + Service) were getting penalized because their cross-domain bleed was nearly zeroed out.

5. **Lowercase key normalization**: The clustering script preserved original casing in `signalToCluster` keys (e.g., `"DJ-driven-nightlife"`, `"LGBTQ-welcoming"`, `"Relais-&-Châteaux-member"`), but the runtime lookup code normalizes signals to lowercase via `.toLowerCase()`. This caused **10,320 signals (6.3%)** to silently fail direct lookup and fall through to the OpenAI batch embedding fallback on every vector computation. Fix: `vectors-v3.ts` now lowercases all keys when loading the cluster state in `getClusterState()`. Only 61 key collisions out of 162K — negligible.

6. **Word-overlap fallback removed**: The fallback chain for unmapped signals was: direct lookup → OpenAI batch embedding → word-overlap → hash. Word-overlap was removed because it produces poor results (e.g., routing "steam-room-offering" to a "room temperature issues" cluster because of the word "room"). A misrouted signal is worse than a skipped one. The chain is now: **direct lookup → OpenAI batch embedding → skip (with logging)**.

7. **Skipped signal tracking**: New in-memory cache in `vectors-v3.ts` records every signal that was skipped during vector computation (failed both direct lookup and OpenAI embedding). Queryable via `GET /api/intelligence/skipped-signals`. Use this to identify signals that need adding to the next re-cluster corpus.

### Critical Bugs Encountered and Fixed

#### Bug 1: K mismatch (K=550 vs VECTOR_DIM_V3=400)

If you run the clustering script without `--k 400` and it produces more clusters than `VECTOR_DIM_V3`, cluster IDs beyond 399 write beyond the array bounds in `buildSignalFeaturesV3`. After L2 normalization, this produces NaN vectors that break pgvector (`"NaN not allowed in vector"`).

**Prevention**: Always pass `--k 400` (or whatever `VECTOR_DIM_V3` is set to) when running the clustering script. If you want to change K, update `VECTOR_DIM_V3` and `SIGNAL_DIMS_V3` in `vectors-v3.ts` FIRST, then run the DB migration (Step 4 in main runbook).

#### Bug 2: Stale public/data/signal-clusters.json

The runtime loader is a singleton cached for the process lifetime. After updating signal-clusters.json, you MUST restart the dev server to clear the cache. Without a restart, the old cluster data continues to be used for all vector computations.

**Prevention**: After any re-cluster:
```bash
cp signal-clusters.json src/lib/taste-intelligence/signal-clusters.json
cp signal-clusters.json public/data/signal-clusters.json
# Then restart dev server
```

#### Bug 3: OpenAI API key not available to Python

`source <(grep OPENAI_API_KEY .env.local)` loads the key into the shell but NOT into `os.environ` for Python subprocesses. Use:
```bash
export OPENAI_API_KEY=$(grep OPENAI_API_KEY .env.local | cut -d= -f2)
python3 scripts/cluster-signals-v3.py --k 400
```

#### Bug 4: Prisma client out of sync after schema changes

If you modify the Prisma schema or DB columns, the Prisma client can get out of sync, causing P2022 errors ("column not available") that silently prevent DB writes. The rescore API will report `scored: 0, skipped: 538` with no error.

**Fix**: Run `npx prisma generate` after any schema change.

#### Bug 5: Git lock files blocking commits

`.git/index.lock` and `.git/HEAD.lock` can block git operations. Use the Cowork `allow_cowork_file_delete` tool to delete them.

### Updated End-to-End Re-Cluster Process (v3.6+)

This supersedes the "Quick Reference: If K Doesn't Change" section for the common case.

#### Prerequisites
```bash
cd terrazzo-web
export OPENAI_API_KEY=$(grep OPENAI_API_KEY .env.local | cut -d= -f2)
```

#### Step 1: Extract signal corpus (includes singletons)
```bash
node scripts/extract-signal-corpus.mjs
```
Outputs: `signal-corpus.json`, `signal-singletons.json`, `signal-dimensions.json`

#### Step 2: Run clustering with singleton mapping
```bash
python3 scripts/cluster-signals-v3.py --k 400
```
This embeds all corpus signals AND singletons, clusters the corpus, then maps singletons to nearest centroid. Output: `signal-clusters.json` with 162K+ `signalToCluster` entries.

**IMPORTANT**: Always use `--k 400` (or match `VECTOR_DIM_V3`). The script defaults to a silhouette sweep that may produce a different K.

#### Step 3: Copy signal-clusters.json to all three locations
```bash
cp signal-clusters.json src/lib/taste-intelligence/signal-clusters.json
cp signal-clusters.json public/data/signal-clusters.json
```

#### Step 4: Restart dev server
```bash
# Ctrl+C the running server, then:
npm run dev
```
This clears the singleton cluster state cache so the new data loads.

#### Step 5: Null all property embeddings
Either via Supabase SQL:
```sql
UPDATE "PlaceIntelligence" SET "embeddingV3" = NULL;
```
Or via the Supabase MCP `execute_sql` tool.

#### Step 6: Run vector refresh
```bash
curl -X GET http://localhost:3000/api/cron/vector-refresh \
  -H "Authorization: Bearer $CRON_SECRET"
```
This recomputes IDF weights, all user vectors, and all property embeddings. Watch the server logs — you should see zero OpenAI embedding calls if all signals have direct lookup coverage.

#### Step 7: Check skipped signals
```bash
curl http://localhost:3000/api/intelligence/skipped-signals \
  -H "Authorization: Bearer $CRON_SECRET"
```
If `total > 0`, those signals need to be added to the clustering corpus for the next run.

#### Step 8: Rescore a test user
```bash
curl -X POST http://localhost:3000/api/intelligence/rescore \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -d '{"userId":"cmlvca5sx000004lasyug8tqw","recompute":true}'
```
Check that `scored` equals `total` (no skips), and that the population stats look reasonable (mean ~0.16, stddev ~0.08 as of v3.6).

#### Step 9: Update population stats fallback defaults
Update `DEFAULT_POPULATION_MEAN` and `DEFAULT_POPULATION_STDDEV` in `/src/lib/match-tier.ts` with the values from the vector refresh response.

#### Step 10: Verify benchmark hotels
```sql
SELECT "matchScore", name, type
FROM "SavedPlace"
WHERE "userId" = 'cmlvca5sx000004lasyug8tqw'
  AND (name ILIKE '%forestis%' OR name ILIKE '%sanders%' OR name ILIKE '%ett hem%');
```
As of v3.6: Forestis=0.225, Sanders=0.220, Ett Hem=0.175 (all above population mean of 0.160).

#### Step 11: Commit and deploy
```bash
git add signal-clusters.json src/lib/taste-intelligence/signal-clusters.json public/data/signal-clusters.json
git add src/lib/taste-intelligence/vectors-v3.ts src/lib/match-tier.ts src/lib/constants.ts
git commit -m "Re-cluster v3.6: full singleton mapping, N signals, K=400"
git push
```

### Architectural Notes for Future Work

#### Hotel vs Restaurant Scoring Gap

Hotels systematically score lower than restaurants because:

1. **Hotels spread signals across many domains** (Wellness + Setting + Design + Service + Atmosphere) while restaurants concentrate in fewer (FoodDrink + Atmosphere + Service). After mean-centering and L2 normalization, concentrated signals produce sharper spikes that align better in cosine similarity.

2. **User vectors are sparse in hotel-critical domains** (Wellness, Setting, Sustainability). These domains are exempted from gap-fill in `domain-gap-check` because they're more like optional filters than core taste dimensions. Most users have zero signal in these domains.

3. **BLEED_ONLY_DAMPEN was too low** (0.08). Hotels' cross-domain signal bleed was being nearly zeroed out. Raising to 0.25 was the single biggest improvement.

#### Planned Fixes (not yet implemented)

1. **Asymmetric similarity**: Only compute cosine similarity on dimensions where the user has meaningful activation (|user[i]| > threshold). This prevents hotel dimensions the user has no opinion on from diluting the score. Implementation goes in `computeVectorMatch()` in `taste-match-vectors.ts`.

2. **Conditional Wellness/Sustainability onboarding**: Gate question asking "Is wellness/sustainability important to you?" → if yes, serve deep-dive questions to build out signals in those domains. This improves data quality for users who care about those hotel-critical domains.

3. **Mean-centering is correct**: Don't remove it. Without mean-centering, all cosine scores cluster at ~0.83 with 0.02 spread. Mean-centering gives the discrimination needed. The asymmetric similarity fix addresses the "broad activation penalty" without touching mean-centering.

### Score Progression (Greg's account, benchmark hotels)

| Hotel | v3.5 (before) | After K=400 rescore | v3.6 (lowercase fix + BLEED=0.25) |
|---|---|---|---|
| Forestis Dolomites | -0.020 | 0.044 | **0.225** |
| Hotel Sanders | -0.018 | 0.026 | **0.220** |
| Ett Hem | 0.020 | 0.011 | **0.175** |

Population stats: mean=0.160, stddev=0.082 (2,378 scored pairs)
