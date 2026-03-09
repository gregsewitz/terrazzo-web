/**
 * Seed 4 synthetic test users with maximally-divergent taste profiles.
 *
 * Archetypes:
 *   1. "Backpacker Foodie" — street food, local neighborhoods, budget-conscious,
 *      anti-luxury, communal/hostel vibes, sustainability-focused
 *   2. "Wilderness & Wellness" — eco-lodges, nature immersion, off-grid,
 *      farm-to-table, cold plunge, safari rhythms, anti-urban
 *   3. "Urban Culture Vulture" — museums, architecture, nightlife, cocktail bars,
 *      historic districts, walkable cities, anti-resort
 *   4. "Family Resort Comfort" — kids clubs, pool complexes, all-inclusive,
 *      connecting rooms, buffet variety, beach access, anti-nightlife
 *
 * Run: npx tsx scripts/seed-test-users.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TestUser {
  id: string;
  email: string;
  name: string;
  radarData: Array<{ axis: string; value: number }>;
  microTasteSignals: Record<string, string[]>;
  allSignals: Array<{ cat: string; tag: string; confidence: number }>;
}

const TEST_USERS: TestUser[] = [
  // ─── Archetype 1: Backpacker Foodie ──────────────────────────────────────
  {
    id: 'test-user-backpacker-foodie',
    email: 'test-backpacker@terrazzo.test',
    name: 'Test: Backpacker Foodie',
    radarData: [
      { axis: 'Design', value: 0.2 },
      { axis: 'Atmosphere', value: 0.75 },
      { axis: 'Character', value: 0.85 },
      { axis: 'Service', value: 0.3 },
      { axis: 'FoodDrink', value: 0.95 },
      { axis: 'Setting', value: 0.8 },
      { axis: 'Wellness', value: 0.15 },
      { axis: 'Sustainability', value: 0.7 },
    ],
    microTasteSignals: {
      food_precision: ['street-food-culture', 'market-grazing', 'local-hole-in-the-wall', 'cheap-eats-obsessive'],
      exploration_style: ['wandering-without-plan', 'neighborhood-deep-dive', 'getting-lost-intentionally'],
      rejection_signals: ['white-tablecloth-formality', 'resort-captive-dining', 'luxury-markup-premium', 'spa-as-destination'],
    },
    allSignals: [
      // FoodDrink heavy
      { cat: 'FoodDrink', tag: 'street-food-culture', confidence: 0.95 },
      { cat: 'FoodDrink', tag: 'market-stall-dining', confidence: 0.92 },
      { cat: 'FoodDrink', tag: 'local-institution-status', confidence: 0.9 },
      { cat: 'FoodDrink', tag: 'communal-dining-format', confidence: 0.88 },
      { cat: 'FoodDrink', tag: 'fermentation-preservation-techniques', confidence: 0.85 },
      { cat: 'FoodDrink', tag: 'regional-wine-focus', confidence: 0.82 },
      { cat: 'FoodDrink', tag: 'family-recipe-tradition', confidence: 0.85 },
      { cat: 'FoodDrink', tag: 'hyper-local-food-sourcing', confidence: 0.88 },
      { cat: 'FoodDrink', tag: 'seasonal-ingredient-sourcing', confidence: 0.84 },
      // Setting: local neighborhoods
      { cat: 'Setting', tag: 'residential-neighborhood-setting', confidence: 0.9 },
      { cat: 'Setting', tag: 'non-tourist-district-location', confidence: 0.92 },
      { cat: 'Setting', tag: 'working-neighborhood-context', confidence: 0.85 },
      { cat: 'Setting', tag: 'pedestrian-scale-neighborhood', confidence: 0.82 },
      { cat: 'Setting', tag: 'high-foot-traffic-area', confidence: 0.78 },
      // Character: budget, authentic
      { cat: 'Character', tag: 'value-driven-pricing', confidence: 0.9 },
      { cat: 'Character', tag: 'local-ownership-operated', confidence: 0.88 },
      { cat: 'Character', tag: 'multi-generational-family-operation', confidence: 0.85 },
      { cat: 'Character', tag: 'no-frills-philosophy', confidence: 0.82 },
      { cat: 'Character', tag: 'open-to-non-guests', confidence: 0.78 },
      // Atmosphere: communal, casual
      { cat: 'Atmosphere', tag: 'high-energy-dining-room', confidence: 0.85 },
      { cat: 'Atmosphere', tag: 'communal-dining-atmosphere', confidence: 0.88 },
      { cat: 'Atmosphere', tag: 'multilingual-conversation-hum', confidence: 0.8 },
      { cat: 'Atmosphere', tag: 'standing-room-overflow', confidence: 0.75 },
      // Sustainability
      { cat: 'Sustainability', tag: 'local-food-sourcing', confidence: 0.85 },
      { cat: 'Sustainability', tag: 'minimal-food-miles', confidence: 0.82 },
      { cat: 'Sustainability', tag: 'minimal-food-waste-approach', confidence: 0.78 },
      // Rejections — anti-luxury, anti-resort
      { cat: 'Rejection', tag: 'premium-pricing-structure', confidence: 0.9 },
      { cat: 'Rejection', tag: 'spa-treatment-facility', confidence: 0.85 },
      { cat: 'Rejection', tag: 'infinity-pool-swimming', confidence: 0.8 },
      { cat: 'Rejection', tag: 'butler-service-model', confidence: 0.88 },
      { cat: 'Rejection', tag: 'designer-furniture-investment', confidence: 0.82 },
    ],
  },

  // ─── Archetype 2: Wilderness & Wellness ──────────────────────────────────
  {
    id: 'test-user-wilderness-wellness',
    email: 'test-wilderness@terrazzo.test',
    name: 'Test: Wilderness & Wellness',
    radarData: [
      { axis: 'Design', value: 0.35 },
      { axis: 'Atmosphere', value: 0.6 },
      { axis: 'Character', value: 0.7 },
      { axis: 'Service', value: 0.45 },
      { axis: 'FoodDrink', value: 0.55 },
      { axis: 'Setting', value: 0.95 },
      { axis: 'Wellness', value: 0.95 },
      { axis: 'Sustainability', value: 0.9 },
    ],
    microTasteSignals: {
      wellness_rituals: ['cold-plunge-contrast-therapy', 'dawn-yoga-practice', 'digital-detox-protocol', 'forest-bathing'],
      exploration_style: ['guided-nature-walk', 'wildlife-tracking', 'slow-travel-philosophy'],
      rejection_signals: ['nightclub-scene', 'high-density-seating', 'urban-rooftop-bar', 'shopping-district-proximity'],
    },
    allSignals: [
      // Setting: nature, wilderness
      { cat: 'Setting', tag: 'panoramic-mountain-views', confidence: 0.95 },
      { cat: 'Setting', tag: 'remote-location-minimal-development', confidence: 0.92 },
      { cat: 'Setting', tag: 'countryside-views', confidence: 0.88 },
      { cat: 'Setting', tag: 'national-park-proximity', confidence: 0.9 },
      { cat: 'Setting', tag: 'ocean-proximity', confidence: 0.82 },
      { cat: 'Setting', tag: 'forest-immersion-setting', confidence: 0.88 },
      { cat: 'Setting', tag: 'river-view-positioning', confidence: 0.78 },
      // Wellness heavy
      { cat: 'Wellness', tag: 'cold-plunge-contrast-therapy', confidence: 0.95 },
      { cat: 'Wellness', tag: 'multi-temperature-sauna-circuit', confidence: 0.92 },
      { cat: 'Wellness', tag: 'spa-facilities', confidence: 0.88 },
      { cat: 'Wellness', tag: 'farm-to-table-nutritional-philosophy', confidence: 0.85 },
      { cat: 'Wellness', tag: 'slow-living-philosophy', confidence: 0.9 },
      { cat: 'Wellness', tag: 'exceptional-bed-comfort', confidence: 0.82 },
      { cat: 'Wellness', tag: 'sleep-quality-emphasis', confidence: 0.85 },
      // Sustainability
      { cat: 'Sustainability', tag: 'wildlife-habitat-preservation', confidence: 0.92 },
      { cat: 'Sustainability', tag: 'low-density-development', confidence: 0.9 },
      { cat: 'Sustainability', tag: 'local-employment-program', confidence: 0.85 },
      { cat: 'Sustainability', tag: 'eco-conscious-operations', confidence: 0.88 },
      { cat: 'Sustainability', tag: 'adaptive-reuse-historic-building', confidence: 0.78 },
      // Character: eco, nature-driven
      { cat: 'Character', tag: 'nature-immersion-philosophy', confidence: 0.92 },
      { cat: 'Character', tag: 'barefoot-luxury', confidence: 0.85 },
      { cat: 'Character', tag: 'eco-luxury-positioning', confidence: 0.82 },
      { cat: 'Character', tag: 'turtle-conservation-program', confidence: 0.78 },
      // Atmosphere: slow, rhythmic
      { cat: 'Atmosphere', tag: 'languid-unhurried-pace', confidence: 0.9 },
      { cat: 'Atmosphere', tag: 'twice-daily-safari-rhythm', confidence: 0.85 },
      { cat: 'Atmosphere', tag: 'birdsong-emphasis-natural', confidence: 0.88 },
      { cat: 'Atmosphere', tag: 'fireplace-warmth-ritual', confidence: 0.82 },
      // FoodDrink: garden, simple
      { cat: 'FoodDrink', tag: 'garden-to-table-nutrition', confidence: 0.85 },
      { cat: 'FoodDrink', tag: 'estate-grown-ingredients', confidence: 0.82 },
      { cat: 'FoodDrink', tag: 'herbal-tea-program', confidence: 0.78 },
      // Rejections — anti-urban, anti-party
      { cat: 'Rejection', tag: 'high-density-seating', confidence: 0.9 },
      { cat: 'Rejection', tag: 'DJ-driven-nightlife', confidence: 0.92 },
      { cat: 'Rejection', tag: 'standing-room-overflow', confidence: 0.85 },
      { cat: 'Rejection', tag: 'high-turnover-pressure', confidence: 0.88 },
      { cat: 'Rejection', tag: 'tourist-district-location', confidence: 0.82 },
    ],
  },

  // ─── Archetype 3: Urban Culture Vulture ──────────────────────────────────
  {
    id: 'test-user-urban-culture',
    email: 'test-culture@terrazzo.test',
    name: 'Test: Urban Culture Vulture',
    radarData: [
      { axis: 'Design', value: 0.9 },
      { axis: 'Atmosphere', value: 0.85 },
      { axis: 'Character', value: 0.9 },
      { axis: 'Service', value: 0.6 },
      { axis: 'FoodDrink', value: 0.7 },
      { axis: 'Setting', value: 0.75 },
      { axis: 'Wellness', value: 0.2 },
      { axis: 'Sustainability', value: 0.3 },
    ],
    microTasteSignals: {
      design_hierarchy: ['brutalist-concrete-aesthetic', 'adaptive-reuse-industrial', 'gallery-white-cube', 'mid-century-furniture'],
      exploration_style: ['museum-marathon', 'architecture-walking-tour', 'nightlife-deep-dive'],
      rejection_signals: ['resort-pool-culture', 'all-inclusive-model', 'nature-lodge-isolation', 'guided-wildlife-tour'],
    },
    allSignals: [
      // Design heavy
      { cat: 'Design', tag: 'adaptive-reuse-industrial', confidence: 0.92 },
      { cat: 'Design', tag: 'brutalist-concrete-aesthetic', confidence: 0.9 },
      { cat: 'Design', tag: 'gallery-white-cube', confidence: 0.88 },
      { cat: 'Design', tag: 'mid-century-modern-furniture', confidence: 0.85 },
      { cat: 'Design', tag: 'neon-signage-aesthetic', confidence: 0.82 },
      { cat: 'Design', tag: 'raw-material-exposure', confidence: 0.88 },
      { cat: 'Design', tag: 'graffiti-street-art-integration', confidence: 0.78 },
      // Character: cultural, historic
      { cat: 'Character', tag: 'museum-hotel-hybrid', confidence: 0.92 },
      { cat: 'Character', tag: 'architectural-landmark-status', confidence: 0.9 },
      { cat: 'Character', tag: 'rotating-exhibition-program', confidence: 0.88 },
      { cat: 'Character', tag: 'staff-as-cultural-ambassadors', confidence: 0.85 },
      { cat: 'Character', tag: 'century-old-institution', confidence: 0.82 },
      { cat: 'Character', tag: 'local-institution-status', confidence: 0.8 },
      { cat: 'Character', tag: 'selective-door-policy', confidence: 0.78 },
      // Atmosphere: urban buzz, nightlife
      { cat: 'Atmosphere', tag: 'dark-moody-lighting', confidence: 0.9 },
      { cat: 'Atmosphere', tag: 'live-music-programming', confidence: 0.88 },
      { cat: 'Atmosphere', tag: 'DJ-driven-nightlife', confidence: 0.85 },
      { cat: 'Atmosphere', tag: 'lobby-as-social-hub', confidence: 0.82 },
      { cat: 'Atmosphere', tag: 'intimate-conversation-hum', confidence: 0.8 },
      { cat: 'Atmosphere', tag: 'day-to-night-transformation', confidence: 0.78 },
      // Setting: urban, walkable
      { cat: 'Setting', tag: 'walkable-urban-location', confidence: 0.9 },
      { cat: 'Setting', tag: 'tourist-district-location', confidence: 0.75 },
      { cat: 'Setting', tag: 'street-level-direct-access', confidence: 0.82 },
      { cat: 'Setting', tag: 'cathedral-proximity', confidence: 0.78 },
      // FoodDrink: cocktails, wine bars
      { cat: 'FoodDrink', tag: 'craft-cocktail-program', confidence: 0.88 },
      { cat: 'FoodDrink', tag: 'named-bartender-program', confidence: 0.82 },
      { cat: 'FoodDrink', tag: 'natural-wine-selection', confidence: 0.85 },
      { cat: 'FoodDrink', tag: 'tasting-menu-format', confidence: 0.78 },
      // Rejections — anti-nature, anti-resort
      { cat: 'Rejection', tag: 'wildlife-integrated-grounds', confidence: 0.88 },
      { cat: 'Rejection', tag: 'remote-location-minimal-development', confidence: 0.9 },
      { cat: 'Rejection', tag: 'barefoot-luxury', confidence: 0.85 },
      { cat: 'Rejection', tag: 'all-inclusive-model', confidence: 0.82 },
      { cat: 'Rejection', tag: 'slow-living-philosophy', confidence: 0.8 },
    ],
  },

  // ─── Archetype 4: Family Resort Comfort ──────────────────────────────────
  {
    id: 'test-user-family-resort',
    email: 'test-family@terrazzo.test',
    name: 'Test: Family Resort Comfort',
    radarData: [
      { axis: 'Design', value: 0.4 },
      { axis: 'Atmosphere', value: 0.7 },
      { axis: 'Character', value: 0.5 },
      { axis: 'Service', value: 0.95 },
      { axis: 'FoodDrink', value: 0.65 },
      { axis: 'Setting', value: 0.8 },
      { axis: 'Wellness', value: 0.6 },
      { axis: 'Sustainability', value: 0.25 },
    ],
    microTasteSignals: {
      exploration_style: ['kids-club-drop-off', 'pool-day-routine', 'resort-activities-program', 'early-dinner-reservation'],
      thermal_experiences: ['waterslide-complex', 'lazy-river', 'heated-pool', 'splash-pad'],
      rejection_signals: ['adults-only-policy', 'late-night-scene', 'selective-door-policy', 'minimalist-austere-design'],
    },
    allSignals: [
      // Service heavy — family convenience is paramount
      { cat: 'Service', tag: 'kids-club-program', confidence: 0.95 },
      { cat: 'Service', tag: 'family-oriented-atmosphere', confidence: 0.92 },
      { cat: 'Service', tag: 'babysitting-service', confidence: 0.9 },
      { cat: 'Service', tag: 'concierge-family-programming', confidence: 0.88 },
      { cat: 'Service', tag: 'early-check-in-accommodation', confidence: 0.85 },
      { cat: 'Service', tag: 'airport-transfer-service', confidence: 0.82 },
      { cat: 'Service', tag: 'luggage-handling-service', confidence: 0.8 },
      { cat: 'Service', tag: 'connecting-rooms-available', confidence: 0.88 },
      { cat: 'Service', tag: 'room-service-all-day', confidence: 0.82 },
      // Atmosphere: family-friendly, safe, predictable
      { cat: 'Atmosphere', tag: 'family-oriented-atmosphere', confidence: 0.92 },
      { cat: 'Atmosphere', tag: 'family-atmosphere-service-model', confidence: 0.9 },
      { cat: 'Atmosphere', tag: 'anti-party-sanctuary', confidence: 0.85 },
      { cat: 'Atmosphere', tag: 'relaxed-casual-dress-code', confidence: 0.82 },
      { cat: 'Atmosphere', tag: 'early-morning-activity-programming', confidence: 0.78 },
      // Setting: beach resort, pools
      { cat: 'Setting', tag: 'beach-swimming-access', confidence: 0.92 },
      { cat: 'Setting', tag: 'swimming-pool-facility', confidence: 0.95 },
      { cat: 'Setting', tag: 'ocean-proximity', confidence: 0.88 },
      { cat: 'Setting', tag: 'resort-compound-layout', confidence: 0.85 },
      { cat: 'Setting', tag: 'gated-property-security', confidence: 0.82 },
      // Wellness: pool, basic spa
      { cat: 'Wellness', tag: 'swimming-pool-facility', confidence: 0.9 },
      { cat: 'Wellness', tag: 'infinity-pool-swimming', confidence: 0.85 },
      { cat: 'Wellness', tag: 'comfortable-bed-quality', confidence: 0.82 },
      // FoodDrink: buffet, variety, kid-friendly
      { cat: 'FoodDrink', tag: 'buffet-breakfast-format', confidence: 0.92 },
      { cat: 'FoodDrink', tag: 'all-inclusive-dining', confidence: 0.88 },
      { cat: 'FoodDrink', tag: 'multiple-restaurant-options', confidence: 0.85 },
      { cat: 'FoodDrink', tag: 'poolside-dining-service', confidence: 0.82 },
      { cat: 'FoodDrink', tag: 'kids-menu-available', confidence: 0.9 },
      // Character: safe, reliable, branded
      { cat: 'Character', tag: 'international-chain-consistency', confidence: 0.85 },
      { cat: 'Character', tag: 'loyalty-program-integration', confidence: 0.82 },
      { cat: 'Character', tag: 'family-legacy-destination', confidence: 0.88 },
      { cat: 'Character', tag: 'multi-generational-appeal', confidence: 0.85 },
      // Rejections — anti-nightlife, anti-exclusive, anti-minimalist
      { cat: 'Rejection', tag: 'selective-door-policy', confidence: 0.92 },
      { cat: 'Rejection', tag: 'DJ-driven-nightlife', confidence: 0.9 },
      { cat: 'Rejection', tag: 'adults-only-policy', confidence: 0.95 },
      { cat: 'Rejection', tag: 'dark-moody-lighting', confidence: 0.82 },
      { cat: 'Rejection', tag: 'standing-room-overflow', confidence: 0.88 },
      { cat: 'Rejection', tag: 'no-frills-philosophy', confidence: 0.85 },
    ],
  },
];

function buildTasteProfile(user: TestUser) {
  return {
    profileVersion: '4.0-test',
    radarData: user.radarData,
    microTasteSignals: user.microTasteSignals,
    overallArchetype: user.name.replace('Test: ', ''),
    archetypeDescription: `Synthetic test archetype: ${user.name}`,
    contradictions: [],
    destinations: [],
    bestQuote: '',
    perfectDay: '',
    howYouShift: '',
    designInsight: '',
    emotionalDriver: '',
    tasteTrajectory: '',
    contextModifiers: [],
    tasteNeighbors: [],
    matchedProperties: [],
    sustainabilityProfile: null,
  };
}

async function main() {
  for (const testUser of TEST_USERS) {
    // Upsert user
    await prisma.user.upsert({
      where: { id: testUser.id },
      update: {
        allSignals: testUser.allSignals as any,
        tasteProfile: buildTasteProfile(testUser) as any,
        isOnboardingComplete: true,
      },
      create: {
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        allSignals: testUser.allSignals as any,
        tasteProfile: buildTasteProfile(testUser) as any,
        isOnboardingComplete: true,
      },
    });

    console.log(`✓ Seeded user: ${testUser.name} (${testUser.id})`);
  }

  // Replicate all existing SavedPlaces to test users for comparison
  const realUserPlaces = await prisma.savedPlace.findMany({
    where: { userId: 'cmlvca5sx000004lasyug8tqw' },
    select: { googlePlaceId: true, tripId: true, status: true },
  });

  console.log(`\nFound ${realUserPlaces.length} places from real user to replicate`);

  for (const testUser of TEST_USERS) {
    let created = 0;
    for (const place of realUserPlaces) {
      try {
        await prisma.savedPlace.upsert({
          where: {
            userId_googlePlaceId: {
              userId: testUser.id,
              googlePlaceId: place.googlePlaceId,
            },
          },
          update: {},
          create: {
            userId: testUser.id,
            googlePlaceId: place.googlePlaceId,
            tripId: place.tripId,
            status: place.status,
            matchScore: 0,
          },
        });
        created++;
      } catch (e) {
        // Skip foreign key failures etc
      }
    }
    console.log(`  → Created ${created} SavedPlaces for ${testUser.name}`);
  }

  console.log('\nDone! Now deploy and trigger compute-vectors + rescore for each test user.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
