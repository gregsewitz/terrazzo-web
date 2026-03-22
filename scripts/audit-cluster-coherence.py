#!/usr/bin/env python3
"""
Cluster coherence audit tool for Terrazzo signal clusters.

Samples N clusters (default 50), presents each cluster's top signals, and
collects a 1-5 coherence rating from the reviewer. Produces a baseline
quality score for the current clustering.

Rating scale:
  5 — Perfect: all signals clearly describe the same concept
  4 — Good: minor outliers but the cluster has a clear theme
  3 — Okay: recognizable theme but noticeable noise
  2 — Weak: signals are loosely related at best
  1 — Incoherent: no discernible common concept

Usage:
  python3 scripts/audit-cluster-coherence.py                  # interactive audit of 50 clusters
  python3 scripts/audit-cluster-coherence.py --n 25           # audit 25 clusters
  python3 scripts/audit-cluster-coherence.py --resume         # resume an interrupted audit
  python3 scripts/audit-cluster-coherence.py --auto           # LLM-powered auto-audit (no human input)
  python3 scripts/audit-cluster-coherence.py --report audit.json  # print report from saved audit

Requires: anthropic (only for --auto mode)
"""

import json
import sys
import os
import random
import argparse
import csv
from pathlib import Path
from datetime import datetime

# ─── Parse args ─────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Cluster coherence audit")
parser.add_argument('--n', type=int, default=50, help='Number of clusters to sample (default: 50)')
parser.add_argument('--seed', type=int, default=None, help='Random seed for reproducible sampling')
parser.add_argument('--resume', action='store_true', help='Resume an interrupted audit')
parser.add_argument('--auto', action='store_true', help='Use Claude to rate clusters automatically')
parser.add_argument('--report', type=str, default=None, help='Print report from a saved audit JSON')
parser.add_argument('--clusters-file', type=str, default=None, help='Path to signal-clusters.json')
args = parser.parse_args()

project_dir = Path(__file__).parent.parent

# ─── Report mode ────────────────────────────────────────────────────────────

if args.report:
    report_path = Path(args.report)
    if not report_path.exists():
        print(f"ERROR: File not found: {report_path}")
        sys.exit(1)

    with open(report_path) as f:
        audit = json.load(f)

    ratings = audit.get("ratings", [])
    if not ratings:
        print("No ratings found in audit file.")
        sys.exit(0)

    scores = [r["rating"] for r in ratings]
    avg = sum(scores) / len(scores)

    print(f"{'=' * 60}")
    print(f"COHERENCE AUDIT REPORT")
    print(f"{'=' * 60}")
    print(f"  Date: {audit.get('date', 'unknown')}")
    print(f"  Clusters rated: {len(scores)}")
    print(f"  Average score: {avg:.2f} / 5.0")
    print(f"  Distribution:")
    for score in [5, 4, 3, 2, 1]:
        count = scores.count(score)
        bar = '#' * count
        print(f"    {score}: {bar} ({count})")
    print()

    # Domain breakdown
    domain_scores = {}
    for r in ratings:
        d = r.get("domain", "Unknown")
        domain_scores.setdefault(d, []).append(r["rating"])

    print(f"  Domain averages:")
    for d in sorted(domain_scores.keys()):
        ds = domain_scores[d]
        print(f"    {d:<16} {sum(ds)/len(ds):.2f}  (n={len(ds)})")
    print()

    # Worst clusters
    worst = sorted(ratings, key=lambda r: r["rating"])[:10]
    print(f"  Lowest-rated clusters:")
    for r in worst:
        print(f"    [{r['id']:>3}] {r['label']:<35} — {r['rating']}/5  ({r['domain']})")

    sys.exit(0)

# ─── Load cluster data ──────────────────────────────────────────────────────

candidate_paths = [
    Path(args.clusters_file) if args.clusters_file else None,
    project_dir / "signal-clusters.json",
    project_dir / "src" / "lib" / "taste-intelligence" / "signal-clusters.json",
]

data = None
for p in [p for p in candidate_paths if p is not None]:
    if p.exists():
        with open(p) as f:
            data = json.load(f)
        print(f"Loaded from {p}")
        break

if data is None:
    print("ERROR: Could not find signal-clusters.json")
    sys.exit(1)

clusters = data.get("clusters", {})
all_ids = sorted(clusters.keys(), key=int)
print(f"Total clusters: {len(all_ids)}")

# ─── Sample selection ───────────────────────────────────────────────────────

# Stratified sampling: proportional representation from each domain
domain_ids = {}
for cid in all_ids:
    d = clusters[cid].get("domain", "Unknown")
    domain_ids.setdefault(d, []).append(cid)

seed = args.seed if args.seed is not None else int(datetime.now().timestamp())
rng = random.Random(seed)

sample_ids = []
n = min(args.n, len(all_ids))

