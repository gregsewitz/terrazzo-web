# Expanded Onboarding Questions — v2

> Signal-rich questions organized by category. Each includes modality, signal
> outputs, and domain mapping. Questions marked 🔺 serve double-duty as
> consistency validators. Questions marked 📷 need image assets.
>
> **Design principle:** Length is fine if every question earns new signal. No
> filler. Every question should move the taste vector somewhere it couldn't go
> from the questions before it.

---

## A. BEHAVIORAL ANCHORING PHASE

> **Why a dedicated phase?** Aspirational bias is the single biggest threat to
> taste accuracy. People tell you who they *wish* they were, not who they are.
> A dedicated "tell me about your last trip" phase forces concrete recall and
> creates a behavioral baseline we can triangulate against every other signal.
>
> **Framing:** "Think about your most recent trip — not your dream trip, the
> one that actually happened."
>
> **Suggested placement:** Early Act 1 (phase 4 or 5), before the voice
> conversations where aspirational bias peaks.

### BA1 — Morning Recall 🔺
**Modality:** quick-choice (pick 1)
**Prompt:** "Your last trip. What did you *actually* do first thing most mornings?"
**Options:**
- "Worked out — gym, run, swim, yoga"
- "Walked to a café nearby"
- "Room service or hotel breakfast, no rush"
- "Slept in — I was on vacation"
- "Grabbed coffee and got out the door — things to see"
**Signals:** `Active-morning-actual`, `Local-café-actual`, `In-hotel-morning-actual`, `Sleep-in-actual`, `Early-explorer-actual`
**Domain:** Wellness + Atmosphere
**🔺 Validates:** Instinct-round "Morning ritual" A/B (room service vs local café). 5 options instead of 2 catches the middle ground most people actually occupy.

### BA2 — Where You Actually Ate 🔺
**Modality:** quick-choice (pick 2)
**Prompt:** "Same trip. Where did you eat most of your meals?"
**Options:**
- "Restaurants I'd researched before the trip"
- "Places I found walking around"
- "Whatever the hotel concierge recommended"
- "The hotel restaurant — it was good enough"
- "Street food, markets, casual spots"
- "A mix — nice dinners out, casual everything else"
**Signals:** `Pre-researched-eater-actual`, `Wanderer-eater-actual`, `Concierge-trust-actual`, `Hotel-diner-actual`, `Street-food-actual`, `Mixed-strategy-actual`
**Domain:** FoodDrink
**🔺 Validates:** Q1 (Dining Discovery Style) — reservation planner vs taxi-driver asker. This catches the actual pattern.

### BA3 — Room Time Reality 🔺
**Modality:** slider
**Left:** "I was barely in the room — just to sleep"
**Right:** "I spent serious time there — it was part of the trip"
**Signals left:** `Room-as-bed-actual`, `Exterior-focused-actual`
**Signals right:** `Room-dweller-actual`, `Interior-focused-actual`
**Domain:** Design + Atmosphere
**🔺 Validates:** People who obsess over room details in force-rank but actually spend 15 minutes a day in the room. Catches over-indexing on room aesthetics.

### BA4 — How You Found It
**Modality:** quick-choice (pick 1)
**Prompt:** "How did you actually find the last hotel you booked?"
**Options:**
- "A friend or someone I trust recommended it"
- "I saw it on Instagram or a blog"
- "I searched on a booking site and filtered"
- "A travel advisor or concierge booked it"
- "I'd been there before"
- "I read an article or list about the destination"
**Signals:** `Word-of-mouth-booker`, `Social-media-discovery`, `Booking-site-filter`, `Advisor-dependent`, `Repeat-visitor`, `Editorial-influenced`
**Domain:** Core
**Note:** Discovery channel reveals trust architecture — critical for Terrazzo's own positioning.

### BA5 — The Splurge Recall 🔺
**Modality:** quick-choice (pick 1)
**Prompt:** "What did you end up spending the most *unexpected* money on?"
**Options:**
- "The room upgrade — I couldn't resist"
- "Restaurants and drinks"
- "An experience — a tour, a boat, something special"
- "Shopping — I always come home with things"
- "Nothing really — I stuck to the plan"
- "Getting around — taxis, drivers, flights between places"
**Signals:** `Upgrade-spender-actual`, `Food-spender-actual`, `Experience-spender-actual`, `Shopping-spender-actual`, `Budget-disciplined-actual`, `Logistics-spender-actual`
**Domain:** Core
**🔺 Validates:** Q15 (Where the Money Goes force-rank). Aspirational allocation vs actual wallet behavior.

