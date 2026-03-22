'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Suggestion, Reaction } from '@/stores/collaborationStore';

// ─── Public API ───────────────────────────────────────────────────────────────

export interface TripCollaborationAPI {
  suggestions: Suggestion[];
  reactions: Reaction[];
  myRole: 'owner' | 'suggester' | 'viewer' | null;
  onRespondSuggestion: (suggestionId: string, status: 'accepted' | 'rejected') => void;
  onAddReaction: (placeKey: string, reaction: 'love' | 'not_for_me') => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const TripCollaborationContext = createContext<TripCollaborationAPI | null>(null);

export function useTripCollaboration(): TripCollaborationAPI {
  const ctx = useContext(TripCollaborationContext);
  if (!ctx) throw new Error('useTripCollaboration must be used within <TripCollaborationProvider>');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface TripCollaborationProviderProps {
  value: TripCollaborationAPI;
  children: ReactNode;
}

export function TripCollaborationProvider({ value, children }: TripCollaborationProviderProps) {
  return (
    <TripCollaborationContext.Provider value={value}>
      {children}
    </TripCollaborationContext.Provider>
  );
}
