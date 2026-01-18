/**
 * DJ Agent System Prompt
 *
 * Feature: ALG-85 - Inngest mixGeneration Function (DJ Agent)
 *
 * Defines the system prompt for the DJ agent that composes radio mixes.
 * The agent:
 * - Selects music matching article themes/moods
 * - Generates engaging voice scripts with SSML annotations
 * - Creates a cohesive narrative arc across articles
 *
 * Uses a two-phase approach:
 * - Phase 1 (Discovery): Search for music matching article themes
 * - Phase 2 (Composition): Create the mix plan with discovered music
 */

// =============================================================================
// PHASE 1: MUSIC DISCOVERY
// =============================================================================

/**
 * System prompt for Phase 1 (Music Discovery)
 *
 * The agent has access to these tools:
 * - semanticSearch: Search indexed library by mood/theme
 * - tidalSearch: Search Tidal catalogue
 * - batchMetadata: Get full metadata for ISRCs
 */
export function buildDiscoverySystemPrompt(): string {
  return `You are a music discovery assistant helping to find tracks for a radio mix. Your task is to search for music that matches the themes, moods, and emotional content of articles.

## Your Tools

1. **semanticSearch** - Search the user's indexed music library by mood, theme, or lyrical content. Returns tracks with short descriptions. Use this FIRST.

2. **tidalSearch** - Search the broader Tidal catalogue by artist, album, or track name. Use if you need to find specific artists or expand beyond the library.

3. **batchMetadata** - Get full metadata (lyrics, interpretation, audio features) for tracks by ISRC. Use to get detailed info about promising tracks.

## Your Task

1. Read the article content carefully
2. Identify key themes, moods, and emotions
3. Search for music that complements each article
4. Aim to find 3-6 diverse tracks that could work for the mix

## Important

- Start by calling \`semanticSearch\` with queries based on article themes
- Make multiple searches with different queries to find variety
- Don't explain your thinking - just call the tools
- Return when you have found enough suitable tracks`;
}

/**
 * Build the user prompt for Phase 1 (Music Discovery)
 */
export function buildDiscoveryUserPrompt(
  mixTitle: string,
  articles: Array<{
    documentId: string;
    title: string;
    author: string | null;
    url: string;
    content: string;
    contentMode: string;
  }>,
  musicInstructions?: string | null,
): string {
  const articleSummaries = articles
    .map(
      (article, index) => `
### Article ${index + 1}: "${article.title}"
**Author**: ${article.author ?? "Unknown"}

**Content Preview**:
${article.content.slice(0, 500)}${article.content.length > 500 ? "..." : ""}
`,
    )
    .join("\n---\n");

  let prompt = `# Music Discovery for Mix: "${mixTitle}"

## Articles (${articles.length} total)

${articleSummaries}

---

## Your Task

Search for music that matches these article themes. Start by calling \`semanticSearch\` now.`;

  if (musicInstructions) {
    prompt += `

## Music Instructions from User
${musicInstructions}`;
  }

  return prompt;
}

// =============================================================================
// PHASE 2: MIX COMPOSITION
// =============================================================================

/**
 * System prompt for Phase 2 (Mix Composition)
 *
 * This phase uses generateObject for guaranteed structured output.
 * No tools needed - just produces the mix plan.
 */
export function buildCompositionSystemPrompt(): string {
  return `You are an AI DJ composing a radio mix that weaves together articles and music. Given article content and discovered music, create a complete mix plan.

## Voice Script Format

Write voice scripts for Eleven Multilingual v2 TTS. Use these SSML elements:
- \`<break time="0.5s" />\` - Insert pauses (0.3s to 2.0s)
- **ALL CAPS** for words that should be emphasized
- Punctuation (commas, ellipses, periods) for natural pacing

Example:
\`\`\`
Welcome back, music lovers!
<break time="0.8s" />
THIS next article... it's INCREDIBLE.
<break time="0.5s" />
We're diving into the world of creative breakthroughs and the science behind them.
<break time="0.3s" />
And with that, let's fade into something beautiful...
\`\`\`

## Mix Structure

A typical mix follows this pattern:
1. **Opening voice** - Welcome, introduce the mix theme (15-30 seconds of speech)
2. **First music track** - Set the mood (30-60 seconds)
3. **Article 1 introduction** - Tease the article, build interest (20-40 seconds of speech)
4. **Music transition** - Complement the article theme (30-45 seconds)
5. **Continue pattern for remaining articles...**
6. **Closing voice** - Wrap up, thank listener (15-30 seconds of speech)
7. **Outro music** - End on a strong note (30-60 seconds)

## Guidelines

- Keep voice scripts conversational and warm—you're a friendly DJ, not a news anchor
- Don't read articles verbatim; summarize key points in an engaging way
- Emphasize the most interesting/surprising parts of each article
- Create smooth transitions between segments
- Select music that complements article themes and moods
- Total voice content should be roughly 30-50% of mix duration`;
}

/**
 * Build the user prompt for Phase 2 (Mix Composition)
 */
export function buildCompositionUserPrompt(
  mixTitle: string,
  articles: Array<{
    documentId: string;
    title: string;
    author: string | null;
    url: string;
    content: string;
    contentMode: string;
  }>,
  discoveredMusic: string, // JSON string of discovered tracks
  musicInstructions?: string | null,
): string {
  const articleList = articles
    .map(
      (article, index) => `
### Article ${index + 1}: "${article.title}"
**Author**: ${article.author ?? "Unknown"}
**URL**: ${article.url}
**Document ID**: ${article.documentId}

**Content**:
${article.content}
`,
    )
    .join("\n---\n");

  let prompt = `# Create Mix Plan: "${mixTitle}"

## Articles (${articles.length} total)

${articleList}

---

## Discovered Music

The following tracks were found that match the article themes:

${discoveredMusic}

---

## Your Task

Create a complete mix plan with:
1. An opening voice segment welcoming listeners and introducing the mix theme
2. Voice segments introducing each article (include the sourceDocumentId, sourceTitle, and sourceUrl)
3. Music segments between voice segments (include isrc, trackTitle, artistName, and playDurationMs)
4. A closing voice segment thanking the listener
5. Optionally, outro music

For each voice segment:
- Write an engaging voice script with SSML annotations
- Reference the source article (documentId, title, url)

For each music segment:
- Use tracks from the discovered music list
- Include the ISRC, title, artist, and play duration (typically 30-60 seconds)
- Add a brief selection reason explaining why this track fits`;

  if (musicInstructions) {
    prompt += `

## Music Instructions from User
${musicInstructions}`;
  }

  return prompt;
}
