# Vector v3: Semantic Clustering Approach

## Problem Statement

v2.1 vectors use FNV-1a hashing to map signal text into 128 buckets. This is a major improvement over v2.0's 26 buckets, but hashing is fundamentally random — semantically related signals can land in different buckets, and unrelated signals can collide. For example:

- **Collision**: "outdoor-cold-plunge" and "Japanese-serenity" might still share a bucket
- **Split**: "scandinavian-modern" and "hygge-cozy" might land in different buckets despite being thematically identical

v3 replaces random hashing with **learned semantic clusters**, where each dimension represents a meaningful taste concept.

## Architecture

### Signal Embedding + Clustering Pipeline

```
                                    ┌─────────────────────┐
                                    │  All unique signals  │
                                    │  from 360 properties │
                                    │  + all user signals  │
                                    └──────────┬──────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │  Embed each signal   │
                                    │  text with a small   │
                                    │  model (e.g. E5,     │
                                    │  BGE-small, or even  │
                                    │  OpenAI text-3-small)│
                                    └──────────┬──────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │  K-means or HDBSCAN  │
                                    │  into 64-128 clusters│
                                    └──────────┬──────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │  Label each cluster  │
                                    │  (LLM names them)    │
                                    │  e.g. "Nordic Design" │
                                    │  "Wellness Rituals"  │
                                    │  "Urban Exploration" │
                                    └──────────┬──────────┘
                                               │
                              ┌────────────────▼────────────────┐
                              │  Frozen cluster assignments:     │
                              │  signal_text → cluster_id (0-K)  │
                              │  Stored in DB / JSON config      │
                              └─────────────────────────────────┘
```

### Vector Construction (same as v2.1, but clusters replace hash)

```
User/Property Vector (8 + K dimensions):
  [0-7]     : domain dims (same as v2.1, independently normalized)
  [8-(8+K)] : cluster dims (signal → cluster_id lookup, IDF-weighted)
```

The only code change from v2.1 is replacing `hashSignalToBucket()` with `lookupSignalCluster()`.

## Implementation Plan

### Step 1: Collect the Signal Corpus

Query all unique signal text from:
- `PlaceIntelligence.signals[].signal` (property signals)
- `TasteNode.signal` (user signals)
- `User.tasteProfile.microTasteSignals` (micro-signals)

Expected: ~2,000-5,000 unique signal strings.

```sql
-- Property signals
SELECT DISTINCT sig->>'signal' as signal_text
FROM "PlaceIntelligence", jsonb_array_elements(signals) as sig
WHERE status = 'complete' AND "signalCount" > 0;

-- User signals
SELECT DISTINCT signal as signal_text
FROM "TasteNode"
WHERE "isActive" = true;
```

### Step 2: Embed All Signals

Use a lightweight embedding model to get semantic vectors for each signal string.

**Model options (in order of preference):**

1. **OpenAI text-embedding-3-small** (1536-dim, $0.02/1M tokens)
   - Best quality, already have API key
   - ~5,000 signals × ~3 tokens each = ~15K tokens = $0.0003
   - Essentially free

2. **BGE-small-en-v1.5** (384-dim, local/free)
   - Run locally via transformers.js or Python
   - No API dependency

3. **Ollama nomic-embed-text** (768-dim, local/free)
   - Run locally if Ollama is available

The embedding only needs to run **once** to establish clusters. After that, new signals get assigned to the nearest existing cluster.

### Step 3: Cluster the Embeddings

Run K-means (or HDBSCAN for variable-density clusters) on the signal embeddings.

**Target: 64-128 clusters.** Tuning approach:
- Start with K=64, K=96, K=128
- Evaluate silhouette score and intra-cluster coherence
- Pick K that minimizes "semantically unrelated signals in same cluster"

```python
from sklearn.cluster import KMeans
import numpy as np

# embeddings: (N_signals, embed_dim) matrix
# Try multiple K values
for k in [64, 96, 128]:
    km = KMeans(n_clusters=k, n_init=10, random_state=42)
    labels = km.fit_predict(embeddings)

    # Evaluate: for each cluster, print the signals it contains
    for c in range(k):
        members = [signals[i] for i in range(len(signals)) if labels[i] == c]
        print(f"Cluster {c}: {members[:10]}")
```

### Step 4: Label Clusters (Optional but Valuable)

Pass each cluster's top 10-15 signals to an LLM to generate a human-readable name:

```
Cluster members: scandinavian-modern, hygge-cozy, Timber-and-paper, natural-materials-aesthetic, warm-minimal
→ Label: "Nordic Warmth"

Cluster members: outdoor-cold-plunge, natural-spring-water, mountain-spa, spa-wellness-priority
→ Label: "Wellness Rituals"
```

These labels make the vector **fully interpretable** — you can tell a user "you matched this property because of your Nordic Warmth and Wellness Rituals preferences."

### Step 5: Persist the Mapping

Store the frozen mapping as a JSON config:

