#!/usr/bin/env node

/**
 * Terrazzo Persona Test Harness
 *
 * Generates 15 synthetic user personas with diverse demographics and psychographics,
 * runs them through the same synthesis and discover feed prompts used in production,
 * and outputs an interactive HTML dashboard for side-by-side comparison.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node scripts/generate-test-personas.mjs
 *
 *   Options:
 *     --personas=3       Run only first N personas (for testing)
 *     --only=id,id       Run only specific persona IDs (comma-separated)
 *     --skip-discover    Skip discover feed generation (faster, profile-only)
 *     --output=path      Custom output path for HTML dashboard
 *     --merge            Merge new results into existing results.json
 */

import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const personaLimit = parseInt(args.find(a => a.startsWith('--personas='))?.split('=')[1] || '15');
const onlyIds = args.find(a => a.startsWith('--only='))?.split('=')[1]?.split(',') || null;
const skipDiscover = args.includes('--skip-discover');
const mergeMode = args.includes('--merge') || !!onlyIds; // auto-merge when using --only
const outputPath = args.find(a => a.startsWith('--output='))?.split('=')[1]
  || join(__dirname, '..', 'persona-test-results');

// ---------------------------------------------------------------------------
// Anthropic client
// ---------------------------------------------------------------------------
const anthropic = new Anthropic();