# Allocate proportionally, min 1 per domain
total_in_domains = sum(len(ids) for ids in domain_ids.values())
for d in sorted(domain_ids.keys()):
    alloc = max(1, round(len(domain_ids[d]) / total_in_domains * n))
    sampled = rng.sample(domain_ids[d], min(alloc, len(domain_ids[d])))
    sample_ids.extend(sampled)

# Trim or pad to exact n
if len(sample_ids) > n:
    sample_ids = rng.sample(sample_ids, n)
elif len(sample_ids) < n:
    remaining = [cid for cid in all_ids if cid not in sample_ids]
    extra = rng.sample(remaining, min(n - len(sample_ids), len(remaining)))
    sample_ids.extend(extra)

rng.shuffle(sample_ids)

# ─── State file for resume ──────────────────────────────────────────────────

state_path = project_dir / ".cluster-audit-state.json"

if args.resume and state_path.exists():
    with open(state_path) as f:
        state = json.load(f)
    sample_ids = state.get("sample_ids", sample_ids)
    ratings = state.get("ratings", [])
    rated_ids = {r["id"] for r in ratings}
    remaining = [cid for cid in sample_ids if cid not in rated_ids]
    print(f"Resuming audit: {len(ratings)} already rated, {len(remaining)} remaining\n")
else:
    ratings = []
    remaining = list(sample_ids)

# ─── Auto mode: use Claude ─────────────────────────────────────────────────

if args.auto:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY not set (required for --auto)")
        sys.exit(1)

    try:
        import anthropic
    except ImportError:
        print("ERROR: pip install anthropic")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    SYSTEM = """You are evaluating the coherence of signal clusters for a taste intelligence system.
Each cluster should group semantically related signals — signals that describe the same concept or quality.

Rate each cluster 1-5:
  5 — Perfect: all signals clearly describe the same concept
  4 — Good: minor outliers but the cluster has a clear theme
  3 — Okay: recognizable theme but noticeable noise
  2 — Weak: signals are loosely related at best
  1 — Incoherent: no discernible common concept

Return ONLY a JSON object mapping cluster ID to {"rating": N, "reason": "brief explanation"}.
Be rigorous — a cluster about "sound" that mixes "great soundproofing" with "thin walls noise" should be rated 2-3, not 4-5."""

    BATCH_SIZE = 20
    print(f"\nAuto-auditing {len(remaining)} clusters with Claude...\n")

    for i in range(0, len(remaining), BATCH_SIZE):
        batch = remaining[i:i + BATCH_SIZE]
        prompt_lines = ["Rate each cluster's coherence:\n"]

        for cid in batch:
            c = clusters[cid]
            signals = c.get("topSignals", [])[:10]
            label = c.get("displayLabel", c.get("label", f"cluster-{cid}"))
            domain = c.get("domain", "Unknown")
            prompt_lines.append(f'Cluster {cid} [{domain}] "{label}":')
            prompt_lines.append(f'  Signals: {", ".join(signals)}')
            prompt_lines.append("")

        prompt_lines.append("Return JSON mapping cluster ID to {rating, reason}.")

        import re
        import time

        for attempt in range(3):
            try:
                response = client.messages.create(
                    model="claude-sonnet-4-20250514",
                    max_tokens=4096,
                    system=SYSTEM,
                    messages=[{"role": "user", "content": "\n".join(prompt_lines)}],
                )
                text = response.content[0].text.strip()
                if text.startswith("```"):
                    text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                if text.endswith("```"):
                    text = text.rsplit("```", 1)[0]
                text = re.sub(r'//[^\n]*', '', text)
                text = re.sub(r',\s*}', '}', text)
                parsed = json.loads(text.strip())

                for cid in batch:
                    entry = parsed.get(cid, parsed.get(str(cid), {}))
                    rating = entry.get("rating", 3) if isinstance(entry, dict) else (entry if isinstance(entry, int) else 3)
                    reason = entry.get("reason", "") if isinstance(entry, dict) else ""
                    c = clusters[cid]
                    ratings.append({
                        "id": cid,
                        "domain": c.get("domain", "Unknown"),
                        "label": c.get("displayLabel", c.get("label", "")),
                        "rating": int(rating),
                        "reason": reason,
                        "signals_shown": c.get("topSignals", [])[:10],
                    })

                done = min(i + BATCH_SIZE, len(remaining))
                print(f"  Rated {done}/{len(remaining)} clusters")
                break

            except json.JSONDecodeError:
                if attempt < 2:
                    time.sleep(1)
                else:
                    print(f"  Batch {i // BATCH_SIZE + 1}: JSON parse failed, using default ratings")
                    for cid in batch:
                        c = clusters[cid]
                        ratings.append({
                            "id": cid,
                            "domain": c.get("domain", "Unknown"),
                            "label": c.get("displayLabel", c.get("label", "")),
                            "rating": 3,
                            "reason": "auto-rating failed",
                            "signals_shown": c.get("topSignals", [])[:10],
                        })

            except Exception as e:
                if attempt < 2:
                    time.sleep(2)
                else:
                    print(f"  Batch error: {e}")
                    for cid in batch:
                        c = clusters[cid]
                        ratings.append({
                            "id": cid,
                            "domain": c.get("domain", "Unknown"),
                            "label": c.get("displayLabel", c.get("label", "")),
                            "rating": 3,
                            "reason": f"error: {e}",
                            "signals_shown": c.get("topSignals", [])[:10],
                        })

        time.sleep(0.5)

