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
                                    │  from 736 properties │
                                    │  + all user signals  │
                                    └──────────┬──────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │  Embed each signal   │
                                    │  with OpenAI         │
                                    │  text-embedding-3-   │
                                    │  small (1536-dim)    │
                                    └──────────┬──────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │  Domain-aware        │
                                    │  hierarchical K-means│
                                    │  into 400 clusters   │
                                    └──────────┬──────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │  Label each cluster  │
                                    │  (Claude names them) │
                                    │  e.g. "Nordic Design"│
                                    │  "Wellness Rituals"  │
                                    │  "Candlelit Ambiance"│
                                    └──────────┬──────────┘
                                               │
                              ┌────────────────▼────────────────┐
                              │  Frozen cluster assignments:     │
                              │  signal_text → cluster_id (0-K)  │
                              │  Stored in signal-clusters.json  │
                              └─────────────────────────────────┘
```

### Vector Construction (v3.4+: signal clusters only)

```
User/Property Vector (400 dimensions):
  [0-399] : cluster dims (signal → cluster_id lookup, IDF-weighted)

Domain dims were removed in v3.4 — they were redundant with domain-aware
clustering and added noise without improving match quality.
```

### Two-Tier Neighbor Bleed

When a signal activates a cluster, that activation "bleeds" to neighboring clusters:

- **Intra-domain** (up to 3 neighbors): weight = similarity × 0.15 (threshold > 0.3)
- **Cross-domain** (up to 2 neighbors): weight = similarity × 0.03 (threshold > 0.5)

Bleed scales were reduced from 0.30/0.10 in v3.3 to 0.15/0.03 in v3.5 to prevent vector saturation on properties with 300+ signals.

### Anti-Signal Integration

Rejection signals (anti-signals) create **negative** cluster activations at 0.5× the normal weight. This means a property's "not-for-you" signals actively push it away from users who dislike those characteristics.

## Current State (v3.4, March 2026)

| Metric | Value |
|--------|-------|
| Properties enriched | 736 |
| Unique signals (freq ≥ 2) | 7,628 |
| Total signals mapped (incl. singletons) | 131,643 |
| Clusters (K) | 400 |
| Vector dimensions | 400 (signal-only) |
| Avg silhouette score | 0.0995 |
| Cluster size range | 3–50 (median 20) |
| Micro-clusters (≤5 members) | 3 |
| Embedding model | OpenAI text-embedding-3-small |
| Signal cache entries | 113,907 |
| IDF weight entries | 112,050 |

### Domain Allocation

| Domain | Clusters | Silhouette |
|--------|----------|------------|
| Atmosphere | ~55 | 0.0995 |
| Character | ~70 | 0.0894 |
| Design | ~50 | 0.0864 |
| FoodDrink | ~55 | 0.0959 |
| Service | ~60 | 0.0958 |
| Setting | ~45 | 0.0864 |
| Sustainability | ~35 | 0.1242 |
| Wellness | ~30 | 0.1185 |

## Cluster Quality Audit (March 2026)

### Silhouette Score Interpretation

The silhouette score of 0.099 is low in absolute terms but **not diagnostic of poor cluster quality** in this setting. Three factors explain the compression:

1. **Curse of dimensionality.** K-means runs on 1536-dimensional OpenAI embeddings. In high-dimensional spaces, inter-cluster distances converge toward intra-cluster distances, depressing silhouette scores even when clusters are genuinely separable. The sweep across K=375–550 produces silhouette between 0.094–0.101 with no meaningful variation — the metric is insensitive to K.

2. **Domain-aware hierarchical clustering.** Each domain's silhouette is computed on a subset of the full embedding space. Since signals within a domain share semantic structure by construction, they're closer together than random cross-domain signals, which compresses within-domain separation.

3. **The clusters are actually coherent.** Manual inspection confirms that the vast majority of clusters group semantically related signals correctly. Cluster 15 is all candlelit ambiance variants. Cluster 16 is all wilderness/nature immersion. Cluster 302 is all choreographed multi-server service patterns. The embedding model is doing its job.

**Recommendation:** Don't chase a higher silhouette score. Evaluate cluster quality through manual coherence audits and downstream match quality instead. A coherence audit of 50 sampled clusters (rating 1–5 for "do these signals belong together?") would give a much more actionable quality metric.

### Label Quality Issues

The original design doc specified LLM-generated labels (this document, Step 4 below). That step was never implemented. Instead, `cluster-signals-v3.py` uses a mechanical word-extraction approach: take the top 3 signals by document frequency, extract all words >3 characters, alphabetically sort, join the first 3 with hyphens.

This produces labels like:

| Cluster | Mechanical Label | What It Actually Is |
|---------|-----------------|---------------------|
| 2 | `Atmosphere:atmosphere-intentional-intentionally` | Intentional quietude and silence |
| 47 | `Character:afternoon-alcoholic-cocktail` | Beverage programs and club models |
| 119 | `Design:Bensley-Bill-architectural` | Statement architecture |
| 8 | `Atmosphere:acoustics-between-conversation` | Sound environment and acoustics |
| 4 | `Atmosphere:dining-friendly-kitchen` | Open kitchen + workspace layouts |

**These labels surface to users** in the SignalResonanceStrip component (resonance pills on place cards), ghost card placement rationale, and the taste cluster dashboard.

**Fix implemented:** `scripts/relabel-clusters.py` sends each cluster's top 12 signals to Claude and generates semantically meaningful 2–4 word labels. The script writes a `displayLabel` field alongside the existing `label` (preserving backward compatibility). The `humanize-label.ts` module and `taste-match-vectors.ts` have been updated to prefer `displayLabel` when available. Run with:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
python3 scripts/relabel-clusters.py --apply --audit
```

