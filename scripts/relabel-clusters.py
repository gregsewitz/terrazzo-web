#!/usr/bin/env python3
"""
LLM-powered cluster relabeling for Terrazzo signal clusters.

Reads the existing signal-clusters.json (produced by cluster-signals-v3.py),
sends each cluster's top signals to Claude, and replaces the mechanical
word-extraction labels with semantically meaningful 2-4 word labels.

This is the labeling step that was originally specified in the v3 design doc
(vector-v3-semantic-clustering.md, Step 4) but was never implemented — the
clustering script instead used alphabetically-sorted top-frequency words,
producing labels like "Bensley-Bill-architectural" or "fast-pressure-rapid".

Usage:
  export ANTHROPIC_API_KEY=sk-ant-...
  python3 scripts/relabel-clusters.py                    # dry-run: print proposed labels
  python3 scripts/relabel-clusters.py --apply            # overwrite signal-clusters.json
  python3 scripts/relabel-clusters.py --apply --audit    # also write audit CSV

Requires: pip install anthropic
"""

import json
import os
import sys
import time
import argparse
import csv
from pathlib import Path
from datetime import datetime

# ─── Configuration ──────────────────────────────────────────────────────────

MODEL = "claude-sonnet-4-20250514"
BATCH_SIZE = 20          # clusters per API call (fits comfortably in context)
MAX_RETRIES = 3
RETRY_DELAY = 2.0        # seconds between retries
RATE_LIMIT_DELAY = 0.5   # seconds between successful calls

# ─── Parse args ─────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Relabel signal clusters using Claude")
parser.add_argument('--apply', action='store_true',
                    help='Write relabeled clusters back to signal-clusters.json')
parser.add_argument('--audit', action='store_true',
                    help='Write before/after CSV for manual review')
parser.add_argument('--clusters-file', type=str, default=None,
                    help='Path to signal-clusters.json (auto-detected if omitted)')
parser.add_argument('--model', type=str, default=MODEL,
                    help=f'Claude model to use (default: {MODEL})')
args = parser.parse_args()

# ─── Load cluster data ──────────────────────────────────────────────────────

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
        print(f"Loaded clusters from {p}")
        break

if data is None:
    print("ERROR: Could not find signal-clusters.json")
    print("Run cluster-signals-v3.py first, or specify --clusters-file")
    sys.exit(1)

clusters = data.get("clusters", {})
print(f"Found {len(clusters)} clusters to relabel")

# ─── Initialize Anthropic client ────────────────────────────────────────────

api_key = os.environ.get("ANTHROPIC_API_KEY")
if not api_key:
    print("ERROR: ANTHROPIC_API_KEY not set")
    sys.exit(1)

try:
    import anthropic
except ImportError:
    print("ERROR: pip install anthropic")
    sys.exit(1)

client = anthropic.Anthropic(api_key=api_key)

# ─── Labeling prompt ────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a naming specialist for a taste intelligence system used in luxury travel.
Your job is to generate concise, evocative labels for signal clusters.

Each cluster contains semantically related signals extracted from hotel and restaurant reviews.
The signals describe specific qualities: design choices, atmosphere traits, service patterns, etc.

