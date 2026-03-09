import { create } from 'zustand';
import { createCoreSlice, type TripCoreState, type DBTrip } from './trip/tripCoreSlice';
import { createPlacementSlice, type TripPlacementState } from './trip/tripPlacementSlice';
import { createDaySlice, type TripDayState } from './trip/tripDaySlice';
import { createDreamBoardSlice, type TripDreamBoardState } from './trip/tripDreamBoardSlice';
import { createHistorySlice, type TripHistoryState } from './trip/tripHistorySlice';
import type { TripState } from './trip/types';

// ═══════════════════════════════════════════
// Composed trip store (single store with all slices)
// ═══════════════════════════════════════════

export const useTripStore = create<TripState>((...args) => ({
  ...createCoreSlice(...args),
  ...createPlacementSlice(...args),
  ...createDaySlice(...args),
  ...createDreamBoardSlice(...args),
  ...createHistorySlice(...args),
}));

// ═══════════════════════════════════════════
// Re-exports for consumers
// ═══════════════════════════════════════════

export type { DBTrip };
