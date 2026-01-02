/**
 * Agent Tool Selection Integration Tests
 *
 * Feature: 014-tidal-search-refinement
 *
 * These tests validate that the agent guidance (tool descriptions + system prompt)
 * correctly instructs the agent on tool selection behavior.
 *
 * Since we cannot mock the LLM's decision-making process, these tests validate:
 * 1. Tool descriptions contain correct guidance for different query types
 * 2. System prompt provides clear decision trees
 * 3. The guidance is consistent and non-contradictory
 *
 * Mock Strategy: These tests validate the content that will influence agent behavior,
 * not the agent's actual decisions (which require LLM execution).
 */

import { describe, it, expect } from 'vitest';
import { CHAT_SYSTEM_PROMPT } from '../../src/prompts/chatSystemPrompt.js';
import { TOOL_DESCRIPTIONS } from '../contract/toolDescriptions.test.js';

describe('Agent Tool Selection Guidance', () => {
  describe('Mood Query Guidance', () => {
    /**
     * T020: For mood query input, verify semanticSearch is recommended
     */
    it('system prompt recommends semanticSearch for mood/theme queries', () => {
      // The system prompt should guide the agent to use semanticSearch first for mood queries
      expect(CHAT_SYSTEM_PROMPT).toContain('mood/theme');
      expect(CHAT_SYSTEM_PROMPT).toContain('semanticSearch');

      // Should specify semantic search is first step for mood queries
      const moodSection = CHAT_SYSTEM_PROMPT.includes('User asks for mood/theme');
      expect(moodSection).toBe(true);

      // Should mention using semanticSearch first
      expect(CHAT_SYSTEM_PROMPT).toContain('First: Use semanticSearch');
    });

    /**
     * T020 continued: Verify system prompt includes example mood query
     */
    it('provides example mood query workflow', () => {
      // Should have worked example for mood queries
      expect(CHAT_SYSTEM_PROMPT).toContain('dreamy ambient');
      expect(CHAT_SYSTEM_PROMPT).toContain('semanticSearch("dreamy ambient")');
    });

    /**
     * T022: For mood query, verify tidalSearch guidance uses artist names
     */
    it('guides agent to use artist names (not mood text) for Tidal queries', () => {
      // System prompt should show tidalSearch with artist names, not mood text
      expect(CHAT_SYSTEM_PROMPT).toContain('tidalSearch("Brian Eno');
      expect(CHAT_SYSTEM_PROMPT).toContain('tidalSearch("Stars of the Lid');

      // Should explicitly warn against passing mood to tidalSearch
      expect(TOOL_DESCRIPTIONS.tidalSearch).toContain('does NOT understand mood');

      // Should provide decision tree guidance
      expect(CHAT_SYSTEM_PROMPT).toContain('Use YOUR music knowledge to identify artists');
    });
  });

  describe('Artist Query Guidance', () => {
    /**
     * T021: For artist query input ("Radiohead"), verify tidalSearch is recommended
     */
    it('system prompt recommends tidalSearch directly for artist queries', () => {
      // Should guide direct use of tidalSearch for artist names
      expect(CHAT_SYSTEM_PROMPT).toContain('Play something by Radiohead');
      expect(CHAT_SYSTEM_PROMPT).toContain('Directly use tidalSearch');

      // Should specify to skip semanticSearch for direct queries
      expect(CHAT_SYSTEM_PROMPT).toContain('Skip semanticSearch');
    });

    /**
     * T021 continued: Tool description clarifies tidalSearch is for names
     */
    it('tidalSearch description emphasizes name-based search', () => {
      const description = TOOL_DESCRIPTIONS.tidalSearch;

      // Should mention artist/album/track names
      expect(description).toContain('artist name');
      expect(description).toContain('album name');
      expect(description).toContain('track title');

      // Should clarify text-based nature
      expect(description).toContain('text-based');
      expect(description).toContain('keyword');
    });
  });

  describe('Always Augment Behavior', () => {
    /**
     * Validates that the agent is instructed to ALWAYS augment semantic search
     * with Tidal searches (per spec clarification about RRF hybrid scoring)
     */
    it('emphasizes always augmenting semantic search with Tidal', () => {
      // Should use strong language about always augmenting
      expect(CHAT_SYSTEM_PROMPT).toContain('ALWAYS ALSO');
      expect(CHAT_SYSTEM_PROMPT).toContain('CRITICAL');

      // Should explain why (RRF scoring always returns results)
      expect(CHAT_SYSTEM_PROMPT).toContain('always returns results');
      expect(CHAT_SYSTEM_PROMPT).toContain('RRF scoring');
      expect(CHAT_SYSTEM_PROMPT).toContain('cannot judge relevance by result count');
    });

    /**
     * Validates the agent understands semantic search limitations
     */
    it('clarifies semantic search limitations', () => {
      const description = TOOL_DESCRIPTIONS.semanticSearch;

      // Should clarify lyrics interpretation matching
      expect(description.toUpperCase()).toContain('LYRICS INTERPRETATION');

      // Should warn about style matching
      expect(description).toContain('not musical style');

      // Should mention library-only scope
      expect(description).toContain('indexed library');
    });
  });

  describe('Decision Tree Completeness', () => {
    /**
     * Validates the system prompt covers all query types
     */
    it('covers mood/theme, artist/album, genre, and ambiguous queries', () => {
      // Mood queries
      expect(CHAT_SYSTEM_PROMPT).toContain('User asks for mood/theme');

      // Artist queries
      expect(CHAT_SYSTEM_PROMPT).toContain('User asks for artist/album/track');

      // Genre exploration
      expect(CHAT_SYSTEM_PROMPT).toContain('User asks for genre exploration');

      // Ambiguous queries (edge case: band names that look like mood words)
      expect(CHAT_SYSTEM_PROMPT).toContain('Ambiguous queries');
      expect(CHAT_SYSTEM_PROMPT).toContain('Low');
    });

    /**
     * Validates examples are provided for each tool
     */
    it('provides positive and negative examples for tidalSearch', () => {
      // Positive examples (should work)
      expect(CHAT_SYSTEM_PROMPT).toContain('"Radiohead" ✓');
      expect(CHAT_SYSTEM_PROMPT).toContain('"OK Computer" ✓');

      // Negative examples (won't work)
      expect(CHAT_SYSTEM_PROMPT).toContain('"melancholic rock" ✗');
    });

    /**
     * Validates error handling guidance is present
     */
    it('includes error handling guidance', () => {
      // FR-014: Suggest different search terms
      expect(CHAT_SYSTEM_PROMPT).toContain('suggest');
      expect(CHAT_SYSTEM_PROMPT).toContain('different search terms');

      // FR-015: Try alternative artists
      expect(CHAT_SYSTEM_PROMPT).toContain('try alternative artists');
    });
  });

  describe('Transparency Guidance', () => {
    /**
     * US3: Agent should explain reasoning when using music knowledge
     */
    it('guides agent to explain artist suggestions', () => {
      expect(CHAT_SYSTEM_PROMPT).toContain('Explain to the user why you suggested');
      expect(CHAT_SYSTEM_PROMPT).toContain('masters of the ambient genre');
    });

    /**
     * FR-012: Results are distinguished by tool call presentation in UI
     */
    it('clarifies UI handles source distinction', () => {
      expect(CHAT_SYSTEM_PROMPT).toContain('UI automatically distinguishes results');
    });

    /**
     * US4: Agent should acknowledge empty library and explain Tidal fallback
     */
    it('guides agent to acknowledge empty library results', () => {
      expect(CHAT_SYSTEM_PROMPT).toContain('acknowledge this to the user');
      expect(CHAT_SYSTEM_PROMPT).toContain('searching the broader Tidal catalogue');
    });
  });
});

