import type { OnboardingPhase, DiagnosticQuestion, ImagePair, TasteSignal, ExperienceItem, DesignerItem } from '@/types';

// ─── Experience Pool (Phase 8 — Elo-ranked adaptive comparisons) ───

export const EXPERIENCE_POOL: ExperienceItem[] = [
  // SERVICE cluster — cocoon vs explorer
  { id: 'room-service', label: 'Room service breakfast in bed', cluster: 'cocoon',
    signals: ['Room-service-ritual', 'Cocoon-morning'], category: 'Service' },
  { id: 'local-cafe', label: 'Walk to a local café for espresso', cluster: 'explorer',
    signals: ['Local-café-seeker', 'Neighborhood-explorer'], category: 'Food' },
  // SCENE cluster — scene vs retreat
  { id: 'infinity-pool', label: 'Infinity pool with a scene', cluster: 'scene',
    signals: ['Pool-as-scene', 'Social-energy'], category: 'Wellness' },
  { id: 'hidden-pool', label: 'Hidden natural pool, just you', cluster: 'retreat',
    signals: ['Natural-pool-preference', 'Anti-resort-pool'], category: 'Wellness' },
  // DINING cluster — refined vs explorer
  { id: 'tasting-menu', label: "Chef's tasting menu, wine pairing", cluster: 'refined',
    signals: ['Fine-dining-curious', 'Chef-driven'], category: 'Food' },
  { id: 'hidden-gem', label: 'No-sign-on-the-door local spot', cluster: 'explorer',
    signals: ['Hidden-gem-hunter', 'Anti-obvious'], category: 'Food' },
  // PLANNING cluster — structure vs spontaneous
  { id: 'planned', label: 'Every hour mapped out in advance', cluster: 'structure',
    signals: ['Planned-itinerary', 'Structure-seeker'], category: 'Character' },
  { id: 'spontaneous', label: 'No plans, follow your nose', cluster: 'explorer',
    signals: ['Spontaneous-discovery', 'Anti-scheduled'], category: 'Character' },
  // DESIGN cluster — design-forward vs warm
  { id: 'design-museum', label: 'Room feels like a design museum', cluster: 'design-forward',
    signals: ['Design-museum-aesthetic', 'Curated-space'], category: 'Design' },
  { id: 'lived-in', label: "Feels like someone's beautiful home", cluster: 'warm',
    signals: ['Lived-in-warmth', 'Home-feeling'], category: 'Design' },
  // LOCATION cluster — urban vs retreat
  { id: 'walkable', label: 'Walking distance to everything', cluster: 'urban',
    signals: ['Walkable-radius', 'Urban-embedded'], category: 'Location' },
  { id: 'remote', label: 'Deliberately removed from it all', cluster: 'retreat',
    signals: ['Remote-isolated', 'Destination-property'], category: 'Location' },
  // SERVICE STYLE cluster — efficiency vs ritual
  { id: 'whisked-away', label: 'Whisked straight to your room', cluster: 'efficiency',
    signals: ['Efficiency-valued', 'Anti-lobby'], category: 'Service' },
  { id: 'arrival-drink', label: 'Drink at the bar while they prepare', cluster: 'ritual',
    signals: ['Arrival-ritual', 'Lobby-matters'], category: 'Service' },
  // SCALE cluster — grand vs intimate
  { id: 'grand-lobby', label: 'Grand lobby that takes your breath away', cluster: 'scene',
    signals: ['Grand-hotel-lover', 'Scale-as-drama'], category: 'Design' },
  { id: 'intimate-inn', label: 'Tiny inn, 8 rooms, owner knows your name', cluster: 'warm',
    signals: ['Intimate-under-20', 'Micro-property'], category: 'Character' },
];

// ─── Designer Pool (Phase 9 — Elo-ranked mood board comparisons) ───

