#!/usr/bin/env python3
"""
Sentiment-mixed cluster audit for Terrazzo signal clusters.

Identifies clusters where positive and negative valence signals are grouped
together — a known weakness of embedding-based clustering, where topic
similarity dominates over sentiment. For example, "exceptional soundproofing"
and "poor acoustic isolation" are about the same topic but express opposite
qualities.

Outputs:
  1. A report of flagged clusters with mixed sentiment
  2. Optionally, a patched signal-clusters.json where minority-sentiment
     signals are reassigned to the nearest same-sentiment cluster

Usage:
  python3 scripts/audit-cluster-sentiment.py                  # report only
  python3 scripts/audit-cluster-sentiment.py --fix             # reassign signals
  python3 scripts/audit-cluster-sentiment.py --fix --apply     # write changes
  python3 scripts/audit-cluster-sentiment.py --csv             # export audit CSV

Requires: no external dependencies (pure Python + signal-clusters.json)
"""

import json
import sys
import csv
import argparse
from pathlib import Path
from collections import defaultdict
from datetime import datetime

# ─── Sentiment lexicons ─────────────────────────────────────────────────────
# Tuned for hospitality/travel signal vocabulary. These are substring matches
# against hyphenated signal text (e.g., "inconsistent-food-quality").

NEGATIVE_MARKERS = [
    'inconsistent', 'poor', 'dated', 'noise', 'overcrowded', 'lacking',
    'limited', 'uncomfortable', 'issues', 'challenges', 'complaints',
    'cramped', 'overpriced', 'underwhelming', 'disappointing', 'worn',
    'tired', 'stained', 'broken', 'slow', 'rude', 'unresponsive',
    'cold', 'impersonal', 'generic', 'chaotic', 'dirty', 'musty',
    'thin-walls', 'sound-transfer', 'not-included', 'charged',
    'overcrowding', 'turnover-pressure', 'rushed', 'noisy',
    'outdated', 'neglected', 'peeling', 'leaking', 'moldy',
    'understaffed', 'disorganized', 'confused', 'wrong',
    'overrated', 'crowded', 'touristy', 'inauthentic',
    'variable-quality', 'maintenance', 'unheated', 'bug',
]

POSITIVE_MARKERS = [
    'exceptional', 'intentional', 'intentionally', 'curated', 'premium', 'outstanding',
    'meticulous', 'beautiful', 'stunning', 'impeccable', 'pristine',
    'thoughtful', 'seamless', 'flawless', 'exquisite', 'remarkable',
    'innovative', 'elevated', 'refined', 'masterful', 'bespoke',
    'artisanal', 'handcrafted', 'celebrated', 'award', 'michelin',
    'complimentary', 'generous', 'luxurious', 'world-class',
    'anticipatory', 'invisible', 'personalized', 'memorable',
    'transformative', 'extraordinary', 'rare', 'unique',
]

# Signals that are genuinely neutral/descriptive — don't flag clusters
# just because they contain these alongside positive or negative signals.
# Also includes compound patterns where "limited" is a feature (intentional
# intimacy/exclusivity), not a complaint.
NEUTRAL_OVERRIDE = [
    'included', 'standard', 'typical', 'available', 'optional',
    'seasonal', 'traditional', 'modern', 'contemporary', 'classic',
    # "limited" as intentional intimacy/exclusivity, not a complaint
    'limited-room-count-intimacy', 'limited-seating-intimate',
    'intentionally-compact', 'intentionally-intimate',
    'intentionally-remote', 'intentionally-disconnected',
    'intentionally-uncomfortable',  # design choice, not a defect
    'intentionally-exposed',        # weathering as aesthetic
    'compact-curated', 'small-curated',
    # "limited X" in food/drink context where it describes curation, not scarcity
    'limited-dietary', 'limited-vegetarian', 'limited-wine',
    'limited-menu', 'limited-cell-reception',
    'limited-seating-capacity', 'limited-seating-in',
    # personalized + limited in same cluster = curation spectrum, not conflict
    'personalized-dietary', 'personalized-vegetarian',
]

# ─── Configuration ──────────────────────────────────────────────────────────

