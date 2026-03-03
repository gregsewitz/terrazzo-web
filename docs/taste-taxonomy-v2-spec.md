# Taste Taxonomy v2 — Unified Specification

## Overview

This document formalizes the unified taste taxonomy that aligns user taste profiles and place intelligence signals under a single shared ontology. It replaces the current 8-domain system (Design, Character, Service, Food, Location, Wellness, Rhythm, CulturalEngagement) with a cleaner architecture of **6 taste domains** and **2 preference dimensions**.

## Design Principles

1. **Rich taste space test**: A taste domain must support a rich, multi-dimensional space of possible positions where different people occupy genuinely different aesthetic positions — not just varying levels of caring. Could two users have diametrically opposite profiles in this domain?

2. **Signal-to-signal matching**: Domains encode specific taste *positions* (constellations like "Japanese-serenity" or "concrete-brutalist"), not importance weights. The radar values serve as domain-level summary weights for matching, but the real matching happens at the signal level.

3. **Shared ontology**: Both the user taste profile and place intelligence pipeline must map to the same domain structure, enabling direct comparison.

---

## 6 Taste Domains

These are the primary matching dimensions. Each has a rich space of possible positions, supports meaningful signal-to-signal matching, and passes the "opposite profile" test.

### 1. Design
**What it encodes**: Architectural and material vocabulary — the physical craft of a space.

- Structural language (brutalist concrete, Art Deco ornament, Japanese minimalism, industrial steel)
- Material palette (raw wood, terrazzo, brass, reclaimed stone, polished marble)
- Furniture and object design (mid-century modern, Memphis, Scandinavian, artisanal)
- Color philosophy (monochrome, earth tones, bold maximalism)
- Detail resolution (hand-finished joinery, custom hardware, bespoke fixtures)

**Pipeline dimension mapping**: `Design Language`, `Architectural Style`, `Material Quality`

**Opposite profiles test**: A brutalist-minimalist who loves exposed concrete vs. a maximalist who loves ornate gilded interiors — clearly opposite, clearly rich.

### 2. Atmosphere
**What it encodes**: The felt experience of being in a space — light, sound, scent, spatial feeling, and energy.

- Light quality (candlelit intimacy, cathedral daylight, moody low-light, bright and airy)
- Sound environment (curated silence, vinyl soundtrack, live jazz, ambient noise)
- Scent signatures (cedar, incense, sea air, coffee roasting, no scent)
- Spatial rhythm (intimate nooks, grand open floor plans, labyrinthine corridors)
- Energy and tempo (contemplative slowness, buzzy social energy, focused productivity)
- Sensory intensity (immersive multisensory vs. restrained and quiet)

**Pipeline dimension mapping**: `Sensory Environment`, `Rhythm` (signals related to pace/tempo/energy), `Scale & Intimacy`

**Opposite profiles test**: Someone who craves silent, incense-scented meditation spaces vs. someone who wants a buzzy rooftop bar with a DJ — clearly opposite.

### 3. Character
**What it encodes**: Place identity, narrative, heritage, and cultural depth — the story a place tells.

- Heritage and provenance (century-old family estate, converted industrial, brand-new concept)
- Curatorial point of view (strong editorial voice, neutral backdrop, eccentric collection)
- Cultural programming (artist residencies, local partnerships, literary salons)
- Community and belonging (regulars culture, members club, open to all)
- Authenticity register (deeply rooted vs. curated pastiche)
- Owner/founder story and philosophy

**Pipeline dimension mapping**: `Character & Identity`, `CulturalEngagement` (signals about cultural depth, heritage, programming)

**Opposite profiles test**: Someone drawn to old-world aristocratic hotels with centuries of history vs. someone who wants a boundary-pushing art-hotel with no heritage at all — clearly opposite.

### 4. Service
**What it encodes**: The human interaction contract — how staff relate to guests.

