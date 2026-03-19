#!/usr/bin/env python3
"""
Targeted cluster surgery for Terrazzo signal clusters.

Performs two operations on specific clusters without requiring a full
re-clustering run:

  1. DISSOLVE — Remove an incoherent cluster entirely and reassign each
     of its signals to the nearest remaining cluster centroid (by cosine
     similarity of embeddings). Use for junk-drawer clusters where signals
     don't belong together at all.

  2. SPLIT — Move a subset of signals out of a cluster and into a
     better-fitting existing cluster. Use when a cluster has two coherent
     sub-concepts that got merged (e.g., beds + open-air architecture).

Both operations update signalToCluster mappings, topSignals lists, and
cluster sizes in signal-clusters.json. The cluster IDs themselves don't
change (dissolved clusters become empty shells with size=0, preserving
the 400-dim vector layout).

Usage:
  # Dissolve incoherent clusters
  python3 scripts/surgery-clusters.py dissolve 88 98

  # Split: move specific signals from one cluster to another
  python3 scripts/surgery-clusters.py split 128 --signals "mosquito-net-canopy-beds,premium-bedding-program,platform-bed-design,twin-beds-pushed-together,exceptionally-comfortable-beds,mosquito-net-beds" --target 377

  # Auto-split: let embeddings decide which signals are outliers
  python3 scripts/surgery-clusters.py auto-split 37 128

  # Dry run (default) — add --apply to write changes
  python3 scripts/surgery-clusters.py dissolve 88 98 --apply

Requires: numpy (for cosine similarity), signal-embeddings-cache.json
"""

import json
import sys
import argparse
import numpy as np
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# ─── Parse args ─────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Targeted cluster surgery")
subparsers = parser.add_subparsers(dest='command', help='Operation to perform')

# dissolve subcommand
dissolve_parser = subparsers.add_parser('dissolve',
    help='Dissolve clusters and reassign signals to nearest centroids')
dissolve_parser.add_argument('cluster_ids', nargs='+', type=str,
    help='Cluster IDs to dissolve')
dissolve_parser.add_argument('--apply', action='store_true',
    help='Write changes to signal-clusters.json')

# split subcommand
split_parser = subparsers.add_parser('split',
    help='Move specific signals from one cluster to another')
split_parser.add_argument('source', type=str, help='Source cluster ID')
split_parser.add_argument('--signals', type=str, required=True,
    help='Comma-separated signal names to move')
split_parser.add_argument('--target', type=str, required=True,
    help='Target cluster ID')
split_parser.add_argument('--apply', action='store_true',
    help='Write changes to signal-clusters.json')

# auto-split subcommand
auto_parser = subparsers.add_parser('auto-split',
    help='Automatically identify and reassign outlier signals in clusters')
auto_parser.add_argument('cluster_ids', nargs='+', type=str,
    help='Cluster IDs to auto-split')
auto_parser.add_argument('--threshold', type=float, default=0.65,
    help='Signals below this cosine similarity to centroid are outliers (default: 0.65)')
auto_parser.add_argument('--apply', action='store_true',
    help='Write changes to signal-clusters.json')

args = parser.parse_args()

if not args.command:
    parser.print_help()
    sys.exit(1)

# ─── Load data ──────────────────────────────────────────────────────────────

project_dir = Path(__file__).parent.parent

# Load cluster data
clusters_path = project_dir / "signal-clusters.json"
if not clusters_path.exists():
    clusters_path = project_dir / "src" / "lib" / "taste-intelligence" / "signal-clusters.json"
if not clusters_path.exists():
    print("ERROR: Could not find signal-clusters.json")
    sys.exit(1)

with open(clusters_path) as f:
    data = json.load(f)
print(f"Loaded clusters from {clusters_path}")

clusters = data.get("clusters", {})
signal_to_cluster = data.get("signalToCluster", {})
centroids = data.get("clusterCentroids", {})

# Load embedding cache (needed for dissolve and auto-split)
embeddings_path = project_dir / "signal-embeddings-cache.json"
embeddings_dict = {}
if embeddings_path.exists():
    with open(embeddings_path) as f:
        cached = json.load(f)
    embeddings_dict = cached.get("embeddings", {})
    print(f"Loaded {len(embeddings_dict)} cached embeddings")
elif args.command in ('dissolve', 'auto-split'):
    print("ERROR: signal-embeddings-cache.json required for this operation")
    print("Run cluster-signals-v3.py first to generate the cache")
    sys.exit(1)


def cosine_sim(a, b):
    """Cosine similarity between two vectors."""
    a, b = np.array(a), np.array(b)
    norm_a, norm_b = np.linalg.norm(a), np.linalg.norm(b)
    if norm_a < 1e-10 or norm_b < 1e-10:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def find_nearest_cluster(signal_embedding, exclude_ids, same_domain=None):
    """Find the nearest cluster centroid for a signal, excluding certain clusters."""
    best_cid = None
    best_sim = -1

    for cid, centroid in centroids.items():
        if cid in exclude_ids:
            continue
        # Optionally restrict to same domain
        if same_domain and clusters.get(cid, {}).get('domain') != same_domain:
            continue
        # Skip empty clusters
        if clusters.get(cid, {}).get('size', 0) == 0:
            continue

        sim = cosine_sim(signal_embedding, centroid)
        if sim > best_sim:
            best_sim = sim
            best_cid = cid

    return best_cid, best_sim


