# Expand Your Mosaic — Question Bank

A running bank of micro-interactions that deepen the user's taste profile over time. Designed for the profile section as an opt-in, start/stop, lightly gamified experience.

## Design Principles

- **Never feel like a survey.** Every interaction should feel like a conversation with a well-traveled friend, a game, or a beautiful visual exercise.
- **Every answer moves the needle.** Each response maps to existing taste axes, refines existing signals, or introduces new signal dimensions that improve matching.
- **Varied modalities.** Mix of: A/B image picks, this-or-that word pairs, scenario choices, single-image gut reactions, slider scales, and open-ended micro-prompts.
- **Unlockable depth.** Some questions only appear once enough baseline signal exists (e.g., "you seem drawn to minimalism — let's explore what *kind*").
- **Session-friendly.** Each question is self-contained. Users can do 1 or 30 in a sitting.

---

## Question Types

| Code | Type | Format | Example |
|------|------|--------|---------|
| `ELO` | Elo image battle | Two 2×2 mood boards, pick one | Same as onboarding but with new hotel/space imagery |
| `AB` | This-or-that | Two short text options, tap one | "Fireplace or ocean breeze?" |
| `SCENE` | Scenario pick | Short scenario, two reactions | "You arrive and the room isn't ready..." |
| `RATE` | Single image gut check | One image, swipe love/neutral/not-me | Close-up of a texture, a view, a table setting |
| `SLIDER` | Spectrum placement | Drag between two poles | Spare ←→ Dense |
| `MICRO` | Micro-prompt (voice/text) | Short open-ended question, 1-2 sentences | "Describe your ideal hotel bathroom in 5 words" |
| `RANK` | Order 3-4 options | Drag to rank | Rank: rooftop bar, wine cellar, poolside, library |

---

## The Questions

### SECTION 1: DESIGN & SPACE (Axes: volume, temperature, time, mood)

**1.** `AB` — **Fireplace or ceiling fan?**
→ temperature, mood
> Warm enclosure vs. tropical openness. Disambiguates the warm axis.

**2.** `AB` — **Terrazzo floors or wide-plank oak?**
→ temperature, time
> Cool modernism vs. warm heritage. Material palette signal.

**3.** `AB` — **One perfect orchid or wildflowers in a jam jar?**
→ formality, volume
> Controlled refinement vs. casual abundance.

**4.** `RATE` — *[Image: close-up of crumbling plaster wall with exposed brick]*
→ time, volume
> Wabi-sabi / patina tolerance. Gut reaction to imperfection.

**5.** `RATE` — *[Image: crisp white-on-white linen-draped room]*
→ volume, mood
> Monastic restraint response. Love = quiet cluster; not-me = expressive/soulful.

**6.** `AB` — **Candlelight or floor-to-ceiling windows?**
→ mood, volume
> Intimate darkness vs. luminous openness.

**7.** `SLIDER` — **Your ideal room palette:** *All-white ←→ Saturated color*
→ volume, mood
> Direct volume axis refinement.

**8.** `AB` — **Velvet or linen?**
→ formality, temperature
> Opulent/formal vs. relaxed/natural. Quick fabric signal.

**9.** `ELO` — *[Japanese ryokan interior vs. Moroccan riad interior]*
→ culture, volume, temperature
> Both are culturally specific but on opposite ends of volume/temperature.

**10.** `AB` — **Concrete or marble?**
→ time, temperature, formality
> Brutalist contemporary vs. classical grandeur.

**11.** `RATE` — *[Image: a cluttered, eclectic library with mismatched chairs]*
→ volume, formality
> Curated chaos tolerance. High volume + low formality signal.

**12.** `AB` — **A room with one extraordinary piece of art, or a room that *is* the art?**
→ volume, culture
> Focal point vs. total environment. Gallery vs. Gesamtkunstwerk.

**13.** `MICRO` — **Describe your ideal hotel bathroom in exactly 5 words.**
→ formality, volume, temperature, wellness signals
> Free-form micro-prompt. AI extracts signals from word choices.

**14.** `AB` — **Floor-to-ceiling bookshelf or floor-to-ceiling window?**
→ mood, culture
> Interior richness vs. exterior connection.

**15.** `SLIDER` — **How important is the view from your room?** *Don't care ←→ It's everything*
→ location, mood
> Differentiates design-focused travelers from landscape-focused.

---

### SECTION 2: SERVICE & RITUAL (Axes: formality, temperature)

**16.** `SCENE` — **You check in. The concierge has pre-built a full itinerary based on your profile.** *"Love it — saves me time" vs. "I'd rather discover things myself"*
→ formality, planning-style
> Structure vs. spontaneity at the service level.

