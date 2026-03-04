'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '@/lib/api-client';
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

  // ── Fetch ──────────────────────────────────────────────────────────────

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{
        reservations: StagedReservation[];
        counts: { pending: number; confirmed: number; dismissed: number };
      }>('/api/email/reservations?status=pending');

      setReservations(data.reservations || []);
      setCounts(data.counts || { pending: 0, confirmed: 0, dismissed: 0 });

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

  const historyReservations = useMemo(
    () => filterByType(reservations.filter(isPastReservation), typeFilter),
    [reservations, typeFilter]
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

      // Clear selections and refresh
      setSelectedIds(new Set());
      setRatings(new Map());
      setCreatedTrips([]);
      await fetchReservations();

      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      throw err;
    } finally {
      setImporting(false);
    }
  }, [selectedIds, reservations, tripLinkEnabled, ratings, visibleIds, fetchReservations, createdTrips]);

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

    // UI state
    activeTab,
    selectedIds,
    tripLinkEnabled,
    ratings,
    typeFilter,
    loading,
    importing,
    creatingTrip,
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
    importSelected,
    dismissSelected,
  };
}