Rules for labels:
- 2-4 words maximum
- Capture the core CONCEPT the cluster represents, not just its most frequent word
- Use natural language that a sophisticated traveler would understand
- Avoid generic words like "quality", "experience", "style" unless they're genuinely the concept
- Avoid repeating the domain name (don't label an Atmosphere cluster "Atmospheric Lighting")
- If the cluster mixes positive and negative signals about the same topic, label the TOPIC neutrally
  (e.g., signals about both good and bad soundproofing → "Sound Isolation", not "Exceptional Soundproofing")
- Use title case
- No hyphens, no domain prefix — just the concept name

Examples:
  Signals: candlelit-atmosphere, candlelit-ambiance, candle-lit-atmosphere, candlelit-dining
  → "Candlelit Ambiance"

  Signals: remote-wilderness-isolation, nature-immersion-setting, multi-sensory-immersion
  → "Wilderness Immersion"

  Signals: synchronized-service-choreography, multi-server-choreography, rotating-server-model
  → "Choreographed Service"

  Signals: exceptional-soundproofing, poor-acoustic-isolation, noise-from-adjacent-rooms
  → "Sound Isolation"

  Signals: craft-cocktail-program, non-alcoholic-cocktail-program, afternoon-tea-program
  → "Beverage Programs"

  Signals: airport-transfer-included, complimentary-airport-transfer, private-water-taxi-arrival
  → "Arrival Transfers"
"""


def build_labeling_prompt(batch: list[dict]) -> str:
    """Build the user prompt for a batch of clusters."""
    lines = ["Label each cluster below. Return ONLY a JSON object mapping cluster ID to label.\n"]
    lines.append("```json")
    lines.append("{")

    for item in batch:
        cid = item["id"]
        domain = item["domain"]
        signals = item["signals"]
        signals_str = ", ".join(signals)
        lines.append(f'  // [{domain}] Top signals: {signals_str}')
        lines.append(f'  "{cid}": "",')

    lines.append("}")
    lines.append("```")
    lines.append("\nFill in each empty string with a 2-4 word label. Return valid JSON only, no markdown fences.")

    return "\n".join(lines)


# ─── Process clusters in batches ────────────────────────────────────────────

# Prepare batch items
batch_items = []
for cid in sorted(clusters.keys(), key=int):
    c = clusters[cid]
    batch_items.append({
        "id": cid,
        "domain": c.get("domain", "Unknown"),
        "signals": c.get("topSignals", [])[:12],  # top 12 signals for context
        "old_label": c.get("label", ""),
        "size": c.get("size", 0),
    })

# Split into batches
batches = []
for i in range(0, len(batch_items), BATCH_SIZE):
    batches.append(batch_items[i:i + BATCH_SIZE])

print(f"\nProcessing {len(batches)} batches of ~{BATCH_SIZE} clusters each")
print(f"Using model: {args.model}")
print()

new_labels = {}  # cid → new label
errors = []

for batch_idx, batch in enumerate(batches):
    prompt = build_labeling_prompt(batch)
    batch_cids = [item["id"] for item in batch]

    for attempt in range(MAX_RETRIES):
        try:
            response = client.messages.create(
                model=args.model,
                max_tokens=2048,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )

            # Extract text from response
            text = response.content[0].text.strip()

            # Strip markdown fences if Claude includes them despite instructions
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text.rsplit("```", 1)[0]
            text = text.strip()

            # Remove single-line JS comments that Claude might include
            import re
            text = re.sub(r'//[^\n]*', '', text)

            # Remove trailing commas before closing brace (common JSON issue)
            text = re.sub(r',\s*}', '}', text)

            parsed = json.loads(text)

            for cid in batch_cids:
                if cid in parsed and isinstance(parsed[cid], str) and len(parsed[cid].strip()) > 0:
                    new_labels[cid] = parsed[cid].strip()
                else:
                    errors.append((cid, "Missing or empty in response"))

            done = min((batch_idx + 1) * BATCH_SIZE, len(batch_items))
            print(f"  Batch {batch_idx + 1}/{len(batches)}: labeled {len(parsed)} clusters ({done}/{len(batch_items)} total)")
            break  # success

        except json.JSONDecodeError as e:
            if attempt < MAX_RETRIES - 1:
                print(f"  Batch {batch_idx + 1}: JSON parse error, retrying ({attempt + 1}/{MAX_RETRIES})...")
                time.sleep(RETRY_DELAY)
            else:
                print(f"  Batch {batch_idx + 1}: FAILED after {MAX_RETRIES} attempts: {e}")
                for cid in batch_cids:
                    errors.append((cid, f"JSON parse error: {e}"))

        except anthropic.RateLimitError:
            wait = RETRY_DELAY * (2 ** attempt)
            print(f"  Rate limited, waiting {wait}s...")
            time.sleep(wait)

        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                print(f"  Batch {batch_idx + 1}: Error, retrying ({attempt + 1}/{MAX_RETRIES}): {e}")
                time.sleep(RETRY_DELAY)
            else:
                print(f"  Batch {batch_idx + 1}: FAILED: {e}")
                for cid in batch_cids:
                    errors.append((cid, str(e)))

    time.sleep(RATE_LIMIT_DELAY)

# ─── Report results ─────────────────────────────────────────────────────────

print(f"\n{'=' * 60}")
print(f"Relabeling complete")
print(f"  Successfully labeled: {len(new_labels)}/{len(clusters)}")
print(f"  Errors: {len(errors)}")
print(f"{'=' * 60}")

# Show sample of before/after
print(f"\nSample relabeling (first 20):")
print(f"{'ID':>4}  {'Old Label':<45}  {'New Label':<30}  Size")
print(f"{'─' * 4}  {'─' * 45}  {'─' * 30}  {'─' * 4}")
for item in batch_items[:20]:
    cid = item["id"]
    old = item["old_label"]
    new = new_labels.get(cid, "*** FAILED ***")
    size = item["size"]
    print(f"{cid:>4}  {old:<45}  {new:<30}  {size}")

# ─── Write audit CSV ────────────────────────────────────────────────────────

if args.audit:
    audit_path = project_dir / f"cluster-relabel-audit-{datetime.now().strftime('%Y%m%d-%H%M%S')}.csv"
    with open(audit_path, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(["cluster_id", "domain", "size", "old_label", "new_label", "top_signals"])
        for item in batch_items:
            cid = item["id"]
            writer.writerow([
                cid,
                item["domain"],
                item["size"],
                item["old_label"],
                new_labels.get(cid, "ERROR"),
                " | ".join(item["signals"][:8]),
            ])
    print(f"\nAudit CSV saved to {audit_path}")

# ─── Apply labels ───────────────────────────────────────────────────────────

if args.apply:
    if len(new_labels) < len(clusters) * 0.9:
        print(f"\nWARNING: Only {len(new_labels)}/{len(clusters)} clusters were labeled.")
        print(f"Refusing to apply — too many failures. Fix errors and retry.")
        sys.exit(1)

    # Update cluster labels in the data structure
    relabeled_count = 0
    for cid, new_label in new_labels.items():
        if cid in data["clusters"]:
            # Store old label for reference
            old_label = data["clusters"][cid].get("label", "")
            # New label format: "Domain:new-label-hyphenated" for backward compat
            domain = data["clusters"][cid].get("domain", "Unknown")
            hyphenated = new_label.lower().replace(" ", "-")
            data["clusters"][cid]["label"] = f"{domain}:{hyphenated}"
            data["clusters"][cid]["displayLabel"] = new_label
            data["clusters"][cid]["oldLabel"] = old_label
            relabeled_count += 1

    # Bump version
    old_version = data.get("version", "v3.4")
    data["version"] = "v3.5"
    data["labeling"] = {
        "method": "claude-semantic",
        "model": args.model,
        "date": datetime.now().isoformat(),
        "previous_version": old_version,
        "clusters_relabeled": relabeled_count,
    }

    # Write to both locations
    output_paths = [
        project_dir / "signal-clusters.json",
        project_dir / "src" / "lib" / "taste-intelligence" / "signal-clusters.json",
    ]

    for out_path in output_paths:
        if out_path.exists():
            # Backup original
            backup_path = out_path.with_suffix(f".{old_version}.backup.json")
            if not backup_path.exists():
                import shutil
                shutil.copy2(out_path, backup_path)
                print(f"  Backed up {out_path.name} → {backup_path.name}")

            with open(out_path, 'w') as f:
                json.dump(data, f, indent=2)
            print(f"  Updated {out_path}")

    print(f"\nApplied {relabeled_count} new labels (version {old_version} → v3.5)")
    print(f"\nNext steps:")
    print(f"  1. Review the audit CSV (run with --audit if you haven't)")
    print(f"  2. Update humanize-label.ts to use displayLabel when available")
    print(f"  3. No vector recomputation needed — labels are metadata only")

else:
    print(f"\nDry run complete. To apply labels, run with --apply")
    print(f"  python3 scripts/relabel-clusters.py --apply --audit")

# ─── Report errors ──────────────────────────────────────────────────────────

if errors:
    print(f"\nErrors ({len(errors)}):")
    for cid, err in errors[:10]:
        print(f"  Cluster {cid}: {err}")
    if len(errors) > 10:
        print(f"  ... and {len(errors) - 10} more")
