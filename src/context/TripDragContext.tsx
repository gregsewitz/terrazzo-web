'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ImportedPlace } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DropTarget {
  dayNumber: number;
  slotId: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface TripDragAPI {
  dropTarget: DropTarget | null;
  dragItemId: string | null;
  onRegisterSlotRef: (dayNumber: number, slotId: string, rect: DOMRect | null) => void;
  onDragStartFromSlot: (item: ImportedPlace, dayNumber: number, slotId: string, e: React.PointerEvent) => void;
  onUnplace: (placeId: string, dayNumber: number, slotId: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const TripDragContext = createContext<TripDragAPI | null>(null);

export function useTripDrag(): TripDragAPI {
  const ctx = useContext(TripDragContext);
  if (!ctx) throw new Error('useTripDrag must be used within <TripDragProvider>');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface TripDragProviderProps {
  value: TripDragAPI;
  children: ReactNode;
}

export function TripDragProvider({ value, children }: TripDragProviderProps) {
  return (
    <TripDragContext.Provider value={value}>
      {children}
    </TripDragContext.Provider>
  );
}
