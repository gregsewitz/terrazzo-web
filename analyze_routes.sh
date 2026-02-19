#!/bin/bash

# Map page.tsx files to their route paths
declare -A routes=(
    ["src/app/page.tsx"]="/"
    ["src/app/discover/page.tsx"]="/discover"
    ["src/app/profile/page.tsx"]="/profile"
    ["src/app/saved/page.tsx"]="/saved"
    ["src/app/saved/collection/[id]/page.tsx"]="/saved/collection/"
    ["src/app/saved/shortlists/[id]/page.tsx"]="/saved/shortlists/"
    ["src/app/trips/page.tsx"]="/trips"
    ["src/app/trips/new/page.tsx"]="/trips/new"
    ["src/app/trips/[id]/page.tsx"]="/trips/"
    ["src/app/onboarding/page.tsx"]="/onboarding"
    ["src/app/onboarding/phase/[id]/page.tsx"]="/onboarding/phase/"
    ["src/app/onboarding/processing/page.tsx"]="/onboarding/processing"
    ["src/app/onboarding/reveal/page.tsx"]="/onboarding/reveal"
    ["src/app/onboarding/act1-complete/page.tsx"]="/onboarding/act1-complete"
)

# For each route, search for references
for file in "${!routes[@]}"; do
    route="${routes[$file]}"
    echo "=== $file → $route ==="
    
    # Search in src directory (excluding the file itself and node_modules)
    grep -r "$route" src/ --include="*.tsx" --include="*.ts" --include="*.jsx" --include="*.js" 2>/dev/null | grep -v "^$file:" | head -20
    
    echo ""
done
