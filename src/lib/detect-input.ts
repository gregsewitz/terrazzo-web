/**
 * Input type detection — shared between client and server.
 *
 * Classifies pasted text so the UAB / ImportDrawer can route
 * to the correct import endpoint.
 *
 *   'google-maps-list'  → /api/import/maps-list  (saved lists)
 *   'google-maps-place' → /api/import/place       (single place — resolve via Google Places API)
 *   'url'               → /api/import             (articles, blogs, guides)
 *   'text'              → /api/import             (multi-line lists)
 *   'text-list'         → /api/import             (single-line delimited lists: commas, dashes, bullets, numbered)
 *   'email'             → (future)
 */

export type InputType =
  | 'url'
  | 'google-maps-list'
  | 'google-maps-place'
  | 'text'
  | 'text-list'
  | 'email';

/**
 * Metadata extracted during detection — helps downstream handlers
 * produce better UX (e.g. "Importing from Instagram…").
 */
export interface InputMeta {
  type: InputType;
  /** Recognized platform, if any */
  platform?: UrlPlatform;
  /** Whether input required normalization (e.g. missing https://) */
  normalized?: boolean;
  /** The cleaned/normalized input string */
  cleanedInput: string;
}

export type UrlPlatform =
  | 'google-maps'
  | 'instagram'
  | 'tiktok'
  | 'tripadvisor'
  | 'yelp'
  | 'eater'
  | 'infatuation'
  | 'cntraveler'
  | 'timeout'
  | 'thrillist'
  | 'michelin'
  | 'generic';

// ─── URL pattern matchers ──────────────────────────────────────────────────

/**
 * Google Maps URL patterns:
 *
 * LISTS (saved/shared lists):
 *   https://www.google.com/maps/placelists/list/ABC123
 *   https://www.google.com/maps/@...!...!2sABC123...  (data param with list ID)
 *   https://maps.app.goo.gl/abc123  (shortened, resolves to list or place)
 *   https://www.google.com/maps/...?share_token=ABC123
 *
 * SINGLE PLACES:
 *   https://www.google.com/maps/place/Restaurant+Name/...
 *   https://www.google.com/maps?cid=12345
 *   https://www.google.com/maps/search/restaurant+name
 *   https://maps.app.goo.gl/xyz789  (could be either — treat short URLs as ambiguous)
 *
 * We disambiguate by checking for list-specific patterns first.
 */

const GOOGLE_MAPS_DOMAIN = /google\.com\/maps/i;
const GOOGLE_MAPS_SHORT = /maps\.app\.goo/i;

// Patterns that strongly indicate a saved list
const MAPS_LIST_PATTERNS = [
  /\/maps\/placelists\/list\//i,
  /share_token=/i,
  /!2s[A-Za-z0-9_-]{10,}/,          // data param encoding a list ID
  /\/maps\/.*entitylist/i,
  /\/maps\/.*\/list\//i,
];

// Patterns that indicate a single place (not a list)
const MAPS_PLACE_PATTERNS = [
  /\/maps\/place\//i,                 // /maps/place/Restaurant+Name/...
  /google\.com\/maps\?cid=/i,        // ?cid=12345678
  /\/maps\/search\//i,               // /maps/search/query
  /\/maps\/@[\d.-]+,[\d.-]+,[\d]+z$/i, // just a map view at coordinates (treat as place context)
];

// ─── Platform detection ─────────────────────────────────────────────────────

interface PlatformPattern {
  platform: UrlPlatform;
  patterns: RegExp[];
}

const PLATFORM_PATTERNS: PlatformPattern[] = [
  {
    platform: 'instagram',
    patterns: [/instagram\.com/i, /instagr\.am/i],
  },
  {
    platform: 'tiktok',
    patterns: [/tiktok\.com/i, /vm\.tiktok\.com/i],
  },
  {
    platform: 'tripadvisor',
    patterns: [/tripadvisor\./i],
  },
  {
    platform: 'yelp',
    patterns: [/yelp\./i],
  },
  {
    platform: 'eater',
    patterns: [/eater\.com/i],
  },
  {
    platform: 'infatuation',
    patterns: [/theinfatuation\.com/i],
  },
  {
    platform: 'cntraveler',
    patterns: [/cntraveler\.com/i, /cntraveller\.com/i, /condenast.*traveler/i],
  },
  {
    platform: 'timeout',
    patterns: [/timeout\.com/i],
  },
  {
    platform: 'thrillist',
    patterns: [/thrillist\.com/i],
  },
  {
    platform: 'michelin',
    patterns: [/guide\.michelin\./i, /michelinGuide/i],
  },
];

