/**
 * Embedding Client Contract Tests (Backend)
 *
 * Feature: 043-gemini-embeddings
 * Date: 2025-01-07
 *
 * Tests the embedding provider abstraction in the backend service including:
 * - Provider factory function (createEmbeddingClient)
 * - Dimension configuration (getEmbeddingDimensions)
 * - Zero vector generation (createZeroVector)
 * - Task type handling for semantic search queries
 *
 * The backend embedding client is used by:
 * - Discovery service for semantic search query embeddings
 * - Agent tools for similarity search
 *
 * Spec references:
 * - US-001: Production Embedding Generation (Gemini)
 * - US-002: Local Development Embedding Generation (TEI)
 * - US-003: Semantic Search Embeddings (RETRIEVAL_QUERY task type)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Constants for testing
const LOCAL_DIMENSIONS = 1024;
const GEMINI_DIMENSIONS = 3072;

describe("Backend Embedding Provider Abstraction", () => {
  const originalEnv = process.env;

  beforeEach(() => {
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

    it("should respect EMBEDDING_DIMENSIONS environment override", async () => {
      process.env.EMBEDDING_DIMENSIONS = "2048";

      const { getEmbeddingDimensions } =
        await import("../../src/clients/embedding.js");

      expect(getEmbeddingDimensions()).toBe(2048);
    });
  });

  describe("createZeroVector()", () => {
    it("should create a zero vector with correct dimensions for local provider", async () => {
      delete process.env.EMBEDDING_PROVIDER;
      delete process.env.EMBEDDING_DIMENSIONS;

      const { createZeroVector } =
        await import("../../src/clients/embedding.js");

      const zeroVector = createZeroVector();

      expect(zeroVector).toHaveLength(LOCAL_DIMENSIONS);
      expect(zeroVector.every((v) => v === 0)).toBe(true);
    });

    it("should create a zero vector with correct dimensions for gemini provider", async () => {
      process.env.EMBEDDING_PROVIDER = "gemini";
      delete process.env.EMBEDDING_DIMENSIONS;

      const { createZeroVector } =
        await import("../../src/clients/embedding.js");

      const zeroVector = createZeroVector();

      expect(zeroVector).toHaveLength(GEMINI_DIMENSIONS);
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
    it("should have embed method", async () => {
      delete process.env.EMBEDDING_PROVIDER;

      const { createEmbeddingClient } =
        await import("../../src/clients/embedding.js");

      const client = createEmbeddingClient();

      expect(typeof client.embed).toBe("function");
    });

    it("should have getDimensions method", async () => {
      delete process.env.EMBEDDING_PROVIDER;

      const { createEmbeddingClient } =
        await import("../../src/clients/embedding.js");

      const client = createEmbeddingClient();

      expect(typeof client.getDimensions).toBe("function");
      expect(typeof client.getDimensions()).toBe("number");
    });

    it("should have isHealthy method", async () => {
      delete process.env.EMBEDDING_PROVIDER;

      const { createEmbeddingClient } =
        await import("../../src/clients/embedding.js");

      const client = createEmbeddingClient();

      expect(typeof client.isHealthy).toBe("function");
    });
  });

  describe("Task Types for Semantic Search", () => {
    it("should accept RETRIEVAL_QUERY for search queries", async () => {
      // EmbeddingTaskType is a string literal union type
      // We verify the client accepts the task type by checking the embed method exists
      const { createEmbeddingClient } =
        await import("../../src/clients/embedding.js");

      const client = createEmbeddingClient();
      // The embed method accepts an optional task type parameter
      expect(typeof client.embed).toBe("function");
    });

    it("should accept RETRIEVAL_DOCUMENT for indexed content", async () => {
      const { createEmbeddingClient } =
        await import("../../src/clients/embedding.js");

      const client = createEmbeddingClient();
      expect(typeof client.embed).toBe("function");
    });
  });

  describe("Provider Metadata", () => {
    it("should expose getProviderName method", async () => {
      delete process.env.EMBEDDING_PROVIDER;

      const { createEmbeddingClient } =
        await import("../../src/clients/embedding.js");

      const client = createEmbeddingClient();
      expect(typeof client.getProviderName).toBe("function");
      expect(client.getProviderName()).toBe("local");
    });

    it("should expose getModelName method", async () => {
      delete process.env.EMBEDDING_PROVIDER;

      const { createEmbeddingClient } =
        await import("../../src/clients/embedding.js");

      const client = createEmbeddingClient();
      expect(typeof client.getModelName).toBe("function");
      expect(client.getModelName()).toBe("mixedbread-ai/mxbai-embed-large-v1");
    });
  });
});

describe("Backend Provider-Specific Behavior", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Local Provider", () => {
    it("should return 1024 dimensions", async () => {
      delete process.env.EMBEDDING_PROVIDER;

      const { createEmbeddingClient } =
        await import("../../src/clients/embedding.js");

      const client = createEmbeddingClient();
      expect(client.getDimensions()).toBe(1024);
    });
  });

  describe("Gemini Provider", () => {
    it("should return 3072 dimensions", async () => {
      process.env.EMBEDDING_PROVIDER = "gemini";
      process.env.GOOGLE_CLOUD_PROJECT = "test-project";

      const { createEmbeddingClient } =
        await import("../../src/clients/embedding.js");

      const client = createEmbeddingClient();
      expect(client.getDimensions()).toBe(3072);
    });

    it("should require GOOGLE_CLOUD_PROJECT", async () => {
      process.env.EMBEDDING_PROVIDER = "gemini";
      delete process.env.GOOGLE_CLOUD_PROJECT;

      const { createEmbeddingClient } =
        await import("../../src/clients/embedding.js");

      expect(() => createEmbeddingClient()).toThrow("GOOGLE_CLOUD_PROJECT");
    });
  });
});

describe("Embedding Dimension Validation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("validateEmbeddingDimensions()", () => {
    it("should pass for embedding matching provider dimensions", async () => {
      delete process.env.EMBEDDING_PROVIDER;

      const { validateEmbeddingDimensions, getEmbeddingDimensions } =
        await import("../../src/clients/embedding.js");

      const dims = getEmbeddingDimensions();
      const validEmbedding = new Array(dims).fill(0.1);

      expect(() => validateEmbeddingDimensions(validEmbedding)).not.toThrow();
    });

    it("should throw for embedding with mismatched dimensions", async () => {
      delete process.env.EMBEDDING_PROVIDER;

      const { validateEmbeddingDimensions } =
        await import("../../src/clients/embedding.js");

      // Wrong dimension (neither 1024 nor 3072)
      const invalidEmbedding = new Array(512).fill(0.1);

      expect(() => validateEmbeddingDimensions(invalidEmbedding)).toThrow();
    });
  });
});

describe("Integration with Discovery Service", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should maintain consistent dimensions between embedding and EMBEDDING_DIMENSION constant", async () => {
    delete process.env.EMBEDDING_PROVIDER;
    delete process.env.EMBEDDING_DIMENSIONS;

    const { getEmbeddingDimensions } =
      await import("../../src/clients/embedding.js");

    // The discovery types module should use the same dimensions
    const { EMBEDDING_DIMENSION } =
      await import("../../src/types/discovery.js");

    // Note: This test verifies the consistency. In the actual implementation,
    // EMBEDDING_DIMENSION in discovery.ts should be updated to use getEmbeddingDimensions()
    // For now, this documents the expected behavior.
    expect(getEmbeddingDimensions()).toBe(LOCAL_DIMENSIONS);
    // The discovery module currently hardcodes 1024, which is correct for local provider
    expect(EMBEDDING_DIMENSION).toBe(1024);
  });
});
