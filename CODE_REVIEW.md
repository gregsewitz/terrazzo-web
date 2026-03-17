# Terrazzo Web — Code Review (Living Document)

**Reviewer:** Claude · March 2026
**Scope:** All source code in `src/`, config files, scripts, and project structure
**Standard:** Production-grade, zero-embarrassment codebase
**Last updated:** March 17, 2026 (evening)

---

## 1. Architecture & Code Size

### ~~1a. 17MB JSON file in source tree~~
**Done** — `signal-clusters.json` moved from `src/lib/taste-intelligence/` to `public/data/signal-clusters.json`. A new `signal-clusters-loader.ts` module loads it lazily from disk (via `fs.readFileSync`) on first use and caches the result for the process lifetime. All three import sites replaced: `vectors-v3.ts` now uses a `getClusterState()` lazy-init pattern, `queries-v3.ts` calls `getSignalClusterMap()` inline, and `taste-match-vectors.ts` uses the top-level import. `ALL_DOMAINS` converted from an eagerly-initialized module const to a `getAllDomains()` function, updating all callers. The JSON is no longer webpack-bundled (public/ files are served as static assets) and no longer parsed at module-load time.

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

## 2. Props Drilling & State Architecture ✅ Done

### 2a. Components with 20+ props ✅ Done
**Done.** Added `TripCollaborationContext` and `TripDragContext` to eliminate the two main drilling chains:

- **Collaboration props** (`suggestions`, `reactions`, `myRole`, `onRespondSuggestion`, `onAddReaction`) — were drilled page → DayPlanner → DayBoardView/TimeSlotCard (3 levels). Now provided via `TripCollaborationProvider` wrapped in `trips/[id]/page.tsx`; consumed directly via `useTripCollaboration()` in DayBoardView, TimeSlotCard, PlacedCard.

- **Drag props** (`dropTarget`, `dragItemId`, `onRegisterSlotRef`, `onDragStartFromSlot`, `onUnplace`) — were drilled page → DayPlanner → DayBoardView → TimeSlotCard → PlacedCard (4 levels). Now provided via `TripDragProvider`; consumed directly via `useTripDrag()` in DayBoardView, TimeSlotCard (self-registers its slot rect), PlacedCard.

- **`onTapDetail`** — replaced all interior prop chains with direct `usePlaceDetail().openDetail` calls in DayBoardView, TimeSlotCard, PlacedCard, TripBriefing, OverviewItinerary, and the `DayCard` sub-component in trip-briefing/sections. Dead `onTapDetail` prop removed from `DayContextBar`.

**Net result:** `DayPlanner` shrank from 19 props to **8** (viewMode, onSetViewMode, onOpenUnsorted, onOpenForSlot, onBack, onShare, onChat, onDelete). `DayBoardView` now takes **0 props** — reads everything from context. `TimeSlotCard` shrank from 18 props to **5**. `PlacedCard` shrank from 8 props to **4** (place, dayNumber, slotId, isDesktop, CARD_H, CARD_PX).

Context files added:
- `src/context/TripCollaborationContext.tsx`
- `src/context/TripDragContext.tsx`

---

## 3. Type Safety

### ~~3a. ~280 remaining instances of `any`~~
**Done** — Reduced from ~280 to 124 (all in API routes, accepted as unavoidable without Prisma-generated types). Outside API routes: 0 meaningful `any` remain. Fixed across 28+ files:
- **Hooks**: `useDiscoverFeed.ts` params typed as `OnboardingLifeContext | null` and `GeneratedTasteProfile | null`
- **Stores**: `mosaicSlice.ts` `apiFetch<GeneratedTasteProfile>`, `savedHydrationSlice.ts` enrichment confidence cast
- **Components (19 instances)**: All `PerriandIcon name={x as any}` → `x as PerriandIconName`; all `onSortChange` `as any` → typed union casts; `WebkitBoxOrient as any` → proper `React.CSSProperties` cast
- **Lib**: `taste-score.ts` params typed as `BriefingSignal[]`/`BriefingAntiSignal[]` + `explanation` typed as `MatchExplanation`; `anthropic.ts` returns `Promise<Anthropic.Message>`; `behavioral-patterns.ts` Prisma where clause typed; `discover-candidates.ts` implicit `any` removed; `taste-match-vectors.ts` Prisma JSON field cast to `Prisma.InputJsonValue`
- **Services**: `suggestionEngine.ts` JSON parse result typed as `Record<string, unknown>[]`
- **Admin page**: `taste-clusters/page.tsx` Chart.js CDN global typed via `WindowWithChart` interface; tooltip callbacks, chart instance, and afterDraw plugin all typed
- **vectors-v3.ts**: All `(cm as any).X` casts removed (now uses `SignalClusterMap` typed fields directly); `queries-v3.ts` `(r: any)` callbacks replaced with inferred types
- Remaining 2 outside API routes: one is a code comment, one is `stripMotionProps` (intentional with `// eslint-disable-next-line`)

---

## 4. Accessibility

### 4a. Aria label coverage improving
Added 25+ more aria-labels across DayPlanner, TimeSlotCard, DayBoardView, ChatSidebar, BaseSheet, PlaceTimeEditor, GhostCard, CollaboratorGhostCard. Cumulative coverage now ~52 labels. Remaining gaps: place detail sheets, onboarding, profile views.

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
1. ✅ Refactor 1000+ line components into sub-components
2. ✅ Introduce feature-based component directory structure
3. ✅ Split oversized hooks and stores
4. ✅ Externalize 17MB signal-clusters.json
5. ✅ Adopt `cache-policy.ts` across all API routes
6. ✅ Continue accessibility improvements (aria labels, semantic HTML)
7. Add e2e tests for critical flows (onboarding, trip planning)

**Remaining open items:**
- ✅ Fix ~280 `any` instances in hooks and stores
- `div onClick` → `<button>` semantic HTML conversions
- e2e tests for onboarding and trip planning critical flows
- ✅ Props drilling: lifted collaboration and drag state to TripCollaborationContext / TripDragContext; replaced onTapDetail drilling with direct usePlaceDetail() calls