```typescript
// src/lib/taste-intelligence/signal-clusters.json
{
  "version": "v3.0",
  "k": 96,
  "model": "text-embedding-3-small",
  "created": "2026-03-05",
  "clusters": {
    "0": {
      "label": "Nordic Warmth",
      "signals": ["scandinavian-modern", "hygge-cozy", "timber-and-paper", ...]
    },
    "1": {
      "label": "Wellness Rituals",
      "signals": ["outdoor-cold-plunge", "natural-spring-water", "mountain-spa", ...]
    },
    ...
  },
  "signalToCluster": {
    "scandinavian-modern": 0,
    "hygge-cozy": 0,
    "outdoor-cold-plunge": 1,
    ...
  }
}
```

### Step 6: Replace Hash with Lookup in vectors.ts

Minimal code change:

```typescript
import clusterMap from './signal-clusters.json';

function lookupSignalCluster(signal: string): number {
  const normalized = signal.toLowerCase().trim();
  const clusterId = clusterMap.signalToCluster[normalized];
  if (clusterId !== undefined) return clusterId;

  // Fallback for unseen signals: find nearest cluster centroid
  // (requires storing centroids and doing a quick cosine lookup)
  return fallbackCluster(normalized);
}
```

### Step 7: Handle New Signals (Post-Clustering)

When a new property is enriched and produces signals not in the original corpus:

**Option A: Nearest centroid (recommended)**
- Embed the new signal text
- Find the nearest cluster centroid by cosine similarity
- Assign to that cluster

**Option B: Periodic re-clustering**
- Accumulate new signals
- Re-run clustering monthly with the expanded corpus
- Requires recomputing all vectors (same as v2.0 → v2.1 migration)

**Option C: Hash fallback**
- For truly unknown signals, fall back to FNV-1a hash into the cluster space
- Worst case: same behavior as v2.1 for rare new signals

Recommend Option A with Option B as a quarterly maintenance task.

## Evaluation Plan

### A/B Comparison: v2.1 (hash) vs v3 (semantic clusters)

Use the same comparison methodology from the signal-vs-vector analysis:

1. **Ground truth**: Known-good matches (Ett Hem, Forestis, Passalacqua, WIESERGUT) and known-bad matches (Chatuchak, Arena México)
2. **Spearman correlation**: Between v2.1 and v3 rankings — expect divergence, but v3 should agree more with signal-based scoring on the "good" matches
3. **Top-10 precision**: How many ground-truth properties appear in each method's top 10
4. **Cluster coherence audit**: Manually inspect each cluster's members — are they semantically related?
5. **Collision rate**: Compare how many semantically unrelated signals share a dimension (hash buckets vs semantic clusters)

### Metrics to Track

- **Cluster purity**: What % of signals in each cluster are semantically related (manual audit of top 20 clusters)
- **Coverage**: What % of user/property signals map to a cluster vs fall back to nearest-centroid
- **Discrimination**: Standard deviation of per-dimension contributions — higher is better (means different properties look different)
- **Known-match rank**: Where do Ett Hem, Forestis, Passalacqua rank for this specific user

## Cost & Complexity

| Aspect | v2.1 (Hash) | v3 (Semantic) |
|--------|-------------|---------------|
| Signal → dim mapping | FNV-1a hash (instant, deterministic) | JSON lookup (instant after one-time clustering) |
| New signal handling | Automatic (hash) | Needs embedding + nearest centroid |
| Setup cost | Zero | One-time: embed corpus + cluster (~$0.01 API cost, ~1hr dev) |
| Interpretability | Hash bucket IDs (opaque) | Named clusters ("Nordic Warmth") |
| Collision rate | ~2 unrelated signals per bucket at 128 dims | ~0 (semantically grouped by design) |
| Maintenance | None | Quarterly re-cluster if signal corpus grows significantly |

## Timeline

1. **Day 1**: Collect signal corpus, embed with text-embedding-3-small
2. **Day 1**: Run K-means with K=64,96,128, evaluate silhouette + manual audit
3. **Day 2**: Label clusters via LLM, persist mapping JSON
4. **Day 2**: Replace `hashSignalToBucket` → `lookupSignalCluster` in vectors.ts
5. **Day 2**: Recompute all vectors, run comparison against v2.1
6. **Day 3**: Evaluate results, tune K if needed, ship

## Dependencies

- OpenAI API key (already have) or local embedding model
- Python with sklearn for clustering (one-time script)
- No new infrastructure — just a JSON config file and a code swap

## Open Questions

1. **K selection**: 64 vs 96 vs 128? Start with 96 (similar to v2.1's 128 hash buckets but fewer collisions means fewer dims needed)
2. **Cluster stability**: How much does the clustering change if we add 50 new properties? Test by holding out 10% and seeing if cluster assignments shift.
3. **Cross-language signals**: Some property signals are in German/Japanese/etc. Should we translate before embedding? (Probably yes — text-embedding-3-small handles multilingual decently but normalization helps)
4. **Hierarchical clusters**: Could do 2-level clustering (8 macro-clusters aligned to domains + 12-16 sub-clusters each). This would make the domain/signal split more natural. Worth exploring.
