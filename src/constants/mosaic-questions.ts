/**
 * Expand Your Mosaic — question bank
 *
 * Each question is self-contained and maps to one or more taste axes / signal dimensions.
 * The selection engine picks from this pool using weighted randomization
 * that prioritizes under-sampled axes and avoids back-to-back type repeats.
 */

// ─── Types ───

export type MosaicQuestionType = 'ab' | 'scene' | 'slider' | 'rank' | 'micro';

export interface MosaicOptionAB {
  label: string;
  axes: Partial<Record<string, number>>; // axis → delta (-1 to 1)
  signals?: string[];
}

export interface MosaicQuestion {
  id: number;
  type: MosaicQuestionType;
  section: string;
  domain: 'hotel' | 'restaurant' | 'bar' | 'activity' | 'shopping' | 'neighborhood' | 'cross-domain' | 'identity';

  // AB / Scene
  prompt?: string;
  optionA?: MosaicOptionAB;
  optionB?: MosaicOptionAB;

  // Slider
  leftLabel?: string;
  rightLabel?: string;
  sliderAxis?: string;

  // Rank
  rankPrompt?: string;
  rankOptions?: string[];

  // Micro (open-ended)
  microPrompt?: string;

  // Gating
  minAnswered?: number; // only show after N questions answered
}

// ─── Question Bank ───