def move_signal(signal, source_cid, target_cid):
    """Move a signal from one cluster to another, updating all data structures."""
    # Update signalToCluster
    signal_to_cluster[signal] = int(target_cid)

    # Update topSignals
    src_top = clusters[str(source_cid)].get('topSignals', [])
    if signal in src_top:
        src_top.remove(signal)

    tgt_top = clusters[str(target_cid)].get('topSignals', [])
    if signal not in tgt_top:
        tgt_top.append(signal)

    # Update sizes
    clusters[str(source_cid)]['size'] = max(0, clusters[str(source_cid)].get('size', 0) - 1)
    clusters[str(target_cid)]['size'] = clusters[str(target_cid)].get('size', 0) + 1


def get_cluster_label(cid):
    """Get the best available label for a cluster."""
    c = clusters.get(str(cid), {})
    return c.get('displayLabel', c.get('label', f'cluster-{cid}'))


# ─── DISSOLVE ───────────────────────────────────────────────────────────────

if args.command == 'dissolve':
    if not centroids:
        print("ERROR: No clusterCentroids in signal-clusters.json")
        print("Re-run cluster-signals-v3.py with --k to generate centroids")
        sys.exit(1)

    exclude_ids = set(args.cluster_ids)
    total_moved = 0

    for cid in args.cluster_ids:
        if cid not in clusters:
            print(f"WARNING: Cluster {cid} not found, skipping")
            continue

        c = clusters[cid]
        label = get_cluster_label(cid)
        domain = c.get('domain', 'Unknown')
        size = c.get('size', 0)

        print(f"\n{'─' * 60}")
        print(f"DISSOLVING Cluster {cid}: {label} ({domain}, n={size})")
        print(f"{'─' * 60}")

        # Find all signals currently assigned to this cluster
        assigned_signals = [
            sig for sig, assigned_cid in signal_to_cluster.items()
            if str(assigned_cid) == str(cid)
        ]

        if not assigned_signals:
            print(f"  No signals assigned, nothing to do")
            continue

        print(f"  Reassigning {len(assigned_signals)} signals...\n")

        reassignments = defaultdict(list)

        for sig in assigned_signals:
            emb = embeddings_dict.get(sig)
            if emb is None:
                # Try with hyphen-to-space normalization
                emb = embeddings_dict.get(sig.replace('-', ' '))
            if emb is None:
                print(f"    SKIP {sig} — no embedding found")
                continue

            # Find nearest cluster, preferring same domain
            target_cid, sim = find_nearest_cluster(emb, exclude_ids, same_domain=domain)

            # If no same-domain match, try cross-domain
            if target_cid is None:
                target_cid, sim = find_nearest_cluster(emb, exclude_ids)

            if target_cid is None:
                print(f"    SKIP {sig} — no suitable target found")
                continue

            target_label = get_cluster_label(target_cid)
            reassignments[target_cid].append((sig, sim))

        # Print reassignment plan grouped by target
        for target_cid in sorted(reassignments.keys(), key=lambda x: -len(reassignments[x])):
            target_label = get_cluster_label(target_cid)
            signals = reassignments[target_cid]
            target_domain = clusters.get(str(target_cid), {}).get('domain', '?')
            print(f"  → Cluster {target_cid} ({target_label}, {target_domain}):")
            for sig, sim in signals:
                print(f"      {sig}  (sim={sim:.3f})")

        # Apply if requested
        if args.apply:
            for target_cid, signals in reassignments.items():
                for sig, sim in signals:
                    move_signal(sig, cid, target_cid)
                    total_moved += 1

            # Mark dissolved cluster
            clusters[cid]['size'] = 0
            clusters[cid]['topSignals'] = []
            clusters[cid]['dissolved'] = True
            clusters[cid]['dissolved_date'] = datetime.now().isoformat()
        else:
            total_moved += sum(len(sigs) for sigs in reassignments.values())

    print(f"\n{'=' * 60}")
    print(f"Total signals to reassign: {total_moved}")

    if not args.apply:
        print(f"\nDry run — add --apply to write changes")


# ─── SPLIT ──────────────────────────────────────────────────────────────────

