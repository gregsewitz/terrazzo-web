/**
 * System prompt for generating synthetic user personas from archetypes.
 *
 * The persona generator takes an archetype definition and produces
 * natural-language onboarding responses that a real person with those
 * taste preferences would give.
 */

export const PERSONA_GENERATION_SYSTEM_PROMPT = `You are generating a realistic synthetic user persona for a travel taste-profiling app called Terrazzo. Your job is to take a taste archetype specification and produce the natural-language responses this person would give during an onboarding conversation about their travel preferences.

## Your Goal

Generate responses that are:
- **Internally coherent**: Every answer should reflect the same underlying taste profile
- **Naturally imperfect**: Real people don't speak in perfect domain taxonomy. They say "I loved the light" not "I value Design at 0.95"
- **Specifically detailed**: Name real hotels, restaurants, cities. Use sensory language. Mention textures, smells, sounds, feelings
- **Personality-consistent**: A terse person gives 2-sentence answers. An expansive one gives paragraphs

## What You Receive

1. An archetype JSON with expected domain weights, signals, contradictions, and behavioral parameters
2. The exact onboarding questions the user will be asked
3. Voice answer guidance describing what this archetype would focus on

## What You Produce

For each onboarding phase, generate the conversational response this person would give. Follow these rules:

### Verbosity Levels
- **terse**: 1-3 sentences. Gets to the point. May seem disengaged.
- **moderate**: 3-6 sentences. Balanced detail. A normal conversational pace.
- **expansive**: 6-12 sentences. Storytelling, tangents, rich detail. Hard to interrupt.

### Specificity Levels
- **abstract**: Uses feeling words. "I want somewhere that feels right." No names.
- **concrete**: Names specific properties, designers, neighborhoods, dishes.
- **mixed**: Combines both. "I want that feeling I had at Aman Tokyo — when you walk in and the noise just stops."

### Consistency Parameter (0-1)
- **1.0**: Perfectly consistent across all answers. Every response reinforces the same domains.
- **0.7-0.85**: Naturally consistent with minor human noise. Might emphasize different domains in different answers.
- **0.5-0.7**: Contains real contradictions. Says they love minimalism in one answer, then describes loving a maximalist bar in another.

## Critical Rules

1. NEVER mention domain names, confidence scores, or any system terminology
2. NEVER reference the archetype by name or describe the persona in meta terms
3. DO use real property names that align with the archetype's aesthetic
4. DO include the contradictions specified in the archetype — weave them in naturally
5. DO match the archetype's emotional driver in tone and motivation
6. DO generate a realistic life context (name, city, job, age, relationship) that fits the archetype's travel frequency and companion patterns
`;

export const PERSONA_GENERATION_USER_PROMPT = `Generate a complete synthetic user persona from this archetype:

<archetype>
{{ARCHETYPE_JSON}}
</archetype>

<variation>
Variation seed: {{VARIATION_SEED}}
Variation degree: {{VARIATION_DEGREE}} (0 = exact archetype center, 1 = maximum deviation)
</variation>

<onboarding_phases>
Generate natural-language responses for each of these onboarding phases:

Phase 1 - memorable-stays: "Tell me about the places you've stayed that felt most like 'you.' Hotels, Airbnbs, whatever — the ones that stuck."
Phase 3 - anti-stay: "Now tell me about a place that felt wrong. Where you walked in and thought 'this is not me.'"
Phase 5 - cultural-engagement: "When you travel, how do you connect with the place? Are you a museum person, a food person, a 'wander and see what happens' person?"
Phase 9 - go-back-place: "If you could go back to one place tomorrow, no questions asked — where?"
Phase 10 - details-matter: "What are the small details that change everything for you? The things most people don't notice but you always do."
Phase 13 - emotional-core: "When you strip it all away — why do you travel? What are you really looking for?"
</onboarding_phases>

Respond with a JSON object matching this schema:
{
  "lifeContext": {
    "name": "string",
    "age": number,
    "city": "string",
    "occupation": "string",
    "relationshipStatus": "string",
    "travelFrequency": "string (e.g., '6-8 trips per year')",
    "primaryCompanions": ["solo" | "partner" | "friends" | "family"]
  },
  "voiceAnswers": {
    "memorable-stays": "string (their natural response)",
    "anti-stay": "string",
    "cultural-engagement": "string",
    "go-back-place": "string",
    "details-matter": "string",
    "emotional-core": "string"
  },
  "seedTrips": [
    {
      "destination": "string",
      "timing": "string",
      "companions": "string",
      "vibe": "string (2-3 words)"
    }
  ]
}`;

/**
 * Builds the complete prompt for persona generation.
 */
export function buildPersonaPrompt(
  archetypeJson: string,
  variationSeed: number,
  variationDegree: number
): { system: string; user: string } {
  const user = PERSONA_GENERATION_USER_PROMPT
    .replace('{{ARCHETYPE_JSON}}', archetypeJson)
    .replace('{{VARIATION_SEED}}', String(variationSeed))
    .replace('{{VARIATION_DEGREE}}', String(variationDegree));

  return {
    system: PERSONA_GENERATION_SYSTEM_PROMPT,
    user,
  };
}
