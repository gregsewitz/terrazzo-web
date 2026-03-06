#!/bin/bash
# Backfill script for Terrazzo PlaceIntelligence + SavedPlace data
# Runs Phase 4 in a loop until all records are processed, then Phase 3 to promote.

BASE_URL="https://www.terrazzo.travel/api/intelligence/backfill-google-data"
LIMIT=50
WAIT_SECONDS=300  # 5 minutes between batches

echo "=== Terrazzo Backfill Runner ==="
echo ""

# Phase 4 loop
BATCH=1
while true; do
  echo "[$(date '+%H:%M:%S')] Phase 4 — Batch #$BATCH (limit=$LIMIT)..."
  RESPONSE=$(curl -s -X POST "${BASE_URL}?phase=4&limit=${LIMIT}")

  # Extract triggered count from JSON response
  TRIGGERED=$(echo "$RESPONSE" | grep -o '"triggered":[0-9]*' | grep -o '[0-9]*')

  if [ -z "$TRIGGERED" ]; then
    echo "  Unexpected response: $RESPONSE"
    echo "  Stopping. Check the endpoint manually."
    exit 1
  fi

  echo "  Triggered: $TRIGGERED records"

  if [ "$TRIGGERED" -eq 0 ]; then
    echo ""
    echo "All Phase 4 records processed!"
    break
  fi

  BATCH=$((BATCH + 1))
  echo "  Waiting ${WAIT_SECONDS}s for pipeline to process..."
  sleep $WAIT_SECONDS
done

# Final Phase 3 — promote all synthesis to SavedPlace
echo ""
echo "[$(date '+%H:%M:%S')] Phase 3 — Final promotion of synthesis fields..."
RESPONSE=$(curl -s -X POST "${BASE_URL}?phase=3")
echo "  $RESPONSE"

echo ""
echo "=== Backfill complete! ==="
