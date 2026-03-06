import type { ExperienceItem } from '@/types';

// ─── Experience Pool (Elo-ranked adaptive comparisons) ───
// Each item has a `pairWith` partner and `dimension` label so the Elo algorithm
// always presents coherent A/B comparisons within the same travel dimension.

export const EXPERIENCE_POOL: ExperienceItem[] = [
  // ── DIMENSION 1: Morning Ritual (cocoon vs explorer) ──
  { id: 'room-service', label: 'Room service breakfast in a robe', cluster: 'cocoon',
    pairWith: 'local-cafe', dimension: 'Morning Ritual',
    scene: 'White linen, morning light, tray with silver cloches',
    signals: ['Room-service-ritual', 'Cocoon-morning'], category: 'Service' },
  { id: 'local-cafe', label: 'Walk to the neighborhood café locals go to', cluster: 'explorer',
    pairWith: 'room-service', dimension: 'Morning Ritual',
    scene: 'Cobblestones, a standing-only bar, the hiss of steam',
    signals: ['Local-café-seeker', 'Neighborhood-explorer'], category: 'FoodDrink' },

  // ── DIMENSION 2: Pool Energy (social vs solitary) ──
  { id: 'infinity-pool', label: 'Poolside scene — music, drinks, people-watching', cluster: 'scene',
    pairWith: 'hidden-pool', dimension: 'Pool Energy',
    scene: 'Blue-on-blue horizon, sunglasses, someone ordering rosé',
    signals: ['Pool-as-scene', 'Social-energy'], category: 'Wellness' },
  { id: 'hidden-pool', label: 'A quiet pool where it\'s just you and the sky', cluster: 'retreat',
    pairWith: 'infinity-pool', dimension: 'Pool Energy',
    scene: 'Stone walls, dappled light, the sound of water only',
    signals: ['Natural-pool-preference', 'Anti-resort-pool'], category: 'Wellness' },

  // ── DIMENSION 3: Day Pace (packed vs spacious) ──
  // Not covered by conversation phases — reveals how to structure itineraries
  { id: 'packed-day', label: 'Pack the day — there\'s so much to see', cluster: 'structure',
    pairWith: 'slow-day', dimension: 'Day Pace',
    scene: 'Museum at 10, lunch reservation at 1, walking tour at 3',
    signals: ['Packed-itinerary', 'Activity-maximizer'], category: 'Atmosphere' },
  { id: 'slow-day', label: 'Two things a day, max — leave room for the unplanned', cluster: 'retreat',
    pairWith: 'packed-day', dimension: 'Day Pace',
    scene: 'A long lunch that becomes the whole afternoon',
    signals: ['Slow-travel', 'White-space-seeker'], category: 'Atmosphere' },

  // ── DIMENSION 4: Property vs Destination (from mosaic #88) ──
  // THE most fundamental signal — changes every recommendation Terrazzo makes
  { id: 'perfect-hotel', label: 'Perfect hotel in a so-so city', cluster: 'cocoon',
    pairWith: 'perfect-city', dimension: 'What Matters More',
    scene: 'The room is extraordinary, the city is forgettable',
    signals: ['Property-first', 'Hotel-as-destination'], category: 'Character' },
  { id: 'perfect-city', label: 'Perfect city, forgettable hotel', cluster: 'explorer',
    pairWith: 'perfect-hotel', dimension: 'What Matters More',
    scene: 'The hotel is fine — but the city is everything',
    signals: ['Destination-first', 'City-over-property'], category: 'Setting' },

  // ── DIMENSION 5: Landscape Pull (from mosaic #36) ──
  // Simple but massively diagnostic for location recommendations
  { id: 'beach', label: 'Beach — salt air, warm sand, horizon', cluster: 'scene',
    pairWith: 'mountain', dimension: 'Landscape Pull',
    scene: 'Turquoise water, bare feet, the sun on your shoulders',
    signals: ['Coastal-drawn', 'Warm-climate', 'Water-oriented'], category: 'Setting' },
  { id: 'mountain', label: 'Mountain — thin air, pine trees, silence', cluster: 'retreat',
    pairWith: 'beach', dimension: 'Landscape Pull',
    scene: 'A trail above the clouds, cold morning, hot coffee',
    signals: ['Alpine-drawn', 'Cool-climate', 'Elevation-seeker'], category: 'Setting' },

  // ── DIMENSION 6: Location Feel (in the city vs away from it all) ──
  { id: 'walkable', label: 'Step outside and you\'re in the middle of it', cluster: 'urban',
    pairWith: 'remote', dimension: 'Location Feel',
    scene: 'Step outside, turn left, you are in the city',
    signals: ['Walkable-radius', 'Urban-embedded'], category: 'Setting' },
  { id: 'remote', label: 'Dirt road, no signal — just you and the landscape', cluster: 'retreat',
    pairWith: 'walkable', dimension: 'Location Feel',
    scene: 'Dirt road, no phone signal, only the landscape',
    signals: ['Remote-isolated', 'Destination-property'], category: 'Setting' },

  // ── DIMENSION 7: After Dark (early to bed vs night owl) ──
  // Not covered by conversation phases — reveals nightlife/social energy
  { id: 'early-night', label: 'In bed with a book by 10 — the best part of vacation', cluster: 'cocoon',
    pairWith: 'late-night', dimension: 'After Dark',
    scene: 'Linen sheets, a reading lamp, silence outside the window',
    signals: ['Early-to-bed', 'Cocoon-evening', 'Anti-nightlife'], category: 'Atmosphere' },
  { id: 'late-night', label: 'Finding the bar the locals disappear to at midnight', cluster: 'explorer',
    pairWith: 'early-night', dimension: 'After Dark',
    scene: 'A door with no sign, jazz or candlelight, one more glass',
    signals: ['Night-explorer', 'Bar-culture', 'Late-energy'], category: 'Atmosphere' },

  // ── DIMENSION 8: Scale & Intimacy (grand vs tiny) ──
  { id: 'grand-lobby', label: 'Grand hotel — soaring ceilings, marble, the drama of scale', cluster: 'scene',
    pairWith: 'intimate-inn', dimension: 'Scale & Intimacy',
    scene: 'Thirty-foot ceilings, marble floors, the echo of your footsteps',
    signals: ['Grand-hotel-lover', 'Scale-as-drama'], category: 'Design' },
  { id: 'intimate-inn', label: 'Eight rooms, the owner pours your wine at dinner', cluster: 'warm',
    pairWith: 'grand-lobby', dimension: 'Scale & Intimacy',
    scene: 'The owner pours your wine at dinner, their kids play in the garden',
    signals: ['Intimate-under-20', 'Micro-property'], category: 'Character' },
];