### BA6 — The One Regret
**Modality:** quick-choice (pick 1)
**Prompt:** "One thing you'd do differently about that trip?"
**Options:**
- "Stay longer"
- "Spend more on the hotel"
- "Spend less on the hotel and more on experiences"
- "Plan less — I over-scheduled"
- "Plan more — I wasted time figuring things out"
- "Honestly, nothing — it was great"
**Signals:** `Length-regret`, `Upgrade-regret`, `Rebalance-to-experiences`, `Over-planned-actual`, `Under-planned-actual`, `Satisfied-traveler`
**Domain:** Core
**🔺 Validates:** Q13 (Planning Horizon) — the hyper-planner who regrets over-scheduling is a powerful contradiction signal.

### BA7 — Who Were You With
**Modality:** quick-choice (pick 1)
**Prompt:** "Who did you travel with?"
**Options:**
- "Partner"
- "Family with kids"
- "Friends"
- "Solo"
- "Work colleagues / work trip"
**Signals:** `Partner-traveler`, `Family-traveler`, `Friends-traveler`, `Solo-traveler`, `Business-traveler`
**Domain:** Core
**Note:** Companion context changes everything about what "good" means. A family traveler ranking silence #1 means something very different than a solo traveler doing the same.

---

## B. FOOD & DRINK DEPTH

### FD1 — Dining Discovery Style
**Modality:** cards (A/B)
**Prompt:** "You land in a city you've never been to. Dinner tonight:"
**A:** "I already have a reservation — booked it 3 weeks ago"
**B:** "I'll ask the taxi driver"
**Signals A:** `Restaurant-planner`, `Research-driven-eater`, `Control-over-spontaneity`
**Signals B:** `Spontaneous-diner`, `Local-trust`, `Adventure-eater`
**Domain:** FoodDrink
**🔺 Validates:** Cross-checks against emotional-core "discover something unexpected" choice

### FD2 — Cuisine Compass 📷
**Modality:** swipe (images)
**Prompt:** "Saturday night — where are you going?"
**A:** [Image: intimate Japanese omakase counter, 8 seats, cypress wood]
**B:** [Image: lively Italian trattoria, red checkered cloths, open kitchen, families]
**Signals A:** `Precision-dining`, `Counter-culture`, `Japanese-aesthetic-drawn`
**Signals B:** `Convivial-dining`, `Italian-warmth`, `Family-energy`
**Domain:** FoodDrink

### FD3 — Breakfast Reveals Everything
**Modality:** force-rank (pick top 2)
**Prompt:** "Your ideal hotel breakfast:"
**Options:**
- "Fresh pastries left at the door in a paper bag"
- "Long buffet — eggs made to order, fresh juice bar, the works"
- "Quiet table, one perfect coffee, nothing else needed"
- "Skip it — I'll find a café in the neighborhood"
- "Full spread on a terrace with a view"
**Domain:** FoodDrink + Service

### FD4 — Wine & Drink Philosophy
**Modality:** slider
**Left:** "I know exactly what I want to drink"
**Right:** "Surprise me — dealer's choice"
**Signals left:** `Drink-connoisseur`, `Specific-palate`
**Signals right:** `Drink-delegator`, `Trust-the-sommelier`
**Domain:** FoodDrink

### FD5 — Kitchen Proximity
**Modality:** cards (A/B)
**Prompt:** "The hotel restaurant:"
**A:** "I want to see the kitchen — open fire, chefs working, the energy of it"
**B:** "I want to forget the kitchen exists — just the plate arriving perfectly"
**Signals A:** `Open-kitchen-drawn`, `Process-interested`, `Theater-of-cooking`
**Signals B:** `Presentation-focused`, `Seamless-service`, `Outcome-oriented`
**Domain:** FoodDrink + Service

### FD6 — Meal as Event
**Modality:** slider
**Left:** "Dinner should be 45 minutes — I have things to do"
**Right:** "Dinner is the main event — 3 hours, 7 courses, wine pairings"
**Signals left:** `Efficient-eater`, `Meal-as-fuel`
**Signals right:** `Dining-ritualist`, `Meal-as-performance`
**Domain:** FoodDrink + Atmosphere