export const MOSAIC_QUESTIONS: MosaicQuestion[] = [

  // ═══════════════════════════════════════
  // DESIGN & SPACE
  // ═══════════════════════════════════════

  { id: 1, type: 'ab', section: 'Design', domain: 'hotel',
    prompt: 'Fireplace or ceiling fan?',
    optionA: { label: 'Fireplace', axes: { temperature: 0.15, mood: -0.1 }, signals: ['Warm-enclosure'] },
    optionB: { label: 'Ceiling fan', axes: { temperature: -0.1, mood: 0.1 }, signals: ['Tropical-openness'] } },

  { id: 2, type: 'ab', section: 'Design', domain: 'hotel',
    prompt: 'Terrazzo floors or wide-plank oak?',
    optionA: { label: 'Terrazzo', axes: { temperature: -0.12, time: 0.1 }, signals: ['Cool-modernism'] },
    optionB: { label: 'Wide-plank oak', axes: { temperature: 0.12, time: -0.1 }, signals: ['Warm-heritage'] } },

  { id: 3, type: 'ab', section: 'Design', domain: 'hotel',
    prompt: 'One perfect orchid or wildflowers in a jam jar?',
    optionA: { label: 'One perfect orchid', axes: { formality: 0.15, volume: -0.1 }, signals: ['Controlled-refinement'] },
    optionB: { label: 'Wildflowers in a jam jar', axes: { formality: -0.15, volume: 0.05 }, signals: ['Casual-abundance'] } },

  { id: 6, type: 'ab', section: 'Design', domain: 'hotel',
    prompt: 'Candlelight or floor-to-ceiling windows?',
    optionA: { label: 'Candlelight', axes: { mood: -0.15, volume: -0.05 }, signals: ['Intimate-darkness'] },
    optionB: { label: 'Floor-to-ceiling windows', axes: { mood: 0.15, volume: 0.05 }, signals: ['Luminous-openness'] } },

  { id: 7, type: 'slider', section: 'Design', domain: 'hotel',
    prompt: 'Your ideal room palette',
    leftLabel: 'All white', rightLabel: 'Saturated color', sliderAxis: 'volume' },

  { id: 8, type: 'ab', section: 'Design', domain: 'hotel',
    prompt: 'Velvet or linen?',
    optionA: { label: 'Velvet', axes: { formality: 0.12, temperature: 0.08 }, signals: ['Opulent-texture'] },
    optionB: { label: 'Linen', axes: { formality: -0.12, temperature: -0.05 }, signals: ['Natural-fiber'] } },

  { id: 10, type: 'ab', section: 'Design', domain: 'hotel',
    prompt: 'Concrete or marble?',
    optionA: { label: 'Concrete', axes: { time: 0.15, temperature: -0.1, formality: -0.1 }, signals: ['Brutalist-material'] },
    optionB: { label: 'Marble', axes: { time: -0.15, temperature: -0.05, formality: 0.15 }, signals: ['Classical-material'] } },

  { id: 12, type: 'ab', section: 'Design', domain: 'hotel',
    prompt: 'A room with one extraordinary piece of art — or a room that is the art?',
    optionA: { label: 'One piece', axes: { volume: -0.1, culture: 0.05 }, signals: ['Gallery-focus'] },
    optionB: { label: 'Room is the art', axes: { volume: 0.15, culture: 0.1 }, signals: ['Gesamtkunstwerk'] } },

  { id: 13, type: 'micro', section: 'Design', domain: 'hotel',
    microPrompt: 'Describe your ideal hotel bathroom in exactly 5 words.' },

  { id: 14, type: 'ab', section: 'Design', domain: 'hotel',
    prompt: 'Floor-to-ceiling bookshelf or floor-to-ceiling window?',
    optionA: { label: 'Bookshelf', axes: { mood: -0.08, culture: 0.1 }, signals: ['Interior-richness'] },
    optionB: { label: 'Window', axes: { mood: 0.1, culture: -0.05 }, signals: ['Exterior-connection'] } },

  { id: 15, type: 'slider', section: 'Design', domain: 'hotel',
    prompt: 'How important is the view from your room?',
    leftLabel: "Don't care", rightLabel: "It's everything", sliderAxis: 'mood' },

  { id: 61, type: 'ab', section: 'Design', domain: 'hotel',
    prompt: 'Brass or chrome?',
    optionA: { label: 'Brass', axes: { temperature: 0.1, time: -0.08 }, signals: ['Warm-patina'] },
    optionB: { label: 'Chrome', axes: { temperature: -0.1, time: 0.08 }, signals: ['Cool-precision'] } },

  { id: 62, type: 'ab', section: 'Design', domain: 'hotel',
    prompt: 'Stone or wood?',
    optionA: { label: 'Stone', axes: { temperature: -0.08, formality: 0.05 }, signals: ['Mineral-permanence'] },
    optionB: { label: 'Wood', axes: { temperature: 0.1, formality: -0.05 }, signals: ['Organic-warmth'] } },

  { id: 63, type: 'ab', section: 'Design', domain: 'hotel',
    prompt: 'Handmade ceramic or fine bone china?',
    optionA: { label: 'Handmade ceramic', axes: { formality: -0.12, culture: 0.08 }, signals: ['Craft-imperfection'] },
    optionB: { label: 'Bone china', axes: { formality: 0.12, culture: -0.05 }, signals: ['Classical-refinement'] } },

  // ═══════════════════════════════════════
  // SERVICE & RITUAL
  // ═══════════════════════════════════════

  { id: 16, type: 'scene', section: 'Service', domain: 'hotel',
    prompt: 'You check in. The concierge has pre-built a full itinerary based on your profile.',
    optionA: { label: 'Love it — saves me time', axes: { formality: 0.1 }, signals: ['Structure-valued'] },
    optionB: { label: "I'd rather discover things myself", axes: { formality: -0.1 }, signals: ['Self-directed'] } },

  { id: 17, type: 'ab', section: 'Service', domain: 'hotel',
    prompt: 'The bartender remembers your drink — or you love telling them what you want?',
    optionA: { label: 'Remembers my drink', axes: { formality: 0.08, temperature: 0.1 }, signals: ['Anticipatory-memory'] },
    optionB: { label: 'I love ordering', axes: { formality: -0.05, temperature: -0.05 }, signals: ['Ritual-of-choosing'] } },

  { id: 19, type: 'ab', section: 'Service', domain: 'hotel',
    prompt: '"Mr. Sewitz, welcome back" — or "Hey, good to see you"?',
    optionA: { label: 'Mr. Sewitz', axes: { formality: 0.18 }, signals: ['Formal-recognition'] },
    optionB: { label: 'Hey, good to see you', axes: { formality: -0.15, temperature: 0.1 }, signals: ['Casual-warmth'] } },

  { id: 20, type: 'rank', section: 'Service', domain: 'hotel',
    rankPrompt: 'Order these from most to least important:',
    rankOptions: ['The bed', 'The shower', 'The minibar', 'The wifi'] },

  { id: 21, type: 'ab', section: 'Service', domain: 'hotel',
    prompt: 'Turndown with chocolate on the pillow — or nobody enters your room?',
    optionA: { label: 'Turndown service', axes: { formality: 0.1 }, signals: ['Service-presence'] },
    optionB: { label: 'Nobody enters', axes: { formality: -0.1 }, signals: ['Private-sanctity'] } },

  { id: 22, type: 'scene', section: 'Service', domain: 'hotel',
    prompt: 'The hotel made a mistake with your room. They offer:',
    optionA: { label: 'Immediate upgrade to a suite', axes: { formality: 0.08 }, signals: ['Transactional-resolution'] },
    optionB: { label: 'Heartfelt apology + handwritten note + wine', axes: { temperature: 0.15 }, signals: ['Emotional-resolution'] } },

  { id: 23, type: 'ab', section: 'Service', domain: 'hotel',
    prompt: 'Breakfast buffet spectacle or à la carte in a quiet corner?',
    optionA: { label: 'Buffet spectacle', axes: { volume: 0.12, formality: -0.05 }, signals: ['Social-abundance'] },
    optionB: { label: 'À la carte, quiet corner', axes: { volume: -0.12, formality: 0.1 }, signals: ['Intimate-restraint'] } },

  { id: 24, type: 'slider', section: 'Service', domain: 'hotel',
    prompt: 'Staff interaction level',
    leftLabel: 'Leave me alone', rightLabel: 'Feel like friends', sliderAxis: 'temperature' },

  // ═══════════════════════════════════════
  // LOCATION & CONTEXT
  // ═══════════════════════════════════════

  { id: 33, type: 'ab', section: 'Location', domain: 'hotel',
    prompt: 'On a cobblestone alley in the old town — or on the cliff above it all?',
    optionA: { label: 'Cobblestone alley', axes: { culture: 0.1, volume: 0.05 }, signals: ['Embedded-in-fabric'] },
    optionB: { label: 'Cliff above it all', axes: { culture: -0.05, volume: -0.1 }, signals: ['Removed-with-views'] } },

  { id: 34, type: 'ab', section: 'Location', domain: 'hotel',
    prompt: 'You can hear the city — or you can hear nothing?',
    optionA: { label: 'Hear the city', axes: { volume: 0.15 }, signals: ['Urban-energy'] },
    optionB: { label: 'Hear nothing', axes: { volume: -0.15 }, signals: ['Total-silence'] } },

  { id: 36, type: 'ab', section: 'Location', domain: 'hotel',
    prompt: 'Beach or mountain?',
    optionA: { label: 'Beach', axes: { mood: 0.1, temperature: 0.08 }, signals: ['Coastal-drawn'] },
    optionB: { label: 'Mountain', axes: { mood: -0.05, temperature: -0.1 }, signals: ['Alpine-drawn'] } },

  { id: 37, type: 'ab', section: 'Location', domain: 'hotel',
    prompt: 'Island you need a boat to reach — or city hotel you can walk everywhere from?',
    optionA: { label: 'Island by boat', axes: { culture: 0.1, formality: -0.05 }, signals: ['Remote-island'] },
    optionB: { label: 'Walk everywhere', axes: { culture: -0.05, volume: 0.1 }, signals: ['Urban-walkable'] } },

  { id: 38, type: 'slider', section: 'Location', domain: 'hotel',
    prompt: 'How much does the destination matter vs. the property?',
    leftLabel: 'All destination', rightLabel: 'All property', sliderAxis: 'culture' },

  { id: 39, type: 'ab', section: 'Location', domain: 'hotel',
    prompt: 'A hotel in a converted palazzo — or one built by a starchitect?',
    optionA: { label: 'Converted palazzo', axes: { time: -0.15, culture: 0.1 }, signals: ['Adaptive-reuse'] },
    optionB: { label: 'Starchitect build', axes: { time: 0.15, culture: -0.05 }, signals: ['Contemporary-vision'] } },

  { id: 40, type: 'ab', section: 'Location', domain: 'hotel',
    prompt: 'Tropical or alpine?',
    optionA: { label: 'Tropical', axes: { temperature: 0.12, mood: 0.08 }, signals: ['Tropical-warmth'] },
    optionB: { label: 'Alpine', axes: { temperature: -0.1, mood: -0.08 }, signals: ['Alpine-drama'] } },

  // ═══════════════════════════════════════
  // CHARACTER & IDENTITY
  // ═══════════════════════════════════════

  { id: 41, type: 'ab', section: 'Character', domain: 'hotel',
    prompt: '8 rooms or 200?',
    optionA: { label: '8 rooms', axes: { formality: -0.12, temperature: 0.1 }, signals: ['Micro-intimate'] },
    optionB: { label: '200 rooms', axes: { formality: 0.1, volume: 0.08 }, signals: ['Grand-scale'] } },

  { id: 42, type: 'ab', section: 'Character', domain: 'hotel',
    prompt: 'Open for 100 years — or opened last month?',
    optionA: { label: '100 years', axes: { time: -0.18 }, signals: ['Heritage-institution'] },
    optionB: { label: 'Last month', axes: { time: 0.18 }, signals: ['Opening-buzz'] } },

  { id: 44, type: 'scene', section: 'Character', domain: 'hotel',
    prompt: 'You pull up and there\'s a red carpet and bellhops.',
    optionA: { label: 'Yes — this is an event', axes: { formality: 0.15, volume: 0.1 }, signals: ['Grand-arrival'] },
    optionB: { label: 'Already cringing', axes: { formality: -0.15, volume: -0.1 }, signals: ['Anti-ceremony'] } },

  { id: 45, type: 'ab', section: 'Character', domain: 'hotel',
    prompt: 'Owned by a family — or part of a collection you trust?',
    optionA: { label: 'Family-owned', axes: { culture: 0.1, temperature: 0.08 }, signals: ['Independent-character'] },
    optionB: { label: 'Trusted collection', axes: { culture: -0.05, formality: 0.08 }, signals: ['Brand-quality'] } },

  { id: 46, type: 'ab', section: 'Character', domain: 'hotel',
    prompt: 'They know your name by day 2 — or you\'re perfectly anonymous?',
    optionA: { label: 'Know my name', axes: { temperature: 0.12 }, signals: ['Personal-recognition'] },
    optionB: { label: 'Perfectly anonymous', axes: { temperature: -0.1, formality: 0.05 }, signals: ['Elegant-anonymity'] } },

  { id: 47, type: 'slider', section: 'Character', domain: 'hotel',
    prompt: 'How important is it that a hotel feels rooted in its place?',
    leftLabel: 'Not at all', rightLabel: "It's everything", sliderAxis: 'culture' },

  { id: 48, type: 'ab', section: 'Character', domain: 'hotel',
    prompt: 'A lobby you want to hang out in — or one you pass through in 10 seconds?',
    optionA: { label: 'Hang out', axes: { volume: 0.08, formality: -0.05 }, signals: ['Lobby-social'] },
    optionB: { label: 'Pass through', axes: { volume: -0.08, formality: 0.05 }, signals: ['Room-centric'] } },

  // ═══════════════════════════════════════
  // MOOD & ENERGY
  // ═══════════════════════════════════════

  { id: 49, type: 'ab', section: 'Mood', domain: 'hotel',
    prompt: 'Sunrise or golden hour?',
    optionA: { label: 'Sunrise', axes: { mood: 0.08 }, signals: ['Morning-person'] },
    optionB: { label: 'Golden hour', axes: { mood: -0.05 }, signals: ['Evening-person'] } },

  { id: 50, type: 'ab', section: 'Mood', domain: 'hotel',
    prompt: 'Energized after a trip — or deeply rested?',
    optionA: { label: 'Energized', axes: { volume: 0.08 }, signals: ['Adventure-seeker'] },
    optionB: { label: 'Deeply rested', axes: { volume: -0.1 }, signals: ['Restoration-seeker'] } },

  { id: 51, type: 'scene', section: 'Mood', domain: 'hotel',
    prompt: 'Your ideal last night of a trip:',
    optionA: { label: 'Dressed up, best restaurant, a celebration', axes: { formality: 0.12, mood: 0.05 }, signals: ['Crescendo-finisher'] },
    optionB: { label: 'Room service, movie, packing slowly', axes: { formality: -0.1, volume: -0.08 }, signals: ['Quiet-wind-down'] } },

  { id: 53, type: 'ab', section: 'Mood', domain: 'hotel',
    prompt: 'Jazz bar or silent reading room?',
    optionA: { label: 'Jazz bar', axes: { volume: 0.12, mood: -0.05 }, signals: ['Sensory-stimulation'] },
    optionB: { label: 'Silent reading room', axes: { volume: -0.15 }, signals: ['Contemplative-silence'] } },

  { id: 54, type: 'slider', section: 'Mood', domain: 'hotel',
    prompt: 'Your ideal hotel volume',
    leftLabel: 'Monastery', rightLabel: 'Festival', sliderAxis: 'volume' },

  { id: 55, type: 'ab', section: 'Mood', domain: 'hotel',
    prompt: 'Rainy day at the hotel — or perfect sun every day?',
    optionA: { label: 'Rainy day', axes: { mood: -0.1, temperature: 0.08 }, signals: ['Cozy-interior'] },
    optionB: { label: 'Perfect sun', axes: { mood: 0.1, temperature: -0.05 }, signals: ['Outdoor-brightness'] } },

  // ═══════════════════════════════════════
  // SCENARIOS
  // ═══════════════════════════════════════

  { id: 72, type: 'scene', section: 'Scenario', domain: 'hotel',
    prompt: 'Two hotels, same price, same city.',
    optionA: { label: 'Rooftop pool, Michelin restaurant, famous architect', axes: { formality: 0.1, time: 0.1 }, signals: ['Modern-amenity-package'] },
    optionB: { label: 'No pool, no restaurant — but a converted 17th-century convent with original frescoes', axes: { time: -0.15, culture: 0.15 }, signals: ['Irreplaceable-character'] } },

  { id: 74, type: 'scene', section: 'Scenario', domain: 'hotel',
    prompt: 'The hotel sends a pre-arrival email asking for your preferences.',
    optionA: { label: 'Finally — someone who gets it', axes: { formality: 0.1 }, signals: ['Profiling-welcomed'] },
    optionB: { label: "I don't want to be profiled — surprise me", axes: { formality: -0.08 }, signals: ['Surprise-preferred'] } },

  { id: 75, type: 'scene', section: 'Scenario', domain: 'hotel',
    prompt: 'Anniversary trip. Budget isn\'t the issue.',
    optionA: { label: 'The most beautiful hotel in the world', axes: { formality: 0.1, volume: 0.08 }, signals: ['Universally-acclaimed'] },
    optionB: { label: 'A place no one else knows about', axes: { culture: 0.1, formality: -0.08 }, signals: ['Personal-discovery'] } },

  { id: 76, type: 'scene', section: 'Scenario', domain: 'hotel',
    prompt: 'You look up a hotel and it has 4,000 reviews on TripAdvisor.',
    optionA: { label: "Good — it's validated", axes: { formality: 0.05 }, signals: ['Social-validation'] },
    optionB: { label: "Too many people — I've lost interest", axes: { culture: 0.1 }, signals: ['Anti-popularity'] } },

  // ═══════════════════════════════════════
  // IDENTITY & VALUES
  // ═══════════════════════════════════════

  { id: 83, type: 'ab', section: 'Identity', domain: 'identity',
    prompt: 'Travel to confirm your taste — or to challenge it?',
    optionA: { label: 'Confirm', axes: {}, signals: ['Comfort-zone-seeker'] },
    optionB: { label: 'Challenge', axes: {}, signals: ['Growth-oriented'] } },

  { id: 85, type: 'ab', section: 'Identity', domain: 'identity',
    prompt: 'Everything goes perfectly — or something unexpected happens?',
    optionA: { label: 'Everything perfect', axes: { formality: 0.08 }, signals: ['Planned-perfection'] },
    optionB: { label: 'Something unexpected', axes: { formality: -0.08 }, signals: ['Serendipity-lover'] } },

  { id: 86, type: 'micro', section: 'Identity', domain: 'identity',
    microPrompt: 'What\'s the single object you always pack?' },

  { id: 88, type: 'ab', section: 'Identity', domain: 'identity',
    prompt: 'Perfect hotel in a mediocre city — or mediocre hotel in a perfect city?',
    optionA: { label: 'Perfect hotel', axes: { culture: -0.1 }, signals: ['Property-first'] },
    optionB: { label: 'Perfect city', axes: { culture: 0.1 }, signals: ['Destination-first'] } },

  { id: 93, type: 'ab', section: 'Identity', domain: 'identity',
    prompt: 'Beautiful but uncomfortable — or comfortable but ordinary?',
    optionA: { label: 'Beautiful but uncomfortable', axes: { volume: 0.1 }, signals: ['Design-over-comfort'] },
    optionB: { label: 'Comfortable but ordinary', axes: { volume: -0.08 }, signals: ['Comfort-over-design'] } },

  { id: 98, type: 'ab', section: 'Identity', domain: 'identity',
    prompt: 'The room that photographs beautifully — or the room that feels beautiful?',
    optionA: { label: 'Photographs beautifully', axes: { volume: 0.05 }, signals: ['Visual-surface'] },
    optionB: { label: 'Feels beautiful', axes: { temperature: 0.08 }, signals: ['Felt-experience'] } },

  { id: 99, type: 'ab', section: 'Identity', domain: 'identity',
    prompt: 'Luxury that whispers — or luxury that announces?',
    optionA: { label: 'Whispers', axes: { formality: -0.05, volume: -0.12 }, signals: ['Stealth-luxury'] },
    optionB: { label: 'Announces', axes: { formality: 0.1, volume: 0.12 }, signals: ['Visible-grandeur'] } },

  { id: 100, type: 'ab', section: 'Identity', domain: 'identity',
    prompt: 'A place that changes you — or one that lets you be exactly who you are?',
    optionA: { label: 'Changes you', axes: {}, signals: ['Transformation-seeker'] },
    optionB: { label: 'Lets you be you', axes: {}, signals: ['Recognition-seeker'] } },

  // ═══════════════════════════════════════
  // RESTAURANT IDENTITY
  // ═══════════════════════════════════════

  { id: 101, type: 'ab', section: 'Restaurant', domain: 'restaurant',
    prompt: 'Counter seat watching the chef — or corner table with a view?',
    optionA: { label: 'Counter seat', axes: { 'dining-formality': -0.08 }, signals: ['Kitchen-theater'] },
    optionB: { label: 'Corner table', axes: { 'dining-formality': 0.08 }, signals: ['Room-as-stage'] } },

  { id: 102, type: 'ab', section: 'Restaurant', domain: 'restaurant',
    prompt: 'Tasting menu, no choices — or order whatever you want?',
    optionA: { label: 'Tasting menu', axes: { 'dining-formality': 0.15 }, signals: ['Chef-surrender'] },
    optionB: { label: 'Order anything', axes: { 'dining-formality': -0.1 }, signals: ['Dining-autonomy'] } },

  { id: 103, type: 'ab', section: 'Restaurant', domain: 'restaurant',
    prompt: 'Loud, packed, electric — or hushed, half-empty, every word audible?',
    optionA: { label: 'Loud and electric', axes: { 'dining-volume': 0.18 }, signals: ['Buzzy-dining'] },
    optionB: { label: 'Hushed and half-empty', axes: { 'dining-volume': -0.18 }, signals: ['Quiet-dining'] } },

  { id: 104, type: 'scene', section: 'Restaurant', domain: 'restaurant',
    prompt: 'Two restaurants, same quality.',
    optionA: { label: 'Unmarked door, word-of-mouth only', axes: { 'dining-discovery': 0.15 }, signals: ['Hidden-restaurant'] },
    optionB: { label: 'Award-winner, 3-month waitlist', axes: { 'dining-discovery': -0.1 }, signals: ['Validated-restaurant'] } },

  { id: 105, type: 'ab', section: 'Restaurant', domain: 'restaurant',
    prompt: "Grandmother's recipe — or the same dish reimagined by a young chef?",
    optionA: { label: "Grandmother's recipe", axes: { 'dining-time': -0.15 }, signals: ['Heritage-cooking'] },
    optionB: { label: 'Young chef reimagined', axes: { 'dining-time': 0.15 }, signals: ['Innovative-cooking'] } },

  { id: 106, type: 'rank', section: 'Restaurant', domain: 'restaurant',
    rankPrompt: 'Your ideal dinner format:',
    rankOptions: ['Prix fixe tasting', 'Shared plates for the table', 'Order your own entrée', "Chef's counter omakase"] },

  { id: 107, type: 'ab', section: 'Restaurant', domain: 'restaurant',
    prompt: 'The wine list is the point — or you say "pick something good"?',
    optionA: { label: 'Wine list is the point', axes: { 'dining-formality': 0.1 }, signals: ['Wine-connoisseur'] },
    optionB: { label: 'Pick something good', axes: { 'dining-formality': -0.08 }, signals: ['Wine-delegator'] } },

  { id: 108, type: 'ab', section: 'Restaurant', domain: 'restaurant',
    prompt: 'Menu changes every day — or same 5 dishes for 40 years?',
    optionA: { label: 'Changes daily', axes: { 'dining-time': 0.12 }, signals: ['Seasonal-spontaneity'] },
    optionB: { label: 'Same 5 for 40 years', axes: { 'dining-time': -0.15 }, signals: ['Perfected-classics'] } },

  { id: 109, type: 'scene', section: 'Restaurant', domain: 'restaurant',
    prompt: "You're in Tokyo for 4 nights.",
    optionA: { label: 'All 4 dinners booked weeks ago', axes: { 'dining-planning': 0.15 }, signals: ['Restaurant-planner'] },
    optionB: { label: "I'll figure it out when I'm hungry", axes: { 'dining-planning': -0.15 }, signals: ['Restaurant-improviser'] } },

  { id: 110, type: 'ab', section: 'Restaurant', domain: 'restaurant',
    prompt: 'Eat at the hotel every night — or never eat at the hotel?',
    optionA: { label: 'Hotel every night', axes: { 'dining-exploration': -0.15 }, signals: ['Hotel-dining-loyalist'] },
    optionB: { label: 'Never eat at the hotel', axes: { 'dining-exploration': 0.15 }, signals: ['Neighborhood-diner'] } },

  { id: 111, type: 'ab', section: 'Restaurant', domain: 'restaurant',
    prompt: 'Plating is art — or the plate is almost irrelevant?',
    optionA: { label: 'Plating is art', axes: { 'dining-volume': 0.1 }, signals: ['Visual-dining'] },
    optionB: { label: 'Plate is irrelevant', axes: { 'dining-volume': -0.1 }, signals: ['Flavor-focused'] } },

  { id: 112, type: 'micro', section: 'Restaurant', domain: 'restaurant',
    microPrompt: 'Describe your ideal restaurant in 5 words.' },

  { id: 113, type: 'ab', section: 'Restaurant', domain: 'restaurant',
    prompt: 'Paper menus and mismatched chairs — or white tablecloths and heavy silverware?',
    optionA: { label: 'Paper menus, mismatched chairs', axes: { 'dining-formality': -0.15 }, signals: ['Casual-character-dining'] },
    optionB: { label: 'White tablecloths, heavy silverware', axes: { 'dining-formality': 0.15 }, signals: ['Formal-precision-dining'] } },

  // ═══════════════════════════════════════
  // BARS & DRINK
  // ═══════════════════════════════════════

  { id: 114, type: 'ab', section: 'Bar', domain: 'bar',
    prompt: 'Cocktail bar with a 40-page menu — or three taps and a bottle of mezcal?',
    optionA: { label: '40-page menu', axes: { 'bar-formality': 0.12, 'bar-volume': 0.08 }, signals: ['Maximalist-craft'] },
    optionB: { label: 'Three taps and mezcal', axes: { 'bar-formality': -0.12, 'bar-volume': -0.08 }, signals: ['Edited-simplicity'] } },

  { id: 115, type: 'ab', section: 'Bar', domain: 'bar',
    prompt: 'Hotel bar — or the bar the concierge wouldn\'t tell most guests about?',
    optionA: { label: 'Hotel bar', axes: { 'bar-exploration': -0.1 }, signals: ['Hotel-bar-loyalist'] },
    optionB: { label: 'Secret local bar', axes: { 'bar-exploration': 0.12 }, signals: ['Bar-explorer'] } },

  { id: 117, type: 'scene', section: 'Bar', domain: 'bar',
    prompt: "It's 11pm. You're in a city you love.",
    optionA: { label: 'One more drink somewhere quiet with good music', axes: { 'bar-energy': -0.1 }, signals: ['Night-wind-down'] },
    optionB: { label: "Let's find whatever's happening", axes: { 'bar-energy': 0.15 }, signals: ['Second-wind'] } },

  { id: 118, type: 'ab', section: 'Bar', domain: 'bar',
    prompt: 'Rooftop with a view — or basement with a secret?',
    optionA: { label: 'Rooftop', axes: { 'bar-mood': 0.1, 'bar-volume': 0.08 }, signals: ['Rooftop-glamour'] },
    optionB: { label: 'Basement', axes: { 'bar-mood': -0.1, 'bar-volume': -0.08 }, signals: ['Underground-intimacy'] } },

  { id: 120, type: 'ab', section: 'Bar', domain: 'bar',
    prompt: 'Aperitivo at a piazza café — or sake at a 6-seat counter in a Tokyo alley?',
    optionA: { label: 'Piazza aperitivo', axes: { 'bar-formality': -0.05, 'bar-social': 0.12 }, signals: ['Social-aperitivo'] },
    optionB: { label: 'Tokyo alley sake', axes: { 'bar-formality': 0.05, 'bar-social': -0.1 }, signals: ['Intimate-counter'] } },

  { id: 121, type: 'rank', section: 'Bar', domain: 'bar',
    rankPrompt: 'Your kind of drink setting:',
    rankOptions: ['Dive bar with character', 'Speakeasy', 'Grand hotel bar', 'Winery tasting room'] },

  // ═══════════════════════════════════════
  // ACTIVITIES & CULTURE
  // ═══════════════════════════════════════

  { id: 122, type: 'ab', section: 'Activity', domain: 'activity',
    prompt: 'Guided museum tour with an expert — or wander alone and see what you find?',
    optionA: { label: 'Expert guide', axes: { 'activity-structure': 0.15 }, signals: ['Curated-culture'] },
    optionB: { label: 'Wander alone', axes: { 'activity-structure': -0.15 }, signals: ['Self-directed-discovery'] } },

  { id: 123, type: 'ab', section: 'Activity', domain: 'activity',
    prompt: 'Morning cooking class — or morning hike?',
    optionA: { label: 'Cooking class', axes: { 'activity-type': 0.1 }, signals: ['Culinary-activity'] },
    optionB: { label: 'Morning hike', axes: { 'activity-type': -0.1 }, signals: ['Physical-landscape'] } },

  { id: 124, type: 'ab', section: 'Activity', domain: 'activity',
    prompt: 'Contemporary art museum — or ancient ruins?',
    optionA: { label: 'Contemporary art', axes: { 'activity-time': 0.15 }, signals: ['Modern-creative'] },
    optionB: { label: 'Ancient ruins', axes: { 'activity-time': -0.15 }, signals: ['Historical-depth'] } },

  { id: 125, type: 'scene', section: 'Activity', domain: 'activity',
    prompt: 'Free day in a new city.',
    optionA: { label: 'I have a list of 6 things to see', axes: { 'activity-planning': 0.15 }, signals: ['Structured-sightseeing'] },
    optionB: { label: "I'll pick a neighborhood and just walk", axes: { 'activity-planning': -0.15 }, signals: ['Ambient-exploration'] } },

  { id: 127, type: 'ab', section: 'Activity', domain: 'activity',
    prompt: 'Food market at 7am — or flea market at noon?',
    optionA: { label: 'Food market, 7am', axes: { 'activity-type': 0.08 }, signals: ['Dawn-market-person'] },
    optionB: { label: 'Flea market, noon', axes: { 'activity-type': -0.05 }, signals: ['Object-hunter'] } },

  { id: 129, type: 'ab', section: 'Activity', domain: 'activity',
    prompt: 'The thing every tourist does (because it\'s great) — or the thing no tourist knows about?',
    optionA: { label: 'The canonical thing', axes: { 'activity-discovery': -0.1 }, signals: ['Canonical-experience'] },
    optionB: { label: 'Off the radar', axes: { 'activity-discovery': 0.12 }, signals: ['Off-radar-discovery'] } },

  { id: 130, type: 'rank', section: 'Activity', domain: 'activity',
    rankPrompt: 'Your ideal afternoon:',
    rankOptions: ['Spa treatment', 'Gallery hopping', 'Market browsing', 'Beach or pool', 'Long lunch that becomes dinner'] },

  { id: 131, type: 'ab', section: 'Activity', domain: 'activity',
    prompt: 'A sunset you hike to — or one you watch from a terrace with a drink?',
    optionA: { label: 'Hike to it', axes: { 'activity-energy': 0.12 }, signals: ['Earned-beauty'] },
    optionB: { label: 'Terrace with a drink', axes: { 'activity-energy': -0.1 }, signals: ['Delivered-beauty'] } },

  { id: 133, type: 'ab', section: 'Activity', domain: 'activity',
    prompt: 'Learn something — or feel something?',
    optionA: { label: 'Learn something', axes: {}, signals: ['Intellectual-engagement'] },
    optionB: { label: 'Feel something', axes: {}, signals: ['Sensory-emotional'] } },

  // ═══════════════════════════════════════
  // SHOPPING & OBJECTS
  // ═══════════════════════════════════════

  { id: 134, type: 'ab', section: 'Shopping', domain: 'shopping',
    prompt: 'Concept store curated by a designer — or chaotic antique market?',
    optionA: { label: 'Concept store', axes: { 'shopping-formality': 0.12 }, signals: ['Edited-retail'] },
    optionB: { label: 'Antique market', axes: { 'shopping-formality': -0.12 }, signals: ['Treasure-hunting'] } },

  { id: 135, type: 'ab', section: 'Shopping', domain: 'shopping',
    prompt: 'You bring home: a handmade ceramic bowl — or a rare book?',
    optionA: { label: 'Ceramic bowl', axes: {}, signals: ['Tactile-souvenir'] },
    optionB: { label: 'Rare book', axes: {}, signals: ['Intellectual-souvenir'] } },

  { id: 137, type: 'scene', section: 'Shopping', domain: 'shopping',
    prompt: 'You stumble into a beautiful shop.',
    optionA: { label: "I buy something — it'll remind me of this", axes: {}, signals: ['Souvenir-maker'] },
    optionB: { label: 'I rarely buy things — I collect experiences', axes: {}, signals: ['Experience-purist'] } },

  { id: 139, type: 'ab', section: 'Shopping', domain: 'shopping',
    prompt: 'Vintage or new?',
    optionA: { label: 'Vintage', axes: { 'shopping-time': -0.12 }, signals: ['Vintage-hunter'] },
    optionB: { label: 'New', axes: { 'shopping-time': 0.1 }, signals: ['Contemporary-buyer'] } },

  { id: 141, type: 'ab', section: 'Shopping', domain: 'shopping',
    prompt: 'Great shops — or no shops but beautiful architecture?',
    optionA: { label: 'Great shops', axes: {}, signals: ['Shopping-as-travel'] },
    optionB: { label: 'Beautiful architecture', axes: {}, signals: ['Architecture-over-commerce'] } },

  // ═══════════════════════════════════════
  // NEIGHBORHOOD FEEL
  // ═══════════════════════════════════════

  { id: 142, type: 'ab', section: 'Neighborhood', domain: 'neighborhood',
    prompt: 'Narrow winding streets — or wide tree-lined boulevards?',
    optionA: { label: 'Narrow winding', axes: { 'neighborhood-scale': -0.15 }, signals: ['Intimate-organic'] },
    optionB: { label: 'Wide boulevards', axes: { 'neighborhood-scale': 0.15 }, signals: ['Grand-structured'] } },

  { id: 144, type: 'ab', section: 'Neighborhood', domain: 'neighborhood',
    prompt: 'Graffiti and skate shops — or ivy and iron gates?',
    optionA: { label: 'Graffiti and skate shops', axes: { 'neighborhood-formality': -0.15, 'neighborhood-time': 0.12 }, signals: ['Creative-raw'] },
    optionB: { label: 'Ivy and iron gates', axes: { 'neighborhood-formality': 0.15, 'neighborhood-time': -0.12 }, signals: ['Established-refined'] } },

  { id: 145, type: 'scene', section: 'Neighborhood', domain: 'neighborhood',
    prompt: 'Two neighborhoods, same city.',
    optionA: { label: 'Just opened restaurants, studios, slightly rough edges', axes: { 'neighborhood-time': 0.15 }, signals: ['Emerging-neighborhood'] },
    optionB: { label: 'Old buildings, established cafés, locals for generations', axes: { 'neighborhood-time': -0.15 }, signals: ['Rooted-neighborhood'] } },

  { id: 146, type: 'ab', section: 'Neighborhood', domain: 'neighborhood',
    prompt: 'A street with a great bakery, bookshop, and wine bar — or one with a view that stops you?',
    optionA: { label: 'Bakery, bookshop, wine bar', axes: {}, signals: ['Walkable-amenity'] },
    optionB: { label: 'View that stops you', axes: {}, signals: ['Scenic-drama'] } },

  { id: 147, type: 'ab', section: 'Neighborhood', domain: 'neighborhood',
    prompt: 'Busy at 8am — or comes alive at 10pm?',
    optionA: { label: 'Busy at 8am', axes: { 'neighborhood-energy': -0.08 }, signals: ['Morning-neighborhood'] },
    optionB: { label: 'Alive at 10pm', axes: { 'neighborhood-energy': 0.12 }, signals: ['Night-neighborhood'] } },

  { id: 149, type: 'micro', section: 'Neighborhood', domain: 'neighborhood',
    microPrompt: 'Name a neighborhood anywhere in the world that feels like "you."' },

  // ═══════════════════════════════════════
  // CROSS-DOMAIN CHECKS
  // ═══════════════════════════════════════

  { id: 151, type: 'scene', section: 'CrossDomain', domain: 'cross-domain', minAnswered: 20,
    prompt: 'Your hotel is minimal, quiet, Aman-style. For dinner you want:',
    optionA: { label: 'Something equally restrained — a 10-seat kaiseki counter', axes: {}, signals: ['Cross-domain-consistent'] },
    optionB: { label: 'The opposite — a loud family-run trattoria', axes: {}, signals: ['Cross-domain-contrast'] } },

  { id: 152, type: 'scene', section: 'CrossDomain', domain: 'cross-domain', minAnswered: 20,
    prompt: "You're at a grand formal hotel. Your ideal bar tonight:",
    optionA: { label: 'The hotel cocktail bar — chandeliers, piano', axes: {}, signals: ['Bar-matches-hotel'] },
    optionB: { label: 'A divey spot 10 minutes away', axes: {}, signals: ['Bar-contrasts-hotel'] } },

  { id: 153, type: 'ab', section: 'CrossDomain', domain: 'cross-domain', minAnswered: 20,
    prompt: 'Everything in one taste register all day — or you like contrast?',
    optionA: { label: 'One register', axes: {}, signals: ['Tonal-consistency'] },
    optionB: { label: 'I like contrast', axes: {}, signals: ['Dynamic-range'] } },

  { id: 155, type: 'ab', section: 'CrossDomain', domain: 'cross-domain', minAnswered: 20,
    prompt: 'A day where everything matches — or a day of surprises and contrast?',
    optionA: { label: 'Everything matches', axes: {}, signals: ['Curated-coherence'] },
    optionB: { label: 'Surprises and contrast', axes: {}, signals: ['Texture-variety'] } },
];

