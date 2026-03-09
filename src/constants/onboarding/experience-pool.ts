import type { ExperienceItem } from '@/types';

// ─── Experience Pool (Elo-ranked adaptive comparisons) ───
// Each item has a `pairWith` partner and `dimension` label so the Elo algorithm
// always presents coherent A/B comparisons within the same travel dimension.
//
// DESIGN PRINCIPLES (v3.5 audit — corpus-aligned):
// 1. Maximize unique cluster pairings — each dimension pits two DIFFERENT clusters
//    against each other so 14 Elo rounds produce maximum cluster separation
// 2. Balance cluster representation — 9 clusters (cocoon, explorer, scene,
//    retreat, structure, refined, warm, urban, efficiency) across 18 items
// 3. No redundancy with later phases (Act 2 behavioral-anchoring, Act 3 visual-pairs)
// 4. ALL signal tags are verified entries in signal-clusters.json (v3.3 corpus)
//    — direct cluster hits, no word-overlap fallback
// 5. Each item's 3 signals target 2-3 DISTINCT clusters for broader vector activation
//
// CLUSTER PAIR MATRIX (9 dimensions → 8 unique cluster pairings):
//   Dining Style:          refined vs explorer
//   How You Recharge:      structure vs cocoon
//   Day Pace:              structure vs warm
//   Property vs Dest:      cocoon vs explorer  (fundamental — worth 2nd test)
//   Climate Draw:          scene vs retreat
//   Location Feel:         urban vs retreat
//   After Dark:            cocoon vs explorer  (orthogonal axis — social energy)
//   Scale & Intimacy:      scene vs warm
//   Service Relationship:  warm vs efficiency  (new — high discrimination on service culture)
//
// Cluster balance: cocoon(3) explorer(3) warm(3) scene(2) retreat(2) structure(2) refined(1) urban(1) efficiency(1)
//
// SIGNAL → CLUSTER MAP (54 signals → 47 unique v3.5 clusters):
//   All signal tags verified against signalToCluster in signal-clusters.json
//   Zero fallback-to-word-overlap signals — every tag is a direct corpus hit