### FD7 — The Market Test
**Modality:** scene (4 options)
**Prompt:** "You stumble onto an incredible local food market. You:"
**Options:**
- "Buy ingredients and ask the hotel if I can use their kitchen"
- "Try everything — this is why I travel"
- "Take photos but eat somewhere proper later"
- "Find the one stall everyone's lining up at"
**Signals:** `Cook-on-vacation`, `Grazer-explorer`, `Visual-collector`, `Crowd-signal-follower`
**Domain:** FoodDrink + Character

---

## C. SENSORY PROFILE

### SP1 — Sound of a Place
**Modality:** scene (4 options)
**Prompt:** "Close your eyes. Which place are you in?"
**Options:**
- "Waves, distant wind, silence between them"
- "Espresso machines, low conversation, a spoon against ceramic"
- "Birdsong, rustling leaves, a creek somewhere"
- "Music from somewhere — live, not a speaker — glasses clinking"
**Signals:** `Coastal-silence`, `Café-culture-ambient`, `Nature-immersion`, `Social-music-energy`
**Domain:** Atmosphere
**🔺 Validates:** Silence-sensitive from force-rank. 4 options gives much richer signal than A/B — someone who ranked silence #1 might pick café here (urban quiet ≠ nature quiet).

### SP2 — Temperature as Taste 📷
**Modality:** swipe (images)
**Prompt:** "Which room pulls you in?"
**A:** [Image: warm room — amber light, fireplace, heavy curtains, wool throw]
**B:** [Image: cool room — white linen, cross-breeze, open shutters, sea light]
**Signals A:** `Warm-enclosure`, `Cocoon-seeker`, `Interior-focused`
**Signals B:** `Airflow-obsessed`, `Light-over-warmth`, `Open-element`
**Domain:** Design + Atmosphere

### SP3 — Scent Memory
**Modality:** quick-choice (pick 2 of 6)
**Prompt:** "Which smell instantly transports you?"
**Options:**
- "Woodsmoke and cold air"
- "Salt water and sunscreen"
- "Fresh linen, just out of the sun"
- "Coffee and warm bread"
- "Jasmine at night"
- "Old books and stone"
**Domain:** Atmosphere + Setting
**Note:** Playful but reveals climate/setting/atmosphere through sensory memory

### SP4 — Light Quality
**Modality:** scene (4 options)
**Prompt:** "Your favorite light:"
**Options:**
- "Early morning — that pale blue before the sun is fully up"
- "Midday Mediterranean — hard shadows, white walls, blinding"
- "Golden hour — everything warm, long shadows"
- "Candlelight and dusk — the world getting softer"
**Signals:** `Dawn-drawn`, `Mediterranean-brightness`, `Golden-hour-romantic`, `Evening-mood`
**Domain:** Atmosphere + Design

### SP5 — Texture Instinct
**Modality:** force-rank (pick top 3)
**Prompt:** "Which textures matter most to you in a space?"
**Options:**
- "Cool stone underfoot"
- "Soft, heavy linen"
- "Warm wood surfaces"
- "Rough plaster walls"
- "Polished concrete"
- "Woven rattan or cane"
- "Thick wool or cashmere"
**Signals:** `Stone-drawn`, `Linen-tactile`, `Wood-warmth`, `Plaster-wabi-sabi`, `Concrete-modernist`, `Woven-tropical`, `Textile-luxury`
**Domain:** Design

---

## D. WELLNESS & BODY

### WB1 — Pool Philosophy 📷
**Modality:** cards (images)
**Prompt:** "Your pool:"
**A:** [Image: natural plunge pool cut into rock, cold water, wilderness]
**B:** [Image: heated infinity pool, loungers, attendant with towels]
**Signals A:** `Wild-swimming`, `Cold-water`, `Landscape-immersion`
**Signals B:** `Pool-as-luxury`, `Attended-comfort`, `Classic-resort`
**Domain:** Wellness + Service

