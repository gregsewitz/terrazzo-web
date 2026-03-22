import { create } from 'zustand';
import { ImportedPlace } from '@/types';

export type ImportMode = 'text' | 'url' | 'google-maps' | 'email';

// ─── State shape ────────────────────────────────────────────────────────────

interface ImportState {
  // Drawer state
  isOpen: boolean;
  mode: ImportMode;
  inputValue: string;
  isProcessing: boolean;
  detectedCount: number;
  error: string | null;
  emailConnected: boolean;

  // Background task state
  isMinimized: boolean;
  progressPercent: number;
  progressLabel: string;
  discoveredNames: string[];
  importResults: ImportedPlace[];
  selectedIds: string[];
  sourceName: string;
  backgroundError: string | null;

  // Unified patch setter — update any subset of state in one call
  patch: (partial: Partial<Omit<ImportState, 'patch' | 'reset' | 'resetBackgroundTask'>>) => void;

  // Convenience compound actions
  setProgress: (percent: number, label: string) => void;
  reset: () => void;
  resetBackgroundTask: () => void;
}

// ─── Defaults ───────────────────────────────────────────────────────────────

const DRAWER_DEFAULTS = {
  isOpen: false,
  mode: 'text' as ImportMode,
  inputValue: '',
  isProcessing: false,
  detectedCount: 0,
  error: null as string | null,
  emailConnected: false,
};

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

// ─── Store ──────────────────────────────────────────────────────────────────

export const useImportStore = create<ImportState>((set) => ({
  ...DRAWER_DEFAULTS,
  ...BACKGROUND_DEFAULTS,

  patch: (partial) => set(partial),

  setProgress: (percent, label) => set({ progressPercent: percent, progressLabel: label }),

  reset: () => set({ ...DRAWER_DEFAULTS, ...BACKGROUND_DEFAULTS }),

  resetBackgroundTask: () => set(BACKGROUND_DEFAULTS),
}));