// ---------------------------------------------------------------------------
// PERSONAS — 12 diverse synthetic users
// ---------------------------------------------------------------------------
const PERSONAS = [
  // ── TRAVEL STYLE SPECTRUM ──────────────────────────────────────────────
  {
    id: 'budget-nomad',
    label: 'Budget Digital Nomad',
    demo: { age: 27, gender: 'M', income: 'low', location: 'Austin, TX' },
    lifeContext: {
      firstName: 'Mateo',
      homeCity: 'Austin',
      relationshipStatus: 'single',
      hasKids: false,
      primaryCompanions: ['solo'],
      travelFrequency: '6-8 trips/year',
      soloTravelIdentity: 'I travel to disappear into a city and work from cafes. Not hostels anymore but I still want to feel like a local, not a tourist.',
    },
    signals: [
      { tag: 'Neighborhood cafes over hotel breakfast', cat: 'Food', confidence: 0.92 },
      { tag: 'Co-working friendly lobbies', cat: 'Service', confidence: 0.88 },
      { tag: 'Under-$150/night sweet spot', cat: 'Character', confidence: 0.95 },
      { tag: 'Anti-resort-compound', cat: 'Rejection', confidence: 0.90 },
      { tag: 'Walking-distance everything', cat: 'Location', confidence: 0.93 },
      { tag: 'Raw concrete and exposed brick', cat: 'Design', confidence: 0.78 },
      { tag: 'Anti-turndown-service', cat: 'Rejection', confidence: 0.82 },
      { tag: 'Street food immersion', cat: 'Food', confidence: 0.91 },
      { tag: 'Locally-owned guesthouse', cat: 'Character', confidence: 0.87 },
      { tag: 'Morning run routes matter', cat: 'Wellness', confidence: 0.72 },
      { tag: 'Anti-marble-lobby', cat: 'Rejection', confidence: 0.85 },
      { tag: 'Laptop-friendly cafe culture', cat: 'Location', confidence: 0.90 },
    ],
    contradictions: [
      { stated: 'Says he wants bare-bones budget stays', revealed: 'Spends hours researching design-forward boutique hotels', resolution: 'Values design thinking at any price point — would choose a well-designed $100 guesthouse over a generic $80 hotel', matchRule: 'Prioritize design-conscious properties even at lower price points' },
      { stated: 'Claims to hate hotel amenities', revealed: 'Always checks if there is good wifi and a workspace', resolution: 'Anti-luxury but pro-functionality — wants a productive environment disguised as casual', matchRule: 'Score high for functional amenities (wifi, workspace) but penalize luxury-coded amenities (spa, concierge)' },
    ],
    certainties: { Design: 75, Character: 80, Service: 60, Food: 85, Location: 90, Wellness: 40 },
    messages: [
      { role: 'user', text: 'I spent three weeks in Lisbon last year working from this tiny guesthouse in Alfama. The owner made espresso every morning and just left it outside my door. That is my ideal.' },
      { role: 'user', text: 'I cannot stand those hotels where everything feels staged for Instagram. Like cool, you have a neon sign. I want a place that existed before I got there.' },
      { role: 'user', text: 'My favorite hotel ever was this converted warehouse in Mexico City — Chaya B&B. Raw concrete, plants everywhere, the neighborhood was everything.' },
      { role: 'user', text: 'I run every morning when I travel. If I cannot get out the door and run along something interesting within 60 seconds, the location is wrong.' },
    ],
  },

  {
    id: 'luxury-aesthete',
    label: 'Luxury Design Obsessive',
    demo: { age: 42, gender: 'F', income: 'high', location: 'Brooklyn, NY' },
    lifeContext: {
      firstName: 'Elena',
      homeCity: 'Brooklyn',
      partnerName: 'James',
      relationshipStatus: 'married',
      hasKids: false,
      primaryCompanions: ['partner'],
      travelFrequency: '4-5 trips/year',
      partnerTravelDynamic: 'We both care about design but James is more about food and I am more about the physical space — the light, the materials, the furniture.',
    },
    signals: [
      { tag: 'Architectural pedigree matters', cat: 'Design', confidence: 0.96 },
      { tag: 'Natural materials over synthetic', cat: 'Design', confidence: 0.94 },
      { tag: 'Staff-as-host not staff-as-servant', cat: 'Service', confidence: 0.88 },
      { tag: 'Omakase over à la carte', cat: 'Food', confidence: 0.85 },
      { tag: 'Anti-chain-hotel', cat: 'Rejection', confidence: 0.97 },
      { tag: 'Vernacular architecture', cat: 'Design', confidence: 0.93 },
      { tag: 'Anti-branded-amenities', cat: 'Rejection', confidence: 0.82 },
      { tag: 'Curated library spaces', cat: 'Character', confidence: 0.79 },
      { tag: 'Linen and clay over marble and chrome', cat: 'Design', confidence: 0.91 },
      { tag: 'Natural light as amenity', cat: 'Wellness', confidence: 0.87 },
      { tag: 'Communal dining option', cat: 'Food', confidence: 0.76 },
      { tag: 'Owner-operated properties', cat: 'Character', confidence: 0.90 },
      { tag: 'Landscape as design element', cat: 'Location', confidence: 0.88 },
    ],
    contradictions: [
      { stated: 'Claims to prefer understated properties', revealed: 'Most loved hotels have dramatic architectural statements', resolution: 'Understated in materials but bold in form — wants quiet drama, not quiet quiet', matchRule: 'Score high for architecturally bold properties that use natural/muted materials' },
      { stated: 'Says she dislikes luxury codes', revealed: 'Happiest at $400+ properties with exceptional craft', resolution: 'Anti-luxury-signaling but pro-luxury-substance — the craft must be real, not performative', matchRule: 'Penalize visible luxury branding, reward hidden craft quality' },
      { stated: 'Wants staff to be invisible', revealed: 'Raves about specific staff interactions at boutique hotels', resolution: 'Wants human warmth, not scripted service — the key is authenticity not invisibility', matchRule: 'Score high for personal/owner-led service, penalize corporate service protocols' },
    ],
    certainties: { Design: 95, Character: 85, Service: 80, Food: 75, Location: 80, Wellness: 65 },
    messages: [
      { role: 'user', text: 'We stayed at Casa Cook Kos and I remember walking in and just exhaling. The proportions were right. The concrete was raw but warm. Nothing was trying too hard.' },
      { role: 'user', text: 'James and I argue about Aman properties — he thinks they are pretentious, I think they understand negative space better than anyone. We compromise at places like Menorca Experimental.' },
      { role: 'user', text: 'The worst hotel experience was a "luxury" chain in Paris where every surface was gilded and they called you Madame every twelve seconds. I felt like a character in someone else\'s fantasy.' },
      { role: 'user', text: 'I am the person who photographs the bathroom tiles. If the architect cared about the grout color, I know the whole place will be right.' },
    ],
  },

  {
    id: 'midrange-explorer',
    label: 'Curious Mid-Range Explorer',
    demo: { age: 35, gender: 'NB', income: 'medium', location: 'Denver, CO' },
    lifeContext: {
      firstName: 'Jordan',
      homeCity: 'Denver',
      relationshipStatus: 'partnered',
      hasKids: false,
      primaryCompanions: ['partner', 'friends'],
      travelFrequency: '3-4 trips/year',
      partnerTravelDynamic: 'We split trips between just-us romantic ones and bigger group trips with our friend circle. Very different energy.',
    },
    signals: [
      { tag: 'Neighborhood immersion over tourist center', cat: 'Location', confidence: 0.91 },
      { tag: 'Farm-to-table philosophy', cat: 'Food', confidence: 0.88 },
      { tag: 'Boutique over chain at any price', cat: 'Character', confidence: 0.86 },
      { tag: 'Anti-all-inclusive', cat: 'Rejection', confidence: 0.93 },
      { tag: 'Bike-friendly infrastructure', cat: 'Location', confidence: 0.82 },
      { tag: 'Natural wine bars', cat: 'Food', confidence: 0.84 },
      { tag: 'Mid-century modern appreciation', cat: 'Design', confidence: 0.77 },
      { tag: 'Group-friendly common spaces', cat: 'Character', confidence: 0.80 },
      { tag: 'Anti-pool-culture', cat: 'Rejection', confidence: 0.71 },
      { tag: 'Hiking access from property', cat: 'Wellness', confidence: 0.89 },
      { tag: 'Local market proximity', cat: 'Food', confidence: 0.85 },
    ],
    contradictions: [
      { stated: 'Says they prefer spontaneous exploration', revealed: 'Has a spreadsheet for every trip with timed restaurant reservations', resolution: 'Plans the structure to enable spontaneity — uses planning to create space for discovery', matchRule: 'Recommend properties with curated local guides but also emphasize walkability for unplanned discovery' },
    ],
    certainties: { Design: 60, Character: 75, Service: 50, Food: 85, Location: 88, Wellness: 70 },
    messages: [
      { role: 'user', text: 'Our best trip was Copenhagen — we biked everywhere, ate at Relae before it closed, and stayed at this little hotel in Nørrebro that felt like staying at a friend\'s apartment.' },
      { role: 'user', text: 'I hate when a hotel has a restaurant and they assume you are eating there. I want to be in the neighborhood, not trapped in the hotel ecosystem.' },
      { role: 'user', text: 'When we travel with friends, the common areas matter more than the rooms. We need a big table to gather around.' },
    ],
  },

  // ── LIFE STAGE DIVERSITY ──────────────────────────────────────────────
  {
    id: 'young-family',
    label: 'Design-Conscious Young Family',
    demo: { age: 38, gender: 'F', income: 'high-medium', location: 'San Francisco, CA' },
    lifeContext: {
      firstName: 'Sarah',
      homeCity: 'San Francisco',
      partnerName: 'David',
      relationshipStatus: 'married',
      hasKids: true,
      kidAges: ['4', '7'],
      primaryCompanions: ['family', 'partner'],
      travelFrequency: '3-4 trips/year',
      partnerTravelDynamic: 'We used to be the cool couple at boutique hotels. Now we need places that work for kids without making us feel like we checked into a theme park.',
    },
    signals: [
      { tag: 'Sophisticated-but-kid-friendly', cat: 'Character', confidence: 0.94 },
      { tag: 'Kitchen or kitchenette essential', cat: 'Service', confidence: 0.91 },
      { tag: 'Anti-kids-club-with-mascots', cat: 'Rejection', confidence: 0.89 },
      { tag: 'Outdoor space for running around', cat: 'Wellness', confidence: 0.92 },
      { tag: 'Beach access not beach resort', cat: 'Location', confidence: 0.87 },
      { tag: 'Family suites with real design', cat: 'Design', confidence: 0.90 },
      { tag: 'Anti-sterile-family-hotel', cat: 'Rejection', confidence: 0.88 },
      { tag: 'Early dinner options that are still good', cat: 'Food', confidence: 0.86 },
      { tag: 'Nature immersion for kids', cat: 'Location', confidence: 0.93 },
      { tag: 'Relaxed staff attitude toward children', cat: 'Service', confidence: 0.91 },
      { tag: 'Pool is non-negotiable with kids', cat: 'Wellness', confidence: 0.95 },
      { tag: 'Wine for parents at sunset', cat: 'Food', confidence: 0.80 },
    ],
    contradictions: [
      { stated: 'Claims she does not care about design anymore now that she has kids', revealed: 'Still screenshots boutique hotels on Instagram and researches architect-designed family villas', resolution: 'Has not lowered her design bar — has expanded it to include family function. Wants both.', matchRule: 'Score high for properties with strong design AND genuine family accommodation — penalize either family-only or design-only properties' },
      { stated: 'Says pools do not matter', revealed: 'Every favorite family trip featured a great pool', resolution: 'Pool as family infrastructure, not luxury amenity — needs it for the kids but refuses to admit it is now her priority', matchRule: 'Always include pool as a requirement for family travel context but do not frame it as a luxury feature' },
    ],
    certainties: { Design: 75, Character: 85, Service: 80, Food: 70, Location: 85, Wellness: 90 },
    messages: [
      { role: 'user', text: 'We stayed at Babylonstoren in South Africa before kids and it was transcendent. Now I am trying to find that feeling but with a 4-year-old who needs a pool and a 7-year-old who needs wifi.' },
      { role: 'user', text: 'The nightmare is those family resorts where everything is primary colors and the food is chicken fingers. I would rather Airbnb a nice house than subject myself to that.' },
      { role: 'user', text: 'Our best family trip was a farmhouse in Tuscany that happened to have incredible food and a pool surrounded by olive trees. The kids ran free and we felt like adults.' },
      { role: 'user', text: 'David and I try to do one trip alone per year. When it is just us, we go full boutique hotel mode. Tiny rooms are fine. We just want beauty and great restaurants.' },
    ],
  },

  {
    id: 'empty-nesters',
    label: 'Adventurous Empty Nesters',
    demo: { age: 58, gender: 'M', income: 'high', location: 'Chicago, IL' },
    lifeContext: {
      firstName: 'Robert',
      homeCity: 'Chicago',
      partnerName: 'Linda',
      relationshipStatus: 'married',
      hasKids: true,
      kidAges: ['28', '25'],
      primaryCompanions: ['partner'],
      travelFrequency: '5-6 trips/year',
      partnerTravelDynamic: 'The kids are gone and we are making up for lost time. Linda wants cultural depth, I want physical adventure. We meet in the middle at places with both.',
    },
    signals: [
      { tag: 'Wine region expertise', cat: 'Food', confidence: 0.93 },
      { tag: 'Guided cultural experiences', cat: 'Character', confidence: 0.88 },
      { tag: 'Anti-cruise-ship', cat: 'Rejection', confidence: 0.95 },
      { tag: 'Hiking and physical challenge', cat: 'Wellness', confidence: 0.91 },
      { tag: 'Historic properties with modern comfort', cat: 'Design', confidence: 0.87 },
      { tag: 'Multi-course tasting menus', cat: 'Food', confidence: 0.84 },
      { tag: 'Staff who are local experts', cat: 'Service', confidence: 0.90 },
      { tag: 'Off-season travel preference', cat: 'Character', confidence: 0.82 },
      { tag: 'Anti-tourist-group', cat: 'Rejection', confidence: 0.93 },
      { tag: 'Slow travel philosophy', cat: 'Location', confidence: 0.89 },
      { tag: 'Spa as recovery not indulgence', cat: 'Wellness', confidence: 0.78 },
      { tag: 'Independent-hotel loyalty', cat: 'Character', confidence: 0.86 },
    ],
    contradictions: [
      { stated: 'Says he prefers rugged, adventure-forward trips', revealed: 'Always books properties with excellent wine programs and fine dining', resolution: 'Adventure by day, sophistication by evening — the combo IS the point', matchRule: 'Score high for properties combining outdoor access with culinary excellence — penalize either adventure-only or dining-only properties' },
      { stated: 'Claims not to care about luxury', revealed: 'Happiest in 4-5 star properties with exceptional beds and bathrooms', resolution: 'Physical comfort is recovery infrastructure for an active travel style, not indulgence', matchRule: 'Require high comfort scores especially bedding/bathroom but do not emphasize luxury as a feature' },
    ],
    certainties: { Design: 70, Character: 80, Service: 85, Food: 90, Location: 85, Wellness: 80 },
    messages: [
      { role: 'user', text: 'We did two weeks in the Douro Valley last fall — hiked every morning along the river, then spent afternoons visiting quintas. The best was Quinta Nova — they paired wines with the landscape view.' },
      { role: 'user', text: 'Linda says I am a snob about service but really I just want someone who knows the area and can tell me where the locals actually go. Not a concierge reading from a script.' },
      { role: 'user', text: 'Our worst trip was an organized tour of Tuscany. Forty people on a bus, lunch at a tourist trap. I would rather get lost on my own.' },
    ],
  },

  {
    id: 'solo-retiree',
    label: 'Solo Traveling Retiree',
    demo: { age: 67, gender: 'F', income: 'medium-high', location: 'Portland, OR' },
    lifeContext: {
      firstName: 'Margaret',
      homeCity: 'Portland',
      relationshipStatus: 'widowed',
      hasKids: true,
      kidAges: ['40', '37'],
      primaryCompanions: ['solo'],
      travelFrequency: '4-5 trips/year',
      soloTravelIdentity: 'I started traveling alone after Tom passed. At first it was terrifying. Now it is the thing I am most proud of. I have more courage at 67 than I did at 27.',
    },
    signals: [
      { tag: 'Warm welcome for solo women', cat: 'Service', confidence: 0.96 },
      { tag: 'Bar seating for solo diners', cat: 'Food', confidence: 0.91 },
      { tag: 'Safe walking neighborhood', cat: 'Location', confidence: 0.94 },
      { tag: 'Communal tables and social spaces', cat: 'Character', confidence: 0.88 },
      { tag: 'Anti-couples-only-energy', cat: 'Rejection', confidence: 0.90 },
      { tag: 'Bookshop and gallery proximity', cat: 'Location', confidence: 0.87 },
      { tag: 'Garden or courtyard for quiet time', cat: 'Wellness', confidence: 0.89 },
      { tag: 'Morning ritual importance', cat: 'Food', confidence: 0.85 },
      { tag: 'Character over luxury', cat: 'Character', confidence: 0.92 },
      { tag: 'Staff who remember your name', cat: 'Service', confidence: 0.93 },
      { tag: 'Anti-nightlife-focused', cat: 'Rejection', confidence: 0.80 },
      { tag: 'Walking as primary transport', cat: 'Location', confidence: 0.91 },
    ],
    contradictions: [
      { stated: 'Says she prefers being alone', revealed: 'Lights up describing conversations with strangers at hotel bars and communal tables', resolution: 'Solo traveler who craves connection on her own terms — wants to opt-in, not be forced', matchRule: 'Score high for properties with optional social spaces (communal dining, bar, garden) but do not require group activities' },
    ],
    certainties: { Design: 55, Character: 90, Service: 95, Food: 80, Location: 90, Wellness: 75 },
    messages: [
      { role: 'user', text: 'The owner at Hotel & More in Budapest remembered me from last year and had tea waiting in my room. I cried a little. That is what travel should feel like.' },
      { role: 'user', text: 'I eat dinner at the bar now and I love it. Best conversations of my life have been with strangers over wine at a good hotel bar.' },
      { role: 'user', text: 'I will not stay anywhere I cannot walk to a bookshop and a good cafe within ten minutes. That is non-negotiable.' },
    ],
  },

  // ── PSYCHOGRAPHIC CONTRASTS ────────────────────────────────────────────
  {
    id: 'instagram-aesthete',
    label: 'The Visual-First Traveler',
    demo: { age: 29, gender: 'F', income: 'medium', location: 'Los Angeles, CA' },
    lifeContext: {
      firstName: 'Priya',
      homeCity: 'Los Angeles',
      relationshipStatus: 'single',
      hasKids: false,
      primaryCompanions: ['friends', 'solo'],
      travelFrequency: '5-6 trips/year',
      soloTravelIdentity: 'Half my trips are for content and half are where I actually rest. They are very different.',
    },
    signals: [
      { tag: 'Photogenic interiors', cat: 'Design', confidence: 0.95 },
      { tag: 'Rooftop and terrace spaces', cat: 'Location', confidence: 0.90 },
      { tag: 'Plating and presentation in food', cat: 'Food', confidence: 0.87 },
      { tag: 'Warm-toned lighting', cat: 'Design', confidence: 0.88 },
      { tag: 'Anti-generic-modern', cat: 'Rejection', confidence: 0.82 },
      { tag: 'Statement pieces and focal points', cat: 'Design', confidence: 0.91 },
      { tag: 'Pool aesthetic as social space', cat: 'Wellness', confidence: 0.86 },
      { tag: 'Brunch culture', cat: 'Food', confidence: 0.83 },
      { tag: 'Trendy neighborhood vibes', cat: 'Location', confidence: 0.89 },
      { tag: 'Anti-corporate-blandness', cat: 'Rejection', confidence: 0.84 },
      { tag: 'Golden hour architecture', cat: 'Design', confidence: 0.92 },
    ],
    contradictions: [
      { stated: 'Insists the aesthetic is for herself, not for content', revealed: 'Checks how a property photographs before booking — browses tagged photos on Instagram', resolution: 'The visual IS the experience for her — not performative, genuinely processes the world visually first', matchRule: 'Prioritize properties with strong visual identity and photogenic common areas' },
      { stated: 'Says she wants authentic local experiences', revealed: 'Gravitates toward internationally-styled design hotels in every city', resolution: 'Wants local flavor filtered through a global design lens — not raw authenticity but curated locality', matchRule: 'Score high for properties with international design language that incorporate local references' },
    ],
    certainties: { Design: 95, Character: 65, Service: 45, Food: 75, Location: 85, Wellness: 60 },
    messages: [
      { role: 'user', text: 'I book hotels based on the bathroom. If the bathroom tile work is stunning, the rest usually follows.' },
      { role: 'user', text: 'The Life in Marrakech — I went for the courtyard photos and stayed because the light at 4pm through those arches was the most beautiful thing I have ever seen.' },
      { role: 'user', text: 'When I travel with friends, we need a pool moment. When I travel alone, I need a bathtub moment. Both are about beauty and ritual.' },
    ],
  },

  {
    id: 'anti-tourist',
    label: 'The Deliberate Anti-Tourist',
    demo: { age: 45, gender: 'M', income: 'medium-high', location: 'Portland, ME' },
    lifeContext: {
      firstName: 'Henrik',
      homeCity: 'Portland',
      relationshipStatus: 'divorced',
      hasKids: true,
      kidAges: ['15', '12'],
      primaryCompanions: ['solo', 'family'],
      travelFrequency: '3-4 trips/year',
      soloTravelIdentity: 'I go where no one recommends. I once spent a week in a Slovenian village because I read one sentence about it in a 1990s guidebook.',
    },
    signals: [
      { tag: 'Anti-Instagram-destination', cat: 'Rejection', confidence: 0.97 },
      { tag: 'Obscure destinations preferred', cat: 'Location', confidence: 0.94 },
      { tag: 'Local family-run pensions', cat: 'Character', confidence: 0.92 },
      { tag: 'Anti-design-hotel', cat: 'Rejection', confidence: 0.85 },
      { tag: 'Regional cuisine over fine dining', cat: 'Food', confidence: 0.91 },
      { tag: 'Walking and public transport only', cat: 'Location', confidence: 0.88 },
      { tag: 'Patina over polish', cat: 'Design', confidence: 0.86 },
      { tag: 'Anti-English-menu', cat: 'Rejection', confidence: 0.79 },
      { tag: 'Newspaper at breakfast', cat: 'Character', confidence: 0.82 },
      { tag: 'Historic town center accommodation', cat: 'Location', confidence: 0.90 },
      { tag: 'Anti-concierge-app', cat: 'Rejection', confidence: 0.88 },
      { tag: 'Cold-weather destinations', cat: 'Location', confidence: 0.76 },
    ],
    contradictions: [
      { stated: 'Refuses to go anywhere popular', revealed: 'His favorite places often become popular after he visits — has excellent instincts for emerging destinations', resolution: 'Not anti-popular on principle but anti-crowd and anti-commodification — wants to experience a place before it becomes a product', matchRule: 'Recommend emerging or under-the-radar properties in unexpected destinations — penalize established luxury or well-known boutique brands' },
      { stated: 'Says he does not care about comfort', revealed: 'Very particular about mattress quality and room temperature', resolution: 'Anti-luxury aesthetic but pro-physical comfort — wants a simple room that is actually well-made', matchRule: 'Score for simple but well-constructed rooms with quality basics — penalize visible luxury features' },
    ],
    certainties: { Design: 60, Character: 90, Service: 55, Food: 90, Location: 95, Wellness: 45 },
    messages: [
      { role: 'user', text: 'I spent a week in Gjirokastra, Albania, staying in a 200-year-old Ottoman house converted into a pension. The owner made raki every evening. That was perfection.' },
      { role: 'user', text: 'If a place has been in Condé Nast Traveler, I have already moved on. I know that sounds pretentious but the minute a place gets "discovered" the magic evaporates.' },
      { role: 'user', text: 'When I take my kids, I bring them to places that challenge them. Last summer we did a week in rural Georgia — the country, not the state. They ate khachapuri for breakfast and will never be the same.' },
    ],
  },

  {
    id: 'wellness-seeker',
    label: 'The Wellness-First Traveler',
    demo: { age: 40, gender: 'F', income: 'high', location: 'Miami, FL' },
    lifeContext: {
      firstName: 'Naomi',
      homeCity: 'Miami',
      partnerName: 'Alex',
      relationshipStatus: 'married',
      hasKids: false,
      primaryCompanions: ['partner', 'solo'],
      travelFrequency: '5-6 trips/year',
      partnerTravelDynamic: 'Alex comes on the beach trips. The silent retreats I do alone. We have very different recovery needs.',
    },
    signals: [
      { tag: 'Spa as centerpiece not add-on', cat: 'Wellness', confidence: 0.96 },
      { tag: 'Plant-forward cuisine', cat: 'Food', confidence: 0.91 },
      { tag: 'Morning meditation or yoga on-site', cat: 'Wellness', confidence: 0.93 },
      { tag: 'Natural hot springs or thermal baths', cat: 'Wellness', confidence: 0.90 },
      { tag: 'Anti-party-hotel', cat: 'Rejection', confidence: 0.92 },
      { tag: 'Circadian-aware room design', cat: 'Design', confidence: 0.85 },
      { tag: 'Ocean or nature sounds over music', cat: 'Character', confidence: 0.88 },
      { tag: 'Clean beauty amenities', cat: 'Service', confidence: 0.84 },
      { tag: 'Digital detox capability', cat: 'Character', confidence: 0.82 },
      { tag: 'Anti-buffet', cat: 'Rejection', confidence: 0.87 },
      { tag: 'Breathing room between spaces', cat: 'Design', confidence: 0.89 },
      { tag: 'Sleep quality above all', cat: 'Wellness', confidence: 0.95 },
    ],
    contradictions: [
      { stated: 'Travels for deep wellness and healing', revealed: 'Equally excited about beach clubs and sunset cocktails on partner trips', resolution: 'Two distinct travel modes: healing (solo, austere, intentional) and pleasure (partner, sensory, indulgent)', matchRule: 'For solo context: score heavily for wellness infrastructure. For partner context: score for sensory pleasure and social dining' },
    ],
    certainties: { Design: 70, Character: 75, Service: 80, Food: 85, Location: 70, Wellness: 98 },
    messages: [
      { role: 'user', text: 'I did a silent retreat at Kamalaya in Koh Samui and it reset my entire nervous system. The food was medicinal and beautiful at the same time.' },
      { role: 'user', text: 'Sleep is my number one criterion. If the room is not pitch dark with a great mattress and no noise, nothing else matters.' },
      { role: 'user', text: 'When Alex and I go to Tulum, we want the opposite — mezcal, ceviche, dancing. But I still choose places with good spa programs so I can recover the next morning.' },
    ],
  },

  {
    id: 'food-pilgrim',
    label: 'The Food Pilgrim',
    demo: { age: 50, gender: 'M', income: 'medium-high', location: 'New Orleans, LA' },
    lifeContext: {
      firstName: 'Marcus',
      homeCity: 'New Orleans',
      partnerName: 'Diane',
      relationshipStatus: 'married',
      hasKids: true,
      kidAges: ['22', '19'],
      primaryCompanions: ['partner', 'solo'],
      travelFrequency: '4-5 trips/year',
      partnerTravelDynamic: 'Diane tolerates my food obsession but she wants museums and walking tours too. When I go solo it is all eating, all the time.',
    },
    signals: [
      { tag: 'Michelin and street food equally', cat: 'Food', confidence: 0.96 },
      { tag: 'Market proximity essential', cat: 'Location', confidence: 0.93 },
      { tag: 'Kitchen-viewable dining', cat: 'Food', confidence: 0.88 },
      { tag: 'Anti-hotel-restaurant-only', cat: 'Rejection', confidence: 0.91 },
      { tag: 'Chef-driven menus', cat: 'Food', confidence: 0.94 },
      { tag: 'Regional food traditions', cat: 'Food', confidence: 0.95 },
      { tag: 'Walking-friendly food neighborhoods', cat: 'Location', confidence: 0.90 },
      { tag: 'Anti-fusion-without-roots', cat: 'Rejection', confidence: 0.83 },
      { tag: 'Natural wine and craft spirits', cat: 'Food', confidence: 0.87 },
      { tag: 'Simple room is fine if food is great', cat: 'Character', confidence: 0.85 },
      { tag: 'Early morning food markets', cat: 'Food', confidence: 0.92 },
      { tag: 'Cooking class or food tour available', cat: 'Service', confidence: 0.80 },
    ],
    contradictions: [
      { stated: 'Claims the hotel room does not matter at all', revealed: 'Gets cranky with a bad mattress and actually appreciates good room design on reflection', resolution: 'Food is the conscious priority but body comfort is the unconscious one — needs a solid base camp for eating expeditions', matchRule: 'Score primarily on food scene proximity and quality but require minimum comfort standards for sleep and bathroom' },
    ],
    certainties: { Design: 35, Character: 60, Service: 65, Food: 98, Location: 90, Wellness: 40 },
    messages: [
      { role: 'user', text: 'I planned an entire trip to San Sebastián around pintxos. Five days, four pintxos bars a night, plus lunch at Arzak. The hotel was an afterthought — I barely saw the room.' },
      { role: 'user', text: 'The best meal of my life was in a nondescript building in Oaxaca — tlayudas made by a grandmother who has been doing it for fifty years. No menu, no sign. Someone told someone who told me.' },
      { role: 'user', text: 'Diane makes me go to one museum per food city. Fair trade. But I pick the city.' },
    ],
  },

  {
    id: 'spontaneous-creative',
    label: 'The Spontaneous Creative',
    demo: { age: 33, gender: 'F', income: 'variable', location: 'Nashville, TN' },
    lifeContext: {
      firstName: 'Zara',
      homeCity: 'Nashville',
      relationshipStatus: 'single',
      hasKids: false,
      primaryCompanions: ['solo', 'friends'],
      travelFrequency: '6-8 trips/year',
      soloTravelIdentity: 'I book flights on impulse. I once went to Lisbon because I saw a photo of a staircase. My best trips are the ones I did not plan.',
    },
    signals: [
      { tag: 'Anti-itinerary', cat: 'Rejection', confidence: 0.94 },
      { tag: 'Arts and music scene proximity', cat: 'Location', confidence: 0.92 },
      { tag: 'Late checkout essential', cat: 'Service', confidence: 0.88 },
      { tag: 'Eclectic and unexpected interiors', cat: 'Design', confidence: 0.90 },
      { tag: 'Live music within walking distance', cat: 'Location', confidence: 0.87 },
      { tag: 'Anti-quiet-by-10pm', cat: 'Rejection', confidence: 0.85 },
      { tag: 'Creative community spaces', cat: 'Character', confidence: 0.89 },
      { tag: 'Vintage and thrift neighborhood', cat: 'Location', confidence: 0.83 },
      { tag: 'Late-night food options', cat: 'Food', confidence: 0.86 },
      { tag: 'Art in common spaces not corporate art', cat: 'Design', confidence: 0.91 },
      { tag: 'Flexible cancellation policy', cat: 'Service', confidence: 0.82 },
      { tag: 'Anti-sterile-minimalism', cat: 'Rejection', confidence: 0.80 },
    ],
    contradictions: [
      { stated: 'Hates planning and structure', revealed: 'Has a deeply curated mental map of neighborhoods and knows exactly which blocks to stay on', resolution: 'Anti-formal-planning but deeply researched — the spontaneity is informed by obsessive knowledge acquisition', matchRule: 'Recommend properties in specific creative neighborhoods rather than generic city centers — reward hyper-local placement' },
      { stated: 'Claims to be low-maintenance about rooms', revealed: 'Will leave a hotel that does not have the right vibe even if it means losing money', resolution: 'Not picky about amenities but extremely picky about energy and character — vibe is the amenity', matchRule: 'Score primarily on character and neighborhood energy rather than amenity lists' },
    ],
    certainties: { Design: 80, Character: 90, Service: 55, Food: 75, Location: 95, Wellness: 30 },
    messages: [
      { role: 'user', text: 'I stayed at Mama Shelter in Paris and the lobby was full of creative people working on laptops and drinking natural wine at 3pm. I knew immediately I was home.' },
      { role: 'user', text: 'I once checked out of a beautiful minimalist hotel in Tokyo because it was too quiet. I need energy. I need to feel the city around me.' },
      { role: 'user', text: 'My ideal hotel has weird art, a bar that is open late, and is in a neighborhood where I can wander for hours and find something I did not expect.' },
    ],
  },

  {
    id: 'meticulous-planner',
    label: 'The Meticulous Planner',
    demo: { age: 48, gender: 'M', income: 'high', location: 'Boston, MA' },
    lifeContext: {
      firstName: 'Thomas',
      homeCity: 'Boston',
      partnerName: 'Catherine',
      relationshipStatus: 'married',
      hasKids: true,
      kidAges: ['16', '13'],
      primaryCompanions: ['family', 'partner'],
      travelFrequency: '3-4 trips/year',
      partnerTravelDynamic: 'I do all the research and Catherine does all the booking. I find the places, she handles the logistics. The kids come on two trips, we go alone on the other two.',
    },
    signals: [
      { tag: 'Reviews as research corpus', cat: 'Character', confidence: 0.93 },
      { tag: 'Consistent service reliability', cat: 'Service', confidence: 0.95 },
      { tag: 'Anti-surprise', cat: 'Rejection', confidence: 0.88 },
      { tag: 'Detailed room category knowledge', cat: 'Character', confidence: 0.90 },
      { tag: 'Airport transfer logistics', cat: 'Service', confidence: 0.86 },
      { tag: 'Classic fine dining appreciation', cat: 'Food', confidence: 0.84 },
      { tag: 'Traditional architecture respect', cat: 'Design', confidence: 0.82 },
      { tag: 'Anti-trendy-for-trendy-sake', cat: 'Rejection', confidence: 0.87 },
      { tag: 'Loyalty program engagement', cat: 'Service', confidence: 0.80 },
      { tag: 'Safety and security conscious', cat: 'Location', confidence: 0.91 },
      { tag: 'Proven track record properties', cat: 'Character', confidence: 0.92 },
      { tag: 'Predictable quality over exciting risk', cat: 'Character', confidence: 0.89 },
    ],
    contradictions: [
      { stated: 'Says he values reliability above all else', revealed: 'His most memorable trips involved unexpected discoveries — a hidden restaurant, a chance encounter', resolution: 'Uses planning to create a safe container for discovery — the structure enables him to be open to surprise', matchRule: 'Recommend established, well-reviewed properties in locations that reward wandering — the predictable base enables unpredictable exploration' },
      { stated: 'Prefers traditional, established properties', revealed: 'Secretly admires newer boutique hotels and reads design blogs', resolution: 'Risk-averse in booking but aesthetically curious — needs social proof before trying something new', matchRule: 'Include well-reviewed boutique properties with strong track records rather than brand-new openings' },
    ],
    certainties: { Design: 65, Character: 85, Service: 95, Food: 80, Location: 75, Wellness: 60 },
    messages: [
      { role: 'user', text: 'I read every review on TripAdvisor, Google, and Booking before I commit. I want to know what room 304 looks like, whether the breakfast buffet is worth it, and if the wifi actually works.' },
      { role: 'user', text: 'We stayed at the Hotel Negresco in Nice three years in a row because I know exactly what we are getting. Catherine thinks we should try something new but I say: why risk it?' },
      { role: 'user', text: 'That said... the most magical meal we ever had was at a random trattoria in Rome that was not on any list. The waiter just kept bringing food. Those moments I cannot plan for, and they haunt me.' },
    ],
  },

  // ── NON-BOUTIQUE / MAINSTREAM / RESORT-FORWARD ─────────────────────────
  {
    id: 'resort-family',
    label: 'The All-In Resort Family',
    demo: { age: 41, gender: 'M', income: 'high', location: 'Dallas, TX' },
    lifeContext: {
      firstName: 'Kevin',
      homeCity: 'Dallas',
      partnerName: 'Ashley',
      relationshipStatus: 'married',
      hasKids: true,
      kidAges: ['9', '6', '3'],
      primaryCompanions: ['family'],
      travelFrequency: '2-3 trips/year',
      partnerTravelDynamic: 'Ashley and I need the kids to be occupied so we can actually relax. If the kids are happy, we are happy. That is the entire equation.',
    },
    signals: [
      { tag: 'Kids club is essential', cat: 'Service', confidence: 0.97 },
      { tag: 'Multiple pool options', cat: 'Wellness', confidence: 0.95 },
      { tag: 'Waterslides and splash pads', cat: 'Wellness', confidence: 0.92 },
      { tag: 'Large resort with variety', cat: 'Character', confidence: 0.94 },
      { tag: 'Buffet breakfast with kid options', cat: 'Food', confidence: 0.90 },
      { tag: 'Room size and connecting rooms', cat: 'Design', confidence: 0.88 },
      { tag: 'Anti-tiny-boutique-room', cat: 'Rejection', confidence: 0.93 },
      { tag: 'Beach access with calm water', cat: 'Location', confidence: 0.91 },
      { tag: 'On-site restaurants plural', cat: 'Food', confidence: 0.89 },
      { tag: 'Evening entertainment for families', cat: 'Service', confidence: 0.85 },
      { tag: 'Anti-quiet-adults-only', cat: 'Rejection', confidence: 0.96 },
      { tag: 'Stroller-friendly grounds', cat: 'Location', confidence: 0.87 },
      { tag: 'Reliable brand name trust', cat: 'Character', confidence: 0.83 },
      { tag: 'All-inclusive pricing clarity', cat: 'Service', confidence: 0.86 },
    ],
    contradictions: [
      { stated: 'Says design does not matter to him at all', revealed: 'Noticed and appreciated when their Maui resort had a beautiful open-air lobby and tasteful Hawaiian decor', resolution: 'Does not lead with design as a criterion but responds positively when it is present — design is the unexpected bonus, not the search term', matchRule: 'Do not filter on design but use it as a tiebreaker between otherwise similar resort options' },
      { stated: 'Claims he only cares about the kids having fun', revealed: 'Lights up describing the adults-only pool section and the golf course at their favorite resort', resolution: 'Family-first in decision-making but adult amenities drive his personal satisfaction — needs both layers', matchRule: 'Require strong kids facilities as baseline but score bonus for adult-only zones within the same resort' },
    ],
    certainties: { Design: 25, Character: 70, Service: 95, Food: 75, Location: 80, Wellness: 90 },
    messages: [
      { role: 'user', text: 'We do the Grand Hyatt in Maui every other year. Three pools, a kids club that the 6-year-old begs to go to, a lazy river for the 9-year-old, and a swim-up bar for Ashley and me. Everybody wins.' },
      { role: 'user', text: 'I tried a boutique hotel once in Tulum before we had kids. Beautiful but the room was the size of a closet and there was nothing for children within a mile. Never again with this crew.' },
      { role: 'user', text: 'Our best vacation was the Atlantis in the Bahamas. I know people roll their eyes at it but the kids were in heaven and we actually read books by the pool for the first time in three years.' },
      { role: 'user', text: 'Honestly if the hotel has a great kids club, multiple restaurants so we are not eating the same thing every night, and a pool with a slide — I am sold. Everything else is gravy.' },
    ],
  },

  {
    id: 'ease-first-vacationer',
    label: 'The Ease-First Vacationer',
    demo: { age: 52, gender: 'F', income: 'medium-high', location: 'Scottsdale, AZ' },
    lifeContext: {
      firstName: 'Debbie',
      homeCity: 'Scottsdale',
      partnerName: 'Mike',
      relationshipStatus: 'married',
      hasKids: true,
      kidAges: ['24', '21'],
      primaryCompanions: ['partner', 'friends'],
      travelFrequency: '3-4 trips/year',
      partnerTravelDynamic: 'Mike and I just want easy. We work hard all year. Vacation should not require a PhD in hotel research. Big comfortable resort, good food on-site, done.',
    },
    signals: [
      { tag: 'Hassle-free everything', cat: 'Service', confidence: 0.96 },
      { tag: 'Large comfortable rooms', cat: 'Design', confidence: 0.90 },
      { tag: 'Reliable chain brands', cat: 'Character', confidence: 0.88 },
      { tag: 'On-site dining variety', cat: 'Food', confidence: 0.92 },
      { tag: 'Spa with full menu', cat: 'Wellness', confidence: 0.91 },
      { tag: 'Golf course on property or nearby', cat: 'Wellness', confidence: 0.85 },
      { tag: 'Anti-hipster-hotel', cat: 'Rejection', confidence: 0.87 },
      { tag: 'Airport shuttle or easy transfer', cat: 'Service', confidence: 0.89 },
      { tag: 'Loyalty program benefits', cat: 'Service', confidence: 0.84 },
      { tag: 'Pool and cabana culture', cat: 'Wellness', confidence: 0.90 },
      { tag: 'Anti-shared-bathroom', cat: 'Rejection', confidence: 0.95 },
      { tag: 'American breakfast availability', cat: 'Food', confidence: 0.82 },
      { tag: 'King bed non-negotiable', cat: 'Design', confidence: 0.93 },
      { tag: 'Clean and well-maintained over trendy', cat: 'Character', confidence: 0.91 },
    ],
    contradictions: [
      { stated: 'Says she does not care about aesthetics', revealed: 'Chose their favorite resort in Cabo partly because the lobby was gorgeous and the room had an ocean view with a beautiful balcony', resolution: 'Aesthetic appreciation is passive not active — she responds to beauty but does not search for it. The vibe matters more than she admits.', matchRule: 'Score on comfort and service first but include aesthetic quality as a secondary factor — she will notice and appreciate it' },
      { stated: 'Claims to hate fancy pretentious places', revealed: 'Her favorite trips have all been at upscale resorts with valet, concierge, and premium dining', resolution: 'Anti-pretension but pro-service-quality. Wants to feel taken care of, not looked down on. The line is attitude, not price.', matchRule: 'Score for warm high-end service, penalize cold or exclusive-feeling luxury' },
    ],
    certainties: { Design: 30, Character: 65, Service: 95, Food: 80, Location: 65, Wellness: 88 },
    messages: [
      { role: 'user', text: 'We love the Montage in Cabo. We have been three times. The room is huge, the pool is perfect, the steak restaurant is fantastic, and the spa is my happy place. Why would I go anywhere else?' },
      { role: 'user', text: 'My friend dragged me to some tiny design hotel in Palm Springs with a shared courtyard pool and a room so small I could not open my suitcase. Never again. I need space.' },
      { role: 'user', text: 'When we go with our couple friends, we want a resort big enough that we can do our own thing during the day and meet up for dinner. Nobody is on top of each other.' },
      { role: 'user', text: 'Mike is a Marriott Bonvoy Titanium member. We joke that the loyalty program is our love language. Those upgrades and late checkouts are everything.' },
    ],
  },

  {
    id: 'group-celebration',
    label: 'The Group Celebration Planner',
    demo: { age: 36, gender: 'F', income: 'medium', location: 'Atlanta, GA' },
    lifeContext: {
      firstName: 'Tanya',
      homeCity: 'Atlanta',
      relationshipStatus: 'single',
      hasKids: false,
      primaryCompanions: ['friends', 'family'],
      travelFrequency: '3-4 trips/year',
      soloTravelIdentity: 'I am always the one organizing group trips. Birthdays, bachelorettes, family reunions. I need places that work for 10-20 people with different needs.',
    },
    signals: [
      { tag: 'Group booking capability', cat: 'Service', confidence: 0.96 },
      { tag: 'Multiple room types and price points', cat: 'Character', confidence: 0.92 },
      { tag: 'Event and party spaces', cat: 'Character', confidence: 0.90 },
      { tag: 'Large resort with activities', cat: 'Character', confidence: 0.93 },
      { tag: 'Pool party vibes', cat: 'Wellness', confidence: 0.91 },
      { tag: 'Anti-quiet-intimate-hotel', cat: 'Rejection', confidence: 0.88 },
      { tag: 'Nightlife on or near property', cat: 'Location', confidence: 0.87 },
      { tag: 'Group dining with communal tables', cat: 'Food', confidence: 0.89 },
      { tag: 'Fun over fancy', cat: 'Character', confidence: 0.94 },
      { tag: 'DJ pool or beach club', cat: 'Wellness', confidence: 0.85 },
      { tag: 'Photo-worthy common areas', cat: 'Design', confidence: 0.82 },
      { tag: 'Affordable per-person cost', cat: 'Character', confidence: 0.90 },
      { tag: 'Anti-stuffy-dress-code', cat: 'Rejection', confidence: 0.86 },
      { tag: 'All-inclusive simplifies group budgets', cat: 'Service', confidence: 0.88 },
    ],
    contradictions: [
      { stated: 'Says she does not care about the room because she is never in it', revealed: 'Always books herself the best room as a treat and curates the aesthetic of group trip photo locations', resolution: 'Publicly group-first but privately quality-conscious — the organizer tax includes rewarding herself with the upgrade', matchRule: 'Recommend properties with range of room tiers so she can book the group affordably while treating herself to a suite' },
      { stated: 'Prioritizes fun and energy above everything', revealed: 'Gets stressed when properties do not have enough variety to keep 15 different personalities happy', resolution: 'Fun is the goal but operational ease is the hidden priority — she needs a property that is its own ecosystem so she does not have to manage logistics', matchRule: 'Score heavily for properties with diverse on-site amenities (multiple pools, restaurants, activities, nightlife) to reduce coordination burden' },
    ],
    certainties: { Design: 45, Character: 85, Service: 90, Food: 70, Location: 80, Wellness: 75 },
    messages: [
      { role: 'user', text: 'I organized a 30th birthday for 18 people at Hard Rock Punta Cana. All-inclusive, multiple pools, a nightclub on-site, and rooms at three different price points so everyone could afford it. That is my sweet spot.' },
      { role: 'user', text: 'Small boutique hotels give me anxiety for group trips. What if someone does not like the food? What if there is only one pool and it is quiet? I need options and energy.' },
      { role: 'user', text: 'For my cousin\'s bachelorette we did a big resort in Cancún — the pool had a DJ during the day, there were six restaurants, and we could do a spa day for the group. Everyone was happy. That is all I want as a planner.' },
      { role: 'user', text: 'I will say this: even though I prioritize the group, I always quietly book myself a suite. The organizer deserves the balcony.' },
    ],
  },
];