### WB2 — Spa vs No Spa
**Modality:** scene (4 options)
**Prompt:** "Free afternoon at the hotel:"
**Options:**
- "Book a treatment — this is what hotels are for"
- "I've literally never used a hotel spa"
- "Depends — if it's a hammam or onsen, absolutely. Generic spa, no."
- "I'd rather find a local bathhouse than use the hotel's"
**Signals:** `Spa-user`, `Spa-indifferent`, `Specific-spa-seeker`, `Local-wellness-seeker`
**Domain:** Wellness
**Note:** 4 options catches the "conditional spa person" — a huge middle ground the A/B missed.

### WB3 — Movement Style
**Modality:** quick-choice (pick 2)
**Prompt:** "How do you move your body on vacation?"
**Options:**
- "Run or walk — I explore by covering distance"
- "Swim — ocean, pool, lake, whatever's available"
- "Yoga or stretching — I need to reset"
- "Hiking or outdoor activity with purpose"
- "I don't — vacation means not exercising"
- "Whatever the place offers — surfing, tennis, biking"
**Signals:** `Run-explorer`, `Swimmer`, `Yoga-traveler`, `Hiker-adventurer`, `Exercise-free-vacation`, `Activity-opportunist`
**Domain:** Wellness

### WB4 — Sleep Priority
**Modality:** slider
**Left:** "I can sleep anywhere — it barely matters"
**Right:** "Sleep quality makes or breaks the trip"
**Signals left:** `Sleep-flexible`, `Adaptable-sleeper`
**Signals right:** `Sleep-obsessive`, `Bed-non-negotiable`
**Domain:** Wellness + Design
**🔺 Validates:** Bed/textiles ranking in force-rank. Catches people who rank bed #1 aspirationally but actually sleep fine anywhere.

---

## E. TRAVEL RHYTHM & PACE

### TR1 — Day 3 Test 🔺
**Modality:** scene (4 options)
**Prompt:** "Day 3 of a week-long trip. You've done a lot. Today you:"
**Options:**
- "Keep going — I'll rest when I'm home"
- "Take the morning off, then head out after lunch"
- "Full rest day — pool, book, nowhere to be"
- "Leave the hotel entirely — rent a car, take a day trip, change the scenery"
**Signals:** `Pace-maximizer`, `Half-day-rest`, `Full-rest-day`, `Scene-changer`
**Domain:** Atmosphere
**🔺 Validates:** "Packed vs slow" from instinct-round. 4 options catches the nuanced middle (most people are the half-day type but answer aspirationally in either direction).

### TR2 — Length of Stay Instinct
**Modality:** slider
**Left:** "2-3 nights per city — keep moving"
**Right:** "A full week — I need to settle in"
**Signals left:** `City-hopper`, `Variety-seeker`
**Signals right:** `Deep-dwell`, `Slow-immersion`
**Domain:** Character

### TR3 — Planning Style
**Modality:** scene (4 options)
**Prompt:** "Your trip planning approach:"
**Options:**
- "Spreadsheet. Restaurants, times, backup options, driving distances."
- "I know the hotel and the flights. Everything else is day-of."
- "I hire someone — a travel advisor handles it."
- "My partner/friend plans. I show up."
**Signals:** `Hyper-planner`, `Loose-framework`, `Advisor-delegator`, `Passive-traveler`
**Domain:** Core
**Note:** 4 options catches the delegator and the passive traveler — both surprisingly common and signal-rich.

### TR4 — Jet Lag Morning
**Modality:** scene (4 options)
**Prompt:** "You wake up at 5:30am, wide awake, jet-lagged. You:"
**Options:**
- "Go for a walk — the city at dawn is magic"
- "Order room service and watch the sunrise from bed"
- "Find the gym or pool — burn it off"
- "Read, reply to emails, ease in slowly"
**Signals:** `Dawn-explorer`, `In-room-comfort`, `Active-coper`, `Slow-adjustor`
**Domain:** Atmosphere + Wellness

### TR5 — Return vs. New
**Modality:** slider
**Left:** "I almost never go back to the same place"
**Right:** "I have places I return to every year"
**Signals left:** `Novelty-seeker`, `One-and-done`
**Signals right:** `Loyalty-returner`, `Depth-over-breadth`
**Domain:** Core
**🔺 Validates:** Emotional-core "discover something unexpected" vs "come home changed." The novelty seeker who returns annually has a complicated relationship with discovery.

---

## F. BUDGET & VALUE PERCEPTION