Cost: ~400 clusters × ~200 tokens each = ~80K tokens ≈ $0.24 (one-time).

### Sentiment-Mixed Clusters

Six clusters were identified where signals expressing **opposite valence** about the same topic are grouped together:

| ID | Label | Problem |
|----|-------|---------|
| 42 | compact-count-design | Mixes "compact room design" with "oversized rooms" |
| 181 | dish-execution-food | Mixes inconsistent execution signals (all negative, but mixed topics) |
| 237 | housekeeping-inconsistent-invisible | "invisible housekeeping" (positive) + "inconsistent housekeeping" (negative) |
| 252 | breakfast-cooked-included | "breakfast quality inconsistent" + "cooked to order breakfast" |
| 294 | execution-inconsistent-quality | Mixes inconsistent service, execution, and room quality |
| 392 | acoustic-adjacent-exceptional | "exceptional soundproofing" + "poor acoustic isolation" |

This happens because **embeddings capture topic similarity, not valence**. "Exceptional soundproofing" and "poor acoustic isolation" are about the same thing (sound in rooms), so they're close in embedding space.

**Impact on matching:** When "exceptional soundproofing" and "poor acoustic isolation" are in the same cluster dimension, they activate the same vector element. A user who values quiet rooms and a property with noise complaints both score positively on this dimension — which is semantically wrong.

**Recommended fix:** Post-clustering sentiment audit.

1. For each cluster, run the top signals through a lightweight sentiment classifier (or simple keyword rules: "inconsistent", "poor", "dated", "noise", "overcrowded" → negative; "exceptional", "intentional", "curated" → positive).
2. If a cluster has >20% of its signals in the opposite-valence category from the majority, flag it.
3. For flagged clusters, either: (a) split the cluster by reassigning minority-valence signals to a dedicated "anti-" cluster for that topic, or (b) move the negative signals to the anti-signal pathway so they generate negative activations instead.

This affects ~6 of 400 clusters (<2%), so it's a targeted fix, not a rearchitecture. A script skeleton:

