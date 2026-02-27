/**
 * Import Pipeline Evaluation Test Suite
 * ──────────────────────────────────────
 * Real-world test cases covering the full spectrum of inputs Terrazzo users paste.
 * Each case includes the raw input, expected outputs, and scoring criteria.
 *
 * Run with: npx tsx src/lib/import-eval/run-eval.ts
 */

export interface ExpectedPlace {
  name: string;
  type: 'restaurant' | 'hotel' | 'museum' | 'activity' | 'bar' | 'cafe' | 'shop' | 'neighborhood';
  city?: string;                                // region/country match (fuzzy)
  mustHaveUserContext?: string;                  // substring that must appear in userContext
  mustHaveDescription?: string;                  // substring that must appear in description
  intentStatus?: 'booked' | 'planning' | 'dreaming' | 'researching';
  travelWith?: string;
}

export interface ExpectedEnrichment {
  name: string;                                 // fuzzy-matches to extracted place
  googlePlaceId?: string;                       // exact Google Place ID expected (optional)
  mustBeInCountry?: string;                     // geo fencing: Google address must contain this
  expectedConfidence?: 'high' | 'low';          // soft geo-fence flag expected
}

export interface TestCase {
  id: string;
  name: string;
  category: 'bucket-list' | 'city-guide' | 'article' | 'text-message' | 'mixed-format' | 'minimal' | 'edge-case' | 'url-live';
  description: string;
  input: string;
  sourceUrl?: string;                           // if set, fetches URL live (tests Firecrawl + extraction)
  isArticle?: boolean;                          // true = pass isArticleFromUrl=true to extractPlaces
  expectedRegion: string | null;                // expected region inference
  expectedPlaces: ExpectedPlace[];              // every place that MUST be extracted
  expectedEnrichment?: ExpectedEnrichment[];    // optional: test Google Places resolution + geo fencing
  antiPatterns: string[];                       // things that should NOT appear as place names
  qualityCriteria: {
    minPlaceCount: number;                       // must find at least this many
    personalContextRequired: boolean;            // must preserve user's personal notes
    deduplicationRequired: boolean;              // same place mentioned twice should merge
    typAccuracyThreshold: number;               // fraction of places with correct type (0-1)
  };
}

// ─── TEST CASE 1: Luxury Bucket List (messy, personal, global) ───────────────

const BUCKET_LIST: TestCase = {
  id: 'bucket-list-luxury',
  name: 'Luxury Travel Bucket List',
  category: 'bucket-list',
  description: 'Messy personal bucket list spanning 15+ countries with personal context, slashes, parentheticals, emoji, and mixed intent levels.',
  input: `-Soneva Secret/Kudadoo
-Amanzoe (hopefully go this fall along with the two new O&O)
-Tswalu (going in May)
-Golden Door (probs do the BF sale later this year)
-Nayara Hangaroa/ Easter Island
-North Island
-Swim with the humpback whales (Ningaloo reef in AUS or maybe a small yacht with friends in Tonga )
-Swim with Orcas in Norway
-Miavana
-Southern Ocean lodge now that it's open again
-Islas Secas (going this fall with my bestie to get scuba certified in memory of her dad)
-Gleneagles but with my daughter (5)
-Lindis in NZ
-Singita Kwitonda planned for my 40th
-Awasi Patagonia
-Raj Ampat chartered boat with friends
-White Desert ….even though I've done Antarctica and it's a $$$$ reach trip— maybe when my daughter graduates. I've got 13 years to save 😂
4 hotels I'm really excited to check out when they finally open:
-Rosewood Mandarina
-FS Cartagena
-Chable Sea of Cortez
-O&O Moonlight Basin
BYAKU Narai
Asaba
Beniya Mukayu ryokan
Tawaraya Ryokan
Hoshoinoya Kyoto
The Shinmonzen`,
  expectedRegion: null, // global list, no single region
  expectedPlaces: [
    { name: 'Soneva Secret', type: 'hotel', city: 'Maldives' },
    { name: 'Kudadoo', type: 'hotel', city: 'Maldives' },
    { name: 'Amanzoe', type: 'hotel', city: 'Greece', intentStatus: 'planning', mustHaveUserContext: 'this fall' },
    { name: 'Tswalu', type: 'hotel', city: 'South Africa', intentStatus: 'planning', mustHaveUserContext: 'going in May' },
    { name: 'Golden Door', type: 'hotel', mustHaveUserContext: 'BF sale' },
    { name: 'Nayara Hangaroa', type: 'hotel', city: 'Easter Island' },
    { name: 'North Island', type: 'hotel', city: 'Seychelles' },
    { name: 'Swim with humpback whales', type: 'activity', mustHaveUserContext: 'Ningaloo' },
    { name: 'Swim with Orcas', type: 'activity', city: 'Norway' },
    { name: 'Miavana', type: 'hotel', city: 'Madagascar' },
    { name: 'Southern Ocean Lodge', type: 'hotel', city: 'Australia' },
    { name: 'Islas Secas', type: 'hotel', intentStatus: 'planning', mustHaveUserContext: 'memory of her dad', travelWith: 'bestie' },
    { name: 'Gleneagles', type: 'hotel', city: 'Scotland', travelWith: 'daughter' },
    { name: 'Lindis', type: 'hotel', city: 'New Zealand' },
    { name: 'Singita Kwitonda', type: 'hotel', city: 'Rwanda', mustHaveUserContext: '40th' },
    { name: 'Awasi Patagonia', type: 'hotel', city: 'Chile' },
    { name: 'White Desert', type: 'activity', intentStatus: 'dreaming', mustHaveUserContext: 'daughter graduates' },
    { name: 'Rosewood Mandarina', type: 'hotel', intentStatus: 'researching' },
    { name: 'Four Seasons Cartagena', type: 'hotel', intentStatus: 'researching' },
    { name: 'Chablé Sea of Cortez', type: 'hotel', intentStatus: 'researching' },
    { name: 'One&Only Moonlight Basin', type: 'hotel', intentStatus: 'researching' },
    { name: 'BYAKU Narai', type: 'hotel', city: 'Japan' },
    { name: 'Asaba', type: 'hotel', city: 'Japan' },
    { name: 'Beniya Mukayu', type: 'hotel', city: 'Japan' },
    { name: 'Tawaraya', type: 'hotel', city: 'Kyoto' },
    { name: 'Hoshinoya Kyoto', type: 'hotel', city: 'Kyoto' },
    { name: 'The Shinmonzen', type: 'hotel', city: 'Kyoto' },
  ],
  antiPatterns: ['Easter Island', 'Raja Ampat', 'Antarctica', 'Tonga', 'Norway'], // places as locations, not venues
  qualityCriteria: {
    minPlaceCount: 25,
    personalContextRequired: true,
    deduplicationRequired: false,
    typAccuracyThreshold: 0.85,
  },
};

// ─── TEST CASE 2: City Guide (structured, personal, single destination) ──────

const CITY_GUIDE: TestCase = {
  id: 'jose-ignacio-guide',
  name: 'José Ignacio Personal City Guide',
  category: 'city-guide',
  description: 'Richly personal city guide with sections, personal anecdotes, slang, and local knowledge. Single destination with day trips.',
  input: `WHERE TO STAY
__Bahía Vik__ Iconic, designy fancy hotel right on the beach. Steps from my sister's yoga studio.
__Playa Vik__ Right in town. Also beautiful.
__Estancia Vik__ Outrageously beautiful countryside estate. Look it up. Hard to believe. Worth a visit for horseback riding and dinner even if you don't stay there. I made out with a gaucho on a horse there once.
__Rentals__
* LOCATION Jose Ignacio (hello@location.uy)
* Aispurú Bienes Raíces (info@aispuru.com)
* Victoria Fones Real Estate (info@victoriafones.com)
FOOD
__La Huella__ Iconic. My favorite restaurant in the world. On the beach. Day and night, long lunches, late dinners, grilled fish, caipirinhas, barefoot, hot bartenders.
__Mirador Santa Teresita__ Best lunch. Build-your-own plate; truly incredible, ultra-fresh, different every day. Great coffee. Also good for dinner
__Rizoma__ Great coffee shop / bookstore. Very cute. Really good coffee, eggs, lunch, etc. Sometimes fun evening things going on.
__Juana__ Relaxed, beautiful, tucked away, outdoors. Great for dinner. Bring a sweater.
__La Susana__ All day, stylish, on the beach, ceviche, cocktails, reliable for lunch or dinner. Can be a little sceney.
__La Olada__ Also perfect. More refined seafood spot; intimate and elegant.
__Marismo__ Romantic, delicious wood-fire cooking in a beautiful rural setting.
__Narbona__ Like 30 mins away. The holy grail of dulce de leche. Very stylish, beautiful restaurant overlooking vines. Incredible pastries. Go for a long sexy lunch and then buy everything in the shop to stuff in your suitcase and bring home. As many jars of dulce as you can fit!
DAY TRIPS
__Garzón__ Tiny, cinematic inland village; perfect for a slow lunch and wander. Home to Francis Mallman's eponymous restaurant. Very pricy but worth it.
__Bodega Garzón__ Enormous winery with good wine, tastings and long lunches overlooking vineyards.
__Estancia Vik__ Out of this world. Like traveling back in time. Ride horses through the plans. Go to a gaucho race. Drink wine. Eat meat. Feel like a king.
__Cabo Polonio__
PUNTA DEL ESTE
__Picniquería__ My brother-in-law's great lunch spot. Casual. Great food, great coffee, great pastries.
__Boulevard de las Palmeras__ My brother-in-law's new hot restaurant. Never been. Looks gorg.
THINGS TO DO
__Skyspace Ta Khut__ James Turrell light show. Incredible. Not to be missed. Reserve in advance.
__MACA__ New modern art museum! The grounds are beautiful.
__The Shack Yoga__ Obviously!!!! Amazing classes, amazing treatments, amazing gym, right on the water. Hottest coolest best owner.
BARS
La Huella and Ferona for dancing. Go nearby to Manantiales or La Barra for real raves.`,
  expectedRegion: 'José Ignacio, Uruguay',
  expectedPlaces: [
    { name: 'Bahía Vik', type: 'hotel', city: 'José Ignacio', mustHaveUserContext: "sister's yoga studio" },
    { name: 'Playa Vik', type: 'hotel', city: 'José Ignacio' },
    { name: 'Estancia Vik', type: 'hotel', city: 'José Ignacio', mustHaveUserContext: 'gaucho' },
    { name: 'La Huella', type: 'restaurant', city: 'José Ignacio', mustHaveDescription: 'favorite restaurant' },
    { name: 'Mirador Santa Teresita', type: 'restaurant', city: 'José Ignacio' },
    { name: 'Rizoma', type: 'cafe', city: 'José Ignacio' },
    { name: 'Juana', type: 'restaurant', city: 'José Ignacio' },
    { name: 'La Susana', type: 'restaurant', city: 'José Ignacio' },
    { name: 'La Olada', type: 'restaurant', city: 'José Ignacio' },
    { name: 'Marismo', type: 'restaurant', city: 'José Ignacio' },
    { name: 'Narbona', type: 'restaurant', mustHaveDescription: 'dulce de leche' },
    { name: 'Garzón', type: 'neighborhood', city: 'Uruguay', mustHaveDescription: 'Mallman' },
    { name: 'Bodega Garzón', type: 'activity', city: 'Uruguay' },
    { name: 'Cabo Polonio', type: 'neighborhood', city: 'Uruguay' },
    { name: 'Picniquería', type: 'restaurant', city: 'Punta del Este', mustHaveUserContext: 'brother-in-law' },
    { name: 'Boulevard de las Palmeras', type: 'restaurant', city: 'Punta del Este', intentStatus: 'researching' },
    { name: 'Skyspace Ta Khut', type: 'activity', mustHaveDescription: 'Turrell' },
    { name: 'MACA', type: 'museum' },
    { name: 'The Shack Yoga', type: 'activity', mustHaveUserContext: 'Obviously' },
    { name: 'Ferona', type: 'bar', city: 'José Ignacio' },
    { name: 'Manantiales', type: 'neighborhood' },
    { name: 'La Barra', type: 'neighborhood' },
  ],
  antiPatterns: ['LOCATION Jose Ignacio', 'Aispurú', 'Victoria Fones', 'Rentals'], // rental agencies aren't places
  qualityCriteria: {
    minPlaceCount: 20,
    personalContextRequired: true,
    deduplicationRequired: true, // Estancia Vik mentioned twice
    typAccuracyThreshold: 0.80,
  },
};

