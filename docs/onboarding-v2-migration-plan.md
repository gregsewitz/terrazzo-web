# Onboarding → Taste Taxonomy v2: Full Rewrite Plan

> **Goal**: Rewrite the onboarding system to be native to the v2 taxonomy (6 taste domains + 2 preference dimensions), not a patch on top of the v1 8-domain system.
>
> **Approach**: Clean rewrite of taxonomy-coupled code. The onboarding *flow* (phases, modalities, conversation structure) stays intact — the signal extraction, certainty tracking, synthesis, and profile structure underneath get rebuilt for v2.

---

## Current State

**Types layer** (`types/index.ts`): Already v2. `TasteDomain` is `'Design' | 'Atmosphere' | 'Character' | 'Service' | 'FoodDrink' | 'Setting' | 'Wellness' | 'Sustainability'`. `CORE_TASTE_DOMAINS`, `PREFERENCE_DIMENSIONS`, `ALL_TASTE_DOMAINS`, `DIMENSION_TO_DOMAIN` all exist and are v2-correct.

**Everything else**: Still v1. The onboarding constants, store, API routes, system prompts, and static profile data all reference the old 8 domains (Design, Character, Service, Food, Location, Wellness, Rhythm, CulturalEngagement).

---

## Files to Rewrite (Ordered by Dependency)

### Phase 1: Foundation — Store & Constants

#### 1.1 `src/stores/onboardingStore.ts`

**What changes:**

`INITIAL_CERTAINTIES` currently seeds 8 v1 domains. Rewrite to seed the 6 taste domains + 2 preference dimensions with distinct initial values, reflecting that preference dimensions have thinner taste spaces:

```typescript
const INITIAL_CERTAINTIES: Record<TasteDomain, number> = {
  // 6 Taste Domains — start low, rich signal space to fill
  Design: 5,
  Atmosphere: 5,
  Character: 5,
  Service: 5,
  FoodDrink: 5,
  Setting: 5,
  // 2 Preference Dimensions — start slightly higher, thinner signal space
  Wellness: 10,
  Sustainability: 10,
};
```

**Also**: The `sustainabilitySignals` field in state can now be folded into the regular signal flow since Sustainability is a first-class dimension. Keep the field for backward compat during migration but stop treating sustainability signals as a separate channel. Signals with `cat: 'Sustainability'` are just regular signals now.

**`selectProfileIsComplete`**: Currently checks `certainties >= 70` across all domains. Adjust thresholds — preference dimensions (Wellness, Sustainability) may complete at lower certainty since they're weighted checklists, not rich taste spaces. Consider `>= 70` for core domains, `>= 50` for preference dimensions.

#### 1.2 `src/constants/onboarding.ts` — Phase Definitions

**What changes in each phase's `certaintyAfter`:**

Every phase definition has a `certaintyAfter` object using v1 keys. Remap all of them to v2 domains. Key transformations:

| v1 Key | v2 Key(s) | Notes |
|--------|-----------|-------|
| `Design` | `Design` | Direct, but some sensory signals now → `Atmosphere` |
| `Character` | `Character` + `Atmosphere` + `Setting` | Character was the v1 catch-all; redistribute |
| `Service` | `Service` | Direct |
| `Food` | `FoodDrink` | Rename |
| `Location` | `Setting` | Rename |
| `Wellness` | `Wellness` | Direct (now preference dimension) |
| `Rhythm` | `Atmosphere` | Tempo/pace/energy → Atmosphere |
| `CulturalEngagement` | `Character` | Cultural depth folds into Character |

Rewrite every phase's `certaintyAfter` using v2 keys and realistic post-phase estimates. Example for `memorable-stays`:

```typescript
// v1 (current)
certaintyAfter: { Design: 70, Character: 45, Service: 50, FoodDrink: 35, Setting: 50, Wellness: 10 },

// v2 (rewritten)
certaintyAfter: { Design: 55, Atmosphere: 30, Character: 35, Service: 40, FoodDrink: 25, Setting: 35, Wellness: 8, Sustainability: 8 },
```

Note: Certainty growth will be more distributed across 8 dimensions instead of concentrated in fewer, so individual per-phase jumps should be smaller.

#### 1.3 `src/constants/onboarding.ts` — Experience & Designer Pools

**`EXPERIENCE_POOL`**: Each item has a `category` field using v1 domain names. Remap:

