#!/usr/bin/env python3
"""
AI-powered signal clustering for Terrazzo v3 vectors.

Uses OpenAI text-embedding-3-small to embed all signals, then
domain-aware hierarchical K-means to produce 96 semantic clusters.

Usage:
  export OPENAI_API_KEY=sk-...
  python3 scripts/cluster-signals-ai.py

Requires: pip install openai scikit-learn numpy
"""
import json
import os
import sys
import time
import numpy as np
from pathlib import Path

# ─── Configuration ──────────────────────────────────────────────────────────

TARGET_TOTAL_CLUSTERS = 96
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536
BATCH_SIZE = 200  # OpenAI supports up to 2048 inputs per request

# Domain sizes (from signal-dimensions.json extraction)
DOMAIN_SIZES = {
    'Service': 702,
    'FoodDrink': 534,
    'Character': 527,
    'Design': 416,
    'Setting': 400,
    'Atmosphere': 317,
    'Wellness': 93,
    'Sustainability': 70,
}

# ─── Load data ──────────────────────────────────────────────────────────────

script_dir = Path(__file__).parent
project_dir = script_dir.parent

# Try multiple paths for the corpus files
corpus_paths = [
    project_dir / "signal-corpus.json",
    Path("signal-corpus.json"),
    Path("/sessions/pensive-vibrant-wright/signal-corpus.json"),
]
dim_paths = [
    project_dir / "signal-dimensions.json",
    Path("signal-dimensions.json"),
    Path("/sessions/pensive-vibrant-wright/signal-dimensions.json"),
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
    print("Expected locations:", [str(p) for p in corpus_paths])
    sys.exit(1)

dim_data = None
for p in dim_paths:
    if p.exists():
        with open(p) as f:
            dim_data = json.load(f)
        print(f"Loaded dimensions from {p}: {len(dim_data)} mappings")
        break

if dim_data is None:
    print("WARNING: Could not find signal-dimensions.json, falling back to flat clustering")

# ─── Build mappings ─────────────────────────────────────────────────────────

signal_domain = {}
if dim_data:
    signal_domain = {item['s']: item['d'] for item in dim_data}

doc_freqs = {item['s']: item['df'] for item in corpus}
all_signals = [item['s'] for item in corpus]

print(f"\nTotal signals to embed: {len(all_signals)}")

# ─── Embed with OpenAI ──────────────────────────────────────────────────────

api_key = os.environ.get("OPENAI_API_KEY")
if not api_key:
    print("ERROR: OPENAI_API_KEY not set")
    print("  export OPENAI_API_KEY=sk-...")
    sys.exit(1)

try:
    from openai import OpenAI
except ImportError:
    print("ERROR: openai package not installed")
    print("  pip install openai")
    sys.exit(1)

client = OpenAI(api_key=api_key)

# Check if we have cached embeddings
cache_path = project_dir / "signal-embeddings-cache.json"
if cache_path.exists():
    print(f"\nLoading cached embeddings from {cache_path}")
    with open(cache_path) as f:
        cached = json.load(f)
    embeddings_dict = cached.get("embeddings", {})
    # Check if all signals are cached
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
    # Estimate cost
    avg_tokens = 4  # ~4 tokens per hyphenated signal
    total_tokens = len(missing) * avg_tokens
    cost = total_tokens / 1_000_000 * 0.02
    print(f"  Estimated: ~{total_tokens:,} tokens = ~${cost:.4f}")

    for i in range(0, len(missing), BATCH_SIZE):
        batch = missing[i:i + BATCH_SIZE]
        # Replace hyphens with spaces for better embedding quality
        texts = [s.replace('-', ' ').replace('_', ' ') for s in batch]

        response = client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=texts,
        )

        for j, item in enumerate(response.data):
            embeddings_dict[batch[j]] = item.embedding

        done = min(i + BATCH_SIZE, len(missing))
        print(f"  Embedded {done}/{len(missing)} signals")

        if i + BATCH_SIZE < len(missing):
            time.sleep(0.1)  # Rate limit courtesy

    # Cache embeddings
    print(f"\nCaching embeddings to {cache_path}")
    with open(cache_path, 'w') as f:
        json.dump({
            "model": EMBEDDING_MODEL,
            "dim": EMBEDDING_DIM,
            "count": len(embeddings_dict),
            "embeddings": embeddings_dict,
        }, f)

# Build embedding matrix in signal order
embedding_matrix = np.array([embeddings_dict[s] for s in all_signals])
print(f"\nEmbedding matrix: {embedding_matrix.shape}")

# ─── Domain-aware hierarchical clustering ───────────────────────────────────

from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from collections import defaultdict