export const EXPERIENCE_POOL: ExperienceItem[] = [
  // ── DIMENSION 1: Dining Style (refined vs explorer) ──
  // High discrimination: directly shapes restaurant recs and hotel F&B fit
  // Signals hit clusters: 193 (FoodDrink:course-driven), 96 (Character:michelin), 208 (FoodDrink:omakase)
  { id: 'tasting-menu', label: 'A ten-course tasting menu — trust the chef completely', cluster: 'refined',
    pairWith: 'neighborhood-spot', dimension: 'Dining Style',
    scene: 'A counter for eight, courses arriving in silence, sake pairing',
    signals: ['tasting-menu-driven', 'michelin-starred-dining', 'omakase-counter-dining-format'], category: 'FoodDrink' },
  // Signals hit clusters: 57 (Character:hidden-gem), 58 (Character:institution), 47 (Atmosphere:discovery)
  { id: 'neighborhood-spot', label: 'The place with no sign — a friend told you about it', cluster: 'explorer',
    pairWith: 'tasting-menu', dimension: 'Dining Style',
    scene: 'A narrow door, handwritten menu, the owner remembers your name',
    signals: ['hidden-gem-positioning', 'local-institution-status', 'discovery-driven-spontaneity'], category: 'FoodDrink' },

  // ── DIMENSION 2: How You Recharge (structure vs cocoon) ──
  // Captures wellness identity: active vs. still. Shapes spa, fitness, activity recs
  // Signals hit clusters: 46 (Atmosphere:morning-program), 396 (Wellness:fitness), 11 (Atmosphere:dawn)
  { id: 'active-recharge', label: 'A long run at dawn, a hard swim, a hike before breakfast', cluster: 'structure',
    pairWith: 'still-recharge', dimension: 'How You Recharge',
    scene: 'Trail shoes by the door, the sun not yet up, your body earning the day',
    signals: ['morning-yoga-program', 'fitness-center-access', 'dawn-departure-rhythm'], category: 'Wellness' },
  // Signals hit clusters: 76 (Character:spa-destination), 397 (Wellness:thermal), 177 (Design:soaking-tub)
  { id: 'still-recharge', label: 'A deep bath, a long massage, doing absolutely nothing', cluster: 'cocoon',
    pairWith: 'active-recharge', dimension: 'How You Recharge',
    scene: 'Steam rising, eucalyptus, the sound of water filling stone',
    signals: ['spa-as-destination', 'thermal-contrast-bathing', 'deep-soaking-tubs'], category: 'Wellness' },

  // ── DIMENSION 3: Day Pace (structure vs warm) ──
  // Not covered by conversation phases — reveals how to structure itineraries
  // Signals hit clusters: 133 (Character:guided-tour), 285 (Service:excursion), 89 (Character:activity-heavy)
  { id: 'packed-day', label: 'Pack the day — there\'s so much to see', cluster: 'structure',
    pairWith: 'slow-day', dimension: 'Day Pace',
    scene: 'Museum at 10, lunch reservation at 1, walking tour at 3',
    signals: ['guided-tour-program', 'excursion-snack-service', 'activity-heavy-programming'], category: 'Atmosphere' },
  // Signals hit clusters: 14 (Atmosphere:languid-pace), 14 (same — strong activation), 47 (Atmosphere:spontaneity)
  { id: 'slow-day', label: 'Two things a day, max — leave room for the unplanned', cluster: 'warm',
    pairWith: 'packed-day', dimension: 'Day Pace',
    scene: 'A long lunch that becomes the whole afternoon',
    signals: ['languid-unhurried-pace', 'unhurried-lingering-pace', 'aimless-wandering-encouraged'], category: 'Atmosphere' },

  // ── DIMENSION 4: Property vs Destination ──
  // THE most fundamental signal — changes every recommendation Terrazzo makes
  // Signals hit clusters: 35 (Atmosphere:disconnection), 342 (Setting:self-contained), 57 (Character:destination)
  { id: 'perfect-hotel', label: 'Perfect hotel in a so-so city', cluster: 'cocoon',
    pairWith: 'perfect-city', dimension: 'What Matters More',
    scene: 'The room is extraordinary, the city is forgettable',
    signals: ['no-desire-to-leave-property', 'self-contained-destination-resort', 'destination-hotel-positioning'], category: 'Character' },
  // Signals hit clusters: 355 (Setting:walkable), 59 (Character:cultural-immersion), 338 (Setting:street-level)
  { id: 'perfect-city', label: 'Perfect city, forgettable hotel', cluster: 'explorer',
    pairWith: 'perfect-hotel', dimension: 'What Matters More',
    scene: 'The hotel is fine — but the city is everything',
    signals: ['walkable-neighborhood-context', 'cultural-immersion-programming', 'street-level-accessibility'], category: 'Setting' },

  // ── DIMENSION 5: Climate Draw (scene vs retreat) ──
  // Warm-drawn vs cold-drawn correlates with actual booking behavior
  // Signals hit clusters: 395 (Wellness:tropical-climate), 24 (Atmosphere:light), 4 (Atmosphere:turquoise)
  { id: 'warm-drawn', label: 'Warm air on your skin — sandals, sundresses, salt', cluster: 'scene',
    pairWith: 'cold-drawn', dimension: 'Climate Draw',
    scene: 'Terracotta, turquoise water, jasmine at night, bare shoulders',
    signals: ['tropical-climate-integration', 'mediterranean-light-quality', 'turquoise-water-luminosity'], category: 'Setting' },
  // Signals hit clusters: 8 (Atmosphere:fireplace), 372 (Setting:alpine), 376 (Setting:ski-access)
  { id: 'cold-drawn', label: 'Crisp air, wool layers, firelight — the colder the better', cluster: 'retreat',
    pairWith: 'warm-drawn', dimension: 'Climate Draw',
    scene: 'Woodsmoke, first frost, a heavy door closing behind you',
    signals: ['fireplace-warmth-ritual', 'alpine-valley-setting', 'ski-in-ski-out-access'], category: 'Setting' },

  // ── DIMENSION 6: Location Feel (urban vs retreat) ──
  // Signals hit clusters: 355 (Setting:walkable), 338 (Setting:street-level), 341 (Setting:neighborhood)
  { id: 'walkable', label: 'Step outside and you\'re in the middle of it', cluster: 'urban',
    pairWith: 'remote', dimension: 'Location Feel',
    scene: 'Turn left, a bakery. Turn right, the museum. The city is your lobby.',
    signals: ['walkable-restaurant-neighborhood', 'street-level-direct-access', 'pedestrian-scale-neighborhood'], category: 'Setting' },
  // Signals hit clusters: 128 (Character:digital-detox), 35 (Atmosphere:disconnection), 345 (Setting:zero-urban)
  { id: 'remote', label: 'Dirt road, no signal — just you and the landscape', cluster: 'retreat',
    pairWith: 'walkable', dimension: 'Location Feel',
    scene: 'Dirt road, no phone signal, only the landscape and the quiet',
    signals: ['digital-detox-by-design', 'complete-disconnection-tempo', 'zero-urban-infrastructure'], category: 'Setting' },

  // ── DIMENSION 7: After Dark (cocoon vs explorer) ──
  // Not covered by conversation phases — reveals nightlife/social energy
  // Signals hit clusters: 269 (Service:turndown), 10 (Atmosphere:cocooning), 30 (Atmosphere:quiet-evening)
  { id: 'early-night', label: 'In bed with a book by 10 — the best part of vacation', cluster: 'cocoon',
    pairWith: 'late-night', dimension: 'After Dark',
    scene: 'Linen sheets, a reading lamp, silence outside the window',
    signals: ['evening-turndown-ritual', 'cocooning-aesthetic', 'quiet-evening-atmosphere'], category: 'Atmosphere' },
  // Signals hit clusters: 17 (Atmosphere:nightlife), 129 (Character:speakeasy), 6 (Atmosphere:live-jazz)
  { id: 'late-night', label: 'Finding the bar the locals disappear to at midnight', cluster: 'explorer',
    pairWith: 'early-night', dimension: 'After Dark',
    scene: 'A door with no sign, jazz or candlelight, one more glass',
    signals: ['late-night-bar-culture', 'speakeasy-bar-concept', 'live-jazz-programming'], category: 'Atmosphere' },

  // ── DIMENSION 8: Scale & Intimacy (scene vs warm) ──
  // Signals hit clusters: 53 (Character:palace), 99 (Character:historic-conversion), 146 (Design:opulent)
  { id: 'grand-lobby', label: 'Grand hotel — soaring ceilings, marble, the drama of scale', cluster: 'scene',
    pairWith: 'intimate-inn', dimension: 'Scale & Intimacy',
    scene: 'Thirty-foot ceilings, marble floors, the echo of your footsteps',
    signals: ['palace-hotel-setting', 'historic-palace-conversion', 'opulent-interiors'], category: 'Design' },
  // Signals hit clusters: 78 (Character:owner-operated), 100 (Character:intimate-scale), 33 (Atmosphere:family-run)
  { id: 'intimate-inn', label: 'Eight rooms, the owner pours your wine at dinner', cluster: 'warm',
    pairWith: 'grand-lobby', dimension: 'Scale & Intimacy',
    scene: 'The owner pours your wine at dinner, their kids play in the garden',
    signals: ['owner-operated-intimacy', 'intimate-scale-property', 'family-run-intimacy'], category: 'Character' },

  // ── DIMENSION 9: Service Relationship (warm vs efficiency) ──
  // High discrimination: separates guests who want personal warmth from those who prefer seamless invisibility
  // Hits 5 clusters not reached by any other dimension — biggest gap-filler
  // Signals hit clusters: 304 (Service:first-name), 87 (Character:repeat-guest), 102 (Service:anticipatory)
  { id: 'know-your-name', label: 'Staff who become friends — they ask about your kids, your trip, your life', cluster: 'warm',
    pairWith: 'invisible-service', dimension: 'Service Style',
    scene: 'The concierge hugs you goodbye, the chef joins you for a glass after dinner',
    signals: ['first-name-basis-service', 'repeat-guest-recognition', 'anticipatory-service-culture'], category: 'Service' },
  // Signals hit clusters: 317 (Service:invisible), 279 (Service:transactional), 279 (same — strong activation)
  { id: 'invisible-service', label: 'Left completely alone — no small talk, no fuss, total privacy', cluster: 'efficiency',
    pairWith: 'know-your-name', dimension: 'Service Style',
    scene: 'You check in on your phone, never learn anyone\'s name, and that\'s perfect',
    signals: ['invisible-service-philosophy', 'self-service-model', 'transactional-efficiency-over-warmth'], category: 'Service' },
];
