// Barrel re-export — preserves `import { ... } from '@/constants/onboarding'`

export { EXPERIENCE_POOL } from './experience-pool';
export { DESIGNER_POOL } from './designer-pool';
export { DIAGNOSTIC_QUESTIONS, IMAGE_PAIRS } from './legacy-diagnostics';
export { ONBOARDING_PHASES, MAX_ADAPTIVE_PHASES } from './phase-definitions';
export {
  ACT_1_PHASE_IDS,
  ACT_2_PHASE_IDS,
  ACT_3_PHASE_IDS,
  ALL_PHASE_IDS,
  ADAPTIVE_PHASE_IDS,
  ACT_PHASE_MAP,
} from './act-structure';
export type { ActNumber } from './act-structure';
export { PROCESSING_STEPS } from './processing-steps';
export { TASTE_ONTOLOGY_SYSTEM_PROMPT, PROFILE_SYNTHESIS_PROMPT } from './prompts';
