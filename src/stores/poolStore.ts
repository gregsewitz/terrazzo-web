import { create } from 'zustand';
import { PlaceType } from '@/types';

export type SortMode = 'match' | 'type' | 'source';
export type FilterType = 'all' | 'restaurant' | 'museum' | 'activity' | 'hotel' | 'neighborhood' | 'bar' | 'cafe' | 'shop';

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

interface PoolState {
  sortMode: SortMode;
  filterType: FilterType;
  isExpanded: boolean;
  searchQuery: string;
  slotContext: SlotContext | null; // set when pool opened from a specific slot

  setSortMode: (mode: SortMode) => void;
  setFilterType: (type: FilterType) => void;
  setExpanded: (expanded: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSlotContext: (ctx: SlotContext | null) => void;
  openForSlot: (ctx: SlotContext) => void; // expand + set context in one call
}

export const usePoolStore = create<PoolState>((set) => ({
  sortMode: 'match',
  filterType: 'all',
  isExpanded: false,
  searchQuery: '',
  slotContext: null,

  setSortMode: (mode) => set({ sortMode: mode }),
  setFilterType: (type) => set({ filterType: type }),
  setExpanded: (expanded) => set(expanded ? { isExpanded: true } : { isExpanded: false, slotContext: null, filterType: 'all' }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSlotContext: (ctx) => set({ slotContext: ctx }),
  openForSlot: (ctx) => set({ isExpanded: true, slotContext: ctx, filterType: 'all' }),
}));