describe('Tool Description Consistency', () => {
  /**
   * Validates that tool descriptions and system prompt don't contradict
   */
  it('tidalSearch guidance is consistent across tool and prompt', () => {
    const toolDescription = TOOL_DESCRIPTIONS.tidalSearch;
    const systemPrompt = CHAT_SYSTEM_PROMPT;

    // Both should mention text-based/keyword nature
    const toolHasKeyword = toolDescription.includes('keyword') || toolDescription.includes('text-based');
    const promptWarnsAgainstMood = systemPrompt.includes('melancholic rock') && systemPrompt.includes('✗');

    expect(toolHasKeyword).toBe(true);
    expect(promptWarnsAgainstMood).toBe(true);
  });

  it('semanticSearch guidance is consistent across tool and prompt', () => {
    const toolDescription = TOOL_DESCRIPTIONS.semanticSearch;
    const systemPrompt = CHAT_SYSTEM_PROMPT;

    // Both should mention lyrics interpretation
    const toolMentionsLyrics = toolDescription.toUpperCase().includes('LYRICS INTERPRETATION');
    const promptMentionsLyrics = systemPrompt.toUpperCase().includes('LYRICS INTERPRETATION');

    expect(toolMentionsLyrics).toBe(true);
    expect(promptMentionsLyrics).toBe(true);
  });
});
