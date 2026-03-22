#!/bin/bash

echo "=== VERIFICATION: Double-checking orphaned routes ==="
echo ""
echo "ORPHANED ROUTE #1: /discover"
echo "Checking discover/page.tsx:"
cat src/app/discover/page.tsx
echo ""
echo "Grep for any push/replace/href to /discover:"
grep -r "discover" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -E "push|replace|href" | grep "/discover" || echo "✓ No inbound links found"

echo ""
echo "=== ORPHANED ROUTE #2: /saved/collection/[id]"
echo "Checking if file exists:"
ls -la src/app/saved/collection/[id]/page.tsx
echo ""
echo "Grep for any push/replace/href to collection:"
grep -r "collection" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -E "push|replace|href" | grep "collection" || echo "✓ No inbound links found"