// ─── TEST CASE 3: Text Message from a Friend ────────────────────────────────

const TEXT_MESSAGE: TestCase = {
  id: 'friend-text-tokyo',
  name: 'Friend\'s Text Message — Tokyo Recs',
  category: 'text-message',
  description: 'Casual, messy text message format with abbreviations, emoji, run-on sentences, and zero formatting.',
  input: `ok so for tokyo here's my list lol

def go to Daimon for yakitori it's in shibuya and it's INSANE like life changing chicken. also Afuri ramen near roppongi is amazing esp the yuzu shio. for sushi splurge at Sukiyabashi Jiro (yes the one from the movie, book months ahead!!!) or if u cant get in try Sushi Saito which is almost as good tbh.

for coffee go to Fuglen in tomigaya its a norwegian coffee bar that turns into a cocktail bar at night lol very tokyo. also Onibus in nakameguro is chef's kiss ☕️ Bear Pond too if you're in shimokitazawa

shopping: go to Kapital in ebisu (denim heaven), Beams in harajuku obviously, and Dover Street Market ginza for the vibes. also the basement food halls at isetan in shinjuku are UNREAL like better than any restaurant

neighborhoods to wander: shimokitazawa (vintage + cafes), yanaka (old tokyo vibes, temples, cats), daikanyama (tsutuya bookstore is gorgeous), and obviously shibuya/harajuku but u know that

oh and DO the teamLab borderless thing it just reopened in azabudai everyone says its way better than the old one. and meiji shrine early morning before the crowds`,
  expectedRegion: 'Tokyo, Japan',
  expectedPlaces: [
    { name: 'Daimon', type: 'restaurant', city: 'Shibuya', mustHaveDescription: 'yakitori' },
    { name: 'Afuri', type: 'restaurant', city: 'Roppongi', mustHaveDescription: 'yuzu' },
    { name: 'Sukiyabashi Jiro', type: 'restaurant', mustHaveUserContext: 'book months ahead' },
    { name: 'Sushi Saito', type: 'restaurant' },
    { name: 'Fuglen', type: 'cafe', city: 'Tomigaya', mustHaveDescription: 'cocktail bar at night' },
    { name: 'Onibus Coffee', type: 'cafe', city: 'Nakameguro' },
    { name: 'Bear Pond Espresso', type: 'cafe', city: 'Shimokitazawa' },
    { name: 'Kapital', type: 'shop', city: 'Ebisu', mustHaveDescription: 'denim' },
    { name: 'Beams', type: 'shop', city: 'Harajuku' },
    { name: 'Dover Street Market', type: 'shop', city: 'Ginza' },
    { name: 'Isetan', type: 'shop', city: 'Shinjuku', mustHaveDescription: 'food hall' },
    { name: 'Shimokitazawa', type: 'neighborhood' },
    { name: 'Yanaka', type: 'neighborhood', mustHaveDescription: 'temples' },
    { name: 'Daikanyama', type: 'neighborhood', mustHaveDescription: 'Tsutaya' },
    { name: 'teamLab Borderless', type: 'activity', mustHaveDescription: 'reopened' },
    { name: 'Meiji Shrine', type: 'museum', mustHaveDescription: 'early morning' },
  ],
  antiPatterns: ['Shibuya', 'Harajuku', 'Roppongi', 'Ginza'], // these are location context, not standalone entries
  qualityCriteria: {
    minPlaceCount: 14,
    personalContextRequired: false, // friend's rec, no personal user context
    deduplicationRequired: false,
    typAccuracyThreshold: 0.80,
  },
};

// ─── TEST CASE 4: Minimal Input ─────────────────────────────────────────────

const MINIMAL: TestCase = {
  id: 'minimal-comma-list',
  name: 'Minimal Comma-Separated List',
  category: 'minimal',
  description: 'Bare minimum input: just place names with no context, formatting, or location hints.',
  input: `Noma, Geranium, Alchemist, Kadeau, 108, Amass, Barr, Sanchez`,
  expectedRegion: 'Copenhagen, Denmark',
  expectedPlaces: [
    { name: 'Noma', type: 'restaurant', city: 'Copenhagen' },
    { name: 'Geranium', type: 'restaurant', city: 'Copenhagen' },
    { name: 'Alchemist', type: 'restaurant', city: 'Copenhagen' },
    { name: 'Kadeau', type: 'restaurant', city: 'Copenhagen' },
    { name: '108', type: 'restaurant', city: 'Copenhagen' },
    { name: 'Amass', type: 'restaurant', city: 'Copenhagen' },
    { name: 'Barr', type: 'restaurant', city: 'Copenhagen' },
    { name: 'Sanchez', type: 'restaurant', city: 'Copenhagen' },
  ],
  antiPatterns: [],
  qualityCriteria: {
    minPlaceCount: 8,
    personalContextRequired: false,
    deduplicationRequired: false,
    typAccuracyThreshold: 0.9,
  },
};

// ─── TEST CASE 5: Mixed Format with Hotel/Restaurant Ambiguity ───────────────

const MIXED_AMBIGUOUS: TestCase = {
  id: 'mixed-marrakech',
  name: 'Marrakech Guide — Mixed Recs with Ambiguity',
  category: 'mixed-format',
  description: 'Tests handling of venues that are both hotels AND restaurants, riads, hammams, and souks.',
  input: `Marrakech faves:

STAY: La Mamounia (the garden bar at sunset is reason enough), Royal Mansour (best riad-hotel in the world, eat at Le Jardin too), El Fenn (book the roof terrace for dinner, incredible at night)

EAT: Nomad (rooftop, great for lunch, the cauliflower is famous), Le Jardin (inside the medina, green oasis, great salads), Café des Épices (people watching on the square, mint tea), Al Fassia (all-female kitchen, traditional Moroccan done right), NARANJ (new, lebanese-moroccan fusion, gorgeous space)

DO: Jardin Majorelle (Yves Saint Laurent's garden, go early), Musée Yves Saint Laurent, the souks obviously but go with a guide your first time, Heritage Spa (best hammam experience I've had), Jemaa el-Fnaa at night (the food stalls, the chaos, the snake charmers)

DAY TRIP: Kasbah Tamadot (Richard Branson's place in the Atlas Mountains, can do lunch without staying)`,
  expectedRegion: 'Marrakech, Morocco',
  expectedPlaces: [
    { name: 'La Mamounia', type: 'hotel', mustHaveDescription: 'garden bar' },
    { name: 'Royal Mansour', type: 'hotel', mustHaveDescription: 'riad' },
    { name: 'El Fenn', type: 'hotel', mustHaveDescription: 'roof terrace' },
    { name: 'Nomad', type: 'restaurant', mustHaveDescription: 'cauliflower' },
    { name: 'Le Jardin', type: 'restaurant', mustHaveDescription: 'medina' },
    { name: 'Café des Épices', type: 'cafe', mustHaveDescription: 'mint tea' },
    { name: 'Al Fassia', type: 'restaurant', mustHaveDescription: 'all-female' },
    { name: 'NARANJ', type: 'restaurant', mustHaveDescription: 'fusion' },
    { name: 'Jardin Majorelle', type: 'museum', mustHaveDescription: 'Saint Laurent' },
    { name: 'Musée Yves Saint Laurent', type: 'museum' },
    { name: 'Heritage Spa', type: 'activity', mustHaveDescription: 'hammam' },
    { name: 'Jemaa el-Fnaa', type: 'neighborhood', mustHaveDescription: 'food stalls' },
    { name: 'Kasbah Tamadot', type: 'hotel', mustHaveDescription: 'Branson' },
  ],
  antiPatterns: ['the souks', 'Atlas Mountains'],
  qualityCriteria: {
    minPlaceCount: 12,
    personalContextRequired: false,
    deduplicationRequired: false,
    typAccuracyThreshold: 0.80,
  },
};

// ─── TEST CASE 6: Edge Case — Numbered List with Ratings ────────────────────

