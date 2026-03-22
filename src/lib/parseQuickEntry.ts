/**
 * parseQuickEntry — lightweight, client-side parser for free-text day planner entries.
 *
 * Handles inputs like:
 *   "Massages at 6:30pm"     → { label: "Massages", category: "activity", specificTime: "18:30", specificTimeLabel: "At" }
 *   "1:10pm flight to Iguazu" → { label: "Flight to Iguazu", category: "transport", specificTime: "13:10", specificTimeLabel: "Departure" }
 *   "ski"                     → { label: "Ski", category: "activity" }
 *   "scuba?"                  → { label: "Scuba", category: "activity", status: "tentative" }
 *   "Pick up car at station"  → { label: "Pick up car at station", category: "logistics" }
 *   "train to Venice"         → { label: "Train to Venice", category: "transport" }
 *   "Boat rental at 10am"     → { label: "Boat rental", category: "activity", specificTime: "10:00" }
 *
 * No AI call needed for ~80% of cases. The parser extracts:
 *   1. Time (if present) — regex-based 12h/24h extraction
 *   2. Category — keyword matching (transport, dining, logistics, activity, other)
 *   3. Status — tentative if input ends with "?"
 *   4. Clean label — original text with time expression stripped + trimmed
 */

import type { QuickEntry, QuickEntryCategory, QuickEntryStatus } from '@/types';

// ─── Time extraction ───────────────────────────────────────────────────

// Matches: "at 6:30pm", "at 10am", "6:30 PM", "14:30", "1:10pm", "@3pm"
const TIME_PATTERN = /(?:(?:at|@)\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)(?:\b|$)/;
const TIME_24H_PATTERN = /(?:(?:at|@)\s+)?(\d{1,2}):(\d{2})(?:\b|$)/;
// Matches time at the START of input: "1:10pm flight to Iguazu"
const TIME_START_PATTERN = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)\s+/;

interface ExtractedTime {
  hours: number;
  minutes: number;
  raw: string; // The full matched substring (for stripping from label)
}

function extractTime(text: string): ExtractedTime | null {
  // Try start-of-string time first ("1:10pm flight to...")
  let match = text.match(TIME_START_PATTERN);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    const meridiem = match[3].toLowerCase();
    return {
      hours: to24h(hours, meridiem),
      minutes,
      raw: match[0],
    };
  }

  // Try "at X:XXpm" / "@Xam" patterns
  match = text.match(TIME_PATTERN);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    const meridiem = match[3].toLowerCase();
    return {
      hours: to24h(hours, meridiem),
      minutes,
      raw: match[0],
    };
  }

  // Try 24h format "at 14:30" — only if explicitly prefixed with at/@ to avoid matching years etc.
  const match24 = text.match(/(?:at|@)\s+(\d{1,2}):(\d{2})(?:\b|$)/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return { hours, minutes, raw: match24[0] };
    }
  }

  return null;
}

function to24h(hours: number, meridiem: string): number {
  if (meridiem === 'am') {
    return hours === 12 ? 0 : hours;
  }
  // pm
  return hours === 12 ? 12 : hours + 12;
}