// ---------------------------------------------------------------------------
// PROMPTS (copied from production constants)
// ---------------------------------------------------------------------------
const PROFILE_SYNTHESIS_PROMPT = `You are synthesizing a complete Terrazzo taste profile from accumulated taste signals, conversation history, and detected contradictions.

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
  "matchedProperties": [5 real properties with name/location/score/matchReasons/tensionResolved],

  "bestQuote": {
    "quote": "A real line the user said during onboarding — the moment that revealed the most about their taste. Choose for emotional resonance, not information.",
    "insight": "One sentence: what this quote revealed about them."
  },

  "designInsight": {
    "headline": "A short sentence about how they see space",
    "annotations": [
      { "axis": "volume", "label": ["Minimal", "Maximal"], "note": "Observation about visual density." },
      { "axis": "temperature", "label": ["Cool & Composed", "Warm & Rich"], "note": "Material/color warmth preference." },
      { "axis": "time", "label": ["Contemporary", "Historic & Layered"], "note": "Temporal aesthetic preference." },
      { "axis": "formality", "label": ["Raw & Natural", "Polished & Sleek"], "note": "Material finish preference." },
      { "axis": "culture", "label": ["International", "Deeply Local"], "note": "Universal vs place-specific design." },
      { "axis": "mood", "label": ["Serene", "Energetic"], "note": "Light and energy preference." }
    ]
  },

  "perfectDay": {
    "morning": "2-3 sentences. Sensory, specific.",
    "afternoon": "2-3 sentences.",
    "evening": "2-3 sentences."
  },

  "howYouShift": [
    { "context": "With [partner/companion]", "insight": "1-2 sentences." },
    { "context": "Solo", "insight": "1-2 sentences." },
    { "context": "With friends", "insight": "1-2 sentences." }
  ],

  "tasteNeighbors": {
    "nearbyArchetypes": ["2-3 archetype names"],
    "distinction": "1 sentence: what makes them different.",
    "rarityStat": "A specific stat about their signal combination."
  },

  "destinations": {
    "familiar": ["2-3 destination regions they'd expect to love"],
    "surprise": {
      "name": "One unexpected destination",
      "reason": "Why, referencing their specific signals."
    }
  }
}

RULES:
- Archetype name must feel personal, not generic.
- Contradictions must have actionable matchRules.
- Micro-taste signals should include both positive and rejection signals.
- Matched properties must be REAL hotels/properties.
- Write like a well-traveled friend — warm, specific, never clinical.
- bestQuote must be a REAL quote pulled verbatim from the conversation highlights.
- designInsight annotations should reference specific things the user said.
- perfectDay should feel like a lived experience, not a data summary.
- howYouShift should use the partner's actual name if provided.
- tasteNeighbors rarityStat should cite a specific, non-obvious signal combination.
- destinations.surprise must be a real, lesser-known place.
- Never mention AI, algorithms, or data processing.`;

