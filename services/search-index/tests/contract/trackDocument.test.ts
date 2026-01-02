/**
 * Contract tests for TrackDocument schema
 *
 * Validates the Zod schema for track documents including
 * the new short_description field.
 */

import { describe, it, expect } from "vitest";
import {
  TrackDocumentSchema,
  TrackPayloadSchema,
  validateTrackDocument,
  safeValidateTrackDocument,
} from "../../src/schema/trackDocument.js";

// Helper to create valid base document
function createValidBaseDocument() {
  return {
    isrc: "USRC12345678",
    title: "Test Track",
    artist: "Test Artist",
    album: "Test Album",
    interpretation_embedding: Array(4096).fill(0),
  };
}

describe("TrackDocumentSchema", () => {
  describe("short_description field", () => {
    it("should accept a valid short description", () => {
      const doc = {
        ...createValidBaseDocument(),
        short_description:
          "A melancholic ballad exploring themes of loss and redemption.",
      };

      const result = TrackDocumentSchema.safeParse(doc);
      expect(result.success).toBe(true);
    });

    it("should accept null short_description", () => {
      const doc = {
        ...createValidBaseDocument(),
        short_description: null,
      };

      const result = TrackDocumentSchema.safeParse(doc);
      expect(result.success).toBe(true);
    });

    it("should accept undefined short_description (optional)", () => {
      const doc = createValidBaseDocument();

      const result = TrackDocumentSchema.safeParse(doc);
      expect(result.success).toBe(true);
    });

    it("should accept empty string short_description", () => {
      const doc = {
        ...createValidBaseDocument(),
        short_description: "",
      };

      const result = TrackDocumentSchema.safeParse(doc);
      expect(result.success).toBe(true);
    });

    it("should reject short_description exceeding 500 characters", () => {
      const doc = {
        ...createValidBaseDocument(),
        short_description: "a".repeat(501),
      };

      const result = TrackDocumentSchema.safeParse(doc);
      expect(result.success).toBe(false);
    });

    it("should accept short_description at exactly 500 characters", () => {
      const doc = {
        ...createValidBaseDocument(),
        short_description: "a".repeat(500),
      };

      const result = TrackDocumentSchema.safeParse(doc);
      expect(result.success).toBe(true);
    });
  });

  describe("core required fields", () => {
    it("should require isrc", () => {
      const doc = {
        title: "Test",
        artist: "Artist",
        album: "Album",
        interpretation_embedding: Array(4096).fill(0),
      };

      const result = TrackDocumentSchema.safeParse(doc);
      expect(result.success).toBe(false);
    });

    it("should validate ISRC format (12 alphanumeric)", () => {
      const validDoc = {
        ...createValidBaseDocument(),
        isrc: "USRC12345678",
      };
      expect(TrackDocumentSchema.safeParse(validDoc).success).toBe(true);

      const invalidDoc = {
        ...createValidBaseDocument(),
        isrc: "invalid",
      };
      expect(TrackDocumentSchema.safeParse(invalidDoc).success).toBe(false);
    });

    it("should require title", () => {
      const { title, ...doc } = createValidBaseDocument();
      const result = TrackDocumentSchema.safeParse(doc);
      expect(result.success).toBe(false);
    });

    it("should require artist", () => {
      const { artist, ...doc } = createValidBaseDocument();
      const result = TrackDocumentSchema.safeParse(doc);
      expect(result.success).toBe(false);
    });

    it("should require album", () => {
      const { album, ...doc } = createValidBaseDocument();
      const result = TrackDocumentSchema.safeParse(doc);
      expect(result.success).toBe(false);
    });

    it("should require interpretation_embedding with 4096 dimensions", () => {
      const doc = {
        ...createValidBaseDocument(),
        interpretation_embedding: Array(1024).fill(0), // Wrong size
      };
      const result = TrackDocumentSchema.safeParse(doc);
      expect(result.success).toBe(false);
    });
  });

  describe("optional text fields", () => {
    it("should accept lyrics as string or null", () => {
      expect(
        TrackDocumentSchema.safeParse({
          ...createValidBaseDocument(),
          lyrics: "Some lyrics",
        }).success
      ).toBe(true);

      expect(
        TrackDocumentSchema.safeParse({
          ...createValidBaseDocument(),
          lyrics: null,
        }).success
      ).toBe(true);
    });

    it("should accept interpretation as string or null", () => {
      expect(
        TrackDocumentSchema.safeParse({
          ...createValidBaseDocument(),
          interpretation: "Some interpretation",
        }).success
      ).toBe(true);

      expect(
        TrackDocumentSchema.safeParse({
          ...createValidBaseDocument(),
          interpretation: null,
        }).success
      ).toBe(true);
    });
  });

  describe("audio features", () => {
    it("should accept all audio feature fields", () => {
      const doc = {
        ...createValidBaseDocument(),
        acousticness: 0.5,
        danceability: 0.7,
        energy: 0.8,
        instrumentalness: 0.1,
        key: 5,
        liveness: 0.2,
        loudness: -5,
        mode: 1,
        speechiness: 0.1,
        tempo: 120,
        valence: 0.6,
      };

      const result = TrackDocumentSchema.safeParse(doc);
      expect(result.success).toBe(true);
    });

    it("should validate energy range (0-1)", () => {
      expect(
        TrackDocumentSchema.safeParse({
          ...createValidBaseDocument(),
          energy: 1.5,
        }).success
      ).toBe(false);

      expect(
        TrackDocumentSchema.safeParse({
          ...createValidBaseDocument(),
          energy: -0.1,
        }).success
      ).toBe(false);
    });

    it("should validate key range (-1 to 11)", () => {
      expect(
        TrackDocumentSchema.safeParse({
          ...createValidBaseDocument(),
          key: 12,
        }).success
      ).toBe(false);

      expect(
        TrackDocumentSchema.safeParse({
          ...createValidBaseDocument(),
          key: -2,
        }).success
      ).toBe(false);
    });

    it("should validate mode as 0 or 1", () => {
      expect(
        TrackDocumentSchema.safeParse({
          ...createValidBaseDocument(),
          mode: 0,
        }).success
      ).toBe(true);

      expect(
        TrackDocumentSchema.safeParse({
          ...createValidBaseDocument(),
          mode: 1,
        }).success
      ).toBe(true);

      expect(
        TrackDocumentSchema.safeParse({
          ...createValidBaseDocument(),
          mode: 2,
        }).success
      ).toBe(false);
    });

    it("should validate tempo range (0-250)", () => {
      expect(
        TrackDocumentSchema.safeParse({
          ...createValidBaseDocument(),
          tempo: 300,
        }).success
      ).toBe(false);
    });
  });
});

describe("TrackPayloadSchema", () => {
  it("should not include interpretation_embedding", () => {
    const doc = {
      isrc: "USRC12345678",
      title: "Test",
      artist: "Artist",
      album: "Album",
      short_description: "A test track.",
    };

    const result = TrackPayloadSchema.safeParse(doc);
    expect(result.success).toBe(true);
  });
});

describe("validateTrackDocument", () => {
  it("should return validated document for valid input", () => {
    const doc = createValidBaseDocument();
    const result = validateTrackDocument(doc);
    expect(result.isrc).toBe("USRC12345678");
  });

  it("should throw for invalid input", () => {
    expect(() => validateTrackDocument({ invalid: true })).toThrow();
  });
});

describe("safeValidateTrackDocument", () => {
  it("should return success for valid input", () => {
    const doc = createValidBaseDocument();
    const result = safeValidateTrackDocument(doc);
    expect(result.success).toBe(true);
  });

  it("should return error for invalid input", () => {
    const result = safeValidateTrackDocument({ invalid: true });
    expect(result.success).toBe(false);
  });
});
