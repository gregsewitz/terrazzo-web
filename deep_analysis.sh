#!/bin/bash

echo "=== SEARCH FOR NEXT/LINK IMPORTS AND USAGE ==="
grep -r "from 'next/link'" src/ --include="*.tsx" --include="*.ts" 2>/dev/null
grep -r 'import.*Link' src/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -i next

echo ""
echo "=== SEARCH FOR ALL router.push/replace CALLS ==="
grep -r "router\.\(push\|replace\)" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | sort

echo ""
echo "=== SEARCH FOR redirect() CALLS ==="
grep -r "redirect(" src/ --include="*.tsx" --include="*.ts" 2>/dev/null

echo ""
echo "=== SEARCH FOR SAVED/COLLECTION IN ALL FILES ==="
grep -r "saved/collection" src/ --include="*.tsx" --include="*.ts" --include="*.js" 2>/dev/null

echo ""
echo "=== CHECK PROFILE PAGE FOR NAVIGATION ==="
grep -E "(router\.|redirect\(|href)" /sessions/determined-laughing-euler/mnt/Claude\ Travel\ App/terrazzo-web/src/app/profile/page.tsx | head -10
