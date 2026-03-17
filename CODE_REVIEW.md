# Terrazzo Web — Code Review (Living Document)

**Reviewer:** Claude · March 2026
**Scope:** All source code in `src/`, config files, scripts, and project structure
**Standard:** Production-grade, zero-embarrassment codebase
**Last updated:** March 17, 2026

---

## Completed

The following issues have been resolved:

- ~~**1a.** Admin taste dashboard auth~~ — Added ADMIN_SECRET bearer token check
- ~~**1b.** SQL injection in backfill-photos LIMIT~~ — Switched to parameterized query
- ~~**1c.** No env validation~~ — Created `src/lib/env.ts` with fail-fast startup validation
- ~~**1e.** Fire-and-forget silent failures~~ — 16 silent `.catch(() => {})` replaced with `console.warn`
- ~~**2a.** Claude model strings scattered~~ — Centralized in `src/lib/models.ts`, all 14 files updated
- ~~**3a.** Haversine distance duplicated~~ — Extracted to `src/lib/geo.ts`, both hooks updated
- ~~**4a.** Orphaned components~~ — Deleted AddPlaceInline, PoolItemCard, SmartCollectionSheet + 7 more
- ~~**4b.** Deprecated import/maps route~~ — Deleted

---

## 1. Security & Auth

### 1a. Missing rate limiting on 3 remaining endpoints
Rate limiting was added to `places/autocomplete`, `places/search`, `email/reservations`, and `email/reservations/batch-dismiss`. These still need it:
- `/api/email/webhooks/nylas/route.ts` (webhook, high volume)
- `/api/import/file/route.ts` (CPU-heavy, Claude vision)
- `/api/import/route.ts` (CPU-heavy, Claude extraction)

---

## 2. Hardcoded Values (Centralize)

### 2a. Magic numbers in timeouts, thresholds, and limits
Examples: email confidence threshold `0.4`, taste drift threshold `0.02`, rate limit delay `250ms`, orphan sweep exponential backoff `2/4/8/16/32 days`, cluster domain ranges `0-50, 51-135`, etc. These should live in a constants file or at minimum be named constants at the top of each file.

### 2b. Hardcoded webhook URL
`src/app/api/email/webhooks/register/route.ts` line 64 — Webhook callback URL is a string literal. Should come from env var.

---

## 3. Duplicated Logic (Extract & Share)

### 3a. Place resolution logic duplicated 3x
`src/app/api/email/reservations/backfill-places/route.ts`, `email/reservations/batch-confirm/route.ts`, and `email/parse/route.ts` all contain near-identical Google Places resolution + enrichment logic. Extract to a shared `resolveAndEnrichPlace()` utility.

### 3b. Taste matching computation duplicated
`src/app/api/intelligence/enrichment-complete/route.ts` lines 171-224 and `src/app/api/places/resolve/route.ts` lines 189-217 contain nearly identical vector vs. signal scoring logic.

### 3c. Fresh pick resolution duplicated
`src/app/api/profile/discover/more/route.ts` and `profile/discover/route.ts` both contain `resolveFreshPicks` implementations.

### 3d. Three different auth patterns
Routes use three inconsistent approaches: (A) direct `getUser()` calls, (B) `authHandler` wrapper, (C) `apiHandler` + `getUser()`. Pick one and standardize.

---

## 4. Dead Code & Orphaned Files

### 4a. Root-level design artifacts polluting the repo
10+ `.docx` and `.pptx` files at the project root (`Terrazzo_Brand_Identity_Guide.pptx`, `Terrazzo_Customer_Personas.docx`, etc.), plus 4 HTML preview files (`brand-pattern-preview.html`, `color-scheme-comparison.html`, `place-card-concepts.html`, `preview-intelligence-components.html`). Move to a `/docs` directory or a separate repo.

### 4b. Duplicate brand guide
Both `Terrazzo_Brand_Identity_Guide.pptx` and `Terrazzo_Brand_Identity_Guide_v2.pptx` exist at the root. Pick one.

### 4c. Stale TODO comments
8 TODO/FIXME comments across the codebase, some with unclear timelines:
- `ImportDrawer.tsx`: "TODO: Migrate trip planner import to use UAB with tripContext, then remove this file"
- `BriefingView.tsx`: "TODO: pass from SavedPlace when available (rhythmTempo)"
- `collaborative-filtering.ts`: Two "TODO: Implement when we have enough data/embeddings" stubs
- `constants/onboarding/act-structure.ts` and `phase-definitions.ts`: "TODO: re-enable once Gmail email parsing surfaces real places"

---

## 5. Architecture & Code Size

### 5a. 17MB JSON file in source tree
`src/lib/taste-intelligence/signal-clusters.json` is 17MB. This should be externalized (S3/CDN, database, or lazy-loaded at runtime), not shipped in the client bundle.

### 5b. Oversized components (>500 lines)
These need refactoring into smaller, focused sub-components:

| Component | Lines | Issue |
|-----------|-------|-------|
| `profile/page.tsx` | 1,833 | Largest file in the codebase; multiple responsibilities |
| `onboarding/RevealSequence.tsx` | 1,603 | Animation + data + UI interleaved |
| `saved/page.tsx` | 1,473 | Full page logic in one file |
| `TripMapView.tsx` | 1,364 | 40+ responsibilities, map + gestures + UI |
| `profile/ProfileDeepDive.tsx` | 1,332 | Long component tree |
| `TripBriefing.tsx` | 1,020 | Briefing data + rendering combined |
| `DayBoardView.tsx` | 957 | Complex drag/drop + state |
| `BriefingView.tsx` | 835 | Multiple concerns |
| `PlaceDetailContent.tsx` | 744 | Intelligence + place data mixed |
| `DreamBoard.tsx` | 718 | Interaction + animation mixed |
| `UniversalAddBar.tsx` | 710 | All add-bar variants in one file |

