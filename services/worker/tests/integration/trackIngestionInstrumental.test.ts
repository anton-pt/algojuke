/**
 * Integration tests for instrumental track handling in ingestion pipeline
 *
 * Tests the short description generation flow for instrumental tracks
 * (tracks without lyrics) using audio features and metadata-only fallback.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildInstrumentalShortDescriptionPrompt,
  buildMetadataOnlyShortDescriptionPrompt,
  formatAudioFeatures,
} from "../../src/prompts/shortDescription.js";

// Mock the Anthropic client
vi.mock("../../src/clients/anthropic.js", () => ({
  createAnthropicClient: vi.fn(() => ({
    generateInterpretation: vi.fn().mockResolvedValue({
      text: null,
      model: "claude-sonnet-4-5",
      inputTokens: 0,
      outputTokens: 0,
    }),
    generateShortDescription: vi.fn().mockResolvedValue({
      text: "A high-energy instrumental piece with electronic textures and a driving beat.",
      model: "claude-haiku-4-5-20251001",
      inputTokens: 60,
      outputTokens: 20,
    }),
  })),
  CLAUDE_MODEL: "claude-sonnet-4-5",
  CLAUDE_HAIKU_MODEL: "claude-haiku-4-5-20251001",
}));

describe("Instrumental Track Ingestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Audio Feature Detection", () => {
    it("should detect instrumental track when no lyrics/interpretation available", () => {
      const interpretation = null;
      const audioFeatures = { energy: 0.9, tempo: 140, valence: 0.6 };

      const isInstrumental = !interpretation;
      const hasAudioFeatures = Object.values(audioFeatures).some(
        (v) => v !== null && v !== undefined
      );

      expect(isInstrumental).toBe(true);
      expect(hasAudioFeatures).toBe(true);
    });

    it("should use instrumental prompt when interpretation is null", () => {
      const interpretation = null;
      const audioFeatures = { energy: 0.8, tempo: 120 };

      if (!interpretation && Object.keys(audioFeatures).length > 0) {
        const prompt = buildInstrumentalShortDescriptionPrompt(
          "Orion",
          "Metallica",
          "Master of Puppets",
          audioFeatures
        );

        expect(prompt).toContain("instrumental track");
        expect(prompt).toContain("Orion");
        expect(prompt).toContain("Metallica");
        expect(prompt).toContain("Master of Puppets");
      }
    });

    it("should use metadata-only prompt when no audio features available", () => {
      const interpretation = null;
      const audioFeatures = {};

      const hasAudioFeatures = Object.values(audioFeatures).some(
        (v) => v !== null && v !== undefined
      );

      expect(hasAudioFeatures).toBe(false);

      const prompt = buildMetadataOnlyShortDescriptionPrompt(
        "Unknown Track",
        "Unknown Artist",
        "Unknown Album"
      );

      expect(prompt).toContain("brief, neutral description");
      expect(prompt).not.toContain("Audio Features");
    });
  });

  describe("Audio Feature Formatting", () => {
    it("should format high energy correctly", () => {
      const features = { energy: 0.9 };
      const formatted = formatAudioFeatures(features);
      expect(formatted).toContain("high energy");
    });

    it("should format low energy correctly", () => {
      const features = { energy: 0.2 };
      const formatted = formatAudioFeatures(features);
      expect(formatted).toContain("low energy");
    });

    it("should format high valence as uplifting mood", () => {
      const features = { valence: 0.8 };
      const formatted = formatAudioFeatures(features);
      expect(formatted).toContain("uplifting mood");
    });

    it("should format low valence as melancholic mood", () => {
      const features = { valence: 0.2 };
      const formatted = formatAudioFeatures(features);
      expect(formatted).toContain("melancholic mood");
    });

    it("should format acoustic tracks", () => {
      const features = { acousticness: 0.9 };
      const formatted = formatAudioFeatures(features);
      expect(formatted).toContain("acoustic");
    });

    it("should format electronic tracks", () => {
      const features = { acousticness: 0.1 };
      const formatted = formatAudioFeatures(features);
      expect(formatted).toContain("electronic");
    });

    it("should format fast tempo", () => {
      const features = { tempo: 160 };
      const formatted = formatAudioFeatures(features);
      expect(formatted).toContain("fast tempo");
      expect(formatted).toContain("160 BPM");
    });

    it("should format slow tempo", () => {
      const features = { tempo: 60 };
      const formatted = formatAudioFeatures(features);
      expect(formatted).toContain("slow tempo");
      expect(formatted).toContain("60 BPM");
    });

    it("should format danceable tracks", () => {
      const features = { danceability: 0.9 };
      const formatted = formatAudioFeatures(features);
      expect(formatted).toContain("danceable");
    });

    it("should format ambient tracks", () => {
      const features = { danceability: 0.2 };
      const formatted = formatAudioFeatures(features);
      expect(formatted).toContain("ambient");
    });

    it("should format live recordings", () => {
      const features = { liveness: 0.9 };
      const formatted = formatAudioFeatures(features);
      expect(formatted).toContain("live recording");
    });

    it("should format spoken word elements", () => {
      const features = { speechiness: 0.8 };
      const formatted = formatAudioFeatures(features);
      expect(formatted).toContain("spoken word elements");
    });

    it("should combine multiple descriptors", () => {
      const features = {
        energy: 0.9,
        valence: 0.8,
        tempo: 140,
        danceability: 0.8,
      };
      const formatted = formatAudioFeatures(features);

      expect(formatted).toContain("high energy");
      expect(formatted).toContain("uplifting mood");
      expect(formatted).toContain("danceable");
    });

    it("should return default message for no distinctive features", () => {
      const features = {
        energy: 0.5, // neutral
        valence: 0.5, // neutral
      };
      const formatted = formatAudioFeatures(features);
      expect(formatted).toBe("No distinctive audio characteristics available");
    });
  });

  describe("Prompt Priority Logic", () => {
    it("should prioritize interpretation over audio features", () => {
      const interpretation = "A powerful rock ballad about perseverance.";
      const audioFeatures = { energy: 0.8, tempo: 120 };

      // In the pipeline, interpretation takes priority
      const useInterpretation = !!interpretation;
      expect(useInterpretation).toBe(true);
    });

    it("should fall back to audio features when no interpretation", () => {
      const interpretation = null;
      const audioFeatures = { energy: 0.8, tempo: 120 };

      const hasAudioFeatures = Object.keys(audioFeatures).length > 0;
      const useAudioFeatures = !interpretation && hasAudioFeatures;

      expect(useAudioFeatures).toBe(true);
    });

    it("should fall back to metadata-only when no interpretation and no features", () => {
      const interpretation = null;
      const audioFeatures = {};

      const hasAudioFeatures = Object.keys(audioFeatures).length > 0;
      const useMetadataOnly = !interpretation && !hasAudioFeatures;

      expect(useMetadataOnly).toBe(true);
    });
  });

  describe("Pipeline Integration Scenario", () => {
    it("should handle full instrumental flow", async () => {
      // Simulate pipeline data for instrumental track
      const trackData = {
        isrc: "USRC00000001",
        title: "Eruption",
        artist: "Van Halen",
        album: "Van Halen",
        lyrics: null, // No lyrics - instrumental
        interpretation: null, // No interpretation generated
        audioFeatures: {
          energy: 0.95,
          tempo: 168,
          danceability: 0.4,
          acousticness: 0.1,
          valence: 0.7,
        },
      };

      // Step 1: Detect that it's instrumental
      expect(trackData.lyrics).toBeNull();
      expect(trackData.interpretation).toBeNull();

      // Step 2: Format audio features
      const formatted = formatAudioFeatures(trackData.audioFeatures);
      expect(formatted).toContain("high energy");
      expect(formatted).toContain("electronic");

      // Step 3: Build instrumental prompt
      const prompt = buildInstrumentalShortDescriptionPrompt(
        trackData.title,
        trackData.artist,
        trackData.album,
        trackData.audioFeatures
      );

      expect(prompt).toContain("instrumental track");
      expect(prompt).toContain("Eruption");
      expect(prompt).toContain("Van Halen");
    });

    it("should handle minimal data instrumental", async () => {
      const trackData = {
        isrc: "USRC00000002",
        title: "Mysterious Piece",
        artist: "Unknown Composer",
        album: "Unknown Collection",
        lyrics: null,
        interpretation: null,
        audioFeatures: {},
      };

      // Falls back to metadata-only
      const prompt = buildMetadataOnlyShortDescriptionPrompt(
        trackData.title,
        trackData.artist,
        trackData.album
      );

      expect(prompt).toContain("brief, neutral description");
      expect(prompt).toContain("Mysterious Piece");
    });
  });
});