- Formality spectrum (white-glove to deliberately casual)
- Anticipation style (predictive and silent vs. responsive on-request)
- Personalization depth (remembers your name and preferences vs. consistent anonymity)
- Staff knowledge (sommeliers, local experts, cultural guides)
- Autonomy vs. attentiveness (left alone vs. doted on)
- Digital vs. human (app-first vs. concierge-driven)

**Pipeline dimension mapping**: `Service Philosophy`, `Service Style`

**Opposite profiles test**: Someone who wants a butler who anticipates every need vs. someone who wants to be left completely alone with a self-service app — clearly opposite.

### 5. Food & Drink
**What it encodes**: The food and drink personality of a place — culinary philosophy, not just quality.

- Culinary philosophy (farm-to-table, molecular gastronomy, grandmother's recipes, fusion)
- Ingredient sourcing (hyper-local, imported specialty, foraging, organic)
- Dining format (tasting menu, family-style, street food, omakase)
- Beverage program (natural wine focus, craft cocktails, rare spirits, tea ceremony)
- Meal rhythm (elaborate multi-course, quick casual, grazing/tapas)
- Dietary identity (plant-forward, nose-to-tail, pescatarian-friendly)

**Pipeline dimension mapping**: `Food & Drink Identity`, `Menu Personality`

**Opposite profiles test**: A natural-wine-and-foraging devotee vs. someone who wants classic French fine dining with a grand cru list — clearly opposite.

### 6. Setting
**What it encodes**: Location, geography, neighborhood, and physical context.

- Urban texture (cobblestone old town, glass-tower downtown, industrial district, residential quiet)
- Nature relationship (oceanfront, mountain perch, desert, urban rooftop garden)
- Neighborhood character (arts district, financial center, village, resort enclave)
- Accessibility and connectivity (walkable, remote, transit-connected)
- Views and orientation (panoramic skyline, courtyard-facing, garden view)
- Surroundings (cultural institutions nearby, nightlife, markets, nature trails)

**Pipeline dimension mapping**: `Location & Context`, `Location & Setting`

**Opposite profiles test**: A remote cliff-edge retreat accessible only by boat vs. a Times Square hotel steps from the subway — clearly opposite.

---

## 2 Preference Dimensions

These have thinner taste spaces — they function more as weighted checklists than rich aesthetic domains. They still influence matching but with lighter embedding treatment.

### Wellness
**What it encodes**: Physical comfort and body-care requirements.

- Spa and treatment facilities
- Fitness infrastructure (gym, pool, yoga studio)
- Sleep technology (mattress quality, blackout, soundproofing)
- Dietary accommodation capability
- Air quality, water quality
- Movement-friendly design (walkable property, bike access)

**Matching mechanics**: Weighted preference score rather than rich signal-to-signal matching. A user who prioritizes wellness gets a bonus when properties have strong wellness signals, but absence of wellness doesn't tank an otherwise excellent match. Not a hard filter — more of a values spectrum.

**Why not a full domain**: The taste space is relatively thin. Most wellness preferences are closer to "has it / doesn't have it" than to opposing aesthetic positions. You don't have a "wellness style" the way you have a "design style."

### Sustainability
**What it encodes**: Environmental and social values alignment.

- Environmental certifications and practices
- Energy and water management
- Local sourcing and community impact
- Waste reduction programs
- Carbon offsetting
- Social responsibility initiatives

**Matching mechanics**: Weighted preference score with sensitivity levels (Leading → Conscious → Passive → Indifferent). Users with high sustainability sensitivity get a bonus for aligned properties. Dealbreaker signals can apply a penalty. Not a hard filter — a user wouldn't skip an otherwise perfect hotel because it lacks solar panels.

**Why not a full domain**: Similar to Wellness — the taste space is narrow. Sustainability preferences are more about degree of caring than opposing aesthetic positions.

---

## Operational Metadata (Not Scored)

Structured data that informs filtering and logistics but doesn't participate in taste matching:

- Hours of operation, seasonal availability
- Booking logistics, cancellation policies
- Price range, payment methods
- Accessibility features
- Capacity, group suitability
- Wi-Fi, workspace availability

---

## Migration: Current → v2 Mapping

### Pipeline Dimension → v2 Domain

| Current Pipeline Dimension | v2 Domain | Notes |
|---|---|---|
| Design Language | Design | Direct map |
| Architectural Style | Design | Direct map |
| Material Quality | Design | Direct map |
| Sensory Environment | Atmosphere | Was colliding with Design in vectors |
| Rhythm | Atmosphere | Energy/tempo signals → Atmosphere |
| Scale & Intimacy | Atmosphere | Spatial feeling |
| Character & Identity | Character | Core character signals stay |
| CulturalEngagement | Character | Cultural depth folds into Character |
| Service Philosophy | Service | Direct map |
| Service Style | Service | Direct map |
| Food & Drink Identity | Food & Drink | Direct map |
| Menu Personality | Food & Drink | Direct map |
| Location & Context | Setting | Renamed |
| Location & Setting | Setting | Direct map |
| Sustainability | Sustainability (pref dim) | Moves to preference dimension |

### User TasteNode Redistribution

The current user profile has 239 TasteNodes across 6 domains, with **Character holding 130 nodes** as a catch-all. Under v2, these need redistribution:

| Current Domain | Node Count | v2 Redistribution |
|---|---|---|
| Character | 130 | Split across Character, Atmosphere, Service, Setting |
| Design | 44 | Mostly stays in Design; some material/sensory → Atmosphere |
| Wellness | 20 | Stays in Wellness (preference dimension) |
| Service | 17 | Stays in Service |
| Food | 14 | Stays in Food & Drink |
| Location | 14 | Stays in Setting |

Key redistribution from Character's 130 nodes:
- Social dynamics, community signals → Character (place identity/belonging)
- Energy, tempo, pace signals → Atmosphere
- Cultural programming, heritage → Character
- Travel-style, logistics → Operational metadata or Setting
- Sensory preferences mixed in → Atmosphere

### Vector Layout Change

**Current (34-dim)**:
- [0-7]: 8 domains (Design, Character, Service, Food, Location, Wellness, Rhythm, CulturalEngagement)
- [8-33]: 26 semantic hash buckets

**Proposed v2 (32-dim)**:
- [0-5]: 6 taste domains (Design, Atmosphere, Character, Service, Food & Drink, Setting)
- [6-7]: 2 preference dimensions (Wellness, Sustainability) — lower weight in similarity
- [8-31]: 24 semantic hash buckets

*Note: Final vector dimensionality TBD based on comparison script results.*

### Radar Axis Migration

| Current Radar Axis | Value | v2 Domain |
|---|---|---|
| Material | 0.98 | Design |
| Sensory | 0.95 | Atmosphere |
| Cultural | 0.88 | Character |
| Spatial | 0.92 | Setting |
| Authenticity | 0.82 | Character (secondary) |
| Social | 0.65 | Service |
| *(missing)* | — | Food & Drink (needs onboarding) |
| *(missing)* | — | Wellness (preference dim) |
| *(missing)* | — | Sustainability (preference dim) |

---

## Comparison Script Plan

To validate this taxonomy before implementation, we'll run both current scoring methods against all 364 places and compare:

1. **Signal-based score** (`computeMatchFromSignals`): Current 8-domain weighted average
2. **Embedding cosine score** (`cosineSimilarity` → `similarityToScore`): Current 34-dim vectors

Output spreadsheet columns:
- Place name, city
- Signal-based overall score (0-100)
- Embedding cosine score (0-100)
- Delta (absolute difference)
- Signal count
- Top signal domain
- Top embedding domain
- Sorted by delta descending

The top 20-30 divergent cases will reveal where the two methods disagree most, informing which taxonomy changes will have the biggest impact.