```python
# Pseudocode for sentiment-split audit
NEGATIVE_MARKERS = ['inconsistent', 'poor', 'dated', 'noise', 'overcrowded',
                     'lacking', 'limited', 'uncomfortable', 'issues', 'challenges']
POSITIVE_MARKERS = ['exceptional', 'intentional', 'curated', 'premium',
                     'outstanding', 'meticulous', 'beautiful', 'stunning']

for cluster_id, cluster in clusters.items():
    signals = cluster['topSignals']
    neg_count = sum(1 for s in signals if any(m in s for m in NEGATIVE_MARKERS))
    pos_count = sum(1 for s in signals if any(m in s for m in POSITIVE_MARKERS))

    total_tagged = neg_count + pos_count
    if total_tagged > 0:
        minority_ratio = min(neg_count, pos_count) / total_tagged
        if minority_ratio > 0.2:
            print(f"MIXED: cluster {cluster_id} — {neg_count} neg, {pos_count} pos")
```

## Implementation Reference

### Step 1: Collect the Signal Corpus

```bash
node scripts/extract-signal-corpus.mjs
```

Produces `signal-corpus.json` (freq ≥ 2), `signal-singletons.json` (freq = 1), and `signal-dimensions.json` (domain mappings).

### Step 2: Embed All Signals

Uses OpenAI text-embedding-3-small (1536-dim, $0.02/1M tokens). Cached in `signal-embeddings-cache.json` after first run. Current corpus: ~7,600 signals = ~$0.001.

### Step 3: Cluster the Embeddings

Domain-aware hierarchical K-means: signals are grouped by domain, each domain gets proportional sub-cluster allocation (min 3 per domain), and K-means runs independently within each domain.

```bash
python3 scripts/cluster-signals-v3.py --k 400
```

### Step 4: Label Clusters (LLM-Generated)

Each cluster's top 12 signals are sent to Claude in batches of 20 to generate 2–4 word semantic labels:

```bash
python3 scripts/relabel-clusters.py --apply --audit
```

Produces `displayLabel` fields in `signal-clusters.json` and a `cluster-relabel-audit-*.csv` for review. Labels flow through `humanize-label.ts` → `taste-match-vectors.ts` → `SignalResonanceStrip` UI.

### Step 5: Persist the Mapping

Stored as `signal-clusters.json` (17MB) at two locations:
- `signal-clusters.json` (project root, for scripts)
- `src/lib/taste-intelligence/signal-clusters.json` (for Next.js server)

Loaded lazily by `signal-clusters-loader.ts` with a singleton cache.

### Step 6: Handle New Signals

**Primary (automatic):** Embed the new signal, find nearest cluster centroid by cosine similarity. Handled at runtime via the `clusterCentroids` data in `signal-clusters.json`.

**Periodic maintenance:** Re-run the full pipeline quarterly when the property catalog grows significantly. See `docs/recluster-handoff.md` for the complete runbook.

## Evaluation Approach

### Recommended Metrics (in priority order)

1. **Manual coherence audit** — Sample 50 clusters, rate each 1–5 for "do these signals belong together?" Target: >4.0 average.
2. **Downstream match quality** — Do the top-5 property recommendations for test users make sense? Compare against known-good matches (Ett Hem, Forestis, Passalacqua, WIESERGUT) and known-bad matches.
3. **Top-10 precision** — How many ground-truth properties appear in each user's top 10.
4. **Score distribution** — Healthy: bell curve centered at 65–75. Unhealthy: bimodal or all-above-90.
5. **Silhouette score** — Track but don't optimize for. Uninformative in this embedding space.

### Metrics Not to Rely On

- **Silhouette score in isolation.** As documented above, 0.099 is not diagnostic of poor cluster quality in 1536-dimensional space. The sweep across K=375–550 shows no actionable variation.

## Cost & Complexity