| Current Category | v2 Category | Example Items |
|-----------------|-------------|---------------|
| `'Service'` | `'Service'` | room-service |
| `'FoodDrink'` | `'FoodDrink'` | local-cafe |
| `'Wellness'` | `'Wellness'` | infinity-pool, hidden-pool |
| `'Character'` | Redistribute: `'Atmosphere'` (pace/energy items), `'Character'` (identity items), `'Setting'` (location items) | packed-day → Atmosphere, early-night → Atmosphere, perfect-hotel → Character, intimate-inn → Character |
| `'Design'` | `'Design'` | grand-lobby |
| `'Setting'` | `'Setting'` | beach, mountain, walkable, remote |

Specific remappings within the pool:
- `packed-day`, `slow-day` (Day Pace) → `'Atmosphere'` (energy/tempo)
- `early-night`, `late-night` (After Dark) → `'Atmosphere'` (energy)
- `perfect-hotel`, `perfect-city` → `'Character'` (property vs destination identity)
- `grand-lobby` → `'Design'`, `intimate-inn` → `'Character'`

**`DESIGNER_POOL`**: The `axes` object uses designer-specific axes (volume, temperature, time, formality, culture, mood) which are separate from the taste domain taxonomy — these are the design-eye axes and can stay as-is. No changes needed here.

**`DIAGNOSTIC_QUESTIONS`**: Signal tags are domain-agnostic strings. No changes needed — the tags themselves don't reference domains.

**`IMAGE_PAIRS`**: Same — signal tags are agnostic. No changes.

#### 1.4 `src/constants/onboarding.ts` — Refinement Phases

The `REFINEMENT_PHASES` already use some v2 language (e.g., `Atmosphere: 80` in the rhythm refinement phase). Review and ensure all `certaintyAfter` objects use v2 keys consistently.

---

### Phase 2: System Prompts (The Big Ones)

#### 2.1 `TASTE_ONTOLOGY_SYSTEM_PROMPT`

This is the core prompt that tells Claude how to extract signals. **Full rewrite required.**

Key changes:

**Replace the "8 TASTE DIMENSIONS" block** with the v2 structure:

```
THE 6 TASTE DOMAINS (rich signal-to-signal matching):
1. DESIGN — Architectural & material vocabulary: structural language, material palette,
   furniture/object design, color philosophy, detail resolution
2. ATMOSPHERE — The felt experience of a space: light quality, sound environment,
   scent signatures, spatial rhythm, energy & tempo, sensory intensity
3. CHARACTER — Place identity & narrative: heritage/provenance, curatorial point of view,
   cultural programming, community/belonging, authenticity register, owner story
4. SERVICE — Human interaction contract: formality spectrum, anticipation style,
   personalization depth, staff knowledge, autonomy vs attentiveness, digital vs human
5. FOOD & DRINK — Culinary philosophy & personality: culinary philosophy, ingredient sourcing,
   dining format, beverage program, meal rhythm, dietary identity
6. SETTING — Location, geography & context: urban texture, nature relationship,
   neighborhood character, accessibility, views/orientation, surroundings

THE 2 PREFERENCE DIMENSIONS (weighted checklists, lighter treatment):
7. WELLNESS — Physical comfort & body-care: spa/treatment facilities, fitness,
   sleep technology, dietary accommodation, air/water quality
8. SUSTAINABILITY — Environmental & social values: certifications, energy/water management,
   local sourcing, waste reduction, social responsibility
```

**Update the certainties JSON schema** in the output format:

```json
"certainties": {
  "Design": 0-100, "Atmosphere": 0-100, "Character": 0-100,
  "Service": 0-100, "FoodDrink": 0-100, "Setting": 0-100,
  "Wellness": 0-100, "Sustainability": 0-100
}
```

**Update signal category guidance**: Currently signals use `cat` values that map to v1 domains. Guide Claude to use v2 categories:
- Tempo, pace, energy, sensory signals → `cat: "Atmosphere"` (not "Rhythm" or "Character")
- Cultural depth, programming, heritage → `cat: "Character"` (not "CulturalEngagement")
- Location, geography, neighborhood → `cat: "Setting"` (not "Location")
- Food signals → `cat: "FoodDrink"` (not "Food")

**Remove the separate sustainability extraction pathway**: Currently the prompt separates sustainability signals with dimension tags (ENVIRONMENTAL, SOCIAL, etc.). In v2, sustainability is a first-class preference dimension. Sustainability signals should use `cat: "Sustainability"` like any other domain, with the sub-dimension (ENVIRONMENTAL, etc.) as an optional metadata field.