### BV1 — Value Equation
**Modality:** scene (A/B)
**Prompt:** "Two hotels in the same city, same dates:"
**A:** "$300/night — beautiful, great reviews, slightly outside the center"
**B:** "$800/night — extraordinary, in the heart of everything, once-in-a-lifetime"
**Signals A:** `Value-conscious`, `Smart-splurge`, `Location-flexible`
**Signals B:** `Experience-over-price`, `Splurge-for-exceptional`, `Location-premium`
**Domain:** Core
**Note:** Not about income — about allocation philosophy.

### BV2 — Where the Money Goes
**Modality:** force-rank (pick top 2)
**Prompt:** "If you could upgrade one thing on your next trip:"
**Options:**
- "The room — bigger, better view, nicer hotel"
- "The food — best restaurants, private dining"
- "The experience — helicopter, private guide, access"
- "The flight — business class, lounge, the journey itself"
- "More days — extend the trip, nowhere to rush back to"
**Domain:** Core

### BV3 — The Upgrade Moment
**Modality:** scene (4 options)
**Prompt:** "At check-in, they offer an upgrade to a suite for $200 more per night. You:"
**Options:**
- "Yes, immediately — life's short"
- "Can I see it first?"
- "What's the suite actually like? I need to know it's worth it"
- "No — I researched my room, I want what I booked"
**Signals:** `Impulse-upgrader`, `Visual-confirmer`, `Value-analyzer`, `Plan-committed`
**Domain:** Core + Service

---

## G. ARCHITECTURAL & DESIGN DEPTH 📷

### AD1 — Period Instinct 📷
**Modality:** swipe (images)
**Prompt:** "Which building draws you in?"
**A:** [Image: Art Deco hotel — geometric metalwork, terrazzo, jewel tones]
**B:** [Image: Brutalist concrete — raw surfaces, dramatic cantilevers, light wells]
**Signals A:** `Art-Deco-drawn`, `Ornamental-precision`, `Glamour-period`
**Signals B:** `Brutalist-drawn`, `Raw-material`, `Structural-drama`
**Domain:** Design

### AD2 — Conversion vs Purpose-Built 📷
**Modality:** cards (images)
**Prompt:** "Where would you rather sleep?"
**A:** [Image: converted monastery — cloisters, stone arches, modern furniture in medieval shell]
**B:** [Image: purpose-built — cantilevered over a landscape, glass and steel]
**Signals A:** `Adaptive-reuse`, `Layered-history`, `Imperfection-lover`
**Signals B:** `Architectural-intent`, `Clean-vision`, `Site-specific-modernism`
**Domain:** Design + Character
**🔺 Validates:** Mosaic Q39 (converted palazzo vs starchitect)

### AD3 — Color Temperature 📷
**Modality:** swipe (images)
**Prompt:** "Your room:"
**A:** [Image: warm palette — terracotta, ochre, aged brass, warm wood]
**B:** [Image: cool palette — grey stone, white plaster, pale blue, matte black]
**Signals A:** `Warm-palette`, `Earth-tones`, `Mediterranean-drawn`
**Signals B:** `Cool-palette`, `Mineral-tones`, `Scandinavian-drawn`
**Domain:** Design

### AD4 — Scale & Proportion 📷
**Modality:** swipe (images)
**Prompt:** "Which space feels right?"
**A:** [Image: vast lobby — double-height ceiling, monumental staircase, dramatic negative space]
**B:** [Image: intimate entry — low ceiling, warm nook, human-scaled everything]
**Signals A:** `Grand-scale-drawn`, `Monumental-space`, `Drama-seeker`
**Signals B:** `Human-scale`, `Intimacy-in-architecture`, `Cozy-proportion`
**Domain:** Design + Atmosphere

### AD5 — Old vs New Layer 📷
**Modality:** swipe (images)
**Prompt:** "Which renovation approach?"
**A:** [Image: restored to period — crystal chandeliers, damask wallpaper, gilt mirrors, everything as it was]
**B:** [Image: original shell, radically modern interior — exposed beams + minimalist furniture + neon art]
**Signals A:** `Period-restoration`, `Heritage-purist`, `Ornament-appreciator`
**Signals B:** `Contrast-layering`, `Old-new-tension`, `Contemporary-insertion`
**Domain:** Design + Character