const NUMBERED_WITH_RATINGS: TestCase = {
  id: 'numbered-lisbon',
  name: 'Lisbon — Numbered List with Personal Ratings',
  category: 'edge-case',
  description: 'Tests extraction of numbered lists with star ratings, parenthetical notes, and revisit markers.',
  input: `My Lisbon rankings after 4 trips:

1. Belcanto ★★★★★ - José Avillez is a genius. Order the garden of the goose. Book way ahead.
2. A Cevicheria ★★★★ - That giant octopus hanging from the ceiling! Fun vibe, great pisco sours
3. Time Out Market ★★★ - Touristy but honestly still great. Go to Henrique Sá Pessoa's stall
4. Pastéis de Belém ★★★★★ - The ONLY place for pastéis de nata. Not the other tourist traps. Get there at 8am
5. Cervejaria Ramiro ★★★★★ - Seafood. Tiger prawns. Steak sandwich to finish. Trust me on this one.
6. Pensão Amor ★★★★ - Bar in a former brothel lol. Great cocktails, burlesque shows sometimes
7. LX Factory ★★★ - converted warehouse area, cool shops and restaurants. Ler Devagar bookstore is stunning
8. Feira da Ladra (flea market, Tuesdays and Saturdays only!) ★★★★
9. Manteigaria ★★★★ - Actually these might be better than Belém don't @ me
10. Café A Brasileira ★★★ - Pessoa's café, worth one visit for the history

Hotels: stay at Memmo Alfama (best views I've ever seen from a hotel pool) or Verride Palácio (if you want to splurge, the terrace bar alone is worth it)

SKIP: Hard Rock Cafe (obviously), Park bar (overrated view), Tram 28 (tourist hellscape)`,
  expectedRegion: 'Lisbon, Portugal',
  expectedPlaces: [
    { name: 'Belcanto', type: 'restaurant', mustHaveDescription: 'Avillez' },
    { name: 'A Cevicheria', type: 'restaurant', mustHaveDescription: 'octopus' },
    { name: 'Time Out Market', type: 'restaurant' },
    { name: 'Pastéis de Belém', type: 'cafe', mustHaveDescription: 'pastéis de nata' },
    { name: 'Cervejaria Ramiro', type: 'restaurant', mustHaveDescription: 'tiger prawns' },
    { name: 'Pensão Amor', type: 'bar', mustHaveDescription: 'brothel' },
    { name: 'LX Factory', type: 'neighborhood', mustHaveDescription: 'Ler Devagar' },
    { name: 'Feira da Ladra', type: 'activity', mustHaveDescription: 'flea market' },
    { name: 'Manteigaria', type: 'cafe' },
    { name: 'Café A Brasileira', type: 'cafe', mustHaveDescription: 'Pessoa' },
    { name: 'Memmo Alfama', type: 'hotel', mustHaveDescription: 'pool' },
    { name: 'Verride Palácio', type: 'hotel', mustHaveDescription: 'terrace bar' },
  ],
  antiPatterns: ['Hard Rock Cafe', 'Park bar', 'Tram 28'], // SKIP section
  qualityCriteria: {
    minPlaceCount: 12,
    personalContextRequired: false,
    deduplicationRequired: false,
    typAccuracyThreshold: 0.80,
  },
};

// ─── TEST CASE 7: Edge Case — Duplicate Mentions ────────────────────────────

const DUPLICATES: TestCase = {
  id: 'duplicates-paris',
  name: 'Paris — Same Places Mentioned Multiple Times',
  category: 'edge-case',
  description: 'Tests deduplication when same place appears in multiple sections or contexts.',
  input: `PARIS FOOD

Le Comptoir is where we always go first night. Classic bistro, no reservations at dinner, get there early.

Le Grand Véfour for a special occasion. One of the most beautiful restaurants in the world. Napoleon ate here.

Clown Bar for natural wine and amazing small plates. Near Cirque d'Hiver. Always packed.

Coffee: Coutume (best flat white in Paris), Boot Café (tiniest café ever, SO good), Fragments

For dinner we also love Le Comptoir — I mentioned it for first night but honestly we usually end up going back 2-3 more times every trip. It's that good. The tête de veau if you're brave.

Don't forget Clown Bar for lunch too — different menu than dinner and the wine list is even better at lunch weirdly.`,
  expectedRegion: 'Paris, France',
  expectedPlaces: [
    { name: 'Le Comptoir', type: 'restaurant' },
    { name: 'Le Grand Véfour', type: 'restaurant', mustHaveDescription: 'Napoleon' },
    { name: 'Clown Bar', type: 'bar' },
    { name: 'Coutume', type: 'cafe', mustHaveDescription: 'flat white' },
    { name: 'Boot Café', type: 'cafe' },
    { name: 'Fragments', type: 'cafe' },
  ],
  antiPatterns: ['Cirque d\'Hiver'],
  qualityCriteria: {
    minPlaceCount: 6,
    personalContextRequired: false,
    deduplicationRequired: true, // Le Comptoir and Clown Bar each mentioned twice
    typAccuracyThreshold: 0.85,
  },
};

// ─── TEST CASE 8: Article — Editorial Hotel Guide (no personal context) ─────

const ARTICLE_TURKEY_HOTELS: TestCase = {
  id: 'article-turkey-hotels',
  name: 'CN Traveler — Best Hotels in Turkey (Article)',
  category: 'article',
  isArticle: true,
  description: 'Real CN Traveler article (HTML-stripped). Tests article extraction: editorial voice, no personal context, 17 hotels across Istanbul/Bodrum/Cappadocia/Antalya/Fethiye/Datça/Alaçati.',
  input: `The best hotels in Türkiye are as wildly diverse as the country itself—from chic coastal boltholes with views of the turquoise sea at every turn; to grand Ottoman palaces, revamped to new levels of luxury; to wellness resorts which harness ancient rituals switched up with cutting-edge spa technology; to places to party or to reset in serene, unspoiled surroundings, a world away from the quotidian concerns of the real world. Everywhere, food is a joyous affair—everyone comes home raving about it—and Turkish hospitality is always wide-armed and warm.

Maxx Royal Kemer, Antalya
Maxx Royal Kemer feels like a family-run boutique guesthouse rather than the colossal resort it is. This is largely due to the attentiveness of the staff and the warm smiles that greet guests at every turn. There's ample room for everyone to breathe, and rooms are more akin to sprawling villas. Premium rooms are paired with access to cabanas on the long beach and sleek chill-out areas facing the sparkling Mediterranean. Suppertime is when the resort comes alive. Dancers and DJs take to the stage while dressed-up diners choose from a range of restaurants.

Yazz Collective
Despite its compact size, Yazz Collective is, in many ways, a resort of two halves. Arriving by boat brings the sandy shore into focus, a polished beach club nestled between foresty rock formations that rise dramatically out of the azure Mediterranean. Here lie the 16 rooms, or 'guest houses,' futuristic glass hideouts. Istanbul-based architecture agency FAAR Concept oversaw the design and stuck to the winning boho formula, so expect crashpads fitted with cozy rugs, outdoor showers, and bathroom doors made of bamboo.

The Peninsula Istanbul
Life in this city revolves around the Bosphorus, so naturally, the hotel scene does, too. Already, the Peninsula in the three-year-old mixed-use Galataport cruise terminal has become one of Istanbul's hot spots, thanks to the rooftop restaurant Gallada, overseen by Fatih Tutak—Türkiye's only chef with two Michelin stars. Architect Zeynep Fadıllıoğlu has transformed four adjoining buildings into a sleek mash-up of past and present. Each of the 177 rooms is filled with the usual hallmarks and comforts of a Peninsula. The spa reaches its pinnacle with a purpose-built hammam—a shimmering, marble-lined space to rival the most established baths in the city.

Maxx Royal Bodrum
This isn't Maxx Royal's first rodeo. This new address takes all its lauded elements and packages them into a bed-and-breakfast hideaway with an extravagant, all-inclusive feel. Among the eight restaurants and six bars on offer, Spago by Wolfgang Puck is the clear winner. Another highlight is the 61,892 square-foot Maxx WellBeing Center. Guests also benefit from access to Scorpios Bodrum, the first Turkish outpost of the notorious beach club.

BIJAL, Antalya Province
Maldivian-style villas, three fine-dining restaurants, a pristine golden beach, and personal touches create a feeling of exclusivity that sets BIJAL far apart from the typical Turkish resort. Opening in March 2024, this hotly anticipated address comes courtesy of Gürock, the group behind JOALI Maldives. There are just 19 villas on the property, all with floor-to-ceiling windows, lush walled gardens, Balinese-style private pools, and a personal butler.

Scorpios Bodrum
That Bodrum is the location of Scorpios' second outing speaks volumes. The arrival of Scorpios, the chic beach club from Mykonos, suggests this slice of Türkiye's Turquoise Coast is finally claiming its moment. 12 bungalows sit atop the complex in a circular formation with private infinity pools looking out onto the Aegean Sea. The main restaurant comes alive as the sun sets on another balmy Bodrum evening.

Amanruya, Bodrum
Amanruya's clay-pink pavilions dot the hills of Bodrum's north coastline, shaded by cypress trees and blessed with a gem-like view of the Aegean Sea. Each has a secluded garden with a private pool; interiors are airy, with marble finishes and sweeping concrete and terrazzo arches. The restaurant options vary, from the Beach Club and Sushi by Amanruya to the Anatolian and Poolside dining pavilions. This retreat's pared-back luxury allows guests to unwind, creating a stay synonymous with Amanruya's name, a 'peaceful dream.'

Soho House Istanbul
In bohemian Beyoğlu, Soho House Istanbul is an artful makeover of an Italianate 19th-century palace. It was formerly the US Embassy, whose legacy survives in the late-night Embassy Club. Deep-hued velvets and mid-century-modern furniture sit amid wood-paneled walls and tobacco-colored marble. A plant-filled rooftop restaurant serves up mezze bringing breezy Aegean flavors to a dynamic crowd of locals and international visitors.

Argos in Cappadocia
There are plenty of hotels in otherworldly Cappadocia, but for a secluded getaway perched along the perimeter of Göreme National Park, bed down at serene Argos in Cappadocia. Cut into the cliffside overlooking the fairy chimneys and volcanic dovecotes of Pigeon Valley. Within its storied, stone-cut walls, you'll find a former monastery and a network of underground tunnels. Wake up to view the sunrise, when hundreds of hot air balloons dance across the sky. Head down into the hotel's wine cellars (home to 30,000 different bottles).

Six Senses Kaplankaya
Kaplankaya is not just a hotel but an entire five-star coastal town created by barefoot millionaire Burak Oymen. Six Senses is the resort's first hotel, a wellness resort which feels more Frank Lloyd Wright than the Turkish coast. The beautiful spa is a vast nearly 2.5 acres; programs range from serious (there's a medical wing) to experimental (a watsu pool) and traditional (hammams). It's hard to beat Anhinga, the fine-dining beach club serving cocktails and exquisitely cooked seafood beneath a seagrass canopy.

Hillside Beach Club, Fethiye
Spread over a tamed slice of steep, pine-forested coast, Hillside Beach Club is one of the best hotels for a family-friendly escape, set in its own private cove, Kalemya Bay. There's a pool, two spas, three beaches, half a dozen restaurants and bars. The biggest draw is the innovative program of goings-on for kids and adults, such as BFI screenings, drumming workshops, live music on a floating stage, scuba diving and sailing lessons.

D Maris Bay, Datça
Now a decade old, D Maris Bay is one of the best resorts not just in Türkiye, but in all the Mediterranean, a hideaway sequestered between sea and forest on the Datça Peninsula. Wellness is the focus here—walking, waterskiing, rub-downs in the Mytha Spa hammam. Mornings are for sunrise yoga on Silence Beach (phone-free, child-free, beat-free), and afternoons are for lobster-and-Champagne lunches at La Guérite beach club.

Macakizi, Bodrum
When Mick and Bianca Jagger came to Bodrum in the 1970s, they stayed at Macakizi. Though the spirit lives on, the hotel has blossomed into something more accomplished. The setting is low-key but beautiful: 64 rooms, unobtrusive casitas tumbling down the hillside to the sea. By evening the terraces of the restaurants and bar thrum with a vibrant, all-ages crowd and unbelievably fresh seafood.

Alavya, Alacati
Alavya is an utterly adorable stay—even the name came from the owner's daughter when she first learned to say "I love you." Created out of six houses, the hotel feels like a dreamy home from home: patchwork rugs, antique furniture, a mix of old and contemporary art. At its heart, a garden with a parasol-shaded pool. 25 rooms, some with shuttered French windows opening onto wrought iron balconies.

Museum Hotel, Cappadocia
There's a fantasy-world feel to Cappadocia, with its Tolkien-esque fairy chimneys and desert rock formations. The Museum Hotel is perhaps the chicest of them all while retaining a sense of enchantment and history thanks to the owner's collection of antiques and artifacts. Some rooms are housed in the fairy chimneys themselves; the outdoor pool and terrace overlook the stunning landscapes. Views are particularly spectacular at sunset and sunrise, as hundreds of hot air balloons float across the scene.

D-Resort Göcek
The sleepy coves, calm waters, and unspoiled coast of the Datça Peninsula offer nautical loveliness. On the edge of the cute fishing village of Göcek, the resort is the sister of D Maris Bay, a glamorous playground for those who come to mess about on boats—or come ashore from superyachts moored in the resort's own marina. A spa with a hammam, tennis courts, three restaurants, and a beach of fine white sand.

Pera Palace Hotel
Istanbul's Belle Epoque Pera Palace—built beside the Golden Horn as the gilded final destination for travelers on the Orient-Express from Paris—remains as steadfast and stately as a dame. Red velvet and checkerboard marble, evocative Jazz Age glamor, and the history of illustrious guests: old Hollywood, royalty, literary greats—most famously Agatha Christie, who wrote Murder on the Orient Express in Room 411.`,
  expectedRegion: 'Turkey',
  expectedPlaces: [
    { name: 'Maxx Royal Kemer', type: 'hotel', city: 'Antalya', mustHaveDescription: 'Mediterranean' },
    { name: 'Yazz Collective', type: 'hotel', mustHaveDescription: 'boho' },
    { name: 'The Peninsula Istanbul', type: 'hotel', city: 'Istanbul', mustHaveDescription: 'Galataport' },
    { name: 'Maxx Royal Bodrum', type: 'hotel', city: 'Bodrum', mustHaveDescription: 'Wolfgang Puck' },
    { name: 'BIJAL', type: 'hotel', city: 'Antalya', mustHaveDescription: 'villa' },
    { name: 'Scorpios Bodrum', type: 'hotel', city: 'Bodrum', mustHaveDescription: 'bungalow' },
    { name: 'Amanruya', type: 'hotel', city: 'Bodrum', mustHaveDescription: 'Aegean' },
    { name: 'Soho House Istanbul', type: 'hotel', city: 'Istanbul', mustHaveDescription: 'palazzo' },
    { name: 'Argos in Cappadocia', type: 'hotel', city: 'Cappadocia', mustHaveDescription: 'wine' },
    { name: 'Six Senses Kaplankaya', type: 'hotel', mustHaveDescription: 'wellness' },
    { name: 'Hillside Beach Club', type: 'hotel', city: 'Fethiye', mustHaveDescription: 'family' },
    { name: 'D Maris Bay', type: 'hotel', city: 'Datça', mustHaveDescription: 'wellness' },
    { name: 'Macakizi', type: 'hotel', city: 'Bodrum', mustHaveDescription: 'Jagger' },
    { name: 'Alavya', type: 'hotel', city: 'Alacati' },
    { name: 'Museum Hotel', type: 'hotel', city: 'Cappadocia', mustHaveDescription: 'cave' },
    { name: 'D-Resort Göcek', type: 'hotel', city: 'Göcek', mustHaveDescription: 'marina' },
    { name: 'Pera Palace Hotel', type: 'hotel', city: 'Istanbul', mustHaveDescription: 'Orient-Express' },
  ],
  antiPatterns: ['Fatih Tutak', 'FAAR Concept', 'Burak Oymen', 'Gürock', 'JOALI', 'Mick Jagger', 'Bianca Jagger', 'Kate Moss', 'Naomi Campbell', 'Agatha Christie', 'Wolfgang Puck', 'Göreme National Park', 'Pigeon Valley', 'Kalemya Bay', 'Mykonos', 'Maldives'],
  qualityCriteria: {
    minPlaceCount: 15,
    personalContextRequired: false,
    deduplicationRequired: false,
    typAccuracyThreshold: 0.95, // all hotels, should be easy to type correctly
  },
};