#### 2.2 `PROFILE_SYNTHESIS_PROMPT`

**Full rewrite required.** Key changes:

**Replace "8 taste dimensions" references** with v2 domain list throughout.

**Update `radarData` specification**: The current radar uses 8 axes (Sensory, Authenticity, Material, Social, Cultural, Spatial, Rhythm, Ethics) which don't map cleanly to either v1 or v2 domains. For v2, the radar should map to the 6 taste domains + 2 preference dimensions directly:

```json
"radarData": [
  { "axis": "Design", "value": 0.0-1.0 },
  { "axis": "Atmosphere", "value": 0.0-1.0 },
  { "axis": "Character", "value": 0.0-1.0 },
  { "axis": "Service", "value": 0.0-1.0 },
  { "axis": "FoodDrink", "value": 0.0-1.0 },
  { "axis": "Setting", "value": 0.0-1.0 },
  { "axis": "Wellness", "value": 0.0-1.0 },
  { "axis": "Sustainability", "value": 0.0-1.0 }
]
```

**Update `microTasteSignals` categories**: Replace v1 category names with v2 domain names in the synthesis schema. Categories should be: "Design", "Atmosphere", "Character", "Service", "Food & Drink", "Setting", "Wellness", "Rejection".

**Update `sustainabilityProfile`**: Keep this section but frame it as the Sustainability preference dimension's detail view rather than a "cross-cutting" layer.

**Update matched properties schema**: Add `atmosphereNote` field (for energy/sensory match commentary). The current `rhythmNote` and `culturalEngagementNote` fields should be replaced with `atmosphereNote` and folded into standard match reasoning.

---

### Phase 3: API Routes

#### 3.1 `src/app/api/onboarding/analyze/route.ts`

**What changes:**

The route currently passes `certainties` (v1-keyed from the client store) and the `TASTE_ONTOLOGY_SYSTEM_PROMPT` to Claude. Once the store and prompt are v2-native, this route needs minimal changes:

- The `certainties` JSON embedded in the context message will automatically use v2 keys (from the rewritten store)
- The system prompt is already imported from constants — it will pick up the rewrite
- **One explicit change**: The prompt text says "across 8 dimensions" — this is in the system prompt, not the route. But verify the route's context message template doesn't hardcode dimension names.

#### 3.2 `src/app/api/onboarding/synthesize/route.ts`

**What changes:**

The context message template hardcodes v1 references:

```typescript
// Current (line 77-78):
TASTE SIGNALS (${tasteSignals.length} total across 8 dimensions):
// ...
FINAL CERTAINTIES (8 dimensions):
// ...
IMPORTANT: Generate the profile using all 8 taste dimensions
(Design, Character, Service, Food, Location, Wellness, Rhythm, CulturalEngagement)
plus sustainability. Include radarData with 8 axes.
```

Rewrite to:

```typescript
TASTE SIGNALS (${tasteSignals.length} total across 6 taste domains + 2 preference dimensions):
${JSON.stringify(tasteSignals, null, 2)}

SUSTAINABILITY SIGNALS (${sustainabilitySignals.length} total):
${JSON.stringify(sustainabilitySignals, null, 2)}

// ...

FINAL CERTAINTIES (6 taste domains + 2 preference dimensions):
${JSON.stringify(certainties)}

IMPORTANT: Generate the profile using the v2 taxonomy:
6 taste domains (Design, Atmosphere, Character, Service, FoodDrink, Setting) +
2 preference dimensions (Wellness, Sustainability).
Include radarData with 8 axes matching these domains.
```

**Also**: The sustainability signal filtering logic (lines 70-72) that separates `cat === 'Sustainability'` can remain — it's still useful to present sustainability signals grouped separately in the synthesis context even though they're part of the regular flow now.

#### 3.3 Modality Routes (`/api/onboarding/modality/*`)

Check each for hardcoded domain references. These routes handle slider, card, swipe, and spectrum modality interactions. They likely pass signal data that includes `cat` fields — ensure they accept v2 domain names.

---

### Phase 4: Profile Display & Static Data

#### 4.1 `src/constants/profile.ts`

The static demo `TASTE_PROFILE` needs a full rewrite:

**`microTasteSignals`**: Replace v1 category names:
- "Design Language" → "Design"
- "Character & Identity" → "Character"
- "Service Philosophy" → "Service"
- "Food & Drink" → "Food & Drink"
- "Location & Context" → "Setting"
- "Wellness & Body" → "Wellness"
- Add new: "Atmosphere" (with sensory, energy, tempo signals extracted from what was in Design and Character)
- "Rejection" stays

**`radarData`**: Replace v1 radar axes with v2 domain-mapped axes:
```typescript
radarData: [
  { axis: "Design", value: 0.95 },
  { axis: "Atmosphere", value: 0.92 },
  { axis: "Character", value: 0.88 },
  { axis: "Service", value: 0.82 },
  { axis: "FoodDrink", value: 0.78 },
  { axis: "Setting", value: 0.85 },
  { axis: "Wellness", value: 0.65 },
  { axis: "Sustainability", value: 0.60 },
],
```

**`DIMENSION_COLORS`**: Replace v1 dimension names with v2. Current map:
```typescript
// Current:
"Design Language", "Sensory Environment", "Character & Identity",
"Service Philosophy", "Food & Drink Identity", "Location & Context",
"Wellness & Body", "Sustainability", "Rhythm & Tempo", "Cultural Engagement"

// v2:
"Design", "Atmosphere", "Character", "Service",
"Food & Drink", "Setting", "Wellness", "Sustainability", "Rejection"
```

**`AXIS_COLORS`**: Replace with v2 domain-keyed colors, aligning with `DOMAIN_COLORS` from `types/index.ts`.

#### 4.2 `src/components/profile/ProfileDeepDive.tsx`

Uses dimension names for section headers and signal categorization. Update to v2 domain names.

#### 4.3 `src/components/profile/RhythmVisualization.tsx`

This component visualizes rhythm/tempo data. In v2, rhythm signals live under Atmosphere. Either:
- Rename to `AtmosphereVisualization.tsx` and expand to cover all Atmosphere sub-signals (light, sound, scent, spatial rhythm, energy/tempo)
- Or keep as a sub-visualization within a broader Atmosphere section

#### 4.4 `src/components/TerrazzoMosaic.tsx`

The mosaic visualization uses certainty data. Ensure it reads v2-keyed certainties.

---

### Phase 5: Matching & Intelligence Layer

#### 5.1 `src/lib/taste-match.ts`

Already imports `TasteDomain` and `ALL_TASTE_DOMAINS` from v2 types. The `computeMatchFromSignals` function groups signals by domain and computes per-domain scores. Since it uses the v2 `TasteDomain` type and `DIMENSION_TO_DOMAIN` mapping, it should work once signals come in with v2 `cat` values.

**Check**: Domain weight distribution. Currently all domains may be weighted equally. In v2, preference dimensions (Wellness, Sustainability) should carry lower weight in overall scoring. Consider:
```typescript
const DOMAIN_WEIGHTS: Record<TasteDomain, number> = {
  Design: 1.0, Atmosphere: 1.0, Character: 1.0,
  Service: 1.0, FoodDrink: 1.0, Setting: 1.0,
  Wellness: 0.5,      // preference dimension — lighter weight
  Sustainability: 0.3, // preference dimension — lightest weight
};
```

#### 5.2 `src/lib/taste-intelligence/vectors.ts`

Vector layout changes from 34-dim to 32-dim per the v2 spec. This is a deeper change that affects embedding generation and cosine similarity. The migration plan in the v2 spec outlines this:
- [0-5]: 6 taste domains
- [6-7]: 2 preference dimensions (lower weight)
- [8-31]: 24 semantic hash buckets

**This is the most technically complex change** and should be gated behind the comparison script validation described in the v2 spec (run both scoring methods against all 364 places and compare divergent cases).

#### 5.3 `src/lib/taste-intelligence/evaluation.ts` and `queries.ts`

These use domain-keyed data for evaluation and querying. Ensure they reference v2 domain names.

---

### Phase 6: Downstream Consumers

These files reference certainties or domain names and need spot-fixes:

