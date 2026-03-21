/**
 * Proximity Intelligence Module
 *
 * Provides geographic awareness for the day planner:
 * - Distance matrix computation and caching
 * - Proximity label generation (State 1: day-scoped, State 2: slot-selected)
 * - Radius-based geographic clustering
 * - Route coherence scoring for slot-aware suggestions
 *
 * All distances in US imperial miles. Walking speed ~3 mph.
 */

import { distMi } from '@/lib/geo';
import type { ImportedPlace, TripDay, HotelInfo } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Walking speed in miles per minute (~3 mph) */
const WALK_MPM = 3 / 60; // 0.05 mi/min

/** Debounce quiet period before re-sorting pool items (ms) */
export const SORT_DEBOUNCE_MS = 300;

/** Default cluster radius when not enough placed items to compute adaptive radius */
const DEFAULT_CLUSTER_RADIUS_MI = 0.5;

/** Larger radius when only hotel is the anchor (no placed items yet) — covers a typical city transit zone */
const HOTEL_ONLY_RADIUS_MI = 2.0;

/** Minimum pool items in a cluster to show a chip */
const MIN_CLUSTER_SIZE = 3;

/** Minimum placed items to compute adaptive radius (need 3+ for meaningful median) */
const MIN_PLACED_FOR_ADAPTIVE = 3;

// ─── Label thresholds ─────────────────────────────────────────────────────────

const SAME_NEIGHBORHOOD_MI = 0.25;
const WALK_MAX_MI = 1.0;
const SHORT_RIDE_MAX_MI = 3.0;

/** Route coherence thresholds for State 2 labels */
const ON_THE_WAY_MI = 0.3;
const SMALL_DETOUR_MI = 0.6;

/** "Worth the detour" — high taste match but far away */
const WORTH_DETOUR_MATCH_THRESHOLD = 90;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProximityLabel {
  /** Human-readable label, e.g. "8 min walk from Rochelle Canteen" */
  text: string;
  /** Distance in miles to the anchor */
  distanceMi: number;
  /** The anchor place name used in the label (if any) */
  anchorName?: string;
  /** Label tier for styling */
  tier: 'same-neighborhood' | 'walkable' | 'short-ride' | 'across-town' | 'worth-detour' | 'none';
}

export interface RouteCoherenceResult {
  /** Extra travel added by inserting this candidate (miles) */
  detourCostMi: number;
  /** The "previous" anchor name */
  prevName?: string;
  /** The "next" anchor name */
  nextName?: string;
  /** Route-aware label */
  label: ProximityLabel;
}

export interface GeoCluster {
  /** Center lat/lng of the cluster (centroid of items) */
  centerLat: number;
  centerLng: number;
  /** Radius of this cluster in miles */
  radiusMi: number;
  /** Human-readable label for the cluster chip */
  label: string;
  /** IDs of pool items within this cluster */
  placeIds: string[];
  /** Number of pool items in cluster */
  count: number;
}

export interface PlacedAnchor {
  id: string;
  name: string;
  lat: number;
  lng: number;
  slotId: string;
  slotIndex: number; // ordinal position in the day's slot sequence
}

// ─── Coordinate extraction ────────────────────────────────────────────────────

