#!/bin/bash
# Backfill photo URLs for places missing them
# Processes batches of 20, stops when done

BASE_URL="${1:-https://www.terrazzo.travel}"

echo "Photo backfill — target: $BASE_URL"
echo "Checking current state..."
curl -s "$BASE_URL/api/places/backfill-photos" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/places/backfill-photos"
echo ""

while true; do
  RESULT=$(curl -s -X POST "$BASE_URL/api/places/backfill-photos" \
    -H "Content-Type: application/json" \
    -d '{"limit": 20}')

  UPDATED=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('updated',0))" 2>/dev/null)
  ERRORS=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('errors',0))" 2>/dev/null)
  REMAINING=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('remaining',0))" 2>/dev/null)
  DONE=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('done',False))" 2>/dev/null)

  echo "Updated: $UPDATED | Errors: $ERRORS | Remaining: $REMAINING"

  if [ "$DONE" = "True" ] || [ "$REMAINING" = "0" ]; then
    echo "Done!"
    break
  fi

  sleep 1
done
