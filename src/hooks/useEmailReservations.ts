'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useSavedStore, type DBSavedPlace, type DBCollection } from '@/stores/savedStore';
import type { ReactionId } from '@/types';
import {
  type StagedReservation,
  isFutureReservation,
  isPastReservation,
  isStandaloneFlight,
  groupByTrip,
  groupByYear,
  filterByType,
} from '@/lib/email-reservations-helpers';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ActiveTab = 'upcoming' | 'history';

interface BatchConfirmPayload {
  reservationIds: string[];
  tripLinks: Record<string, { tripId: string; dayNumber?: number; slotId?: string }>;
  ratings: Record<string, ReactionId>;
}

interface BatchConfirmResponse {
  confirmed: number;
  savedPlaceIds: string[];
  enrichmentTriggered: number;
  errors: Array<{ id: string; error: string }>;
}

/** Minimal trip info for the picker */
export interface TripOption {
  id: string;
  name: string;
  location: string;
  startDate: string | null;
  endDate: string | null;
}

/** Minimal collection info for the picker */
export interface CollectionOption {
  id: string;
  name: string;
  emoji: string;
  placeCount: number;
}

/** A trip created inline for unmatched reservations */
interface CreatedTripLink {
  tripId: string;
  tripName: string;
  reservationIds: string[];
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useEmailReservations() {
  // Core data
  const [reservations, setReservations] = useState<StagedReservation[]>([]);
  const [counts, setCounts] = useState({ pending: 0, confirmed: 0, dismissed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<ActiveTab>('upcoming');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tripLinkEnabled, setTripLinkEnabled] = useState<Map<string, boolean>>(new Map());
  const [ratings, setRatings] = useState<Map<string, ReactionId>>(new Map());
  const [typeFilter, setTypeFilter] = useState('all');
  const [importing, setImporting] = useState(false);
  const [createdTrips, setCreatedTrips] = useState<CreatedTripLink[]>([]);
  const [creatingTrip, setCreatingTrip] = useState(false);
  const [existingTrips, setExistingTrips] = useState<TripOption[]>([]);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [creatingCollection, setCreatingCollection] = useState(false);

  // Per-reservation trip assignments (reservationId → { tripId, tripName })
  const [perReservationTrips, setPerReservationTrips] = useState<Map<string, { tripId: string; tripName: string }>>(new Map());

  // ── Fetch ──────────────────────────────────────────────────────────────

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, tripsData, collectionsData] = await Promise.all([
        apiFetch<{
          reservations: StagedReservation[];
          counts: { pending: number; confirmed: number; dismissed: number };
        }>('/api/email/reservations?status=pending'),
        apiFetch<{ trips: TripOption[] }>('/api/trips/mine'),
        apiFetch<{ collections: Array<{ id: string; name: string; emoji: string; placeIds: string[] | unknown }> }>(
          '/api/collections'
        ),
      ]);

      setReservations(data.reservations || []);
      setCounts(data.counts || { pending: 0, confirmed: 0, dismissed: 0 });
      setExistingTrips((tripsData.trips || []).map(t => ({
        id: t.id,
        name: t.name,
        location: t.location,
        startDate: t.startDate,
        endDate: t.endDate,
      })));
      setCollections((collectionsData.collections || []).map(c => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji || 'sparkle',
        placeCount: Array.isArray(c.placeIds) ? c.placeIds.length : 0,
      })));

      // Initialize trip link toggles (default ON for matched trips)
      const tripLinks = new Map<string, boolean>();
      for (const r of data.reservations || []) {
        if (r.matchedTripId && !tripLinks.has(r.matchedTripId)) {
          tripLinks.set(r.matchedTripId, true);
        }
      }
      setTripLinkEnabled(tripLinks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reservations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // ── Derived data ───────────────────────────────────────────────────────

  const upcomingReservations = useMemo(
    () => reservations.filter(r => isFutureReservation(r) && !isStandaloneFlight(r)),
    [reservations]
  );

  const allHistoryReservations = useMemo(
    () => reservations.filter(isPastReservation),
    [reservations]
  );

  const historyReservations = useMemo(
    () => filterByType(allHistoryReservations, typeFilter),
    [allHistoryReservations, typeFilter]
  );

  const tripGroups = useMemo(() => {
    const groups = groupByTrip(upcomingReservations);

    // If a trip was created for the unmatched group, update it
    if (createdTrips.length > 0) {
      return groups.map(g => {
        if (g.tripId !== null) return g;

        // Check if any created trip covers this group's reservations
        const match = createdTrips.find(ct =>
          g.reservations.some(r => ct.reservationIds.includes(r.id))
        );
        if (match) {
          return { ...g, tripId: match.tripId, tripName: match.tripName };
        }
        return g;
      });
    }

    return groups;
  }, [upcomingReservations, createdTrips]);
  const yearGroups = useMemo(() => groupByYear(historyReservations), [historyReservations]);

  // Visible IDs for current tab (for select all)
  const visibleIds = useMemo(() => {
    const items = activeTab === 'upcoming' ? upcomingReservations : historyReservations;
    return new Set(items.map(r => r.id));
  }, [activeTab, upcomingReservations, historyReservations]);

  // Count of selected items visible in current tab
  const selectedCount = useMemo(() => {
    let count = 0;
    for (const id of selectedIds) {
      if (visibleIds.has(id)) count++;
    }
    return count;
  }, [selectedIds, visibleIds]);

  // ── Selection ──────────────────────────────────────────────────────────

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const id of visibleIds) next.add(id);
      return next;
    });
  }, [visibleIds]);

  const deselectAll = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const id of visibleIds) next.delete(id);
      return next;
    });
  }, [visibleIds]);

  // ── Trip linking ───────────────────────────────────────────────────────

  const toggleTripLink = useCallback((tripId: string) => {
    setTripLinkEnabled(prev => {
      const next = new Map(prev);
      next.set(tripId, !next.get(tripId));
      return next;
    });
  }, []);

  // ── Ratings ────────────────────────────────────────────────────────────

  const setRating = useCallback((reservationId: string, reactionId: ReactionId) => {
    setRatings(prev => {
      const next = new Map(prev);
      // Toggle off if same reaction clicked again
      if (next.get(reservationId) === reactionId) {
        next.delete(reservationId);
      } else {
        next.set(reservationId, reactionId);
      }
      return next;
    });
  }, []);

  // ── Create trip for unmatched group ───────────────────────────────────

  const createTripForGroup = useCallback(async (
    tripName: string,
    groupReservationIds: string[],
  ) => {
    setCreatingTrip(true);
    setError(null);
    try {
      // Derive location and date range from the reservations
      const groupItems = reservations.filter(r => groupReservationIds.includes(r.id));
      const locations = [...new Set(groupItems.map(r => r.location).filter(Boolean))] as string[];
      const dates = groupItems
        .map(r => r.reservationDate || r.checkInDate)
        .filter(Boolean)
        .map(d => new Date(d!))
        .sort((a, b) => a.getTime() - b.getTime());

      const location = locations[0] || 'Unknown';
      const startDate = dates[0] ? dates[0].toISOString().split('T')[0] : undefined;
      const endDate = dates.length > 1 ? dates[dates.length - 1].toISOString().split('T')[0] : startDate;

      // Create trip via existing API
      const res = await apiFetch<{ trip?: { id: string } }>('/api/trips/mine', {
        method: 'POST',
        body: JSON.stringify({
          name: tripName,
          location,
          destinations: locations.length > 0 ? locations : [location],
          startDate,
          endDate,
          days: [], // Will be populated when user opens the trip
          pool: [],
          status: 'dreaming', // Start as dreaming — user can graduate to planning later
        }),
      });

      const tripId = res?.trip?.id;
      if (!tripId) throw new Error('Trip creation failed — no ID returned');

      // Store the link and enable trip-linking by default
      setCreatedTrips(prev => [...prev, {
        tripId,
        tripName,
        reservationIds: groupReservationIds,
      }]);
      setTripLinkEnabled(prev => {
        const next = new Map(prev);
        next.set(tripId, true);
        return next;
      });

      return tripId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create trip');
      return null;
    } finally {
      setCreatingTrip(false);
    }
  }, [reservations]);

  // ── Collection management ────────────────────────────────────────

  const selectCollection = useCallback((id: string | null) => {
    setSelectedCollectionId(id);
  }, []);

  const createCollectionInline = useCallback(async (name: string) => {
    setCreatingCollection(true);
    try {
      const res = await apiFetch<{ collection?: { id: string; name: string; emoji: string } }>(
        '/api/collections',
        { method: 'POST', body: JSON.stringify({ name, emoji: 'sparkle' }) }
      );
      const col = res?.collection;
      if (!col) throw new Error('Collection creation failed');

      const newOption: CollectionOption = {
        id: col.id,
        name: col.name,
        emoji: col.emoji || 'sparkle',
        placeCount: 0,
      };
      setCollections(prev => [newOption, ...prev]);
      setSelectedCollectionId(col.id);
      return col.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create collection');
      return null;
    } finally {
      setCreatingCollection(false);
    }
  }, []);

  /** Link unmatched reservations to an existing trip (no API call — just sets up the trip link for batch-confirm) */
  const addToExistingTrip = useCallback((
    tripId: string,
    tripName: string,
    groupReservationIds: string[],
  ) => {
    setCreatedTrips(prev => [...prev, {
      tripId,
      tripName,
      reservationIds: groupReservationIds,
    }]);
    setTripLinkEnabled(prev => {
      const next = new Map(prev);
      next.set(tripId, true);
      return next;
    });
  }, []);

  /** Remove a manual trip assignment so the user can pick a different trip */
  const removeTripAssignment = useCallback((groupReservationIds: string[]) => {
    setCreatedTrips(prev => prev.filter(ct =>
      !groupReservationIds.some(id => ct.reservationIds.includes(id))
    ));
  }, []);

  /** Assign a single reservation to a trip */
  const assignReservationToTrip = useCallback((
    reservationId: string,
    tripId: string,
    tripName: string,
  ) => {
    setPerReservationTrips(prev => {
      const next = new Map(prev);
      next.set(reservationId, { tripId, tripName });
      return next;
    });
    // Also enable the trip link for this trip so batch-confirm includes it
    setTripLinkEnabled(prev => {
      const next = new Map(prev);
      if (!next.has(tripId)) next.set(tripId, true);
      return next;
    });
  }, []);

  /** Remove a single reservation's trip assignment */
  const removeReservationTrip = useCallback((reservationId: string) => {
    setPerReservationTrips(prev => {
      const next = new Map(prev);
      next.delete(reservationId);
      return next;
    });
  }, []);

  // ── Batch actions ──────────────────────────────────────────────────────

  const importSelected = useCallback(async () => {
    setImporting(true);
    setError(null);
    try {
      // Build trip links for selected upcoming items
      const tripLinksPayload: BatchConfirmPayload['tripLinks'] = {};
      for (const r of reservations) {
        if (!selectedIds.has(r.id)) continue;

        // Check matched trips (from email scanning)
        if (r.matchedTripId && tripLinkEnabled.get(r.matchedTripId)) {
          tripLinksPayload[r.id] = {
            tripId: r.matchedTripId,
            dayNumber: r.suggestedDayNumber ?? undefined,
            slotId: r.suggestedSlotId ?? undefined,
          };
          continue;
        }

        // Check per-reservation trip assignments
        const perResTrip = perReservationTrips.get(r.id);
        if (perResTrip && tripLinkEnabled.get(perResTrip.tripId) !== false) {
          tripLinksPayload[r.id] = { tripId: perResTrip.tripId };
          continue;
        }

        // Check newly created trips (from "Create a trip" flow)
        for (const ct of createdTrips) {
          if (ct.reservationIds.includes(r.id) && tripLinkEnabled.get(ct.tripId)) {
            tripLinksPayload[r.id] = { tripId: ct.tripId };
            break;
          }
        }
      }

      // Build ratings payload
      const ratingsPayload: Record<string, ReactionId> = {};
      for (const [id, reaction] of ratings) {
        if (selectedIds.has(id)) {
          ratingsPayload[id] = reaction;
        }
      }

      const payload: BatchConfirmPayload = {
        reservationIds: Array.from(selectedIds).filter(id => visibleIds.has(id)),
        tripLinks: tripLinksPayload,
        ratings: ratingsPayload,
      };

      const result = await apiFetch<BatchConfirmResponse>(
        '/api/email/reservations/batch-confirm',
        { method: 'POST', body: JSON.stringify(payload) }
      );

      // Add saved places to selected collection (if any)
      if (selectedCollectionId && result.savedPlaceIds?.length) {
        try {
          // Fetch current placeIds for the collection, then append
          const colData = await apiFetch<{ collections: Array<{ id: string; placeIds: string[] | unknown }> }>(
            '/api/collections'
          );
          const col = (colData.collections || []).find(c => c.id === selectedCollectionId);
          const existingPlaceIds = Array.isArray(col?.placeIds) ? col.placeIds as string[] : [];
          const mergedIds = [...new Set([...existingPlaceIds, ...result.savedPlaceIds])];

          await apiFetch(`/api/collections/${selectedCollectionId}`, {
            method: 'PATCH',
            body: JSON.stringify({ placeIds: mergedIds }),
          });
        } catch (err) {
          console.error('[import] Failed to add places to collection:', err);
          // Don't fail the import — collection linking is best-effort
        }
      }

      // Clear selections and refresh
      setSelectedIds(new Set());
      setRatings(new Map());
      setCreatedTrips([]);
      setPerReservationTrips(new Map());
      setSelectedCollectionId(null);
      await fetchReservations();

      // Rehydrate the library store so new places appear immediately on navigation
      try {
        const freshData = await apiFetch<{ places: DBSavedPlace[]; collections: DBCollection[] }>('/api/places/mine');
        useSavedStore.getState().hydrateFromDB(freshData.places || [], freshData.collections || []);
      } catch {
        // Best-effort — library will still refresh on next hard navigation
      }

      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      throw err;
    } finally {
      setImporting(false);
    }
  }, [selectedIds, reservations, tripLinkEnabled, ratings, visibleIds, fetchReservations, createdTrips, perReservationTrips]);

  const dismissSelected = useCallback(async () => {
    setImporting(true);
    setError(null);
    try {
      const ids = Array.from(selectedIds).filter(id => visibleIds.has(id));
      await apiFetch('/api/email/reservations/batch-dismiss', {
        method: 'POST',
        body: JSON.stringify({ reservationIds: ids }),
      });

      setSelectedIds(new Set());
      await fetchReservations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dismiss failed');
    } finally {
      setImporting(false);
    }
  }, [selectedIds, visibleIds, fetchReservations]);

  // ── Tab switching ──────────────────────────────────────────────────────

  const switchTab = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    setTypeFilter('all');
  }, []);

  return {
    // Data
    reservations,
    counts,
    tripGroups,
    yearGroups,
    upcomingReservations,
    historyReservations,
    allHistoryReservations,

    // UI state
    activeTab,
    selectedIds,
    tripLinkEnabled,
    ratings,
    typeFilter,
    loading,
    importing,
    creatingTrip,
    existingTrips,
    collections,
    selectedCollectionId,
    creatingCollection,
    error,
    selectedCount,
    visibleIds,

    // Actions
    switchTab,
    toggleSelect,
    selectAllVisible,
    deselectAll,
    toggleTripLink,
    setRating,
    setTypeFilter,
    createTripForGroup,
    addToExistingTrip,
    removeTripAssignment,
    createdTrips,
    perReservationTrips,
    assignReservationToTrip,
    removeReservationTrip,
    selectCollection,
    createCollectionInline,
    importSelected,
    dismissSelected,
  };
}
