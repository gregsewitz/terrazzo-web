# Terrazzo Web — Code Review (Living Document)

**Reviewer:** Claude · March 2026
**Scope:** All source code in `src/`, config files, scripts, and project structure
**Standard:** Production-grade, zero-embarrassment codebase
**Last updated:** March 17, 2026

---

## 1. Hardcoded Values (Centralize)

### 1a. Magic numbers in timeouts, thresholds, and limits
Examples: email confidence threshold `0.4`, taste drift threshold `0.02`, rate limit delay `250ms`, orphan sweep exponential backoff `2/4/8/16/32 days`, cluster domain ranges `0-50, 51-135`, etc. These should live in a constants file or at minimum be named constants at the top of each file.

---

## 2. Duplicated Logic (Extract & Share)

### 2a. Three different auth patterns
Routes use three inconsistent approaches: (A) direct `getUser()` calls, (B) `authHandler` wrapper, (C) `apiHandler` + `getUser()`. Pick one and standardize.

---

## 3. Dead Code & Orphaned Files

### 3a. Stale TODO comments
8 TODO/FIXME comments across the codebase, some with unclear timelines:
- `ImportDrawer.tsx`: "TODO: Migrate trip planner import to use UAB with tripContext, then remove this file"
- `BriefingView.tsx`: "TODO: pass from SavedPlace when available (rhythmTempo)"
- `collaborative-filtering.ts`: Two "TODO: Implement when we have enough data/embeddings" stubs
- `constants/onboarding/act-structure.ts` and `phase-definitions.ts`: "TODO: re-enable once Gmail email parsing surfaces real places"

---

## 4. Architecture & Code Size

### 4a. 17MB JSON file in source tree
`src/lib/taste-intelligence/signal-clusters.json` is 17MB. This should be externalized (S3/CDN, database, or lazy-loaded at runtime), not shipped in the client bundle.

### 4b. Oversized components (>500 lines)
These need refactoring into smaller, focused sub-components:

| Component | Lines | Issue |
|-----------|-------|-------|
| `profile/page.tsx` | 1,262 | Down from 1,833 — still has header + discover feed logic combined |
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

### 4c. Oversized hooks
- `usePicksFilter.ts` — 30KB, ~750 lines. Should split filtering, sorting, and geo logic.
- `useConversationPhase.ts` — 29KB, ~680 lines. The SSE stream consumer alone is 250 lines and should be its own module.
- `useEmailReservations.ts` — 17KB, ~512 lines. Orchestrates too many concerns.

### 4d. Oversized API routes (>200 lines)
12 routes exceed 200 lines. The worst offenders:
- `profile/discover/route.ts` (554 lines) — Contains both RAG and legacy flows
- `profile/discover/more/route.ts` (518 lines) — 15 page configurations inline
- `intelligence/backfill-google-data/route.ts` (428 lines) — 6 distinct phases

### 4e. 70+ components at root level
`src/components/` has 70+ files dumped at the root with no feature-based organization. Trip-related components, place components, and UI primitives are all siblings.

### 4f. Oversized onboarding store
`src/stores/onboardingStore.ts` (682 lines) manages phases, signals, contradictions, sustainability, and more. Trip and saved stores properly use slice composition — onboarding should too.

---

## 5. Props Drilling & State Architecture

### 5a. Components with 20+ props
`DayPlanner.tsx` takes **40 props**. Others include `HotelInput.tsx` (30), `PlaceSearchInput.tsx` (30), `TerrazzoMosaic.tsx` (25), `TripMapView.tsx` (25). This makes the interface brittle. Trip interaction state and collaboration state should be lifted to React Context (like the existing `PlaceDetailContext` and `AuthContext`, which are well-designed but underutilized).

---

## 6. Type Safety

### 6a. 286 instances of `any`
Spread across the codebase. The highest-impact ones to fix are in hooks and stores where `any` hides actual bugs. API route handlers use `any` heavily for Prisma results (unavoidable without generated types), but hooks and components should be properly typed.

### 6b. `catch (err: any)` throughout
Should be `catch (err: unknown)` with type guards. Found in `anthropic.ts`, `useConversationPhase.ts`, and multiple API routes.

---

## 7. N+1 Queries & Performance

### 7a. N+1 in import/file route
`src/app/api/import/file/route.ts` lines 309-335 — Loops through places, calling `prisma.savedPlace.findFirst()` inside the loop. Should batch with `findMany` and a single `WHERE IN`.

---

## 8. Accessibility

### 8a. Aria label coverage: ~2.8%
Only 19 `aria-label`/`aria-labelledby` instances across ~650 interactive elements. Most icon buttons (using the Perriand icon system) have no accessible labels.

### 8b. Missing alt text on images
At least 4 `<img>` tags without `alt` attributes found in `TripBriefing.tsx`, `RevealSequence.tsx`, and `VisualTasteView.tsx`.

### 8c. Non-semantic interactive elements
Multiple `<div onClick={}>` patterns used instead of `<button>`. Some mitigated with `role="button"` and `tabIndex`, but many are not.

---

## 9. Missing Infrastructure

### 9a. No CI/CD configuration
No GitHub Actions, no Vercel config, no deployment pipeline visible.

### 9b. Low test coverage
Only ~2,600 lines of test code for ~91,000 lines of source. No e2e tests. Unit tests cover import pipeline, validation, and matching, but hooks, stores, and components are untested.

---

## 10. Inconsistent Patterns

### 10a. Error response format varies by route
Some return `{ error: "..." }` with status 400, others return `{ results: [] }` (silent failure), others throw. Standardize on a single error envelope.

### 10b. Cache headers inconsistent
`places/mine` uses `private, no-cache`, `places/autocomplete` uses `public, max-age=60`, `shared/[token]` uses `public, max-age=300`. No central cache policy.

### 10c. Feature flags hard-wired
`profile/discover/route.ts` has a RAG-to-legacy fallback with no feature flag. These should be configurable without a deploy.

---

## Priority Ranking

**Do this quarter:**
1. Refactor 1000+ line components into sub-components
2. Introduce feature-based component directory structure
3. Split oversized hooks and stores
4. Externalize 17MB signal-clusters.json
5. Standardize auth and error patterns
6. Improve accessibility (aria labels, alt text, semantic HTML)
7. Add e2e tests for critical flows (onboarding, trip planning)