MINORITY_THRESHOLD = 0.15  # flag if >15% of tagged signals are minority sentiment
MIN_TAGGED_SIGNALS = 3     # need at least 3 sentiment-tagged signals to flag

# ─── Parse args ─────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Audit clusters for sentiment mixing")
parser.add_argument('--fix', action='store_true',
                    help='Compute signal reassignments for mixed clusters')
parser.add_argument('--apply', action='store_true',
                    help='Write patched signal-clusters.json (requires --fix)')
parser.add_argument('--csv', action='store_true',
                    help='Export detailed audit as CSV')
parser.add_argument('--clusters-file', type=str, default=None,
                    help='Path to signal-clusters.json')
parser.add_argument('--threshold', type=float, default=MINORITY_THRESHOLD,
                    help=f'Minority ratio to flag (default: {MINORITY_THRESHOLD})')
args = parser.parse_args()

# ─── Load data ──────────────────────────────────────────────────────────────

project_dir = Path(__file__).parent.parent

candidate_paths = [
    Path(args.clusters_file) if args.clusters_file else None,
    project_dir / "signal-clusters.json",
    project_dir / "src" / "lib" / "taste-intelligence" / "signal-clusters.json",
]

clusters_path = None
data = None
for p in [p for p in candidate_paths if p is not None]:
    if p.exists():
        clusters_path = p
        with open(p) as f:
            data = json.load(f)
        print(f"Loaded from {p}")
        break

if data is None:
    print("ERROR: Could not find signal-clusters.json")
    sys.exit(1)

clusters = data.get("clusters", {})
signal_to_cluster = data.get("signalToCluster", {})
print(f"Analyzing {len(clusters)} clusters\n")

# ─── Sentiment classification ───────────────────────────────────────────────

def classify_signal(signal: str) -> str:
    """Classify a signal as 'positive', 'negative', or 'neutral'."""
    s = signal.lower()

    # Check neutral overrides first — these are compound patterns where a
    # normally-negative word (like "limited") is actually a feature.
    # Match as substrings so "limited-room-count-intimacy" catches
    # both the exact signal and slight variations.
    for marker in NEUTRAL_OVERRIDE:
        if marker in s:
            return 'neutral'

    neg_hits = sum(1 for m in NEGATIVE_MARKERS if m in s)
    pos_hits = sum(1 for m in POSITIVE_MARKERS if m in s)

    if neg_hits > pos_hits:
        return 'negative'
    elif pos_hits > neg_hits:
        return 'positive'
    return 'neutral'


# ─── Audit each cluster ────────────────────────────────────────────────────

flagged = []
all_results = []

for cid in sorted(clusters.keys(), key=int):
    c = clusters[cid]
    top_signals = c.get("topSignals", [])
    domain = c.get("domain", "Unknown")
    label = c.get("displayLabel", c.get("label", f"cluster-{cid}"))
    size = c.get("size", 0)

    # Classify all top signals
    classifications = [(sig, classify_signal(sig)) for sig in top_signals]
    pos_signals = [s for s, cls in classifications if cls == 'positive']
    neg_signals = [s for s, cls in classifications if cls == 'negative']
    neu_signals = [s for s, cls in classifications if cls == 'neutral']

    total_tagged = len(pos_signals) + len(neg_signals)
    majority = 'positive' if len(pos_signals) >= len(neg_signals) else 'negative'
    minority_count = min(len(pos_signals), len(neg_signals))
    minority_ratio = minority_count / total_tagged if total_tagged > 0 else 0

    is_mixed = (
        total_tagged >= MIN_TAGGED_SIGNALS
        and minority_ratio > args.threshold
    )

    result = {
        'id': cid,
        'domain': domain,
        'label': label,
        'size': size,
        'positive_count': len(pos_signals),
        'negative_count': len(neg_signals),
        'neutral_count': len(neu_signals),
        'total_tagged': total_tagged,
        'minority_ratio': minority_ratio,
        'majority_sentiment': majority,
        'is_mixed': is_mixed,
        'positive_signals': pos_signals,
        'negative_signals': neg_signals,
    }
    all_results.append(result)

    if is_mixed:
        flagged.append(result)