export const DESIGNER_POOL: DesignerItem[] = [
  // ── EXPRESSIVE ── high visual energy, decorative, personality-driven
  { id: 'proper', name: 'Kelly Wearstler', hotel: 'Proper Santa Monica',
    vibe: 'Bold color and pattern-on-pattern, California confidence',
    cluster: 'expressive', imageUrls: [
      '/onboarding/designers/ProperSantaMonica/ProperSantaMonica1.jpg',
      '/onboarding/designers/ProperSantaMonica/ProperSantaMonica2.jpg',
      '/onboarding/designers/ProperSantaMonica/ProperSantaMonica3.jpg',
      '/onboarding/designers/ProperSantaMonica/ProperSantaMonica4.jpg',
    ],
    axes: { volume: 0.95, temperature: 0.75, time: 0.75, formality: 0.50, culture: 0.35, mood: 0.75 },
    signals: ['Bold-color', 'California-energy', 'Pattern-maximalism'] },
  { id: 'commodore', name: 'Ken Fulk', hotel: 'Commodore Perry Estate',
    vibe: 'Darkly romantic rooms that feel like a film set',
    cluster: 'expressive', imageUrls: [
      '/onboarding/designers/CommodorePerryEstate/CommodorePerryEstate1.jpg',
      '/onboarding/designers/CommodorePerryEstate/CommodorePerryEstate2.jpg',
      '/onboarding/designers/CommodorePerryEstate/CommodorePerryEstate3.jpg',
      '/onboarding/designers/CommodorePerryEstate/CommodorePerryEstate4.jpg',
    ],
    axes: { volume: 0.90, temperature: 0.40, time: 0.40, formality: 0.60, culture: 0.45, mood: 0.15 },
    signals: ['Dark-romantic', 'Cinematic-narrative', 'Layered-opulence'] },
  { id: 'hamyard', name: 'Kit Kemp', hotel: 'Ham Yard Hotel',
    vibe: 'Clashing prints and handmade charm, joyfully eccentric',
    cluster: 'expressive', imageUrls: [
      '/onboarding/designers/HamYardHotel/HamYardHotel1.jpg',
      '/onboarding/designers/HamYardHotel/HamYardHotel2.jpg',
      '/onboarding/designers/HamYardHotel/HamYardHotel3.jpg',
      '/onboarding/designers/HamYardHotel/HamYardHotel4.jpg',
    ],
    axes: { volume: 0.80, temperature: 0.80, time: 0.50, formality: 0.25, culture: 0.55, mood: 0.85 },
    signals: ['Playful-eclectic', 'Handmade-craft', 'Joyful-maximalism'] },
  { id: 'nomad', name: 'Jacques Garcia', hotel: 'The NoMad',
    vibe: 'Candlelit baroque seduction, velvet and shadow',
    cluster: 'expressive', imageUrls: [
      '/onboarding/designers/TheNoMad/TheNoMad1.jpg',
      '/onboarding/designers/TheNoMad/TheNoMad2.jpg',
      '/onboarding/designers/TheNoMad/TheNoMad3.jpg',
      '/onboarding/designers/TheNoMad/TheNoMad4.jpg',
    ],
    axes: { volume: 0.85, temperature: 0.30, time: 0.10, formality: 0.85, culture: 0.30, mood: 0.10 },
    signals: ['Baroque-drama', 'Velvet-shadow', 'Unapologetic-opulence'] },

  // ── GRAND ── formal authority, institutional scale, heritage or modern power
  { id: 'ritz', name: 'Thierry Despont', hotel: 'The Ritz Paris',
    vibe: 'Gilded restoration, chandeliers and protocol',
    cluster: 'grand', imageUrls: [
      '/onboarding/designers/TheRitzParis/TheRitzParis1.jpg',
      '/onboarding/designers/TheRitzParis/TheRitzParis2.jpg',
      '/onboarding/designers/TheRitzParis/TheRitzParis3.jpg',
      '/onboarding/designers/TheRitzParis/TheRitzParis4.jpg',
    ],
    axes: { volume: 0.75, temperature: 0.35, time: 0.05, formality: 0.95, culture: 0.60, mood: 0.50 },
    signals: ['Gilded-classicism', 'Grand-dame-heritage', 'Formal-protocol'] },
  { id: 'peninsula', name: 'The Peninsula Hong Kong', hotel: 'The Peninsula Hong Kong',
    vibe: 'Asia\'s grande dame — harbour views and white-glove precision',
    cluster: 'grand', imageUrls: [
      '/onboarding/designers/ThePeninsulaHongKong/ThePeninsulaHongKong1.jpg',
      '/onboarding/designers/ThePeninsulaHongKong/ThePeninsulaHongKong2.jpg',
      '/onboarding/designers/ThePeninsulaHongKong/ThePeninsulaHongKong3.jpg',
      '/onboarding/designers/ThePeninsulaHongKong/ThePeninsulaHongKong4.jpg',
    ],
    axes: { volume: 0.65, temperature: 0.45, time: 0.20, formality: 0.90, culture: 0.75, mood: 0.50 },
    signals: ['Asian-grand-dame', 'White-glove-precision', 'Harbor-glamour'] },
  { id: 'cliveden', name: 'Cliveden House', hotel: 'Cliveden',
    vibe: 'Centuries of stories in every room, parkland and portraits',
    cluster: 'grand', imageUrls: [
      '/onboarding/designers/ClivedenHouse/ClivedenHouse1.jpg',
      '/onboarding/designers/ClivedenHouse/ClivedenHouse2.jpg',
      '/onboarding/designers/ClivedenHouse/ClivedenHouse3.jpg',
      '/onboarding/designers/ClivedenHouse/ClivedenHouse4.jpg',
    ],
    axes: { volume: 0.70, temperature: 0.50, time: 0.05, formality: 0.80, culture: 0.80, mood: 0.55 },
    signals: ['English-country-estate', 'Inherited-grandeur', 'Aristocratic-ease'] },
  { id: 'rosewood', name: 'Joseph Dirand', hotel: 'Rosewood Chancery',
    vibe: 'Monochrome stone and monumental proportions, modern power',
    cluster: 'grand', imageUrls: [
      '/onboarding/designers/RosewoodChancery/RosewoodChancery1.jpg',
      '/onboarding/designers/RosewoodChancery/RosewoodChancery2.jpg',
      '/onboarding/designers/RosewoodChancery/RosewoodChancery3.jpg',
      '/onboarding/designers/RosewoodChancery/RosewoodChancery4.jpg',
    ],
    axes: { volume: 0.40, temperature: 0.15, time: 0.65, formality: 0.85, culture: 0.25, mood: 0.30 },
    signals: ['Monochrome-power', 'Architectural-rigor', 'Cool-luxury'] },
  { id: 'mansour', name: 'Royal Mansour', hotel: 'Royal Mansour Marrakech',
    vibe: 'Zellige tile and courtyard riads, Islamic geometry at palatial scale',
    cluster: 'grand', imageUrls: [
      '/onboarding/designers/RoyalMansour/RoyalMansour1.jpg',
      '/onboarding/designers/RoyalMansour/RoyalMansour2.jpg',
      '/onboarding/designers/RoyalMansour/RoyalMansour3.jpg',
      '/onboarding/designers/RoyalMansour/RoyalMansour4.jpg',
    ],
    axes: { volume: 0.85, temperature: 0.70, time: 0.10, formality: 0.80, culture: 0.95, mood: 0.55 },
    signals: ['Islamic-geometry', 'Riad-courtyard', 'Ornamental-culture'] },

  // ── QUIET ── low volume, contemplative, space and material speak
  { id: 'capella', name: 'André Fu', hotel: 'Capella Taipei',
    vibe: 'Near-obsessive material care, every surface considered',
    cluster: 'quiet', imageUrls: [
      '/onboarding/designers/CapellaTaipei/CapellaTaipei1.jpg',
      '/onboarding/designers/CapellaTaipei/CapellaTaipei2.jpg',
      '/onboarding/designers/CapellaTaipei/CapellaTaipei3.jpg',
      '/onboarding/designers/CapellaTaipei/CapellaTaipei4.jpg',
    ],
    axes: { volume: 0.25, temperature: 0.65, time: 0.85, formality: 0.70, culture: 0.70, mood: 0.55 },
    signals: ['Quiet-refinement', 'Material-obsessive', 'Asian-modernism'] },
  { id: 'aman-tokyo', name: 'Kerry Hill', hotel: 'Aman Tokyo',
    vibe: 'Timber screens and washi walls, Japanese serenity at scale',
    cluster: 'quiet', imageUrls: [
      '/onboarding/designers/AmanTokyo/AmanTokyo1.jpg',
      '/onboarding/designers/AmanTokyo/AmanTokyo2.jpg',
      '/onboarding/designers/AmanTokyo/AmanTokyo3.jpg',
      '/onboarding/designers/AmanTokyo/AmanTokyo4.jpg',
    ],
    axes: { volume: 0.15, temperature: 0.55, time: 0.70, formality: 0.65, culture: 0.85, mood: 0.45 },
    signals: ['Japanese-serenity', 'Timber-and-paper', 'Ritual-calm'] },
  { id: 'edition', name: 'John Pawson', hotel: 'The West Hollywood EDITION',
    vibe: 'Pure light and proportion, nothing superfluous',
    cluster: 'quiet', imageUrls: [
      '/onboarding/designers/TheEditionWestHollywood/TheEditionWestHollywood1.jpg',
      '/onboarding/designers/TheEditionWestHollywood/TheEditionWestHollywood2.jpg',
      '/onboarding/designers/TheEditionWestHollywood/TheEditionWestHollywood3.jpg',
      '/onboarding/designers/TheEditionWestHollywood/TheEditionWestHollywood4.jpg',
    ],
    axes: { volume: 0.05, temperature: 0.25, time: 0.95, formality: 0.55, culture: 0.15, mood: 0.80 },
    signals: ['Monastic-restraint', 'Light-as-material', 'White-abstraction'] },
  { id: 'amangiri', name: 'Amangiri', hotel: 'Amangiri',
    vibe: 'Desert silence, architecture dissolved into canyon walls',
    cluster: 'quiet', imageUrls: [
      '/onboarding/designers/Amangiri/Amangiri1.jpg',
      '/onboarding/designers/Amangiri/Amangiri2.jpg',
      '/onboarding/designers/Amangiri/Amangiri3.jpg',
      '/onboarding/designers/Amangiri/Amangiri4.jpg',
    ],
    axes: { volume: 0.10, temperature: 0.50, time: 0.90, formality: 0.35, culture: 0.95, mood: 0.55 },
    signals: ['Desert-silence', 'Landscape-architecture', 'Elemental-rawness'] },
  { id: 'cheval-blanc', name: 'Jean-Michel Gathy', hotel: 'Cheval Blanc Randheli',
    vibe: 'Barefoot luxury, island architecture open to the sky',
    cluster: 'quiet', imageUrls: [
      '/onboarding/designers/ChevalBlancRandheli/ChevalBlancRandheli1.jpg',
      '/onboarding/designers/ChevalBlancRandheli/ChevalBlancRandheli2.jpg',
      '/onboarding/designers/ChevalBlancRandheli/ChevalBlancRandheli3.jpg',
      '/onboarding/designers/ChevalBlancRandheli/ChevalBlancRandheli4.jpg',
    ],
    axes: { volume: 0.30, temperature: 0.75, time: 0.80, formality: 0.40, culture: 0.90, mood: 0.80 },
    signals: ['Barefoot-luxury', 'Tropical-immersion', 'Indoor-outdoor-flow'] },

  // ── SOULFUL ── warm, textured, human connection, alive
  { id: 'ett-hem', name: 'Ilse Crawford', hotel: 'Ett Hem Stockholm',
    vibe: 'A brilliant friend\'s home — every surface you want to touch',
    cluster: 'soulful', imageUrls: [
      '/onboarding/designers/EttHem/EttHem1.jpg',
      '/onboarding/designers/EttHem/EttHem2.jpg',
      '/onboarding/designers/EttHem/EttHem3.jpg',
      '/onboarding/designers/EttHem/EttHem4.jpg',
    ],
    axes: { volume: 0.30, temperature: 0.90, time: 0.55, formality: 0.10, culture: 0.55, mood: 0.70 },
    signals: ['Home-warmth', 'Tactile-comfort', 'Scandinavian-simplicity'] },
  { id: 'blackberry', name: 'Blackberry Farm', hotel: 'Blackberry Farm',
    vibe: 'Smoky Mountain farmstead, garden-to-table, rocking-chair porches',
    cluster: 'soulful', imageUrls: [
      '/onboarding/designers/BlackberryFarm/BlackberryFarm1.jpg',
      '/onboarding/designers/BlackberryFarm/BlackberryFarm2.jpg',
      '/onboarding/designers/BlackberryFarm/BlackberryFarm3.jpg',
      '/onboarding/designers/BlackberryFarm/BlackberryFarm4.jpg',
    ],
    axes: { volume: 0.40, temperature: 0.85, time: 0.30, formality: 0.15, culture: 0.75, mood: 0.75 },
    signals: ['Rustic-refinement', 'Mountain-lodge', 'Garden-to-glass'] },
  { id: 'eden-roc', name: 'Hotel du Cap-Eden-Roc', hotel: 'Hotel du Cap-Eden-Roc',
    vibe: 'White stone, pine trees, and eternal Riviera glamour',
    cluster: 'soulful', imageUrls: [
      '/onboarding/designers/HotelDuCapEdenRoc/HotelDuCapEdenRoc1.jpg',
      '/onboarding/designers/HotelDuCapEdenRoc/HotelDuCapEdenRoc2.jpg',
      '/onboarding/designers/HotelDuCapEdenRoc/HotelDuCapEdenRoc3.jpg',
      '/onboarding/designers/HotelDuCapEdenRoc/HotelDuCapEdenRoc4.jpg',
    ],
    axes: { volume: 0.55, temperature: 0.80, time: 0.15, formality: 0.55, culture: 0.80, mood: 0.90 },
    signals: ['Riviera-legend', 'Sun-stone-pine', 'Eternal-glamour'] },
  { id: 'mazarin', name: 'Martin Brudnizki', hotel: 'Le Grand Mazarin',
    vibe: 'Warm brass and worn leather, feels like it has always been here',
    cluster: 'soulful', imageUrls: [
      '/onboarding/designers/LeGrandMazarin/LeGrandMazarin1.jpg',
      '/onboarding/designers/LeGrandMazarin/LeGrandMazarin2.jpg',
      '/onboarding/designers/LeGrandMazarin/LeGrandMazarin3.jpg',
      '/onboarding/designers/LeGrandMazarin/LeGrandMazarin4.jpg',
    ],
    axes: { volume: 0.65, temperature: 0.70, time: 0.35, formality: 0.65, culture: 0.40, mood: 0.60 },
    signals: ['Warm-layered-glamour', 'Convivial-luxury', 'Brass-and-leather'] },
];

