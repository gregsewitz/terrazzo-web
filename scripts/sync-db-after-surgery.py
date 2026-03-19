#!/usr/bin/env python3
"""
Sync DB staging tables + recompute vectors after cluster surgery.

Run this locally (where DATABASE_URL is available) after:
  python3 scripts/surgery-clusters.py dissolve|split|auto-split ... --apply

What it does:
  1. Reloads v3_signal_cluster_map, v3_cluster_domain, v3_cluster_neighbors
  2. Updates v3_signal_cache (deletes stale entries for affected clusters,
     re-seeds from canonical corpus, remaps orphans via trigram matching)
  3. Recomputes all property embeddings (compute_property_embedding_v3)
  4. Recomputes all user taste vectors (compute_user_vector_v3)
  5. Runs verification checks

Usage:
  python3 scripts/sync-db-after-surgery.py
  python3 scripts/sync-db-after-surgery.py --skip-backfill   # staging + cache only
  python3 scripts/sync-db-after-surgery.py --dry-run         # show plan, don't execute

Requires: psycopg2-binary, python-dotenv
  pip install psycopg2-binary python-dotenv
"""

import json
import sys
import time
import argparse
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    print("ERROR: psycopg2-binary required. Install with:")
    print("  pip install psycopg2-binary")
    sys.exit(1)

try:
    from dotenv import load_dotenv
    import os
    load_dotenv(Path(__file__).parent.parent / '.env.local')
except ImportError:
    import os
    print("WARNING: python-dotenv not found, using environment variables directly")

# ─── Args ────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Sync DB after cluster surgery")
parser.add_argument('--skip-backfill', action='store_true',
    help='Only reload staging tables and cache, skip vector recomputation')
parser.add_argument('--dry-run', action='store_true',
    help='Show what would be done without executing')
parser.add_argument('--batch-size', type=int, default=100,
    help='Properties per backfill batch (default: 100)')
args = parser.parse_args()

# ─── Connect ─────────────────────────────────────────────────────────────────

def get_db_url():
    """Get DATABASE_URL, stripping pgbouncer param if present."""
    for key in ('DIRECT_URL', 'DATABASE_URL'):
        url = os.environ.get(key)
        if url:
            # Strip pgbouncer param that psycopg2 doesn't understand
            url = url.replace('?pgbouncer=true', '').replace('&pgbouncer=true', '')
            return url
    return None

db_url = get_db_url()
if not db_url:
    print("ERROR: No DATABASE_URL or DIRECT_URL found in environment")
    print("Make sure .env.local is in the project root")
    sys.exit(1)

# ─── Load signal-clusters.json ───────────────────────────────────────────────

project_dir = Path(__file__).parent.parent
clusters_path = project_dir / "src" / "lib" / "taste-intelligence" / "signal-clusters.json"
if not clusters_path.exists():
    clusters_path = project_dir / "signal-clusters.json"
if not clusters_path.exists():
    print("ERROR: Could not find signal-clusters.json")
    sys.exit(1)

print(f"Loading {clusters_path}...")
with open(clusters_path) as f:
    data = json.load(f)

clusters = data['clusters']
signal_to_cluster = data['signalToCluster']
cluster_neighbors = data.get('clusterNeighbors', {})
intra_bleed = data.get('intra_bleed_scale', 0.30)
cross_bleed = data.get('cross_bleed_scale', 0.10)
k = data.get('k', 400)

# Identify affected clusters (dissolved or size=0)
affected = [int(cid) for cid, c in clusters.items()
            if c.get('dissolved') or c.get('size', 1) == 0]

print(f"  Version: {data.get('version')}")
print(f"  K: {k}")
print(f"  Canonical signals: {sum(len(c.get('topSignals', [])) for c in clusters.values())}")
print(f"  Total signalToCluster: {len(signal_to_cluster)}")
print(f"  Affected clusters (dissolved/empty): {affected}")

if args.dry_run:
    print("\n[DRY RUN] Would perform the following:")
    print("  1. Truncate + reload v3_cluster_domain (400 rows)")
    print(f"  2. Truncate + reload v3_cluster_neighbors ({sum(len(v) for v in cluster_neighbors.values())} rows)")
    canonical_count = sum(len(c.get('topSignals', [])) for c in clusters.values())
    print(f"  3. Truncate + reload v3_signal_cluster_map ({canonical_count} rows)")
    print(f"  4. Delete stale cache entries for clusters {affected}")
    print(f"  5. Re-seed cache from canonical corpus")
    print(f"  6. Remap ~orphaned cache entries via trigram matching")
    if not args.skip_backfill:
        print(f"  7. NULL all embeddingV3 + recompute all property embeddings")
        print(f"  8. NULL all tasteVectorV3 + recompute all user vectors")
    sys.exit(0)