else:
    # ─── Interactive mode ───────────────────────────────────────────────────

    print(f"\nCoherence audit: {len(remaining)} clusters to rate")
    print(f"Rating scale: 5=perfect, 4=good, 3=okay, 2=weak, 1=incoherent")
    print(f"Type 'q' to save progress and quit, 's' to skip\n")

    for idx, cid in enumerate(remaining):
        c = clusters[cid]
        signals = c.get("topSignals", [])[:10]
        label = c.get("displayLabel", c.get("label", f"cluster-{cid}"))
        domain = c.get("domain", "Unknown")
        size = c.get("size", 0)

        print(f"─── [{idx + 1}/{len(remaining)}] Cluster {cid} ───")
        print(f"  Domain: {domain}")
        print(f"  Label: {label}")
        print(f"  Size: {size} signals")
        print(f"  Top signals:")
        for s in signals:
            print(f"    • {s.replace('-', ' ')}")
        print()

        while True:
            try:
                inp = input(f"  Rating (1-5, s=skip, q=quit): ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                inp = 'q'

            if inp == 'q':
                # Save state and exit
                state = {
                    "sample_ids": sample_ids,
                    "ratings": ratings,
                    "seed": seed,
                    "date": datetime.now().isoformat(),
                }
                with open(state_path, 'w') as f:
                    json.dump(state, f, indent=2)
                print(f"\nProgress saved to {state_path}")
                print(f"Resume with: python3 scripts/audit-cluster-coherence.py --resume")
                sys.exit(0)

            if inp == 's':
                print("  Skipped.\n")
                break

            try:
                rating = int(inp)
                if 1 <= rating <= 5:
                    ratings.append({
                        "id": cid,
                        "domain": domain,
                        "label": label,
                        "rating": rating,
                        "signals_shown": signals,
                    })
                    print()
                    break
                else:
                    print("  Please enter 1-5")
            except ValueError:
                print("  Please enter 1-5, 's' to skip, or 'q' to quit")

        # Auto-save state every 10 ratings
        if len(ratings) % 10 == 0:
            state = {
                "sample_ids": sample_ids,
                "ratings": ratings,
                "seed": seed,
                "date": datetime.now().isoformat(),
            }
            with open(state_path, 'w') as f:
                json.dump(state, f, indent=2)

# ─── Save results ───────────────────────────────────────────────────────────

if not ratings:
    print("No ratings collected.")
    sys.exit(0)

scores = [r["rating"] for r in ratings]
avg = sum(scores) / len(scores)

audit_result = {
    "date": datetime.now().isoformat(),
    "version": data.get("version", "unknown"),
    "clusters_rated": len(ratings),
    "clusters_total": len(clusters),
    "sample_seed": seed,
    "average_score": round(avg, 2),
    "distribution": {str(s): scores.count(s) for s in [1, 2, 3, 4, 5]},
    "method": "auto-claude" if args.auto else "manual",
    "ratings": ratings,
}

# Save JSON
audit_path = project_dir / f"cluster-coherence-audit-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
with open(audit_path, 'w') as f:
    json.dump(audit_result, f, indent=2)

# Save CSV
csv_path = audit_path.with_suffix('.csv')
with open(csv_path, 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['cluster_id', 'domain', 'label', 'rating', 'reason', 'top_signals'])
    for r in ratings:
        writer.writerow([
            r['id'], r['domain'], r['label'], r['rating'],
            r.get('reason', ''),
            ' | '.join(r.get('signals_shown', [])[:8]),
        ])

# Print summary
print(f"\n{'=' * 60}")
print(f"COHERENCE AUDIT COMPLETE")
print(f"{'=' * 60}")
print(f"  Clusters rated: {len(scores)}")
print(f"  Average score: {avg:.2f} / 5.0")
print(f"  Distribution:")
for score in [5, 4, 3, 2, 1]:
    count = scores.count(score)
    bar = '#' * count
    print(f"    {score}: {bar} ({count})")

# Domain breakdown
domain_scores = {}
for r in ratings:
    d = r.get("domain", "Unknown")
    domain_scores.setdefault(d, []).append(r["rating"])

print(f"\n  Domain averages:")
for d in sorted(domain_scores.keys()):
    ds = domain_scores[d]
    print(f"    {d:<16} {sum(ds)/len(ds):.2f}  (n={len(ds)})")

print(f"\n  Results saved to:")
print(f"    {audit_path}")
print(f"    {csv_path}")

# Clean up state file
if state_path.exists():
    state_path.unlink()
    print(f"  Cleaned up {state_path}")

print(f"\n  View report later with:")
print(f"    python3 scripts/audit-cluster-coherence.py --report {audit_path}")
