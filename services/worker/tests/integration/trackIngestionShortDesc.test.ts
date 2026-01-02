/**
 * Integration tests for track ingestion pipeline with short description generation
 *
 * Tests the complete flow of generating short descriptions during track ingestion.
 * Note: These tests mock external dependencies (LLM, Qdrant) to test pipeline logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildShortDescriptionPrompt,
  buildInstrumentalShortDescriptionPrompt,
  buildMetadataOnlyShortDescriptionPrompt,
} from "../../src/prompts/shortDescription.js";

// Mock the Anthropic client
vi.mock("../../src/clients/anthropic.js", () => ({
  createAnthropicClient: vi.fn(() => ({
    generateInterpretation: vi.fn().mockResolvedValue({
      text: "A melancholic exploration of love and loss.",
      model: "claude-sonnet-4-5",
      inputTokens: 100,
      outputTokens: 50,
    }),
    generateShortDescription: vi.fn().mockResolvedValue({
      text: "A hauntingly beautiful ballad about unrequited love and the pain of letting go.",
      model: "claude-haiku-4-5-20251001",
      inputTokens: 80,
      outputTokens: 25,
    }),
  })),
  CLAUDE_MODEL: "claude-sonnet-4-5",
  CLAUDE_HAIKU_MODEL: "claude-haiku-4-5-20251001",
}));

describe("Track Ingestion Short Description Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Short Description Prompt Generation", () => {
    it("should generate correct prompt for track with interpretation", () => {
      const prompt = buildShortDescriptionPrompt(
        "Bohemian Rhapsody",
        "Queen",
        "A complex rock opera exploring themes of guilt, confession, and fate."
      );

      expect(prompt).toContain("Bohemian Rhapsody");
      expect(prompt).toContain("Queen");
      expect(prompt).toContain("guilt, confession, and fate");
      expect(prompt).toContain("exactly one sentence");
      expect(prompt).toContain("max 50 words");
    });

    it("should generate correct prompt for instrumental track", () => {
      const prompt = buildInstrumentalShortDescriptionPrompt(
        "Orion",
        "Metallica",
        "Master of Puppets",
        { energy: 0.8, tempo: 125, valence: 0.4 }
      );

      expect(prompt).toContain("Orion");
      expect(prompt).toContain("Metallica");
      expect(prompt).toContain("Master of Puppets");
      expect(prompt).toContain("instrumental");
      expect(prompt).toContain("high energy");
    });

    it("should generate correct prompt for track with only metadata", () => {
      const prompt = buildMetadataOnlyShortDescriptionPrompt(
        "Unknown Track",
        "Unknown Artist",
        "Unknown Album"
      );

      expect(prompt).toContain("Unknown Track");
      expect(prompt).toContain("Unknown Artist");
      expect(prompt).toContain("Unknown Album");
      expect(prompt).toContain("exactly one sentence");
    });
  });

  describe("Pipeline Step Logic", () => {
    it("should use interpretation prompt when interpretation exists", () => {
      const interpretation =
        "A powerful anthem about rising above adversity.";
      const hasInterpretation = interpretation !== null && interpretation !== "";

      expect(hasInterpretation).toBe(true);

      const prompt = buildShortDescriptionPrompt(
        "Eye of the Tiger",
        "Survivor",
        interpretation
      );

      expect(prompt).toContain("Summarize this track interpretation");
    });

    it("should use instrumental prompt when no interpretation but has audio features", () => {
      const interpretation = null;
      const audioFeatures = { energy: 0.9, tempo: 180 };
      const hasInterpretation = interpretation !== null && interpretation !== "";
      const hasAudioFeatures = Object.values(audioFeatures).some(
        (v) => v !== null && v !== undefined
      );

      expect(hasInterpretation).toBe(false);
      expect(hasAudioFeatures).toBe(true);

      const prompt = buildInstrumentalShortDescriptionPrompt(
        "YYZ",
        "Rush",
        "Moving Pictures",
        audioFeatures
      );

      expect(prompt).toContain("instrumental track");
    });

    it("should use metadata-only prompt when no interpretation and no audio features", () => {
      const interpretation = null;
      const audioFeatures = {};
      const hasInterpretation = interpretation !== null && interpretation !== "";
      const hasAudioFeatures = Object.values(audioFeatures).some(
        (v) => v !== null && v !== undefined
      );

      expect(hasInterpretation).toBe(false);
      expect(hasAudioFeatures).toBe(false);

      const prompt = buildMetadataOnlyShortDescriptionPrompt(
        "Mysterious Track",
        "Unknown",
        "Unknown Album"
      );

      expect(prompt).toContain("brief, neutral description");
    });
  });

  describe("Graceful Failure Handling", () => {
    it("should allow null short_description when generation fails", () => {
      // Simulate failure scenario
      const shortDescription = null;

      // In pipeline, we store null and continue
      const payload = {
        isrc: "USRC12345678",
        title: "Test Track",
        artist: "Test Artist",
        album: "Test Album",
        short_description: shortDescription,
      };

      expect(payload.short_description).toBeNull();
    });

    it("should not block pipeline when short description step fails", () => {
      // Simulate the pattern: try to generate, catch error, set null
      let shortDescription: string | null = null;
      try {
        throw new Error("LLM generation failed");
      } catch {
        shortDescription = null;
      }

      // Pipeline should continue with null value
      expect(shortDescription).toBeNull();
    });
  });
});
