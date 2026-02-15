import { create } from 'zustand';

export type SortMode = 'match' | 'type' | 'source';
export type FilterType = 'all' | 'restaurant' | 'museum' | 'activity' | 'hotel' | 'neighborhood' | 'bar' | 'cafe' | 'shop';

interface PoolState {
  sortMode: SortMode;
  filterType: FilterType;
  isExpanded: boolean;
  searchQuery: string;
  
  setSortMode: (mode: SortMode) => void;
  setFilterType: (type: FilterType) => void;
  setExpanded: (expanded: boolean) => void;
  setSearchQuery: (query: string) => void;
}

export const usePoolStore = create<PoolState>((set) => ({
  sortMode: 'match',
  filterType: 'all',
  isExpanded: false,
  searchQuery: '',

  setSortMode: (mode) => set({ sortMode: mode }),
  setFilterType: (type) => set({ filterType: type }),
  setExpanded: (expanded) => set({ isExpanded: expanded }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));