| Aspect | v2.1 (Hash) | v3.4 (Semantic) |
|--------|-------------|-----------------|
| Signal → dim mapping | FNV-1a hash (instant, deterministic) | JSON lookup (instant after one-time clustering) |
| New signal handling | Automatic (hash) | Embedding + nearest centroid (sub-100ms) |
| Setup cost | Zero | One-time: ~$0.01 embedding + ~$0.24 labeling |
| Interpretability | Hash bucket IDs (opaque) | Named clusters ("Candlelit Ambiance") |
| Collision rate | ~2 unrelated signals per bucket at 128 dims | ~0 (semantically grouped) |
| Maintenance | None | Quarterly re-cluster + relabel |
| Vector dimensions | 136 (8 domain + 128 hash) | 400 (cluster-only) |

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v3.0 | 2026-03-05 | Initial semantic clustering, K=96, domain+cluster dims |
| v3.1 | 2026-03-07 | Increased to K=280, added singleton mapping |
| v3.2 | 2026-03-09 | Flat neighbor bleed (decay=0.12) |
| v3.3 | 2026-03-11 | K=400, two-tier neighbor bleed (intra 0.30 / cross 0.10) |
| v3.4 | 2026-03-14 | Removed domain dims (400-dim signal-only), anti-signal integration |
| v3.5 | 2026-03-19 | LLM-generated cluster labels, reduced bleed scales (0.15/0.03) |

## Maintenance Scripts

### Sentiment Audit (`scripts/audit-cluster-sentiment.py`)

Identifies clusters where positive and negative valence signals are grouped together. Uses a hospitality-tuned sentiment lexicon (~40 negative markers, ~35 positive markers) to classify each cluster's top signals and flag clusters with >15% minority-sentiment signals.

```bash
python3 scripts/audit-cluster-sentiment.py              # report only
python3 scripts/audit-cluster-sentiment.py --csv         # export audit CSV
python3 scripts/audit-cluster-sentiment.py --fix         # compute reassignments (dry run)
python3 scripts/audit-cluster-sentiment.py --fix --apply # reassign signals + update JSON
```

The `--fix` mode identifies the best same-domain, same-sentiment target cluster for minority signals and reassigns them. After applying, you need to rebuild the signal cache and run a vector backfill (see `recluster-handoff.md`).

### Coherence Audit (`scripts/audit-cluster-coherence.py`)

Samples N clusters (default 50, stratified by domain) and collects 1–5 coherence ratings. Supports both interactive manual rating and automated Claude-powered rating.

```bash
python3 scripts/audit-cluster-coherence.py               # interactive audit of 50 clusters
python3 scripts/audit-cluster-coherence.py --auto         # Claude-powered auto-audit
python3 scripts/audit-cluster-coherence.py --n 25 --auto  # auto-audit 25 clusters
python3 scripts/audit-cluster-coherence.py --resume       # resume interrupted manual audit
python3 scripts/audit-cluster-coherence.py --report audit.json  # view saved results
```

Target: average score >4.0. Produces JSON + CSV with per-cluster ratings and domain breakdowns. The `--auto` mode requires `ANTHROPIC_API_KEY`.

### Cluster Relabeling (`scripts/relabel-clusters.py`)

Replaces mechanical word-extraction labels with Claude-generated 2–4 word semantic labels. See Step 4 above.

### Cluster Health Monitoring (`/api/cron/cluster-health`)

Weekly cron job (Mondays 4am UTC) that monitors three re-clustering trigger conditions:

| Metric | Threshold | What it means |
|--------|-----------|---------------|
| New singletons | >500 signals not in frozen corpus | Embedding space has drifted, centroids may be stale |
| Property growth | >100 new enriched properties | IDF weights and cluster compositions may be outdated |
| Cache miss rate | >5% of signal instances | Corpus has drifted significantly from the pre-computed cache |

When any threshold is exceeded, the endpoint returns `status: "reclustering_recommended"` with details. Does not automatically trigger re-clustering — that remains a manual pipeline via `recluster-handoff.md`.

The endpoint can also be called manually: `GET /api/cron/cluster-health` (requires `CRON_SECRET` auth).

## Open Items

1. **Run sentiment audit** — Execute `audit-cluster-sentiment.py --fix` to quantify and address the ~6 mixed-sentiment clusters identified in the March 2026 analysis.
2. **Establish coherence baseline** — Run `audit-cluster-coherence.py --auto` to get the first formal quality score. This establishes the baseline to compare against after any future re-clustering.
3. **Post-relabel verification** — After `relabel-clusters.py --apply` runs, spot-check the UI in `SignalResonanceStrip` and the taste dashboard to confirm labels render correctly.
