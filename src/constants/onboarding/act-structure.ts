// ─── 3-Act Onboarding Structure ───
// Act 0: Ground Truth (~3 min) — fast structured signal capture
// Act 1: Targeted Depth (~5 min) — voice + adaptive conversation
// Act 2: Deep Taste (~4 min) — voice + adaptive gap-fill

export const ACT_0_PHASE_IDS = [
  'quick-bio',
  'instinct-round',
  'visual-taste',
  'property-reactions-0',
] as const;

export const ACT_1_PHASE_IDS_V2 = [
  'service-style',
  'sustainability-check',
  'memorable-stays',
  'anti-stay',
  'adaptive-conversation',
] as const;

export const ACT_2_PHASE_IDS_V2 = [
  'details-matter',
  'emotional-core',
  'gap-fill-reactions',
] as const;

export const ALL_PHASE_IDS_V2 = [
  ...ACT_0_PHASE_IDS,
  ...ACT_1_PHASE_IDS_V2,
  ...ACT_2_PHASE_IDS_V2,
] as const;

/** Phases that may be skipped based on domain gap analysis */
export const ADAPTIVE_PHASE_IDS = [
  'adaptive-conversation',
  'gap-fill-reactions',
] as const;

/** Act boundary helpers */
export const ACT_PHASE_MAP = {
  0: ACT_0_PHASE_IDS,
  1: ACT_1_PHASE_IDS_V2,
  2: ACT_2_PHASE_IDS_V2,
} as const;

export type ActNumber = 0 | 1 | 2;