### AD6 — Indoor-Outdoor Relationship
**Modality:** scene (4 options)
**Prompt:** "The boundary between inside and outside:"
**Options:**
- "Should disappear — sliding walls, no glass, fully open to the air"
- "Big windows, but clearly inside — I want the view without the bugs"
- "Thick walls, small windows — the room is a refuge from outside"
- "A courtyard — the outside is brought inside, contained"
**Signals:** `Open-air-obsessed`, `View-seeker-protected`, `Cocoon-builder`, `Courtyard-dweller`
**Domain:** Design + Setting

---

## H. CULTURAL IMMERSION

### CI1 — Language & Locals
**Modality:** scene (4 options)
**Prompt:** "You're in a country where you don't speak the language:"
**Options:**
- "I love it — pointing, gesturing, Google Translate, it's part of the adventure"
- "I need enough English speakers around to feel comfortable"
- "I'll learn a few phrases — I want to try"
- "I hire a local guide who can bridge the gap"
**Signals:** `Language-adventurer`, `English-baseline-needed`, `Phrase-learner`, `Guide-dependent`
**Domain:** Character

### CI2 — Tourist Infrastructure
**Modality:** slider
**Left:** "Well-traveled — good infrastructure, reliable, easy"
**Right:** "Barely on the map — figuring it out is half the point"
**Signals left:** `Infrastructure-valued`, `Reliability-first`
**Signals right:** `Pioneer-traveler`, `Friction-as-adventure`
**Domain:** Setting

### CI3 — Cultural Depth
**Modality:** scene (4 options)
**Prompt:** "You have a free day in Kyoto. You:"
**Options:**
- "Visit the temples everyone talks about — they're famous for a reason"
- "Find a neighborhood nobody mentions and just walk"
- "Book a private tea ceremony or cooking class"
- "Go where the hotel recommends — they know best"
**Signals:** `Landmark-visitor`, `Neighborhood-wanderer`, `Cultural-experience-seeker`, `Hotel-guided`
**Domain:** Character + Setting

### CI4 — Local vs International
**Modality:** cards (A/B)
**Prompt:** "The hotel bar:"
**A:** "Full of locals — you're the only tourist"
**B:** "International mix — interesting people from everywhere"
**Signals A:** `Local-integration`, `Authenticity-seeker`
**Signals B:** `Cosmopolitan-mix`, `International-energy`
**Domain:** Character + Atmosphere

---

## I. DEAL-BREAKERS & NON-NEGOTIABLES

### DN1 — What Would Ruin It
**Modality:** quick-choice (pick 3 of 8)
**Prompt:** "Which of these would genuinely ruin a stay?"
**Options:**
- "Noisy room — traffic, hallway, neighboring rooms"
- "Bad bed — too soft, too hard, wrong pillows"
- "Rude or indifferent staff"
- "Ugly or poorly designed room"
- "Bad food with no good alternatives nearby"
- "Weak wifi"
- "No natural light in the room"
- "Far from anything interesting"
**Signals:** Multi-signal based on selections
**Domain:** Cross-domain
**Note:** Negative signals are often stronger than positive ones. What you reject defines taste more sharply than what you like.

### DN2 — The Compromise
**Modality:** force-rank (pick top 2 to sacrifice)
**Prompt:** "Your dream hotel has everything *except* — which 2 could you live without?"
**Options:**
- "Pool"
- "Restaurant on site"
- "Room service"
- "Gym / fitness"
- "Concierge / front desk help"
- "Bathtub (shower only)"
- "Minibar"
**Signals:** Each unranked item = `{item}-dispensable`
**Domain:** Cross-domain
**Note:** What you're willing to give up is more diagnostic than what you want. Everyone wants everything.

### DN3 — The Trade-Off
**Modality:** cards (A/B)
**Prompt:** "You can only have one:"
**A:** "Perfect location, average hotel"
**B:** "Average location, extraordinary hotel"
**Signals A:** `Location-over-property`, `Context-first`
**Signals B:** `Property-over-location`, `Destination-in-itself`
**Domain:** Setting + Design

---

## J. SCENARIO DEPTH

### SC1 — Rain Day
**Modality:** scene (4 options)
**Prompt:** "It's raining all day on your beach vacation. You:"
**Options:**
- "Find a museum, gallery, or market — rain is an excuse to explore differently"
- "This is why I picked a hotel with a great bar and a library"
- "Put on a raincoat and go anyway — I'm not made of sugar"
- "Spa, movie, room service — lean into it"
**Signals:** `Rain-explorer`, `Hotel-as-refuge`, `Weather-indifferent`, `Indoor-indulger`
**Domain:** Atmosphere + Character