export function getCoords(place: ImportedPlace): { lat: number; lng: number } | null {
  const lat = place.google?.lat;
  const lng = place.google?.lng;
  if (lat == null || lng == null || lat === 0 || lng === 0) return null;
  // Basic sanity check
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function getHotelCoords(hotel?: HotelInfo): { lat: number; lng: number } | null {
  if (!hotel?.lat || !hotel?.lng) return null;
  return { lat: hotel.lat, lng: hotel.lng };
}

// ─── Distance Matrix ──────────────────────────────────────────────────────────

/**
 * A symmetric distance matrix keyed by place ID pairs.
 * Access with matrixKey(id1, id2).
 */
export type DistanceMatrix = Map<string, number>;

function matrixKey(id1: string, id2: string): string {
  return id1 < id2 ? `${id1}|${id2}` : `${id2}|${id1}`;
}

/**
 * Compute full pairwise distance matrix for a set of places.
 * Returns a Map with canonical keys. O(n²) but n is typically < 150.
 */
export function buildDistanceMatrix(
  places: Array<{ id: string; lat: number; lng: number }>
): DistanceMatrix {
  const matrix: DistanceMatrix = new Map();
  for (let i = 0; i < places.length; i++) {
    for (let j = i + 1; j < places.length; j++) {
      const d = distMi(places[i].lat, places[i].lng, places[j].lat, places[j].lng);
      matrix.set(matrixKey(places[i].id, places[j].id), d);
    }
  }
  return matrix;
}

/**
 * Incrementally add one place to an existing matrix. O(n).
 */
export function addToMatrix(
  matrix: DistanceMatrix,
  newPlace: { id: string; lat: number; lng: number },
  existing: Array<{ id: string; lat: number; lng: number }>
): void {
  for (const p of existing) {
    const d = distMi(newPlace.lat, newPlace.lng, p.lat, p.lng);
    matrix.set(matrixKey(newPlace.id, p.id), d);
  }
}

/**
 * Remove a place from the matrix. O(n).
 */
export function removeFromMatrix(matrix: DistanceMatrix, placeId: string): void {
  const keysToRemove: string[] = [];
  for (const key of matrix.keys()) {
    if (key.includes(placeId)) keysToRemove.push(key);
  }
  for (const key of keysToRemove) matrix.delete(key);
}

/**
 * Look up distance between two places. Returns undefined if not in matrix.
 */
export function getDistance(matrix: DistanceMatrix, id1: string, id2: string): number | undefined {
  if (id1 === id2) return 0;
  return matrix.get(matrixKey(id1, id2));
}

// ─── Label Generation ─────────────────────────────────────────────────────────

function walkingMinutes(distMiles: number): number {
  return Math.round(distMiles / WALK_MPM);
}

/**
 * Generate a proximity label for State 1 (day-scoped).
 * Shows distance to the nearest placed item on the active day.
 */
export function dayProximityLabel(
  distMiles: number,
  anchorName: string,
  matchScore?: number,
): ProximityLabel {
  // "Worth the detour" override for high-match distant places
  if (
    matchScore != null &&
    matchScore >= WORTH_DETOUR_MATCH_THRESHOLD &&
    distMiles > SHORT_RIDE_MAX_MI
  ) {
    return {
      text: 'Worth the detour',
      distanceMi: distMiles,
      anchorName,
      tier: 'worth-detour',
    };
  }

  if (distMiles < SAME_NEIGHBORHOOD_MI) {
    return {
      text: `Same neighborhood as ${anchorName}`,
      distanceMi: distMiles,
      anchorName,
      tier: 'same-neighborhood',
    };
  }

  if (distMiles <= WALK_MAX_MI) {
    const mins = walkingMinutes(distMiles);
    return {
      text: `${mins} min walk from ${anchorName}`,
      distanceMi: distMiles,
      anchorName,
      tier: 'walkable',
    };
  }

  if (distMiles <= SHORT_RIDE_MAX_MI) {
    return {
      text: `Short ride from ${anchorName}`,
      distanceMi: distMiles,
      anchorName,
      tier: 'short-ride',
    };
  }

  return {
    text: 'Across town',
    distanceMi: distMiles,
    tier: 'across-town',
  };
}

/**
 * Generate a route-coherence label for State 2 (slot-selected).
 * Shows how well a candidate fits between the prev and next anchors.
 */
export function slotProximityLabel(
  candidateLat: number,
  candidateLng: number,
  prev: PlacedAnchor | null,
  next: PlacedAnchor | null,
  matchScore?: number,
): RouteCoherenceResult {
  // No anchors at all — can't compute route coherence
  if (!prev && !next) {
    return {
      detourCostMi: 0,
      label: { text: '', distanceMi: 0, tier: 'none' },
    };
  }

  // Only one anchor — show distance to it
  if (!prev || !next) {
    const anchor = (prev || next)!;
    const d = distMi(candidateLat, candidateLng, anchor.lat, anchor.lng);
    const isForward = !prev; // if no prev, we're looking toward the next anchor
    const preposition = isForward ? 'to' : 'from';

    return {
      detourCostMi: d,
      prevName: prev?.name,
      nextName: next?.name,
      label: singleAnchorLabel(d, anchor.name, preposition, matchScore),
    };
  }

  // Both anchors — compute detour cost
  const dPrevCandidate = distMi(candidateLat, candidateLng, prev.lat, prev.lng);
  const dCandidateNext = distMi(candidateLat, candidateLng, next.lat, next.lng);
  const dPrevNext = distMi(prev.lat, prev.lng, next.lat, next.lng);
  const detourCost = dPrevCandidate + dCandidateNext - dPrevNext;

  // "Worth the detour" for high-match items with big detours
  if (
    matchScore != null &&
    matchScore >= WORTH_DETOUR_MATCH_THRESHOLD &&
    detourCost > SMALL_DETOUR_MI
  ) {
    return {
      detourCostMi: detourCost,
      prevName: prev.name,
      nextName: next.name,
      label: {
        text: 'Worth the detour',
        distanceMi: Math.min(dPrevCandidate, dCandidateNext),
        anchorName: prev.name,
        tier: 'worth-detour',
      },
    };
  }

  if (detourCost < ON_THE_WAY_MI) {
    return {
      detourCostMi: detourCost,
      prevName: prev.name,
      nextName: next.name,
      label: {
        text: `On the way from ${prev.name} to ${next.name}`,
        distanceMi: detourCost,
        anchorName: prev.name,
        tier: 'same-neighborhood',
      },
    };
  }

  if (detourCost < SMALL_DETOUR_MI) {
    const mins = walkingMinutes(detourCost);
    return {
      detourCostMi: detourCost,
      prevName: prev.name,
      nextName: next.name,
      label: {
        text: `${mins} min detour between ${prev.name} and ${next.name}`,
        distanceMi: detourCost,
        anchorName: prev.name,
        tier: 'walkable',
      },
    };
  }

  // Large detour — fall back to nearest anchor distance
  const nearestDist = Math.min(dPrevCandidate, dCandidateNext);
  const nearestName = dPrevCandidate <= dCandidateNext ? prev.name : next.name;

  return {
    detourCostMi: detourCost,
    prevName: prev.name,
    nextName: next.name,
    label: {
      text: `Out of the way \u2014 ${walkingMinutes(nearestDist)} min from ${nearestName}`,
      distanceMi: nearestDist,
      anchorName: nearestName,
      tier: 'across-town',
    },
  };
}

function singleAnchorLabel(
  distMiles: number,
  anchorName: string,
  preposition: 'to' | 'from',
  matchScore?: number,
): ProximityLabel {
  if (
    matchScore != null &&
    matchScore >= WORTH_DETOUR_MATCH_THRESHOLD &&
    distMiles > SHORT_RIDE_MAX_MI
  ) {
    return { text: 'Worth the detour', distanceMi: distMiles, anchorName, tier: 'worth-detour' };
  }

  if (distMiles < SAME_NEIGHBORHOOD_MI) {
    return { text: `Same neighborhood as ${anchorName}`, distanceMi: distMiles, anchorName, tier: 'same-neighborhood' };
  }
  if (distMiles <= WALK_MAX_MI) {
    return { text: `${walkingMinutes(distMiles)} min ${preposition} ${anchorName}`, distanceMi: distMiles, anchorName, tier: 'walkable' };
  }
  if (distMiles <= SHORT_RIDE_MAX_MI) {
    return { text: `Short ride ${preposition} ${anchorName}`, distanceMi: distMiles, anchorName, tier: 'short-ride' };
  }
  return { text: 'Across town', distanceMi: distMiles, tier: 'across-town' };
}

// ─── Placed Anchors Extraction ────────────────────────────────────────────────

/** Standard slot ordering for anchor scanning */
const SLOT_ORDER = ['breakfast', 'morning', 'lunch', 'afternoon', 'dinner', 'evening'];

/**
 * Extract placed items from a day as geographic anchors, ordered by slot.
 */
export function extractPlacedAnchors(day: TripDay): PlacedAnchor[] {
  const anchors: PlacedAnchor[] = [];
  for (const slot of day.slots) {
    const slotIndex = SLOT_ORDER.indexOf(slot.id);
    for (const place of slot.places) {
      const coords = getCoords(place);
      if (!coords) continue;
      anchors.push({
        id: place.id,
        name: place.name,
        lat: coords.lat,
        lng: coords.lng,
        slotId: slot.id,
        slotIndex: slotIndex >= 0 ? slotIndex : 99,
      });
    }
  }
  return anchors.sort((a, b) => a.slotIndex - b.slotIndex);
}

/**
 * Find the previous and next placed anchors relative to a given slot.
 * Scans backward/forward through the slot order.
 */
export function findSlotAnchors(
  anchors: PlacedAnchor[],
  targetSlotId: string,
  hotelCoords?: { lat: number; lng: number } | null,
): { prev: PlacedAnchor | null; next: PlacedAnchor | null } {
  const targetIndex = SLOT_ORDER.indexOf(targetSlotId);
  if (targetIndex < 0) return { prev: null, next: null };

  let prev: PlacedAnchor | null = null;
  let next: PlacedAnchor | null = null;

  // Scan backward for prev anchor
  for (let i = anchors.length - 1; i >= 0; i--) {
    if (anchors[i].slotIndex < targetIndex) {
      prev = anchors[i];
      break;
    }
  }

  // Scan forward for next anchor
  for (let i = 0; i < anchors.length; i++) {
    if (anchors[i].slotIndex > targetIndex) {
      next = anchors[i];
      break;
    }
  }

  // Hotel fallback for first slot of day
  if (!prev && hotelCoords) {
    prev = {
      id: '__hotel__',
      name: 'your hotel',
      lat: hotelCoords.lat,
      lng: hotelCoords.lng,
      slotId: '__hotel__',
      slotIndex: -1,
    };
  }

  return { prev, next };
}

// ─── Clustering ───────────────────────────────────────────────────────────────

/**
 * Compute adaptive cluster radius from placed items.
 * Uses the median inter-place distance.
 */
export function adaptiveRadius(anchors: PlacedAnchor[]): number {
  if (anchors.length < MIN_PLACED_FOR_ADAPTIVE) return DEFAULT_CLUSTER_RADIUS_MI;

  const distances: number[] = [];
  for (let i = 0; i < anchors.length; i++) {
    for (let j = i + 1; j < anchors.length; j++) {
      distances.push(distMi(anchors[i].lat, anchors[i].lng, anchors[j].lat, anchors[j].lng));
    }
  }
  distances.sort((a, b) => a - b);
  const median = distances[Math.floor(distances.length / 2)];

  // Clamp to reasonable bounds (0.15 mi minimum, 3 mi maximum)
  return Math.max(0.15, Math.min(3.0, median));
}

/**
 * Cluster pool items around placed anchors using the adaptive radius.
 * Returns clusters with human-readable labels.
 *
 * Ephemeral — recomputed fresh on every call, never cached across sessions.
 */
export function computeClusters(
  poolItems: Array<{ id: string; lat: number; lng: number; name: string; address?: string }>,
  anchors: PlacedAnchor[],
  radiusMi: number,
): GeoCluster[] {
  if (anchors.length === 0) return [];

  // Group pool items by nearest anchor within radius
  const anchorGroups = new Map<string, {
    anchor: PlacedAnchor;
    items: Array<{ id: string; lat: number; lng: number; address?: string }>;
  }>();

  for (const anchor of anchors) {
    anchorGroups.set(anchor.id, { anchor, items: [] });
  }

  for (const item of poolItems) {
    let nearestAnchor: PlacedAnchor | null = null;
    let nearestDist = Infinity;

    for (const anchor of anchors) {
      const d = distMi(item.lat, item.lng, anchor.lat, anchor.lng);
      if (d <= radiusMi && d < nearestDist) {
        nearestDist = d;
        nearestAnchor = anchor;
      }
    }

    if (nearestAnchor) {
      anchorGroups.get(nearestAnchor.id)!.items.push(item);
    }
  }

  // Merge overlapping groups (anchors within radius of each other)
  const merged = mergeOverlappingGroups(anchorGroups, radiusMi);

  // Filter to minimum size and generate labels
  return merged
    .filter(g => g.items.length >= MIN_CLUSTER_SIZE)
    .map(g => {
      const label = clusterLabel(g.anchor, g.items);
      return {
        centerLat: g.anchor.lat,
        centerLng: g.anchor.lng,
        radiusMi,
        label,
        placeIds: g.items.map(i => i.id),
        count: g.items.length,
      };
    });
}

/**
 * Cold-start clustering: group pool items against each other (no placed items).
 * Uses default radius.
 */
export function computeColdStartClusters(
  poolItems: Array<{ id: string; lat: number; lng: number; name: string; address?: string }>,
): GeoCluster[] {
  if (poolItems.length < MIN_CLUSTER_SIZE) return [];

  // Simple approach: pick seed points greedily, cluster around them
  const used = new Set<string>();
  const clusters: GeoCluster[] = [];
  const radius = DEFAULT_CLUSTER_RADIUS_MI;

  // Sort by density (items with most neighbors first) to find good seeds
  const neighborCounts = poolItems.map(item => {
    const count = poolItems.filter(other =>
      other.id !== item.id &&
      distMi(item.lat, item.lng, other.lat, other.lng) <= radius
    ).length;
    return { item, count };
  }).sort((a, b) => b.count - a.count);

  for (const { item } of neighborCounts) {
    if (used.has(item.id)) continue;

    const nearby = poolItems.filter(other =>
      !used.has(other.id) &&
      distMi(item.lat, item.lng, other.lat, other.lng) <= radius
    );

    if (nearby.length >= MIN_CLUSTER_SIZE) {
      nearby.forEach(n => used.add(n.id));
      const label = clusterLabel(
        { id: item.id, name: item.name, lat: item.lat, lng: item.lng, slotId: '', slotIndex: 0 },
        nearby,
      );
      clusters.push({
        centerLat: item.lat,
        centerLng: item.lng,
        radiusMi: radius,
        label,
        placeIds: nearby.map(n => n.id),
        count: nearby.length,
      });
    }
  }

  return clusters;
}

// ─── Cluster helpers ──────────────────────────────────────────────────────────

function mergeOverlappingGroups(
  groups: Map<string, { anchor: PlacedAnchor; items: Array<{ id: string; lat: number; lng: number; address?: string }> }>,
  radiusMi: number,
): Array<{ anchor: PlacedAnchor; items: Array<{ id: string; lat: number; lng: number; address?: string }> }> {
  const entries = Array.from(groups.values());
  const merged: typeof entries = [];
  const consumed = new Set<number>();

  for (let i = 0; i < entries.length; i++) {
    if (consumed.has(i)) continue;
    const current = { ...entries[i], items: [...entries[i].items] };

    for (let j = i + 1; j < entries.length; j++) {
      if (consumed.has(j)) continue;
      const d = distMi(current.anchor.lat, current.anchor.lng, entries[j].anchor.lat, entries[j].anchor.lng);
      if (d <= radiusMi) {
        // Merge: add items, keep the anchor with more items
        const uniqueIds = new Set(current.items.map(item => item.id));
        for (const item of entries[j].items) {
          if (!uniqueIds.has(item.id)) {
            current.items.push(item);
            uniqueIds.add(item.id);
          }
        }
        if (entries[j].items.length > current.items.length) {
          current.anchor = entries[j].anchor;
        }
        consumed.add(j);
      }
    }

    merged.push(current);
  }

  return merged;
}

/**
 * Generate a human-readable label for a cluster.
 *
 * Fallback chain:
 * 1. If 60%+ of items share a neighborhood from address → "Near [Neighborhood]"
 * 2. Otherwise → "Near [Anchor Place Name]"
 */
function clusterLabel(
  anchor: PlacedAnchor,
  items: Array<{ id: string; address?: string }>,
): string {
  // Try to extract a common neighborhood from addresses
  const neighborhoods = items
    .map(i => extractNeighborhood(i.address))
    .filter((n): n is string => n !== null);

  if (neighborhoods.length > 0) {
    // Count occurrences
    const counts = new Map<string, number>();
    for (const n of neighborhoods) {
      counts.set(n, (counts.get(n) || 0) + 1);
    }
    // Find most common
    let bestNeighborhood = '';
    let bestCount = 0;
    for (const [n, c] of counts) {
      if (c > bestCount) { bestNeighborhood = n; bestCount = c; }
    }
    // Use if 60%+ agree
    if (bestCount >= neighborhoods.length * 0.6 && bestNeighborhood) {
      return `Near ${bestNeighborhood}`;
    }
  }

  // Fallback: use the anchor place name
  return `Near ${anchor.name}`;
}

/**
 * Extract a neighborhood/locality from a Google address string.
 * Google addresses typically look like:
 *   "123 Example St, Shoreditch, London E1 6JE, UK"
 * We want the sub-city locality (Shoreditch in this case).
 */
function extractNeighborhood(address?: string): string | null {
  if (!address) return null;

  const parts = address.split(',').map(p => p.trim());
  if (parts.length < 3) return null;

  // The neighborhood is typically the 2nd or 3rd part (after street, before city/postcode)
  // Skip parts that look like street addresses (contain numbers at start) or postcodes
  for (let i = 1; i < parts.length - 1; i++) {
    const part = parts[i];
    // Skip if it starts with a number (street address)
    if (/^\d/.test(part)) continue;
    // Skip if it looks like a postcode
    if (/^[A-Z]{1,2}\d/.test(part) || /^\d{5}/.test(part)) continue;
    // Skip if it's a country
    if (part.length <= 3 && part === part.toUpperCase()) continue;
    // Skip if it's clearly a city-level name (very common names)
    // This is a heuristic — we want sub-city, not city
    if (parts.length > 3 && i === parts.length - 2) continue;

    return part;
  }

  return null;
}

// ─── Pool Segmentation ────────────────────────────────────────────────────────

export interface SegmentedPool {
  /** Items within the day's geographic footprint */
  fitsYourDay: Array<ImportedPlace & { proximityLabel: ProximityLabel }>;
  /** Items outside the footprint */
  elsewhere: Array<ImportedPlace & { proximityLabel: ProximityLabel }>;
}

/**
 * Segment pool items into "fits your day" and "elsewhere" based on
 * proximity to placed items on the active day.
 */
export function segmentPool(
  poolItems: ImportedPlace[],
  anchors: PlacedAnchor[],
  radiusMi: number,
  hotelCoords?: { lat: number; lng: number } | null,
): SegmentedPool {
  const fitsYourDay: SegmentedPool['fitsYourDay'] = [];
  const elsewhere: SegmentedPool['elsewhere'] = [];

  // All anchors including hotel
  const allAnchors = [...anchors];
  const hotelOnly = anchors.length === 0 && !!hotelCoords;
  if (hotelCoords && !anchors.some(a => a.id === '__hotel__')) {
    allAnchors.push({
      id: '__hotel__',
      name: 'your hotel',
      lat: hotelCoords.lat,
      lng: hotelCoords.lng,
      slotId: '__hotel__',
      slotIndex: -1,
    });
  }

  // When only a hotel anchor exists (no placed items), use a generous radius
  // so that nearby-ish items still appear in "Fits your day" instead of everything
  // landing in "Elsewhere" due to the tiny default 0.5mi adaptive radius.
  const effectiveRadius = hotelOnly ? HOTEL_ONLY_RADIUS_MI : radiusMi;

  for (const item of poolItems) {
    const coords = getCoords(item);
    if (!coords) {
      // No coordinates — goes to elsewhere with no label
      elsewhere.push({
        ...item,
        proximityLabel: { text: '', distanceMi: Infinity, tier: 'none' },
      });
      continue;
    }

    // Find nearest anchor
    let nearestDist = Infinity;
    let nearestAnchor: PlacedAnchor | null = null;
    for (const anchor of allAnchors) {
      const d = distMi(coords.lat, coords.lng, anchor.lat, anchor.lng);
      if (d < nearestDist) {
        nearestDist = d;
        nearestAnchor = anchor;
      }
    }

    if (!nearestAnchor) {
      elsewhere.push({
        ...item,
        proximityLabel: { text: '', distanceMi: Infinity, tier: 'none' },
      });
      continue;
    }

    const label = dayProximityLabel(nearestDist, nearestAnchor.name, item.matchScore);

    if (nearestDist <= effectiveRadius * 1.5) {
      // Within extended radius — fits the day
      fitsYourDay.push({ ...item, proximityLabel: label });
    } else {
      elsewhere.push({ ...item, proximityLabel: label });
    }
  }

  return { fitsYourDay, elsewhere };
}

// ─── Slot-Selected Scoring ────────────────────────────────────────────────────

/**
 * Time-of-day proximity weight multipliers.
 * Higher weight = proximity matters more for this slot.
 */
const SLOT_PROXIMITY_WEIGHT: Record<string, number> = {
  breakfast: 0.4,
  morning: 0.35,
  lunch: 0.3,
  afternoon: 0.3,
  dinner: 0.2,
  evening: 0.2,
};

/**
 * Score and label all pool items for a selected slot (State 2).
 * Returns items sorted by route coherence (detour cost), with match score as tiebreaker.
 */
export function scoreForSlot(
  poolItems: ImportedPlace[],
  targetSlotId: string,
  prev: PlacedAnchor | null,
  next: PlacedAnchor | null,
): Array<ImportedPlace & { routeCoherence: RouteCoherenceResult }> {
  const weight = SLOT_PROXIMITY_WEIGHT[targetSlotId] ?? 0.3;
  const scored: Array<ImportedPlace & { routeCoherence: RouteCoherenceResult; combinedScore: number }> = [];

  for (const item of poolItems) {
    const coords = getCoords(item);
    if (!coords) {
      scored.push({
        ...item,
        routeCoherence: {
          detourCostMi: Infinity,
          label: { text: '', distanceMi: Infinity, tier: 'none' },
        },
        combinedScore: (item.matchScore ?? 0) * (1 - weight),
      });
      continue;
    }

    const coherence = slotProximityLabel(
      coords.lat, coords.lng,
      prev, next,
      item.matchScore,
    );

    // Normalize detour cost to 0-100 scale (0 = perfect, 100 = 5+ miles detour)
    const proxScore = Math.max(0, 100 - (coherence.detourCostMi / 5) * 100);
    const combined = (item.matchScore ?? 0) * (1 - weight) + proxScore * weight;

    scored.push({
      ...item,
      routeCoherence: coherence,
      combinedScore: combined,
    });
  }

  // Sort by combined score descending
  scored.sort((a, b) => b.combinedScore - a.combinedScore);

  return scored;
}

// ─── Transport Event Detection (Multi-Destination Days) ──────────────────────

/**
 * Detect transport boundaries in a day's slots.
 *
 * A "transport reset" occurs when adjacent placed items are far enough apart
 * (> 10 mi) that the user is clearly moving between distinct areas of a city
 * or between cities. This prevents proximity labels from being nonsensical
 * (e.g. "15 min walk from your hotel in London" for an afternoon slot in Oxford).
 *
 * Returns slot IDs where a geographic reset occurs (the slot AFTER the jump).
 */
export function detectTransportResets(anchors: PlacedAnchor[], thresholdMi = 10): string[] {
  const resets: string[] = [];
  for (let i = 1; i < anchors.length; i++) {
    const d = distMi(anchors[i - 1].lat, anchors[i - 1].lng, anchors[i].lat, anchors[i].lng);
    if (d > thresholdMi) {
      resets.push(anchors[i].slotId);
    }
  }
  return resets;
}

/**
 * Split anchors into geographic segments at transport reset points.
 * Each segment is a contiguous group of anchors in the same geographic area.
 */
export function splitByTransportResets(anchors: PlacedAnchor[], thresholdMi = 10): PlacedAnchor[][] {
  if (anchors.length === 0) return [];
  const segments: PlacedAnchor[][] = [[anchors[0]]];

  for (let i = 1; i < anchors.length; i++) {
    const d = distMi(anchors[i - 1].lat, anchors[i - 1].lng, anchors[i].lat, anchors[i].lng);
    if (d > thresholdMi) {
      segments.push([anchors[i]]);
    } else {
      segments[segments.length - 1].push(anchors[i]);
    }
  }
  return segments;
}

// ─── Missing Coordinates Nudge ───────────────────────────────────────────────

/**
 * Count how many pool items are missing coordinates.
 * Returns a nudge message if > 20% of items lack lat/lng.
 */
export function missingCoordsNudge(
  poolItems: ImportedPlace[],
): { count: number; total: number; message: string } | null {
  const total = poolItems.length;
  if (total === 0) return null;

  const missing = poolItems.filter(p => !getCoords(p)).length;
  if (missing === 0) return null;

  const pct = missing / total;
  if (pct < 0.2) return null;

  return {
    count: missing,
    total,
    message: `${missing} place${missing > 1 ? 's' : ''} missing location data — proximity labels unavailable for these`,
  };
}
