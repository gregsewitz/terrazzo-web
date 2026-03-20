# Terrazzo First-Run Experience Strategy

**Purpose:** Map out a best-in-class post-onboarding experience that reduces friction, communicates features, and creates sticky engagement from the first session forward.

**Audience for this plan:** Friends & family alpha testers

**Current state:** The taste profiling onboarding (29 phases, 3 acts) is built and working. The gap is what happens *after* — when a user completes the taste reveal and lands in the actual product for the first time.

---

## The Problem Today

After completing an impressive, deeply personal taste profiling experience, the user hits `/trips` and the magic abruptly stops. Specifically:

- **No guided transition** from the reveal into the product. The emotional high of learning your archetype ("The Aesthetic Pilgrim") evaporates the moment you land on a trips list.
- **No feature discovery.** Three core sections (Plan, Collect, Discover) with no indication of what each does or why it matters.
- **Sparse seed content.** Only dream-destination seed trips are created — no saved places, no collections, no library content. The Collect tab says "No saved places yet."
- **No clear first action.** Users don't know what to do next. The most valuable action (exploring their Discover feed, which is already personalized) is buried behind a profile avatar tap.
- **No progressive disclosure.** Every feature is equally (in)visible from day one.

The result: a user who just had a 10-minute intimate conversation about their taste is dropped into an empty shell and left to figure it out. That's the opposite of sticky.

---

## Design Principles

These five principles should govern every first-run decision:

1. **Continue the conversation.** The onboarding established a warm, personal tone. The first-run experience should feel like Terrazzo is still talking to you — not like you've been handed an empty app.

2. **Show, don't tour.** No 5-step tooltip overlays. Instead, use *content as onboarding* — pre-populated, personalized content that teaches by existing. The best feature discovery is a feature already working for you.

3. **One clear next action.** At every point, the user should know exactly what Terrazzo wants them to do next. Not three CTAs — one.

4. **Reward the investment.** Users just spent 10+ minutes profiling their taste. The first thing they see should prove it was worth it — personalized recommendations, a taste-matched place, their archetype reflected back.

5. **Progressive revelation.** Don't show everything at once. Introduce features as they become relevant, not on day one.

---

## Navigation Restructure

A prerequisite for the first-run experience: **Discover becomes its own top-level page**, not a tab inside Profile. This is the single most important information architecture change — it puts Terrazzo's strongest feature (personalized recommendations) at the front door instead of burying it behind a profile avatar.

### New Tab Bar (5 tabs, UAB centered)

```
  Discover  |  Collect  |  [+]  |  Plan  |  Profile
```

| Tab | Route | Purpose |
|-----|-------|---------|
| **Discover** | `/discover` | Personalized place feed + Evolving Welcome. The default landing page for new and returning users. |
| **Collect** | `/saved` | Place library + collections. Where taste becomes tangible. |
| **+ (UAB)** | Modal overlay | Universal Add Bar — search, paste links, import. Stays centered as the constant action anchor. |
| **Plan** | `/trips` | Trip list + trip detail. Where collections become itineraries. |
| **Profile** | `/profile` | Taste identity only — archetype, mosaic, radar chart, deep dive, settings, resynthesis. No more Discover/My Profile tab toggle. |

### Why This Matters

The current architecture has Discover as a tab *inside* Profile, which means:
- Users have to know to tap their avatar, then be on the "Discover" tab (which is the default, but still requires navigation)
- The best content in the app is 2 taps away from any other screen
- Profile does double duty: "who you are" + "what we recommend" — two different jobs

Splitting them means:
- **Discover** is the front door. It's where users land after the Bridge flow, and where they return on every visit. The Evolving Welcome lives here.
- **Profile** becomes purely about taste identity — archetype, mosaic, radar chart, signal deep-dive, settings. A clean, reflective space.
- The user's mental model maps cleanly: *Discover → find places / Collect → save places / Plan → organize trips / Profile → understand your taste*

### Implementation Notes

