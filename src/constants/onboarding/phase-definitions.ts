import type { OnboardingPhase } from '@/types';
import { DIAGNOSTIC_QUESTIONS, IMAGE_PAIRS } from './legacy-diagnostics';
import { EXPERIENCE_POOL } from './experience-pool';
import { DESIGNER_POOL } from './designer-pool';

// ─── Phase Definitions (v3 — 3-Act Adaptive Structure) ───
// Act 0: Ground Truth (~3 min) — fast structured signal, no LLM
// Act 1: Targeted Depth (~5 min) — voice + slider + adaptive
// Act 2: Deep Taste (~4 min) — voice + adaptive gap-fill

export const ONBOARDING_PHASES: OnboardingPhase[] = [
  // ═══════════════════════════════════════
  // ACT 0 — "Ground Truth" (fast structured capture)
  // ═══════════════════════════════════════
  {
    id: 'quick-bio',
    phaseNumber: 0,
    title: 'A Few Basics',
    subtitle: "We'll keep it quick — just the essentials",
    modality: 'form',
    act: 0,
    aiPrompt: '',
    followUps: [],
    sampleUserResponses: [],
    extractedSignals: [],
    certaintyAfter: { Design: 0, Atmosphere: 0, Character: 0, Service: 0, FoodDrink: 0, Setting: 0, Wellness: 0, Sustainability: 0 },
  },
  {
    id: 'instinct-round',
    phaseNumber: 1,
    title: 'Quick Instincts',
    subtitle: "Don't overthink it — go with your gut",
    modality: 'cards',
    act: 0,
    aiPrompt: '',
    followUps: [],
    sampleUserResponses: [],
    extractedSignals: [],
    certaintyAfter: { Design: 20, Atmosphere: 25, Character: 15, Service: 15, FoodDrink: 10, Setting: 30, Wellness: 10, Sustainability: 0 },
    diagnosticQuestions: DIAGNOSTIC_QUESTIONS,
    experiencePool: EXPERIENCE_POOL,
  },
  {
    id: 'visual-taste',
    phaseNumber: 2,
    title: 'Design Eye',
    subtitle: 'Pick the space that draws you in',
    modality: 'visual',
    act: 0,
    aiPrompt: '',
    followUps: [],
    sampleUserResponses: [],
    extractedSignals: [],
    certaintyAfter: { Design: 55, Atmosphere: 35, Character: 25, Service: 18, FoodDrink: 12, Setting: 35, Wellness: 12, Sustainability: 0 },
    imagePairs: IMAGE_PAIRS,
    designerPool: DESIGNER_POOL,
  },
  {
    id: 'property-reactions-0',
    phaseNumber: 3,
    title: 'First Impressions',
    subtitle: 'Real hotels — react honestly',
    modality: 'property-reactions',
    act: 0,
    aiPrompt: '',
    followUps: [],
    sampleUserResponses: [],
    extractedSignals: [],
    certaintyAfter: { Design: 65, Atmosphere: 50, Character: 45, Service: 35, FoodDrink: 25, Setting: 48, Wellness: 20, Sustainability: 5 },
    cardCount: 10,
    // targetDomains set at runtime after instinct-round + visual-taste signals
  },

  // ═══════════════════════════════════════
  // ACT 1 — "Targeted Depth" (voice + structured + adaptive)
  // ═══════════════════════════════════════
  {
    id: 'service-style',
    phaseNumber: 4,
    title: 'How You Like to Be Taken Care Of',
    subtitle: 'Service that fits, not service that performs',
    modality: 'slider',
    act: 1,
    aiPrompt: '',
    followUps: [],
    sampleUserResponses: [],
    extractedSignals: [
      { tag: 'Service philosophy', cat: 'Service', confidence: 0.88 },
      { tag: 'Formality preference', cat: 'Service', confidence: 0.85 },
    ],
    certaintyAfter: { Design: 67, Atmosphere: 52, Character: 48, Service: 70, FoodDrink: 27, Setting: 50, Wellness: 22, Sustainability: 5 },
    sliderDefs: [
      {
        id: 'visibility',
        leftLabel: 'Invisible — I only see staff when I need them',
        rightLabel: 'Present — I want warmth and check-ins',
        leftSignals: ['Invisible-service', 'Privacy-first', 'Self-sufficient-traveler'],
        rightSignals: ['Proactive-service', 'Warmth-seeking', 'Relationship-with-staff'],
        domain: 'Service',
      },
      {
        id: 'formality',
        leftLabel: 'Formal — white gloves, last names',
        rightLabel: 'Casual — first names, no fuss',
        leftSignals: ['Formal-service', 'Traditional-hospitality', 'Protocol-appreciator'],
        rightSignals: ['Casual-service', 'First-name-basis', 'Anti-formality'],
        domain: 'Service',
      },
      {
        id: 'anticipation',
        leftLabel: 'Anticipatory — they know before I ask',
        rightLabel: "On-demand — I'll ask when I need it",
        leftSignals: ['Anticipatory-service', 'Detail-remembered', 'Preference-tracking'],
        rightSignals: ['On-demand-service', 'Autonomy-first', 'Low-touch-preferred'],
        domain: 'Service',
      },
      {
        id: 'programming',
        leftLabel: 'Minimal — just the room and the setting',
        rightLabel: 'Curated — tastings, tours, experiences',
        leftSignals: ['Minimal-programming', 'Self-directed-stay', 'Space-over-activity'],
        rightSignals: ['Programming-rich', 'Curated-experiences', 'Hotel-as-guide'],
        domain: 'Service',
      },
    ],
  },
  {
    id: 'sustainability-check',
    phaseNumber: 5,
    title: 'Values & Impact',
    subtitle: 'One question — how much this matters to you',
    modality: 'scale',
    act: 1,
    aiPrompt: '',
    followUps: [],
    sampleUserResponses: [],
    extractedSignals: [
      { tag: 'Sustainability sensitivity', cat: 'Sustainability', confidence: 0.85 },
    ],
    certaintyAfter: { Design: 67, Atmosphere: 52, Character: 48, Service: 70, FoodDrink: 27, Setting: 50, Wellness: 22, Sustainability: 30 },
  },
  {
    id: 'memorable-stays',
    phaseNumber: 6,
    title: 'Memorable Stays',
    subtitle: 'Places that stuck with you — the open canvas',
    modality: 'voice',
    act: 1,
    aiPrompt: "Let's start with the good stuff. Tell me about two or three hotel stays that really stuck with you — places you still think about, even years later. What made them special?",
    followUps: [
      "What about the people there — do you remember how the staff made you feel?",
      "That sounds incredible. Was the food a reason you'd go back, or more of a nice surprise?",
      "Pick one of those and describe the moment you knew you loved it. Like, the exact scene.",
      // Companion-context folded in as follow-up:
      "When you travel with someone — a partner, friends, family — does what you look for in a hotel change? How?",
    ],
    sampleUserResponses: [
      "There was this masseria in Puglia — Masseria Moroseta. White stone, olive groves, communal dinners outside. The owners actually ate with you. And Aman Tokyo — the opposite vibe but equally perfect. That lobby with the ikebana and the paper screens.",
      "At the masseria, the staff felt like friends by the second day. At the Aman it was the opposite — almost invisible, but they somehow knew everything.",
      "The moment at the masseria was dinner on the second night. Long table, twenty people, candles everywhere, someone opened a bottle of local primitivo and the owner started telling the story of how they restored the building.",
    ],
    extractedSignals: [
      { tag: 'Vernacular architecture', cat: 'Design', confidence: 0.92 },
      { tag: 'Communal dining', cat: 'FoodDrink', confidence: 0.94 },
      { tag: 'Staff-as-host', cat: 'Service', confidence: 0.88 },
      { tag: 'Owner-operated', cat: 'Character', confidence: 0.91 },
      { tag: 'Anti-performative', cat: 'Design', confidence: 0.85 },
      { tag: 'Natural wine', cat: 'FoodDrink', confidence: 0.78 },
      { tag: 'Intimate-under-20', cat: 'Character', confidence: 0.86 },
    ],
    certaintyAfter: { Design: 75, Atmosphere: 58, Character: 60, Service: 75, FoodDrink: 40, Setting: 55, Wellness: 25, Sustainability: 30 },
  },
  {
    id: 'anti-stay',
    phaseNumber: 7,
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
      "There was this design hotel in Lisbon — Instagrammed to death, every corner styled for photos. But it felt like a set. The staff were in these matching outfits reciting scripts.",
      "Exactly. It was designed to be photographed, not lived in.",
      "When someone greets you with 'Welcome home' and you've never been there before. That forced familiarity.",
    ],
    extractedSignals: [
      { tag: 'Anti-Instagram-aesthetic', cat: 'Rejection', confidence: 0.97 },
      { tag: 'Anti-performative', cat: 'Rejection', confidence: 0.95 },
      { tag: 'Anti-scripted-greeting', cat: 'Rejection', confidence: 0.94 },
      { tag: 'Anti-marble-lobby', cat: 'Rejection', confidence: 0.89 },
      { tag: 'Anti-fusion-cuisine', cat: 'Rejection', confidence: 0.85 },
    ],
    certaintyAfter: { Design: 82, Atmosphere: 65, Character: 68, Service: 80, FoodDrink: 48, Setting: 58, Wellness: 28, Sustainability: 30 },
  },
  {
    id: 'adaptive-conversation',
    phaseNumber: 8,
    title: 'Going Deeper',
    subtitle: 'Filling in the gaps we noticed',
    modality: 'voice',
    act: 1,
    isAdaptive: true,
    // aiPrompt is set dynamically based on coldest domain from gap analysis
    aiPrompt: "There's one area I'd love to understand better about how you travel. [Dynamic — coldest domain prompt inserted at runtime]",
    followUps: [
      "Tell me more about that — what makes that important to you?",
      "Got it. And when it's done well — what does that actually look like?",
    ],
    sampleUserResponses: [],
    extractedSignals: [],
    certaintyAfter: { Design: 85, Atmosphere: 72, Character: 72, Service: 82, FoodDrink: 55, Setting: 62, Wellness: 35, Sustainability: 32 },
  },

  // ═══════════════════════════════════════
  // ACT 2 — "Deep Taste" (voice + adaptive gap-fill)
  // ═══════════════════════════════════════
  {
    id: 'details-matter',
    phaseNumber: 9,
    title: 'The Details That Matter',
    subtitle: 'Rank what changes everything for you',
    modality: 'force-rank',
    act: 2,
    aiPrompt: '',
    followUps: [],
    sampleUserResponses: [],
    extractedSignals: [
      { tag: 'Detail-priority-ranked', cat: 'Design', confidence: 0.93 },
    ],
    certaintyAfter: { Design: 90, Atmosphere: 78, Character: 78, Service: 85, FoodDrink: 60, Setting: 68, Wellness: 55, Sustainability: 34 },
    forceRankItems: [
      {
        id: 'light-quality',
        label: 'The quality of light',
        description: 'Natural light, the way it falls through a room, how it changes through the day',
        signals: ['Light-obsessed', 'Natural-light-priority', 'Window-first'],
        domain: 'Design',
      },
      {
        id: 'textiles',
        label: 'How the bed feels',
        description: 'The linens, the mattress, the pillows — that first moment you lie down',
        signals: ['Textile-sensitive', 'Bed-quality-priority', 'Tactile-standards'],
        domain: 'Design',
      },
      {
        id: 'silence',
        label: 'Silence and stillness',
        description: 'No hum of AC, no hallway noise, the ability to actually rest',
        signals: ['Silence-sensitive', 'Acoustic-aware', 'Stillness-seeker'],
        domain: 'Atmosphere',
      },
      {
        id: 'scent',
        label: 'How a place smells',
        description: 'Fresh air, no synthetic fragrance, maybe woodfire or salt air',
        signals: ['Scent-conscious', 'Anti-synthetic-fragrance', 'Fresh-air-obsessive'],
        domain: 'Wellness',
      },
      {
        id: 'food-on-site',
        label: 'The food at the hotel itself',
        description: 'A restaurant worth eating at, not just room service as an afterthought',
        signals: ['Hotel-food-matters', 'Destination-dining', 'In-house-restaurant-priority'],
        domain: 'FoodDrink',
      },
      {
        id: 'arrival-moment',
        label: 'The first five minutes',
        description: 'Check-in, the welcome, walking into the room — that initial impression',
        signals: ['Arrival-ritual-matters', 'First-impression-sensitive', 'Check-in-experience'],
        domain: 'Service',
      },
      {
        id: 'bathroom',
        label: 'The bathroom',
        description: 'Water pressure, good products, a bathtub, proper lighting',
        signals: ['Bathroom-quality-priority', 'Shower-pressure-aware', 'Bathing-ritual'],
        domain: 'Wellness',
      },
      {
        id: 'view',
        label: 'What you see from the room',
        description: 'The view, the balcony, the connection to the landscape',
        signals: ['View-priority', 'Room-landscape-connection', 'Outdoor-access'],
        domain: 'Setting',
      },
    ],
  },
  {
    id: 'emotional-core',
    phaseNumber: 10,
    title: 'Why You Travel',
    subtitle: 'What a great trip actually gives you',
    modality: 'quick-choice',
    act: 2,
    aiPrompt: '',
    followUps: [],
    sampleUserResponses: [],
    extractedSignals: [
      { tag: 'Emotional-drivers-identified', cat: 'Emotion', confidence: 0.90 },
    ],
    certaintyAfter: { Design: 94, Atmosphere: 85, Character: 85, Service: 88, FoodDrink: 72, Setting: 78, Wellness: 62, Sustainability: 38 },
    quickChoiceMax: 3,
    quickChoiceOptions: [
      {
        id: 'recalibrate-eye',
        label: 'My eye gets recalibrated',
        description: 'I come home noticing things differently — a material, a color, a way of arranging space',
        signals: ['Aesthetic-expansion', 'Sensory-recalibration', 'Design-driven-traveler'],
        domain: 'Emotion',
      },
      {
        id: 'deep-rest',
        label: 'I actually rest',
        description: 'Not just sleep — a deeper unwinding that takes days to build',
        signals: ['Deep-rest-seeker', 'Slow-unwinding', 'Recovery-traveler'],
        domain: 'Emotion',
      },
      {
        id: 'connect-people',
        label: 'I connect with the people I\'m with',
        description: 'Travel strips away the noise — the best trips bring us closer',
        signals: ['Relational-traveler', 'Shared-experience-priority', 'Bonding-through-travel'],
        domain: 'Emotion',
      },
      {
        id: 'surprise-discovery',
        label: 'I discover something I didn\'t expect',
        description: 'A neighborhood, a flavor, a conversation — the unplanned moments',
        signals: ['Spontaneous-discovery', 'Serendipity-seeker', 'Anti-over-planning'],
        domain: 'Core',
      },
      {
        id: 'sense-of-place',
        label: 'I feel where I am',
        description: 'The place seeps in — its rhythms, its light, the way people live there',
        signals: ['Place-immersion', 'Local-rhythm-seeker', 'Cultural-absorption'],
        domain: 'Core',
      },
      {
        id: 'eat-differently',
        label: 'I eat things I\'d never eat at home',
        description: 'Travel is permission to be adventurous, indulgent, or both',
        signals: ['Culinary-adventurer', 'Food-as-travel-driver', 'Eating-adventurously'],
        domain: 'FoodDrink',
      },
      {
        id: 'beauty-quiet',
        label: 'Beauty makes me quiet',
        description: 'A view, a room, a courtyard — certain moments demand stillness',
        signals: ['Beauty-seeker', 'Contemplative-traveler', 'Aesthetic-reverence'],
        domain: 'Atmosphere',
      },
      {
        id: 'come-home-changed',
        label: 'I come home slightly changed',
        description: 'New influences, new references, a subtly different version of myself',
        signals: ['Influence-collector', 'Transformation-seeker', 'Identity-through-travel'],
        domain: 'Core',
      },
    ],
  },
  {
    id: 'gap-fill-reactions',
    phaseNumber: 11,
    title: 'A Few More Reactions',
    subtitle: 'Hotels chosen just for you — we want to nail this',
    modality: 'property-reactions',
    act: 2,
    isAdaptive: true,
    aiPrompt: '',
    followUps: [],
    sampleUserResponses: [],
    extractedSignals: [],
    certaintyAfter: { Design: 96, Atmosphere: 90, Character: 90, Service: 92, FoodDrink: 80, Setting: 85, Wellness: 70, Sustainability: 42 },
    cardCount: 8,
    // targetDomains set at runtime from Act 1 gap analysis
  },
];

// ─── Legacy act structure (kept for backward compat during migration) ───

export const ACT_1_PHASE_IDS = ['welcome', 'memorable-stays', 'setting-instinct', 'anti-stay', 'companion-context', 'service-style', 'seed-trips', 'trusted-sources', 'sustainability-values', 'go-back-place'];
export const ACT_2_PHASE_IDS = ['details-matter', 'quick-diagnostic', 'visual-taste', 'emotional-core'];
export const ALL_PHASE_IDS = [...ACT_1_PHASE_IDS, ...ACT_2_PHASE_IDS];

export const MAX_ADAPTIVE_PHASES = 3;
