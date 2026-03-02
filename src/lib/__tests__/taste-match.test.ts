import { describe, it, expect } from 'vitest';
import {
  computeMatchFromSignals,
  computeMatchScore,
  getTopAxes,
  isStretchPick,
  computeMatch,
  DEFAULT_USER_PROFILE,
} from '../taste-match';
import type { TasteProfile } from '@/types';

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const userProfile: TasteProfile = {
  Design: 0.9,
  Character: 0.8,
  Service: 0.5,
  Food: 0.7,
  Location: 0.6,
  Wellness: 0.3,
  Rhythm: 0.5,
  CulturalEngagement: 0.5,
};

const strongDesignSignals = [
  { dimension: 'Design Language', confidence: 0.95, signal: 'minimalist' },
  { dimension: 'Design Language', confidence: 0.9, signal: 'brutalist' },
  { dimension: 'Design Language', confidence: 0.85, signal: 'concrete' },
  { dimension: 'Character & Identity', confidence: 0.8, signal: 'intimate' },
];

const placeProfileHigh: TasteProfile = {
  Design: 0.95,
  Character: 0.85,
  Service: 0.7,
  Food: 0.8,
  Location: 0.75,
  Wellness: 0.6,
  Rhythm: 0.5,
  CulturalEngagement: 0.5,
};

const placeProfileLow: TasteProfile = {
  Design: 0.1,
  Character: 0.15,
  Service: 0.2,
  Food: 0.1,
  Location: 0.2,
  Wellness: 0.9,
  Rhythm: 0.5,
  CulturalEngagement: 0.5,
};

// ─── computeMatchFromSignals ────────────────────────────────────────────────

