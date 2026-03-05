#!/usr/bin/env python3
"""
AI-powered signal clustering for Terrazzo v3 vectors (recluster edition).

Uses OpenAI text-embedding-3-small to embed all signals, then
domain-aware hierarchical K-means with silhouette sweep to find optimal K.

Targets K=200-350 for a ~600-property catalog (up from 96 clusters on 3.3K signals).

Usage:
  export OPENAI_API_KEY=sk-...
  python3 scripts/cluster-signals-v3.py
  python3 scripts/cluster-signals-v3.py --sweep     # run full silhouette sweep
  python3 scripts/cluster-signals-v3.py --k 280     # force specific K

Requires: pip install openai scikit-learn numpy
"""
import json
import os
import sys
import time
import argparse
import numpy as np
from pathlib import Path
from collections import defaultdict, Counter

# ─── Configuration ──────────────────────────────────────────────────────────

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536
BATCH_SIZE = 200

# Sweep range for silhouette analysis
K_MIN = 375
K_MAX = 550
K_STEP = 25

# ─── Parse args ──────────────────────────────────────────────────────────

parser = argparse.ArgumentParser()
parser.add_argument('--sweep', action='store_true', help='Run full silhouette sweep')
parser.add_argument('--k', type=int, default=0, help='Force specific K')
args = parser.parse_args()

# ─── Load data ──────────────────────────────────────────────────────────────

script_dir = Path(__file__).parent
project_dir = script_dir.parent

corpus_paths = [
    project_dir / "signal-corpus.json",
    Path("signal-corpus.json"),
]
dim_paths = [
    project_dir / "signal-dimensions.json",
    Path("signal-dimensions.json"),
]

corpus = None
for p in corpus_paths:
    if p.exists():
        with open(p) as f:
            corpus = json.load(f)
        print(f"Loaded corpus from {p}: {len(corpus)} signals")
        break

if corpus is None:
    print("ERROR: Could not find signal-corpus.json")
    print("Run: node scripts/extract-signal-corpus.mjs first")
    sys.exit(1)

dim_data = None
for p in dim_paths:
    if p.exists():
        with open(p) as f:
            dim_data = json.load(f)
        print(f"Loaded dimensions from {p}: {len(dim_data)} mappings")
        break

# ─── Build mappings ─────────────────────────────────────────────────────────

signal_domain = {}
if dim_data:
    signal_domain = {item['s']: item['d'] for item in dim_data}

doc_freqs = {item['s']: item['df'] for item in corpus}
all_signals = [item['s'] for item in corpus]

# Domain sizes from corpus
domain_sizes = Counter(signal_domain.get(s, 'Unknown') for s in all_signals)
# Remove unknowns from the allocation
if 'Unknown' in domain_sizes:
    del domain_sizes['Unknown']

print(f"\nTotal signals to embed: {len(all_signals)}")
print(f"\nDomain sizes:")
for d, c in domain_sizes.most_common():
    print(f"  {d}: {c}")

# ─── Embed with OpenAI ──────────────────────────────────────────────────────

api_key = os.environ.get("OPENAI_API_KEY")
if not api_key:
    print("ERROR: OPENAI_API_KEY not set")
    sys.exit(1)

try:
    from openai import OpenAI
except ImportError:
    print("ERROR: pip install openai")
    sys.exit(1)

client = OpenAI(api_key=api_key)

# Check cache
cache_path = project_dir / "signal-embeddings-cache.json"
if cache_path.exists():
    print(f"\nLoading cached embeddings from {cache_path}")
    with open(cache_path) as f:
        cached = json.load(f)
    embeddings_dict = cached.get("embeddings", {})
    missing = [s for s in all_signals if s not in embeddings_dict]
    if missing:
        print(f"  {len(missing)} signals not in cache, will embed them")
    else:
        print(f"  All {len(all_signals)} signals cached")
else:
    embeddings_dict = {}
    missing = all_signals

