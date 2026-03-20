'use client';

import { useState, useEffect } from 'react';
import { useLibraryStore } from '@/stores/useLibraryStore';
import { useOnboardingStore } from '@/stores/onboardingStore';

const EVOLUTION_KEY = 'terrazzo_evolution_state';
const EXPAND_PROMPT_KEY = 'terrazzo_expand_mosaic_prompted';

interface EvolutionState {
  lastSignalCount: number;
  lastSavedCount: number;
  lastChecked: string;
}

function getEvolutionState(): EvolutionState {
  if (typeof window === 'undefined') return { lastSignalCount: 0, lastSavedCount: 0, lastChecked: '' };
  try {
    const raw = localStorage.getItem(EVOLUTION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore parse errors
  }
  return { lastSignalCount: 0, lastSavedCount: 0, lastChecked: '' };
}

function setEvolutionState(state: EvolutionState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(EVOLUTION_KEY, JSON.stringify(state));
}

export interface TasteEvolutionResult {
  /** Show the "your taste is evolving" notification */
  showEvolutionNotice: boolean;
  /** Show the "expand your mosaic" prompt */
  showExpandPrompt: boolean;
  /** Dismiss the evolution notice */
  dismissEvolution: () => void;
  /** Dismiss the expand prompt */
  dismissExpand: () => void;
  /** Number of new signals since last check */
  newSignalCount: number;
}

/**
 * Detects when enough new activity has occurred to suggest taste evolution.
 * Triggers after 2-3 sessions when the user has saved 5+ places since last check.
 */
export function useTasteEvolution(): TasteEvolutionResult {
  const [showEvolutionNotice, setShowEvolutionNotice] = useState(false);
  const [showExpandPrompt, setShowExpandPrompt] = useState(false);
  const [newSignalCount, setNewSignalCount] = useState(0);

  const myPlaces = useLibraryStore(s => s.myPlaces);
  const allSignals = useOnboardingStore(s => s.allSignals);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const state = getEvolutionState();
    const currentSavedCount = myPlaces.filter(p => !(p.source?.type === 'terrazzo' && p.source?.name === 'Terrazzo Picks')).length;
    const currentSignalCount = allSignals?.length || 0;

    // Initialize on first run
    if (!state.lastChecked) {
      setEvolutionState({
        lastSignalCount: currentSignalCount,
        lastSavedCount: currentSavedCount,
        lastChecked: new Date().toISOString(),
      });
      return;
    }

    const savedDelta = currentSavedCount - state.lastSavedCount;
    const signalDelta = currentSignalCount - state.lastSignalCount;

    // Evolution notice: show when 5+ new saves or 10+ new signals
    if (savedDelta >= 5 || signalDelta >= 10) {
      setNewSignalCount(Math.max(savedDelta, signalDelta));
      setShowEvolutionNotice(true);
    }

    // Expand mosaic prompt: show after 3+ sessions and 3+ saves, but only once
    const sessionCount = parseInt(localStorage.getItem('terrazzo_total_sessions') || '0', 10);
    const alreadyPrompted = localStorage.getItem(EXPAND_PROMPT_KEY);
    if (sessionCount >= 3 && currentSavedCount >= 3 && !alreadyPrompted) {
      setShowExpandPrompt(true);
    }
  }, [myPlaces, allSignals]);

  const dismissEvolution = () => {
    setShowEvolutionNotice(false);
    // Update the baseline
    const currentSavedCount = myPlaces.filter(p => !(p.source?.type === 'terrazzo' && p.source?.name === 'Terrazzo Picks')).length;
    setEvolutionState({
      lastSignalCount: allSignals?.length || 0,
      lastSavedCount: currentSavedCount,
      lastChecked: new Date().toISOString(),
    });
  };

  const dismissExpand = () => {
    setShowExpandPrompt(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(EXPAND_PROMPT_KEY, 'true');
    }
  };

  return {
    showEvolutionNotice,
    showExpandPrompt,
    dismissEvolution,
    dismissExpand,
    newSignalCount,
  };
}
