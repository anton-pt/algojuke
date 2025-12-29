/**
 * Lyrics Interpretation Prompt Template
 *
 * Generates prompts for Claude to analyze song lyrics and produce
 * rich thematic interpretations suitable for semantic search.
 *
 * The interpretation is designed to:
 * 1. Capture thematic content for playlist generation
 * 2. Enable semantic search by mood, theme, or experience
 * 3. Be embeddable via mxbai-embed-large-v1 (1024 dimensions)
 */

/**
 * System context for lyric interpretation
 */
export const INTERPRETATION_SYSTEM_CONTEXT = `You are analyzing song lyrics to create a rich, searchable interpretation for a music discovery system.`;

/**
 * Build interpretation prompt from track data
 *
 * @param title - Track title
 * @param artist - Artist name
 * @param album - Album name
 * @param lyrics - Full lyrics text
 * @returns Formatted prompt for LLM
 */
export function buildInterpretationPrompt(
  title: string,
  artist: string,
  album: string,
  lyrics: string
): string {
  return `${INTERPRETATION_SYSTEM_CONTEXT}

Given the following song information and lyrics, create a detailed interpretation that captures:
1. **Themes**: Core topics and ideas (love, rebellion, nostalgia, etc.)
2. **Emotional Tone**: The mood and feelings evoked (melancholic, euphoric, angry, etc.)
3. **Narrative**: Any story or journey in the lyrics
4. **Context**: Cultural, social, or musical context when apparent

Write a cohesive 2-3 paragraph interpretation that would help someone find this song when searching for music matching specific moods, themes, or experiences. Focus on what makes this song emotionally resonant and thematically distinctive.

Song: ${title} by ${artist}
Album: ${album}

Lyrics:
${lyrics}`;
}

/**
 * Instruction for embedding the interpretation
 *
 * Used with Qwen3-Embedding-8B instruction-aware embedding
 */
export const EMBEDDING_INSTRUCTION =
  "Given song lyrics interpretation, create an embedding for music discovery and playlist generation";
