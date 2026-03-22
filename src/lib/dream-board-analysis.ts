/**
 * Dream Board Analysis — Smart extraction of actionable content from dream board entries.
 *
 * Categorizes entries during graduation from dreaming → planning so that:
 *   - Google Maps links → resolved to pool items
 *   - Booking site links → flagged as potential confirmations
 *   - Place name references → offered as pool candidates
 *   - Confirmation codes → linked to existing bookings
 *   - Article/editorial links → preserved as research references
 *   - Logistics/packing/personal notes → kept as trip notes
 *
 * Two-tier approach:
 *   1. Client-side heuristic pass (this file) — fast, no API call
 *   2. AI-powered extraction (via /api/trips/[id]/analyze-dream-board) — deeper analysis
 */

import { DreamBoardEntry } from '@/types';
import { detectInput, extractPlaceIdFromMapsUrl, getPlatformLabel } from '@/lib/detect-input';
import { detectConfirmationCodes, isUrl } from '@/components/dream-board/helpers';

// ─── Category types ─────────────────────────────────────────────────────────

export type EntryCategory =
  | 'google_maps_place'   // Single Google Maps place link → resolve to pool item
  | 'google_maps_list'    // Google Maps saved list → batch import
  | 'article_link'        // Editorial/travel article → import pipeline
  | 'booking_link'        // Hotel/restaurant booking site → check for confirmation
  | 'place_reference'     // Text mentioning a specific place name
  | 'confirmation'        // Contains a booking/confirmation code
  | 'logistics'           // Travel logistics (flights, transport, timing)
  | 'research'            // Questions, "to look up", vibe notes
  | 'general_note'        // Everything else — personal notes, packing, etc.
  ;

export interface AnalyzedEntry {
  entry: DreamBoardEntry;
  category: EntryCategory;
  /** Secondary categories if entry has multiple signals */
  secondaryCategories?: EntryCategory[];
  /** Extracted metadata */
  meta: {
    /** Google Maps place info extracted from URL */
    mapsPlace?: { placeName?: string; placeId?: string; cid?: string; coordinates?: { lat: number; lng: number } };
    /** Platform detected from URL */
    platform?: string;
    /** Confirmation codes found in text */
    confirmationCodes?: string[];
    /** Detected place names (from AI or heuristic) */
    placeNames?: string[];
    /** Whether this entry is actionable during graduation */
    actionable: boolean;
    /** Suggested action for the user */
    suggestedAction?: string;
  };
}

export interface AnalysisResult {
  entries: AnalyzedEntry[];
  summary: {
    totalEntries: number;
    actionableCount: number;
    placeLinks: number;
    articleLinks: number;
    confirmations: number;
    placeReferences: number;
    generalNotes: number;
  };
}

// ─── Booking site detection ────────────────────────────────────────────────

const BOOKING_DOMAINS = [
  /booking\.com/i,
  /airbnb\./i,
  /vrbo\./i,
  /hotels\.com/i,
  /expedia\./i,
  /kayak\./i,
  /opentable\.com/i,
  /resy\.com/i,
  /tock\.com/i,
  /sevenrooms\.com/i,
  /exploretock\.com/i,
  /marriott\.com/i,
  /hilton\.com/i,
  /hyatt\.com/i,
  /ihg\.com/i,
  /accor\.com/i,
  /fourseasons\.com/i,
  /ritzcarlton\.com/i,
  /aman\.com/i,
  /designhotels\.com/i,
  /mrandmrssmith\.com/i,
  /tablet\.com/i,
  /hostelworld\.com/i,
];

function isBookingSite(url: string): boolean {
  return BOOKING_DOMAINS.some(pattern => pattern.test(url));
}

// ─── Logistics keywords ────────────────────────────────────────────────────

const LOGISTICS_PATTERNS = [
  /\b(flight|airline|airport|terminal|gate|layover|connecting)\b/i,
  /\b(train|metro|subway|uber|taxi|cab|lyft|rental car|car hire)\b/i,
  /\b(check[ -]?in|check[ -]?out|departure|arrival|boarding)\b/i,
  /\b(passport|visa|travel insurance|vaccination|covid test)\b/i,
  /\b(luggage|suitcase|carry[ -]?on|packing)\b/i,
  /\b(currency|exchange rate|atm|cash)\b/i,
  /\b(sim card|wifi|roaming|adapter|voltage)\b/i,
  /\b(transfer|shuttle|pickup)\b/i,
];

function looksLikeLogistics(text: string): boolean {
  return LOGISTICS_PATTERNS.filter(p => p.test(text)).length >= 1;
}

// ─── Research/question patterns ────────────────────────────────────────────

const RESEARCH_PATTERNS = [
  /\b(look up|research|find out|google|check|look into)\b/i,
  /\b(best time|when to|how to get|where to)\b/i,
  /\?\s*$/,  // ends with a question mark
  /\b(vibe|mood|aesthetic|feel|energy)\b/i,
  /\b(neighborhood|area|district|quarter)\b/i,
];

function looksLikeResearch(text: string): boolean {
  return RESEARCH_PATTERNS.filter(p => p.test(text)).length >= 1;
}

// ─── Core analysis ─────────────────────────────────────────────────────────