- **Routing:** Create `/src/app/(main)/discover/page.tsx` — extract the current Discover tab content from `/src/app/profile/page.tsx` and the `useDiscoverFeed` hook.
- **Profile simplification:** `/src/app/profile/page.tsx` drops the Discover/My Profile toggle. It shows the taste deep dive, settings, and action buttons (Replay Dossier, Expand Mosaic) directly.
- **TabBar update:** `TabBar.tsx` and `DesktopNav.tsx` get a 5th tab. The UAB button remains the center element with its distinctive circular styling.
- **Default route:** After the Bridge flow, redirect to `/discover` instead of `/trips`. On return visits, land on `/discover` as well.
- **Desktop nav:** Same 5 sections. Discover gets the leftmost position (or the logo could route to `/discover` instead of `/trips`).

---

## The First-Run Journey (Proposed)

### Phase 1: The Bridge (Reveal → Home)

**What it is:** A 3-screen transitional moment between the taste reveal and the main app that converts emotional energy into product understanding.

**Current state:** Reveal completes → hard redirect to `/trips`.

**Proposed flow:**

**Screen 1 — "Your Terrazzo is Ready"**
A full-screen moment that bridges the reveal into the product. Shows the user's archetype name and a single personalized place recommendation with its match tier badge (e.g., "Strong match"). Copy like: *"We found 47 places that match your taste. Here's one to start."* Single CTA: "Explore Your Terrazzo."

**Screen 2 — "Three Ways to Use Terrazzo"**
A brief, visual orientation (not a tooltip tour) showing the three core sections with one-line descriptions and a small preview of what's waiting in each:

- **Discover** — "Places chosen for your taste, updated weekly." (Show 1 place card preview)
- **Collect** — "Save places, build collections, import from anywhere." (Show a starter collection)
- **Plan** — "Turn collections into trips with day-by-day planning." (Show the seed trip)

This screen uses the same animation language as the onboarding — it feels like part of the same experience, not a product tour bolted on.

**Screen 3 — "Your First Move"**
A single, clear action prompt based on what makes the most sense for this user:

- If they mentioned a specific upcoming trip → "Start planning [Trip Name]"
- If they have dream destinations → "Explore places in [Dream Destination]"
- Default → "See what we found for you" (→ Discover feed)

**Why this works:** It maintains emotional continuity, teaches the app's structure without feeling like a tour, and channels the user into one clear action. Best-in-class examples: Spotify Wrapped → playlist transition, Arc browser's onboarding-to-home bridge.

---

### Phase 1.5: The Product Walkthrough Animation

**The case for an animated walkthrough:** Terrazzo has several non-obvious interaction patterns — the Universal Add Bar (UAB), ghost card suggestions, drag-to-reorder in trips, the tab structure, match tier badges, the Discover feed. For an alpha audience who won't have product intuition yet, a brief animated introduction to the *mechanics* of the app (not just the sections) significantly reduces confusion in those critical first 2 minutes.

**The key tension:** Traditional tooltip tours have terrible completion rates and feel disconnected from the actual product. But doing *nothing* means users discover the UAB by accident (or never), and they won't understand what tier badges mean or how to get places into a trip.

**Proposed approach: "The 30-Second Flythrough"**

A cinematic micro-animation (Framer Motion, 20-30 seconds, skippable) that plays once during the Bridge flow — slotting in after the "Three Ways to Use Terrazzo" orientation and before the "Your First Move" action prompt. It's not a tooltip tour. It's closer to a product trailer: a short, choreographed sequence that shows the app *in motion* with the user's own data.

**Sequence (5 beats, ~5-6 seconds each):**

1. **The + Bar** — The UAB rises from the bottom. A search query types itself ("paste a link, search, or import..."). A place card resolves. It gets saved with a subtle confirmation. *Teaches: the + button is how you add anything.*

2. **Match Tiers** — Camera pans across 3 place cards. Tier badges animate in: "Strong match" (teal), "Good match" (olive), "Worth a look" (ochre). A one-line explainer: *"Every place is scored against your taste."* *Teaches: tier badges exist, they mean something personal.*

