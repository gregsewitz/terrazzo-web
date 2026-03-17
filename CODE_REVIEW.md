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
| ~~`onboarding/RevealSequence.tsx`~~ | ~~1,603~~ → 311 | **Split** — 13 card components + shared primitives extracted to `components/onboarding/reveal/` |
| ~~`saved/page.tsx`~~ | ~~1,473~~ → 698 | **Split** — PlaceCard, CreateCollectionModal, AddToTripSheet extracted to `components/saved/` |
| ~~`TripMapView.tsx`~~ | ~~1,364~~ → 757 | **Split** — 5 card components + shared types extracted to `components/trip-map/` |
| ~~`profile/ProfileDeepDive.tsx`~~ | ~~1,332~~ → 64 | **Split** — 15 section components extracted to `profile/sections.tsx` |
| ~~`profile/page.tsx`~~ | ~~1,262~~ → 705 | **Split** — `useDiscoverFeed` hook + `SettingsPanel` component extracted |
| ~~`TripBriefing.tsx`~~ | ~~1,020~~ → 335 | **Split** — helpers, `useBriefingData` hook, 7 section components extracted to `trip-briefing/` |
| ~~`DayBoardView.tsx`~~ | ~~957~~ → 768 | **Split** — `PlacedCard` + `SlotContainer` extracted to `day-board/` |
| ~~`BriefingView.tsx`~~ | ~~835~~ → 654 | **Split** — 6 sub-components + helper extracted to `briefing-view/cards.tsx` |
| ~~`PlaceDetailContent.tsx`~~ | ~~744~~ → 651 | **Split** — data-fetching logic extracted to `usePlaceDetailData` hook |
| ~~`DreamBoard.tsx`~~ | ~~718~~ → 312 | **Split** — helpers + 3 sub-components extracted to `dream-board/` |
| ~~`UniversalAddBar.tsx`~~ | 710 | **Already split** — 5 sub-components in `add-bar/`; orchestrator is dense but appropriate |

### 1c. Oversized hooks
- ~~`usePicksFilter.ts`~~ — **Split** (750 → 355 lines). Pure destination-matching functions extracted to `lib/destination-matching.ts` (333 lines).
- ~~`useConversationPhase.ts`~~ — **Split** (692 → 415 lines). `splitSentences` and `consumeRespondStream` extracted to `lib/sse-stream-consumer.ts` (299 lines).
- `useEmailReservations.ts` — 512 lines. Reviewed: already well-factored with pure logic in `lib/email-reservations-helpers.ts`. Remaining lines are tightly coupled React state — no further extraction worthwhile.

### 1d. Oversized API routes (>200 lines)
12 routes exceed 200 lines. The worst offenders:
- `profile/discover/route.ts` (556 lines) — Contains both RAG and legacy flows
- `profile/discover/more/route.ts` (518 lines) — 15 page configurations inline
- `intelligence/backfill-google-data/route.ts` (428 lines) — 6 distinct phases

### ~~1e. 70+ components at root level~~
**Done** — `src/components/` reorganized into feature directories: `trip/` (21 files), `place/` (15 files), `library/` (6 files), `maps/` (3 files), `chat/` (5 files), plus additions to `ui/`, `profile/`, `add-bar/`, `import/`. Zero files remain at root.

### ~~1f. Oversized onboarding store~~
**Done** — `onboardingStore.ts` split into 4 slices in `stores/onboarding/`: `progressSlice.ts` (205 lines), `profileSlice.ts` (186 lines), `contextSlice.ts` (113 lines), `mosaicSlice.ts` (111 lines). Orchestrator reduced from 682 to 165 lines.

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

### ~~6a. Cache headers inconsistent~~
**Done** — Applied `cache-policy.ts` to 13 previously uncached GET routes (email, places, trips collaboration, intelligence, import history). All user-data routes now return `private, no-cache`. Public/shared routes retain their existing long-cache headers.

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