| File | What to change |
|------|---------------|
| `src/app/profile/page.tsx` | Domain name display, certainty rendering |
| `src/components/PlaceDetailContent.tsx` | Match breakdown by domain |
| `src/components/BriefingView.tsx` | Briefing domain references |
| `src/lib/user-profile.ts` | Profile loading/saving domain keys |
| `src/lib/discover-allocation.ts` | Discovery scoring by domain |
| `src/lib/import-pipeline.ts` | Import signal domain tagging |
| `src/lib/import-helpers.ts` | Import helper domain references |
| `src/stores/saved/savedHistorySlice.ts` | Saved place domain data |
| `src/stores/saved/savedHydrationSlice.ts` | Hydration domain data |
| `src/app/onboarding/processing/page.tsx` | Processing animation domain refs |
| `src/app/onboarding/act1-complete/page.tsx` | Act 1 completion domain refs |
| `src/lib/api-validation.ts` | Validation schemas for domain keys |
| `src/lib/anthropic.ts` | Anthropic client domain prompts |

---

## Migration Sequence

### Order of Operations

```
1. EXPERIENCE_POOL + DIAGNOSTIC_QUESTIONS category remapping (constants)
2. Phase `certaintyAfter` rewrites (constants)
3. INITIAL_CERTAINTIES in store (store)
4. TASTE_ONTOLOGY_SYSTEM_PROMPT rewrite (constants — biggest single change)
5. PROFILE_SYNTHESIS_PROMPT rewrite (constants)
6. Synthesize route template rewrite (API)
7. Static profile data rewrite (constants/profile.ts)
8. Profile display components (components)
9. Matching weight adjustments (lib/taste-match.ts)
10. Vector layout migration (lib/taste-intelligence/vectors.ts) — gate behind validation
11. Downstream consumer spot-fixes (various)
```

### What Does NOT Change

- **Phase flow structure**: The 14 phases (10 Act I + 4 Act II), their order, modalities, and conversation design stay the same
- **Phase IDs**: `welcome`, `memorable-stays`, `rhythm-refinement`, etc. — unchanged
- **Conversation hooks**: `useConversationPhase.ts` — unchanged (it's domain-agnostic, passes data through)
- **Signal tags**: Individual signal tags like "Japanese-serenity", "Anti-marble-lobby", "Farm-to-table-driven" stay the same — only their `cat` (domain assignment) changes
- **Emotional archetypes**: The 7 emotional driver types (Aesthetic Pilgrim, etc.) are independent of the taste taxonomy
- **Designer pool axes**: volume, temperature, time, formality, culture, mood — these are design-eye specific, not taste domain axes
- **Mosaic question bank**: Question types and content stay the same; only the axis mappings in answers may shift (e.g., "Rhythm" references → "Atmosphere")

### Breaking Changes & Data Migration

**Existing user profiles** with v1-keyed certainties will break. Options:

1. **Recommended**: Add a migration function in the onboarding store that detects v1 keys and remaps:
   ```typescript
   function migrateV1Certainties(old: Record<string, number>): Record<TasteDomain, number> {
     return {
       Design: old.Design ?? 5,
       Atmosphere: Math.max(old.Rhythm ?? 5, (old.Design ?? 5) * 0.3), // inherit from Rhythm + Design sensory
       Character: Math.max(old.Character ?? 5, old.CulturalEngagement ?? 5),
       Service: old.Service ?? 5,
       FoodDrink: old.Food ?? 5,
       Setting: old.Location ?? 5,
       Wellness: old.Wellness ?? 10,
       Sustainability: 10, // new dimension, start fresh
     };
   }
   ```

2. **Existing signals**: Signals already have `cat` values using v1 names. Add a signal migration that remaps `cat` fields:
   ```typescript
   const CAT_MIGRATION: Record<string, TasteDomain> = {
     'Food': 'FoodDrink',
     'Location': 'Setting',
     'Rhythm': 'Atmosphere',
     'CulturalEngagement': 'Character',
     // Design, Character, Service, Wellness stay the same
   };
   ```

3. **localStorage**: The `terrazzo-onboarding` key persists v1-shaped data. The store's `persist` middleware should include a `migrate` function (Zustand supports this) to handle the v1→v2 transformation on hydration.

---

## Testing Plan

1. **Unit**: Test certainty migration function (v1 → v2 key remapping)
2. **Unit**: Test signal cat migration (v1 → v2 domain assignment)
3. **Integration**: Run a full onboarding flow and verify:
   - All 8 v2 certainties update correctly across phases
   - Signal extraction uses v2 categories
   - Synthesis produces a v2-shaped profile with 8-axis radar
   - Profile display renders correctly with v2 domain names
4. **Regression**: Run the v2 spec's comparison script against all 364 places to validate match quality doesn't degrade
5. **Visual**: Check all profile views, mosaic, briefing, and place detail pages render correctly with v2 domain labels
