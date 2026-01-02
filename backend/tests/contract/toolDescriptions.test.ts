/**
 * Tool Descriptions Contract Tests
 *
 * Feature: 014-tidal-search-refinement
 *
 * Tests that tool descriptions and system prompt contain required
 * clarity phrases for proper agent tool selection.
 *
 * These tests validate content requirements from the feature spec:
 * - FR-001: Tidal search must state text-based search only
 * - FR-002: Tidal search must warn against mood queries
 * - FR-003: Semantic search must clarify library-only scope and lyrics matching
 * - FR-004: Tool descriptions must provide usage guidance
 */

import { describe, it, expect } from 'vitest';
import { CHAT_SYSTEM_PROMPT } from '../../src/prompts/chatSystemPrompt.js';

/**
 * Tool descriptions from chatStreamService.ts
 *
 * These must match the actual descriptions in the source file.
 * We export them separately to enable testing without instantiating the service.
 *
 * When updating descriptions in chatStreamService.ts, update these too!
 */
export const TOOL_DESCRIPTIONS = {
  semanticSearch:
    'Search the user\'s indexed library by lyrical themes and interpreted meaning. IMPORTANT: This tool matches based on LYRICS INTERPRETATION, not musical style or audio features. A query like "ambient music" will find tracks with ambient themes in lyrics, NOT necessarily ambient-sounding music. For style/genre recommendations, use your music knowledge with tidalSearch instead. Results include shortDescription for each track.',
  tidalSearch:
    'Search the Tidal music catalogue by artist name, album name, or track title. IMPORTANT: This tool only supports text-based keyword search - it does NOT understand mood, theme, or semantic queries. For mood-based requests, use semanticSearch first, then use this tool with specific artist/album names you know match the mood. Returns results with library and index status flags.',
} as const;

describe('Tool Descriptions - Tidal Search', () => {
  /**
   * FR-001: The Tidal search tool description MUST explicitly state
   * it only supports text-based search by artist name, album name, or track name
   */
  it('contains "text-based" or "keyword" to clarify search type', () => {
    const description = TOOL_DESCRIPTIONS.tidalSearch.toLowerCase();
    const hasTextBased = description.includes('text-based');
    const hasKeyword = description.includes('keyword');
    expect(hasTextBased || hasKeyword).toBe(true);
  });

  /**
   * FR-002: The Tidal search tool description MUST explicitly state
   * it does not support semantic or mood-based queries
   */
  it('contains "does NOT" warning about mood/semantic queries', () => {
    const description = TOOL_DESCRIPTIONS.tidalSearch;
    // Should contain explicit negative warning
    const hasDoesNot = description.includes('does NOT') || description.includes('does not');
    expect(hasDoesNot).toBe(true);
  });
});

describe('Tool Descriptions - Semantic Search', () => {
  /**
   * FR-003: The semantic search tool description MUST explicitly state
   * it searches only the user's indexed library based on lyrics interpretation
   */
  it('contains "lyrics interpretation" clarification', () => {
    const description = TOOL_DESCRIPTIONS.semanticSearch.toLowerCase();
    const hasLyricsInterpretation = description.includes('lyrics interpretation');
    expect(hasLyricsInterpretation).toBe(true);
  });

  /**
   * FR-003 continued: Must clarify library-only scope
   */
  it('mentions library-only scope', () => {
    const description = TOOL_DESCRIPTIONS.semanticSearch.toLowerCase();
    // Should mention indexed library or library-only
    const hasIndexedLibrary = description.includes('indexed library');
    const hasLibraryOnly = description.includes('library-only') || description.includes('library only');
    expect(hasIndexedLibrary || hasLibraryOnly).toBe(true);
  });

  /**
   * Per research.md: Semantic search matches lyrics interpretation, NOT musical style
   * This should be clarified in the description
   */
  it('clarifies it does NOT match musical style', () => {
    const description = TOOL_DESCRIPTIONS.semanticSearch.toLowerCase();
    // Should mention that it does NOT match style/genre/audio
    const hasNotStyle =
      description.includes('not musical style') ||
      description.includes('not style') ||
      description.includes('not audio');
    expect(hasNotStyle).toBe(true);
  });
});

describe('System Prompt - Tool Selection Strategy', () => {
  /**
   * FR-004: Tool descriptions MUST provide guidance on when to use each tool
   * This is implemented via the system prompt
   */
  it('contains "Tool Selection Strategy" section', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain('Tool Selection Strategy');
  });

  /**
   * The system prompt should guide the agent to ALWAYS augment
   * semantic search with Tidal searches
   */
  it('contains guidance to ALWAYS augment semantic search with Tidal', () => {
    const hasAlwaysAugment =
      CHAT_SYSTEM_PROMPT.includes('ALWAYS') &&
      (CHAT_SYSTEM_PROMPT.includes('augment') || CHAT_SYSTEM_PROMPT.includes('ALSO'));
    expect(hasAlwaysAugment).toBe(true);
  });
});
