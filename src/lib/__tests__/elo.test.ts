import { describe, it, expect } from 'vitest';
import {
  initEloState,
  pickNextPair,
  recordChoice,
  extractSignals,
  extractTasteAxes,
  isComplete,
} from '../elo';
import type { DesignerItem } from '@/types';

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const testItems = [
  { id: 'a', cluster: 'grand', signals: ['formal', 'opulent'], category: 'Design', metadata: {} },
  { id: 'b', cluster: 'quiet', signals: ['minimal', 'serene'], category: 'Design', metadata: {} },
  { id: 'c', cluster: 'expressive', signals: ['bold', 'colorful'], category: 'Design', metadata: {} },
  { id: 'd', cluster: 'soulful', signals: ['warm', 'textured'], category: 'Character', metadata: {} },
];

// ─── initEloState ───────────────────────────────────────────────────────────

describe('initEloState', () => {
  it('initializes all items with rating 1500 and 0 comparisons', () => {
    const state = initEloState(testItems);
    expect(state.items).toHaveLength(4);
    state.items.forEach(item => {
      expect(item.rating).toBe(1500);
      expect(item.comparisons).toBe(0);
    });
  });

  it('starts at round 0 with empty history', () => {
    const state = initEloState(testItems);
    expect(state.round).toBe(0);
    expect(state.history).toHaveLength(0);
  });

  it('preserves item properties', () => {
    const state = initEloState(testItems);
    expect(state.items[0].cluster).toBe('grand');
    expect(state.items[0].signals).toEqual(['formal', 'opulent']);
  });
});

// ─── pickNextPair ───────────────────────────────────────────────────────────

describe('pickNextPair', () => {
  it('returns a pair of two different items', () => {
    const state = initEloState(testItems);
    const pair = pickNextPair(state, 10);
    expect(pair).not.toBeNull();
    expect(pair![0].id).not.toBe(pair![1].id);
  });

  it('returns null when fewer than 2 items', () => {
    const state = initEloState([testItems[0]]);
    const pair = pickNextPair(state, 10);
    expect(pair).toBeNull();
  });

  it('returns null when all pairs exhausted', () => {
    let state = initEloState(testItems.slice(0, 2)); // Only 2 items = 1 possible pair
    state = recordChoice(state, 'a', 'b', 10);
    const pair = pickNextPair(state, 10);
    expect(pair).toBeNull();
  });

  it('prefers cross-cluster pairs in early rounds', () => {
    const state = initEloState(testItems);
    // Run 20 times to account for randomness
    let crossClusterCount = 0;
    for (let i = 0; i < 20; i++) {
      const pair = pickNextPair({ ...state, round: 0 }, 10);
      if (pair && pair[0].cluster !== pair[1].cluster) crossClusterCount++;
    }
    // Should almost always be cross-cluster in round 0
    expect(crossClusterCount).toBeGreaterThan(15);
  });
});

// ─── recordChoice ───────────────────────────────────────────────────────────

describe('recordChoice', () => {
  it('increases winner rating and decreases loser rating', () => {
    const state = initEloState(testItems);
    const newState = recordChoice(state, 'a', 'b', 10);
    const winner = newState.items.find(i => i.id === 'a')!;
    const loser = newState.items.find(i => i.id === 'b')!;
    expect(winner.rating).toBeGreaterThan(1500);
    expect(loser.rating).toBeLessThan(1500);
  });

  it('increments comparisons for both items', () => {
    const state = initEloState(testItems);
    const newState = recordChoice(state, 'a', 'b', 10);
    expect(newState.items.find(i => i.id === 'a')!.comparisons).toBe(1);
    expect(newState.items.find(i => i.id === 'b')!.comparisons).toBe(1);
  });

  it('does not modify other items', () => {
    const state = initEloState(testItems);
    const newState = recordChoice(state, 'a', 'b', 10);
    expect(newState.items.find(i => i.id === 'c')!.rating).toBe(1500);
    expect(newState.items.find(i => i.id === 'c')!.comparisons).toBe(0);
  });

  it('advances the round counter', () => {
    const state = initEloState(testItems);
    const newState = recordChoice(state, 'a', 'b', 10);
    expect(newState.round).toBe(1);
  });

  it('adds to history', () => {
    const state = initEloState(testItems);
    const newState = recordChoice(state, 'a', 'b', 10);
    expect(newState.history).toHaveLength(1);
    expect(newState.history[0]).toEqual({ winnerId: 'a', loserId: 'b', round: 0 });
  });

  it('returns unchanged state for invalid IDs', () => {
    const state = initEloState(testItems);
    const newState = recordChoice(state, 'nonexistent', 'b', 10);
    expect(newState).toEqual(state);
  });

  it('uses higher K-factor in early rounds (more aggressive updates)', () => {
    const state = initEloState(testItems);
    const early = recordChoice({ ...state, round: 0 }, 'a', 'b', 10);
    const late = recordChoice({ ...state, round: 9 }, 'a', 'b', 10);
    const earlyDelta = early.items.find(i => i.id === 'a')!.rating - 1500;
    const lateDelta = late.items.find(i => i.id === 'a')!.rating - 1500;
    expect(earlyDelta).toBeGreaterThan(lateDelta);
  });

  it('conserves total rating (zero-sum)', () => {
    const state = initEloState(testItems);
    const totalBefore = state.items.reduce((s, i) => s + i.rating, 0);
    const newState = recordChoice(state, 'a', 'b', 10);
    const totalAfter = newState.items.reduce((s, i) => s + i.rating, 0);
    expect(totalAfter).toBeCloseTo(totalBefore, 5);
  });
});

