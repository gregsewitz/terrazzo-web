// Barrel re-export — preserves `import { ... } from '@/constants/onboarding'`

export { EXPERIENCE_POOL } from './experience-pool';
export { DESIGNER_POOL } from './designer-pool';
export { DIAGNOSTIC_QUESTIONS, IMAGE_PAIRS } from './legacy-diagnostics';
export {
  ONBOARDING_PHASES,
  ACT_1_PHASE_IDS,
  ACT_2_PHASE_IDS,
  ALL_PHASE_IDS,
  MAX_ADAPTIVE_PHASES,
} from './phase-definitions';
export {
  ACT_0_PHASE_IDS,
  ACT_1_PHASE_IDS_V2,
  ACT_2_PHASE_IDS_V2,
  ALL_PHASE_IDS_V2,
  ADAPTIVE_PHASE_IDS,
  ACT_PHASE_MAP,
} from './act-structure';
export type { ActNumber } from './act-structure';
export { PROCESSING_STEPS } from './processing-steps';
export { TASTE_ONTOLOGY_SYSTEM_PROMPT, PROFILE_SYNTHESIS_PROMPT } from './prompts';