**17.** `AB` — **The bartender remembers your drink, or you love telling them what you want?**
→ formality, temperature, service-style
> Anticipatory memory vs. the ritual of ordering.

**18.** `SCENE` — **It's 2am. You're hungry. Which do you want:** *"A world-class room service menu" vs. "The concierge sends you to a locals-only street food spot"*
→ formality, culture, explorer-orientation
> Cocoon vs. adventure, even in service context.

**19.** `AB` — **"Mr. Sewitz, welcome back" or "Hey Greg, good to see you"?**
→ formality, temperature
> Formal recognition vs. casual warmth. Direct formality axis.

**20.** `RANK` — **Order these from most to least important:** *The bed / The shower / The minibar / The wifi*
→ wellness, formality
> Physical comfort hierarchy reveals what "luxury" means to this person.

**21.** `AB` — **Turndown service with chocolate on the pillow, or no one enters your room while you're away?**
→ formality, privacy signals
> Service presence vs. sanctity of private space.

**22.** `SCENE` — **The hotel made a mistake with your room. They offer:** *"Immediate upgrade to a suite" vs. "Heartfelt apology and a handwritten note with a bottle of wine"*
→ formality, temperature
> Transactional resolution vs. emotional connection.

**23.** `AB` — **Breakfast buffet spectacle or à la carte in a quiet corner?**
→ volume, formality, social-energy
> Social abundance vs. intimate restraint.

**24.** `SLIDER` — **Staff interaction level:** *Leave me alone ←→ I want them to feel like friends*
→ temperature, formality
> Core service relationship calibration.

---

### SECTION 3: FOOD & DRINK (New signal dimension: culinary identity)

**25.** `AB` — **The restaurant everyone's talking about, or the one no one knows about yet?**
→ culture, social-signals
> Herd vs. discovery instinct applied to dining.

**26.** `AB` — **Omakase or family-style?**
→ formality, temperature
> Chef-controlled precision vs. communal warmth.

**27.** `AB` — **Natural wine or perfect Burgundy?**
→ time, formality, culture
> Counter-culture authenticity vs. classical refinement.

**28.** `SCENE` — **Your hotel has one restaurant.** *"It better be world-class" vs. "I barely care — I'm eating in the neighborhood"*
→ location, food-importance
> Hotel self-containment vs. neighborhood exploration.

**29.** `AB` — **Garden-to-table lunch in the sun, or underground tasting menu with wine pairing?**
→ mood, formality, temperature
> Light/casual/outdoor vs. dark/formal/interior.

**30.** `RANK` — **Order these breakfast moments:** *Pastry basket left at your door / Eggs made to order at a sunny terrace / Full English in a wood-paneled dining room / Skipping breakfast entirely*
→ formality, temperature, energy
> Morning ritual reveals daily rhythm and service expectations.

**31.** `AB` — **A cocktail bar where the bartender improvises, or where the menu is a masterpiece?**
→ formality, spontaneity
> Spontaneous craft vs. curated precision.

**32.** `MICRO` — **What's the meal you still think about from a trip?**
→ AI-extracted food signals
> Open-ended; AI parses for cuisine type, setting, formality, social context.

---

### SECTION 4: LOCATION & CONTEXT (Axes: culture, location signals)

**33.** `AB` — **On a cobblestone alley in the old town, or on the cliff above it all?**
→ culture, location, volume
> Embedded-in-fabric vs. removed-with-views.

**34.** `AB` — **You can hear the city, or you can hear nothing?**
→ volume, location
> Urban energy vs. total silence. Direct signal.

**35.** `SCENE` — **You have a free afternoon.** *"I want the hotel to feel like a destination — pool, spa, grounds" vs. "I want to disappear into the neighborhood and get lost"*
→ location, explorer-vs-cocoon
> Property as world vs. property as base camp.

**36.** `AB` — **Beach or mountain?**
→ mood, temperature, energy
> Classic binary but maps to multiple axes.

**37.** `AB` — **Island you need a boat to reach, or city hotel you can walk everywhere from?**
→ culture, formality, location
> Extreme removal vs. extreme immersion.

**38.** `SLIDER` — **How much does the destination matter vs. the property?** *All destination ←→ All property*
→ location, culture
> The fundamental travel identity question.

**39.** `AB` — **A hotel in a converted palazzo, or a hotel built by a starchitect?**
→ time, culture
> Adaptive reuse heritage vs. contemporary vision.

**40.** `AB` — **Tropical or alpine?**
→ temperature, mood
> Warmth/brightness vs. cool/dramatic.

---

### SECTION 5: CHARACTER & IDENTITY (Axes: formality, culture, scale)