# ─── Report ─────────────────────────────────────────────────────────────────

print(f"{'=' * 70}")
print(f"SENTIMENT AUDIT RESULTS")
print(f"{'=' * 70}")
print(f"  Total clusters analyzed: {len(clusters)}")
print(f"  Clusters with sentiment signals: {sum(1 for r in all_results if r['total_tagged'] > 0)}")
print(f"  Flagged as mixed-sentiment: {len(flagged)}")
print(f"  Threshold: {args.threshold:.0%} minority ratio, min {MIN_TAGGED_SIGNALS} tagged signals")
print()

if flagged:
    print(f"{'─' * 70}")
    print(f"MIXED-SENTIMENT CLUSTERS")
    print(f"{'─' * 70}\n")

    for r in sorted(flagged, key=lambda x: -x['minority_ratio']):
        print(f"  Cluster {r['id']:>3} [{r['domain']}] — {r['label']}")
        print(f"    Size: {r['size']}, Majority: {r['majority_sentiment']}, "
              f"Mix ratio: {r['minority_ratio']:.0%} ({r['positive_count']}+ / {r['negative_count']}-)")
        print(f"    Positive signals:")
        for s in r['positive_signals'][:5]:
            print(f"      + {s}")
        print(f"    Negative signals:")
        for s in r['negative_signals'][:5]:
            print(f"      - {s}")
        print()
else:
    print("  No mixed-sentiment clusters found at current threshold.\n")

# ─── Sentiment summary by domain ────────────────────────────────────────────

print(f"{'─' * 70}")
print(f"DOMAIN SUMMARY")
print(f"{'─' * 70}")
domain_stats = defaultdict(lambda: {'total': 0, 'mixed': 0, 'neg_dominant': 0, 'pos_dominant': 0})
for r in all_results:
    d = domain_stats[r['domain']]
    d['total'] += 1
    if r['is_mixed']:
        d['mixed'] += 1
    elif r['total_tagged'] > 0:
        if r['majority_sentiment'] == 'negative':
            d['neg_dominant'] += 1
        else:
            d['pos_dominant'] += 1

print(f"  {'Domain':<16} {'Total':>6} {'Mixed':>6} {'Pos-dom':>8} {'Neg-dom':>8}")
print(f"  {'─' * 16} {'─' * 6} {'─' * 6} {'─' * 8} {'─' * 8}")
for domain in sorted(domain_stats.keys()):
    d = domain_stats[domain]
    print(f"  {domain:<16} {d['total']:>6} {d['mixed']:>6} {d['pos_dominant']:>8} {d['neg_dominant']:>8}")
print()

# ─── Fix mode: compute reassignments ────────────────────────────────────────

reassignments = {}

