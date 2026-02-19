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

export interface TestCase {
  id: string;
  name: string;
  category: 'bucket-list' | 'city-guide' | 'article' | 'text-message' | 'mixed-format' | 'minimal' | 'edge-case';
  description: string;
  input: string;
  isArticle?: boolean;                          // true = pass isArticleFromUrl=true to extractPlaces
  expectedRegion: string | null;                // expected region inference
  expectedPlaces: ExpectedPlace[];              // every place that MUST be extracted
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
];
