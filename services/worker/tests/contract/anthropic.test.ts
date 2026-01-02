/**
 * Anthropic LLM Client Contract Tests
 *
 * Tests the Anthropic LLM client interface and types.
 * These tests verify that the client types are correctly defined.
 *
 * Note: Actual API calls are not tested here as they require
 * a valid API key. Integration tests cover live API behavior.
 */

import { describe, it, expect } from "vitest";
import {
  CLAUDE_MODEL,
  CLAUDE_HAIKU_MODEL,
  type InterpretationResult,
  type ShortDescriptionResult,
  type LLMClient,
} from "../../src/clients/anthropic.js";
import { buildInterpretationPrompt } from "../../src/prompts/lyricsInterpretation.js";

describe("Anthropic Client Contract", () => {
  describe("Model Constants", () => {
    it("should use Claude Sonnet 4.5 model", () => {
      expect(CLAUDE_MODEL).toBe("claude-sonnet-4-5");
    });

    it("should use Claude Haiku 4.5 model for short descriptions", () => {
      expect(CLAUDE_HAIKU_MODEL).toBe("claude-haiku-4-5-20251001");
    });
  });

  describe("InterpretationResult Type", () => {
    it("should validate a complete interpretation result", () => {
      const result: InterpretationResult = {
        text: "This song explores themes of existential questioning and escapism...",
        model: CLAUDE_MODEL,
        inputTokens: 500,
        outputTokens: 200,
      };

      expect(result.text).toBeDefined();
      expect(result.model).toBe(CLAUDE_MODEL);
      expect(result.inputTokens).toBeGreaterThanOrEqual(0);
      expect(result.outputTokens).toBeGreaterThanOrEqual(0);
    });
  });

  describe("LLMClient Interface", () => {
    it("should define generateInterpretation method signature", () => {
      // Type check - this is a compile-time verification
      const mockClient: LLMClient = {
        generateInterpretation: async (
          title: string,
          artist: string,
          album: string,
          lyrics: string
        ): Promise<InterpretationResult> => {
          return {
            text: `Interpretation of ${title} by ${artist}`,
            model: CLAUDE_MODEL,
            inputTokens: 100,
            outputTokens: 50,
          };
        },
        generateShortDescription: async (
          prompt: string
        ): Promise<ShortDescriptionResult> => {
          return {
            text: "A test short description.",
            model: CLAUDE_HAIKU_MODEL,
            inputTokens: 50,
            outputTokens: 20,
          };
        },
      };

      expect(mockClient.generateInterpretation).toBeDefined();
      expect(typeof mockClient.generateInterpretation).toBe("function");
      expect(mockClient.generateShortDescription).toBeDefined();
      expect(typeof mockClient.generateShortDescription).toBe("function");
    });
  });

  describe("Interpretation Prompt", () => {
    it("should build a valid prompt with all parameters", () => {
      const prompt = buildInterpretationPrompt(
        "Bohemian Rhapsody",
        "Queen",
        "A Night at the Opera",
        "Is this the real life?\nIs this just fantasy?"
      );

      expect(prompt).toContain("Bohemian Rhapsody");
      expect(prompt).toContain("Queen");
      expect(prompt).toContain("A Night at the Opera");
      expect(prompt).toContain("Is this the real life?");
      expect(prompt).toContain("Themes");
      expect(prompt).toContain("Emotional Tone");
      expect(prompt).toContain("Narrative");
    });

    it("should handle special characters in lyrics", () => {
      const prompt = buildInterpretationPrompt(
        "Test Song",
        "Test Artist",
        "Test Album",
        "Line with \"quotes\" and 'apostrophes'\nLine with <brackets> & ampersands"
      );

      expect(prompt).toContain("\"quotes\"");
      expect(prompt).toContain("'apostrophes'");
      expect(prompt).toContain("<brackets>");
      expect(prompt).toContain("& ampersands");
    });

    it("should handle multilingual lyrics", () => {
      const prompt = buildInterpretationPrompt(
        "La Vie en Rose",
        "Édith Piaf",
        "Album",
        "Quand il me prend dans ses bras\nIl me parle tout bas"
      );

      expect(prompt).toContain("Édith Piaf");
      expect(prompt).toContain("Quand il me prend dans ses bras");
    });

    it("should handle long lyrics", () => {
      const longLyrics = "Verse\n".repeat(100);
      const prompt = buildInterpretationPrompt(
        "Long Song",
        "Artist",
        "Album",
        longLyrics
      );

      // Should contain the full lyrics
      expect(prompt).toContain(longLyrics);
    });
  });
});
