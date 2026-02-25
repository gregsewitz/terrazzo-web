import { create } from 'zustand';
import type { ImportedPlace } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type AddBarMode = 'idle' | 'search' | 'importing' | 'preview' | 'collections';

export interface AddBarState {
  // Visibility
  isOpen: boolean;
  mode: AddBarMode;

  // Search
  query: string;
  libraryResults: ImportedPlace[];
  googleResults: Array<{
    name: string;
    placeId: string;
    address?: string;
    type: string;
    lat?: number;
    lng?: number;
    photoUrl?: string;
  }>;

  // Import (inline URL/text)
  importProgress: number;
  importLabel: string;
  importResults: ImportedPlace[];

  // Preview (single place before save)
  previewPlace: ImportedPlace | null;

  // Collection tagging (post-save step)
  selectedCollectionIds: string[];

  // Trip context (when opened from trip planner)
  tripContext: {
    tripId: string;
    dayIndex: number;
    destination?: string;
  } | null;

  // Actions
  open: (tripContext?: AddBarState['tripContext']) => void;
  close: () => void;
  setQuery: (q: string) => void;
  setMode: (mode: AddBarMode) => void;
  setLibraryResults: (results: ImportedPlace[]) => void;
  setGoogleResults: (results: AddBarState['googleResults']) => void;
  setImportProgress: (percent: number, label: string) => void;
  setImportResults: (results: ImportedPlace[]) => void;
  setPreviewPlace: (place: ImportedPlace | null) => void;
  toggleCollection: (id: string) => void;
  setSelectedCollections: (ids: string[]) => void;
  reset: () => void;
}

// ─── Defaults ───────────────────────────────────────────────────────────────

const DEFAULTS = {
  isOpen: false,
  mode: 'idle' as AddBarMode,
  query: '',
  libraryResults: [] as ImportedPlace[],
  googleResults: [] as AddBarState['googleResults'],
  importProgress: 0,
  importLabel: '',
  importResults: [] as ImportedPlace[],
  previewPlace: null as ImportedPlace | null,
  selectedCollectionIds: [] as string[],
  tripContext: null as AddBarState['tripContext'],
};

// ─── Store ──────────────────────────────────────────────────────────────────

export const useAddBarStore = create<AddBarState>((set) => ({
  ...DEFAULTS,

  open: (tripContext) => set({
    isOpen: true,
    mode: 'search',
    tripContext: tripContext ?? null,
  }),

  close: () => set(DEFAULTS),

  setQuery: (query) => set({ query }),
  setMode: (mode) => set({ mode }),
  setLibraryResults: (libraryResults) => set({ libraryResults }),
  setGoogleResults: (googleResults) => set({ googleResults }),

  setImportProgress: (percent, label) => set({
    importProgress: percent,
    importLabel: label,
  }),

  setImportResults: (importResults) => set({ importResults }),
  setPreviewPlace: (previewPlace) => set({ previewPlace }),

  toggleCollection: (id) => set((s) => {
    const next = new Set(s.selectedCollectionIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { selectedCollectionIds: Array.from(next) };
  }),

  setSelectedCollections: (ids) => set({ selectedCollectionIds: ids }),
  reset: () => set(DEFAULTS),
}));
