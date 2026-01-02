/**
 * Contract tests for Short Description prompt templates and validation
 */

import { describe, it, expect } from "vitest";
import {
  buildShortDescriptionPrompt,
  buildInstrumentalShortDescriptionPrompt,
  buildMetadataOnlyShortDescriptionPrompt,
  formatAudioFeatures,
} from "../../src/prompts/shortDescription.js";

describe("Short Description Prompts", () => {
  describe("buildShortDescriptionPrompt", () => {
    it("should include track title and artist", () => {
      const prompt = buildShortDescriptionPrompt(
        "Bohemian Rhapsody",
        "Queen",
        "A complex rock opera about a young man's confession and descent."
      );

      expect(prompt).toContain("Bohemian Rhapsody");
      expect(prompt).toContain("Queen");
    });

    it("should include interpretation text", () => {
      const interpretation =
        "A melancholic exploration of love and loss through metaphorical imagery.";
      const prompt = buildShortDescriptionPrompt(
        "Test Track",
        "Test Artist",
        interpretation
      );

      expect(prompt).toContain(interpretation);
    });

    it("should instruct for exactly one sentence and max 50 words", () => {
      const prompt = buildShortDescriptionPrompt(
        "Test",
        "Artist",
        "Some interpretation"
      );

      expect(prompt).toContain("exactly one sentence");
      expect(prompt).toContain("max 50 words");
    });

    it("should instruct to output only the sentence", () => {
      const prompt = buildShortDescriptionPrompt(
        "Test",
        "Artist",
        "Some interpretation"
      );

      expect(prompt).toContain("Output only the sentence");
    });
  });

  describe("buildInstrumentalShortDescriptionPrompt", () => {
    it("should include track metadata", () => {
      const prompt = buildInstrumentalShortDescriptionPrompt(
        "Instrumental Track",
        "Test Artist",
        "Test Album",
        { energy: 0.8, tempo: 140 }
      );

      expect(prompt).toContain("Instrumental Track");
      expect(prompt).toContain("Test Artist");
      expect(prompt).toContain("Test Album");
    });

    it("should include formatted audio features", () => {
      const prompt = buildInstrumentalShortDescriptionPrompt(
        "Test",
        "Artist",
        "Album",
        { energy: 0.8, tempo: 140 }
      );

      expect(prompt).toContain("high energy");
      expect(prompt).toContain("140 BPM");
    });

    it("should instruct for exactly one sentence and max 50 words", () => {
      const prompt = buildInstrumentalShortDescriptionPrompt(
        "Test",
        "Artist",
        "Album",
        {}
      );

      expect(prompt).toContain("exactly one sentence");
      expect(prompt).toContain("max 50 words");
    });
  });

  describe("buildMetadataOnlyShortDescriptionPrompt", () => {
    it("should include basic metadata", () => {
      const prompt = buildMetadataOnlyShortDescriptionPrompt(
        "Unknown Track",
        "Unknown Artist",
        "Unknown Album"
      );

      expect(prompt).toContain("Unknown Track");
      expect(prompt).toContain("Unknown Artist");
      expect(prompt).toContain("Unknown Album");
    });

    it("should instruct for exactly one sentence and max 50 words", () => {
      const prompt = buildMetadataOnlyShortDescriptionPrompt(
        "Test",
        "Artist",
        "Album"
      );

      expect(prompt).toContain("exactly one sentence");
      expect(prompt).toContain("max 50 words");
    });
  });
});

describe("Audio Feature Formatter", () => {
  describe("formatAudioFeatures", () => {
    it("should format high energy correctly", () => {
      const result = formatAudioFeatures({ energy: 0.85 });
      expect(result).toContain("high energy");
    });

    it("should format low energy correctly", () => {
      const result = formatAudioFeatures({ energy: 0.2 });
      expect(result).toContain("low energy");
    });

    it("should format high valence as uplifting mood", () => {
      const result = formatAudioFeatures({ valence: 0.8 });
      expect(result).toContain("uplifting mood");
    });

    it("should format low valence as melancholic mood", () => {
      const result = formatAudioFeatures({ valence: 0.2 });
      expect(result).toContain("melancholic mood");
    });

    it("should format high acousticness", () => {
      const result = formatAudioFeatures({ acousticness: 0.9 });
      expect(result).toContain("acoustic");
    });

    it("should format low acousticness as electronic", () => {
      const result = formatAudioFeatures({ acousticness: 0.1 });
      expect(result).toContain("electronic");
    });

    it("should format high danceability", () => {
      const result = formatAudioFeatures({ danceability: 0.8 });
      expect(result).toContain("danceable");
    });

    it("should format low danceability as ambient", () => {
      const result = formatAudioFeatures({ danceability: 0.2 });
      expect(result).toContain("ambient");
    });

    it("should format fast tempo", () => {
      const result = formatAudioFeatures({ tempo: 150 });
      expect(result).toContain("fast tempo");
      expect(result).toContain("150 BPM");
    });

    it("should format slow tempo", () => {
      const result = formatAudioFeatures({ tempo: 60 });
      expect(result).toContain("slow tempo");
      expect(result).toContain("60 BPM");
    });

    it("should format moderate tempo with just BPM", () => {
      const result = formatAudioFeatures({ tempo: 100 });
      expect(result).toContain("100 BPM");
      expect(result).not.toContain("fast");
      expect(result).not.toContain("slow");
    });

    it("should format live recording", () => {
      const result = formatAudioFeatures({ liveness: 0.9 });
      expect(result).toContain("live recording");
    });

    it("should format spoken word elements", () => {
      const result = formatAudioFeatures({ speechiness: 0.7 });
      expect(result).toContain("spoken word elements");
    });

    it("should combine multiple descriptors", () => {
      const result = formatAudioFeatures({
        energy: 0.8,
        valence: 0.2,
        tempo: 140,
      });

      expect(result).toContain("high energy");
      expect(result).toContain("melancholic mood");
      expect(result).toContain("140 BPM");
    });

    it("should handle null values gracefully", () => {
      const result = formatAudioFeatures({
        energy: null,
        valence: null,
        tempo: null,
      });

      expect(result).toBe("No distinctive audio characteristics available");
    });

    it("should handle empty features object", () => {
      const result = formatAudioFeatures({});
      expect(result).toBe("No distinctive audio characteristics available");
    });

    it("should skip mid-range values that don't have descriptors", () => {
      const result = formatAudioFeatures({
        energy: 0.5, // Mid-range, no descriptor
        valence: 0.5, // Mid-range, no descriptor
      });

      expect(result).toBe("No distinctive audio characteristics available");
    });
  });
});
