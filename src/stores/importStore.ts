import { create } from 'zustand';
import { ImportedPlace } from '@/types';

export type ImportMode = 'text' | 'url' | 'google-maps' | 'email';

interface ImportState {
  // ── Drawer state (existing) ─────────────────────────────────────────────
  isOpen: boolean;
  mode: ImportMode;
  inputValue: string;
  isProcessing: boolean;
  detectedCount: number;
  error: string | null;
  emailConnected: boolean;

  // ── Background task state (new) ─────────────────────────────────────────
  isMinimized: boolean;              // true = show floating bar, false = show full drawer
  progressPercent: number;           // 0-100
  progressLabel: string;             // "Looking up places…", "Done!", etc.
  discoveredNames: string[];         // place names discovered during extraction
  importResults: ImportedPlace[];    // final imported places
  selectedIds: string[];             // IDs selected for saving (array for Zustand compat)
  sourceName: string;                // "CN Traveller", "Google Maps", etc.
  backgroundError: string | null;    // error during background processing

  // ── Drawer actions (existing) ───────────────────────────────────────────
  setOpen: (open: boolean) => void;
  setMode: (mode: ImportMode) => void;
  setInputValue: (value: string) => void;
  setProcessing: (processing: boolean) => void;
  setDetectedCount: (count: number) => void;
  setError: (error: string | null) => void;
  setEmailConnected: (connected: boolean) => void;
  reset: () => void;

  // ── Background task actions (new) ───────────────────────────────────────
  setMinimized: (minimized: boolean) => void;
  setProgress: (percent: number, label: string) => void;
  setDiscoveredNames: (names: string[]) => void;
  setImportResults: (places: ImportedPlace[]) => void;
  setSelectedIds: (ids: string[]) => void;
  setSourceName: (name: string) => void;
  setBackgroundError: (error: string | null) => void;
  resetBackgroundTask: () => void;
}

const BACKGROUND_DEFAULTS = {
  isMinimized: false,
  progressPercent: 0,
  progressLabel: '',
  discoveredNames: [] as string[],
  importResults: [] as ImportedPlace[],
  selectedIds: [] as string[],
  sourceName: '',
  backgroundError: null as string | null,
};

export const useImportStore = create<ImportState>((set) => ({
  // Existing defaults
  isOpen: false,
  mode: 'text',
  inputValue: '',
  isProcessing: false,
  detectedCount: 0,
  error: null,
  emailConnected: false,

  // Background defaults
  ...BACKGROUND_DEFAULTS,

  // Existing actions
  setOpen: (open) => set({ isOpen: open }),
  setMode: (mode) => set({ mode, error: null }),
  setInputValue: (value) => set({ inputValue: value }),
  setProcessing: (processing) => set({ isProcessing: processing }),
  setDetectedCount: (count) => set({ detectedCount: count }),
  setError: (error) => set({ error }),
  setEmailConnected: (connected) => set({ emailConnected: connected }),
  reset: () => set({
    isOpen: false, inputValue: '', isProcessing: false, detectedCount: 0, error: null,
    ...BACKGROUND_DEFAULTS,
  }),

  // Background actions
  setMinimized: (minimized) => set({ isMinimized: minimized }),
  setProgress: (percent, label) => set({ progressPercent: percent, progressLabel: label }),
  setDiscoveredNames: (names) => set({ discoveredNames: names }),
  setImportResults: (places) => set({ importResults: places }),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  setSourceName: (name) => set({ sourceName: name }),
  setBackgroundError: (error) => set({ backgroundError: error }),
  resetBackgroundTask: () => set(BACKGROUND_DEFAULTS),
}));
