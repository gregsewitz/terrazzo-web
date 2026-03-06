import type { DiagnosticQuestion, ImagePair } from '@/types';

// ─── Legacy Diagnostic Questions — kept for type compatibility ───

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

// ─── Image Pairs ───

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