// ─── TEST CASE 9: Massive Multi-Contributor City Guide (stress test) ────────

const PARIS_BLACK_BOOK: TestCase = {
  id: 'paris-black-book',
  name: 'Yolo Journal — Giant Paris Black Book (Stress Test)',
  category: 'article',
  isArticle: true,
  description: 'Massive 170K-char multi-contributor Paris guide with 135+ places in first 25K alone. Tests: extraction at 30-place limit, deduplication (Chez Georges 3x, Le Voltaire 5x, Oobatz 3x, Bistrot Paul Bert 2x), contributor name filtering, type accuracy across restaurants/bars/cafes, and prioritization when overwhelmed.',
  input: `EAT + DRINK
Restaurants on repeat
Le Rubis; Oobatz
Chez Allard is the epitome of classic French cuisine and remains my go-to spot when in Paris. It's the kind of place I always crave for a traditional French meal. The pâté en croûte is a must-try, paired perfectly with a glass of champagne. Don't miss the canard aux olives (olive duck)—it's a signature dish that always hits the spot. And for dessert, their savarin au rhum is simply divine, rounding off the meal in the most indulgent way possible. –Mimi Thorisson. Allard is always a favorite—I love the decor, the food, and its giant tower of butter. —Yolanda Edwards

I never get tired of Juveniles, a small, family-run bistro in the 1st, near the Louvre. The food is unpretentious and comforting, while still remaining fresh and creative. The dining room is comprised of a few simple tables, surrounded by crates of wine, where you always feel at home. —Alexandra Weinress

Le Rubis –we love it for lunch. It's an easy, local feeling spot in the 1st that we've always managed to just walk into. Bistrot Paul Bert for the best steak frites! —Yolanda Edwards. If I had to choose my last meal on earth it would be at Paul Bert. Yes, you will 99% surely be sitting next to Americans. However, their always changing and seasonal entrees, followed by my favorite steak au poivre in all the land served alongside deep golden brown french fries (that you must dip often in your au poivre sauce) and ending with a grand marnier souffle is a meal I dream about. —Elizabeth Colling

Soces in Belleville is such a delight: exceptional food and natural wine in a casual, friendly setting. It's right by another new favorite, the award-winning Franco-Chinese spot Le Cheval d'Or, which I can't wait to go back to. My 12-year-old son ranked it the best of the trip! —Christine Muhlke

Racines—Italian on repeat. And Vingt-et-un on Rue Mazarine – a cozy seafood restaurant (you have to have the carpaccio on garlic toast). —Sofia Coppola

Chez Georges on Rue du Mail is a repeat restaurant for me. The comfort of knowing the menu, knowing every corner, and being really welcomed… plus the celeri remoulade, the terrine and the frisée aux lardons epitomize Paris for me. —Maria Lemos. Chez Georges – It's where you find the locals and low key "to be seen" —Diego Delgado-Elias. Chez Georges, of course! —Yolanda Edwards

I love La Bourse et La Vie with Chef Daniel Rose. The BEST steak au poivre and frites in Paris. —Elliott Barnes

Nodaiwa for the best Japanese unagi bento boxes and the chicest interior. —Clara Hranek

Restaurant Cuisine – A marriage of French and Asian influences—creative, surprising, exciting. —Josh Hickey

Le Maquis – a perfect classic small bistrot with a great mix of classic and modern food. —Franck Audoux

When we have friends in town, I like to secure reservations at a few favorites: Bistrot des Tournelles, Chez Georges, Mokonuts, Bistrot Paul Bert, Oobatz (for outstanding pizza), Le Cheval d'Or, and Early June (the chefs are always rotating, the wine list is great). I also like to plan a stop by Sur Mer for oysters and a glass of wine. —Rebekah Peppler

Le Voltaire – A meal here is something special – this jewel-box brasserie is classic Paris in the best way possible and attracts the crème de la crème of society, fashion, celebrities, intellectuals. —Tony Conrad. Le Voltaire, Brasserie Lipp, and La Coupole are the ones that I do on repeat. La Petite Chaise and L'ami Louis are also classic favorites. —Sophia Achaval. Le Voltaire, quai Voltaire or La Société in spring and summer for the terrace —Pierre Maheo

My two new favorite restaurants are the French bistrot Pantruche, and Shinjuku Pigalle is a good Japanese Izakaya on Rue Condorcet in the 9th. Rose Bakery is still an amazing place for breakfast, lunch and takeaways. —Victoire de Taillac

Oenesteria – An Italian place with fresh products and great chefs from Tuscany. It's a brasserie café-style restaurant. Also the fabulous Amatxi – I stopped at this place in the 11th this summer for a glass of wine and aperitif with a friend—it was so delicious that we stayed for dinner. Vantre – Another great restaurant in the 11th. It's in the Michelin Guide. —Christine Bergstrom

Abri Soba – My favorite restaurant. Everything is just right: the setting, the service, the small Japanese plates to share, and the price. —Mathieu Lebreton

Holybelly – Whether it's pancakes or poached eggs, don't be surprised if it becomes your regular breakfast spot. —Liana Engel

La Fontaine de Mars is always great and open on Sundays. Get the duck confit. —Yolanda Edwards

Aux Deux Amis for easy affordable French food with good ingredients. It's always fun, lively and open on Sunday nights! —Monica Mendal

All restaurants from Big Mama Group. Big Love is an intimate and cosy one in the Marais. And I also really like Pink Mamma, close to Pigalle. —Maï de Colnet

Le Dauphin – My neighborhood go-to in the 11th. Recoin – a new fave for small plates and natural wine. Le Cornichon – A fun trendy new spot in the 11th. Rose Bud is a little treasure with great cocktails. Chambelland for a healthy lunch with incredible gluten-free bread. Fabula, the terrace cafe at Paris's Musée Carnavalet. —Annie Waterman

Bouche – Natural wines, small plates to share. Rigamarole – treat yourself to a special lunch with Robert and Jesse in the kitchen and then go to Folderol, their famous natural wine bar that has incredible ice cream. Oobatz – new pizza spot. Maybe the best pizza I have ever had! Caché for excellent seafood. —Caroline Morrison

Oobatz is the most delicious pizza in Paris. Period. Folderol. A wine bar that serves ice cream. It is the most delicious ice cream in Paris (maybe the world?!) —Elizabeth Colling

Relais de l'Entrecote – Just meat and fries. Ralph's – The restaurant from Ralph Lauren, great setting. Comptoir du Relais – Excellent food. Clamato – Best seafood – no reservations. Localino – Italian, simple and just amazing food. —Frank Herrmann

Chez André – classic French bistro with 1930s decor. And Spiti Sou – Greek cuisine. —Leonardo Pucci

Classic bistro
Floderer for an old-school Alsatian menu—think choucroute! Au Bons Crus is a bit out of the way but pin it for the 11th. Chez L'Ami Jean is a super cozy spot, and so delicious. Don't miss the rice pudding. —Yolanda Edwards

Le Bon Georges, and the minuscule Chez Marcel in the 6th, which is truly local. —Alexandra Weinress

Chez Nenesse or Chez Janou for very cute interiors. —Clara Hranek

Le Clown Bar —Gabriel Vachette

La Coupole – This Parisian institution has been a family favorite for decades. Classic French dining with a grand Art Deco atmosphere. —Mimi Thorisson

Chez Georges – Food, crowd, ambiance, service… there is simply no contest. La Petite Chaise, the oldest restaurant in Paris. —Monica Mendal

Brasserie Lipp is still very much a thing. I still go twice a month for lunch. —Alex Rash

Chez Dumonet – The soufflé moment never fails to impress. —Maria Lemos

L'Ami Louis – Legendary throwback bistro. First sell at least one Bitcoin so you can be sure to pay the bill… —Tony Conrad / Leonardo Pucci

Special occasion
Pétrelle is a beautiful restaurant, both for its design and its cuisine. —Alexandra Weinress

Le Voltaire for very chic and very expensive white tablecloth Parisian fare. —Clara Hranek / Elliott Barnes / Maria Lemos / Frank Herrmann

L'Arpège – Chef Alain Passard. Michelin-starred, as much about artistry as food. —Mimi Thorisson

La Mediterranée in the 6th. Best sole meunière in town. —Diego Delgado-Elias

Caviar Kaspia or Le Dome (for sole meunière). —Sofia Coppola / Frank Herrmann / Yolanda Edwards

Shang Palace – Peking Duck. In the Shangri La Hotel. —Josh Hickey

Ogata – Serving beautiful Japanese dishes in a gorgeous, serene space. —Tony Conrad

La Closerie des Lilas – Family spot for decades. —Franck Audoux

Le Grand Véfour – 2 Michelin Star restaurant inside the Palais Royal. —Frank Herrmann

Table by Bruno Verjus – One of the best chefs around. —Alex Rash / Christine Bergstrom

Loulou's – Chic and fancy, good Italian food, prime location in the Tuileries gardens. —Frank Herrmann / Kimberley Blanchot

Le Doyenné – To get out of town for a night. —Rebekah Peppler

Under-the-radar neighborhood spots
Janine in the 17th—cool vibe and great food. Le Chardon in the 10th—a modern bistro. Le Petit Varenne in the 7th. Le Grand Filles et Fils – wine shop and restaurant in the 2nd. Hanabi in the 2nd—Japanese fine dining. —Yolanda Edwards

Aléa is my Montmartre bistronomie staple. —Alexandra Weinress

Au Rêve in Montmartre. Pontochoux – The best Japanese curry. —Clara Hranek

Cafe Charlot – one of the best burgers, also great for drinks. —Frank Herrmann

Chez Omar – Pretty under the radar unless it's fashion week. —Diego Delgado-Elias

Maison Sota – A super talented Japanese chef riffs on French food. —Maria Lemos

Clos D'Astorg just opened. Juliette and Gio run a superb ship. —Elliott Barnes

Cafe Du Canal, the new neighborhood spot I just opened with Chef Mailea Weger. —Alex Rash

Clamato is the perfect balance of casual and elevated. —Elizabeth Colling

Caillebotte and Bacini in the 9th. Maggie, main dining room at Hôtel Rochechouart. —Kimberley Blanchot

International food
Kubri – creative and delicious Lebanese cuisine. Adraba – Levantine flavors in Montmartre. Raviolis Nord-Est for hole-in-the-wall dumplings. —Alexandra Weinress

Pizzi – best pizza and pasta. Tekes – Mediterranean by Asaf Granit. Le Tagine – best couscous in the 11th. —Nicolas Saltiel

L'As du Falafel in the Marais (touristy but good!). Royal China for Chinese. —Clara Hranek

Bistro Mee in the 1st. Scallion pancakes perfect to share. —Elizabeth Colling`,
  expectedRegion: 'Paris, France',
  expectedPlaces: [
    // Most-mentioned / most prominent (pipeline will hit 30-place limit, these are must-finds)
    { name: 'Chez Georges', type: 'restaurant', city: 'Paris' },
    { name: 'Le Voltaire', type: 'restaurant', city: 'Paris' },
    { name: 'Bistrot Paul Bert', type: 'restaurant', city: 'Paris', mustHaveDescription: 'steak' },
    { name: 'Oobatz', type: 'restaurant', city: 'Paris', mustHaveDescription: 'pizza' },
    { name: 'Chez Allard', type: 'restaurant', city: 'Paris' },
    { name: 'Le Cheval d\'Or', type: 'restaurant', city: 'Paris' },
    { name: 'Clamato', type: 'restaurant', city: 'Paris', mustHaveDescription: 'seafood' },
    { name: 'L\'Ami Louis', type: 'restaurant', city: 'Paris' },
    { name: 'Brasserie Lipp', type: 'restaurant', city: 'Paris' },
    { name: 'La Coupole', type: 'restaurant', city: 'Paris' },
    { name: 'Caviar Kaspia', type: 'restaurant', city: 'Paris' },
    { name: 'L\'Arpège', type: 'restaurant', city: 'Paris' },
    { name: 'Le Grand Véfour', type: 'restaurant', city: 'Paris' },
    { name: 'La Fontaine de Mars', type: 'restaurant', city: 'Paris' },
    { name: 'Folderol', type: 'bar', city: 'Paris' },
    { name: 'Holybelly', type: 'cafe', city: 'Paris' },
    { name: 'Racines', type: 'restaurant', city: 'Paris' },
    { name: 'Le Rubis', type: 'restaurant', city: 'Paris' },
    { name: 'Ogata', type: 'restaurant', city: 'Paris' },
    { name: 'Loulou', type: 'restaurant', city: 'Paris' },
    { name: 'La Bourse et La Vie', type: 'restaurant', city: 'Paris' },
    { name: 'Mokonuts', type: 'restaurant', city: 'Paris' },
    { name: 'Pétrelle', type: 'restaurant', city: 'Paris' },
    { name: 'Kubri', type: 'restaurant', city: 'Paris' },
    { name: 'L\'As du Falafel', type: 'restaurant', city: 'Paris' },
    { name: 'Shang Palace', type: 'restaurant', city: 'Paris' },
    { name: 'Pink Mamma', type: 'restaurant', city: 'Paris' },
    { name: 'Abri Soba', type: 'restaurant', city: 'Paris' },
  ],
  antiPatterns: [
    // Contributor names — must NOT appear as place entries
    'Mimi Thorisson', 'Yolanda Edwards', 'Sofia Coppola', 'Elliott Barnes',
    'Clara Hranek', 'Frank Herrmann', 'Alexandra Weinress', 'Christine Muhlke',
    'Tony Conrad', 'Leonardo Pucci', 'Maria Lemos', 'Diego Delgado-Elias',
    'Rebekah Peppler', 'Monica Mendal', 'Elizabeth Colling', 'Franck Audoux',
    'Alex Rash', 'Nicolas Saltiel', 'Annie Waterman', 'Caroline Morrison',
    // Section headers and non-place text
    'EAT + DRINK', 'Restaurants on repeat', 'Classic bistro', 'Special occasion',
    'Big Mama Group', 'Team Yolo', 'Yolo Journal',
  ],
  qualityCriteria: {
    minPlaceCount: 28,
    personalContextRequired: false,    // article-style, no personal user context
    deduplicationRequired: true,       // Chez Georges 3x, Le Voltaire 5x, Oobatz 3x
    typAccuracyThreshold: 0.80,        // mostly restaurants, some bars/cafes
  },
};