# Allocate sub-clusters proportionally
total_signals = sum(DOMAIN_SIZES.values())
DOMAIN_K = {}
for domain, count in DOMAIN_SIZES.items():
    k = max(3, round(count / total_signals * TARGET_TOTAL_CLUSTERS))
    DOMAIN_K[domain] = k

# Adjust to hit target
while sum(DOMAIN_K.values()) > TARGET_TOTAL_CLUSTERS:
    largest = max(DOMAIN_K, key=DOMAIN_K.get)
    DOMAIN_K[largest] -= 1
while sum(DOMAIN_K.values()) < TARGET_TOTAL_CLUSTERS:
    largest = max(DOMAIN_SIZES, key=lambda d: DOMAIN_SIZES[d] / DOMAIN_K[d])
    DOMAIN_K[largest] += 1

print("\nDomain sub-cluster allocation:")
for d, k in sorted(DOMAIN_K.items()):
    print(f"  {d}: {DOMAIN_SIZES.get(d, 0)} signals → {k} sub-clusters")
print(f"  Total: {sum(DOMAIN_K.values())} clusters")

# Group signals by domain
domain_signals = defaultdict(list)
domain_indices = defaultdict(list)  # track which rows in embedding_matrix
no_domain = []
no_domain_indices = []

for i, signal in enumerate(all_signals):
    domain = signal_domain.get(signal)
    if domain and domain in DOMAIN_K:
        domain_signals[domain].append(signal)
        domain_indices[domain].append(i)
    else:
        no_domain.append(signal)
        no_domain_indices.append(i)

print(f"\nSignals without domain: {len(no_domain)}")

# Cluster within each domain using AI embeddings
global_cluster_id = 0
clusters = {}
signal_to_cluster = {}
all_silhouettes = []

for domain in sorted(DOMAIN_K.keys()):
    signals = domain_signals[domain]
    indices = domain_indices[domain]
    k = DOMAIN_K[domain]

    if len(signals) < k:
        k = max(2, len(signals) // 3)

    # Use the actual AI embeddings for this domain's signals
    X = embedding_matrix[indices]

    km = KMeans(n_clusters=k, n_init=10, random_state=42)
    labels = km.fit_predict(X)

    if len(set(labels)) > 1:
        sil = silhouette_score(X, labels, sample_size=min(500, len(signals)))
        all_silhouettes.append(sil)
    else:
        sil = 0.0

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

        for sig in members:
            signal_to_cluster[sig] = global_cluster_id

        if len(members) <= 30:
            top_display = members_sorted[:5]
        else:
            top_display = members_sorted[:3]
        print(f"  Cluster {global_cluster_id:3d} [{label}] ({len(members)} signals): {', '.join(top_display)}")

        global_cluster_id += 1

# Assign orphan signals to nearest cluster using embedding similarity
print(f"\nAssigning {len(no_domain)} orphan signals via embedding similarity...")

if no_domain:
    # Compute cluster centroids from AI embeddings
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

# ─── Build output ───────────────────────────────────────────────────────────

output = {
    "version": "v3.0",
    "method": "domain-hierarchical-openai-kmeans",
    "embedding_model": EMBEDDING_MODEL,
    "k": global_cluster_id,
    "avg_silhouette": float(np.mean(all_silhouettes)) if all_silhouettes else 0,
    "total_signals": len(signal_to_cluster),
    "created": "2026-03-04",
    "clusters": {str(k): v for k, v in clusters.items()},
    "signalToCluster": signal_to_cluster,
}

# Save to project src directory
output_path = project_dir / "src" / "lib" / "taste-intelligence" / "signal-clusters.json"
output_path.parent.mkdir(parents=True, exist_ok=True)

with open(output_path, 'w') as f:
    json.dump(output, f, indent=2)

# Also save a copy in the project root
root_copy = project_dir / "signal-clusters.json"
with open(root_copy, 'w') as f:
    json.dump(output, f, indent=2)

print(f"\nSaved to {output_path}")
print(f"Also saved to {root_copy}")
print(f"Total clusters: {global_cluster_id}")
print(f"Total signals mapped: {len(signal_to_cluster)}")
print(f"Average within-domain silhouette: {np.mean(all_silhouettes):.4f}")

# Size stats
sizes = [c['size'] for c in clusters.values()]
print(f"Cluster sizes: min={min(sizes)}, max={max(sizes)}, avg={np.mean(sizes):.1f}, median={np.median(sizes):.1f}")

# Compare to TF-IDF baseline
print(f"\n{'='*60}")
print(f"AI clustering complete!")
print(f"Expected improvement over TF-IDF (silhouette 0.034):")
print(f"  AI silhouette: {np.mean(all_silhouettes):.4f}")
print(f"{'='*60}")