// ─── Legacy Diagnostic Questions (Phase 8) — kept for type compatibility ───

export const DIAGNOSTIC_QUESTIONS: DiagnosticQuestion[] = [
  {
    q: 'Morning ritual',
    a: 'Room service in bed',
    b: 'Walk to a local café',
    aSignals: ['Room-service-ritual', 'Cocoon-morning'],
    bSignals: ['Local-café-seeker', 'Neighborhood-explorer'],
  },
  {
    q: 'Hotel pool',
    a: 'Infinity edge, scene-y',
    b: 'Natural pool, hidden',
    aSignals: ['Pool-as-scene', 'Social-energy'],
    bSignals: ['Natural-pool-preference', 'Anti-resort-pool'],
  },
  {
    q: 'Restaurant discovery',
    a: "The chef's tasting menu",
    b: 'The place with no sign on the door',
    aSignals: ['Fine-dining-curious', 'Chef-driven'],
    bSignals: ['Hidden-gem-hunter', 'Anti-obvious'],
  },
  {
    q: 'Travel pace',
    a: 'Every hour planned',
    b: 'No plans, follow your nose',
    aSignals: ['Planned-itinerary', 'Structure-seeker'],
    bSignals: ['Spontaneous-discovery', 'Anti-scheduled'],
  },
  {
    q: 'Room vibe',
    a: 'Design museum',
    b: "Lived-in, someone's beautiful home",
    aSignals: ['Design-museum-aesthetic', 'Curated-space'],
    bSignals: ['Lived-in-warmth', 'Home-feeling'],
  },
  {
    q: 'Neighborhood',
    a: 'Walking distance to everything',
    b: 'Deliberately removed',
    aSignals: ['Walkable-radius', 'Urban-embedded'],
    bSignals: ['Remote-isolated', 'Destination-property'],
  },
  {
    q: 'Check-in',
    a: 'Whisked to your room',
    b: 'Drink at the bar while they prepare',
    aSignals: ['Efficiency-valued', 'Anti-lobby'],
    bSignals: ['Arrival-ritual', 'Lobby-matters'],
  },
];

