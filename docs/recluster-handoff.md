# V3 Re-Clustering Pipeline: End-to-End Runbook

## What This Is

When the property catalog grows (new places finish enrichment), the v3 semantic clustering pipeline needs to be re-run to incorporate new signals. This document is a complete, copy-pasteable runbook — it covers every step from corpus extraction through quality verification, with the specific fixes and optimizations learned from the v3.1 → v3.2 migration.

## Current State (as of March 5, 2026)

- **736 enriched properties** in the DB
- **v3.3 clustering**: 400 clusters, 408-dim vectors (8 domain + 400 signal dims)
- **Neighbor bleed (v3.3)**: Two-tier similarity-scaled bleed (replaces flat 0.25 decay)
  - **Intra-domain**: up to 3 neighbors per cluster, weight = similarity × 0.30
  - **Cross-domain**: up to 2 neighbors per cluster, weight = similarity × 0.10 (similarity > 0.5 threshold)
- **signal-clusters.json**: Generated from 7,628 signals (freq ≥ 2)
- **DB columns**: `PlaceIntelligence.embeddingV3 vector(408)` and `User.tasteVectorV3 vector(408)` — all populated
- **DB staging tables**: `v3_signal_cluster_map` (7,627 rows), `v3_cluster_domain` (400 rows), `v3_cluster_neighbors` (~1,200 intra + cross-domain rows, with `tier` column)
- **Signal cache**: `v3_signal_cache` (113,907 rows — pre-computed cluster assignments for every property signal, including the ~106K that don't appear in the canonical corpus)
- **IDF weights**: `_idf_weights` (112,050 rows)
- **PL/pgSQL functions**: `compute_property_embedding_v3`, `compute_user_vector_v3`, `lookup_signal_cluster_v3`, `compute_signal_match_v3` — all current and using cache. Functions read pre-computed `weight` from `v3_cluster_neighbors` (no logic change needed when bleed weights change).

## Architecture Overview

```
Vector layout: [0-7] 8 domain dims + [8-K-1] K cluster dims = 8+K total
  (currently: [0-7] + [8-407] = 408)

Signal → Cluster: signal-clusters.json (domain-aware hierarchical K-means on OpenAI embeddings)
Cluster → Dimension: cluster_id IS the dim index (offset by 8 for domains)
Neighbor bleed (v3.3 — two-tier, similarity-scaled):
  Primary cluster: activated at 100%
  Intra-domain neighbors (up to 3): weight = similarity × 0.30 (threshold > 0.3)
  Cross-domain neighbors (up to 2): weight = similarity × 0.10 (threshold > 0.5)
  Weights are pre-computed and stored in v3_cluster_neighbors.weight
  PL/pgSQL functions read weight directly — no runtime calculation needed
IDF weighting: ln(1 + N/df) per signal across all properties
Normalization: independent L2 norm on domains + signals, then 0.30/0.70 blend, then final L2 norm

Domain assignment (contiguous cluster ranges):
  Atmosphere (0-50), Character (51-135), Design (136-191), FoodDrink (192-263),
  Service (264-336), Setting (337-379), Sustainability (380-386), Wellness (387-399)
  (ranges shift whenever K changes — these are the v3.2/v3.3 ranges)
```

## Key Files

| File | Purpose |
|------|---------|
| `scripts/extract-signal-corpus.mjs` | Extracts signals from DB → `signal-corpus.json` |
| `scripts/cluster-signals-v3.py` | Embeds signals via OpenAI, runs K-means → `signal-clusters.json` |
| `src/lib/taste-intelligence/signal-clusters.json` | The cluster mapping (imported by vectors-v3.ts) |
| `src/lib/taste-intelligence/vectors-v3.ts` | TypeScript vector computation (runtime / API use) |
| `src/lib/taste-intelligence/backfill-v3.ts` | TypeScript backfill orchestrator |
| `src/lib/taste-intelligence/queries-v3.ts` | Vector similarity queries |
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

**Outputs:**
- `signal-corpus.json` — `[{s: "signal-name", d: "Domain", df: 5}, ...]` (signals with freq ≥ 2)
- `signal-dimensions.json` — `[{s: "signal-name", d: "Domain"}, ...]` (domain mapping)

**Sanity checks:**
- Total signal count should grow roughly proportional to new properties (was 5,047 at 360 places, 7,628 at 736 places)
- Domain distribution: Service > FoodDrink > Character > Design > Setting > Atmosphere > Wellness > Sustainability
- Frequency distribution — bulk should be freq 2-5

### Step 2: Run Clustering

```bash
export OPENAI_API_KEY=sk-...
pip install openai scikit-learn numpy  # if not installed

# Option A: Full silhouette sweep (recommended for major corpus changes)
python3 scripts/cluster-signals-v3.py --sweep

# Option B: Direct clustering at specific K
python3 scripts/cluster-signals-v3.py --k 400
```

**How to choose K:**
- Rule of thumb: `K ≈ sqrt(num_signals) * 1.5`, min 200, max 500
- For ~5K signals → K=250-350
- For ~8K signals → K=300-400
- For ~12K signals → K=350-500
- The sweep shows silhouette scores per K; pick the peak (silhouette > 0.10 is good for this data)

**The script:**
1. Loads `signal-corpus.json` and `signal-dimensions.json`
2. Embeds all signals with `text-embedding-3-small` (cached in `signal-embeddings-cache.json` — delete cache to re-embed)
3. Runs domain-aware hierarchical K-means (allocates sub-clusters proportionally per domain)
4. Computes 3 nearest neighbor clusters within each domain (for neighbor bleed)
5. Outputs `signal-clusters.json` to both `src/lib/taste-intelligence/` and project root

**Output format** (`signal-clusters.json`):
```json
{
  "version": "v3.2",
  "method": "domain-hierarchical-openai-kmeans",
  "embedding_model": "text-embedding-3-small",
  "k": 400,
  "avg_silhouette": 0.1016,
  "total_signals": 7628,
  "neighbor_decay": 0.25,
  "created": "2026-03-04",
  "clusters": { "0": { "label": "...", "domain": "...", "size": 15, "topSignals": [...] }, ... },
  "signalToCluster": { "signal-name": 0, ... },
  "clusterNeighbors": { "0": [{"cluster": 1, "similarity": 0.89, "weight": 0.25}, ...], ... }
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
- `vectors-v3.ts`: `VECTOR_DIM_V3 = 8 + NEW_K`, `SIGNAL_DIMS_V3 = NEW_K`
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

### Step 6: Update PL/pgSQL Backfill Functions (only if K changed)

If K didn't change, the existing functions are fine. If K changed, recreate these four functions with the new array sizes:

- `lookup_signal_cluster_v3(signal_text, num_clusters)` — cache → direct → trigram → hash fallback
- `compute_property_embedding_v3(prop_id)` — 8+K dim, neighbor bleed via `v3_cluster_neighbors`
- `compute_user_vector_v3(uid)` — same layout, processes `tasteProfile` + `TasteNode` signals
- `compute_signal_match_v3(...)` — scoring function with ratio-based anti-signal penalty

Key dimensions to update in each function:
- `signal_feats` / `signal_weights` array size: K
- `final_vec` array size: 8 + K
- All loop bounds: `FOR i IN 0..K-1`
- Vector cast: `final_vec::vector(8+K)`

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

With the signal cache populated, backfill is fast (~1-2 seconds per property).

#### 8a. Property embeddings

```sql
-- Backfill all properties (should complete in one call for <1000 properties)
SELECT count(*) FROM (
  SELECT compute_property_embedding_v3(id)
  FROM "PlaceIntelligence"
  WHERE status = 'complete' AND "signalCount" > 0 AND "embeddingV3" IS NULL
) sub;
```

If you have >1000 properties and it times out, batch in chunks of 200:

```sql
SELECT count(*) FROM (
  SELECT compute_property_embedding_v3(id)
  FROM "PlaceIntelligence"
  WHERE status = 'complete' AND "signalCount" > 0 AND "embeddingV3" IS NULL
  LIMIT 200
) sub;
-- Repeat until no NULL embeddingV3 remain
```

#### 8b. User taste vectors

```sql
SELECT compute_user_vector_v3(id)
FROM "User"
WHERE "isOnboardingComplete" = true AND "tasteVectorV3" IS NULL;
```

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

## Quick Reference: If K Doesn't Change

If re-running with the same K (e.g., still 400) but more signals from new properties:

1. `node scripts/extract-signal-corpus.mjs`
2. Delete `signal-embeddings-cache.json` (to embed new signals)
3. `python3 scripts/cluster-signals-v3.py --k 400`
4. Replace `signal-clusters.json` in repo
5. Load staging tables (Step 5 — truncate and reload all three tables)
6. Recompute IDF weights (Step 3)
7. Build signal cache (Step 7 — this is needed even if K is the same because new property signals need mappings)
8. Run backfill (Step 8)
9. Verify (Steps 9-10)

No code changes, no DB migration, no PL/pgSQL function updates needed.

## Quick Reference: If K Changes

Everything in the "K doesn't change" checklist, plus:

1. Update `VECTOR_DIM_V3` and `SIGNAL_DIMS_V3` in `vectors-v3.ts`
2. Update comments in `queries-v3.ts` and `backfill-v3.ts`
3. Update `prisma/schema.prisma` vector dimensions
4. Run DB migration (Step 4 — drop + recreate vector columns)
5. Recreate PL/pgSQL functions with new array sizes (Step 6)
6. Update the `num_clusters` default in `lookup_signal_cluster_v3`


---

## Lessons Learned / Design Notes for Next Time

### The Singleton Signal Problem

Properties produce ~150-300 signals each, but the canonical clustering corpus only includes signals appearing in 2+ properties (the `freq ≥ 2` filter in `extract-signal-corpus.mjs`). This means roughly 60-70% of all distinct property signals are *not* in the cluster map. In v3.2, 6,073 of 112,127 unique signals were direct matches (5.4%).

These "unmapped" signals are the primary performance bottleneck. Without pre-computation, every backfill call triggers expensive trigram similarity searches.

**The fix that worked:** Pre-compute all signal→cluster mappings into `v3_signal_cache` using batch trigram similarity with a GIN index. This turned the per-property backfill from "timeout after 60 seconds on 5 properties" to "736 properties in one call."

**For the next round**, consider:

1. **Lowering the freq threshold from 2 to 1** in `extract-signal-corpus.mjs`. This would include all signals in the corpus and eliminate the unmapped-signal problem entirely, at the cost of a much larger embedding batch (100K+ signals vs 7K). At ~$0.04 per 100K signals with `text-embedding-3-small`, the cost is negligible. The clustering quality might even improve since singleton signals often carry highly specific taste info.

2. **Building the cache as part of the clustering script** rather than as a separate SQL-side step. The Python script already has all the embeddings in memory — it could output a `signal-cache.json` with trigram-matched cluster assignments for every signal in the DB, not just the corpus signals. This would eliminate Steps 7c-7d entirely.

3. **Using the cache as the sole lookup path in PL/pgSQL.** If the cache is guaranteed to contain every signal that exists in any property, the `lookup_signal_cluster_v3` function becomes a single hash lookup with no fallback chain needed. The fallback chain (cache → direct → trigram → hash) is only necessary because new properties might introduce signals that weren't in any previous batch.

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

### Neighbor Bleed Design (v3.3: Two-Tier Similarity-Scaled)

**v3.2 (deprecated):** Flat 0.25 decay, within-domain only, 3 neighbors.

**v3.3 (current):** Two-tier, similarity-scaled weights:
- **Intra-domain** (tier 1): Up to 3 neighbors within same domain, weight = similarity × 0.30 (threshold > 0.3). Range: 0.09–0.27.
- **Cross-domain** (tier 2): Up to 2 neighbors across domains, weight = similarity × 0.10 (threshold > 0.5). Range: 0.05–0.09.

**Why similarity-scaled?** With soft cluster boundaries (avg silhouette ~0.10), high-similarity neighbors represent genuine taste gradients — clusters that almost merged during K-means. These should bleed more. Low-similarity neighbors are genuinely distinct and should bleed less. The old flat 0.25 treated a 0.91-similarity neighbor the same as a 0.38-similarity one, losing information.

**Why cross-domain?** Some taste patterns are inherently cross-domain: "raw alpine materiality" (Design) co-occurs with "mountain silence" (Atmosphere). Without cross-domain bleed, these patterns require direct signal in both domains. The 0.10 scale keeps cross-domain bleed gentle (max weight ~0.09) to prevent semantic confusion.

**Architecture note:** Weights are pre-computed and stored in `v3_cluster_neighbors.weight`. The PL/pgSQL backfill functions read `weight` directly — they don't know or care about tiers or scales. This means tuning the bleed only requires updating the `weight` column, not rewriting functions.

If you want to tune:
- **Intra scale (0.30)**: Controls within-domain smoothing. Higher = smoother, lower = sharper.
- **Cross scale (0.10)**: Controls cross-domain bridging. Keep low to avoid spurious connections.
- **Cross threshold (0.5)**: Only high-similarity cross-domain pairs qualify. Lower = more bridges, more noise risk.
- **Audit cross-domain links** after regenerating: check that "Japanese garden" (Setting) doesn't bleed to "Japanese breakfast" (FoodDrink) via surface vocabulary overlap.

## DB Tables Reference

| Table | Rows (v3.2) | Purpose |
|-------|-------------|---------|
| `v3_signal_cluster_map` | 7,627 | Canonical signal → cluster_id (from clustering corpus) |
| `v3_cluster_domain` | 400 | Cluster → taste domain name |
| `v3_cluster_neighbors` | ~1,200+ | Cluster → neighbors (intra + cross domain) + similarity + weight + tier |
| `v3_signal_cache` | 113,907 | Pre-computed lookup for ALL property signals (canonical + unmapped) |
| `_idf_weights` | 112,050 | Signal → IDF weight + doc frequency |

Tables that can be safely dropped: `_signal_cluster_map_v3` (legacy), `_signal_token_index` (legacy).

## Version History

| Version | Date | K | Dims | Signals | Properties | Notes |
|---------|------|---|------|---------|------------|-------|
| v3.0 | 2025 | 96 | 104 | 3,300 | ~250 | Original, hash-based |
| v3.1 | Mar 2026 | 300 | 308 | 5,047 | 360 | Semantic K-means, no neighbor bleed |
| v3.2 | Mar 2026 | 400 | 408 | 7,628 | 736 | + neighbor bleed, signal cache, trigram optimization |
| v3.3 | Mar 2026 | 400 | 408 | 7,628 | 736 | + two-tier similarity-scaled bleed, cross-domain neighbors |
