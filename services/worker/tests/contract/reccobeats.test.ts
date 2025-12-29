/**
 * ReccoBeats Client Contract Tests
 *
 * Tests the ReccoBeats API client response schema validation.
 * These tests verify that the client correctly handles various API responses.
 */

import { describe, it, expect } from "vitest";
import { ReccoBeatsAudioFeaturesResponseSchema } from "../../src/clients/reccobeats.js";

describe("ReccoBeats Client Contract", () => {
  describe("Audio Features Response Schema", () => {
    it("should validate a complete audio features response", () => {
      const response = {
        content: [
          {
            isrc: "USRC11700001",
            acousticness: 0.25,
            danceability: 0.75,
            energy: 0.85,
            instrumentalness: 0.0,
            key: 9, // A
            liveness: 0.15,
            loudness: -5.5,
            mode: 1, // Major
            speechiness: 0.05,
            tempo: 112.5,
            valence: 0.65,
          },
        ],
      };

      const result = ReccoBeatsAudioFeaturesResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it("should validate response with null audio features", () => {
      const response = {
        content: [
          {
            isrc: "USRC11700001",
            acousticness: null,
            danceability: null,
            energy: null,
            instrumentalness: null,
            key: null,
            liveness: null,
            loudness: null,
            mode: null,
            speechiness: null,
            tempo: null,
            valence: null,
          },
        ],
      };

      const result = ReccoBeatsAudioFeaturesResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it("should validate empty results array", () => {
      const response = {
        content: [],
      };

      const result = ReccoBeatsAudioFeaturesResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it("should validate response with multiple results", () => {
      const response = {
        content: [
          {
            isrc: "USRC11700001",
            acousticness: 0.25,
            danceability: 0.75,
            energy: 0.85,
            instrumentalness: 0.0,
            key: 9,
            liveness: 0.15,
            loudness: -5.5,
            mode: 1,
            speechiness: 0.05,
            tempo: 112.5,
            valence: 0.65,
          },
          {
            isrc: "USRC11700001",
            acousticness: 0.30,
            danceability: 0.70,
            energy: 0.80,
            instrumentalness: 0.0,
            key: 9,
            liveness: 0.10,
            loudness: -6.0,
            mode: 1,
            speechiness: 0.04,
            tempo: 113.0,
            valence: 0.60,
          },
        ],
      };

      const result = ReccoBeatsAudioFeaturesResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it("should reject invalid acousticness range", () => {
      const response = {
        content: [
          {
            isrc: "USRC11700001",
            acousticness: 1.5, // Invalid: > 1
            danceability: 0.75,
            energy: 0.85,
            instrumentalness: 0.0,
            key: 9,
            liveness: 0.15,
            loudness: -5.5,
            mode: 1,
            speechiness: 0.05,
            tempo: 112.5,
            valence: 0.65,
          },
        ],
      };

      const result = ReccoBeatsAudioFeaturesResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it("should reject invalid key range", () => {
      const response = {
        content: [
          {
            isrc: "USRC11700001",
            acousticness: 0.25,
            danceability: 0.75,
            energy: 0.85,
            instrumentalness: 0.0,
            key: 12, // Invalid: > 11
            liveness: 0.15,
            loudness: -5.5,
            mode: 1,
            speechiness: 0.05,
            tempo: 112.5,
            valence: 0.65,
          },
        ],
      };

      const result = ReccoBeatsAudioFeaturesResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it("should reject invalid mode value", () => {
      const response = {
        content: [
          {
            isrc: "USRC11700001",
            acousticness: 0.25,
            danceability: 0.75,
            energy: 0.85,
            instrumentalness: 0.0,
            key: 9,
            liveness: 0.15,
            loudness: -5.5,
            mode: 2, // Invalid: must be 0 or 1
            speechiness: 0.05,
            tempo: 112.5,
            valence: 0.65,
          },
        ],
      };

      const result = ReccoBeatsAudioFeaturesResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it("should reject invalid loudness range", () => {
      const response = {
        content: [
          {
            isrc: "USRC11700001",
            acousticness: 0.25,
            danceability: 0.75,
            energy: 0.85,
            instrumentalness: 0.0,
            key: 9,
            liveness: 0.15,
            loudness: 5.0, // Invalid: > 0
            mode: 1,
            speechiness: 0.05,
            tempo: 112.5,
            valence: 0.65,
          },
        ],
      };

      const result = ReccoBeatsAudioFeaturesResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });
  });
});
