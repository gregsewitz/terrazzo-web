import { describe, it, expect } from 'vitest';
import {
  filterGhostsByDestination,
  filterByGhostSource,
  hasGhostItems,
} from '../ghostFiltering';
import type { TimeSlot, ImportedPlace } from '@/types';

// ─── Test Fixtures ──────────────────────────────────────────────────────────

function makeGhost(name: string, location: string, ghostSource?: string): ImportedPlace {
  return {
    id: name.toLowerCase().replace(/\s/g, '-'),
    name,
    type: 'restaurant',
    location,
    source: { type: 'text', name: 'Test' },
    matchScore: 70,
    matchBreakdown: { Design: 0, Character: 0, Service: 0, Food: 0, Location: 0, Wellness: 0 },
    tasteNote: '',
    status: 'available',
    ghostSource: (ghostSource || 'manual') as ImportedPlace['ghostSource'],
  };
}

function makeSlot(ghosts: ImportedPlace[]): TimeSlot {
  return {
    id: 'slot-1',
    label: 'Morning',
    time: '09:00',
    places: [],
    ghostItems: ghosts,
  };
}

// ─── filterGhostsByDestination ──────────────────────────────────────────────

describe('filterGhostsByDestination', () => {
  const ghosts = [
    makeGhost('Sushi Sho', 'Tokyo, Japan'),
    makeGhost('Narisawa', 'Tokyo, Japan'),
    makeGhost('Noma', 'Copenhagen, Denmark'),
    makeGhost('Florilège', ''), // no location
  ];
  const slots = [makeSlot(ghosts)];

  it('filters ghosts matching the destination', () => {
    const result = filterGhostsByDestination(slots, 'Tokyo');
    const names = result.map(g => g.name);
    expect(names).toContain('Sushi Sho');
    expect(names).toContain('Narisawa');
    expect(names).not.toContain('Noma');
  });

  it('includes ghosts with no location (wildcard)', () => {
    const result = filterGhostsByDestination(slots, 'Tokyo');
    expect(result.map(g => g.name)).toContain('Florilège');
  });

  it('returns all ghosts when destination is empty', () => {
    const result = filterGhostsByDestination(slots, '');
    expect(result).toHaveLength(4);
  });

  it('handles empty slots array', () => {
    const result = filterGhostsByDestination([], 'Tokyo');
    expect(result).toHaveLength(0);
  });

  it('handles slots with no ghostItems', () => {
    const emptySlot: TimeSlot = { id: 's', label: 'L', time: '10:00', places: [] };
    const result = filterGhostsByDestination([emptySlot], 'Tokyo');
    expect(result).toHaveLength(0);
  });

  it('is case insensitive', () => {
    const result = filterGhostsByDestination(slots, 'tokyo');
    expect(result.map(g => g.name)).toContain('Sushi Sho');
  });
});

// ─── filterByGhostSource ────────────────────────────────────────────────────

describe('filterByGhostSource', () => {
  const items = [
    makeGhost('A', 'Tokyo', 'maps'),
    makeGhost('B', 'Tokyo', 'article'),
    makeGhost('C', 'Tokyo', 'manual'),
    makeGhost('D', 'Tokyo'), // defaults to manual
  ];

  it('filters by source type', () => {
    const maps = filterByGhostSource(items, 'maps');
    expect(maps).toHaveLength(1);
    expect(maps[0].name).toBe('A');
  });

  it('treats missing ghostSource as manual', () => {
    const manual = filterByGhostSource(items, 'manual');
    expect(manual).toHaveLength(2); // C and D
  });

  it('returns empty for non-matching source', () => {
    const result = filterByGhostSource(items, 'email');
    expect(result).toHaveLength(0);
  });
});

// ─── hasGhostItems ──────────────────────────────────────────────────────────

describe('hasGhostItems', () => {
  it('returns true when slot has ghost items', () => {
    const slot = makeSlot([makeGhost('A', 'Tokyo')]);
    expect(hasGhostItems(slot)).toBe(true);
  });

  it('returns false when ghostItems is empty', () => {
    const slot = makeSlot([]);
    expect(hasGhostItems(slot)).toBe(false);
  });

  it('returns false when ghostItems is undefined', () => {
    const slot: TimeSlot = { id: 's', label: 'L', time: '10:00', places: [] };
    expect(hasGhostItems(slot)).toBe(false);
  });
});
