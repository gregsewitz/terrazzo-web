# Terrazzo Web — Code Review (Living Document)

**Reviewer:** Claude · March 2026
**Scope:** All source code in `src/`, config files, scripts, and project structure
**Standard:** Production-grade, zero-embarrassment codebase
**Last updated:** March 17, 2026

---

## 1. Architecture & Code Size

### 1a. 17MB JSON file in source tree
`src/lib/taste-intelligence/signal-clusters.json` is 17MB. This should be externalized (S3/CDN, database, or lazy-loaded at runtime), not shipped in the client bundle.

### 1b. Oversized components (>500 lines)
These need refactoring into smaller, focused sub-components:

| Component | Lines | Issue |
|-----------|-------|-------|
| `onboarding/RevealSequence.tsx` | 1,603 | Animation + data + UI interleaved |
| `saved/page.tsx` | 1,473 | Full page logic in one file |
| `TripMapView.tsx` | 1,364 | 40+ responsibilities, map + gestures + UI |
| `profile/ProfileDeepDive.tsx` | 1,332 | Long component tree |
| `profile/page.tsx` | 1,262 | Down from 1,833 — still has header + discover feed logic combined |
| `TripBriefing.tsx` | 1,020 | Briefing data + rendering combined |
| `DayBoardView.tsx` | 957 | Complex drag/drop + state |
| `BriefingView.tsx` | 835 | Multiple concerns |
| `PlaceDetailContent.tsx` | 744 | Intelligence + place data mixed |
| `DreamBoard.tsx` | 718 | Interaction + animation mixed |
| `UniversalAddBar.tsx` | 710 | All add-bar variants in one file |

### 1c. Oversized hooks
- `usePicksFilter.ts` — 30KB, ~750 lines. Should split filtering, sorting, and geo logic.
- `useConversationPhase.ts` — 29KB, ~680 lines. The SSE stream consumer alone is 250 lines and should be its own module.
- `useEmailReservations.ts` — 17KB, ~512 lines. Orchestrates too many concerns.

### 1d. Oversized API routes (>200 lines)
12 routes exceed 200 lines. The worst offenders:
- `profile/discover/route.ts` (556 lines) — Contains both RAG and legacy flows
- `profile/discover/more/route.ts` (518 lines) — 15 page configurations inline
- `intelligence/backfill-google-data/route.ts` (428 lines) — 6 distinct phases

### 1e. 70+ components at root level
`src/components/` has 70+ files dumped at the root with no feature-based organization. Trip-related components, place components, and UI primitives are all siblings.

### 1f. Oversized onboarding store
`src/stores/onboardingStore.ts` (682 lines) manages phases, signals, contradictions, sustainability, and more. Trip and saved stores properly use slice composition — onboarding should too.

---

## 2. Props Drilling & State Architecture

### 2a. Components with 20+ props
`DayPlanner.tsx` takes **40 props**. Others include `HotelInput.tsx` (30), `PlaceSearchInput.tsx` (30), `TerrazzoMosaic.tsx` (25), `TripMapView.tsx` (25). This makes the interface brittle. Trip interaction state and collaboration state should be lifted to React Context (like the existing `PlaceDetailContext` and `AuthContext`, which are well-designed but underutilized).

---

## 3. Type Safety

### 3a. ~280 remaining instances of `any`
The highest-impact ones to fix are in hooks and stores where `any` hides actual bugs. API route handlers use `any` heavily for Prisma results (unavoidable without generated types), but hooks and components should be properly typed.

---

## 4. Accessibility

### 4a. Aria label coverage improving, but still low
Added aria-labels to 8 critical icon buttons (search clear, panel collapse, share close, transport edit/remove, ghost dismiss, desktop nav). Coverage is now ~27 labels across ~650 elements (~4%). Continue adding labels to remaining icon buttons, especially in trip planner and place detail views.

### 4b. Non-semantic interactive elements
Multiple `<div onClick={}>` patterns used instead of `<button>`. Some mitigated with `role="button"` and `tabIndex`, but many are not.

---

## 5. Missing Infrastructure

### 5a. Low test coverage
Only ~2,600 lines of test code for ~91,000 lines of source. No e2e tests. Unit tests cover import pipeline, validation, and matching, but hooks, stores, and components are untested.

---

## 6. Inconsistent Patterns

### 6a. Cache headers inconsistent
74 of 86 API routes have no Cache-Control headers. `places/mine` uses `private, no-cache`, `places/autocomplete` uses `public, max-age=60`, `shared/[token]` uses `public, max-age=300`. A `cache-policy.ts` helper now exists — routes should adopt it.

---

## Priority Ranking

**Do this quarter:**
1. Refactor 1000+ line components into sub-components
2. Introduce feature-based component directory structure
3. Split oversized hooks and stores
4. Externalize 17MB signal-clusters.json
5. Adopt `cache-policy.ts` across all API routes
6. Continue accessibility improvements (aria labels, semantic HTML)
7. Add e2e tests for critical flows (onboarding, trip planning)