// ─── Section metadata for UI ───

export const MOSAIC_SECTIONS: Record<string, { label: string; emoji: string; color: string }> = {
  Design:       { label: 'Design & Space',      emoji: '◼', color: '#d63020' },
  Service:      { label: 'Service & Ritual',     emoji: '◻', color: '#a06c28' },
  Location:     { label: 'Location',             emoji: '◆', color: '#2a7a56' },
  Character:    { label: 'Character',            emoji: '◇', color: '#6844a0' },
  Mood:         { label: 'Mood & Energy',        emoji: '●', color: '#eeb420' },
  Scenario:     { label: 'Scenarios',            emoji: '○', color: '#4a6e7a' },
  Identity:     { label: 'Identity',             emoji: '▲', color: '#1c1a17' },
  Restaurant:   { label: 'Restaurants',          emoji: '▽', color: '#e87080' },
  Bar:          { label: 'Bars & Drink',         emoji: '■', color: '#c8923a' },
  Activity:     { label: 'Activities',           emoji: '□', color: '#5a9a6a' },
  Shopping:     { label: 'Shopping',             emoji: '▼', color: '#9a7a5a' },
  Neighborhood: { label: 'Neighborhoods',        emoji: '△', color: '#4a7a9a' },
  CrossDomain:  { label: 'Cross-Domain',         emoji: '◈', color: '#6b8b9a' },
};