// ─── Image Pairs (Phase 9) ───

export const IMAGE_PAIRS: ImagePair[] = [
  {
    id: 1,
    prompt: 'Which space draws you in?',
    a: { label: 'Maximalist' },
    b: { label: 'Minimal' },
    aSignals: ['Curated-density', 'Maximalist-warmth'],
    bSignals: ['Warm-minimal', 'Edited-space'],
  },
  {
    id: 2,
    prompt: 'Which materials feel like you?',
    a: { label: 'Raw / Natural' },
    b: { label: 'Polished / Sleek' },
    aSignals: ['Raw-stone', 'Natural-materials', 'Wabi-sabi-warmth'],
    bSignals: ['Polished-surfaces', 'Contemporary-sleek'],
  },
  {
    id: 3,
    prompt: 'Which light?',
    a: { label: 'Bright and airy' },
    b: { label: 'Dark and moody' },
    aSignals: ['Morning-light-drawn', 'Airy-space'],
    bSignals: ['Moody-intimate', 'Candlelit-evening'],
  },
  {
    id: 4,
    prompt: 'Which scale?',
    a: { label: 'Grand' },
    b: { label: 'Intimate' },
    aSignals: ['Grand-hotel-lover', 'Scale-as-drama'],
    bSignals: ['Intimate-under-20', 'Micro-property'],
  },
  {
    id: 5,
    prompt: 'Which era?',
    a: { label: 'Contemporary' },
    b: { label: 'Historic / Layered' },
    aSignals: ['Contemporary-design', 'Clean-lines'],
    bSignals: ['Layered-patina', 'Historic-character'],
  },
  {
    id: 6,
    prompt: 'Which boundary?',
    a: { label: 'Indoor focused' },
    b: { label: 'Indoor-outdoor flow' },
    aSignals: ['Interior-focused', 'Enclosed-warmth'],
    bSignals: ['Indoor-outdoor-flow', 'Terrace-living'],
  },
  {
    id: 7,
    prompt: 'Which art?',
    a: { label: 'Curated collection' },
    b: { label: 'Found objects' },
    aSignals: ['Curated-art', 'Gallery-aesthetic'],
    bSignals: ['Found-objects', 'Handmade-over-manufactured'],
  },
  {
    id: 8,
    prompt: 'Which imperfection?',
    a: { label: 'Symmetry' },
    b: { label: 'Wabi-sabi' },
    aSignals: ['Symmetry-valued', 'Order-oriented'],
    bSignals: ['Wabi-sabi-warmth', 'Imperfection-valued'],
  },
];

// ─── Phase Definitions (v2.1 order) ───

