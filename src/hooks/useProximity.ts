/**
 * useProximity — Proximity intelligence hook for the day planner.
 *
 * Computes geographic context for pool items based on placed items on the active day.
 * Supports two states:
 *   State 1 (day-scoped): no slot selected, labels show distance to nearest placed item
 *   State 2 (slot-selected): slot tapped, labels show route coherence relative to adjacent anchors
 *
 * All computation is client-side using existing lat/lng data. No API calls.
 */

import { useMemo, useState, useEffect, useRef } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { usePoolStore } from '@/stores/poolStore';
import type { ImportedPlace, TripDay } from '@/types';
import {
  extractPlacedAnchors,
  findSlotAnchors,
  adaptiveRadius,
  computeClusters,
  computeColdStartClusters,
  segmentPool,
  scoreForSlot,
  getCoords,
  getHotelCoords,
  splitByTransportResets,
  missingCoordsNudge,
  SORT_DEBOUNCE_MS,
  type PlacedAnchor,
  type GeoCluster,
  type SegmentedPool,
  type ProximityLabel,
  type RouteCoherenceResult,
} from '@/lib/proximity';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProximityState {
  /** Current mode */
  mode: 'day-scoped' | 'slot-selected' | 'cold-start' | 'no-data';

  /** Placed anchors on the active day (ordered by slot) */
  anchors: PlacedAnchor[];

  /** Adaptive cluster radius in miles */
  radiusMi: number;

  /** Geographic clusters for filter chips */
  clusters: GeoCluster[];

  /** Pool segmented into "fits your day" and "elsewhere" (State 1) */
  segmented: SegmentedPool | null;

  /** Pool scored by route coherence (State 2 — only when slot is selected) */
  slotScored: Array<ImportedPlace & { routeCoherence: RouteCoherenceResult }> | null;

  /** The active day's destination name */
  activeDestination: string | null;

  /** Nudge message when many pool items lack coordinates */
  missingCoordsNudge: { count: number; total: number; message: string } | null;

  /** Geographic segments (groups of anchors separated by transport resets) */
  geoSegments: PlacedAnchor[][];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProximity(
  filteredPicks: ImportedPlace[],
  selectedDay: number | null,
): ProximityState {
  const trip = useTripStore(s => s.trips.find(t => t.id === s.currentTripId));
  const slotContext = usePoolStore(s => s.slotContext);

  // Active day
  const activeDay: TripDay | null = useMemo(() => {
    if (selectedDay === null || !trip) return null;
    return trip.days.find(d => d.dayNumber === selectedDay) ?? null;
  }, [trip, selectedDay]);

  const activeDestination = activeDay?.destination ?? null;

  // Extract placed anchors for the active day
  const anchors = useMemo(() => {
    if (!activeDay) return [];
    return extractPlacedAnchors(activeDay);
  }, [activeDay]);

  // Hotel coordinates
  const hotelCoords = useMemo(() => {
    return getHotelCoords(activeDay?.hotelInfo);
  }, [activeDay]);

  // Adaptive radius from placed items
  const radiusMi = useMemo(() => {
    return adaptiveRadius(anchors);
  }, [anchors]);

  // Pool items with coordinates (for clustering)
  const poolWithCoords = useMemo(() => {
    return filteredPicks
      .map(item => {
        const coords = getCoords(item);
        if (!coords) return null;
        return {
          id: item.id,
          lat: coords.lat,
          lng: coords.lng,
          name: item.name,
          address: item.google?.address,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }, [filteredPicks]);

  // Determine mode
  const mode: ProximityState['mode'] = useMemo(() => {
    if (anchors.length === 0 && !hotelCoords) {
      return poolWithCoords.length > 0 ? 'cold-start' : 'no-data';
    }
    if (slotContext) return 'slot-selected';
    return 'day-scoped';
  }, [anchors.length, hotelCoords, slotContext, poolWithCoords.length]);

  // Clusters
  const clusters = useMemo((): GeoCluster[] => {
    if (mode === 'cold-start') {
      return computeColdStartClusters(poolWithCoords);
    }
    if (mode === 'no-data') return [];
    return computeClusters(poolWithCoords, anchors, radiusMi);
  }, [mode, poolWithCoords, anchors, radiusMi]);

  // State 1: Day-scoped segmentation
  const segmented = useMemo((): SegmentedPool | null => {
    if (mode !== 'day-scoped' && mode !== 'cold-start') return null;
    if (anchors.length === 0 && !hotelCoords) {
      // Cold start — everything is "elsewhere" with no labels
      return {
        fitsYourDay: [],
        elsewhere: filteredPicks.map(item => ({
          ...item,
          proximityLabel: { text: '', distanceMi: Infinity, tier: 'none' as const },
        })),
      };
    }
    return segmentPool(filteredPicks, anchors, radiusMi, hotelCoords);
  }, [mode, filteredPicks, anchors, radiusMi, hotelCoords]);

  // Geographic segments (split at transport resets)
  const geoSegments = useMemo(() => {
    return splitByTransportResets(anchors);
  }, [anchors]);

  // State 2: Slot-selected scoring (with transport-aware anchor selection)
  const slotScoredRaw = useMemo(() => {
    if (mode !== 'slot-selected' || !slotContext) return null;

    // If there are transport resets, find which segment the target slot belongs to
    // and only use anchors from that segment for route coherence
    let segmentAnchors = anchors;
    if (geoSegments.length > 1) {
      const targetSlotIndex = ['breakfast', 'morning', 'lunch', 'afternoon', 'dinner', 'evening'].indexOf(slotContext.slotId);
      for (const segment of geoSegments) {
        const minIdx = Math.min(...segment.map(a => a.slotIndex));
        const maxIdx = Math.max(...segment.map(a => a.slotIndex));
        if (targetSlotIndex >= minIdx - 1 && targetSlotIndex <= maxIdx + 1) {
          segmentAnchors = segment;
          break;
        }
      }
    }

    const { prev, next } = findSlotAnchors(segmentAnchors, slotContext.slotId, hotelCoords);
    return scoreForSlot(filteredPicks, slotContext.slotId, prev, next);
  }, [mode, slotContext, anchors, geoSegments, filteredPicks, hotelCoords]);

  // Debounce slot scoring to avoid visual churn during rapid placement
  const [slotScored, setSlotScored] = useState(slotScoredRaw);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSlotScored(slotScoredRaw);
    }, SORT_DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [slotScoredRaw]);

  // Missing coords nudge
  const coordsNudge = useMemo(() => {
    return missingCoordsNudge(filteredPicks);
  }, [filteredPicks]);

  return {
    mode,
    anchors,
    radiusMi,
    clusters,
    segmented,
    slotScored,
    activeDestination,
    missingCoordsNudge: coordsNudge,
    geoSegments,
  };
}

export type { ProximityLabel, RouteCoherenceResult, GeoCluster, PlacedAnchor };
