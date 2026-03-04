/**
 * Archetype registry — loads all archetype JSON definitions.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface TasteArchetype {
  id: string;
  name: string;
  description: string;
  expectedProfile: Record<string, number>;
  expectedSignals: { domain: string; tag: string; minConfidence: number }[];
  contradictions: { stated: string; revealed: string; expectedResolution: string }[];
  contextShifts: { context: string; domainDeltas: Record<string, number> }[];
  sustainability: {
    sensitivity: string;
    priorities: string[];
    dealbreakers: string[];
  };
  onboardingBehavior: {
    verbosity: 'terse' | 'moderate' | 'expansive';
    specificity: 'abstract' | 'concrete' | 'mixed';
    consistency: number;
  };
  postOnboardingBehavior: {
    saveProbability: Record<string, number>;
    ratingStyle: {
      reactionDistribution: Record<string, number>;
      tagVerbosity: 'minimal' | 'moderate' | 'thorough';
      returnIntentBias: 'enthusiastic' | 'neutral' | 'selective';
    };
    importSources: string[];
    importVolume: number;
  };
  onboardingInputs: {
    experiencePreferences: Record<string, 'a' | 'b'>;
    imagePairChoices: Record<string, 'a' | 'b'>;
    designerSelections: string[];
    diagnosticChoices: Record<string, 'a' | 'b'>;
  };
  voiceAnswerGuidance: Record<string, string>;
}

const ARCHETYPES_DIR = path.join(__dirname);

/**
 * Load all archetype definitions from JSON files in this directory.
 */
export function loadArchetypes(filter?: string[]): TasteArchetype[] {
  const files = fs.readdirSync(ARCHETYPES_DIR)
    .filter(f => f.endsWith('.json'));

  const archetypes: TasteArchetype[] = files.map(f => {
    const raw = fs.readFileSync(path.join(ARCHETYPES_DIR, f), 'utf-8');
    return JSON.parse(raw) as TasteArchetype;
  });

  if (filter && filter.length > 0) {
    return archetypes.filter(a => filter.includes(a.id));
  }

  return archetypes;
}

/**
 * Load a single archetype by ID.
 */
export function loadArchetype(id: string): TasteArchetype | null {
  const filePath = path.join(ARCHETYPES_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as TasteArchetype;
}

/**
 * List all available archetype IDs.
 */
export function listArchetypeIds(): string[] {
  return fs.readdirSync(ARCHETYPES_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}
