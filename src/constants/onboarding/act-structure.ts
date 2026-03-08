// ─── 3-Act Onboarding Structure ───
// Act 1: Quick Read (~3 min) — fast structured signal capture
// Act 2: Your Story (~5 min) — behavioral anchoring + voice + personal download
// Act 3: Deep Taste (~6 min) — structured depth + adaptive gap-fill

export const ACT_1_PHASE_IDS = [
  'quick-bio',
  'instinct-round',
  'visual-taste',
  // 'property-reactions-0', // TODO: re-enable once Gmail email parsing surfaces real places
] as const;

export const ACT_2_PHASE_IDS = [
  'behavioral-anchoring',
  'service-style',
  'sustainability-check',
  'memorable-stays',
  'anti-stay',
  'last-trip',
  'nobody-asks',
] as const;

export const ACT_3_PHASE_IDS = [
  'food-and-senses',
  'visual-pairs',
  'details-matter',
  'emotional-core',
  'travel-scenarios',
  'dining-depth',
  'cultural-immersion',
  'rhythm-and-pace',
  'movement-and-wellness',
  'scent-and-texture',
  'browsing-and-discovery',
  'trade-offs',
  'deal-breakers',
  'consistency-check',
  'gap-fill-reactions',
] as const;

export const ALL_PHASE_IDS = [
  ...ACT_1_PHASE_IDS,
  ...ACT_2_PHASE_IDS,
  ...ACT_3_PHASE_IDS,
] as const;

/** Phases that may be skipped based on domain gap analysis */
export const ADAPTIVE_PHASE_IDS = [
  'gap-fill-reactions',
] as const;

/** Act boundary helpers */
export const ACT_PHASE_MAP = {
  1: ACT_1_PHASE_IDS,
  2: ACT_2_PHASE_IDS,
  3: ACT_3_PHASE_IDS,
} as const;

export type ActNumber = 1 | 2 | 3;