// ─── Single-line list detection ────────────────────────────────────────────

/**
 * Heuristic: does this single-line string look like a delimited list of
 * 3+ place names rather than a single search query?
 *
 * Catches:
 *   "Brawn, Primeur, Western's Laundry, CRATE, Bull & Last"
 *   "Brawn — Primeur — Western's Laundry — CRATE"
 *   "Brawn - Primeur - Western's Laundry - CRATE"
 *   "1. Brawn 2. Primeur 3. Western's Laundry"
 *   "• Brawn • Primeur • Western's Laundry"
 *   "Brawn / Primeur / Western's Laundry / CRATE"
 *
 * Requires 3+ items to avoid false positives on things like
 * "Bull & Last — Best Sunday roast ever" (descriptive, not a list).
 */
function looksLikeDelimitedList(text: string): boolean {
  // Comma-separated: 3+ segments, each ≤ 60 chars (place names, not sentences)
  const commaSegments = text.split(',').map(s => s.trim()).filter(Boolean);
  if (commaSegments.length >= 3 && commaSegments.every(s => s.length <= 60)) {
    return true;
  }

  // Em-dash / en-dash / spaced-hyphen separated: "A — B — C" or "A – B – C" or "A - B - C"
  const dashSegments = text.split(/\s+[—–\-]\s+/).map(s => s.trim()).filter(Boolean);
  if (dashSegments.length >= 3 && dashSegments.every(s => s.length <= 60)) {
    return true;
  }

  // Slash separated: "A / B / C"
  const slashSegments = text.split(/\s*\/\s*/).map(s => s.trim()).filter(Boolean);
  if (slashSegments.length >= 3 && slashSegments.every(s => s.length <= 60)) {
    return true;
  }

  // Numbered list on one line: "1. Brawn 2. Primeur 3. Western's Laundry"
  const numberedItems = text.match(/\d+\.\s+[^0-9]+/g);
  if (numberedItems && numberedItems.length >= 3) {
    return true;
  }

  // Bullet chars: "• A • B • C" or "· A · B · C"
  const bulletSegments = text.split(/[•·‣▸►]\s*/).map(s => s.trim()).filter(Boolean);
  if (bulletSegments.length >= 3 && bulletSegments.every(s => s.length <= 60)) {
    return true;
  }

  return false;
}

// ─── Core detection ─────────────────────────────────────────────────────────

/**
 * Simple classification — returns just the InputType string.
 * Backward-compatible with the original API.
 */
export function detectInputType(input: string): InputType {
  return detectInput(input).type;
}

/**
 * Rich classification — returns type + metadata (platform, normalization, etc.)
 * Use this when you need the extra context for UX or routing decisions.
 */