function formatTime24(hours: number, minutes: number): string {
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// ─── Category detection ─────────────────────────────────────────────────

const TRANSPORT_KEYWORDS = [
  'flight', 'fly', 'train', 'bus', 'ferry', 'drive', 'taxi', 'uber', 'lyft',
  'transfer', 'airport', 'depart', 'arrive', 'departure', 'arrival',
  'car rental', 'rental car', 'pick up car', 'drop off car', 'shuttle',
];

const DINING_KEYWORDS = [
  'breakfast', 'brunch', 'lunch', 'dinner', 'supper', 'reservation',
  'restaurant', 'cafe', 'coffee', 'drinks', 'cocktails', 'wine tasting',
  'food tour', 'cooking class', 'tasting menu',
];

const LOGISTICS_KEYWORDS = [
  'check in', 'check-in', 'check out', 'check-out', 'checkout', 'checkin',
  'pack', 'laundry', 'pharmacy', 'grocery', 'supermarket', 'atm', 'bank',
  'pick up', 'drop off', 'return', 'exchange', 'sim card', 'wifi',
  'luggage', 'baggage', 'storage',
];

const ACTIVITY_KEYWORDS = [
  'tour', 'hike', 'hiking', 'walk', 'walking tour', 'bike', 'cycling',
  'museum', 'gallery', 'visit', 'explore', 'excursion', 'snorkel', 'snorkeling',
  'scuba', 'diving', 'surf', 'surfing', 'ski', 'skiing', 'snowboard',
  'kayak', 'canoe', 'paddle', 'boat rental', 'jet ski',
  'spa', 'massage', 'yoga', 'gym', 'swim', 'swimming', 'pool',
  'show', 'concert', 'theater', 'theatre', 'opera', 'ballet', 'cinema',
  'class', 'lesson', 'workshop', 'market', 'shopping', 'sunset',
  'zipline', 'paragliding', 'bungee', 'climb', 'climbing', 'trek', 'trekking',
  'safari', 'whale watching', 'dolphin', 'horseback', 'hot spring',
  'waterfall', 'beach', 'park', 'garden', 'temple', 'church', 'castle',
  'ruins', 'monument', 'viewpoint', 'lookout', 'photography',
];

function detectCategory(text: string): QuickEntryCategory {
  const lower = text.toLowerCase();

  // Transport — check first because "train to X" is very clear
  if (TRANSPORT_KEYWORDS.some(kw => lower.includes(kw))) return 'transport';
  // Also catch "X to Y" patterns like "train to Venice", "bus to Rome"
  if (/\b(to|from)\s+[A-Z]/.test(text) && /\b(train|bus|ferry|flight|drive)\b/i.test(text)) return 'transport';

  if (DINING_KEYWORDS.some(kw => lower.includes(kw))) return 'dining';
  if (LOGISTICS_KEYWORDS.some(kw => lower.includes(kw))) return 'logistics';

  // Check for activity keywords before falling back to generic 'other'
  if (ACTIVITY_KEYWORDS.some(kw => lower.includes(kw))) return 'activity';

  return 'other'; // truly unclassifiable — shows as generic entry
}

// ─── Time label inference ───────────────────────────────────────────────

function inferTimeLabel(category: QuickEntryCategory, text: string): string | undefined {
  const lower = text.toLowerCase();
  if (category === 'transport') {
    if (lower.includes('arrival') || lower.includes('arrive') || lower.includes('land')) return 'Arrives';
    return 'Departs';
  }
  if (category === 'dining') return 'Reservation';
  if (lower.includes('check in') || lower.includes('check-in') || lower.includes('checkin')) return 'Check-in';
  if (lower.includes('check out') || lower.includes('check-out') || lower.includes('checkout')) return 'Check-out';
  if (lower.includes('pick up') || lower.includes('pickup')) return 'Pickup';
  return undefined; // No specific label needed
}

// ─── Label cleaning ─────────────────────────────────────────────────────

function cleanLabel(text: string, timeRaw: string | null): string {
  let label = text;

  // Strip the time expression
  if (timeRaw) {
    label = label.replace(timeRaw, '');
  }

  // Strip trailing question mark (tentative status is tracked separately)
  label = label.replace(/\?\s*$/, '');

  // Clean up artifacts: leading/trailing whitespace, dangling "at", double spaces
  label = label.replace(/\s+at\s*$/i, '');
  label = label.replace(/^\s*at\s+/i, '');
  label = label.replace(/\s{2,}/g, ' ').trim();

  // Capitalize first letter
  if (label.length > 0) {
    label = label[0].toUpperCase() + label.slice(1);
  }

  return label;
}

// ─── Main parser ────────────────────────────────────────────────────────

export function parseQuickEntry(input: string): Omit<QuickEntry, 'id' | 'createdAt'> {
  const trimmed = input.trim();

  // 1. Detect tentative status (trailing "?")
  const status: QuickEntryStatus = trimmed.endsWith('?') ? 'tentative' : 'confirmed';

  // 2. Extract time
  const extracted = extractTime(trimmed);
  const specificTime = extracted ? formatTime24(extracted.hours, extracted.minutes) : undefined;

  // 3. Clean label
  const label = cleanLabel(trimmed, extracted?.raw ?? null);

  // 4. Detect category
  const category = detectCategory(trimmed);

  // 5. Infer time label
  const specificTimeLabel = extracted ? inferTimeLabel(category, trimmed) : undefined;

  return {
    text: trimmed,
    label: label || trimmed.replace(/\?\s*$/, '').trim(), // fallback to original
    category,
    status,
    specificTime,
    specificTimeLabel,
  };
}

// ─── Suggested slot from parsed entry ───────────────────────────────────

/** Given a parsed quick entry, suggest which slot ID it should go in (if auto-placing). */
export function suggestSlotForEntry(entry: Pick<QuickEntry, 'specificTime' | 'category'>): string | null {
  if (entry.specificTime) {
    const [h] = entry.specificTime.split(':').map(Number);
    if (h < 10) return 'breakfast';
    if (h < 12) return 'morning';
    if (h < 14) return 'lunch';
    if (h < 17) return 'afternoon';
    if (h < 21) return 'dinner';
    return 'evening';
  }

  // If no time but category gives a hint
  if (entry.category === 'dining') return null; // ambiguous without time
  if (entry.category === 'transport') return null; // could be any time

  return null; // Let the user choose
}
