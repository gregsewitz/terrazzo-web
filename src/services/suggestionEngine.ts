/**
 * Terrazzo Suggestion Engine — Tier 2: Claude-powered contextual suggestions
 *
 * Takes a day context (destination, slots, taste profile, library candidates)
 * and asks Claude to rank + contextualize the best suggestions for each empty slot.
 *
 * Returns SuggestionItem[] with personal rationales referencing the user's taste axes.
 */

import type { DaySuggestionContext, SuggestionItem, DayWeather } from '@/types';
import type { TasteProfile } from '@/types';
import { TERRAZZO_VOICE } from '@/types';
import { getTopAxes } from '@/lib/taste-match';

// ─── Prompt templates ─────────────────────────────────────────────────────────

const SUGGESTION_SYSTEM_PROMPT = `You are Terrazzo's personalization engine. You match a traveler's saved places to their day using their taste profile and itinerary context.

${TERRAZZO_VOICE}

YOUR TASK:
Given a day's itinerary (with confirmed and empty slots), a user's taste profile, and a list of candidate places from their library, suggest the best candidates for each empty slot.

RULES:
- Max 1-2 suggestions per empty slot. Leave a slot empty if no candidate is a strong fit.
- Include exactly ONE stretch pick: a place whose top axes DON'T overlap the user's top 2 axes. Mark it with isStretchPick: true. Stretch picks are meant to delight — frame them as pleasant surprises, not compromises.
- Consider the day's "shape": don't suggest 3 museums if one exists. Vary the experience.
- Consider adjacency: prefer places geographically close to what's before/after in the itinerary.
- If TRAVEL PARTY is provided, factor it in: family trips should favor kid-friendly spots; solo trips can lean into intimate bars or long museum visits; partner trips can skew romantic or adventurous; friend groups might want lively, shareable experiences.
- If WEATHER is provided, factor it in: rainy or cold days should favor indoor venues (museums, restaurants, cafes); hot sunny days are great for outdoor neighborhoods, markets, or rooftop bars. Mention weather naturally in rationale when relevant — e.g. "Perfect rainy-morning museum visit" or "The terrace really shines on a day like this."
- Reference the user's taste profile axes in your rationale — e.g. "Your Design eye will love..." or "This stretches your Wellness side, but the garden alone is worth the walk."
- Only suggest from the provided candidates. Never invent places.
- Each rationale should be 1-2 sentences max. Warm, specific, personal.
- Confidence should reflect how well the place fits the slot + user: 0.9+ = perfect fit, 0.7-0.9 = good fit, 0.5-0.7 = decent stretch.

OUTPUT FORMAT:
Return a JSON array only. No markdown fences, no wrapping text.

[
  {
    "placeId": "exact ID from candidates list",
    "targetSlot": "breakfast|morning|lunch|afternoon|dinner|evening",
    "confidence": 0.85,
    "rationale": "Your personal reason in Terrazzo voice",
    "isStretchPick": false
  }
]

If no candidates fit well, return an empty array: []`;

// ─── Taste profile description ────────────────────────────────────────────────

const AXIS_DESCRIPTIONS: Record<string, string> = {
  Design: "you're drawn to carefully curated, visually striking spaces",
  Character: 'authenticity and intimacy matter — you love places with soul',
  Service: 'attentive hospitality elevates an experience for you',
  Food: 'quality cuisine and culinary discovery are central',
  Location: "walkable, neighborhood-rooted spots where you feel the city's pulse",
  Wellness: 'pace, calm, and physical wellbeing shape your travel choices',
};

function describeProfile(profile: TasteProfile, topAxes: string[]): string {
  const lines = Object.entries(profile)
    .sort(([, a], [, b]) => b - a)
    .map(([axis, val]) => {
      const desc = AXIS_DESCRIPTIONS[axis] || '';
      return `  ${axis}: ${val.toFixed(2)} — ${desc}`;
    });
  return `TASTE PROFILE:\n${lines.join('\n')}\n  Top axes: ${topAxes.join(', ')}`;
}

// ─── Itinerary formatting ─────────────────────────────────────────────────────

function formatItinerary(ctx: DaySuggestionContext): string {
  const lines = ctx.slots.map(slot => {
    if (slot.confirmedPlaces.length > 0) {
      const names = slot.confirmedPlaces
        .map(p => `${p.name} (${p.type}, ${p.location || ctx.destination})`)
        .join(', ');
      return `  ${slot.label} (${slot.time}): ${names}`;
    }
    return `  ${slot.label} (${slot.time}): [empty]`;
  });
  return lines.join('\n');
}

function formatAdjacency(ctx: DaySuggestionContext): string {
  const lines: string[] = [];
  for (let i = 0; i < ctx.slots.length; i++) {
    const slot = ctx.slots[i];
    if (slot.confirmedPlaces.length > 0) continue; // only show adjacency for empty slots

    const before = i > 0 ? ctx.slots[i - 1] : null;
    const after = i < ctx.slots.length - 1 ? ctx.slots[i + 1] : null;

    const beforeStr = before?.confirmedPlaces.length
      ? `${before.confirmedPlaces[0].name} (${before.confirmedPlaces[0].location || ''})`
      : '[empty]';
    const afterStr = after?.confirmedPlaces.length
      ? `${after.confirmedPlaces[0].name} (${after.confirmedPlaces[0].location || ''})`
      : '[empty]';

    lines.push(`  ${slot.label}: before=${beforeStr}, after=${afterStr}`);
  }
  return lines.length ? `ADJACENCY (for empty slots):\n${lines.join('\n')}` : '';
}