// ─── extractSignals ─────────────────────────────────────────────────────────

describe('extractSignals', () => {
  it('returns empty array when no items have comparisons', () => {
    const state = initEloState(testItems);
    expect(extractSignals(state)).toHaveLength(0);
  });

  it('generates positive signals for top-ranked items', () => {
    let state = initEloState(testItems);
    // Make 'a' win consistently
    state = recordChoice(state, 'a', 'b', 10);
    state = recordChoice(state, 'a', 'c', 10);
    state = recordChoice(state, 'a', 'd', 10);
    state = recordChoice(state, 'b', 'c', 10);
    state = recordChoice(state, 'b', 'd', 10);
    state = recordChoice(state, 'c', 'd', 10);

    const signals = extractSignals(state);
    // Top item 'a' should have positive signals (not anti-)
    const aSignals = signals.filter(s => s.tag === 'formal' || s.tag === 'opulent');
    expect(aSignals.length).toBeGreaterThan(0);
    aSignals.forEach(s => {
      expect(s.tag).not.toMatch(/^Anti-/);
      expect(s.confidence).toBeGreaterThan(0.5);
    });
  });

  it('generates rejection signals for bottom-ranked items', () => {
    let state = initEloState(testItems);
    // Make 'd' lose consistently
    state = recordChoice(state, 'a', 'd', 10);
    state = recordChoice(state, 'b', 'd', 10);
    state = recordChoice(state, 'c', 'd', 10);
    state = recordChoice(state, 'a', 'b', 10);
    state = recordChoice(state, 'a', 'c', 10);
    state = recordChoice(state, 'b', 'c', 10);

    const signals = extractSignals(state);
    const rejections = signals.filter(s => s.tag.startsWith('Anti-'));
    expect(rejections.length).toBeGreaterThan(0);
    rejections.forEach(s => expect(s.cat).toBe('Rejection'));
  });
});

// ─── extractTasteAxes ───────────────────────────────────────────────────────

describe('extractTasteAxes', () => {
  const designerPool: DesignerItem[] = [
    { id: 'a', name: 'A', hotel: 'H', vibe: 'V', cluster: 'grand', imageUrls: [], signals: [], axes: { volume: 0.9, temperature: 0.2, time: 0.8, formality: 0.9, culture: 0.5, mood: 0.7 } },
    { id: 'b', name: 'B', hotel: 'H', vibe: 'V', cluster: 'quiet', imageUrls: [], signals: [], axes: { volume: 0.1, temperature: 0.8, time: 0.3, formality: 0.1, culture: 0.5, mood: 0.3 } },
  ];

  it('returns default 0.5 axes when no items have been compared', () => {
    const state = initEloState(testItems);
    const axes = extractTasteAxes(state, designerPool);
    expect(axes.volume).toBe(0.5);
    expect(axes.temperature).toBe(0.5);
  });

  it('weights axes toward the higher-rated designer', () => {
    let state = initEloState(testItems.slice(0, 2)); // a and b
    state = recordChoice(state, 'a', 'b', 10); // a wins → higher rating
    const axes = extractTasteAxes(state, designerPool);
    // 'a' has volume 0.9, 'b' has volume 0.1. Winner should pull axes toward 0.9
    expect(axes.volume).toBeGreaterThan(0.5);
  });
});

// ─── isComplete ─────────────────────────────────────────────────────────────

describe('isComplete', () => {
  it('returns false before minRounds', () => {
    const state = initEloState(testItems);
    expect(isComplete(state, 5)).toBe(false);
  });

  it('returns true at minRounds', () => {
    const state = { ...initEloState(testItems), round: 5 };
    expect(isComplete(state, 5)).toBe(true);
  });

  it('returns true after minRounds', () => {
    const state = { ...initEloState(testItems), round: 10 };
    expect(isComplete(state, 5)).toBe(true);
  });
});