if missing:
    print(f"\nEmbedding {len(missing)} signals with {EMBEDDING_MODEL}...")
    avg_tokens = 5
    total_tokens = len(missing) * avg_tokens
    cost = total_tokens / 1_000_000 * 0.02
    print(f"  Estimated: ~{total_tokens:,} tokens = ~${cost:.4f}")

    for i in range(0, len(missing), BATCH_SIZE):
        batch = missing[i:i + BATCH_SIZE]
        texts = [s.replace('-', ' ').replace('_', ' ') for s in batch]

        response = client.embeddings.create(model=EMBEDDING_MODEL, input=texts)

        for j, item in enumerate(response.data):
            embeddings_dict[batch[j]] = item.embedding

        done = min(i + BATCH_SIZE, len(missing))
        print(f"  Embedded {done}/{len(missing)} signals")

        if i + BATCH_SIZE < len(missing):
            time.sleep(0.1)

    print(f"\nCaching embeddings to {cache_path}")
    with open(cache_path, 'w') as f:
        json.dump({
            "model": EMBEDDING_MODEL,
            "dim": EMBEDDING_DIM,
            "count": len(embeddings_dict),
            "embeddings": embeddings_dict,
        }, f)

# Build embedding matrix
embedding_matrix = np.array([embeddings_dict[s] for s in all_signals])
print(f"\nEmbedding matrix: {embedding_matrix.shape}")

# ─── Domain-aware hierarchical clustering ───────────────────────────────────

from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