**41.** `AB` — **A hotel with 8 rooms or a hotel with 200?**
→ formality, scale, intimacy
> Micro vs. institutional. Refines the scale diagnostic from onboarding.

**42.** `AB` — **A place that's been open 100 years, or one that opened last month?**
→ time
> Heritage vs. contemporary, direct axis.

**43.** `AB` — **A hotel that's also a members' club, or one that feels like it doesn't need to be known?**
→ formality, culture, social-signals
> Scene/exclusivity vs. quiet confidence.

**44.** `SCENE` — **You pull up to the hotel and there's a red carpet and bellhops.** *"Yes — this is an event" vs. "Already cringing"*
→ formality, volume
> Grand arrival tolerance. Gut-level formality check.

**45.** `AB` — **Owned by a family, or part of a collection you trust?**
→ culture, temperature, authenticity
> Independent character vs. reliable brand quality.

**46.** `AB` — **A hotel where they know your name by day 2, or one where you're perfectly anonymous?**
→ temperature, formality, privacy
> Warmth vs. discretion. Key service identity signal.

**47.** `SLIDER` — **How important is it that a hotel feels rooted in its place?** *Not at all ←→ It's everything*
→ culture
> Direct culture axis refinement.

**48.** `AB` — **A lobby you want to hang out in, or a lobby you pass through in 10 seconds?**
→ formality, social-energy, volume
> Public space as social anchor vs. room-centric stay.

---

### SECTION 6: MOOD & ENERGY (Axes: mood, temperature, volume)

**49.** `AB` — **Sunrise or golden hour?**
→ mood, energy
> Morning person vs. evening person. Affects dining, activity, room orientation.

**50.** `AB` — **Energized after a trip or deeply rested?**
→ energy, planning-style
> Adventure-seeker vs. restoration-seeker. Core emotional driver.

**51.** `SCENE` — **Your ideal last night of a trip:** *"Dressed up, best restaurant, a celebration" vs. "Room service, movie, packing slowly"*
→ formality, energy, mood
> Social crescendo vs. quiet wind-down.

**52.** `AB` — **A pool for swimming laps or a pool for lounging with a book?**
→ formality, energy, wellness
> Active vs. contemplative relationship to wellness.

**53.** `AB` — **Jazz bar or silent reading room?**
→ volume, mood, social-energy
> Sensory stimulation vs. contemplative silence.

**54.** `SLIDER` — **Your ideal hotel volume:** *Monastery ←→ Festival*
→ volume
> Direct volume axis recalibration.

**55.** `AB` — **Rainy day at the hotel or perfect sun every day?**
→ mood, temperature
> Cozy/interior appeal vs. outdoor/brightness orientation.

---

### SECTION 7: TEXTURE & MATERIAL (Deepening design signal)

**56.** `RATE` — *[Image: raw concrete wall with a single brass fixture]*
→ time, formality, temperature
> Brutalist minimalism response.

**57.** `RATE` — *[Image: hand-painted Portuguese azulejo tiles]*
→ culture, time, volume
> Craft and cultural ornament response.

**58.** `RATE` — *[Image: worn leather club chair by a fire]*
→ temperature, time
> Patina and warmth response.

**59.** `RATE` — *[Image: gleaming lacquer and chrome Art Deco bathroom]*
→ formality, time, mood
> Glamour and precision response.

**60.** `RATE` — *[Image: raw timber beam ceiling with whitewashed walls]*
→ time, culture, temperature
> Vernacular warmth response.

**61.** `AB` — **Brass or chrome?**
→ temperature, time
> Warm patina vs. cool precision.

**62.** `AB` — **Stone or wood?**
→ temperature, formality
> Cool/permanent vs. warm/organic.

**63.** `AB` — **Handmade ceramic or fine bone china?**
→ formality, culture
> Craft imperfection vs. classical refinement.

---

### SECTION 8: THE FINER POINTS (Niche signals that sharpen matching)

**64.** `AB` — **A hotel with an extraordinary garden, or extraordinary architecture?**
→ culture, volume
> Landscape vs. structure. Nature-integrated vs. design-statement.

**65.** `AB` — **Heated outdoor pool in winter or wild swim in summer?**
→ formality, culture, wellness
> Controlled luxury vs. elemental experience.

**66.** `AB` — **A spa with a 30-page treatment menu, or one with exactly three options?**
→ formality, volume
> Choice abundance vs. edited curation.

**67.** `SCENE` — **The hotel gift shop has:** *"Locally made ceramics and artisanal olive oil" vs. "Branded tote bags and candles"*
→ culture, authenticity
> Place-rooted curation vs. lifestyle brand.

**68.** `AB` — **A hotel that publishes a magazine, or one that doesn't have a website?**
→ culture, formality
> Brand-conscious storytelling vs. word-of-mouth mystique.

