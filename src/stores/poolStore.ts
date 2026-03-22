import { create } from 'zustand';
import { PlaceType } from '@/types';

export type SortMode = 'match' | 'type' | 'source';
import type { FilterType } from '@/hooks/useTypeFilter';
export type { FilterType };

// Smart mapping: which place types are most relevant for each slot
export const SLOT_TYPE_AFFINITY: Record<string, PlaceType[]> = {
  breakfast: ['restaurant', 'cafe'],
  morning: ['museum', 'activity', 'neighborhood', 'shop'],
  lunch: ['restaurant', 'cafe', 'bar'],
  afternoon: ['museum', 'activity', 'neighborhood', 'shop'],
  dinner: ['restaurant', 'bar'],
  evening: ['bar', 'restaurant', 'activity'],
};

export interface SlotContext {
  slotId: string;
  slotLabel: string;
  dayNumber: number;
  adjacentPlaces: { before?: { name: string; type: PlaceType; location: string }; after?: { name: string; type: PlaceType; location: string } };
  suggestedTypes: PlaceType[];
}

/** Active cluster filter — when user taps a geographic cluster chip */
export interface ClusterFilter {
  label: string;
  placeIds: Set<string>;
}

interface PoolState {
  sortMode: SortMode;
  filterType: FilterType;
  isExpanded: boolean;
  searchQuery: string;
  slotContext: SlotContext | null; // set when pool opened from a specific slot
  clusterFilter: ClusterFilter | null; // active geographic cluster filter

  setSortMode: (mode: SortMode) => void;
  setFilterType: (type: FilterType) => void;
  setExpanded: (expanded: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSlotContext: (ctx: SlotContext | null) => void;
  openForSlot: (ctx: SlotContext) => void; // expand + set context in one call
  /** Primary action for empty slot tap — selects slot as browsing context */
  selectSlot: (ctx: SlotContext) => void;
  /** Deselect slot — return to State 1 */
  deselectSlot: () => void;
  /** Toggle a geographic cluster chip filter */
  toggleClusterFilter: (filter: ClusterFilter | null) => void;
}

export const usePoolStore = create<PoolState>((set) => ({
  sortMode: 'match',
  filterType: 'all',
  isExpanded: false,
  searchQuery: '',
  slotContext: null,
  clusterFilter: null,

  setSortMode: (mode) => set({ sortMode: mode }),
  setFilterType: (type) => set({ filterType: type }),
  setExpanded: (expanded) => set(expanded ? { isExpanded: true } : { isExpanded: false, slotContext: null, clusterFilter: null, filterType: 'all' }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSlotContext: (ctx) => set({ slotContext: ctx }),
  openForSlot: (ctx) => set({ isExpanded: true, slotContext: ctx, filterType: 'all' }),
  selectSlot: (ctx) => set({ isExpanded: true, slotContext: ctx, clusterFilter: null, filterType: 'all' }),
  deselectSlot: () => set({ slotContext: null, clusterFilter: null }),
  toggleClusterFilter: (filter) => set((state) => ({
    clusterFilter: state.clusterFilter?.label === filter?.label ? null : filter,
  })),
}));