const DISCOVER_SYSTEM_PROMPT = `You are Terrazzo's editorial intelligence — a deeply tasteful, well-traveled curator who writes like the best travel magazines but thinks like a data scientist. Given a user's complete taste profile, generate a hyper-personalized discover feed that feels like a love letter from someone who truly understands how they travel.

You must return valid JSON matching this EXACT structure:

{
  "editorialLetter": {
    "headline": "A provocative, personal observation about their taste (max 12 words).",
    "body": "2-3 sentences. Second-person. Deeply specific to their signals.",
    "signalHighlight": "The single micro-signal that inspired this letter"
  },
  "becauseYouCards": [
    {
      "signal": "a specific micro-signal from their profile",
      "signalDomain": "Design Language | Character & Identity | Service Philosophy | Food & Drink | Location & Context | Wellness & Body",
      "place": "Real place name",
      "location": "City, Country",
      "score": 85-99,
      "why": "2-sentence explanation connecting the signal to this specific place.",
      "bg": "#hex color (dark, moody)"
    }
  ],
  "signalThread": {
    "signal": "A dominant micro-signal from their profile",
    "domain": "The domain it belongs to",
    "thread": "1 sentence explaining how this signal shapes their travel.",
    "places": [
      { "name": "Place name", "location": "City, Country", "type": "hotel | restaurant | bar | cafe | neighborhood", "connection": "1 sentence", "score": 80-99 }
    ]
  },
  "tasteTension": {
    "title": "A compelling 4-6 word title for their most interesting contradiction",
    "stated": "What they said they prefer",
    "revealed": "What their behavior shows",
    "editorial": "2-3 sentences exploring WHY this tension exists.",
    "resolvedBy": { "name": "A real place", "location": "City, Country", "how": "1 sentence" }
  },
  "weeklyCollection": {
    "title": "Thematic collection title (max 10 words)",
    "subtitle": "Filtered for: signal1 · signal2 · signal3",
    "places": [
      { "name": "Place", "location": "City, Country", "score": 80-99, "signals": [], "signalDomain": "Primary domain", "note": "1-sentence personalized explanation" }
    ]
  },
  "moodBoards": [
    {
      "mood": "When you... (max 8 words)",
      "description": "1-sentence evocative description",
      "color": "#hex (muted, editorial)",
      "places": [
        { "name": "Place", "location": "City, Country", "vibe": "3-5 word descriptor", "score": 80-97 }
      ]
    }
  ],
  "deepMatch": {
    "name": "Highest-match property",
    "location": "City, Country",
    "score": 93-99,
    "headline": "Personal editorial statement (max 12 words)",
    "signalBreakdown": [
      { "signal": "Specific micro-signal", "domain": "Domain name", "strength": 85-99, "note": "Why this matches" }
    ],
    "tensionResolved": "1-2 sentences"
  },
  "stretchPick": {
    "name": "Place name",
    "location": "City, Country",
    "score": 65-80,
    "type": "hotel | restaurant | cafe | bar",
    "strongAxis": "Axis name",
    "strongScore": 85-99,
    "weakAxis": "Axis name",
    "weakScore": 20-45,
    "why": "2 sentences.",
    "tension": "What breaks their usual pattern"
  },
  "contextRecs": [
    { "name": "Place", "location": "City, Country", "score": 80-97, "whyFits": "1-sentence context-specific fit" }
  ],
  "contextLabel": "Summer" or "Winter" or "With Partner" etc
}

RULES:
- Use REAL places. Hotels, restaurants, cafes well-known in the design/boutique world.
- Generate: 1 editorialLetter, 3 becauseYouCards, 1 signalThread with 3 places, 1 tasteTension, 5 weeklyCollection places, 2 moodBoards with 3 places each, 1 deepMatch with 4-5 signal breakdowns, 1 stretchPick, 3 contextRecs.
- Scores reflect genuine alignment with the profile.
- Every "why", "note", "connection" must reference SPECIFIC profile signals.
- Write like a well-traveled friend with perfect recall. Warm, specific, editorial — never promotional.`;