**69.** `AB` — **Black-and-white photography on the walls, or bold contemporary art?**
→ mood, volume, time
> Restrained documentation vs. expressive color.

**70.** `AB` — **A clawfoot tub or a walk-in rain shower?**
→ time, formality, wellness
> Heritage ritual vs. contemporary efficiency.

**71.** `AB` — **Robes and slippers waiting, or you brought your own?**
→ formality, self-sufficiency
> Provided luxury vs. personal ritual.

---

### SECTION 9: SCENARIO DEEP-DIVES (Complex choice reveals layered preferences)

**72.** `SCENE` — **Two hotels, same price, same city.** *Hotel A: rooftop pool, Michelin restaurant, design by a famous architect. Hotel B: no pool, no restaurant, but it's in a converted 17th-century convent and the rooms have original frescoes.* **Which do you book?**
→ formality, time, culture, volume
> Modern amenity package vs. irreplaceable character.

**73.** `SCENE` — **You're traveling solo for 5 days.** *"A cabin in the mountains with no phone signal" vs. "A small design hotel in a city you've never been to"*
→ location, culture, social-energy
> Isolation vs. urban discovery when alone.

**74.** `SCENE` — **The hotel sends a pre-arrival email asking for your preferences. You think:** *"Finally — someone who gets it" vs. "I don't want to be profiled, I want to be surprised"*
→ formality, service-philosophy
> Meta-question — how they feel about being known by a hotel (relevant to Terrazzo itself).

**75.** `SCENE` — **Anniversary trip. Budget isn't the issue.** *"The most beautiful hotel in the world" vs. "A place no one else knows about"*
→ culture, formality, social-signals
> Universally acclaimed vs. personal discovery.

**76.** `SCENE` — **Friends recommend a hotel. You look it up and it has 4,000 reviews on TripAdvisor.** *"Good — it's validated" vs. "Too many people — I've already lost interest"*
→ culture, social-signals
> Popularity as endorsement vs. popularity as disqualifier.

---

### SECTION 10: ELO EXTENSIONS (New image-based comparisons)

**77.** `ELO` — *[Lobby comparisons: grand palazzo lobby vs. intimate living-room lobby]*
→ volume, formality, scale

**78.** `ELO` — *[Bathroom comparisons: spa-like marble vs. rustic freestanding tub]*
→ formality, temperature, time

**79.** `ELO` — *[View comparisons: city skyline at night vs. vineyard at dawn]*
→ mood, location, culture

**80.** `ELO` — *[Restaurant comparisons: candlelit formal vs. open-kitchen communal table]*
→ formality, temperature, social-energy

**81.** `ELO` — *[Pool comparisons: infinity edge over ocean vs. courtyard plunge pool]*
→ volume, culture, scale

**82.** `ELO` — *[Bedroom comparisons: four-poster canopy vs. platform bed, floor-to-ceiling glass]*
→ time, volume, formality

---

### SECTION 11: IDENTITY & VALUES (What travel means to them)

**83.** `AB` — **Travel to confirm your taste, or to challenge it?**
→ openness, explorer-orientation
> Comfort-zone vs. growth-oriented. Meta-level matching signal.

**84.** `AB` — **You travel to collect experiences, or to be changed by them?**
→ emotional-driver
> Accumulation vs. transformation. Aligns with archetype extraction.

**85.** `AB` — **A trip where everything goes perfectly, or one where something unexpected happens?**
→ spontaneity, control
> Planned perfection vs. serendipity tolerance.

**86.** `MICRO` — **What's the single object you always pack?**
→ AI-extracted personal signals
> Reveals ritual, comfort needs, identity.

**87.** `AB` — **Photographs or memories?**
→ presence, documentation-style
> Capture vs. experience. Relates to Instagram-aesthetic tolerance.

**88.** `AB` — **You'd rather stay at a perfect hotel in a mediocre city, or a mediocre hotel in a perfect city?**
→ location vs. property
> The fundamental Terrazzo question, asked plainly.

---

### SECTION 12: SEASONAL & CONTEXTUAL (Unlock after baseline exists)

**89.** `SCENE` — **It's January. Where do you want to be?** *"Somewhere it's still winter — snow, fireplaces, darkness by 4pm" vs. "Somewhere it's summer — beach, heat, long evenings"*
→ temperature, mood, season
> Lean-in vs. escape seasonal relationship.

**90.** `AB` — **Christmas at a grand hotel, or Christmas in a mountain cabin?**
→ formality, scale, temperature
> Celebratory grandeur vs. intimate warmth.

