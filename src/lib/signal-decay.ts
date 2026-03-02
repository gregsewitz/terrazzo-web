/**
 * Signal Decay Engine
 *
 * Implements a 180-day half-life exponential decay model for taste signals.
 * Older signals carry less weight in matching, encouraging re-profiling
 * and keeping the taste model fresh.
 *
 * Formula: decayed = original × 0.5^(age / halfLife)
 *
 * At 180 days, a signal retains 50% of its original confidence.
 * At 360 days, 25%. At 540 days, 12.5%. Effectively aged-out after ~2 years.
 */

const DEFAULT_HALF_LIFE_DAYS = 180;

/** Minimum confidence below which a signal is considered effectively aged-out. */
const AGED_OUT_THRESHOLD = 0.05;

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Compute decayed confidence for a signal given its original confidence and age.
 */
export function decayConfidence(
  originalConfidence: number,
  extractedAt: Date | string,
  halfLifeDays: number = DEFAULT_HALF_LIFE_DAYS,
  now: Date = new Date(),
): number {
  const extractedDate = typeof extractedAt === 'string' ? new Date(extractedAt) : extractedAt;
  const ageMs = now.getTime() - extractedDate.getTime();
  if (ageMs <= 0) return originalConfidence;

  const ageInDays = ageMs / (1000 * 60 * 60 * 24);
  return originalConfidence * Math.pow(0.5, ageInDays / halfLifeDays);
}

/**
 * Compute age in days from an extraction timestamp.
 */
export function computeSignalAge(
  extractedAt: Date | string,
  now: Date = new Date(),
): number {
  const extractedDate = typeof extractedAt === 'string' ? new Date(extractedAt) : extractedAt;
  return Math.max(0, Math.floor((now.getTime() - extractedDate.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Check if a signal has effectively aged out (below threshold).
 */
export function isAgedOut(
  originalConfidence: number,
  extractedAt: Date | string,
  halfLifeDays: number = DEFAULT_HALF_LIFE_DAYS,
): boolean {
  return decayConfidence(originalConfidence, extractedAt, halfLifeDays) < AGED_OUT_THRESHOLD;
}

// ─── Re-Profiling Triggers ───────────────────────────────────────────────────

export interface ReprofilingCheck {
  shouldReprofle: boolean;
  urgency: 'low' | 'medium' | 'high';
  triggers: string[];
  suggestedPhases: string[];
}

interface ReprofilingInput {
  lastSynthesizedAt: Date | string | null;
  newBookingsSinceSynthesis: number;
  domainConfidences: Record<string, number>; // domain → current decayed avg confidence
  contradictionRatio: number;                // 0-1
}

/**
 * Evaluate whether a user should be re-profiled based on their signal health.
 *
 * Triggers:
 * 1. 6+ months since last synthesis
 * 2. 3+ new bookings since last synthesis
 * 3. Any domain confidence dropped below 50% after decay
 * 4. Contradiction ratio exceeds 30%
 */
export function checkReprofilingTriggers(input: ReprofilingInput): ReprofilingCheck {
  const triggers: string[] = [];
  const suggestedPhases: string[] = [];

  // Trigger 1: Time-based
  if (input.lastSynthesizedAt) {
    const lastDate = typeof input.lastSynthesizedAt === 'string'
      ? new Date(input.lastSynthesizedAt)
      : input.lastSynthesizedAt;
    const monthsSince = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsSince >= 6) {
      triggers.push(`${Math.floor(monthsSince)} months since last profile synthesis`);
      suggestedPhases.push('full-refresh');
    }
  } else {
    triggers.push('No profile synthesis on record');
    suggestedPhases.push('full-onboarding');
  }

  // Trigger 2: Behavioral (new bookings)
  if (input.newBookingsSinceSynthesis >= 3) {
    triggers.push(`${input.newBookingsSinceSynthesis} new bookings since last synthesis`);
    suggestedPhases.push('behavioral-update');
  }

  // Trigger 3: Domain confidence decay
  const weakDomains: string[] = [];
  for (const [domain, confidence] of Object.entries(input.domainConfidences)) {
    if (confidence < 0.5) {
      weakDomains.push(domain);
    }
  }
  if (weakDomains.length > 0) {
    triggers.push(`Low confidence in ${weakDomains.join(', ')} (below 50%)`);
    suggestedPhases.push(...weakDomains.map(d => `adaptive-${d.toLowerCase()}`));
  }

  // Trigger 4: Contradiction ratio
  if (input.contradictionRatio > 0.3) {
    triggers.push(`Contradiction ratio ${Math.round(input.contradictionRatio * 100)}% (exceeds 30%)`);
    suggestedPhases.push('contradiction-resolution');
  }

  // Determine urgency
  let urgency: 'low' | 'medium' | 'high' = 'low';
  if (triggers.length >= 3 || weakDomains.length >= 3) {
    urgency = 'high';
  } else if (triggers.length >= 2) {
    urgency = 'medium';
  }

  return {
    shouldReprofle: triggers.length > 0,
    urgency,
    triggers,
    suggestedPhases: [...new Set(suggestedPhases)],
  };
}