function analyzeEntry(entry: DreamBoardEntry): AnalyzedEntry {
  const secondaryCategories: EntryCategory[] = [];

  // ── Dividers are always general notes ──
  if (entry.type === 'divider') {
    return {
      entry,
      category: 'general_note',
      meta: { actionable: false },
    };
  }

  // ── Link entries ──
  if (entry.type === 'link' || isUrl(entry.content.trim())) {
    const url = entry.content.trim();
    const inputMeta = detectInput(url);

    // Google Maps single place
    if (inputMeta.type === 'google-maps-place') {
      const placeInfo = extractPlaceIdFromMapsUrl(url);
      return {
        entry,
        category: 'google_maps_place',
        meta: {
          mapsPlace: placeInfo || undefined,
          platform: 'Google Maps',
          actionable: true,
          suggestedAction: placeInfo?.placeName
            ? `Add "${placeInfo.placeName}" to your trip pool`
            : 'Resolve this Google Maps link to a place',
        },
      };
    }

    // Google Maps saved list
    if (inputMeta.type === 'google-maps-list') {
      return {
        entry,
        category: 'google_maps_list',
        meta: {
          platform: 'Google Maps',
          actionable: true,
          suggestedAction: 'Import places from this Google Maps list',
        },
      };
    }

    // Booking sites
    if (isBookingSite(url)) {
      const codes = detectConfirmationCodes(entry.title || '');
      return {
        entry,
        category: 'booking_link',
        meta: {
          platform: getPlatformLabel(inputMeta.platform),
          confirmationCodes: codes.map(c => c.code),
          actionable: true,
          suggestedAction: 'Check for booking confirmation details',
        },
      };
    }

    // Travel articles/editorials
    return {
      entry,
      category: 'article_link',
      meta: {
        platform: getPlatformLabel(inputMeta.platform),
        actionable: true,
        suggestedAction: 'Import place recommendations from this article',
      },
    };
  }

  // ── Text entries ──
  const text = `${entry.title || ''} ${entry.content}`.trim();

  // Check for confirmation codes
  const codes = detectConfirmationCodes(text);
  if (codes.length > 0) {
    return {
      entry,
      category: 'confirmation',
      meta: {
        confirmationCodes: codes.map(c => c.code),
        actionable: true,
        suggestedAction: `Found confirmation code${codes.length > 1 ? 's' : ''}: ${codes.map(c => c.code).join(', ')}`,
      },
    };
  }

  // Check for logistics
  if (looksLikeLogistics(text)) {
    // Could also contain place references — mark as secondary
    if (looksLikeResearch(text)) secondaryCategories.push('research');
    return {
      entry,
      category: 'logistics',
      secondaryCategories: secondaryCategories.length ? secondaryCategories : undefined,
      meta: { actionable: false },
    };
  }

  // Check for research/questions
  if (looksLikeResearch(text)) {
    return {
      entry,
      category: 'research',
      meta: { actionable: false },
    };
  }

  // ── Checklists — check if items look like place names ──
  if (entry.type === 'checklist' && entry.items?.length) {
    // Heuristic: if the checklist title mentions food/restaurants/bars/hotels/things to do,
    // the items are likely place references
    const titleLower = (entry.title || '').toLowerCase();
    const PLACE_LIST_TITLES = [
      'restaurant', 'bar', 'cafe', 'coffee', 'hotel', 'stay', 'visit',
      'eat', 'drink', 'try', 'see', 'do', 'activity', 'museum', 'gallery',
      'shop', 'market', 'spa', 'beach', 'hike', 'club', 'brunch', 'dinner',
      'lunch', 'breakfast',
    ];
    const looksLikePlaceList = PLACE_LIST_TITLES.some(kw => titleLower.includes(kw));
    if (looksLikePlaceList) {
      return {
        entry,
        category: 'place_reference',
        meta: {
          placeNames: entry.items.map(i => i.text),
          actionable: true,
          suggestedAction: `${entry.items.length} potential places to add to your pool`,
        },
      };
    }
  }

  // ── Default: general note ──
  return {
    entry,
    category: 'general_note',
    meta: { actionable: false },
  };
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Analyze all dream board entries — fast, client-side heuristic pass.
 * Returns categorized entries with actionability metadata.
 */
export function analyzeDreamBoard(entries: DreamBoardEntry[]): AnalysisResult {
  const analyzed = entries.map(analyzeEntry);

  return {
    entries: analyzed,
    summary: {
      totalEntries: analyzed.length,
      actionableCount: analyzed.filter(e => e.meta.actionable).length,
      placeLinks: analyzed.filter(e =>
        e.category === 'google_maps_place' || e.category === 'google_maps_list'
      ).length,
      articleLinks: analyzed.filter(e => e.category === 'article_link').length,
      confirmations: analyzed.filter(e => e.category === 'confirmation').length,
      placeReferences: analyzed.filter(e => e.category === 'place_reference').length,
      generalNotes: analyzed.filter(e =>
        e.category === 'general_note' || e.category === 'logistics' || e.category === 'research'
      ).length,
    },
  };
}

/**
 * Get only actionable entries — the ones that should be surfaced during graduation.
 */
export function getActionableEntries(result: AnalysisResult): AnalyzedEntry[] {
  return result.entries.filter(e => e.meta.actionable);
}

/**
 * Get entries that should be preserved as reference notes in planning mode.
 */
export function getReferenceEntries(result: AnalysisResult): AnalyzedEntry[] {
  return result.entries.filter(e =>
    !e.meta.actionable ||
    e.category === 'research' ||
    e.category === 'logistics'
  );
}