**91.** `AB` — **Summer in Scandinavia or summer in the Mediterranean?**
→ temperature, culture, mood
> Cool/light/restrained vs. warm/bright/abundant.

**92.** `SCENE` — **Weekend trip, 2 hours from home.** *"Somewhere I've been 10 times and love" vs. "Somewhere I've never been"*
→ novelty vs. loyalty
> Loyalty-driven vs. exploration-driven.

---

### SECTION 13: ADVANCED DISAMBIGUATION (Shown when the system detects flat/ambiguous axes)

These surface when two axes are too close to call, or when a user's profile is internally contradictory.

**93.** `AB` — **Beautiful but uncomfortable, or comfortable but ordinary?**
→ volume vs. wellness, design-priority
> The core design-vs-comfort trade-off.

**94.** `AB` — **A place your friends would be impressed by, or one only you would understand?**
→ social-validation vs. personal-taste
> External vs. internal taste compass.

**95.** `AB` — **Perfectly silent room or sounds of the city drifting in?**
→ volume, location
> Acoustic environment preference, refines the quiet cluster edge cases.

**96.** `AB` — **A hotel that feels like the future, or one that feels timeless?**
→ time
> Cutting-edge vs. eternal. Direct time axis disambiguation.

**97.** `SCENE` — **Two rooms, same price.** *Room A: smaller but with a balcony overlooking the garden. Room B: twice the size, interior-facing, beautifully designed.* **Which?**
→ location, volume, space-priority
> Outdoor connection vs. interior space.

**98.** `AB` — **The room that photographs beautifully, or the room that *feels* beautiful?**
→ authenticity, design-philosophy
> Surface vs. substance. Anti-Instagram-aesthetic signal validation.

**99.** `AB` — **Luxury that whispers or luxury that announces?**
→ formality, volume
> Stealth wealth vs. visible grandeur. Core taste identity.

**100.** `AB` — **A place that changes you, or a place that lets you be exactly who you are?**
→ emotional-driver
> Transformation vs. recognition. The deepest Terrazzo signal.

---

### SECTION 14: RESTAURANT IDENTITY (Where & how you eat)

These questions build a standalone dining taste profile — critical for restaurant matching independent of hotels.

**101.** `AB` — **Counter seat watching the chef, or a corner table with a view?**
→ dining-intimacy, formality, spectacle
> Kitchen-as-theater vs. room-as-stage. Reveals whether food or setting leads.

**102.** `AB` — **Tasting menu (no choices), or order whatever you want?**
→ dining-formality, control, trust
> Surrender to the chef vs. autonomy. Core dining personality signal.

**103.** `AB` — **Loud, packed, electric energy — or hushed, half-empty, every word audible?**
→ dining-volume, social-energy
> Restaurant volume preference often diverges from hotel volume preference.

**104.** `SCENE` — **Two restaurants, same quality.** *Restaurant A: unmarked door, word-of-mouth, no Instagram. Restaurant B: James Beard winner, 3-month waitlist, everyone knows it.* **Which?**
→ dining-discovery, social-validation
> Hidden vs. validated. Tests whether restaurant discovery mirrors hotel discovery style.

**105.** `AB` — **The pasta grandmother's recipe or the pasta reimagined by a young chef?**
→ dining-time, tradition-vs-innovation
> Heritage technique vs. creative reinterpretation.

**106.** `RANK` — **Order these dinner formats:** *Prix fixe tasting / Shared plates for the table / Order your own entrée / Chef's counter omakase*
→ dining-formality, social-style, control
> Full dining format hierarchy in one question.

**107.** `AB` — **Restaurant where the wine list is the point, or where you just say "pick something good"?**
→ dining-formality, expertise, trust
> Wine connoisseur vs. delegator. Beverage program importance.

**108.** `AB` — **A restaurant that changes its menu every day, or one that's served the same 5 dishes for 40 years?**
→ dining-time, novelty, tradition
> Seasonal spontaneity vs. perfected classics.

**109.** `SCENE` — **You're in Tokyo for 4 nights.** *"I've researched and booked all 4 dinners weeks ago" vs. "I'll figure it out when I'm hungry"*
→ dining-planning, spontaneity
> Restaurant planning style — often different from hotel planning style.

**110.** `AB` — **Eat at the hotel restaurant every night, or never eat at the hotel?**
→ dining-exploration, property-containment
> Self-contained vs. neighborhood-driven dining identity.

**111.** `AB` — **A meal where the plating is art, or one where the plate is almost irrelevant?**
→ dining-volume, aesthetics
> Visual dining experience vs. pure flavor focus.

**112.** `MICRO` — **Describe your ideal restaurant in 5 words.**
→ AI-extracted dining signals
> Free-form; AI parses for formality, cuisine, atmosphere, social context.