// ─── TEST CASE 10: URL — CN Traveller Family Hotels in Europe ────────────────

const ARTICLE_CN_EUROPE_HOTELS: TestCase = {
  id: 'url-cn-europe-hotels',
  name: 'CN Traveller — Best Family-Friendly Hotels in Europe (Live URL)',
  category: 'url-live',
  isArticle: true,
  description: 'Live URL fetch via Firecrawl. Tests: only hotels extracted (not restaurants mentioned in reviews), geographic fencing resolves to European countries, no false positives from editorial padding.',
  sourceUrl: 'https://www.cntraveller.com/gallery/best-family-friendly-hotels-europe',
  input: '', // will be populated by Firecrawl at runtime
  expectedRegion: 'Europe',
  expectedPlaces: [
    { name: 'Martinhal Sagres', type: 'hotel', city: 'Portugal' },
    { name: 'Borgo Egnazia', type: 'hotel', city: 'Italy' },
    { name: 'The Brando', type: 'hotel' },
    { name: 'Cheval Blanc St-Tropez', type: 'hotel', city: 'France' },
    { name: 'Verdura Resort', type: 'hotel', city: 'Sicily' },
    { name: 'Forte Village', type: 'hotel', city: 'Sardinia' },
    { name: 'Pine Cliffs', type: 'hotel', city: 'Portugal' },
    { name: 'Sani Resort', type: 'hotel', city: 'Greece' },
  ],
  expectedEnrichment: [
    { name: 'Martinhal Sagres', mustBeInCountry: 'Portugal', expectedConfidence: 'high' },
    { name: 'Borgo Egnazia', mustBeInCountry: 'Italy', expectedConfidence: 'high' },
    { name: 'Verdura Resort', mustBeInCountry: 'Italy', expectedConfidence: 'high' },
    { name: 'Sani Resort', mustBeInCountry: 'Greece', expectedConfidence: 'high' },
  ],
  antiPatterns: [
    // Restaurants mentioned inside hotel reviews should NOT be extracted
    'Cala Masciola', 'Due Camini', 'La Frasca',
    // Editorial padding / people
    'Condé Nast', 'CN Traveller',
  ],
  qualityCriteria: {
    minPlaceCount: 6,
    personalContextRequired: false,
    deduplicationRequired: false,
    typAccuracyThreshold: 0.95,
  },
};

// ─── TEST CASE 11: Slash-Separated Pairs ────────────────────────────────────