// ---------------------------------------------------------------------------
// PIPELINE
// ---------------------------------------------------------------------------

async function synthesizeProfile(persona, maxRetries = 2) {
  const contextMessage = `
Synthesize a complete taste profile from the following onboarding data:

SIGNALS (${persona.signals.length} total):
${JSON.stringify(persona.signals, null, 2)}

KEY CONVERSATION HIGHLIGHTS:
${persona.messages.map(m => `- "${m.text}"`).join('\n')}

DETECTED CONTRADICTIONS:
${JSON.stringify(persona.contradictions, null, 2)}

FINAL CERTAINTIES:
${JSON.stringify(persona.certainties)}

LIFE CONTEXT:
${JSON.stringify(persona.lifeContext, null, 2)}

Return valid JSON only matching the specified schema. Ensure the JSON is well-formed with no trailing commas.`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      system: [{ type: 'text', text: PROFILE_SYNTHESIS_PROMPT }],
      messages: [{ role: 'user', content: contextMessage }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      if (attempt < maxRetries) { console.log(`    ⚠️  No JSON found, retrying (${attempt + 1}/${maxRetries})...`); continue; }
      throw new Error(`Failed to synthesize profile for ${persona.id}`);
    }
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      if (attempt < maxRetries) { console.log(`    ⚠️  JSON parse error, retrying (${attempt + 1}/${maxRetries})...`); continue; }
      throw new Error(`JSON parse failed for ${persona.id} after ${maxRetries + 1} attempts: ${e.message}`);
    }
  }
}