export function detectInput(input: string): InputMeta {
  const trimmed = input.trim();
  if (!trimmed) return { type: 'text', cleanedInput: trimmed };

  // ── Normalize URLs missing protocol ─────────────────────────────────────
  let normalized = false;
  let cleaned = trimmed;

  if (/^(www\.)/i.test(cleaned) && !/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
    normalized = true;
  }

  // ── Check if it looks like a URL ────────────────────────────────────────
  const isUrl = /^https?:\/\//i.test(cleaned);
  if (!isUrl) {
    // ── Check for multi-line lists (newlines survived via onPaste intercept) ──
    const lines = trimmed.split('\n').filter(l => l.trim());
    if (lines.length >= 2) {
      return { type: 'text-list', cleanedInput: trimmed };
    }

    // ── Check for single-line delimited lists ───────────────────────────────
    // Comma-separated: "Brawn, Primeur, Western's Laundry, CRATE"
    // Dash/bullet: "Brawn — Primeur — Western's Laundry" or "Brawn - Primeur - Western's Laundry"
    // Numbered: "1. Brawn 2. Primeur 3. Western's Laundry"
    // Bullet chars: "• Brawn • Primeur • Western's Laundry"
    if (looksLikeDelimitedList(trimmed)) {
      return { type: 'text-list', cleanedInput: trimmed };
    }

    return { type: 'text', cleanedInput: trimmed };
  }

  // ── Google Maps routing ─────────────────────────────────────────────────
  if (GOOGLE_MAPS_DOMAIN.test(cleaned) || GOOGLE_MAPS_SHORT.test(cleaned)) {
    // Check list patterns first (more specific)
    const isList = MAPS_LIST_PATTERNS.some(p => p.test(cleaned));
    if (isList) {
      return {
        type: 'google-maps-list',
        platform: 'google-maps',
        normalized,
        cleanedInput: cleaned,
      };
    }

    // Check single-place patterns
    const isPlace = MAPS_PLACE_PATTERNS.some(p => p.test(cleaned));
    if (isPlace) {
      return {
        type: 'google-maps-place',
        platform: 'google-maps',
        normalized,
        cleanedInput: cleaned,
      };
    }

    // Short URLs (maps.app.goo.gl) are ambiguous — could be list or place.
    // Default to list since that's the more common share pattern, and the
    // maps-list endpoint already handles resolution + fallback.
    if (GOOGLE_MAPS_SHORT.test(cleaned)) {
      return {
        type: 'google-maps-list',
        platform: 'google-maps',
        normalized,
        cleanedInput: cleaned,
      };
    }

    // Generic Google Maps URL — treat as single place
    return {
      type: 'google-maps-place',
      platform: 'google-maps',
      normalized,
      cleanedInput: cleaned,
    };
  }

  // ── Detect known platforms ──────────────────────────────────────────────
  let detectedPlatform: UrlPlatform = 'generic';
  for (const { platform, patterns } of PLATFORM_PATTERNS) {
    if (patterns.some(p => p.test(cleaned))) {
      detectedPlatform = platform;
      break;
    }
  }

  return {
    type: 'url',
    platform: detectedPlatform,
    normalized,
    cleanedInput: cleaned,
  };
}

/**
 * Extract a Google Maps Place ID from a single-place URL.
 * Returns null if the URL doesn't contain one.
 *
 * Known patterns:
 *   /maps/place/Name/@lat,lng,.../data=...!...!1s0x...:0x...  (hex CID)
 *   /maps?cid=1234567890
 *   /maps/place/ChIJ...  (place ID in path)
 */
export function extractPlaceIdFromMapsUrl(url: string): {
  placeId?: string;
  cid?: string;
  placeName?: string;
  coordinates?: { lat: number; lng: number };
} | null {
  try {
    // Extract place name from /maps/place/Name+Here/ pattern
    const nameMatch = url.match(/\/maps\/place\/([^/@]+)/i);
    const placeName = nameMatch?.[1]
      ? decodeURIComponent(nameMatch[1].replace(/\+/g, ' '))
      : undefined;

    // Extract coordinates from /@lat,lng pattern
    const coordMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    const coordinates = coordMatch
      ? { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]) }
      : undefined;

    // Extract CID from ?cid= or data params
    const cidParamMatch = url.match(/[?&]cid=(\d+)/);
    const cid = cidParamMatch?.[1] || undefined;

    // Extract Place ID (ChIJ...) from data params
    const placeIdMatch = url.match(/!1s(0x[a-f0-9]+:0x[a-f0-9]+)/i) ||
                          url.match(/(ChIJ[A-Za-z0-9_-]+)/);
    const placeId = placeIdMatch?.[1] || undefined;

    if (!placeName && !placeId && !cid && !coordinates) return null;

    return { placeId, cid, placeName, coordinates };
  } catch {
    return null;
  }
}

/**
 * Utility: get a human-readable label for a detected platform.
 */
export function getPlatformLabel(platform?: UrlPlatform): string {
  switch (platform) {
    case 'google-maps': return 'Google Maps';
    case 'instagram': return 'Instagram';
    case 'tiktok': return 'TikTok';
    case 'tripadvisor': return 'TripAdvisor';
    case 'yelp': return 'Yelp';
    case 'eater': return 'Eater';
    case 'infatuation': return 'The Infatuation';
    case 'cntraveler': return 'Condé Nast Traveler';
    case 'timeout': return 'Time Out';
    case 'thrillist': return 'Thrillist';
    case 'michelin': return 'Michelin Guide';
    default: return 'article';
  }
}