3. **Building a Trip** — A trip card opens. A place drags from the library into a morning slot. A second place drops into afternoon. The day takes shape. *Teaches: drag-to-plan interaction, the trip day structure.*

4. **The Discover Feed** — A scroll through 2-3 Discover sections with the user's actual archetype name visible. Sections slide up: "Because you love [signal]...", a Strong match place card. *Teaches: Discover is personalized, it updates, it's worth returning to.*

5. **Your Taste, Everywhere** — Quick montage: tier badge on a place card, a collection with 4 places, a trip overview with match-aligned suggestions. Resolves to: *"Terrazzo learns as you go."* CTA: "Start exploring."

**Design constraints:**

- **Use the user's real data.** Show their archetype name, their seed trip destination, actual recommended places. This makes it feel personal, not generic.
- **Match the existing motion language.** Use the same Framer Motion easing curves, fade patterns, and timing as the onboarding phases. It should feel like the same experience continuing.
- **Skippable but not dismissible by default.** A subtle "Skip" link in the corner, but the animation auto-plays. For alpha testers, most will watch it once — and that's all they need.
- **Never plays again.** Gated behind a `hasSeenWalkthrough` flag (localStorage + DB). Returning users go straight to the app.

**Why this works better than tooltips:**

- It's *pre-contextual* — users see interactions before encountering them, which primes recognition ("oh, that's the + bar thing from the intro").
- It's fast and passive — no tapping through 7 tooltip bubbles.
- It uses real data, which maintains the personal feeling of the onboarding.
- It matches Terrazzo's editorial, cinematic brand identity — a walkthrough that feels designed, not bolted on.

**Best-in-class references:** Arc Browser's intro video that shows Spaces, Boosts, and Split View in a 30-second choreographed sequence. Stripe's interactive product demos that show the dashboard with real-looking data. Apple's feature reveal animations when you set up a new device — brief, polished, and they show you the gestures you'll need.

**Implementation note:** This is the most visually complex piece of the first-run experience, but it's self-contained — a single component with a Framer Motion timeline, no backend work, and a clear entry/exit point in the Bridge flow. Estimated effort: 2-3 days for a polished version.

---

### Phase 2: A Living App from Minute One

**The core problem:** Empty states kill momentum. When a user taps "Collect" and sees "No saved places yet," the implicit message is "this app has nothing for you." For an alpha, the app needs to feel alive on first load.

#### 2A. Seed the Discover Feed (already partially done)

**Current state:** The Discover feed generates personalized sections via AI. It has hardcoded fallback content if the API fails. This is the strongest part of the current first-run experience — it just isn't surfaced prominently enough.

**Proposed changes:**

- **Make Discover the default landing page after the bridge flow**, not `/trips`. The Discover feed is the best proof that Terrazzo "gets" you. Lead with it.
- **Pre-generate the first Discover feed during the processing/synthesis step** so it's instant on first load. No loading spinner on the most important first impression.
- **Add a personalized welcome section** at the top of the first Discover feed: the user's archetype, a one-line taste summary, and their top 3 match signals. This anchors the feed in their identity.

#### 2B. Seed the Place Library

**Current state:** Empty. "No saved places yet."

**Proposed approach — auto-save from Discover:**

After the bridge flow, automatically save the top 5 Discover recommendations to the user's library and create a smart collection called something like "Terrazzo Picks for [Archetype Name]." This means:

- The Collect tab is never empty on first visit
- Users immediately see what a populated library looks like
- The collection teaches the collection concept by example
- Match tiers are visible (Strong / Good / Worth a Look), reinforcing that Terrazzo understands their taste

**Important:** These should be clearly labeled as Terrazzo-generated (a subtle badge or "Suggested by Terrazzo" tag), so users understand the difference between places they saved and places we suggested. Include a gentle dismiss/remove option.

#### 2C. Seed Trips with More Context

**Current state:** Dream destination trips are created as bare shells — just a name and "dreaming" status. No places, no days, no suggestions.

**Proposed approach:**