elif args.command == 'split':
    source_cid = args.source
    target_cid = args.target
    signals_to_move = [s.strip() for s in args.signals.split(',') if s.strip()]

    if source_cid not in clusters:
        print(f"ERROR: Source cluster {source_cid} not found")
        sys.exit(1)
    if target_cid not in clusters:
        print(f"ERROR: Target cluster {target_cid} not found")
        sys.exit(1)

    source_label = get_cluster_label(source_cid)
    target_label = get_cluster_label(target_cid)

    print(f"\nSPLIT: {source_cid} ({source_label}) → {target_cid} ({target_label})")
    print(f"Moving {len(signals_to_move)} signals:\n")

    moved = 0
    for sig in signals_to_move:
        current = signal_to_cluster.get(sig)
        if current is None:
            print(f"  SKIP {sig} — not in signalToCluster")
            continue
        if str(current) != str(source_cid):
            print(f"  SKIP {sig} — assigned to cluster {current}, not {source_cid}")
            continue

        print(f"  → {sig}")
        if args.apply:
            move_signal(sig, source_cid, target_cid)
        moved += 1

    print(f"\n  Signals moved: {moved}")
    if not args.apply:
        print(f"\n  Dry run — add --apply to write changes")


# ─── AUTO-SPLIT ─────────────────────────────────────────────────────────────

elif args.command == 'auto-split':
    if not centroids:
        print("ERROR: No clusterCentroids in signal-clusters.json")
        sys.exit(1)

    exclude_ids = set()  # don't exclude any clusters for auto-split targets
    total_moved = 0

    for cid in args.cluster_ids:
        if cid not in clusters:
            print(f"WARNING: Cluster {cid} not found, skipping")
            continue

        c = clusters[cid]
        label = get_cluster_label(cid)
        domain = c.get('domain', 'Unknown')
        size = c.get('size', 0)
        centroid = centroids.get(cid)

        if centroid is None:
            print(f"WARNING: No centroid for cluster {cid}, skipping")
            continue

        print(f"\n{'─' * 60}")
        print(f"AUTO-SPLIT Cluster {cid}: {label} ({domain}, n={size})")
        print(f"  Outlier threshold: cosine sim < {args.threshold}")
        print(f"{'─' * 60}")

        # Find all signals in this cluster and compute their similarity to centroid
        assigned_signals = [
            sig for sig, assigned_cid in signal_to_cluster.items()
            if str(assigned_cid) == str(cid)
        ]

        signal_sims = []
        for sig in assigned_signals:
            emb = embeddings_dict.get(sig)
            if emb is None:
                continue
            sim = cosine_sim(emb, centroid)
            signal_sims.append((sig, sim))

        signal_sims.sort(key=lambda x: x[1])

        # Identify outliers (below threshold)
        outliers = [(sig, sim) for sig, sim in signal_sims if sim < args.threshold]
        keepers = [(sig, sim) for sig, sim in signal_sims if sim >= args.threshold]

        print(f"\n  Keepers ({len(keepers)}):")
        for sig, sim in keepers[:5]:
            print(f"    ✓ {sig}  (sim={sim:.3f})")
        if len(keepers) > 5:
            print(f"    ... and {len(keepers) - 5} more")

        print(f"\n  Outliers ({len(outliers)}):")
        if not outliers:
            print(f"    None — cluster is coherent at this threshold")
            continue

        reassignments = {}
        for sig, sim in outliers:
            emb = embeddings_dict.get(sig)
            if emb is None:
                continue

            # Find best target excluding this cluster
            target, target_sim = find_nearest_cluster(emb, {cid}, same_domain=domain)
            if target is None:
                target, target_sim = find_nearest_cluster(emb, {cid})

            if target:
                target_label = get_cluster_label(target)
                print(f"    ✗ {sig}  (sim={sim:.3f}) → cluster {target} ({target_label}, sim={target_sim:.3f})")
                reassignments[sig] = (target, target_sim)
            else:
                print(f"    ✗ {sig}  (sim={sim:.3f}) → no suitable target")

        if args.apply and reassignments:
            for sig, (target, _) in reassignments.items():
                move_signal(sig, cid, target)
                total_moved += 1

        total_moved += len(reassignments) if not args.apply else 0

    print(f"\n{'=' * 60}")
    print(f"Total outlier signals to reassign: {total_moved}")

    if not args.apply:
        print(f"\nDry run — add --apply to write changes")


# ─── Write changes ──────────────────────────────────────────────────────────

if args.apply:
    data['signalToCluster'] = signal_to_cluster
    data['clusters'] = clusters

    data.setdefault('audits', []).append({
        'type': f'surgery_{args.command}',
        'date': datetime.now().isoformat(),
        'clusters_affected': args.cluster_ids if hasattr(args, 'cluster_ids') else [args.source],
    })

    output_paths = [
        project_dir / "signal-clusters.json",
        project_dir / "src" / "lib" / "taste-intelligence" / "signal-clusters.json",
    ]

    for out_path in output_paths:
        if out_path.exists():
            with open(out_path, 'w') as f:
                json.dump(data, f, indent=2)
            print(f"  Updated {out_path}")

    print(f"\n  IMPORTANT: After surgery, recompute vectors:")
    print(f"    1. Rebuild signal cache (see recluster-handoff.md Step 7)")
    print(f"    2. Run vector backfill: POST /api/cron/vector-refresh")