async function generateDiscoverFeed(persona, profile, maxRetries = 2) {
  const companion = persona.lifeContext.primaryCompanions?.[0] || 'solo';
  const month = new Date().getMonth();
  const season = month >= 4 && month <= 9 ? 'Summer' : 'Winter';
  const contextLabel = companion !== 'solo' ? `With ${companion}` : season;

  const contextMessage = `
USER'S TASTE PROFILE:
- Archetype: ${profile.overallArchetype}
- Description: ${profile.archetypeDescription || ''}
- Emotional driver: ${profile.emotionalDriver?.primary || 'Unknown'} / ${profile.emotionalDriver?.secondary || 'Unknown'}

MICRO-SIGNALS BY DOMAIN:
${Object.entries(profile.microTasteSignals || {}).map(([domain, signals]) => `${domain}: ${signals.join(', ')}`).join('\n')}

RADAR AXES:
${(profile.radarData || []).map(r => `${r.axis}: ${Math.round(r.value * 100)}%`).join(', ')}

CONTRADICTIONS:
${(profile.contradictions || []).map(c => `${c.stated} vs ${c.revealed} → ${c.resolution}`).join('\n') || 'None identified'}

CONTEXT MODIFIERS:
${(profile.contextModifiers || []).map(m => `${m.context}: ${Array.isArray(m.shifts) ? m.shifts.join(', ') : m.shifts || ''}`).join('\n') || 'None'}

LIFE CONTEXT:
- Name: ${persona.lifeContext.firstName}
- Home: ${persona.lifeContext.homeCity}
- Primary companion: ${companion}
- Current season: ${season}

CONTEXT LABEL FOR RECS: "${contextLabel}"

Generate the full discover feed. Return valid JSON only. Ensure the JSON is well-formed with no trailing commas.`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: [{ type: 'text', text: DISCOVER_SYSTEM_PROMPT }],
      messages: [{ role: 'user', content: contextMessage }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      if (attempt < maxRetries) { console.log(`    ⚠️  No JSON found, retrying (${attempt + 1}/${maxRetries})...`); continue; }
      throw new Error(`Failed to generate discover feed for ${persona.id}`);
    }
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      if (attempt < maxRetries) { console.log(`    ⚠️  JSON parse error, retrying (${attempt + 1}/${maxRetries})...`); continue; }
      throw new Error(`Feed JSON parse failed for ${persona.id} after ${maxRetries + 1} attempts: ${e.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// HTML DASHBOARD GENERATOR
// ---------------------------------------------------------------------------

function generateDashboard(results) {
  const personaCards = results.map((r, i) => {
    const p = r.persona;
    const profile = r.profile;
    const feed = r.feed;

    const radarHtml = (profile?.radarData || []).map(rd =>
      `<div class="radar-bar"><span class="radar-label">${rd.axis}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(rd.value*100)}%"></div></div><span class="radar-val">${Math.round(rd.value*100)}%</span></div>`
    ).join('');

    const signalsHtml = Object.entries(profile?.microTasteSignals || {}).map(([cat, tags]) =>
      `<div class="signal-group"><strong>${cat}</strong>: ${tags.join(', ')}</div>`
    ).join('');

    const matchedHtml = (profile?.matchedProperties || []).map(mp =>
      `<div class="matched-prop"><strong>${mp.name}</strong> — ${mp.location} <span class="score">${mp.score}</span><div class="match-reason">${(mp.matchReasons || []).join('; ')}</div></div>`
    ).join('');

    const contradictionsHtml = (profile?.contradictions || []).map(c =>
      `<div class="contradiction"><div class="stated">Stated: ${c.stated}</div><div class="revealed">Revealed: ${c.revealed}</div><div class="resolution">→ ${c.resolution}</div></div>`
    ).join('');

    const feedLetterHtml = feed ? `
      <div class="editorial-letter">
        <h4>${feed.editorialLetter?.headline || ''}</h4>
        <p>${feed.editorialLetter?.body || ''}</p>
        <span class="signal-tag">${feed.editorialLetter?.signalHighlight || ''}</span>
      </div>` : '<p class="muted">Feed not generated</p>';

    const becauseYouHtml = (feed?.becauseYouCards || []).map(card =>
      `<div class="because-card" style="background:${card.bg}"><div class="bc-signal">${card.signal}</div><div class="bc-place">${card.place}, ${card.location}</div><div class="bc-score">${card.score}</div><div class="bc-why">${card.why}</div></div>`
    ).join('');

    const deepMatchHtml = feed?.deepMatch ? `
      <div class="deep-match">
        <div class="dm-name">${feed.deepMatch.name} — ${feed.deepMatch.location}</div>
        <div class="dm-score">${feed.deepMatch.score}</div>
        <div class="dm-headline">${feed.deepMatch.headline}</div>
        ${(feed.deepMatch.signalBreakdown || []).map(s => `<div class="dm-signal">${s.signal} (${s.domain}): ${s.strength} — ${s.note}</div>`).join('')}
        <div class="dm-tension">${feed.deepMatch.tensionResolved}</div>
      </div>` : '';

    const stretchHtml = feed?.stretchPick ? `
      <div class="stretch-pick">
        <div class="sp-name">${feed.stretchPick.name} — ${feed.stretchPick.location}</div>
        <div class="sp-score">${feed.stretchPick.score}</div>
        <div class="sp-why">${feed.stretchPick.why}</div>
        <div class="sp-tension">${feed.stretchPick.tension}</div>
      </div>` : '';

    const weeklyHtml = feed?.weeklyCollection ? `
      <div class="weekly-collection">
        <h4>${feed.weeklyCollection.title}</h4>
        <p class="wc-sub">${feed.weeklyCollection.subtitle}</p>
        ${(feed.weeklyCollection.places || []).map(wp => `<div class="wc-place"><strong>${wp.name}</strong> — ${wp.location} <span class="score">${wp.score}</span><div>${wp.note}</div></div>`).join('')}
      </div>` : '';

    const moodHtml = (feed?.moodBoards || []).map(mb =>
      `<div class="mood-board" style="border-left:4px solid ${mb.color}"><h5>${mb.mood}</h5><p class="mb-desc">${mb.description}</p>${mb.places.map(mp => `<div class="mb-place">${mp.name}, ${mp.location} — <em>${mp.vibe}</em> <span class="score">${mp.score}</span></div>`).join('')}</div>`
    ).join('');

    const perfectDayHtml = profile?.perfectDay ? `
      <div class="perfect-day">
        <div class="pd-section"><strong>Morning:</strong> ${profile.perfectDay.morning}</div>
        <div class="pd-section"><strong>Afternoon:</strong> ${profile.perfectDay.afternoon}</div>
        <div class="pd-section"><strong>Evening:</strong> ${profile.perfectDay.evening}</div>
      </div>` : '';

    return `
    <div class="persona-card" id="persona-${i}" data-id="${p.id}">
      <div class="persona-header" style="background:${['#2d3a2d','#3a2d2d','#2d2d3a','#3a3a2d','#2d3a3a','#3a2d3a','#2d3333','#33332d','#332d33','#2d3333','#3a332d','#2d333a','#3a3328','#2d3a33','#33283a'][i % 15]}">
        <h2>${p.label}</h2>
        <div class="persona-meta">${p.lifeContext.firstName} · ${p.demo.age} · ${p.demo.location} · ${p.demo.income} income</div>
        <div class="persona-companions">Travels: ${p.lifeContext.primaryCompanions.join(', ')} · ${p.lifeContext.travelFrequency}</div>
      </div>

      <div class="tabs">
        <button class="tab active" onclick="showTab(this, 'profile-${i}')">Profile</button>
        <button class="tab" onclick="showTab(this, 'feed-${i}')">Discover Feed</button>
        <button class="tab" onclick="showTab(this, 'raw-${i}')">Raw Data</button>
      </div>

      <div class="tab-content active" id="profile-${i}">
        <div class="archetype-banner">
          <h3>${profile?.overallArchetype || 'Generating...'}</h3>
          <p>${profile?.archetypeDescription || ''}</p>
        </div>

        ${profile?.bestQuote ? `<blockquote class="best-quote">"${profile.bestQuote.quote}"<footer>${profile.bestQuote.insight}</footer></blockquote>` : ''}

        <div class="section">
          <h4>Emotional Driver</h4>
          <p><strong>${profile?.emotionalDriver?.primary || '?'}</strong>: ${profile?.emotionalDriver?.description || ''}</p>
          <p class="muted">Secondary: ${profile?.emotionalDriver?.secondary || '?'}</p>
        </div>

        <div class="section">
          <h4>Radar</h4>
          ${radarHtml}
        </div>

        <div class="section">
          <h4>Micro-Taste Signals</h4>
          ${signalsHtml}
        </div>

        <div class="section">
          <h4>Contradictions</h4>
          ${contradictionsHtml}
        </div>

        <div class="section">
          <h4>Perfect Day</h4>
          ${perfectDayHtml}
        </div>

        <div class="section">
          <h4>Matched Properties</h4>
          ${matchedHtml}
        </div>

        ${profile?.tasteNeighbors ? `<div class="section"><h4>Taste Neighbors</h4><p>Near: ${profile.tasteNeighbors.nearbyArchetypes?.join(', ')}</p><p>${profile.tasteNeighbors.distinction}</p><p class="rarity">${profile.tasteNeighbors.rarityStat}</p></div>` : ''}

        ${profile?.destinations ? `<div class="section"><h4>Destinations</h4><p>Familiar: ${profile.destinations.familiar?.join(', ')}</p><p>Surprise: <strong>${profile.destinations.surprise?.name}</strong> — ${profile.destinations.surprise?.reason}</p></div>` : ''}
      </div>

      <div class="tab-content" id="feed-${i}">
        <h4>Editorial Letter</h4>
        ${feedLetterHtml}

        <h4>Because You...</h4>
        <div class="because-grid">${becauseYouHtml}</div>

        <h4>Deep Match</h4>
        ${deepMatchHtml}

        <h4>Stretch Pick</h4>
        ${stretchHtml}

        <h4>Weekly Collection</h4>
        ${weeklyHtml}

        <h4>Mood Boards</h4>
        ${moodHtml}

        ${feed?.tasteTension ? `<h4>Taste Tension: ${feed.tasteTension.title}</h4><div class="taste-tension"><p><strong>Stated:</strong> ${feed.tasteTension.stated}</p><p><strong>Revealed:</strong> ${feed.tasteTension.revealed}</p><p>${feed.tasteTension.editorial}</p><p class="resolved">Resolved by: <strong>${feed.tasteTension.resolvedBy?.name}</strong>, ${feed.tasteTension.resolvedBy?.location} — ${feed.tasteTension.resolvedBy?.how}</p></div>` : ''}

        ${feed?.contextRecs ? `<h4>Context Recs (${feed.contextLabel})</h4>${feed.contextRecs.map(cr => `<div class="context-rec"><strong>${cr.name}</strong> — ${cr.location} <span class="score">${cr.score}</span><div>${cr.whyFits}</div></div>`).join('')}` : ''}
      </div>

      <div class="tab-content" id="raw-${i}">
        <details><summary>Input Persona</summary><pre>${JSON.stringify(p, null, 2)}</pre></details>
        <details><summary>Synthesized Profile</summary><pre>${JSON.stringify(profile, null, 2)}</pre></details>
        <details><summary>Discover Feed</summary><pre>${JSON.stringify(feed, null, 2)}</pre></details>
      </div>
    </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Terrazzo Persona Test Dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300;1,9..40,400&family=DM+Serif+Display:ital@0;1&family=Instrument+Serif:ital@0;1&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
  body { font-family: 'DM Sans', -apple-system, sans-serif; background: #f8f3ea; color: #1c1a17; line-height: 1.6; }

  .dashboard-header { padding: 40px; border-bottom: 1px solid #e8dcc8; background: #fff; }
  .dashboard-header h1 { font-family: 'Instrument Serif', Georgia, serif; font-size: 32px; font-weight: 400; font-style: italic; letter-spacing: -0.01em; color: #1c1a17; }
  .dashboard-header p { color: #9a9088; margin-top: 8px; font-size: 14px; }
  .stats-bar { display: flex; gap: 32px; margin-top: 16px; }
  .stat { font-size: 13px; color: #9a9088; }
  .stat strong { color: #1c1a17; }

  .nav-strip { display: flex; gap: 8px; padding: 16px 40px; overflow-x: auto; border-bottom: 1px solid #e8dcc8; background: #fff; position: sticky; top: 0; z-index: 10; }
  .nav-btn { background: #f8f3ea; color: #9a9088; border: 1px solid #e8dcc8; padding: 8px 16px; border-radius: 20px; cursor: pointer; font-size: 12px; font-family: 'DM Sans', sans-serif; white-space: nowrap; transition: all 0.2s; }
  .nav-btn:hover, .nav-btn.active { background: #1c1a17; color: #f8f3ea; border-color: #1c1a17; }

  .personas-container { padding: 24px 40px; max-width: 1200px; margin: 0 auto; }
  .persona-card { background: #fff; border: 1px solid #e8dcc8; border-radius: 12px; margin-bottom: 32px; overflow: hidden; }
  .persona-header { padding: 24px; color: #fff; }
  .persona-header h2 { font-family: 'DM Serif Display', Georgia, serif; font-size: 22px; font-weight: 400; }
  .persona-meta { font-size: 13px; opacity: 0.85; margin-top: 4px; }
  .persona-companions { font-size: 12px; opacity: 0.65; margin-top: 2px; }

  .tabs { display: flex; border-bottom: 1px solid #e8dcc8; padding: 0 24px; background: #faf7f0; }
  .tab { background: none; border: none; color: #9a9088; padding: 12px 20px; cursor: pointer; font-size: 13px; font-family: 'DM Sans', sans-serif; border-bottom: 2px solid transparent; transition: all 0.2s; }
  .tab:hover { color: #1c1a17; }
  .tab.active { color: #1c1a17; border-bottom-color: #c8923a; }
  .tab-content { display: none; padding: 24px; }
  .tab-content.active { display: block; }

  .archetype-banner { padding: 20px; background: #f8f3ea; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e8dcc8; }
  .archetype-banner h3 { font-family: 'DM Serif Display', Georgia, serif; color: #6844a0; font-weight: 400; font-size: 20px; }
  .archetype-banner p { color: #6b6560; font-size: 14px; margin-top: 8px; }

  .best-quote { border-left: 3px solid #c8923a; padding: 16px 20px; margin: 16px 0; background: #faf7f0; border-radius: 0 8px 8px 0; font-style: italic; color: #4a4540; }
  .best-quote footer { font-style: normal; color: #9a9088; font-size: 13px; margin-top: 8px; }

  .section { margin: 20px 0; }
  .section h4 { color: #a06c28; font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 12px; font-family: 'Space Mono', monospace; }

  .radar-bar { display: flex; align-items: center; gap: 12px; margin: 6px 0; }
  .radar-label { width: 100px; font-size: 12px; color: #9a9088; text-align: right; }
  .bar-track { flex: 1; height: 8px; background: #ede6d8; border-radius: 4px; overflow: hidden; }
  .bar-fill { height: 100%; background: linear-gradient(90deg, #c8923a, #a06c28); border-radius: 4px; transition: width 0.5s; }
  .radar-val { width: 40px; font-size: 12px; color: #9a9088; }

  .signal-group { font-size: 13px; color: #6b6560; margin: 4px 0; }
  .signal-group strong { color: #d63020; font-weight: 500; }

  .contradiction { background: #faf7f0; border-radius: 8px; padding: 12px; margin: 8px 0; font-size: 13px; border: 1px solid #e8dcc8; }
  .stated { color: #6b6560; }
  .revealed { color: #d63020; }
  .resolution { color: #2a7a56; margin-top: 4px; }

  .perfect-day .pd-section { margin: 8px 0; font-size: 13px; color: #6b6560; }
  .perfect-day .pd-section strong { color: #c8923a; }

  .matched-prop { background: #faf7f0; border-radius: 8px; padding: 12px; margin: 8px 0; border: 1px solid #e8dcc8; }
  .matched-prop strong { color: #1c1a17; }
  .match-reason { font-size: 12px; color: #9a9088; margin-top: 4px; }
  .score { background: #c8923a; color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; margin-left: 8px; font-family: 'Space Mono', monospace; }

  .rarity { color: #6844a0; font-style: italic; font-size: 13px; }

  .editorial-letter { background: #1c1a17; padding: 24px; border-radius: 8px; margin: 12px 0; color: #f8f3ea; }
  .editorial-letter h4 { font-family: 'DM Serif Display', Georgia, serif; color: #f8f3ea; font-size: 18px; font-weight: 400; margin-bottom: 8px; }
  .editorial-letter p { color: #e8dcc8; font-size: 14px; }
  .signal-tag { display: inline-block; background: rgba(200,146,58,0.2); color: #c8923a; padding: 4px 10px; border-radius: 12px; font-size: 11px; margin-top: 8px; font-family: 'Space Mono', monospace; }

  .because-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
  .because-card { padding: 16px; border-radius: 8px; color: #fff; }
  .bc-signal { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.7; font-family: 'Space Mono', monospace; }
  .bc-place { font-family: 'DM Serif Display', Georgia, serif; font-size: 16px; font-weight: 400; margin: 8px 0; }
  .bc-score { font-size: 24px; font-weight: 300; color: #eeb420; font-family: 'Space Mono', monospace; }
  .bc-why { font-size: 13px; opacity: 0.8; margin-top: 8px; }

  .deep-match { background: #1c1a17; padding: 24px; border-radius: 8px; margin: 12px 0; color: #f8f3ea; }
  .dm-name { font-family: 'DM Serif Display', Georgia, serif; font-size: 18px; color: #f8f3ea; }
  .dm-score { font-size: 36px; font-weight: 400; color: #c8923a; font-family: 'Space Mono', monospace; }
  .dm-headline { font-size: 14px; color: #e8dcc8; font-style: italic; margin: 8px 0; }
  .dm-signal { font-size: 12px; color: #9a9088; margin: 4px 0; }
  .dm-tension { font-size: 13px; color: #e8dcc8; margin-top: 12px; }

  .stretch-pick { background: #faf7f0; padding: 16px; border-radius: 8px; border-left: 3px solid #e86830; margin: 12px 0; }
  .sp-name { font-family: 'DM Serif Display', Georgia, serif; font-size: 16px; color: #1c1a17; }
  .sp-score { font-size: 24px; color: #e86830; font-weight: 400; font-family: 'Space Mono', monospace; }
  .sp-why { font-size: 13px; color: #6b6560; margin-top: 8px; }
  .sp-tension { font-size: 12px; color: #e86830; margin-top: 4px; }

  .weekly-collection { margin: 12px 0; }
  .weekly-collection h4 { font-family: 'DM Serif Display', Georgia, serif; font-size: 16px; color: #1c1a17; font-weight: 400; }
  .wc-sub { font-size: 12px; color: #9a9088; margin-bottom: 12px; font-family: 'Space Mono', monospace; }
  .wc-place { background: #faf7f0; padding: 12px; border-radius: 8px; margin: 6px 0; font-size: 13px; border: 1px solid #e8dcc8; }

  .mood-board { padding: 16px; margin: 8px 0; background: #faf7f0; border-radius: 8px; border: 1px solid #e8dcc8; }
  .mood-board h5 { font-family: 'DM Serif Display', Georgia, serif; color: #1c1a17; font-weight: 400; font-size: 15px; }
  .mb-desc { font-size: 13px; color: #9a9088; margin: 4px 0 8px; }
  .mb-place { font-size: 12px; color: #6b6560; margin: 4px 0; }

  .taste-tension { background: #faf7f0; padding: 16px; border-radius: 8px; margin: 12px 0; font-size: 13px; border: 1px solid #e8dcc8; }
  .resolved { color: #2a7a56; margin-top: 8px; }

  .context-rec { background: #faf7f0; padding: 12px; border-radius: 8px; margin: 6px 0; font-size: 13px; border: 1px solid #e8dcc8; }

  .muted { color: #9a9088; font-size: 13px; }
  details { margin: 8px 0; }
  summary { cursor: pointer; color: #9a9088; font-size: 13px; font-family: 'Space Mono', monospace; }
  pre { background: #f8f3ea; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 11px; color: #6b6560; max-height: 400px; overflow-y: auto; margin-top: 8px; border: 1px solid #e8dcc8; font-family: 'Space Mono', monospace; }

  @media (max-width: 768px) {
    .dashboard-header, .nav-strip, .personas-container { padding-left: 16px; padding-right: 16px; }
    .because-grid { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
  <div class="dashboard-header">
    <h1>Terrazzo · Persona Test Dashboard</h1>
    <p>Synthetic onboarding data → Profile Synthesis → Discover Feed Generation</p>
    <div class="stats-bar">
      <div class="stat"><strong>${results.length}</strong> personas</div>
      <div class="stat"><strong>${results.filter(r => r.profile).length}</strong> profiles synthesized</div>
      <div class="stat"><strong>${results.filter(r => r.feed).length}</strong> feeds generated</div>
      <div class="stat">Generated ${new Date().toISOString().split('T')[0]}</div>
    </div>
  </div>

  <div class="nav-strip">
    ${results.map((r, i) => `<button class="nav-btn${i===0?' active':''}" onclick="scrollToPersona(${i})">${r.persona.lifeContext.firstName}</button>`).join('')}
  </div>

  <div class="personas-container">
    ${personaCards}
  </div>

  <script>
    function showTab(btn, tabId) {
      const card = btn.closest('.persona-card');
      card.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      card.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    }

    function scrollToPersona(index) {
      document.querySelectorAll('.nav-btn').forEach((b, i) => b.classList.toggle('active', i === index));
      document.getElementById('persona-' + index).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Intersection observer for sticky nav highlighting
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const idx = Array.from(document.querySelectorAll('.persona-card')).indexOf(entry.target);
          document.querySelectorAll('.nav-btn').forEach((b, i) => b.classList.toggle('active', i === idx));
        }
      });
    }, { threshold: 0.3 });
    document.querySelectorAll('.persona-card').forEach(card => observer.observe(card));
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  let personas = PERSONAS.slice(0, personaLimit);
  if (onlyIds) {
    personas = PERSONAS.filter(p => onlyIds.includes(p.id));
    if (personas.length === 0) {
      console.error(`No personas matched IDs: ${onlyIds.join(', ')}`);
      console.log(`Available IDs: ${PERSONAS.map(p => p.id).join(', ')}`);
      process.exit(1);
    }
  }
  console.log(`\n🎭 Terrazzo Persona Test Harness`);
  console.log(`   Generating ${personas.length} persona(s)...`);
  console.log(`   Skip discover: ${skipDiscover}`);
  if (mergeMode) console.log(`   Merge mode: ON (will merge into existing results)`);
  console.log(`   Output: ${outputPath}\n`);

  const results = [];

  for (const persona of personas) {
    console.log(`\n── ${persona.label} (${persona.id}) ──`);

    // Step 1: Synthesize profile
    console.log(`  ⏳ Synthesizing profile...`);
    let profile = null;
    try {
      profile = await synthesizeProfile(persona);
      console.log(`  ✅ Profile: "${profile.overallArchetype}"`);
    } catch (err) {
      console.error(`  ❌ Profile failed: ${err.message}`);
    }

    // Step 2: Generate discover feed
    let feed = null;
    if (!skipDiscover && profile) {
      console.log(`  ⏳ Generating discover feed...`);
      try {
        feed = await generateDiscoverFeed(persona, profile);
        console.log(`  ✅ Feed generated (${feed.becauseYouCards?.length || 0} cards, deep match: ${feed.deepMatch?.name || 'none'})`);
      } catch (err) {
        console.error(`  ❌ Feed failed: ${err.message}`);
      }
    }

    results.push({ persona, profile, feed });
  }

  // Write outputs
  mkdirSync(outputPath, { recursive: true });

  // Merge with existing results if in merge mode
  let finalResults = results;
  const resultsPath = join(outputPath, 'results.json');
  if (mergeMode && existsSync(resultsPath)) {
    try {
      const existing = JSON.parse(readFileSync(resultsPath, 'utf8'));
      const newIds = new Set(results.map(r => r.persona.id));
      const kept = existing.filter(r => !newIds.has(r.persona.id));
      finalResults = [...kept, ...results].sort((a, b) => {
        const idxA = PERSONAS.findIndex(p => p.id === a.persona.id);
        const idxB = PERSONAS.findIndex(p => p.id === b.persona.id);
        return idxA - idxB;
      });
      console.log(`\n   Merged ${results.length} new + ${kept.length} existing = ${finalResults.length} total`);
    } catch { /* ignore, just overwrite */ }
  }

  // JSON data
  writeFileSync(resultsPath, JSON.stringify(finalResults, null, 2));
  console.log(`\n📄 Raw JSON: ${resultsPath}`);

  // HTML dashboard
  const html = generateDashboard(finalResults);
  writeFileSync(join(outputPath, 'dashboard.html'), html);
  console.log(`📊 Dashboard: ${join(outputPath, 'dashboard.html')}`);

  console.log(`\n✅ Done! ${results.filter(r => r.profile).length}/${personas.length} profiles, ${results.filter(r => r.feed).length}/${personas.length} feeds generated.\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