**113.** `AB` — **A place with paper menus and mismatched chairs, or white tablecloths and heavy silverware?**
→ dining-formality, dining-temperature
> Casual character vs. formal precision.

---

### SECTION 15: BARS & DRINKING (Atmosphere, ritual, discovery)

**114.** `AB` — **Cocktail bar with a 40-page menu, or three taps and a bottle of mezcal?**
→ bar-formality, bar-volume
> Maximalist craft vs. edited simplicity.

**115.** `AB` — **Hotel bar or the bar the concierge wouldn't tell most guests about?**
→ bar-exploration, property-containment
> Convenience vs. discovery applied to nightlife.

**116.** `AB` — **Wine bar where the sommelier picks for you, or a natural wine shop where you browse?**
→ bar-formality, trust, autonomy
> Guided expertise vs. self-directed exploration.

**117.** `SCENE` — **It's 11pm, you're in a city you love.** *"One more drink at a quiet place with good music" vs. "Let's find whatever's happening — I'll sleep when I'm home"*
→ bar-energy, nightlife-orientation
> Wind-down vs. second-wind. Night energy profile.

**118.** `AB` — **Rooftop with a view or basement with a secret?**
→ bar-mood, bar-volume, spectacle
> Visible glamour vs. hidden intimacy.

**119.** `AB` — **A bar where you go for the drinks, or one where you go for the room?**
→ bar-priority, design-sensitivity
> Craft-focused vs. atmosphere-focused drinking.

**120.** `AB` — **Aperitivo hour at a piazza café, or sake at a 6-seat counter in a Tokyo alley?**
→ bar-culture, bar-formality, bar-social
> Open/social/Mediterranean vs. focused/intimate/Asian.

**121.** `RANK` — **Order these drink settings:** *Dive bar with character / Speakeasy / Grand hotel bar / Winery tasting room*
→ bar-formality, bar-volume, bar-culture
> Full nightlife personality hierarchy.

---

### SECTION 16: ACTIVITIES & CULTURE (How you spend your days)

**122.** `AB` — **Guided museum tour with an expert, or wander alone and see what you find?**
→ activity-structure, autonomy, culture-depth
> Curated expertise vs. serendipitous discovery.

**123.** `AB` — **A morning cooking class, or a morning hike?**
→ activity-type, energy, culture
> Skill-building/cultural vs. physical/landscape.

**124.** `AB` — **The contemporary art museum or the ancient ruins?**
→ activity-time, culture
> Modern creative output vs. historical depth.

**125.** `SCENE` — **Free day in a new city.** *"I have a list of 6 things I want to see" vs. "I'll pick a neighborhood and just walk"*
→ activity-planning, spontaneity
> Structured sightseeing vs. ambient exploration.

**126.** `AB` — **Visit a working farm or visit an architect's studio?**
→ activity-type, culture, groundedness
> Agricultural/elemental vs. creative/intellectual.

**127.** `AB` — **A food market at 7am or a flea market at noon?**
→ activity-time, culture, sensory-priority
> Culinary immersion vs. object hunting. Morning person signal.

**128.** `AB` — **A boat you drive yourself, or one with a captain and lunch packed?**
→ activity-formality, autonomy, adventure
> Self-directed adventure vs. serviced experience.