### SC2 — The Fully Booked Restaurant
**Modality:** scene (4 options)
**Prompt:** "The restaurant you wanted most is fully booked. You:"
**Options:**
- "Show up anyway and wait at the bar — something always opens up"
- "Ask the hotel concierge to pull strings"
- "Find somewhere else — there's always another great place"
- "This is why I book restaurants before I book flights"
**Signals:** `Persistent-optimist`, `Concierge-leverager`, `Adaptable-eater`, `Advance-planner`
**Domain:** FoodDrink + Core

### SC3 — The Wedding Surprise
**Modality:** scene (4 options)
**Prompt:** "You arrive and discover the hotel is hosting a 200-person wedding this weekend."
**Options:**
- "That sounds fun — weddings mean good energy"
- "I'm annoyed but I'll deal — noise-canceling headphones"
- "I'm asking for a different room, far from the event"
- "I'm changing hotels"
**Signals:** `Social-energy-positive`, `Tolerant-adapter`, `Quiet-seeker-negotiator`, `Non-negotiable-quiet`
**Domain:** Atmosphere
**🔺 Validates:** Silence/crowd signals. The person who ranked silence #1 but says "sounds fun" here is more socially flexible than their ranking suggests.

### SC4 — Checkout Day
**Modality:** scene (4 options)
**Prompt:** "It's checkout day. Flight's not until 8pm. You:"
**Options:**
- "Negotiate late checkout — I'm not leaving this room until I have to"
- "Check out, leave bags, explore the neighborhood one last time"
- "Head to the airport early — I like being ahead of schedule"
- "Book a day room at a different hotel near the airport"
**Signals:** `Late-checkout-negotiator`, `Last-minute-explorer`, `Airport-buffer`, `Logistics-optimizer`
**Domain:** Core + Atmosphere

### SC5 — The Empty Hotel
**Modality:** cards (A/B)
**Prompt:** "You arrive at a beautiful hotel and realize you might be the only guest."
**A:** "Paradise — this is the dream"
**B:** "Actually unsettling — I want some life around me"
**Signals A:** `Solitude-lover`, `Empty-hotel-dream`
**Signals B:** `Social-baseline-needed`, `Ambient-human-energy`
**Domain:** Atmosphere + Character

---

## K. CONSISTENCY VALIDATORS

### CV1 — The Honesty Trap (formality) 🔺
**Modality:** scene (4 options)
**Prompt:** "Be honest. You walk into a hotel and everyone is in linen and loafers. You're in sneakers and a hoodie. You feel:"
**Options:**
- "Underdressed — I should have checked the vibe"
- "Totally fine — I don't dress for hotels"
- "I'd never be in sneakers and a hoodie at a nice hotel"
- "Slightly self-conscious but I'd get over it in 5 minutes"
**Signals:** `Formality-aware`, `Formality-indifferent`, `Always-dressed`, `Mild-code-awareness`
**🔺 Validates:** Service-style formality slider. The "casual" slider who'd never be in sneakers is aspirationally casual.

### CV2 — The Comfort Paradox (design vs comfort) 🔺
**Modality:** scene (A/B)
**Prompt:** "The most beautiful room you've ever seen. But the bed is just okay, the shower is weak, and there's no blackout curtain."
**A:** "I'd still stay — I'd sleep anywhere for a room like that"
**B:** "Beautiful doesn't matter if I can't sleep"
**Signals A:** `Design-over-comfort-confirmed`, `Aesthetic-priority`
**Signals B:** `Comfort-non-negotiable`, `Functional-first`
**🔺 Validates:** Force-rank detail priorities. Someone who ranked bed #1 but picks A is aspirationally design-forward but actually comfort-driven.

### CV3 — The Crowd Test (solitude) 🔺
**Modality:** scene (A/B)
**Prompt:** "Dream hotel, dream location. But it's peak season — fully booked, pool is packed, restaurant needs reservations 3 days ahead."
**A:** "Fine — popular for a reason, I can handle crowds"
**B:** "I'd rather go off-season, even if the weather is worse"
**Signals A:** `Peak-season-tolerant`, `Experience-over-crowds`
**Signals B:** `Off-season-seeker`, `Crowd-averse`, `Solitude-premium`
**🔺 Validates:** Silence/stillness ranking + "hear nothing" preference