const SLASH_PAIRS: TestCase = {
  id: 'slash-pairs',
  name: 'Bucket List with Slash Pairs & Abbreviations',
  category: 'edge-case',
  description: 'Tests splitting of slash-separated venue pairs like "Soneva Secret/Kudadoo" into individual places, plus abbreviation expansion like "FS" → Four Seasons.',
  input: `Dream list 2026:
-Soneva Secret/Kudadoo (either one, both look incredible)
-Aman Tokyo/Aman Kyoto (doing a Japan swing)
-FS Bora Bora or Conrad Bora Bora (honeymoon vibes)
-O&O Reethi Rah/St Regis Maldives (overwater villa required)
-RMH Palazzo Danieli/Cipriani Venice (for our anniversary in Sept)
-The Silo/Ellerman House in Cape Town
-Chablé Yucatán or Rosewood Mayakobá (need a cenote fix)
-Park Hyatt Kyoto for cherry blossom season!!`,
  expectedRegion: null,
  expectedPlaces: [
    { name: 'Soneva Secret', type: 'hotel', city: 'Maldives' },
    { name: 'Kudadoo', type: 'hotel', city: 'Maldives' },
    { name: 'Aman Tokyo', type: 'hotel', city: 'Tokyo' },
    { name: 'Aman Kyoto', type: 'hotel', city: 'Kyoto' },
    { name: 'Four Seasons Bora Bora', type: 'hotel' },
    { name: 'Conrad Bora Bora', type: 'hotel' },
    { name: 'One&Only Reethi Rah', type: 'hotel', city: 'Maldives' },
    { name: 'St Regis Maldives', type: 'hotel', city: 'Maldives' },
    { name: 'The Silo', type: 'hotel', city: 'Cape Town' },
    { name: 'Ellerman House', type: 'hotel', city: 'Cape Town' },
    { name: 'Chablé Yucatán', type: 'hotel', city: 'Mexico' },
    { name: 'Rosewood Mayakobá', type: 'hotel', city: 'Mexico' },
    { name: 'Park Hyatt Kyoto', type: 'hotel', city: 'Kyoto', mustHaveUserContext: 'cherry blossom' },
  ],
  antiPatterns: ['Bora Bora', 'Venice', 'Japan', 'Cape Town', 'Maldives', 'Mexico'],
  qualityCriteria: {
    minPlaceCount: 12,
    personalContextRequired: true,
    deduplicationRequired: false,
    typAccuracyThreshold: 0.95,
  },
};

// ─── TEST CASE 12: Email Forward with Mixed Intent ──────────────────────────

const EMAIL_FORWARD: TestCase = {
  id: 'email-forward',
  name: 'Forwarded Email — Friends Bali Recs with Mixed Signals',
  category: 'text-message',
  description: 'A forwarded email chain with nested quotes, "don\'t bother" warnings, and conflicting opinions. Tests: negative signals are excluded, nested attribution is handled, types are correct for Bali venues.',
  input: `---------- Forwarded message ---------
From: Sarah K
Subject: RE: RE: Bali recs??

Ok here's everything from everyone:

UBUD
- Capella Ubud — glamping but make it fashion. Tents are INSANE. Book the jungle one.
- Four Seasons Sayan — the infinity pool overlooking the gorge is unreal. Do the river blessing.
- Locavore — MUST for fine dining. Like 2 month waitlist so book NOW. Farm-to-table, hyper-local.
- Mozaic — also Michelin-level but more relaxed garden setting. Sarah says skip it but I disagree.
- Room4Dessert — just desserts as a meal?! Will Goldfarb is a genius
- Milk & Madu — great for breakfast, families love it
- Yellow Flower café is a tourist trap DO NOT GO (sorry had to warn you lol)

SEMINYAK/CANGGU
- The Lawn Canggu — sunset drinks, bean bags on the grass, very instagram
- Potato Head Beach Club — you've seen it everywhere but it's actually good
- La Brisa — beach bar made from reclaimed boats, most photogenic spot in Bali
- Shelter Bali cafe — don't bother, overpriced and rude staff (Sarah's opinion, I've never been)
- Crate Cafe — hipster breakfast spot, actually amazing
- Mason Jungle — cocktails in literal jungle, very cool at night
- Single Fin — clifftop bar in Uluwatu, go for sunset. Gets wild later.

NUSA ISLANDS
- Le Pirate on Nusa Ceningan — cheapest coolest stay, bamboo huts over the water`,
  expectedRegion: 'Bali, Indonesia',
  expectedPlaces: [
    { name: 'Capella Ubud', type: 'hotel', city: 'Ubud', mustHaveDescription: 'glamping' },
    { name: 'Four Seasons Sayan', type: 'hotel', city: 'Ubud', mustHaveDescription: 'infinity pool' },
    { name: 'Locavore', type: 'restaurant', city: 'Ubud', mustHaveDescription: 'farm-to-table' },
    { name: 'Mozaic', type: 'restaurant', city: 'Ubud' },
    { name: 'Room4Dessert', type: 'restaurant', city: 'Ubud', mustHaveDescription: 'Goldfarb' },
    { name: 'Milk & Madu', type: 'cafe', city: 'Ubud' },
    { name: 'The Lawn Canggu', type: 'bar', city: 'Canggu' },
    { name: 'Potato Head Beach Club', type: 'bar', city: 'Seminyak' },
    { name: 'La Brisa', type: 'bar', city: 'Canggu', mustHaveDescription: 'reclaimed boats' },
    { name: 'Crate Cafe', type: 'cafe', city: 'Canggu' },
    { name: 'Mason Jungle', type: 'bar' },
    { name: 'Single Fin', type: 'bar', city: 'Uluwatu', mustHaveDescription: 'clifftop' },
    { name: 'Le Pirate', type: 'hotel', city: 'Nusa Ceningan', mustHaveDescription: 'bamboo' },
  ],
  antiPatterns: [
    'Yellow Flower', // explicitly warned against
    'Shelter Bali',  // explicitly warned against
    'Sarah K', 'Will Goldfarb', // people, not places
    'Ubud', 'Seminyak', 'Canggu', 'Uluwatu', // locations, not venues
  ],
  qualityCriteria: {
    minPlaceCount: 11,
    personalContextRequired: false,
    deduplicationRequired: false,
    typAccuracyThreshold: 0.75,
  },
};

// ─── TEST CASE 13: URL — Mr & Mrs Smith Hotel Roundup ───────────────────────

const ARTICLE_MRS_SMITH: TestCase = {
  id: 'url-mrs-smith',
  name: 'Mr & Mrs Smith — Best New Hotels 2025 (Live URL)',
  category: 'url-live',
  isArticle: true,
  description: 'Live URL fetch. Tests: editorial hotel extraction from a different publication style, all-hotel type accuracy, international geographic resolution.',
  sourceUrl: 'https://www.mrandmrssmith.com/travel-intel/best-new-hotels-2025',
  input: '', // will be populated by Firecrawl at runtime
  expectedRegion: null,
  expectedPlaces: [
    // We expect hotels — specifics depend on article content at runtime
    // These are likely candidates but the test is mainly about type accuracy
    // and anti-pattern filtering. Recall scoring will adapt to what's on the page.
  ],
  antiPatterns: [
    'Mr & Mrs Smith', 'Smith', // publication name
    'Travel Intel', // section name
  ],
  qualityCriteria: {
    minPlaceCount: 3,
    personalContextRequired: false,
    deduplicationRequired: false,
    typAccuracyThreshold: 0.90,
  },
};

// ─── TEST CASE 14: Mega Tokyo City Guide ────────────────────────────────────

