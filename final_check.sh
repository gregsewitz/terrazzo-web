#!/bin/bash

echo "=== FINAL COMPREHENSIVE CHECK ==="
echo ""
echo "Total page.tsx count:"
find src/app -name "page.tsx" -type f | wc -l

echo ""
echo "=== Checking if /discover/page.tsx is referenced ANYWHERE ==="
grep -r "discover" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "node_modules" | grep -v "DISCOVER_SYSTEM_PROMPT" | grep -v "constants/discover" | grep -v "DISCOVER_FEED" | head -20

echo ""
echo "=== Checking /api routes that might redirect to pages ==="
grep -r "redirect\|push\|href" src/app/api/ --include="*.ts" 2>/dev/null | head -20

echo ""
echo "=== SUMMARY OF ROUTES NOT FOUND IN SEARCHES ==="
echo "Routes that should have zero inbound links:"
echo "- /discover → only has redirect('/profile') inside it"
echo "- /saved/collection/[id] → NO references found"
