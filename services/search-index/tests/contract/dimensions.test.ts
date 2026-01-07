/**
 * Vector Index Dimension Configuration Tests
 *
 * Feature: 043-gemini-embeddings
 * Date: 2025-01-07
 *
 * Tests the vector index dimension configuration including:
 * - getVectorConfig() dimension parameterization
 * - getEmbeddingDimensions() configuration function
 * - Track document schema dimension validation
 *
 * Spec references:
 * - US-004: Vector Index Configuration
 *   - EMBEDDING_DIMENSIONS=3072 for production (Gemini)
 *   - EMBEDDING_DIMENSIONS=1024 for local development (TEI)
 *   - Collection schema must match embedding provider dimensions
 *
 * NOTE: These tests verify the expected interface after feature implementation.
 * The config.ts module and getVectorConfig() function will be created as part
 * of the implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Expected dimension constants
const LOCAL_DIMENSIONS = 1024;
const GEMINI_DIMENSIONS = 3072;

describe("Vector Index Dimension Configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getEmbeddingDimensions()", () => {
    it("should return 1024 when EMBEDDING_DIMENSIONS is not set (default)", async () => {
      delete process.env.EMBEDDING_DIMENSIONS;
      delete process.env.EMBEDDING_PROVIDER;

      const { getEmbeddingDimensions } = await import("../../src/config.js");

      expect(getEmbeddingDimensions()).toBe(LOCAL_DIMENSIONS);
    });

    it("should return 1024 when EMBEDDING_PROVIDER=local", async () => {
      process.env.EMBEDDING_PROVIDER = "local";
      delete process.env.EMBEDDING_DIMENSIONS;

      const { getEmbeddingDimensions } = await import("../../src/config.js");

      expect(getEmbeddingDimensions()).toBe(LOCAL_DIMENSIONS);
    });

    it("should return 3072 when EMBEDDING_PROVIDER=gemini", async () => {
      process.env.EMBEDDING_PROVIDER = "gemini";
      delete process.env.EMBEDDING_DIMENSIONS;

      const { getEmbeddingDimensions } = await import("../../src/config.js");

      expect(getEmbeddingDimensions()).toBe(GEMINI_DIMENSIONS);
    });

    it("should use EMBEDDING_DIMENSIONS override when set", async () => {
      process.env.EMBEDDING_DIMENSIONS = "2048";

      const { getEmbeddingDimensions } = await import("../../src/config.js");

      expect(getEmbeddingDimensions()).toBe(2048);
    });

    it("should prioritize EMBEDDING_DIMENSIONS over provider default", async () => {
      process.env.EMBEDDING_PROVIDER = "gemini";
      process.env.EMBEDDING_DIMENSIONS = "1024";

      const { getEmbeddingDimensions } = await import("../../src/config.js");

      // Explicit EMBEDDING_DIMENSIONS takes precedence
      expect(getEmbeddingDimensions()).toBe(1024);
    });
  });

  describe("getVectorConfig()", () => {
    it("should return config with 1024 dimensions for local provider", async () => {
      delete process.env.EMBEDDING_PROVIDER;
      delete process.env.EMBEDDING_DIMENSIONS;

      const { getVectorConfig } =
        await import("../../src/schema/trackCollection.js");

      const config = getVectorConfig();

      expect(config.interpretation_embedding.size).toBe(LOCAL_DIMENSIONS);
      expect(config.interpretation_embedding.distance).toBe("Cosine");
      expect(config.interpretation_embedding.datatype).toBe("float16");
    });

    it("should return config with 3072 dimensions for gemini provider", async () => {
      process.env.EMBEDDING_PROVIDER = "gemini";
      delete process.env.EMBEDDING_DIMENSIONS;

      const { getVectorConfig } =
        await import("../../src/schema/trackCollection.js");

      const config = getVectorConfig();

      expect(config.interpretation_embedding.size).toBe(GEMINI_DIMENSIONS);
      expect(config.interpretation_embedding.distance).toBe("Cosine");
    });

    it("should use EMBEDDING_DIMENSIONS override", async () => {
      process.env.EMBEDDING_DIMENSIONS = "2048";

      const { getVectorConfig } =
        await import("../../src/schema/trackCollection.js");

      const config = getVectorConfig();

      expect(config.interpretation_embedding.size).toBe(2048);
    });
  });

  describe("Collection Config", () => {
    it("should create valid collection config with parameterized dimensions", async () => {
      delete process.env.EMBEDDING_PROVIDER;
      delete process.env.EMBEDDING_DIMENSIONS;

      const { getCollectionConfig } =
        await import("../../src/schema/trackCollection.js");

      const config = getCollectionConfig("tracks-test");

      expect(config).toBeDefined();
      expect(config.vectors).toBeDefined();
      expect(config.hnsw_config).toBeDefined();
      expect(config.optimizers_config).toBeDefined();
    });
  });
});

describe("Track Document Schema Dimensions", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("createTrackDocumentSchema()", () => {
    it("should create schema validating 1024 dimensions for local provider", async () => {
      delete process.env.EMBEDDING_PROVIDER;
      delete process.env.EMBEDDING_DIMENSIONS;

      const { createTrackDocumentSchema } =
        await import("../../src/schema/trackDocument.js");

      const schema = createTrackDocumentSchema();

      const validDoc = {
        isrc: "USRC12345678",
        title: "Test Track",
        artist: "Test Artist",
        album: "Test Album",
        interpretation_embedding: new Array(LOCAL_DIMENSIONS).fill(0.1),
      };

      const result = schema.safeParse(validDoc);
      expect(result.success).toBe(true);
    });

    it("should create schema validating 3072 dimensions for gemini provider", async () => {
      process.env.EMBEDDING_PROVIDER = "gemini";
      delete process.env.EMBEDDING_DIMENSIONS;

      const { createTrackDocumentSchema } =
        await import("../../src/schema/trackDocument.js");

      const schema = createTrackDocumentSchema();

      const validDoc = {
        isrc: "USRC12345678",
        title: "Test Track",
        artist: "Test Artist",
        album: "Test Album",
        interpretation_embedding: new Array(GEMINI_DIMENSIONS).fill(0.1),
      };

      const result = schema.safeParse(validDoc);
      expect(result.success).toBe(true);
    });

    it("should reject document with wrong dimensions for local provider", async () => {
      delete process.env.EMBEDDING_PROVIDER;
      delete process.env.EMBEDDING_DIMENSIONS;

      const { createTrackDocumentSchema } =
        await import("../../src/schema/trackDocument.js");

      const schema = createTrackDocumentSchema();

      const invalidDoc = {
        isrc: "USRC12345678",
        title: "Test Track",
        artist: "Test Artist",
        album: "Test Album",
        // Wrong dimensions (3072 instead of expected 1024)
        interpretation_embedding: new Array(GEMINI_DIMENSIONS).fill(0.1),
      };

      const result = schema.safeParse(invalidDoc);
      expect(result.success).toBe(false);
    });

    it("should reject document with wrong dimensions for gemini provider", async () => {
      process.env.EMBEDDING_PROVIDER = "gemini";
      delete process.env.EMBEDDING_DIMENSIONS;

      const { createTrackDocumentSchema } =
        await import("../../src/schema/trackDocument.js");

      const schema = createTrackDocumentSchema();

      const invalidDoc = {
        isrc: "USRC12345678",
        title: "Test Track",
        artist: "Test Artist",
        album: "Test Album",
        // Wrong dimensions (1024 instead of expected 3072)
        interpretation_embedding: new Array(LOCAL_DIMENSIONS).fill(0.1),
      };

      const result = schema.safeParse(invalidDoc);
      expect(result.success).toBe(false);
    });
  });
});

describe("Test Utilities Dimension Handling", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("generateRandomVector()", () => {
    it("should generate 1024-dimensional vector for local provider", async () => {
      delete process.env.EMBEDDING_PROVIDER;
      delete process.env.EMBEDDING_DIMENSIONS;

      const { generateRandomVector } =
        await import("../../src/scripts/testUtils.js");

      const vector = generateRandomVector();

      expect(vector).toHaveLength(LOCAL_DIMENSIONS);
      // Should be normalized (approximately unit length)
      const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
      expect(magnitude).toBeCloseTo(1, 1);
    });

    it("should generate 3072-dimensional vector for gemini provider", async () => {
      process.env.EMBEDDING_PROVIDER = "gemini";
      delete process.env.EMBEDDING_DIMENSIONS;

      const { generateRandomVector } =
        await import("../../src/scripts/testUtils.js");

      const vector = generateRandomVector();

      expect(vector).toHaveLength(GEMINI_DIMENSIONS);
    });
  });

  describe("generateTestTrack()", () => {
    it("should generate track with correct embedding dimensions for local provider", async () => {
      delete process.env.EMBEDDING_PROVIDER;
      delete process.env.EMBEDDING_DIMENSIONS;

      const { generateTestTrack } =
        await import("../../src/scripts/testUtils.js");

      const track = generateTestTrack();

      expect(track.interpretation_embedding).toHaveLength(LOCAL_DIMENSIONS);
    });

    it("should generate track with correct embedding dimensions for gemini provider", async () => {
      process.env.EMBEDDING_PROVIDER = "gemini";
      delete process.env.EMBEDDING_DIMENSIONS;

      const { generateTestTrack } =
        await import("../../src/scripts/testUtils.js");

      const track = generateTestTrack();

      expect(track.interpretation_embedding).toHaveLength(GEMINI_DIMENSIONS);
    });

    it("should allow custom embedding override", async () => {
      delete process.env.EMBEDDING_PROVIDER;

      const { generateTestTrack } =
        await import("../../src/scripts/testUtils.js");

      const customEmbedding = new Array(512).fill(0.5);
      const track = generateTestTrack({
        interpretation_embedding: customEmbedding,
      });

      expect(track.interpretation_embedding).toHaveLength(512);
      expect(track.interpretation_embedding).toEqual(customEmbedding);
    });
  });
});

describe("Zero Vector Generation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("createZeroVector()", () => {
    it("should create 1024-dimensional zero vector for local provider", async () => {
      delete process.env.EMBEDDING_PROVIDER;
      delete process.env.EMBEDDING_DIMENSIONS;

      const { createZeroVector } = await import("../../src/config.js");

      const zeroVector = createZeroVector();

      expect(zeroVector).toHaveLength(LOCAL_DIMENSIONS);
      expect(zeroVector.every((v) => v === 0)).toBe(true);
    });

    it("should create 3072-dimensional zero vector for gemini provider", async () => {
      process.env.EMBEDDING_PROVIDER = "gemini";
      delete process.env.EMBEDDING_DIMENSIONS;

      const { createZeroVector } = await import("../../src/config.js");

      const zeroVector = createZeroVector();

      expect(zeroVector).toHaveLength(GEMINI_DIMENSIONS);
      expect(zeroVector.every((v) => v === 0)).toBe(true);
    });

    it("should respect EMBEDDING_DIMENSIONS override", async () => {
      process.env.EMBEDDING_DIMENSIONS = "2048";

      const { createZeroVector } = await import("../../src/config.js");

      const zeroVector = createZeroVector();

      expect(zeroVector).toHaveLength(2048);
      expect(zeroVector.every((v) => v === 0)).toBe(true);
    });
  });
});

describe("Dimension Constants", () => {
  it("should export LOCAL_DIMENSIONS as 1024", async () => {
    const { LOCAL_DIMENSIONS: dims } = await import("../../src/config.js");

    expect(dims).toBe(1024);
  });

  it("should export GEMINI_DIMENSIONS as 3072", async () => {
    const { GEMINI_DIMENSIONS: dims } = await import("../../src/config.js");

    expect(dims).toBe(3072);
  });
});