if args.fix and flagged:
    print(f"{'=' * 70}")
    print(f"COMPUTING REASSIGNMENTS")
    print(f"{'=' * 70}\n")

    # For each flagged cluster, identify minority-sentiment signals and find
    # the best same-domain cluster to reassign them to. We pick the cluster
    # with the most same-sentiment signals (excluding the source cluster).

    # Build domain → cluster list with sentiment profiles
    domain_cluster_sentiment = defaultdict(list)
    for r in all_results:
        domain_cluster_sentiment[r['domain']].append(r)

    for r in flagged:
        minority_sent = 'negative' if r['majority_sentiment'] == 'positive' else 'positive'
        minority_signals = r['negative_signals'] if minority_sent == 'negative' else r['positive_signals']

        # Find best target cluster in the same domain with matching sentiment
        candidates = [
            c for c in domain_cluster_sentiment[r['domain']]
            if c['id'] != r['id']
            and not c['is_mixed']
            and c['majority_sentiment'] == minority_sent
        ]

        if not candidates:
            # No same-sentiment cluster exists — create a note for manual handling
            print(f"  Cluster {r['id']} [{r['domain']}]: No same-sentiment target cluster for "
                  f"{len(minority_signals)} {minority_sent} signals. Manual split needed.")
            reassignments[r['id']] = {
                'action': 'manual_split_needed',
                'minority_sentiment': minority_sent,
                'signals': minority_signals,
                'reason': f'No {minority_sent}-dominant cluster in {r["domain"]} domain',
            }
            continue

        # Pick the candidate with the highest proportion of matching sentiment
        best = max(candidates, key=lambda c: (
            c['negative_count'] if minority_sent == 'negative' else c['positive_count']
        ))

        print(f"  Cluster {r['id']} → Cluster {best['id']} [{r['domain']}]:")
        print(f"    Moving {len(minority_signals)} {minority_sent} signals from "
              f"\"{r['label']}\" to \"{best['label']}\"")
        for s in minority_signals[:3]:
            print(f"      → {s}")
        if len(minority_signals) > 3:
            print(f"      ... and {len(minority_signals) - 3} more")
        print()

        reassignments[r['id']] = {
            'action': 'reassign',
            'target_cluster': best['id'],
            'target_label': best['label'],
            'minority_sentiment': minority_sent,
            'signals': minority_signals,
        }

    print(f"\n  Total reassignments: {sum(len(v['signals']) for v in reassignments.values())}")
    print(f"  Clusters affected: {len(reassignments)}")

    # ── Apply reassignments ──────────────────────────────────────────────────

    if args.apply:
        applied_count = 0
        for source_cid, info in reassignments.items():
            if info['action'] != 'reassign':
                continue

            target_cid = str(info['target_cluster'])
            source_cid_str = str(source_cid)

            for sig in info['signals']:
                # Update signalToCluster mapping
                if sig in signal_to_cluster:
                    signal_to_cluster[sig] = int(target_cid)

                # Update topSignals lists
                src_top = clusters[source_cid_str].get('topSignals', [])
                if sig in src_top:
                    src_top.remove(sig)

                tgt_top = clusters[target_cid].get('topSignals', [])
                if sig not in tgt_top:
                    tgt_top.append(sig)

                applied_count += 1

            # Update sizes
            moved = len(info['signals'])
            clusters[source_cid_str]['size'] = max(0, clusters[source_cid_str].get('size', 0) - moved)
            clusters[target_cid]['size'] = clusters[target_cid].get('size', 0) + moved

        # Record the audit metadata
        data['signalToCluster'] = signal_to_cluster
        data['clusters'] = clusters
        data.setdefault('audits', []).append({
            'type': 'sentiment_split',
            'date': datetime.now().isoformat(),
            'clusters_flagged': len(flagged),
            'signals_reassigned': applied_count,
            'threshold': args.threshold,
        })

        # Write to both locations
        output_paths = [
            project_dir / "signal-clusters.json",
            project_dir / "src" / "lib" / "taste-intelligence" / "signal-clusters.json",
        ]

        for out_path in output_paths:
            if out_path.exists():
                with open(out_path, 'w') as f:
                    json.dump(data, f, indent=2)
                print(f"  Updated {out_path}")

        print(f"\n  Applied {applied_count} signal reassignments across {len(reassignments)} clusters")
        print(f"\n  IMPORTANT: After applying, you need to recompute vectors:")
        print(f"    1. Rebuild signal cache in Supabase (see recluster-handoff.md Step 7)")
        print(f"    2. Run vector backfill: POST /api/cron/vector-refresh")

    elif reassignments:
        print(f"\n  Dry run — to apply, add --apply flag")

# ─── Export CSV ─────────────────────────────────────────────────────────────

if args.csv:
    csv_path = project_dir / f"cluster-sentiment-audit-{datetime.now().strftime('%Y%m%d-%H%M%S')}.csv"
    with open(csv_path, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            'cluster_id', 'domain', 'label', 'size',
            'positive_count', 'negative_count', 'neutral_count',
            'minority_ratio', 'majority_sentiment', 'is_mixed',
            'positive_signals', 'negative_signals',
        ])
        for r in all_results:
            writer.writerow([
                r['id'], r['domain'], r['label'], r['size'],
                r['positive_count'], r['negative_count'], r['neutral_count'],
                f"{r['minority_ratio']:.3f}", r['majority_sentiment'], r['is_mixed'],
                ' | '.join(r['positive_signals'][:8]),
                ' | '.join(r['negative_signals'][:8]),
            ])
    print(f"Audit CSV saved to {csv_path}")