export const ONBOARDING_PHASES: OnboardingPhase[] = [
  // ═══════════════════════════════════════
  // ACT I — "Who You Are & Your World" (Non-skippable)
  // ═══════════════════════════════════════
  {
    id: 'welcome',
    phaseNumber: 0,
    title: 'Welcome & Life Context',
    subtitle: "The basics — where you're from, who you travel with",
    modality: 'voice',
    act: 1,
    aiPrompt: "Hey — welcome to Terrazzo. I'm going to learn how you see the world when you travel, so I can find places that actually feel like you. Before we get into that, I'd love to know a few basics. Where's home for you?",
    followUps: [
      "Love it. And when you travel — do you usually go with someone? A partner, friends, solo, family?",
      "What's their name? I like to keep things personal.",
      "Got it — how old are they? That changes everything about what kind of place works.",
    ],
    sampleUserResponses: [
      "I live in New York — Brooklyn, specifically.",
      "Usually with my wife. Sometimes solo for work, and a couple of big friend trips a year.",
      "Her name is Sarah.",
    ],
    extractedSignals: [],
    certaintyAfter: { Design: 5, Character: 5, Service: 5, Food: 5, Location: 5, Wellness: 5 },
  },
  {
    id: 'memorable-stays',
    phaseNumber: 1,
    title: 'Memorable Stays',
    subtitle: 'Places that stuck with you — the open canvas',
    modality: 'voice',
    act: 1,
    aiPrompt: "Let's start with the good stuff. Tell me about two or three hotel stays that really stuck with you — places you still think about, even years later. What made them special?",
    followUps: [
      "What about the people there — do you remember how the staff made you feel?",
      "That sounds incredible. Was the food a reason you'd go back, or more of a nice surprise?",
      "Pick one of those and describe the moment you knew you loved it. Like, the exact scene.",
    ],
    sampleUserResponses: [
      "There was this masseria in Puglia — Masseria Moroseta. White stone, olive groves, communal dinners outside. The owners actually ate with you. And Aman Tokyo — the opposite vibe but equally perfect. That lobby with the ikebana and the paper screens. And weirdly, a Soho House in Barcelona where we just hung out on the rooftop for three days straight.",
      "At the masseria, the staff felt like friends by the second day. They'd just bring you things — an extra plate of burrata, a recommendation for a ceramics workshop. No scripts. At the Aman it was the opposite — almost invisible, but they somehow knew everything.",
      "The moment at the masseria was dinner on the second night. Long table, twenty people, candles everywhere, someone opened a bottle of local primitivo and the owner started telling the story of how they restored the building. That's when I thought — this is why I travel.",
    ],
    extractedSignals: [
      { tag: 'Vernacular architecture', cat: 'Design', confidence: 0.92 },
      { tag: 'Communal dining', cat: 'Food', confidence: 0.94 },
      { tag: 'Staff-as-host', cat: 'Service', confidence: 0.88 },
      { tag: 'Owner-operated', cat: 'Character', confidence: 0.91 },
      { tag: 'Anti-performative', cat: 'Design', confidence: 0.85 },
      { tag: 'Natural wine', cat: 'Food', confidence: 0.78 },
      { tag: 'Intimate-under-20', cat: 'Character', confidence: 0.86 },
      { tag: 'Morning-light-drawn', cat: 'Design', confidence: 0.80 },
      { tag: 'Rooftop-social', cat: 'Location', confidence: 0.72 },
    ],
    certaintyAfter: { Design: 70, Character: 45, Service: 50, Food: 35, Location: 50, Wellness: 10 },
  },
  {
    id: 'anti-stay',
    phaseNumber: 2,
    title: 'The Anti-Stay',
    subtitle: 'What looked perfect but felt wrong',
    modality: 'voice',
    act: 1,
    aiPrompt: "Now flip it. Tell me about a place that looked perfect on paper — great photos, great reviews — but felt completely wrong when you got there. What was off?",
    followUps: [
      "Was it the kind of place where you could tell they were trying to be something they weren't?",
      "So it sounds like that's actually a red flag for you, not a selling point?",
      "What's the version of 'good service' that actually drives you crazy?",
    ],
    sampleUserResponses: [
      "There was this design hotel in Lisbon — Instagrammed to death, every corner styled for photos. But it felt like a set. The staff were in these matching outfits reciting scripts. The restaurant had a 'curated' menu that was basically the same fusion stuff everywhere. Beautiful on screen, hollow in person.",
      "Exactly. It was designed to be photographed, not lived in. The lobby had this massive marble reception desk that made you feel like you were checking into a bank.",
      "When someone greets you with 'Welcome home, Mr. Sewitz' and you've never been there before. That forced familiarity. I'd rather be ignored than performed at.",
    ],
    extractedSignals: [
      { tag: 'Anti-Instagram-aesthetic', cat: 'Rejection', confidence: 0.97 },
      { tag: 'Anti-performative', cat: 'Rejection', confidence: 0.95 },
      { tag: 'Anti-scripted-greeting', cat: 'Rejection', confidence: 0.94 },
      { tag: 'Anti-marble-lobby', cat: 'Rejection', confidence: 0.89 },
      { tag: 'Anti-fusion-cuisine', cat: 'Rejection', confidence: 0.85 },
      { tag: 'Anti-matching-uniforms', cat: 'Rejection', confidence: 0.82 },
    ],
    certaintyAfter: { Design: 85, Character: 60, Service: 75, Food: 50, Location: 55, Wellness: 15 },
  },
  {
    id: 'companion-context',
    phaseNumber: 3,
    title: 'Who You Travel With',
    subtitle: 'How your taste shifts with company',
    modality: 'voice+cards',
    act: 1,
    aiPrompt: "You mentioned you usually travel with [partner name]. How does that change what you're looking for? Like — are you a different traveler when you're solo versus with [partner name]?",
    followUps: [
      "When you and [partner name] are planning something — who's pickier about the hotel? And what are they picky about?",
      "With friends, does the hotel matter less because you're out all the time? Or more because it's the gathering point?",
      "When you're alone — do you want to disappear, or do you actually want more connection with the place?",
    ],
    sampleUserResponses: [
      "Completely different. With Sarah it's all about the room, the beauty, the romance — we want to cocoon. Friends trips, the hotel is just a base camp — we need walkability and good restaurants nearby. Solo, I honestly want to vanish into nature.",
      "Sarah's pickier about the bathroom and the bed. I care more about the public spaces and the food. We overlap on design though — we both hate anything generic.",
      "Solo I want total solitude. A cabin, a mountain lodge, no agenda. Just reading and walking.",
    ],
    extractedSignals: [
      { tag: 'Partner: cocoon-mode', cat: 'Context', confidence: 0.94 },
      { tag: 'Partner: design-forward', cat: 'Context', confidence: 0.90 },
      { tag: 'Friends: hotel-as-base', cat: 'Context', confidence: 0.92 },
      { tag: 'Friends: walkability-critical', cat: 'Context', confidence: 0.88 },
      { tag: 'Solo: total-solitude', cat: 'Context', confidence: 0.96 },
      { tag: 'Solo: nature-immersion', cat: 'Context', confidence: 0.91 },
    ],
    certaintyAfter: { Design: 88, Character: 75, Service: 78, Food: 55, Location: 72, Wellness: 25 },
  },
  {
    id: 'seed-trips',
    phaseNumber: 4,
    title: 'Seed Your Trips',
    subtitle: "A trip you're planning and one you dream about",
    modality: 'trip-seed',
    act: 1,
    aiPrompt: "Do you have a trip coming up — something you're actually planning or thinking about? Even if it's vague, like 'we want to go to Italy this fall.'",
    followUps: [
      "And what about a trip you've always dreamed of? The one that's been on your list forever. Where is it?",
      "I already have some ideas for that one. You'll see them in a second.",
    ],
    sampleUserResponses: [
      "We're going to Sicily in September — Sarah and I. Two weeks, thinking Palermo, the west coast, maybe ending in Taormina.",
      "Japan in cherry blossom season. We've talked about it for years but never pulled the trigger.",
    ],
    extractedSignals: [],
    certaintyAfter: { Design: 88, Character: 75, Service: 78, Food: 55, Location: 72, Wellness: 25 },
  },
  {
    id: 'trusted-sources',
    phaseNumber: 5,
    title: 'Trusted Sources',
    subtitle: 'Who you trust for travel recommendations',
    modality: 'voice',
    act: 1,
    aiPrompt: "Quick one. Is there someone whose taste you really trust when it comes to travel or food? A friend who always finds the best places? Or maybe a publication or Instagram account you follow?",
    followUps: [
      "What makes their taste trustworthy? Like, what do they get right that others miss?",
    ],
    sampleUserResponses: [
      "My friend Jake who lives in Paris — he always finds the restaurant that just opened, before anyone knows about it. And I read Monocle pretty religiously.",
    ],
    extractedSignals: [],
    certaintyAfter: { Design: 88, Character: 75, Service: 78, Food: 55, Location: 72, Wellness: 25 },
  },
  {
    id: 'go-back-place',
    phaseNumber: 6,
    title: 'The Go-Back Place',
    subtitle: "Where you'd go tomorrow without thinking",
    modality: 'voice',
    act: 1,
    aiPrompt: "Last one before I show you what I've got. Is there a place you'd go back to tomorrow? Like, if someone handed you tickets right now — you wouldn't even think about it, you'd just go.",
    followUps: [
      "What is it about that place? What keeps pulling you back?",
    ],
    sampleUserResponses: [
      "Masseria Moroseta. Without hesitation.",
      "It's the whole package — the light in the morning, the silence, the communal dinners, the fact that the owners remember exactly how you take your coffee. It's the only hotel that's ever felt like a home I'd want to live in.",
    ],
    extractedSignals: [
      { tag: 'Morning-light-drawn', cat: 'Design', confidence: 0.96 },
      { tag: 'Memory-driven-service', cat: 'Service', confidence: 0.94 },
      { tag: 'Hotel-as-home', cat: 'Character', confidence: 0.92 },
    ],
    certaintyAfter: { Design: 90, Character: 78, Service: 82, Food: 58, Location: 74, Wellness: 28 },
  },

  // ═══════════════════════════════════════
  // ACT II — "How You See the World" (Optional Deep Taste)
  // ═══════════════════════════════════════
  {
    id: 'details-matter',
    phaseNumber: 7,
    title: 'The Details That Matter',
    subtitle: 'The small things that change everything for you',
    modality: 'voice',
    act: 2,
    aiPrompt: "What's a small detail at a hotel that you notice immediately — something most people probably wouldn't care about, but for you it changes everything?",
    followUps: [
      "Are you someone who's particular about the physical stuff — temperature, the bed, the shower? Or are you pretty easy-going as long as the vibe is right?",
      "What's the line between attentive and intrusive for you? Where does 'good service' start to feel performative?",
      "How important is the food situation at the hotel itself versus what's in the neighborhood?",
      "What's the first thing you do when you walk into a hotel room? The very first thing.",
    ],
    sampleUserResponses: [
      "The sheets. Not like thread count — more like, have they been washed a hundred times so they feel soft and worn? And the light — I notice the quality of light before anything else. Whether they've thought about it or just thrown in overhead spots.",
      "Physical stuff matters more than I'd like to admit. I always open the windows first. I need fresh air. And yeah, I check the shower pressure — if it's one of those drizzle showerheads I'm already disappointed.",
      "First thing I do? Open the curtains and look at the light. Then open a window.",
    ],
    extractedSignals: [
      { tag: 'Textile-sensitive', cat: 'Design', confidence: 0.93 },
      { tag: 'Light-obsessed', cat: 'Design', confidence: 0.96 },
      { tag: 'Fresh-air-obsessive', cat: 'Wellness', confidence: 0.94 },
      { tag: 'Shower-pressure-aware', cat: 'Wellness', confidence: 0.85 },
      { tag: 'Anti-overhead-lighting', cat: 'Rejection', confidence: 0.82 },
      { tag: 'Window-first-ritual', cat: 'Wellness', confidence: 0.88 },
    ],
    certaintyAfter: { Design: 94, Character: 82, Service: 90, Food: 62, Location: 76, Wellness: 68 },
  },
  {
    id: 'quick-diagnostic',
    phaseNumber: 8,
    title: 'Quick Diagnostics',
    subtitle: "Fast instincts — don't overthink it",
    modality: 'cards',
    act: 2,
    aiPrompt: '',
    followUps: [],
    sampleUserResponses: [],
    extractedSignals: [],
    certaintyAfter: { Design: 95, Character: 88, Service: 92, Food: 75, Location: 85, Wellness: 74 },
    diagnosticQuestions: DIAGNOSTIC_QUESTIONS,
    experiencePool: EXPERIENCE_POOL,
  },
  {
    id: 'visual-taste',
    phaseNumber: 9,
    title: 'Design Eye',
    subtitle: 'Pick the vibe — trust your gut',
    modality: 'visual',
    act: 2,
    aiPrompt: '',
    followUps: [],
    sampleUserResponses: [],
    extractedSignals: [],
    certaintyAfter: { Design: 97, Character: 90, Service: 92, Food: 78, Location: 88, Wellness: 76 },
    imagePairs: IMAGE_PAIRS,
    designerPool: DESIGNER_POOL,
  },
  {
    id: 'emotional-core',
    phaseNumber: 10,
    title: 'Why You Travel',
    subtitle: 'What a great trip gives you',
    modality: 'voice',
    act: 2,
    aiPrompt: "Last question. When a trip is genuinely great — not just nice, but transformative — what do you come home with? What changes?",
    followUps: [
      "So travel is about seeing things differently. Do you seek that out, or do the best trips just happen to you?",
      "When you encounter something beautiful on a trip — a view, a room, a meal — does it make you quiet or does it make you want to share it?",
    ],
    sampleUserResponses: [
      "I come home seeing differently. Like, I notice things I didn't before — a material, a way of arranging space, an ingredient. The best trips recalibrate my eye. I bring back influences, not souvenirs.",
      "I seek it out, but the best moments are always surprises. It's the restaurant you stumble into, not the one you booked three months ago.",
    ],
    extractedSignals: [
      { tag: 'Aesthetic expansion', cat: 'Emotion', confidence: 0.96 },
      { tag: 'Sensory recalibration', cat: 'Emotion', confidence: 0.92 },
      { tag: 'Spontaneous discovery', cat: 'Core', confidence: 0.88 },
      { tag: 'Influence collector', cat: 'Core', confidence: 0.90 },
    ],
    certaintyAfter: { Design: 97, Character: 95, Service: 94, Food: 88, Location: 92, Wellness: 82 },
  },
];