def cluster_with_k(target_k, verbose=True):
    """Run domain-aware K-means with a target total K."""
    total_in_domains = sum(domain_sizes.values())

    # Allocate sub-clusters proportionally, min 3 per domain
    domain_k = {}
    for domain, count in domain_sizes.items():
        k = max(3, round(count / total_in_domains * target_k))
        domain_k[domain] = k

    # Adjust to hit target
    while sum(domain_k.values()) > target_k:
        largest = max(domain_k, key=domain_k.get)
        domain_k[largest] -= 1
    while sum(domain_k.values()) < target_k:
        largest = max(domain_sizes, key=lambda d: domain_sizes[d] / max(domain_k.get(d, 1), 1))
        domain_k[largest] += 1

    if verbose:
        print(f"\n{'='*60}")
        print(f"Clustering with K={target_k}")
        print(f"{'='*60}")
        for d, k in sorted(domain_k.items()):
            print(f"  {d}: {domain_sizes.get(d, 0)} signals → {k} sub-clusters")

    # Group signals by domain
    dom_signals = defaultdict(list)
    dom_indices = defaultdict(list)
    no_domain = []
    no_domain_indices = []

    for i, signal in enumerate(all_signals):
        domain = signal_domain.get(signal)
        if domain and domain in domain_k:
            dom_signals[domain].append(signal)
            dom_indices[domain].append(i)
        else:
            no_domain.append(signal)
            no_domain_indices.append(i)

    # Cluster within each domain
    global_cluster_id = 0
    clusters = {}
    signal_to_cluster = {}
    all_silhouettes = []
    domain_silhouettes = {}
    cluster_centroids_map = {}  # global_cluster_id → centroid vector
    cluster_domain_map = {}     # global_cluster_id → domain name

    for domain in sorted(domain_k.keys()):
        signals = dom_signals[domain]
        indices = dom_indices[domain]
        k = domain_k[domain]

        if len(signals) < k:
            k = max(2, len(signals) // 3)

        X = embedding_matrix[indices]

        km = KMeans(n_clusters=k, n_init=10, random_state=42, max_iter=300)
        labels = km.fit_predict(X)

        if len(set(labels)) > 1:
            sil = silhouette_score(X, labels, sample_size=min(1000, len(signals)))
            all_silhouettes.append(sil)
            domain_silhouettes[domain] = sil
        else:
            sil = 0.0
            domain_silhouettes[domain] = sil

        if verbose:
            print(f"\n{domain}: {len(signals)} signals → {k} clusters (silhouette={sil:.4f})")

        for sub_id in range(k):
            members = [signals[i] for i in range(len(signals)) if labels[i] == sub_id]
            members_sorted = sorted(members, key=lambda s: -doc_freqs.get(s, 0))

            # Generate label from top signals
            top_words = set()
            for sig in members_sorted[:3]:
                for w in sig.replace('-', ' ').split():
                    if len(w) > 3:
                        top_words.add(w)
            label = f"{domain}:{'-'.join(sorted(top_words)[:3])}" if top_words else f"{domain}:sub-{sub_id}"

            clusters[global_cluster_id] = {
                "label": label,
                "domain": domain,
                "size": len(members),
                "topSignals": members_sorted[:15],
            }

            # Capture centroid for neighbor computation
            cluster_centroids_map[global_cluster_id] = km.cluster_centers_[sub_id]
            cluster_domain_map[global_cluster_id] = domain

            for sig in members:
                signal_to_cluster[sig] = global_cluster_id

            if verbose and len(members) > 0:
                top_display = members_sorted[:3]
                print(f"  [{global_cluster_id:3d}] {label} ({len(members)}): {', '.join(top_display)}")

            global_cluster_id += 1

    # Assign orphans
    if no_domain:
        cluster_centroids = {}
        for cid, cdata in clusters.items():
            member_indices = [all_signals.index(s) for s in cdata['topSignals'][:10] if s in all_signals]
            if member_indices:
                cluster_centroids[cid] = embedding_matrix[member_indices].mean(axis=0)

        orphan_embeddings = embedding_matrix[no_domain_indices]
        for i, sig in enumerate(no_domain):
            best_cluster = 0
            best_sim = -1
            emb = orphan_embeddings[i]
            for cid, centroid in cluster_centroids.items():
                sim = np.dot(emb, centroid) / (np.linalg.norm(emb) * np.linalg.norm(centroid) + 1e-10)
                if sim > best_sim:
                    best_sim = sim
                    best_cluster = cid
            signal_to_cluster[sig] = best_cluster
            clusters[best_cluster]['size'] += 1

    avg_sil = float(np.mean(all_silhouettes)) if all_silhouettes else 0
    sizes = [c['size'] for c in clusters.values()]

    # ── Compute cluster neighbors (two-tier: intra-domain + cross-domain) ─
    # Tier 1 (intra): top-3 within same domain, similarity > 0.3
    #   Bleed weight = similarity * INTRA_BLEED_SCALE (0.30)
    # Tier 2 (cross): top-2 across different domains, similarity > 0.5
    #   Bleed weight = similarity * CROSS_BLEED_SCALE (0.10)
    cluster_neighbors = {}
    INTRA_NEIGHBOR_COUNT = 3
    CROSS_NEIGHBOR_COUNT = 2
    INTRA_SIM_THRESHOLD = 0.3
    CROSS_SIM_THRESHOLD = 0.5

    # Group clusters by domain
    domain_clusters = defaultdict(list)
    for cid, dom in cluster_domain_map.items():
        domain_clusters[dom].append(cid)

    # ── Tier 1: intra-domain neighbors ──
    for domain, cids in domain_clusters.items():
        if len(cids) < 2:
            continue
        centroids = np.array([cluster_centroids_map[cid] for cid in cids])
        norms = np.linalg.norm(centroids, axis=1, keepdims=True)
        norms = np.maximum(norms, 1e-10)
        normed = centroids / norms
        sim_matrix = normed @ normed.T

        for idx, cid in enumerate(cids):
            sims = sim_matrix[idx].copy()
            sims[idx] = -1
            top_indices = np.argsort(sims)[-INTRA_NEIGHBOR_COUNT:][::-1]
            neighbors = []
            for ni in top_indices:
                if sims[ni] > INTRA_SIM_THRESHOLD:
                    neighbors.append({
                        "cluster": int(cids[ni]),
                        "similarity": round(float(sims[ni]), 4),
                        "tier": "intra"
                    })
            if neighbors:
                cluster_neighbors[cid] = neighbors

    # ── Tier 2: cross-domain neighbors ──
    # Build full centroid matrix across all clusters
    all_cids = sorted(cluster_centroids_map.keys())
    all_centroids = np.array([cluster_centroids_map[cid] for cid in all_cids])
    all_norms = np.linalg.norm(all_centroids, axis=1, keepdims=True)
    all_norms = np.maximum(all_norms, 1e-10)
    all_normed = all_centroids / all_norms
    full_sim_matrix = all_normed @ all_normed.T

    cross_count = 0
    for idx, cid in enumerate(all_cids):
        my_domain = cluster_domain_map[cid]
        sims = full_sim_matrix[idx].copy()
        sims[idx] = -1  # exclude self

        # Mask out same-domain clusters (already handled by tier 1)
        for jdx, other_cid in enumerate(all_cids):
            if cluster_domain_map[other_cid] == my_domain:
                sims[jdx] = -1

        top_indices = np.argsort(sims)[-CROSS_NEIGHBOR_COUNT:][::-1]
        cross_neighbors = []
        for ni in top_indices:
            if sims[ni] > CROSS_SIM_THRESHOLD:
                cross_neighbors.append({
                    "cluster": int(all_cids[ni]),
                    "similarity": round(float(sims[ni]), 4),
                    "tier": "cross"
                })

        if cross_neighbors:
            if cid not in cluster_neighbors:
                cluster_neighbors[cid] = []
            cluster_neighbors[cid].extend(cross_neighbors)
            cross_count += len(cross_neighbors)

    if verbose:
        micro = sum(1 for s in sizes if s <= 5)
        with_neighbors = sum(1 for cid in range(global_cluster_id) if cid in cluster_neighbors)
        intra_total = sum(1 for cid in cluster_neighbors for n in cluster_neighbors[cid] if n['tier'] == 'intra')
        cross_total = sum(1 for cid in cluster_neighbors for n in cluster_neighbors[cid] if n['tier'] == 'cross')
        print(f"\n  Avg silhouette: {avg_sil:.4f}")
        print(f"  Cluster sizes: min={min(sizes)}, max={max(sizes)}, avg={np.mean(sizes):.1f}, median={np.median(sizes):.1f}")
        print(f"  Micro-clusters (≤5 members): {micro}")
        print(f"  Clusters with neighbors: {with_neighbors}/{global_cluster_id}")
        print(f"  Intra-domain neighbor links: {intra_total}")
        print(f"  Cross-domain neighbor links: {cross_total}")
        avg_neighbors = np.mean([len(v) for v in cluster_neighbors.values()]) if cluster_neighbors else 0
        print(f"  Avg neighbors per cluster: {avg_neighbors:.1f}")

    return {
        'k': global_cluster_id,
        'avg_silhouette': avg_sil,
        'domain_silhouettes': domain_silhouettes,
        'clusters': clusters,
        'signal_to_cluster': signal_to_cluster,
        'sizes': sizes,
        'cluster_neighbors': cluster_neighbors,
    }


# ─── Silhouette sweep or direct clustering ──────────────────────────────────

if args.sweep:
    print(f"\n{'#'*60}")
    print(f"SILHOUETTE SWEEP: K={K_MIN} to K={K_MAX} step {K_STEP}")
    print(f"{'#'*60}")

    results = []
    for k in range(K_MIN, K_MAX + 1, K_STEP):
        r = cluster_with_k(k, verbose=False)
        results.append({
            'target_k': k,
            'actual_k': r['k'],
            'avg_silhouette': r['avg_silhouette'],
            'domain_silhouettes': r['domain_silhouettes'],
            'min_size': min(r['sizes']),
            'max_size': max(r['sizes']),
            'avg_size': float(np.mean(r['sizes'])),
        })
        print(f"  K={k:3d} → actual={r['k']:3d}, silhouette={r['avg_silhouette']:.4f}, "
              f"sizes: {min(r['sizes'])}-{max(r['sizes'])} (avg {np.mean(r['sizes']):.1f})")

    # Find best K
    best = max(results, key=lambda x: x['avg_silhouette'])
    print(f"\n{'='*60}")
    print(f"BEST K={best['target_k']} (actual={best['actual_k']})")
    print(f"  Silhouette: {best['avg_silhouette']:.4f}")
    print(f"  Cluster sizes: {best['min_size']}-{best['max_size']} (avg {best['avg_size']:.1f})")
    print(f"{'='*60}")

    # Save sweep results
    sweep_path = project_dir / "silhouette-sweep.json"
    with open(sweep_path, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\nSweep results saved to {sweep_path}")
    print(f"\nTo generate clusters at the best K, run:")
    print(f"  python3 scripts/cluster-signals-v3.py --k {best['target_k']}")

elif args.k > 0:
    target_k = args.k
    print(f"\nClustering with forced K={target_k}")
    r = cluster_with_k(target_k, verbose=True)

    # Build output
    from datetime import date
    neighbor_map = {str(k): v for k, v in r.get('cluster_neighbors', {}).items()}
    output = {
        "version": "v3.3",
        "method": "domain-hierarchical-openai-kmeans",
        "embedding_model": EMBEDDING_MODEL,
        "k": r['k'],
        "avg_silhouette": r['avg_silhouette'],
        "total_signals": len(r['signal_to_cluster']),
        "intra_bleed_scale": 0.30,
        "cross_bleed_scale": 0.10,
        "created": str(date.today()),
        "domain_silhouettes": r['domain_silhouettes'],
        "clusters": {str(k): v for k, v in r['clusters'].items()},
        "signalToCluster": r['signal_to_cluster'],
        "clusterNeighbors": neighbor_map,
    }

    output_path = project_dir / "src" / "lib" / "taste-intelligence" / "signal-clusters.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)

    root_copy = project_dir / "signal-clusters.json"
    with open(root_copy, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\n{'='*60}")
    print(f"Saved to {output_path}")
    print(f"Also saved to {root_copy}")
    print(f"Total clusters: {r['k']}")
    print(f"Total signals mapped: {len(r['signal_to_cluster'])}")
    print(f"Avg silhouette: {r['avg_silhouette']:.4f}")
    sizes = r['sizes']
    print(f"Cluster sizes: min={min(sizes)}, max={max(sizes)}, avg={np.mean(sizes):.1f}")
    neighbors = r.get('cluster_neighbors', {})
    intra = sum(1 for ns in neighbors.values() for n in ns if n.get('tier') == 'intra')
    cross = sum(1 for ns in neighbors.values() for n in ns if n.get('tier') == 'cross')
    print(f"Clusters with neighbors: {len(neighbors)}/{r['k']} ({intra} intra + {cross} cross links)")
    print(f"{'='*60}")
    print(f"\nVector dimension will be: {8 + r['k']} (8 domains + {r['k']} clusters)")

else:
    # Default: sweep first, then cluster at best K
    print(f"\nRunning silhouette sweep to find optimal K...")
    results = []
    for k in range(K_MIN, K_MAX + 1, K_STEP):
        r = cluster_with_k(k, verbose=False)
        results.append({
            'target_k': k,
            'actual_k': r['k'],
            'avg_silhouette': r['avg_silhouette'],
        })
        print(f"  K={k:3d} → silhouette={r['avg_silhouette']:.4f}")

    best_k = max(results, key=lambda x: x['avg_silhouette'])['target_k']
    print(f"\nBest K={best_k}, now generating final clusters...")

    r = cluster_with_k(best_k, verbose=True)

    from datetime import date
    neighbor_map = {str(k): v for k, v in r.get('cluster_neighbors', {}).items()}
    output = {
        "version": "v3.3",
        "method": "domain-hierarchical-openai-kmeans",
        "embedding_model": EMBEDDING_MODEL,
        "k": r['k'],
        "avg_silhouette": r['avg_silhouette'],
        "total_signals": len(r['signal_to_cluster']),
        "intra_bleed_scale": 0.30,
        "cross_bleed_scale": 0.10,
        "created": str(date.today()),
        "clusters": {str(k): v for k, v in r['clusters'].items()},
        "signalToCluster": r['signal_to_cluster'],
        "clusterNeighbors": neighbor_map,
    }

    output_path = project_dir / "src" / "lib" / "taste-intelligence" / "signal-clusters.json"
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)

    root_copy = project_dir / "signal-clusters.json"
    with open(root_copy, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\nSaved with K={r['k']}, silhouette={r['avg_silhouette']:.4f}")
    print(f"Vector dimension: {8 + r['k']}")
    print(f"Clusters with neighbors: {len(neighbor_map)}/{r['k']}")