**129.** `AB` — **The thing every tourist does (because it's genuinely great), or the thing no tourist knows about?**
→ activity-discovery, social-validation
> Canonical experience vs. off-radar discovery. Same signal as restaurant Q104 but for activities.

**130.** `RANK` — **Order these afternoon activities:** *Spa treatment / Gallery hopping / Market browsing / Beach or pool / Long lunch that becomes dinner*
→ activity-priority, energy, culture
> Core activity preference hierarchy. Massive signal.

**131.** `AB` — **A sunset you hike to, or a sunset you watch from a terrace with a drink?**
→ activity-energy, formality
> Earned beauty vs. delivered beauty.

**132.** `SCENE` — **The hotel offers two experiences.** *"Private boat to a hidden cove" vs. "Dinner at a local family's home"*
→ activity-type, social-orientation, culture
> Landscape/solitude vs. human/connection.

**133.** `AB` — **Learn something or feel something?**
→ activity-driver, emotional-core
> Intellectual engagement vs. sensory/emotional response.

---

### SECTION 17: SHOPPING & OBJECTS (What you bring home)

**134.** `AB` — **A concept store curated by a designer, or a chaotic antique market?**
→ shopping-formality, shopping-discovery
> Edited taste vs. treasure-hunting.

**135.** `AB` — **You bring home: a handmade ceramic bowl, or a rare book?**
→ shopping-type, sensory-orientation
> Tactile/functional vs. intellectual/collectible.

**136.** `AB` — **A shop where everything is local and made within 50km, or one that curates the best from everywhere?**
→ shopping-culture, provenance
> Place-specific sourcing vs. global curation.

**137.** `SCENE` — **You stumble into a beautiful shop.** *"I buy something because it'll remind me of this moment" vs. "I rarely buy things — I collect experiences, not objects"*
→ shopping-orientation, materialism
> Souvenir-maker vs. experience-purist. Critical for whether to even recommend shops.

**138.** `AB` — **Flagship store of a brand you love, or a studio visit with the maker?**
→ shopping-formality, authenticity
> Brand loyalty vs. origin story.

**139.** `AB` — **Vintage or new?**
→ shopping-time
> Patina and history vs. contemporary design. Mirrors hotel time axis.

**140.** `RANK` — **Order these finds:** *A perfect linen shirt / A hand-thrown mug by a local potter / A first-edition book / A bottle of wine you can't get at home*
→ shopping-type, sensory-priority
> Object preference hierarchy reveals what "taste" means materially.

**141.** `AB` — **A neighborhood with great shops, or one with no shops but beautiful architecture?**
→ shopping-importance, design-vs-commerce
> Whether shopping is part of the travel experience or irrelevant to it.

---

### SECTION 18: NEIGHBORHOOD & STREET FEEL (The texture of a place)

**142.** `AB` — **Narrow winding streets or wide tree-lined boulevards?**
→ neighborhood-scale, neighborhood-volume
> Intimate/organic vs. grand/structured. Maps to hotel volume but for streets.

**143.** `AB` — **A neighborhood where you hear 5 languages, or one where everyone's local?**
→ neighborhood-culture, cosmopolitan-vs-rooted
> Global melting pot vs. deeply local character.

**144.** `AB` — **Graffiti and skate shops, or ivy and iron gates?**
→ neighborhood-formality, neighborhood-time
> Creative/raw/young vs. established/refined/heritage.

**145.** `SCENE` — **Two neighborhoods, same city.** *Neighborhood A: all the best restaurants just opened here, creative studios, slightly rough around the edges. Neighborhood B: beautiful old buildings, established cafés, the locals have been here for generations.* **Where do you want your hotel?**
→ neighborhood-time, neighborhood-energy, culture
> Emerging vs. established. Cutting edge vs. rooted.

**146.** `AB` — **A street with a great bakery, bookshop, and wine bar — or one with a view that stops you?**
→ neighborhood-priority, amenity-vs-beauty
> Walkable utility vs. scenic drama.

**147.** `AB` — **A neighborhood that's busy at 8am, or one that comes alive at 10pm?**
→ neighborhood-energy, temporal-orientation
> Morning culture vs. night culture. Affects restaurant, bar, and activity matching.

**148.** `AB` — **Pedestrian-only cobblestones, or a buzzy avenue with taxis and café terraces?**
→ neighborhood-volume, neighborhood-energy
> Quiet/preserved vs. alive/urban.

**149.** `MICRO` — **Name a neighborhood anywhere in the world that feels like "you."**
→ AI-extracted neighborhood signals
> Free-form. AI cross-references known neighborhood character profiles.

**150.** `AB` — **A place where you need a car, but it's worth it — or walkable above all else?**
→ neighborhood-accessibility, property-vs-location
> Destination-property tolerance vs. walkability as non-negotiable.

---

### SECTION 19: CROSS-DOMAIN CONSISTENCY CHECKS (Does taste transfer?)

These questions test whether a user's hotel taste predicts their restaurant/bar/activity taste — or whether they diverge. Divergence is itself a powerful signal.

**151.** `SCENE` — **Your hotel is minimal, quiet, Aman-style.** *For dinner, do you want: "Something equally restrained — a 10-seat kaiseki counter" vs. "The opposite — a loud, chaotic, family-run trattoria"*
→ cross-domain-consistency, dining-contrast
> Same taste across domains, or deliberate contrast-seeking?

**152.** `SCENE` — **You're at a grand formal hotel.** *Your ideal bar that night: "The hotel's own cocktail bar — chandeliers, piano" vs. "A divey local spot 10 minutes away"*
→ cross-domain-consistency, bar-contrast
> Matching formality vs. code-switching.

**153.** `AB` — **Everything in one taste register all day — or you like contrast between morning and night?**
→ cross-domain-consistency, variety-seeking
> Tonal consistency vs. dynamic range across a day.

**154.** `SCENE` — **You love modern minimalist hotels. The best restaurant near your hotel is a maximalist Baroque dining room with gold leaf and candelabras.** *"I'd go — great food is great food" vs. "I'd find somewhere more my speed"*
→ cross-domain-flexibility, food-vs-atmosphere
> Whether aesthetic tolerance is domain-specific or absolute.

**155.** `AB` — **A day where everything matches — the hotel, the lunch spot, the gallery, all the same vibe — or a day of surprises and contrast?**
→ cross-domain-coherence, serendipity
> Curated consistency vs. varied texture across a day.

---

## Signal Architecture Notes

### How these map back to the engine:

1. **AB / SLIDER / SCENE** → Each option maps to a small delta on 1-3 taste axes. Accumulated over many questions, these deltas sharpen the user's 6D position.

2. **RATE (image)** → Works like a mini Elo round against a neutral baseline. "Love" = strong positive, "Not me" = rejection signal, "Neutral" = no update.

3. **ELO (image battle)** → Same engine as onboarding Phase 9, but with new image sets (lobbies, bathrooms, pools, restaurants, views, bedrooms). Can extend DESIGNER_POOL or use a new SPACES_POOL.

4. **MICRO (open-ended)** → Sent to the LLM with the taste ontology prompt for signal extraction, same as conversational phases.

5. **RANK** → Ordinal ranking of 3-4 options. Position maps to weighted signals (1st = 0.9 confidence, 2nd = 0.6, 3rd = 0.3, 4th = rejection).

### New signal dimensions introduced:

**From original sections (1-13):**
- **Novelty vs. loyalty** (do they return or explore?)
- **Social validation** (do they care if others approve?)
- **Acoustic preference** (silence vs. ambient)
- **Seasonal orientation** (lean-in vs. escape)
- **Documentation style** (capture vs. presence)
- **Property vs. destination** (which matters more?)
- **Comfort vs. beauty trade-off**

**From expanded sections (14-19):**
- **Dining formality** (omakase → shared plates → street food)
- **Dining volume** (hushed → electric)
- **Dining discovery** (reservations-months-ahead vs. walk-in-only)
- **Dining planning** (researched vs. spontaneous)
- **Kitchen visibility** (counter-seat vs. corner-table)
- **Tradition vs. innovation** (grandmother's recipe vs. young chef's reimagining)
- **Bar energy** (wind-down vs. second-wind)
- **Bar formality** (grand hotel bar → speakeasy → dive)
- **Activity structure** (guided tour vs. aimless wander)
- **Activity type** (intellectual/cultural vs. physical/landscape vs. sensory/culinary)
- **Activity driver** (learn something vs. feel something)
- **Shopping orientation** (souvenir-maker vs. experience-purist)
- **Shopping provenance** (local-only vs. globally curated)
- **Neighborhood scale** (narrow alleys vs. wide boulevards)
- **Neighborhood temporal energy** (morning culture vs. night culture)
- **Cross-domain consistency** (same taste everywhere vs. deliberate contrast-seeking) — this is one of the most powerful new signals, as it determines whether hotel taste can be projected onto restaurant/bar matching or whether each domain needs independent profiling

### Gamification hooks:
- **Mosaic completeness %** — per-domain: "Your hotel taste: 78%. Restaurant taste: 34%. A few more questions will sharpen your dining matches."
- **Domain unlock animations** — When enough signal accumulates for a domain, show a reveal: "Your restaurant profile is now active — we can match you to dining."
- **Axis unlock animations** — When enough signal accumulates on an axis, show a satisfying reveal: "Your design axis is now refined to ±0.05"
- **Streak rewards** — "5-day streak! Your profile is now sharper than 90% of travelers."
- **New question unlocks** — Sections 12-13 only appear once baseline is strong enough to make disambiguation meaningful.
- **Cross-domain insight cards** — When consistency checks reveal a pattern: "Interesting — you like quiet hotels but loud restaurants. We'll match you differently for each."
- **Taste evolution** — Show how axes have shifted over time: "Your formality axis moved 12% toward casual over the last month."

### Domain coverage map:

| Domain | Sections | Questions | Key new axes |
|--------|----------|-----------|-------------|
| Hotels & rooms | 1-8, 10, 12-13 | 1-100 | Original 6 axes + texture, acoustic |
| Restaurants | 3 (partial), 14 | 25-32, 101-113 | Dining formality, volume, discovery, planning, tradition |
| Bars & drink | 14, 15 | 107, 114-121 | Bar energy, bar formality, bar mood |
| Activities & culture | 16 | 122-133 | Activity structure, type, driver |
| Shopping & objects | 17 | 134-141 | Shopping orientation, provenance, time |
| Neighborhoods | 4 (partial), 18 | 33-40, 142-150 | Neighborhood scale, energy, temporal |
| Cross-domain | 19 | 151-155 | Consistency, contrast-seeking, flexibility |