function formatCandidates(ctx: DaySuggestionContext): string {
  if (ctx.candidates.length === 0) return 'CANDIDATES: None available.';

  const lines = ctx.candidates.map(c =>
    `  { id: "${c.id}", name: "${c.name}", type: "${c.type}", location: "${c.location}", matchScore: ${c.matchScore}, topAxes: [${c.topAxes.map(a => `"${a}"`).join(', ')}]${c.tasteNote ? `, tasteNote: "${c.tasteNote}"` : ''} }`
  );
  return `CANDIDATES (${ctx.candidates.length} places from user's library, filtered to ${ctx.destination}):\n${lines.join('\n')}`;
}

// ─── Travel party + weather formatting ────────────────────────────────────────

function formatTravelParty(ctx: DaySuggestionContext): string {
  if (!ctx.travelParty) return '';
  const { context, groupSize } = ctx.travelParty;
  const labels: Record<string, string> = {
    solo: 'Traveling solo',
    partner: 'Traveling with a partner',
    friends: `Traveling with friends${groupSize ? ` (${groupSize} people)` : ''}`,
    family: `Family trip${groupSize ? ` (${groupSize} people)` : ''}`,
  };
  return `TRAVEL PARTY: ${labels[context] || context}`;
}

function formatWeather(ctx: DaySuggestionContext): string {
  if (!ctx.weather) return '';
  const w = ctx.weather;
  const tempF = (c: number) => Math.round(c * 9 / 5 + 32);
  return `WEATHER: ${w.description}, ${w.tempLowC}–${w.tempHighC}°C (${tempF(w.tempLowC)}–${tempF(w.tempHighC)}°F), ${w.precipMm > 0 ? `${w.precipMm}mm rain expected` : 'dry'}`;
}

// ─── Build the full user message ──────────────────────────────────────────────

export function buildSuggestionPrompt(ctx: DaySuggestionContext): string {
  const dayLabel = [ctx.dayOfWeek, ctx.dayDate].filter(Boolean).join(' ') || `Day ${ctx.dayNumber}`;
  const emptyCount = ctx.slots.filter(s => s.confirmedPlaces.length === 0).length;
  const filledCount = ctx.slots.length - emptyCount;

  const sections = [
    `DESTINATION: ${ctx.destination}`,
    `DAY: ${dayLabel} (Day ${ctx.dayNumber})`,
    `STATUS: ${filledCount} slot${filledCount !== 1 ? 's' : ''} filled, ${emptyCount} empty`,
    formatTravelParty(ctx),
    formatWeather(ctx),
    '',
    describeProfile(ctx.tasteProfile, ctx.topAxes),
    '',
    `CURRENT ITINERARY:\n${formatItinerary(ctx)}`,
    '',
    formatAdjacency(ctx),
    '',
    formatCandidates(ctx),
    '',
    'Suggest places for the empty slots. Return JSON array only.',
  ].filter(Boolean);

  return sections.join('\n');
}

// ─── Response parsing ─────────────────────────────────────────────────────────

function extractJSON(text: string): string {
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  return cleaned;
}

export function parseSuggestionResponse(raw: string): SuggestionItem[] {
  try {
    const json = JSON.parse(extractJSON(raw));
    if (!Array.isArray(json)) return [];

    return json
      .filter((item: any) =>
        item.placeId && item.targetSlot && typeof item.confidence === 'number' && item.rationale
      )
      .map((item: any) => ({
        placeId: String(item.placeId),
        targetSlot: String(item.targetSlot),
        confidence: Math.max(0, Math.min(1, Number(item.confidence))),
        rationale: String(item.rationale),
        isStretchPick: Boolean(item.isStretchPick),
      }));
  } catch (err) {
    console.error('[suggestionEngine] Failed to parse Claude response:', err);
    return [];
  }
}

// ─── Context builder helper (for use in API route) ────────────────────────────

export function buildDayContext(params: {
  tripId: string;
  tripName: string;
  day: { dayNumber: number; date?: string; dayOfWeek?: string; destination?: string; slots: Array<{ id: string; label: string; time: string; places: Array<{ id: string; name: string; type: string; location: string }> }> };
  tasteProfile: TasteProfile;
  candidates: Array<{ id: string; name: string; type: string; location: string; matchScore: number; matchBreakdown?: Record<string, number>; tasteNote?: string }>;
  travelParty?: { context: string; groupSize?: number };
  weather?: DayWeather;
}): DaySuggestionContext {
  const { tripId, tripName, day, tasteProfile, candidates, travelParty, weather } = params;
  const topAxes = getTopAxes(tasteProfile, 3).map(String);

  return {
    tripId,
    tripName,
    dayNumber: day.dayNumber,
    dayDate: day.date,
    dayOfWeek: day.dayOfWeek,
    destination: day.destination || '',
    travelParty: travelParty as DaySuggestionContext['travelParty'],
    weather,
    slots: day.slots.map(s => ({
      id: s.id,
      label: s.label,
      time: s.time,
      confirmedPlaces: s.places.map(p => ({
        name: p.name,
        type: p.type,
        location: p.location,
      })),
    })),
    tasteProfile,
    topAxes,
    candidates: candidates.slice(0, 20).map(c => {
      // Derive top axes from matchBreakdown if available
      const breakdown = c.matchBreakdown || {};
      const cTopAxes = Object.entries(breakdown)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .map(([axis]) => axis);

      return {
        id: c.id,
        name: c.name,
        type: c.type,
        location: c.location,
        matchScore: c.matchScore,
        topAxes: cTopAxes,
        tasteNote: c.tasteNote,
      };
    }),
  };
}

// Export the system prompt for use in API route
export { SUGGESTION_SYSTEM_PROMPT };