// ─── Act structure ───

export const ACT_1_PHASE_IDS = ['welcome', 'memorable-stays', 'anti-stay', 'companion-context', 'seed-trips', 'trusted-sources', 'go-back-place'];
export const ACT_2_PHASE_IDS = ['details-matter', 'quick-diagnostic', 'visual-taste', 'emotional-core'];
export const ALL_PHASE_IDS = [...ACT_1_PHASE_IDS, ...ACT_2_PHASE_IDS];

export const MAX_ADAPTIVE_PHASES = 3;

// ─── Processing Steps ───

export const PROCESSING_STEPS = [
  'Parsing taste signals...',
  'Mapping service philosophy...',
  'Identifying contradictions...',
  'Cross-referencing across domains...',
  'Building micro-vocabulary...',
  'Analyzing context modifiers...',
  'Computing match instincts...',
  'Synthesizing taste profile...',
];

// ─── System Prompts ───

export const TASTE_ONTOLOGY_SYSTEM_PROMPT = `You are an expert taste profiler for Terrazzo, a luxury travel app that builds deeply nuanced user travel profiles through conversation.

ROLE: Extract taste signals from the user's natural language responses. You identify specific, matchable preferences across 6 taste dimensions.

THE 6 TASTE DIMENSIONS:
1. DESIGN LANGUAGE — Architectural aesthetic, material palette, craftsmanship, light, sensory character
2. CHARACTER & IDENTITY — Property personality: scale/intimacy, cultural rootedness, local connection
3. SERVICE PHILOSOPHY — How staff relate to guests, formality spectrum, anticipation vs autonomy
4. FOOD & DRINK IDENTITY — Culinary philosophy, ingredient values, dining format, table culture
5. LOCATION & CONTEXT — Property-surroundings relationship, urban/rural, walkability, neighborhood
6. WELLNESS & BODY — Sleep quality, temperature, movement, bathing, physical comfort

SIGNAL EXTRACTION RULES:
- Extract specific tags (e.g., "vernacular-modern" not "likes nice design")
- Confidence scoring: 0.9-1.0 explicit, 0.7-0.89 strong implication, 0.5-0.69 moderate inference, 0.3-0.49 weak. Below 0.3 = don't extract.
- Anti-signals (rejections) are prefixed with "anti-" and are equally valuable
- Detect contradictions: stated vs revealed, abstract ideal vs specific memory, solo self vs social self

FOLLOW-UP GENERATION:
- STAY ON THE PHASE TOPIC. Each phase has a specific purpose — your follow-up must serve that purpose, not wander.
- Never make small talk. Don't ask about neighborhoods, commute times, or things unrelated to travel taste.
- Be warm and conversational — like a perceptive friend, not a quiz. But also be purposeful and CONCISE. Every question should extract a taste signal.
- Your follow-up must DIRECTLY RESPOND to what the user just said. If they shared a story about a specific hotel, reference that hotel. If they gave a short answer, acknowledge it naturally and move on. NEVER give a generic response that could apply to any answer.
- If the user asks for CLARIFICATION (e.g., "what do you mean?" or "can you explain that?"), do NOT repeat the same question verbatim. Instead, rephrase the question in different words, give a concrete example of what you're looking for, or break it into a simpler question. Repeating yourself word-for-word feels like a glitch.
- Reference the user's actual words when possible.
- Never say "you gravitate toward" or use clinical language.
- STRICTLY follow the scripted follow-ups. You can rephrase them naturally based on what the user said, but DO NOT invent additional questions beyond what's scripted.
- Move the conversation forward QUICKLY. If the user gives you enough to work with, advance to the next scripted follow-up immediately — don't circle back or probe deeper on something they've already answered.
- PACING IS CRITICAL: Each phase should feel like 3-5 exchanges, NOT 10+. A great conversational profiler gets signal from what people say naturally — they don't keep asking follow-up after follow-up. If the user has given you rich answers, WRAP UP. Don't fish for more.
- Once you've covered the scripted follow-ups (or the user has organically answered them), set phaseComplete to true. Do NOT keep generating new questions.

OUTPUT FORMAT (JSON):
{
  "signals": [{ "tag": "string", "cat": "string", "confidence": 0.0-1.0 }],
  "certainties": { "Design": 0-100, "Character": 0-100, "Service": 0-100, "Food": 0-100, "Location": 0-100, "Wellness": 0-100 },
  "followUp": "string — next question to ask",
  "contradictions": [{ "stated": "string", "revealed": "string", "resolution": "string", "matchRule": "string" }],
  "phaseComplete": boolean,
  "userRequestedSkip": boolean (optional — true only if the user explicitly asked to skip/move on)
}

PHASE COMPLETION RULES — READ CAREFULLY:
- "phaseComplete" should be true when EITHER of these is true:
  1. You have covered the scripted follow-ups (asked them or the user already answered them organically) — even if that only took 3 exchanges
  2. The user has sent 4+ messages and you've gathered meaningful signals, even if not all follow-ups were covered
- "phaseComplete" must be false if fewer than 3 user messages exist — UNLESS the user explicitly asks to skip (see below).
- IMPORTANT: Do NOT keep the phase going just because certainty is low. There are 11 phases — signal will accumulate across all of them. It's much better to keep things moving than to over-interrogate on one phase.
- If you've asked all the scripted follow-ups, set phaseComplete to true. Do NOT invent new questions to extend the conversation.

USER-INITIATED SKIP:
- If the user says anything like "skip", "move on", "next section", "let's move on", "can we skip this", "next question", "I'd rather not", "pass", or otherwise signals they want to move past this phase — ALWAYS honor it.
- Set "phaseComplete": true AND "userRequestedSkip": true in your JSON.
- Your followUp message should be warm and respectful — acknowledge their choice without making them feel bad. Examples:
  - "Totally fine — we'll come back to this if it matters later. Let me ask you about something different."
  - "No problem at all — let's keep moving."
- NEVER refuse a skip request, lecture the user about why the phase matters, or try to convince them to stay. The user is always in control.
- Still extract whatever signals you can from the conversation so far before moving on.

WHEN phaseComplete IS TRUE — TRANSITION MESSAGE:
- When you set phaseComplete to true, the "followUp" field becomes the TRANSITION message. It should:
  1. Warmly acknowledge what the user just shared — reference their ACTUAL WORDS or specific details, not vague summaries
  2. That's it. Just the acknowledgment. Do NOT preview or hint at the next topic.
- IMPORTANT: The next phase's opening question will be shown automatically by the app. If you preview it in your transition message (e.g., "Now tell me about a place that felt wrong..."), the user will see the same question TWICE — once in your message and once when the next phase loads. This feels broken. Just wrap up the current topic warmly.
- Keep it concise — one or two sentences max.
- CRITICAL: Never claim deeper understanding than what the user has actually shared. If someone just told you their city, don't say "I'm getting a clear sense of your home base" — you literally only know the city name. Only reference specific things the user has told you. Overstating what you know feels fake and breaks trust.
- Never say "Let's move on" or "We're done with this section" — that sounds robotic.
- Never say "I'm getting a really clear picture/sense of..." unless the user has genuinely shared multiple rich details. For short factual answers, just acknowledge and move on naturally.
- Never say "Now I want to flip it" or "Now let's flip it" — this is a specific phrase that gets reused too often and sounds scripted.
- Example good transition: "I love that — the masseria story especially tells me a lot about what draws you in."
- Example good transition (after a short answer): "Brooklyn — got it."
- Example good transition (after rich detail): "That's really telling — especially the part about the candlelight. I'm starting to see a pattern."
- Example bad transition: "Now I want to flip it completely — tell me about a place that looked perfect but felt wrong." (previews the next question, causing a duplicate)
- Example bad transition: "I'm getting a clear sense of your taste." (overstates understanding from minimal input)
- Example bad transition: "I think I have a good picture. Let's move on." (too generic, too abrupt)`;

