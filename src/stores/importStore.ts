import { create } from 'zustand';

export type ImportMode = 'text' | 'url' | 'google-maps' | 'email';

interface ImportState {
  isOpen: boolean;
  mode: ImportMode;
  inputValue: string;
  isProcessing: boolean;
  detectedCount: number;
  error: string | null;
  emailConnected: boolean;

  setOpen: (open: boolean) => void;
  setMode: (mode: ImportMode) => void;
  setInputValue: (value: string) => void;
  setProcessing: (processing: boolean) => void;
  setDetectedCount: (count: number) => void;
  setError: (error: string | null) => void;
  setEmailConnected: (connected: boolean) => void;
  reset: () => void;
}

export const useImportStore = create<ImportState>((set) => ({
  isOpen: false,
  mode: 'text',
  inputValue: '',
  isProcessing: false,
  detectedCount: 0,
  error: null,
  emailConnected: false,

  setOpen: (open) => set({ isOpen: open }),
  setMode: (mode) => set({ mode, inputValue: '', error: null }),
  setInputValue: (value) => set({ inputValue: value }),
  setProcessing: (processing) => set({ isProcessing: processing }),
  setDetectedCount: (count) => set({ detectedCount: count }),
  setError: (error) => set({ error }),
  setEmailConnected: (connected) => set({ emailConnected: connected }),
  reset: () => set({ isOpen: false, inputValue: '', isProcessing: false, detectedCount: 0, error: null }),
}));
