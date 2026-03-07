/**
 * Synthetic user pipeline configuration.
 *
 * Controls runtime mode, archetype selection, and evaluation thresholds.
 */

export type RunMode = 'full' | 'matching-only' | 'structured-only' | 'vector-cosine' | 'extraction-audit';

export interface SyntheticConfig {
  /** Which pipeline layers to run */
  mode: RunMode;

  /** Which archetypes to include (empty = all) */
  archetypes: string[];

  /** How many variations per archetype */
  variationsPerArchetype: number;

  /** Variation degree range [min, max] — how far from archetype center */
  variationDegreeRange: [number, number];

  /** Whether to run post-onboarding behavior simulation (full mode only) */
  includePostOnboarding: boolean;

  /** Whether to persist synthetic users to Supabase */
  persistToDb: boolean;

  /** API base URL for onboarding endpoints */
  apiBaseUrl: string;

  /** Anthropic API key for persona generation */
  anthropicApiKey: string;

  /** Evaluation thresholds */
  thresholds: {
    /** Max acceptable deviation between expected and actual profile per domain */
    maxProfileDeviation: number;
    /** Minimum score distribution span (max - min) for healthy discrimination */
    minScoreSpan: number;
    /** Minimum cross-archetype discrimination (mean score difference on same property set) */
    minCrossArchetypeDiscrimination: number;
    /** Minimum number of feed sections that must be populated */
    minFeedSectionsPopulated: number;
  };
}

export const DEFAULT_CONFIG: SyntheticConfig = {
  mode: 'full',
  archetypes: [],
  variationsPerArchetype: 5,
  variationDegreeRange: [0.1, 0.4],
  includePostOnboarding: true,
  persistToDb: false,
  apiBaseUrl: 'http://localhost:3000',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',

  thresholds: {
    maxProfileDeviation: 0.15,
    minScoreSpan: 30,
    minCrossArchetypeDiscrimination: 10,
    minFeedSectionsPopulated: 6,
  },
};

/**
 * Parse CLI arguments into config overrides.
 */
export function parseCliArgs(args: string[]): Partial<SyntheticConfig> {
  const overrides: Partial<SyntheticConfig> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--mode':
        overrides.mode = args[++i] as RunMode;
        break;
      case '--archetypes':
        overrides.archetypes = args[++i].split(',');
        break;
      case '--archetype':
        overrides.archetypes = [args[++i]];
        break;
      case '--variations':
        overrides.variationsPerArchetype = parseInt(args[++i], 10);
        break;
      case '--no-post-onboarding':
        overrides.includePostOnboarding = false;
        break;
      case '--persist':
        overrides.persistToDb = true;
        break;
      case '--api-url':
        overrides.apiBaseUrl = args[++i];
        break;
    }
  }

  return overrides;
}