### 5c. Oversized hooks
- `usePicksFilter.ts` — 30KB, ~750 lines. Should split filtering, sorting, and geo logic.
- `useConversationPhase.ts` — 29KB, ~680 lines. The SSE stream consumer alone is 250 lines and should be its own module.
- `useEmailReservations.ts` — 17KB, ~512 lines. Orchestrates too many concerns.

### 5d. Oversized API routes (>200 lines)
12 routes exceed 200 lines. The worst offenders:
- `profile/discover/route.ts` (554 lines) — Contains both RAG and legacy flows
- `profile/discover/more/route.ts` (518 lines) — 15 page configurations inline
- `intelligence/backfill-google-data/route.ts` (428 lines) — 6 distinct phases

### 5e. 70+ components at root level
`src/components/` has 70+ files dumped at the root with no feature-based organization. Trip-related components, place components, and UI primitives are all siblings.

### 5f. Oversized onboarding store
`src/stores/onboardingStore.ts` (682 lines) manages phases, signals, contradictions, sustainability, and more. Trip and saved stores properly use slice composition — onboarding should too.

---

## 6. Props Drilling & State Architecture

### 6a. Components with 20+ props
`DayPlanner.tsx` takes **40 props**. Others include `HotelInput.tsx` (30), `PlaceSearchInput.tsx` (30), `TerrazzoMosaic.tsx` (25), `TripMapView.tsx` (25). This makes the interface brittle. Trip interaction state and collaboration state should be lifted to React Context (like the existing `PlaceDetailContext` and `AuthContext`, which are well-designed but underutilized).

---

## 7. Type Safety

### 7a. 286 instances of `any`
Spread across the codebase. The highest-impact ones to fix are in hooks and stores where `any` hides actual bugs. API route handlers use `any` heavily for Prisma results (unavoidable without generated types), but hooks and components should be properly typed.

### 7b. `catch (err: any)` throughout
Should be `catch (err: unknown)` with type guards. Found in `anthropic.ts`, `useConversationPhase.ts`, and multiple API routes.

### 7c. `sessionStorage` accessed without SSR guard
`src/hooks/usePlaceResolver.ts` — Direct `sessionStorage.setItem()` without `typeof window !== 'undefined'` check. Will throw during SSR.

---

## 8. N+1 Queries & Performance

### 8a. N+1 in import/file route
`src/app/api/import/file/route.ts` lines 309-335 — Loops through places, calling `prisma.savedPlace.findFirst()` inside the loop. Should batch with `findMany` and a single `WHERE IN`.

### 8b. N+1 in email reservations route
`src/app/api/email/reservations/route.ts` — Returns all reservations then runs separate COUNT queries for each status group. Should use `_count` aggregation in the initial query.

---

## 9. Accessibility

### 9a. Aria label coverage: ~2.8%
Only 19 `aria-label`/`aria-labelledby` instances across ~650 interactive elements. Most icon buttons (using the Perriand icon system) have no accessible labels.

### 9b. Missing alt text on images
At least 4 `<img>` tags without `alt` attributes found in `TripBriefing.tsx`, `RevealSequence.tsx`, and `VisualTasteView.tsx`.

### 9c. Non-semantic interactive elements
Multiple `<div onClick={}>` patterns used instead of `<button>`. Some mitigated with `role="button"` and `tabIndex`, but many are not.

---

## 10. Missing Infrastructure

### 10a. No `.env.example`
22 env vars with no documentation of which are required vs. optional.

### 10b. No CI/CD configuration
No GitHub Actions, no Vercel config, no deployment pipeline visible.

### 10c. No `.nvmrc` / Node version pinning
Different developers may use different Node versions.

### 10d. No Prettier config
Only ESLint. Formatting inconsistencies will creep in as the team grows.

### 10e. Low test coverage
Only ~2,600 lines of test code for ~91,000 lines of source. No e2e tests. Unit tests cover import pipeline, validation, and matching, but hooks, stores, and components are untested.

### 10f. No per-page error boundaries
Only a global `src/app/error.tsx`. Pages like `places/[googlePlaceId]`, `saved/`, and trip views should have their own error boundaries to prevent full-app crashes.

---

## 11. Inconsistent Patterns

### 11a. Error response format varies by route
Some return `{ error: "..." }` with status 400, others return `{ results: [] }` (silent failure), others throw. Standardize on a single error envelope.

### 11b. Cache headers inconsistent
`places/mine` uses `private, no-cache`, `places/autocomplete` uses `public, max-age=60`, `shared/[token]` uses `public, max-age=300`. No central cache policy.

### 11c. Feature flags hard-wired
`profile/discover/route.ts` has a RAG-to-legacy fallback with no feature flag. These should be configurable without a deploy.

### 11d. In-memory cache uses FIFO, not LRU
`src/lib/places-cache.ts` evicts the oldest inserted entry, not the least recently used. For a cache, LRU is almost always more appropriate.

---

## Priority Ranking

**Do this sprint:**
1. Add rate limiting to remaining 3 unprotected routes
2. Extract duplicated place resolution logic
3. Extract duplicated taste matching logic
4. Fix `sessionStorage` SSR guard
5. Add `.env.example`

**Do this quarter:**
6. Refactor 1000+ line components into sub-components
7. Introduce feature-based component directory structure
8. Split oversized hooks and stores
9. Externalize 17MB signal-clusters.json
10. Standardize auth, error, and cache patterns
11. Improve accessibility (aria labels, alt text, semantic HTML)
12. Add e2e tests for critical flows (onboarding, trip planning)
13. Move design docs out of repo root