# ─── Execute ─────────────────────────────────────────────────────────────────

print(f"\nConnecting to database...")
conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor()
print("  Connected.")

def timed(label):
    """Context manager for timing operations."""
    class Timer:
        def __enter__(self):
            self.start = time.time()
            print(f"\n{'─' * 60}")
            print(f"  {label}...")
            return self
        def __exit__(self, *args):
            elapsed = time.time() - self.start
            print(f"  Done ({elapsed:.1f}s)")
    return Timer()

# ── Step 1: v3_cluster_domain ────────────────────────────────────────────────

with timed("Step 1/6: Reload v3_cluster_domain"):
    cur.execute("TRUNCATE v3_cluster_domain;")
    domain_rows = [(int(cid), c['domain']) for cid, c in clusters.items()]
    execute_values(cur,
        "INSERT INTO v3_cluster_domain (cluster_id, domain) VALUES %s",
        domain_rows)
    print(f"  Loaded {len(domain_rows)} rows")

# ── Step 2: v3_cluster_neighbors ─────────────────────────────────────────────

with timed("Step 2/6: Reload v3_cluster_neighbors"):
    cur.execute("TRUNCATE v3_cluster_neighbors;")
    neighbor_rows = []
    for cid_str, nlist in cluster_neighbors.items():
        for n in nlist:
            tier = n.get('tier', 'intra')
            sim = n['similarity']
            scale = cross_bleed if tier == 'cross' else intra_bleed
            weight = round(sim * scale, 6)
            neighbor_rows.append((int(cid_str), n['cluster'], sim, weight, tier))
    execute_values(cur,
        "INSERT INTO v3_cluster_neighbors (cluster_id, neighbor_id, similarity, weight, tier) VALUES %s",
        neighbor_rows)
    print(f"  Loaded {len(neighbor_rows)} rows")

# ── Step 3: v3_signal_cluster_map ────────────────────────────────────────────

with timed("Step 3/6: Reload v3_signal_cluster_map"):
    cur.execute("TRUNCATE v3_signal_cluster_map;")
    canonical_rows = []
    for cid_str, c in clusters.items():
        for s in c.get('topSignals', []):
            canonical_rows.append((s, int(cid_str)))
    execute_values(cur,
        "INSERT INTO v3_signal_cluster_map (signal, cluster_id) VALUES %s "
        "ON CONFLICT DO NOTHING",
        canonical_rows, page_size=1000)
    print(f"  Loaded {len(canonical_rows)} canonical signals")

# ── Step 4: Update v3_signal_cache ───────────────────────────────────────────

with timed("Step 4/6: Update v3_signal_cache"):
    if affected:
        affected_str = ','.join(str(c) for c in affected)
        cur.execute(f"SELECT count(*) FROM v3_signal_cache WHERE cluster_id IN ({affected_str})")
        stale_count = cur.fetchone()[0]
        print(f"  Deleting {stale_count} stale cache entries for clusters {affected}")
        cur.execute(f"DELETE FROM v3_signal_cache WHERE cluster_id IN ({affected_str})")
    else:
        print("  No affected clusters — skipping stale deletion")

    # Re-seed from canonical corpus
    cur.execute("""
        INSERT INTO v3_signal_cache (signal, cluster_id)
        SELECT signal, cluster_id FROM v3_signal_cluster_map
        ON CONFLICT (signal) DO UPDATE SET cluster_id = EXCLUDED.cluster_id
    """)
    print("  Re-seeded from canonical corpus")

    # Bump timeout for the expensive orphan scan (trigram similarity)
    cur.execute("SET statement_timeout = '600s'")

    # Find orphaned cache entries pointing to dissolved/empty clusters
    # and remap them via trigram similarity to the canonical corpus
    print("  Scanning for orphaned cache entries...")
    cur.execute("""
        CREATE TEMP TABLE _orphans AS
        SELECT sc.signal, sc.cluster_id AS old_cluster
        FROM v3_signal_cache sc
        WHERE NOT EXISTS (
            SELECT 1 FROM v3_signal_cluster_map scm
            WHERE scm.cluster_id = sc.cluster_id
              AND scm.signal = sc.signal
        )
        AND sc.cluster_id = ANY(%s)
    """, (affected if affected else [],))
    cur.execute("SELECT count(*) FROM _orphans")
    orphan_count = cur.fetchone()[0]
    print(f"  Found {orphan_count} orphaned cache entries")

    if orphan_count > 0:
        # Remap orphans via trigram similarity to canonical corpus
        print("  Remapping orphans via trigram matching...")
        cur.execute("""
            UPDATE v3_signal_cache sc
            SET cluster_id = best.cluster_id
            FROM (
                SELECT DISTINCT ON (o.signal)
                    o.signal,
                    scm.cluster_id,
                    similarity(o.signal, scm.signal) AS sim
                FROM _orphans o
                CROSS JOIN LATERAL (
                    SELECT signal, cluster_id
                    FROM v3_signal_cluster_map
                    ORDER BY signal <-> o.signal
                    LIMIT 1
                ) scm
            ) best
            WHERE sc.signal = best.signal
        """)
        print(f"  Remapped {orphan_count} orphaned entries")

    cur.execute("DROP TABLE IF EXISTS _orphans")

    # Restore default timeout
    cur.execute("RESET statement_timeout")

    cur.execute("SELECT count(*) FROM v3_signal_cache")
    total_cache = cur.fetchone()[0]
    print(f"  Signal cache total: {total_cache} entries")

