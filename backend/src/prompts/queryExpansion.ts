/**
 * Query Expansion Prompt Template
 *
 * Feature: 009-semantic-discovery-search
 * Date: 2025-12-30
 *
 * Prompt template for Claude Haiku 4.5 to expand user queries
 * into 1-3 optimized search queries for hybrid search.
 */

/**
 * System prompt for query expansion
 *
 * Provides context and guidelines for the LLM to generate
 * semantically diverse search queries.
 */
export const QUERY_EXPANSION_SYSTEM_PROMPT = `You are a music search assistant specialized in understanding musical moods, themes, and emotions. Your task is to expand user queries into optimized search terms that will match against song lyrics and their thematic interpretations.

Key behaviors:
1. Analyze the user's intent - what mood, theme, or emotion are they seeking?
2. Generate search queries that capture different aspects of this intent
3. Use descriptive language that matches how song lyrics and interpretations are written
4. Consider synonyms, related concepts, and emotional associations`;

/**
 * Build the query expansion prompt for a user query
 *
 * @param userQuery - The user's natural language search query
 * @returns Formatted prompt string for the LLM
 */
export function buildQueryExpansionPrompt(userQuery: string): string {
  return `Given a user's natural language query describing the mood, theme, or feeling they want in music, generate 1 to 3 focused search queries optimized for finding matching songs.

Guidelines:
- If the user query is specific (e.g., "songs about summer"), generate 1-2 queries
- If the user query is complex or multi-faceted, generate 2-3 queries covering different aspects
- Each query should be 5-15 words, suitable for semantic and keyword search
- Focus on themes, emotions, imagery, and lyrical content
- Do not include artist names or song titles unless the user specified them

User query: ${userQuery}

Respond with ONLY a JSON array of strings. No explanation or additional text.
Example response format:
["uplifting songs about overcoming hardship", "hopeful lyrics about perseverance"]`;
}

/**
 * Example inputs and outputs for the query expansion prompt
 *
 * Used for documentation and testing.
 */
export const QUERY_EXPANSION_EXAMPLES = [
  {
    input: "summer vibes",
    output: ["upbeat songs about summer and warm weather", "carefree sunshine and beach music"],
  },
  {
    input: "songs about heartbreak and moving on",
    output: [
      "emotional lyrics about heartbreak and lost love",
      "hopeful songs about healing after a breakup",
      "moving on from relationships and finding strength",
    ],
  },
  {
    input: "melancholic but hopeful, about late nights and reflection",
    output: [
      "melancholic songs about late night introspection",
      "hopeful lyrics with themes of reflection and solitude",
      "bittersweet nighttime songs about growth and hope",
    ],
  },
  {
    input: "energy",
    output: ["high energy upbeat motivational songs"],
  },
];

/**
 * Maximum input length for query expansion
 */
export const MAX_QUERY_LENGTH = 2000;

/**
 * Temperature setting for query expansion
 * Lower temperature for more consistent, focused results
 */
export const QUERY_EXPANSION_TEMPERATURE = 0.3;

/**
 * Maximum tokens for query expansion response
 */
export const QUERY_EXPANSION_MAX_TOKENS = 200;