const TOKYO_MEGA_GUIDE: TestCase = {
  id: 'tokyo-mega-guide',
  name: 'Dense Tokyo City Guide with Bracketed Categories',
  category: 'city-guide',
  description: 'A massive, opinionated Tokyo guide with bracketed section headers, inline pipe-separated lists, parenthetical asides, "haven\'t been yet" signals, convenience store chains, nested recs within recs, shop names, museums, markets, and hotels. Tests: high volume extraction (60+ places), correct type assignment across categories, anti-pattern exclusion for non-venue items (products, people, movies), handling of "mentioned but not visited" places.',
  input: `[restaurants ]
Tenmo, Tempura | I can't recommend this 10-seat Edomae tempura spot in Nihonbashi more highly. Established in 1885, it's family-owned and the parsley tempura was possibly the best tempura of my life. The menu is coursed and you can choose between 8, 11 or 14 courses when you book your reservation. (If you go for lunch, grab a coffee at nexpect before / after)
Sowado | a very special izakaya opened in 2020 by chef Hideaki Sakai with excellent sake + cocktails + natural wine. You can opt for omakase or à la carte — whichever route you take, make sure to book in advance, ask for a seat at the bar and order the whole fish. FYI there's no sign at the entrance but if you see a concrete wall + metal sliding door you're in the right spot
Butagumi | go here for tonkatsu (breaded deep-fried pork cutlets) in a traditional two-story house in the Nishi-Azabu neighborhood. There are options on the menu to choose heirloom breeds from around Japan — we've tried a few and they're all delicious but the Submarine Himuro Pork from Genma + a Kagua blanc beer comes out on top for me. Other tonkatsu to check out: Tonki in Meguro, Kanda Ponchiken in Chiyoda, Ginza Bairin in Ginza and Katsukichi, a local chain with multiple locations — get the kaki-furai (deep-fried oysters) if they're in season
Nodaiwa Azabu Iikura Honten | fifth generation-owned unagi (eel) restaurant. Another spot for unagi that I haven't yet been to but have heard excellent things about is Edogawa Ishibashi (the sake selection is supposed to be amazing here as well!)
Sushi Mizukami | perhaps one of my personal favorite meals of life? Opened in 2018 by Chef Michinobu Mizukami (who trained under Sukiyabashi Jiro), there are nine counter seats and while it's not at all an inexpensive omakase, the whole experience from start to finish is magical
Sushi Meino | opened in 2023 by Mei Kogo, one of only a few female sushi masters in Japan. (This is very high on my list for next trip — I'll report back!)
Sushi Saito | one of the best sushi counters in the city (and priced to match). It's also nearly impossible to book…try your luck on the omakase website, I've seen things open up last minute
Sushi Yuu | traditional Edomae sushi. Pricey but worth it
Sawada | a six-seat sushi counter that is also incredibly hard to book. I haven't yet made it in but I always try
One more sushi recommendation: if you have time on your travel day / are in Terminal 1 at Narita, Sushi Kyotatsu is a great option for sit down or a takeaway plane snack
Shima | kobe beef sandos. Go for lunch or dinner
Yakumo Saryo | tea house by the same team behind Ogata in Paris. Book the Japanese breakfast in advance and be certain to request a seat at the main table by the window (they also have a bar area and the experience isn't the same)
Narukiyo | excellent izakaya in Shibuya with a lively atmosphere. Make a reservation in advance and keep in mind that there is no English menu (ask for your waiter's recommendations and/or get the wagyu + asparagus if they have + sashimi + whatever is fried)
Tempura Fukamachi | very, very, very good tempura by a father-son team near Kyobashi Station
Yakitori Imai | yakitori with an open kitchen + natural wine (make sure to order the chicken skewers)
Yasubei of Ebisu | order gyoza + potato salad + beer
Regarding ramen: I firmly believe that the best ramen in Tokyo is at the end of whatever long line you wait in when you get hungry. A few to seek out if you need a destination: Iruca Tokyo (two locations) | Kagari Ramen (main location is in Ginza and they have a second in Roppongi Hills) | Ichiran (in Shibuya; get the tonkotsu ramen) | Shinjiko Shijimi (get the shijimi shio ramen)
Regarding pizza, I haven't found my personal favorite yet but here are the options: The Pizza Bar On 38th (at the Mandarin Oriental) | SAVOY (multiple locations + they do delivery if you need a night in at the hotel) | Pizza Studio Tamaki (PST) | Pizza Marumo (try the Japanese umami) | Seirinkan (two offerings only: Margherita and Marinara. I preferred the marinara!) | Pizza Strada | Pizzeria e Trattoria da ISA
A trip to Japan is not complete without (daily) konbini (convenience store) stops. The top three: 7-Eleven, FamilyMart, and Lawson each have their own specialties though if it's your first time, I highly recommend getting an egg sando at each and doing a side by side taste test to find your personal favorite.
[wine | cocktail | listening bars]
Studio Mule | my favorite wine / listening bar in Tokyo. If I lived in the city, I would be here constantly. Say hi to Toshiya-san for me and take note of every vinyl he plays — they're all amazing. There are 11 counter seats and while the wine list skews European, he has a few extremely special Japanese wines if you're open to getting a bottle. I highly recommend arriving right at opening as it's a small space and it fills up quickly
Ahiru Store | a very very good natural wine spot (with food as well). It can be hard to get into but it's worth the wait. (It's not too far of a walk to/from Studio Mule if you can't get in to one or get either or want to combine them.) Cash only!
Winestand Waltz | very tiny stand-up wine bar (close to Yasubei of Ebisu if you want wine pre- or post-gyoza)
Bunon | such a special, cozy spot with great natural wine (emphasis on Japanese bottles) + sake in a traditional renovated two-story home in Nishi-Azabu. Be sure to plan to come early / closer to opening if you're not planning to stay for dinner (Japanese-European small plates)
Kasiki | for ice cream + wine
Grandfather's | excellent cocktails + vinyl. Get the mini martini and order potato chips (and know that they do allow indoor smoking)
Bar Martha | whiskey + listening bar emphasis on listening aka please don't try to have a loud conversation here
Gen Yamamoto | 8-seat cocktail omakase — definitely book in advance!
Bar Benfiddich | candlelit, 15-seat bar on the 9th floor of a high-rise near Shinjuku Station from bartender Hiroyasu Kayama. There's no menu, the drinks are seasonal / farm-to-glass and the experience is very very special. Book in advance for one of their seatings (19h / 21h / 23h) via IG / their site
The SG Club | opened in 2018 by Shingo Gokan. There's Guzzle (more relaxed on the ground floor), Sip (intimate, elegant cocktail experience in the basement) and Savor (the upstairs, members-only cigar room). Definitely make a reservation / if you want to risk it, go on the earlier side
New York Bar | in the recently revamped / reopened Park Hyatt Tokyo (don't worry they kept the bar the same so you can still lean into the Lost In Translation vibes)
[coffee | bread | sweet]
Fuglen | one of my favorite coffee shops in the world. I always bring beans home with me. There are multiple location but I especially like the Shibuya location (right around the corner from TRUNK(hotel) Yoyogi Park which is a coffee shop by day / cocktails by night
Tokyo is absolutely not lacking in good coffee. Here are a few more to check out: nexpect | Nodoya no katte | Koffee Mameya | Glitch | Onibus | Paddlers Coffee | Switch | Little Nap
Sunshine Juice | excellent juice shop
I'm donut ? | get the classic (multiple locations)
Bricolage Bread & Co | bakery meets café in Roppongi. Coffee from Fuglen and don't miss the breads made with Japanese grains
Fukusaya | my personal favorite Castella (a delicate sponge cake) is from here and I always take an individual cube with me as a sweet plane snack for the way home.
Toraya | Toraya has been making wagashi (traditional Japanese sweets) for the Imperial court since 1628. They have several locations across the city but the Akasaka flagship location designed by architect Hiroshi Naito is especially beautiful
Higashiya Ginza | modern wagashi + tea (they do lunch too)
[shop]
N id Tokyo | Amomento Tokyo Flagship | Auralee | Center for Cosmic Wonder | 1LDK apartments | Beams | Onitsuka Tiger | Lemaire Flagship | Prada (specifically the Aoyama location designed by Herzog and De Meuron) | Laila Vintage | Jantiques | Ginza Natsuno | Yonoya Comb Store | Pejite | Hakujitsu | Daikanyama T-Site | Cow Books | Totodo | Shibuya Publishing & Booksellers | Honkichi | Ginza Itoya | Ebiya | Kamata Hakensha | Kiya Nihonbashi
Some of the best food souvenirs (and snacks / lunches) are found in the depachikas (department store basement food halls). I especially love: Isetan Shinjuku | Takashimaya Nihonbashi | Nihonbashi Mitsukoshi | Ginza Mitsukoshi | Daimaru | Matsuya Ginza
I also love to pop into a few antenna shops (regional food shops): Hokkaido Dosanko Plaza Yurakucho | Ginza Okinawan Washita Shop | Oishii Yamagata Plaza | Tau Hiroshima
[visit]
Kyu Asakura House | Sogetsu Foundation | Mingeikan (Japan Folk Crafts Museum) | Tokyo Metropolitan Teien Art Museum | Nezu Museum | 21-21 Design Sight | Yoyogi Park | Shinjuku Gyoen National Park | Shibuya Crossing
Markets: Tsukiji Outer Market | Toyosu Market | Aoyama Farmers Market | Oedo Antique Market
[stay]
Trunk(Hotel) Yoyogi Park | K5 | Muji Hotel Ginza | The Okura | Aman Tokyo | Janu Tokyo | Park Hyatt Tokyo`,
  expectedRegion: 'Tokyo',
  expectedPlaces: [
    // ── Restaurants (primary recs) ──
    { name: 'Tenmo', type: 'restaurant', city: 'Tokyo' },
    { name: 'Sowado', type: 'restaurant', city: 'Tokyo' },
    { name: 'Butagumi', type: 'restaurant', city: 'Tokyo' },
    { name: 'Nodaiwa Azabu Iikura Honten', type: 'restaurant', city: 'Tokyo' },
    { name: 'Sushi Mizukami', type: 'restaurant', city: 'Tokyo' },
    { name: 'Sushi Meino', type: 'restaurant', city: 'Tokyo' },
    { name: 'Sushi Saito', type: 'restaurant', city: 'Tokyo' },
    { name: 'Sushi Yuu', type: 'restaurant', city: 'Tokyo' },
    { name: 'Shima', type: 'restaurant', city: 'Tokyo' },
    { name: 'Yakumo Saryo', type: 'restaurant', city: 'Tokyo' },
    { name: 'Narukiyo', type: 'restaurant', city: 'Tokyo' },
    { name: 'Tempura Fukamachi', type: 'restaurant', city: 'Tokyo' },
    { name: 'Yakitori Imai', type: 'restaurant', city: 'Tokyo' },
    { name: 'Yasubei of Ebisu', type: 'restaurant', city: 'Tokyo' },
    // ── Inline restaurant recs (tonkatsu, ramen, pizza) ──
    { name: 'Tonki', type: 'restaurant', city: 'Tokyo' },
    { name: 'Kagari Ramen', type: 'restaurant', city: 'Tokyo' },
    { name: 'Ichiran', type: 'restaurant', city: 'Tokyo' },
    { name: 'The Pizza Bar On 38th', type: 'restaurant', city: 'Tokyo' },
    { name: 'Seirinkan', type: 'restaurant', city: 'Tokyo' },
    // ── Bars ──
    { name: 'Studio Mule', type: 'bar', city: 'Tokyo' },
    { name: 'Ahiru Store', type: 'bar', city: 'Tokyo' },
    { name: 'Bar Benfiddich', type: 'bar', city: 'Tokyo' },
    { name: 'The SG Club', type: 'bar', city: 'Tokyo' },
    { name: 'Gen Yamamoto', type: 'bar', city: 'Tokyo' },
    { name: 'New York Bar', type: 'bar', city: 'Tokyo' },
    // ── Coffee / Bakery ──
    { name: 'Fuglen', type: 'cafe', city: 'Tokyo' },
    { name: 'Koffee Mameya', type: 'cafe', city: 'Tokyo' },
    { name: 'Bricolage Bread & Co', type: 'cafe', city: 'Tokyo' },
    // ── Shops ──
    { name: 'Beams', type: 'shop', city: 'Tokyo' },
    { name: 'Daikanyama T-Site', type: 'shop', city: 'Tokyo' },
    { name: 'Ginza Itoya', type: 'shop', city: 'Tokyo' },
    // ── Depachikas ──
    { name: 'Isetan Shinjuku', type: 'shop', city: 'Tokyo' },
    // ── Museums / Activities ──
    { name: 'Nezu Museum', type: 'museum', city: 'Tokyo' },
    { name: '21-21 Design Sight', type: 'museum', city: 'Tokyo' },
    { name: 'Tokyo Metropolitan Teien Art Museum', type: 'museum', city: 'Tokyo' },
    { name: 'Tsukiji Outer Market', type: 'activity', city: 'Tokyo' },
    { name: 'Yoyogi Park', type: 'activity', city: 'Tokyo' },
    // ── Hotels ──
    { name: 'Trunk(Hotel) Yoyogi Park', type: 'hotel', city: 'Tokyo' },
    { name: 'Aman Tokyo', type: 'hotel', city: 'Tokyo' },
    { name: 'Park Hyatt Tokyo', type: 'hotel', city: 'Tokyo' },
    { name: 'The Okura', type: 'hotel', city: 'Tokyo' },
    { name: 'Janu Tokyo', type: 'hotel', city: 'Tokyo' },
  ],
  antiPatterns: [
    'Sukiyabashi Jiro',           // reference to where a chef trained, not a recommendation
    '7-Eleven',                   // convenience store chain
    'FamilyMart',                 // convenience store chain
    'Lawson',                     // convenience store chain
    'Tokyo Banana',               // product, not a place
    'Kit Kat',                    // product
    'Pocari Sweat',               // product
    'Perfect Days',               // movie
    'Yukari',                     // person (guide), not a place
    'Food Sake Tokyo',            // guide service, not a venue
    'Ogata',                      // Paris reference, not a Tokyo rec
    'Shibuya Crossing',           // landmark / intersection, not a saveable place
  ],
  qualityCriteria: {
    minPlaceCount: 50,
    personalContextRequired: true,
    deduplicationRequired: false,
    typAccuracyThreshold: 0.80,
  },
};