# ── Step 5: Verify staging tables ────────────────────────────────────────────

with timed("Step 5/6: Verify staging tables"):
    cur.execute("""
        SELECT 'signal_map' as tbl, count(*) as rows FROM v3_signal_cluster_map
        UNION ALL SELECT 'domain', count(*) FROM v3_cluster_domain
        UNION ALL SELECT 'neighbors', count(*) FROM v3_cluster_neighbors
        UNION ALL SELECT 'signal_cache', count(*) FROM v3_signal_cache
        ORDER BY tbl
    """)
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]} rows")

# ── Step 6: Backfill vectors ─────────────────────────────────────────────────

if args.skip_backfill:
    print(f"\n{'─' * 60}")
    print("  Skipping vector backfill (--skip-backfill)")
    print("  Run without --skip-backfill to recompute all vectors")
else:
    # Bump timeout for vector backfill (each batch can take a while)
    cur.execute("SET statement_timeout = '600s'")

    with timed("Step 6a/6: Backfill property embeddings"):
        cur.execute("""
            UPDATE "PlaceIntelligence" SET "embeddingV3" = NULL
            WHERE status = 'complete' AND "signalCount" > 0
        """)
        cur.execute("""
            SELECT count(*) FROM "PlaceIntelligence"
            WHERE status = 'complete' AND "signalCount" > 0 AND "embeddingV3" IS NULL
        """)
        total = cur.fetchone()[0]
        print(f"  {total} properties to recompute")

        done = 0
        while done < total:
            cur.execute(f"""
                SELECT count(*) FROM (
                  SELECT compute_property_embedding_v3(id)
                  FROM "PlaceIntelligence"
                  WHERE status = 'complete' AND "signalCount" > 0 AND "embeddingV3" IS NULL
                  LIMIT {args.batch_size}
                ) sub
            """)
            batch_done = cur.fetchone()[0]
            done += batch_done
            print(f"    {done}/{total} properties computed...")
            if batch_done == 0:
                break

    with timed("Step 6b/6: Backfill user taste vectors"):
        cur.execute("""
            UPDATE "User" SET "tasteVectorV3" = NULL
            WHERE "isOnboardingComplete" = true
        """)
        cur.execute("""
            SELECT count(*) FROM "User"
            WHERE "isOnboardingComplete" = true AND "tasteVectorV3" IS NULL
        """)
        user_count = cur.fetchone()[0]
        print(f"  {user_count} users to recompute")

        cur.execute("""
            SELECT compute_user_vector_v3(id)
            FROM "User"
            WHERE "isOnboardingComplete" = true AND "tasteVectorV3" IS NULL
        """)
        print(f"  Done — {user_count} user vectors recomputed")

    # Final verification
    print(f"\n{'=' * 60}")
    print("VERIFICATION")
    print(f"{'=' * 60}")

    cur.execute("""
        SELECT
          count(*) FILTER (WHERE "embeddingV3" IS NOT NULL) as has_v3,
          count(*) FILTER (WHERE "embeddingV3" IS NULL) as missing_v3
        FROM "PlaceIntelligence"
        WHERE status = 'complete' AND "signalCount" > 0
    """)
    row = cur.fetchone()
    print(f"  Properties: {row[0]} with vectors, {row[1]} missing")

    cur.execute("""
        SELECT
          count(*) FILTER (WHERE "tasteVectorV3" IS NOT NULL) as has_v3,
          count(*) FILTER (WHERE "tasteVectorV3" IS NULL) as missing_v3
        FROM "User"
        WHERE "isOnboardingComplete" = true
    """)
    row = cur.fetchone()
    print(f"  Users: {row[0]} with vectors, {row[1]} missing")

    cur.execute("""
        SELECT vector_dims("embeddingV3")
        FROM "PlaceIntelligence"
        WHERE "embeddingV3" IS NOT NULL LIMIT 1
    """)
    dims = cur.fetchone()
    if dims:
        print(f"  Vector dimensions: {dims[0]}")

# ─── Done ────────────────────────────────────────────────────────────────────

cur.close()
conn.close()
print(f"\nSync complete.")