describe('computeMatchFromSignals', () => {
  it('returns a score between 0 and 100', () => {
    const result = computeMatchFromSignals(strongDesignSignals, [], userProfile);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it('returns 50 for domains with no signals (neutral)', () => {
    const result = computeMatchFromSignals(
      [{ dimension: 'Design Language', confidence: 0.9, signal: 'test' }],
      [],
      userProfile,
    );
    // Wellness has no signals, so should be neutral 50
    expect(result.breakdown.Wellness).toBe(50);
    expect(result.breakdown.Food).toBe(50);
  });

  it('scores higher with more confident signals', () => {
    const highConf = [
      { dimension: 'Design Language', confidence: 0.95, signal: 'a' },
      { dimension: 'Design Language', confidence: 0.9, signal: 'b' },
    ];
    const lowConf = [
      { dimension: 'Design Language', confidence: 0.3, signal: 'a' },
      { dimension: 'Design Language', confidence: 0.2, signal: 'b' },
    ];
    const rHigh = computeMatchFromSignals(highConf, [], userProfile);
    const rLow = computeMatchFromSignals(lowConf, [], userProfile);
    expect(rHigh.breakdown.Design).toBeGreaterThan(rLow.breakdown.Design);
  });

  it('applies anti-signal penalties', () => {
    const signals = [
      { dimension: 'Design Language', confidence: 0.9, signal: 'test' },
    ];
    const antiSignals = [
      { dimension: 'Design Language', confidence: 1.0, signal: 'anti-test' },
    ];
    const withAnti = computeMatchFromSignals(signals, antiSignals, userProfile);
    const withoutAnti = computeMatchFromSignals(signals, [], userProfile);
    expect(withAnti.breakdown.Design).toBeLessThan(withoutAnti.breakdown.Design);
  });

  it('boosts corroborated signals', () => {
    const plain = [{ dimension: 'Design Language', confidence: 0.8, signal: 'a', review_corroborated: false }];
    const corr = [{ dimension: 'Design Language', confidence: 0.8, signal: 'a', review_corroborated: true }];
    const rPlain = computeMatchFromSignals(plain, [], userProfile);
    const rCorr = computeMatchFromSignals(corr, [], userProfile);
    expect(rCorr.breakdown.Design).toBeGreaterThanOrEqual(rPlain.breakdown.Design);
  });

  it('identifies the top dimension correctly', () => {
    const result = computeMatchFromSignals(strongDesignSignals, [], userProfile);
    // Design has the most signals, so should be top
    expect(result.topDimension).toBe('Design');
  });

  it('caps confidence at 1.0 even with corroboration boost', () => {
    const signals = [
      { dimension: 'Design Language', confidence: 0.99, signal: 'a', review_corroborated: true },
    ];
    const result = computeMatchFromSignals(signals, [], userProfile);
    // With 0.99 + 0.05 boost = 1.04 → should be capped at 1.0
    expect(result.breakdown.Design).toBeLessThanOrEqual(100);
  });
});

// ─── computeMatchScore ──────────────────────────────────────────────────────

describe('computeMatchScore', () => {
  it('returns a score between 0 and 100', () => {
    const score = computeMatchScore(userProfile, placeProfileHigh);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('scores higher when profiles align', () => {
    const highMatch = computeMatchScore(userProfile, placeProfileHigh);
    const lowMatch = computeMatchScore(userProfile, placeProfileLow);
    expect(highMatch).toBeGreaterThan(lowMatch);
  });

  it('returns 50 when all weights are zero', () => {
    const zeroProfile: TasteProfile = {
      Design: 0, Character: 0, Service: 0, Food: 0, Location: 0, Wellness: 0, Rhythm: 0, CulturalEngagement: 0,
    };
    const score = computeMatchScore(zeroProfile, placeProfileHigh);
    expect(score).toBe(50);
  });

  it('returns 100 for a perfect match (all 1.0)', () => {
    const perfect: TasteProfile = {
      Design: 1, Character: 1, Service: 1, Food: 1, Location: 1, Wellness: 1, Rhythm: 1, CulturalEngagement: 1,
    };
    const score = computeMatchScore(perfect, perfect);
    expect(score).toBe(100);
  });
});

// ─── getTopAxes ─────────────────────────────────────────────────────────────

describe('getTopAxes', () => {
  it('returns top 3 domains by default', () => {
    const top = getTopAxes(userProfile);
    expect(top).toHaveLength(3);
    expect(top[0]).toBe('Design'); // 0.9
    expect(top[1]).toBe('Character'); // 0.8
    expect(top[2]).toBe('Food'); // 0.7
  });

  it('respects the count parameter', () => {
    const top = getTopAxes(userProfile, 2);
    expect(top).toHaveLength(2);
  });

  it('returns all 8 when count >= 8', () => {
    const top = getTopAxes(userProfile, 10);
    expect(top).toHaveLength(8);
  });
});

// ─── isStretchPick ──────────────────────────────────────────────────────────

describe('isStretchPick', () => {
  it('returns true when place top axes differ from user top axes', () => {
    // User top 2: Design, Character
    // Place top 2: Wellness, Location → no overlap = stretch
    const wellnessPlace: TasteProfile = {
      Design: 0.1, Character: 0.1, Service: 0.2, Food: 0.2, Location: 0.8, Wellness: 0.95, Rhythm: 0.3, CulturalEngagement: 0.2,
    };
    expect(isStretchPick(userProfile, wellnessPlace)).toBe(true);
  });

  it('returns false when there is overlap', () => {
    // User top 2: Design, Character
    // Place top 2: Design, Food → overlap on Design
    expect(isStretchPick(userProfile, placeProfileHigh)).toBe(false);
  });
});

// ─── computeMatch (polymorphic) ─────────────────────────────────────────────

describe('computeMatch', () => {
  it('uses signal-based scoring when signals are present', () => {
    const result = computeMatch(userProfile, {
      signals: strongDesignSignals,
      antiSignals: [],
    });
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.breakdown.Design).toBeDefined();
  });

  it('uses profile-based scoring when only profile is present', () => {
    const result = computeMatch(userProfile, { profile: placeProfileHigh });
    expect(result.overallScore).toBeGreaterThan(50);
  });

  it('returns neutral 50 when no data is provided', () => {
    const result = computeMatch(userProfile, {});
    expect(result.overallScore).toBe(50);
  });

  it('prefers signals over profile when both are present', () => {
    const result = computeMatch(userProfile, {
      signals: strongDesignSignals,
      profile: placeProfileLow, // should be ignored
    });
    // Should use signal path, not profile path
    expect(result.breakdown.Design).toBeDefined();
    expect(result.breakdown.Design).not.toBe(0); // Profile path returns empty breakdown
  });
});

// ─── DEFAULT_USER_PROFILE ───────────────────────────────────────────────────

describe('DEFAULT_USER_PROFILE', () => {
  it('has all 8 domains', () => {
    const domains = Object.keys(DEFAULT_USER_PROFILE);
    expect(domains).toHaveLength(8);
    expect(domains).toContain('Design');
    expect(domains).toContain('Wellness');
    expect(domains).toContain('Rhythm');
    expect(domains).toContain('CulturalEngagement');
  });

  it('has values between 0 and 1', () => {
    Object.values(DEFAULT_USER_PROFILE).forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
  });
});