// ─── TEST CASE 15: CN Traveler Hot List 2025 (Live URL) ─────────────────────

const CN_HOT_LIST_2025: TestCase = {
  id: 'url-cn-hot-list-2025',
  name: 'CN Traveler Hot List 2025 — Best New Hotels',
  category: 'url-live',
  description: 'Live URL fetch of CN Traveler Hot List 2025 winners. A multi-country hotel roundup article. Tests: Firecrawl extraction from CN Traveler (JS-heavy), all-hotel type assignment, global region handling (no single region), enrichment resolution to correct countries.',
  input: '',
  sourceUrl: 'https://www.cntraveler.com/story/hot-list-2025-winners',
  isArticle: true,
  expectedRegion: null,   // global roundup, no single region
  expectedPlaces: [
    // We know at least Nekajui (Costa Rica) is on the list from search results.
    // The rest will be validated manually on first run and then backfilled.
    { name: 'Nekajui', type: 'hotel' },
  ],
  expectedEnrichment: [
    { name: 'Nekajui', mustBeInCountry: 'Costa Rica', expectedConfidence: 'high' },
  ],
  antiPatterns: [
    'Conde Nast',            // publisher, not a hotel
    'Traveler',              // magazine name
    'Hot List',              // list title
  ],
  qualityCriteria: {
    minPlaceCount: 10,
    personalContextRequired: false,
    deduplicationRequired: false,
    typAccuracyThreshold: 0.95,  // should all be hotels
  },
};

// ─── TEST CASE 16: Wishlist Hotels Blog Post ────────────────────────────────

const WISHLIST_HOTELS_BLOG: TestCase = {
  id: 'wishlist-hotels-blog',
  name: 'Wishlist Hotels Series — Multi-Country Boutique Roundup',
  category: 'article',
  description: 'A personal blog post about 10 wishlist hotels across the globe. Heavy editorial voice, "haven\'t been yet" framing throughout, how-to-get-there logistics, references to friends/publications/past trips, and one hotel with a sub-property (Uxua Praia). Tests: all-hotel extraction from editorial prose, correct country/region resolution for global spread, excluding people (Nausika, Sarah, Wilbert Das) and publications (Vogue, AD, Prior), handling mentioned-but-different properties (Skinopi Lodge in Milos).',
  sourceUrl: 'https://sotheresthisplace.substack.com/p/10-wishlist-hotels-01',
  input: `Welcome to my Wishlist Hotels series! This is where I'll be sharing a completely random batch of hotels around the world that have been on my mind lately. They aren't new hotels necessarily, though some might be. The idea is to give you a peek at the hotels high on my wishlist—the ones I'd consider booking a whole trip around. Sometimes the hotel is the destination; other times it's what's pulling me toward a destination I've been eager to visit (win, win). While these stays are definitely on my "bucket list", by no means will all the hotels in this series be luxury hotels only a small percentage of us can afford, because that wouldn't be any fun. Plus, you know I love a soulful boutique stay just as much, and sometimes even more. My hope is that you'll add some of these to your own wishlists and maybe even get inspired to book a stay. And if you have the chance to visit any of them before I do, you know I want to hear about it ;) This month, a few lust-worthy stays have been on my mind, sparking some pretty epic trip ideas: a foodie-forward inn for the cool kids in France's often-overlooked Auvergne region, a design-focused hideaway in my favorite Brazilian beach town, a family-run ranch in Cordoba's Sierras Chicas hills, an unexpectedly whimsical retreat high in the Dolomites, a former bishop's palace in a fairytale village just outside Rome, a secluded escape tucked into the mountains of Greece's Peloponnese, one of Kyoto's most storied ryokans, and more…
Let's go!
Uxua Casa Hotel & Spa
UXUA Casa Hotel & Spa, Trancoso, (Bahia), Brazil
The last time I was in Brazil was seven years ago. I went to Salvador first, then Trancoso for New Year's (hands down the best New Year's of my life). Trancoso is a tiny little beach town that I wrote about for Vogue here. I miss Brazil so much. I'm desperate to go back this year. While there are so many places I want to explore in Brazil, I've always dreamed of staying at UXUA in Trancoso, the gorgeous hotel founded by Wilbert Das, a Dutch designer and former creative director of Diesel. I snuck in and did a little walk through when I was there last time and it was just magical. Tucked behind the colorful houses of the quadrado, the main grassy square with all the restaurants and shops, it forms a collection of historic Portuguese colonial homes, each one restored with warm wood, handmade tiles, and local art.
Berghoferin
Berghoferin, South Tyrol, (Dolomites), Italy
I'd love to get back to the Dolomites this year. The Berghoferin opened in the 1960s as a mountain lodge and was reimagined in 2023 as a 13-suite adults-only hideaway in Redagno, South Tyrol, under the Corno Bianco and Corno Nero peaks.
Al Moudira Hotel
Al Moudira Hotel, Luxor, Egypt
The last time I visited Luxor was my senior year of college, passing through on a Nile cruise. When Al Moudira reopened under new ownership in 2022, it immediately put Luxor back on the map for me. Tucked slightly off the main city on the West Bank, the hotel is an oasis of courtyards, gardens, and glamorous old-world charm.
Estancia los Potreros
Estancia los Potreros, Cordoba, Argentina
Lately I've been dying to do a gaucho trip, and for some reason I keep coming back to this family-run ranch tucked into Cordoba's Sierras Chicas hills. With only about 12 guests at a time, visitors are welcomed into the family's home.
Corte della Maesta
Corte della Maesta, Civita di Bagnoregio, Viterbo, Italy
A short drive from Rome, the way the tiny hilltop village of Civita di Bagnoregio hovers above the valley is seriously straight out of a fairy tale. Inside the village, housed in a 14th-century bishop's palace, sits Corte della Maesta, an intimate property that features just five uniquely styled suites.
Finca La Donaira
Finca La Donaira, Malaga, Spain
There's so much calling me back to Southern Spain, and Finca La Donaira in Montecorto is high on that list. Tucked into the rolling hills of the Sierra de Grazalema Natural Park, it's all about slow living, nature, and a kind of sustainable indulgence. The finca doubles as a working organic farm with just nine individually designed rooms.
Auberge de Chassignolles
Auberge de Chassignolles, Chassignolles, (Auvergne), France
The reason it's taken me so long to get to this pretty little inn in the Auvergne region of France is because the region itself is sort of off the beaten path (even mine). Located in the village of Chassignolles, this intimate retreat offers a warm welcome, cozy accommodations, and a restaurant serving hearty local cuisine.
Manna
Manna, Arcadia, (Peloponnese), Greece
My friend Nausika, who owns Skinopi Lodge in Milos, has been telling me about her friend's hotel Manna for years. Perched at 1,200 meters in Arcadia, it feels tucked away, surrounded by the untouched fir forest of Mount Mainalo. The building itself surprises you: once a 1929 sanatorium, its Neoclassical bones now meet a modern, earthy sophistication.
Hiiragiya
Hiiragiya, Kyoto, Japan
The family-run inn Hiiragiya in Kyoto is my #1. It's been a haven for artists, writers, and royalty since its founding in 1818. One of Kyoto's most iconic ryokans.
Sussurro
Sussurro, Mozambique, Africa
I first connected with Sussurro's co-owner Sarah years ago when I stumbled across her dreamy hotel on Instagram. With just a handful of thatched-roof bungalows tucked along a turquoise lagoon in southern Mozambique, Sussurro is exactly the kind of place I dream up when I picture escaping to Africa's coast.`,
  expectedRegion: null,  // global spread
  expectedPlaces: [
    { name: 'Uxua Casa Hotel & Spa', type: 'hotel', city: 'Trancoso' },
    { name: 'Berghoferin', type: 'hotel', city: 'South Tyrol' },
    { name: 'Al Moudira Hotel', type: 'hotel', city: 'Luxor' },
    { name: 'Estancia los Potreros', type: 'hotel', city: 'Cordoba' },
    { name: 'Corte della Maesta', type: 'hotel', city: 'Civita di Bagnoregio' },
    { name: 'Finca La Donaira', type: 'hotel', city: 'Malaga' },
    { name: 'Auberge de Chassignolles', type: 'hotel', city: 'Chassignolles' },
    { name: 'Manna', type: 'hotel', city: 'Arcadia' },
    { name: 'Hiiragiya', type: 'hotel', city: 'Kyoto' },
    { name: 'Sussurro', type: 'hotel', city: 'Mozambique' },
  ],
  expectedEnrichment: [
    { name: 'Uxua Casa Hotel & Spa', mustBeInCountry: 'Brazil', expectedConfidence: 'high' },
    { name: 'Berghoferin', mustBeInCountry: 'Italy', expectedConfidence: 'high' },
    { name: 'Al Moudira Hotel', mustBeInCountry: 'Egypt', expectedConfidence: 'high' },
    { name: 'Estancia los Potreros', mustBeInCountry: 'Argentina', expectedConfidence: 'high' },
    { name: 'Hiiragiya', mustBeInCountry: 'Japan', expectedConfidence: 'high' },
    { name: 'Sussurro', mustBeInCountry: 'Mozambique', expectedConfidence: 'high' },
  ],
  antiPatterns: [
    'Wilbert Das',               // person (hotel founder)
    'Nausika',                   // person (friend)
    'Sarah',                     // person (hotel co-owner)
    'Skinopi Lodge',             // mentioned as context, not a rec in this list
    'Diesel',                    // brand
    'Vogue',                     // publication
    'Architectural Digest',      // publication
    'Prior',                     // publication
    'Charlie Chaplin',           // person
    'Elizabeth Taylor',           // person
    'Salvador',                  // city mentioned as past trip, not a hotel
    'Set Nefru',                 // boat, not a hotel (debatable — could be kept)
  ],
  qualityCriteria: {
    minPlaceCount: 9,
    personalContextRequired: true,
    deduplicationRequired: false,
    typAccuracyThreshold: 0.95,  // should all be hotels
  },
};

// ─── EXPORT ALL TEST CASES ──────────────────────────────────────────────────

export const TEST_CASES: TestCase[] = [
  BUCKET_LIST,
  CITY_GUIDE,
  TEXT_MESSAGE,
  MINIMAL,
  MIXED_AMBIGUOUS,
  NUMBERED_WITH_RATINGS,
  DUPLICATES,
  ARTICLE_TURKEY_HOTELS,
  PARIS_BLACK_BOOK,
  ARTICLE_CN_EUROPE_HOTELS,
  SLASH_PAIRS,
  EMAIL_FORWARD,
  ARTICLE_MRS_SMITH,
  TOKYO_MEGA_GUIDE,
  CN_HOT_LIST_2025,
  WISHLIST_HOTELS_BLOG,
];
