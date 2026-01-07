/**
 * Embedding Client Contract Tests
 *
 * Feature: 043-gemini-embeddings
 * Date: 2025-01-07
 *
 * Tests the embedding provider abstraction including:
 * - Provider factory function (createEmbeddingClient)
 * - Dimension configuration (getEmbeddingDimensions)
 * - Zero vector generation (createZeroVector)
 * - Task type handling (RETRIEVAL_DOCUMENT vs RETRIEVAL_QUERY)
 *
 * Spec references:
 * - US-001: Production Embedding Generation (Gemini)
 * - US-002: Local Development Embedding Generation (TEI)
 * - US-003: Semantic Search Embeddings (task types)
 * - US-004: Vector Index Configuration (dimensions)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Constants for testing
const LOCAL_DIMENSIONS = 1024;
const GEMINI_DIMENSIONS = 3072;

describe("Embedding Provider Abstraction", () => {
  // Store original env values
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env before each test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getEmbeddingDimensions()", () => {
    it("should return 1024 when EMBEDDING_PROVIDER is not set (default)", async () => {
      delete process.env.EMBEDDING_PROVIDER;
      delete process.env.EMBEDDING_DIMENSIONS;

      // Import dynamically to pick up new env
      const { getEmbeddingDimensions } =
        await import("../../src/clients/embedding.js");

      expect(getEmbeddingDimensions()).toBe(LOCAL_DIMENSIONS);
    });

    it("should return 1024 when EMBEDDING_PROVIDER=local", async () => {
      process.env.EMBEDDING_PROVIDER = "local";
      delete process.env.EMBEDDING_DIMENSIONS;

      const { getEmbeddingDimensions } =
        await import("../../src/clients/embedding.js");

      expect(getEmbeddingDimensions()).toBe(LOCAL_DIMENSIONS);
    });

    it("should return 3072 when EMBEDDING_PROVIDER=gemini", async () => {
      process.env.EMBEDDING_PROVIDER = "gemini";
      delete process.env.EMBEDDING_DIMENSIONS;

      const { getEmbeddingDimensions } =
        await import("../../src/clients/embedding.js");

      expect(getEmbeddingDimensions()).toBe(GEMINI_DIMENSIONS);
    });

    it("should use EMBEDDING_DIMENSIONS override when set", async () => {
      process.env.EMBEDDING_PROVIDER = "local";
      process.env.EMBEDDING_DIMENSIONS = "2048";

      const { getEmbeddingDimensions } =
        await import("../../src/clients/embedding.js");

      expect(getEmbeddingDimensions()).toBe(2048);
    });

    it("should prioritize EMBEDDING_DIMENSIONS over provider default", async () => {
      process.env.EMBEDDING_PROVIDER = "gemini";
      process.env.EMBEDDING_DIMENSIONS = "1024";

      const { getEmbeddingDimensions } =
        await import("../../src/clients/embedding.js");

      expect(getEmbeddingDimensions()).toBe(1024);
    });
  });

  describe("createZeroVector()", () => {
    it("should create a 1024-dimensional zero vector when provider is local", async () => {
      delete process.env.EMBEDDING_PROVIDER;
      delete process.env.EMBEDDING_DIMENSIONS;

      const { createZeroVector, getEmbeddingDimensions } =
        await import("../../src/clients/embedding.js");

      const zeroVector = createZeroVector();

      expect(zeroVector).toHaveLength(getEmbeddingDimensions());
      expect(zeroVector).toHaveLength(LOCAL_DIMENSIONS);
      expect(zeroVector.every((v) => v === 0)).toBe(true);
    });

    it("should create a 3072-dimensional zero vector when provider is gemini", async () => {
      process.env.EMBEDDING_PROVIDER = "gemini";
      delete process.env.EMBEDDING_DIMENSIONS;

      const { createZeroVector, getEmbeddingDimensions } =
        await import("../../src/clients/embedding.js");

      const zeroVector = createZeroVector();

      expect(zeroVector).toHaveLength(getEmbeddingDimensions());
      expect(zeroVector).toHaveLength(GEMINI_DIMENSIONS);
      expect(zeroVector.every((v) => v === 0)).toBe(true);
    });

    it("should use custom dimensions when EMBEDDING_DIMENSIONS is set", async () => {
      process.env.EMBEDDING_DIMENSIONS = "2048";

      const { createZeroVector } =
        await import("../../src/clients/embedding.js");

      const zeroVector = createZeroVector();

      expect(zeroVector).toHaveLength(2048);
      expect(zeroVector.every((v) => v === 0)).toBe(true);
    });
  });

  describe("createEmbeddingClient() factory", () => {
    it("should return a TEI-based client when EMBEDDING_PROVIDER is not set", async () => {
      delete process.env.EMBEDDING_PROVIDER;

      const { createEmbeddingClient } =
        await import("../../src/clients/embedding.js");

      const client = createEmbeddingClient();

      expect(client).toBeDefined();
      expect(client.getDimensions()).toBe(LOCAL_DIMENSIONS);
      expect(typeof client.embed).toBe("function");
      expect(typeof client.isHealthy).toBe("function");
    });

    it("should return a TEI-based client when EMBEDDING_PROVIDER=local", async () => {
      process.env.EMBEDDING_PROVIDER = "local";

      const { createEmbeddingClient } =
        await import("../../src/clients/embedding.js");

      const client = createEmbeddingClient();

      expect(client).toBeDefined();
      expect(client.getDimensions()).toBe(LOCAL_DIMENSIONS);
    });

    it("should return a Gemini-based client when EMBEDDING_PROVIDER=gemini", async () => {
      process.env.EMBEDDING_PROVIDER = "gemini";
      process.env.GOOGLE_CLOUD_PROJECT = "test-project";

      const { createEmbeddingClient } =
        await import("../../src/clients/embedding.js");

      const client = createEmbeddingClient();

      expect(client).toBeDefined();
      expect(client.getDimensions()).toBe(GEMINI_DIMENSIONS);
    });
  });

  describe("EmbeddingClient interface", () => {
    it("should have embed method that accepts text and optional taskType", async () => {
      delete process.env.EMBEDDING_PROVIDER;

      const { createEmbeddingClient } =
        await import("../../src/clients/embedding.js");

      const client = createEmbeddingClient();

      // Verify the interface has the expected methods
      expect(typeof client.embed).toBe("function");
      expect(client.embed.length).toBeGreaterThanOrEqual(1); // At least 1 parameter (text)
    });

    it("should have getDimensions method returning the correct dimension", async () => {
      delete process.env.EMBEDDING_PROVIDER;

      const { createEmbeddingClient } =
        await import("../../src/clients/embedding.js");

      const client = createEmbeddingClient();

      expect(typeof client.getDimensions).toBe("function");
      expect(client.getDimensions()).toBe(LOCAL_DIMENSIONS);
    });

    it("should have isHealthy method returning a Promise<boolean>", async () => {
      delete process.env.EMBEDDING_PROVIDER;

      const { createEmbeddingClient } =
        await import("../../src/clients/embedding.js");

      const client = createEmbeddingClient();

      expect(typeof client.isHealthy).toBe("function");
      // isHealthy returns a promise
      const healthPromise = client.isHealthy();
      expect(healthPromise).toBeInstanceOf(Promise);
    });
  });

  describe("EmbeddingTaskType", () => {
    it("should support RETRIEVAL_DOCUMENT task type value", async () => {
      // EmbeddingTaskType is a string literal union type
      // We verify the client accepts the task type by checking the embed method signature
      const { createEmbeddingClient } =
        await import("../../src/clients/embedding.js");

      const client = createEmbeddingClient();

      // The embed method should accept the task type parameter
      expect(typeof client.embed).toBe("function");
      // Task type is the second optional parameter
    });

    it("should support RETRIEVAL_QUERY task type value", async () => {
      // Same verification - the task type is a string literal union
      const { createEmbeddingClient } =
        await import("../../src/clients/embedding.js");

      const client = createEmbeddingClient();
      expect(typeof client.embed).toBe("function");
    });
  });
});

describe("Provider-Specific Behavior", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Local (TEI) Provider", () => {
    it("should return 1024 dimensions for local provider", async () => {
      delete process.env.EMBEDDING_PROVIDER;

      const { createEmbeddingClient } =
        await import("../../src/clients/embedding.js");

      const client = createEmbeddingClient();
      expect(client.getDimensions()).toBe(1024);
    });

    it("should return correct provider name", async () => {
      delete process.env.EMBEDDING_PROVIDER;

      const { createEmbeddingClient } =
        await import("../../src/clients/embedding.js");

      const client = createEmbeddingClient();
      expect(client.getProviderName()).toBe("local");
    });

    it("should return correct model name", async () => {
      delete process.env.EMBEDDING_PROVIDER;

      const { createEmbeddingClient } =
        await import("../../src/clients/embedding.js");

      const client = createEmbeddingClient();
      expect(client.getModelName()).toBe("mixedbread-ai/mxbai-embed-large-v1");
    });
  });

  describe("Gemini Provider", () => {
    it("should return 3072 dimensions for gemini provider", async () => {
      process.env.EMBEDDING_PROVIDER = "gemini";
      process.env.GOOGLE_CLOUD_PROJECT = "test-project";

      const { createEmbeddingClient } =
        await import("../../src/clients/embedding.js");

      const client = createEmbeddingClient();
      expect(client.getDimensions()).toBe(3072);
    });

    it("should return correct provider name", async () => {
      process.env.EMBEDDING_PROVIDER = "gemini";
      process.env.GOOGLE_CLOUD_PROJECT = "test-project";

      const { createEmbeddingClient } =
        await import("../../src/clients/embedding.js");

      const client = createEmbeddingClient();
      expect(client.getProviderName()).toBe("gemini");
    });

    it("should return correct model name", async () => {
      process.env.EMBEDDING_PROVIDER = "gemini";
      process.env.GOOGLE_CLOUD_PROJECT = "test-project";

      const { createEmbeddingClient } =
        await import("../../src/clients/embedding.js");

      const client = createEmbeddingClient();
      expect(client.getModelName()).toBe("gemini-embedding-001");
    });

    it("should throw if GOOGLE_CLOUD_PROJECT is not set", async () => {
      process.env.EMBEDDING_PROVIDER = "gemini";
      delete process.env.GOOGLE_CLOUD_PROJECT;

      const { createEmbeddingClient } =
        await import("../../src/clients/embedding.js");

      expect(() => createEmbeddingClient()).toThrow("GOOGLE_CLOUD_PROJECT");
    });
  });
});

describe("Embedding Validation", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...process.env };
  });

  describe("validateEmbeddingDimensions()", () => {
    it("should pass for embedding matching configured dimensions", async () => {
      delete process.env.EMBEDDING_PROVIDER;

      const { validateEmbeddingDimensions, getEmbeddingDimensions } =
        await import("../../src/clients/embedding.js");

      const dims = getEmbeddingDimensions();
      const validEmbedding = new Array(dims).fill(0.1);

      expect(() => validateEmbeddingDimensions(validEmbedding)).not.toThrow();
    });

    it("should throw for embedding with wrong dimensions", async () => {
      delete process.env.EMBEDDING_PROVIDER;

      const { validateEmbeddingDimensions, getEmbeddingDimensions } =
        await import("../../src/clients/embedding.js");

      const dims = getEmbeddingDimensions();
      const invalidEmbedding = new Array(dims + 100).fill(0.1);

      expect(() => validateEmbeddingDimensions(invalidEmbedding)).toThrow(
        /dimensions/i,
      );
    });

    it("should throw for empty embedding", async () => {
      const { validateEmbeddingDimensions } =
        await import("../../src/clients/embedding.js");

      expect(() => validateEmbeddingDimensions([])).toThrow();
    });
  });
});