- When creating the dream destination seed trip, also run a quick suggestion pass: pre-populate 3-5 suggested places (as "ghost cards" / suggestions, not confirmed places) using the taste matching system.
- Add a "Terrazzo's take" note on the trip: *"Based on your taste profile, [Destination] is a strong match for you because [1-sentence reason]. Here are a few places to start with."*
- This transforms the trip from an empty container into a preview of Terrazzo's planning intelligence.

---

### Phase 3: Contextual Feature Discovery

Rather than a tooltip tour, introduce features at the moment they become relevant. This is the approach used by Linear, Notion, and Arc — the features reveal themselves through natural product use.

#### First-Action Prompts (Contextual CTAs)

These appear once, at the right moment, then dismiss permanently:

| Trigger | Prompt | Where |
|---------|--------|-------|
| First visit to Collect (with seed places) | "These are places we think you'd love. Save ones that resonate — or add your own from Google Maps, articles, or email." | Top of Collect page, dismissible card |
| First visit to a Trip detail | "Add places from your library, or let Terrazzo suggest. Drag to arrange your day." | Empty day slot area |
| First time opening the Add bar | "Paste a link, search by name, or import your Google Maps saves." | Inside the Add bar sheet |
| After saving 3+ places | "Ready to plan? Create a trip and we'll help you build the perfect itinerary." | Bottom sheet or inline prompt |
| After completing first trip day | "Nice. Terrazzo learns from your choices — your matches will keep getting sharper." | Subtle toast/confirmation |

#### Empty State Upgrades

Every empty state should do three things: (1) explain what goes here, (2) show what it looks like when populated, and (3) offer a single action to get started.

| Page | Current Empty State | Proposed |
|------|-------------------|----------|
| **Collect** | "No saved places yet" | "Your place library is where taste meets territory. Import from Google Maps, paste an article link, or explore your Discover feed to start building." + preview card showing a sample place |
| **Trips (no trips)** | Just the "+ Start a New Trip" CTA card | "Every great trip starts with a place that calls to you. Create a trip, or save places first and plan later." + illustration |
| **Trip detail (empty day)** | Ghost card slots | "Drag places from your library, or tap + to let Terrazzo suggest something for this slot based on your taste and the flow of your day." |
| **Collections (none)** | No state shown | "Collections are how you organize your places — by vibe, by trip, by mood. Start one, or we'll create smart collections as your library grows." |

---

### Phase 4: The Evolving Welcome System

The Evolving Welcome is the primary user-facing mechanism for guiding engagement. It sits at the top of the Discover feed (above `EditorialLetterSection`) and adapts based on real user state — not hardcoded copy, but a component that reads from `useLibraryStore`, `useTripStore`, and the interaction tracker to determine what to show and what to surface alongside the message.

**Core principle:** Every welcome state includes both *copy* (the message) and *content* (actual place cards, trip previews, or collection links that back up what the copy says). The content is the point — the copy is just the frame.

#### State Machine

The welcome progresses through 5 states. Each state is determined by real data from the stores, and each surfaces real content inline.

**State 1: "First Light"**
*Trigger:* `myPlaces.length === 0 && trips.length <= seedTripCount` (fresh post-onboarding, only seed content exists)

Copy: *"Welcome to your Terrazzo, [Name]. We've been getting to know your taste — here's what [archetype name] looks like in the wild."*

Content: Inline horizontal scroll of the top 3 Discover recommendations (pulled from the `becauseYouCards` slice of the already-fetched `discoverContent`), each showing place image, name, tier badge, and the 1-line match reason. Save button on each card.

Nudge: *"Save the ones that resonate. Skip the ones that don't — we'll learn from both."*

Data sources: `useDiscoverFeed` → `discoverContent.becauseYouCards`, `useOnboardingStore` → `generatedProfile.overallArchetype`