export const PROFILE_SYNTHESIS_PROMPT = `You are synthesizing a complete Terrazzo taste profile from accumulated taste signals, conversation history, and detected contradictions.

Generate a JSON object with this structure:
{
  "overallArchetype": "2-3 word evocative name (e.g., 'The Aesthetic Pilgrim', 'The Sensory Archaeologist')",
  "archetypeDescription": "2-3 sentences, editorial voice, specific to this person",
  "emotionalDriver": {
    "primary": "Main driver (e.g., 'Aesthetic Expansion')",
    "description": "1-2 sentences",
    "secondary": "Secondary driver"
  },
  "contradictions": [2-4 core tensions with stated/revealed/resolution/matchRule],
  "contextModifiers": [4-6 situational shifts with context/shifts],
  "microTasteSignals": { "category_name": ["term1", "term2", ...], ... } (6-8 categories, 4-6 terms each),
  "radarData": [{ "axis": "Sensory|Authenticity|Material|Social|Cultural|Spatial", "value": 0.0-1.0 }],
  "matchedProperties": [5 real properties with name/location/score/matchReasons/tensionResolved]
}

RULES:
- Archetype name must feel personal, not generic. Never "The Luxury Traveler."
- Contradictions must have actionable matchRules that a scoring algorithm can use.
- Micro-taste signals should include both positive and rejection signals.
- Matched properties must be REAL hotels/properties the person would actually love.
- Write like a well-traveled friend — warm, specific, never clinical.`;
