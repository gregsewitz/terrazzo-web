#!/bin/bash

echo "=== SEARCHING FOR COLLECTION ROUTE REFERENCES ==="
grep -r "collection" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -E "(push|href|redirect|navigate)" | head -20

echo ""
echo "=== SEARCHING FOR ALL Link COMPONENTS WITH HREFS ==="
grep -r "Link" src/ --include="*.tsx" -A 2 2>/dev/null | grep -E "(href|to)" | head -20

echo ""
echo "=== SEARCHING FOR /discover REFERENCES ==="
grep -r "discover" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -E "(push|href|redirect|navigate|/discover)" | head -20

echo ""
echo "=== CHECKING APP ROOT PAGE ==="
grep -E "(router\.push|router\.replace|redirect)" /sessions/determined-laughing-euler/mnt/Claude\ Travel\ App/terrazzo-web/src/app/page.tsx

echo ""
echo "=== CHECKING DISCOVER PAGE ==="
cat /sessions/determined-laughing-euler/mnt/Claude\ Travel\ App/terrazzo-web/src/app/discover/page.tsx | head -50