**State 2: "Building"**
*Trigger:* `userSavedCount >= 1 && userSavedCount < 5 && trips.filter(t => t.places.length > 0).length === 0` (user is saving but hasn't planned yet)

Copy: *"[N] places in your library. Your taste is starting to take shape on the map."*

Content: A mini-map preview showing the user's saved places as pins (if they span multiple cities) or a compact list of saved places grouped by destination. Below that, a single CTA card: *"Ready to plan? Pick a destination and we'll help you build the trip."* — links to trip creation.

Nudge: None — the CTA card is the nudge.

Data sources: `useLibraryStore` → `myPlaces` (with coordinates for map), `useTripStore` → `trips`

**State 3: "Planning"**
*Trigger:* `trips.some(t => t.places.length > 0) && userSavedCount < 10` (user has started planning but library is thin)

Copy: *"[Trip name] is coming together. A few more places we think belong on this trip:"*

Content: 2-3 fresh taste-matched recommendations for the destination of their most active trip (fetched via the existing `/api/trips/[id]/suggestions` endpoint or from Discover content filtered by destination). Each card has a direct "Add to [Trip Name]" action.

Nudge: *"You can also paste any link or article into the + bar to import places you've already found."*

Data sources: `useTripStore` → most active trip + its destination, `/api/trips/[id]/suggestions` or destination-filtered Discover content

**State 4: "Curating"**
*Trigger:* `userSavedCount >= 10 || (trips.length >= 2 && totalPlacedCount >= 5)` (meaningful engagement — library growing or multiple trips taking shape)

Copy: *"[N] places, [M] trips. Terrazzo is learning — here's what's new for your taste this week."*

Content: The latest Discover feed refresh — 2-3 new recommendations that weren't in previous sessions (using the `excludePlaces` mechanism from the existing `discover/more` pagination). Each card shows a "New" badge and the match tier.

Nudge: None — at this stage the user understands the app. The welcome is just a personalized greeting + fresh content.

Data sources: `useLibraryStore` → `myPlaces.length`, `useTripStore` → trips/places counts, `useDiscoverFeed` → fresh content with exclusion of previously-seen places

**State 5: "Returning"**
*Trigger:* Return visit (session count > 1, tracked via `sessionStorage` or the existing `return_visit` interaction event) AND state would otherwise be 3 or 4

Copy: *"Welcome back. Since you were last here, we found [N] new matches in [Destination / your taste profile]."*

Content: New recommendations generated since last session (compare current Discover content against cached previous content, or track a `lastSeenDiscoverTimestamp`). If the user has a trip with approaching dates, surface that instead: *"[Trip Name] is [N] weeks out. Here's one more for [Destination]."* with a single strong-match recommendation.

Data sources: `localStorage` discover cache timestamp comparison, `useTripStore` → trips with approaching `startDate`

#### State Determination Logic

```
function getWelcomeState(
  myPlaces: SavedPlace[],
  trips: Trip[],
  seedTripCount: number,
  isReturnVisit: boolean
): WelcomeState {
  const userSavedCount = myPlaces.filter(p => !p.seededByTerrazzo).length;
  const totalPlacedCount = trips.reduce((sum, t) => sum + (t.places?.length || 0), 0);
  const hasActivePlan = trips.some(t => (t.places?.length || 0) > 0);

  // Return visit overlay (modifies states 3-4)
  if (isReturnVisit && (hasActivePlan || userSavedCount >= 10)) {
    return 'returning';
  }

  if (userSavedCount >= 10 || (trips.length >= 2 && totalPlacedCount >= 5)) {
    return 'curating';
  }
  if (hasActivePlan && userSavedCount < 10) {
    return 'planning';
  }
  if (userSavedCount >= 1) {
    return 'building';
  }
  return 'first-light';
}
```

#### Implementation Details

- **Component:** `EvolvingWelcome.tsx` — renders above `EditorialLetterSection` in the Profile/Discover page
- **Content fetching:** Each state reuses existing data sources (Discover content, trip suggestions, library store) — no new API routes needed. The only new fetch might be a lightweight "new since last visit" check.
- **Transitions:** When a user takes an action that changes state (e.g., saves a place → moves from "First Light" to "Building"), the welcome should update on next Discover visit, not mid-session. Use the 2-hour Discover cache TTL as the natural refresh boundary.
- **Dismissibility:** The welcome should be collapsible (tap to minimize to a single greeting line) but never fully removable. It's the persistent touchpoint between Terrazzo and the user.
- **Seeded vs. user-saved distinction:** Track seeded places with a `source: 'terrazzo_seed'` flag so `userSavedCount` only counts intentional saves. This prevents the welcome from advancing just because we pre-populated their library.

---

### Phase 5: Activation Tracking & Micro-Celebrations

#### Activation Milestones (Internal Only)

These are **not** shown to the user as a checklist. They're tracked in the DB for alpha analytics — understanding which actions correlate with retention.

A user is "activated" when they've completed **3 of these 5 actions** within their first 3 sessions:

1. Viewed their Discover feed (saw personalized recommendations)
2. Saved at least 1 place to their library (beyond auto-seeded ones)
3. Created or opened a trip
4. Added a place to a trip
5. Imported from an external source (Google Maps, article link, email)

**Tracking mechanism:** Extend the existing `interaction-tracker.ts` with activation-specific events. Store activation milestone timestamps in a `user_activation` JSON field on the User model (or a lightweight `UserActivation` table). Query this during alpha analysis.

#### Micro-Celebrations (Visible, Ambient)

Small, Terrazzo-toned moments that appear as toasts or inline confirmations at key milestones. These are the user-facing expression of activation progress — but they never reference the milestones explicitly.

- **First save:** *"Saved. Your library is growing."*
- **First trip place added:** *"[Place name] — strong match. Good instinct."*
- **5th place saved:** *"Five places in your library. Terrazzo is starting to see patterns."*
- **First full trip day planned:** *"A full day in [Destination]. That's a strong start."*
- **First import:** *"[N] places imported. Your taste map just got richer."*

These use the editorial, understated tone that matches Terrazzo's brand — not gamification, but acknowledgment. Implemented as a `useMilestoneToast` hook that checks counts against known thresholds and fires once per milestone (gated by localStorage flags).

#### Alpha-Specific Feedback Hooks

Since this is friends & family:

- **After first session (24h later):** In-app prompt: *"How did your first session feel? Anything confusing or missing?"* with a simple text input and 1-5 rating.
- **After third session:** *"What's the one thing that would make you come back more?"*
- **Session recording opt-in:** Ask alpha testers if they'd be willing to have sessions recorded (via a lightweight tool) for UX analysis.

---

### Phase 5: Re-engagement & Return Visits

Stickiness isn't just about the first session — it's about giving people a reason to come back.

#### Discover Feed Refresh

- **Weekly refresh** with new personalized recommendations, framed as *"New this week"* at the top of the Discover feed.
- **Seasonal content:** As travel seasons shift, surface destination-appropriate recommendations. *"Summer in your taste profile looks like..."*

#### Taste Profile Evolution

- **"Your taste is evolving"** moments: When enough new signals accumulate (from saves, trip planning, reactions), surface a subtle notification: *"We've learned something new about your taste. See what changed."* → updated profile section.
- **Expand Your Mosaic prompts:** After 2-3 sessions, prompt users to answer a few more taste questions (the existing ExpandMosaicView) to deepen their profile.

#### Trip Momentum

- For trips with dates approaching, surface a reminder: *"[Trip Name] is in 3 weeks. You've got [X] places planned out of [Y] days."*
- For "dreaming" status trips, periodically surface new matching places: *"We found a new strong match in [Destination]."*

---

## Implementation Priority (Alpha Launch)

Sequenced by impact and effort for getting the app ready to share:

### Must-Have (Before Sharing)

1. **Navigation restructure** — Split Discover out of Profile into its own top-level page. 5-tab layout: Discover / Collect / + / Plan / Profile. This is foundational — everything else builds on Discover being the front door. ~1-2 days (routing, component extraction, TabBar/DesktopNav update).

2. **The Bridge flow** (Reveal → "Your Terrazzo is Ready" → Orientation → First Action → `/discover`). The single biggest gap in the current experience. ~3-5 screens of UI work, no new backend.

3. **The 30-Second Flythrough animation** — the animated product walkthrough that plays during the Bridge, showing the UAB, match tiers, trip planning, and Discover feed using the user's real data. ~2-3 days of focused Framer Motion work, self-contained component.

4. **The Evolving Welcome component** — state-driven welcome at top of Discover that reads from library/trip stores and surfaces real content inline. Starts at "First Light" state for new users. ~1-2 days.

5. **Seed the Place Library** with top Discover recommendations + a starter collection. Moderate backend work (auto-save during synthesis), straightforward frontend.

6. **Upgrade empty states** across Collect, Trips, and Trip detail. Pure frontend — new copy, layout, and CTAs for empty conditions.

### Should-Have (First Week of Alpha)

6. **Contextual first-action prompts** (the dismissible cards at key moments). Requires a simple "seen prompts" tracking mechanism (localStorage or DB flag).

7. **Seed trip suggestions** — pre-populate dream destination trips with 3-5 ghost card place suggestions.

8. **Micro-celebrations** for first save, first trip add, milestone moments.

### Nice-to-Have (During Alpha)

8. **Alpha feedback hooks** (in-app prompts at 24h and 3rd session).

9. **Discover feed pre-generation** during processing step (performance optimization).

10. **Taste evolution notifications** and Expand Mosaic prompts on return visits.

---

## Best-in-Class References

These are the apps doing post-onboarding activation exceptionally well, and the specific patterns worth studying:

**Spotify** — The "Made for You" section is the model for Terrazzo's Discover feed. Spotify never shows an empty state; from day one, every surface has content. The Discover Weekly mechanism (weekly refresh, personalized, editorially framed) is exactly what Terrazzo should aim for.

**Arc Browser** — The onboarding-to-product bridge is seamless. Arc introduces features through use (spaces, boosts, easels) rather than tooltip tours. Features reveal themselves when you need them.

**Notion** — Template-as-onboarding. New workspaces come with starter templates that teach by example. Terrazzo's seeded collections and pre-populated trips serve the same function.

**Linear** — Contextual feature discovery. Linear introduces features at the moment they become relevant, with inline education that dismisses after first use. No modal tours.

**Pinterest** — Interest-based feed from minute one. Pinterest's onboarding captures preferences, then immediately shows a fully personalized feed. The content *is* the onboarding. Terrazzo's Discover feed should follow this pattern — make it the first thing users see.

**Duolingo** — Micro-celebrations without gamification overkill. The tone is warm and encouraging without being childish. Terrazzo's "Good instinct" / "Your library is growing" copy follows this spirit while maintaining editorial sophistication.

---

## Measuring Success (Alpha Metrics)

For the friends & family alpha, track these to understand if the first-run experience is working:

| Metric | Target | Why It Matters |
|--------|--------|---------------|
| **Bridge completion rate** | >90% | Are people making it through the bridge into the product? |
| **First-session place save** | >60% | Did they engage with content beyond just looking? |
| **Second session return** | >50% | Did they come back? This is the stickiness signal. |
| **Discover feed scroll depth** | >3 sections | Are they engaging with personalized content? |
| **Time to first trip action** | <5 min | How quickly do they find their way to planning? |
| **Feature discovery breadth** | 2+ sections visited | Are they exploring beyond the landing page? |

---

## Summary

The taste profiling onboarding is a competitive advantage — it's intimate, novel, and deeply personal. The post-onboarding experience needs to live up to that standard. The core strategy is:

1. **Bridge** the emotional energy from the reveal into the product (don't drop users cold).
2. **Populate** every surface with personalized content so nothing feels empty.
3. **Guide** with contextual prompts at the moment of need, not tooltip tours.
4. **Celebrate** milestones in Terrazzo's editorial voice.
5. **Refresh** content to give people reasons to return.

The app should feel like a place that was set up *for you* before you arrived — not a blank canvas you have to fill yourself.
