#!/bin/bash
# Trigger V3 vector computation + rescore for all 4 test users
# Run from project root: bash scripts/trigger-test-vectors.sh

BASE_URL="https://www.terrazzo.travel"
CRON_SECRET="24413f859942a494450b010d1dd75ea523cffffb61eb8741ad8c07f2b4ff2636"

USERS=(
  "test-user-backpacker-foodie"
  "test-user-wilderness-wellness"
  "test-user-urban-culture"
  "test-user-family-resort"
)

echo "=== Debug: Testing endpoint connectivity ==="
echo "→ Testing taste-backfill endpoint..."
curl -sL -w "\nHTTP_STATUS: %{http_code}\n" -X POST "$BASE_URL/api/intelligence/taste-backfill" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -d '{"mode": "user", "userId": "test-user-backpacker-foodie"}' \
  --max-time 120
echo ""
echo "---"

echo "→ Testing rescore endpoint..."
curl -sL -w "\nHTTP_STATUS: %{http_code}\n" -X POST "$BASE_URL/api/intelligence/rescore" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -d '{"userId": "test-user-backpacker-foodie"}' \
  --max-time 120
echo ""
echo "---"

echo ""
echo "If both return 200, re-run with: bash scripts/trigger-test-vectors.sh --go"
echo ""

if [ "$1" == "--go" ]; then
  echo "=== Phase 1: Computing V3 vectors for each test user ==="
  for uid in "${USERS[@]}"; do
    echo "→ Computing vector for $uid..."
    curl -sL -w "\nHTTP_STATUS: %{http_code}\n" -X POST "$BASE_URL/api/intelligence/taste-backfill" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $CRON_SECRET" \
      -d "{\"mode\": \"user\", \"userId\": \"$uid\"}" \
      --max-time 120
    echo ""
  done

  echo "=== Phase 2: Rescoring all saved places for each test user ==="
  for uid in "${USERS[@]}"; do
    echo "→ Rescoring $uid..."
    curl -sL -w "\nHTTP_STATUS: %{http_code}\n" -X POST "$BASE_URL/api/intelligence/rescore" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $CRON_SECRET" \
      -d "{\"userId\": \"$uid\"}" \
      --max-time 300
    echo ""
  done

  echo "→ Rescoring real user..."
  curl -sL -w "\nHTTP_STATUS: %{http_code}\n" -X POST "$BASE_URL/api/intelligence/rescore" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $CRON_SECRET" \
    -d '{"userId": "cmlvca5sx000004lasyug8tqw"}' \
    --max-time 300

  echo ""
  echo "=== Done! ==="
fi