### CV4 — The Recommendation Test 🔺
**Modality:** scene (4 options)
**Prompt:** "A close friend raves about a hotel. You look it up and it's not your style at all. You:"
**Options:**
- "Book it anyway — I trust them more than photos"
- "Ask them what specifically they loved — maybe I'm missing something"
- "Skip it — I know what I like"
- "Bookmark it for a different kind of trip"
**Signals:** `Trust-over-aesthetics`, `Curious-investigator`, `Confident-self-knower`, `Context-flexible`
**🔺 Validates:** How rigid their taste actually is. The person with very strong design preferences who'd "book it anyway" has more flexible taste than their signals suggest.

---

## IMPLEMENTATION NOTES

### Validation Framework
Each 🔺 question creates a signal pair for post-onboarding comparison:

| Validator | Tests Against | Tension Means |
|---|---|---|
| BA1 (morning recall) | Instinct-round morning ritual | Aspirational vs actual routine |
| BA2 (where you ate) | FD1 (dining discovery) | Planned vs actual dining |
| BA3 (room time) | Force-rank room details | Over-indexing on room aesthetics |
| BA5 (splurge recall) | BV2 (upgrade priorities) | Aspirational vs actual spending |
| BA6 (regret) | TR3 (planning style) | Over-planner who regrets it |
| SP1 (sound 4-way) | Silence force-rank | Urban quiet ≠ nature quiet |
| WB4 (sleep slider) | Bed/textiles force-rank | Sleep obsession reality |
| TR1 (day 3 test) | Packed vs slow instinct | FOMO vs rest truth |
| TR5 (return slider) | Emotional-core discovery | Explorer vs comfort core |
| CV1 (honesty trap) | Service-style formality | Real formality sensitivity |
| CV2 (comfort paradox) | Force-rank details | Design vs comfort truth |
| CV3 (crowd test) | Silence/stillness rank | Solitude premium reality |
| CV4 (recommendation) | Design preferences | Taste rigidity check |
| SC3 (wedding) | Silence/crowd signals | Social flexibility |

When signals contradict, store both as **TasteContradiction**. Contradictions are the richest signals.

### Question Count by Modality
- **Scene (4 options):** 14 questions — BA1, BA2, BA4, BA5, BA6, BA7, SP1, SP4, WB2, TR1, TR3, TR4, SC1-SC5, CV1, CI1, CI3, FD7
- **Cards / A/B:** 8 questions — FD1, FD5, CI4, DN3, SC5, CV2, CV3, BV1
- **Swipe (images) 📷:** 5 questions — FD2, SP2, AD1, AD3, AD4, AD5
- **Force-rank:** 4 questions — FD3, SP5, BV2, DN2
- **Quick-choice (multi):** 5 questions — BA2, SP3, WB3, DN1
- **Slider:** 6 questions — FD4, FD6, BA3, WB4, TR2, CI2, TR5
- **Scene (A/B):** 2 questions — CV2, CV3

**Total: ~45 questions** (vs 25 in v1)

### Suggested Phase Structure

**Behavioral Anchoring Phase** (new, Act 1, ~2 min):
BA1–BA7 as a single phase with quick-choice modality, fast-paced, concrete recall framing.

**Food & Drink Phase** (new or expand existing, Act 0 or Act 1):
FD1–FD7 could be a dedicated phase or woven into existing phases.

**Sensory Profile Phase** (new, Act 0):
SP1–SP5, mostly non-verbal, fast visual/selection-based.

**Scenarios Phase** (new, Act 2):
SC1–SC5, scenario-based, reveals behavior under pressure.

**Remaining questions** woven into existing phases or triggered adaptively based on gap analysis.

### Image Assets Needed (📷)
- FD2: Japanese omakase counter + Italian trattoria
- SP2: Warm amber room + cool white room
- WB1: Natural plunge pool + infinity pool with service
- AD1: Art Deco hotel + Brutalist hotel
- AD2: Converted monastery + contemporary architecture
- AD3: Warm palette room + cool palette room
- AD4: Vast monumental lobby + intimate human-scale entry
- AD5: Period-restored interior + radical modern-in-old-shell
