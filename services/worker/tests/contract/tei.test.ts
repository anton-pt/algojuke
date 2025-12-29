/**
 * TEI Client Contract Tests
 *
 * Tests the TEI embedding client response schema validation.
 * These tests verify that the client correctly handles various API responses.
 */

import { describe, it, expect } from "vitest";
import {
  TEIEmbedRequestSchema,
  TEIEmbedResponseSchema,
  EMBEDDING_DIMENSIONS,
  createZeroVector,
  validateEmbeddingDimensions,
} from "../../src/clients/tei.js";

describe("TEI Client Contract", () => {
  describe("Embed Request Schema", () => {
    it("should validate single string input", () => {
      const request = {
        inputs: "This is a test interpretation of song lyrics",
      };

      const result = TEIEmbedRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it("should validate array of strings input", () => {
      const request = {
        inputs: [
          "First interpretation",
          "Second interpretation",
        ],
      };

      const result = TEIEmbedRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it("should reject empty object", () => {
      const request = {};

      const result = TEIEmbedRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });

  describe("Embed Response Schema", () => {
    it("should validate single embedding response", () => {
      // Generate a mock 4096-dim embedding
      const embedding = new Array(EMBEDDING_DIMENSIONS).fill(0).map(() => Math.random());
      const response = [embedding];

      const result = TEIEmbedResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it("should validate multiple embeddings response", () => {
      const embedding1 = new Array(EMBEDDING_DIMENSIONS).fill(0).map(() => Math.random());
      const embedding2 = new Array(EMBEDDING_DIMENSIONS).fill(0).map(() => Math.random());
      const response = [embedding1, embedding2];

      const result = TEIEmbedResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it("should reject non-array response", () => {
      const response = { embeddings: [[1, 2, 3]] };

      const result = TEIEmbedResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it("should reject embeddings with non-number values", () => {
      const response = [["not", "numbers"]];

      const result = TEIEmbedResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });
  });

  describe("Zero Vector", () => {
    it("should create a zero vector with correct dimensions", () => {
      const zeroVector = createZeroVector();

      expect(zeroVector.length).toBe(EMBEDDING_DIMENSIONS);
      expect(zeroVector.every((v) => v === 0)).toBe(true);
    });

    it("should be a valid embedding according to schema", () => {
      const zeroVector = createZeroVector();
      const response = [zeroVector];

      const result = TEIEmbedResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe("Embedding Dimension Validation", () => {
    it("should pass for correct dimensions", () => {
      const embedding = new Array(EMBEDDING_DIMENSIONS).fill(0);
      expect(() => validateEmbeddingDimensions(embedding)).not.toThrow();
    });

    it("should throw for incorrect dimensions", () => {
      const shortEmbedding = new Array(512).fill(0);
      expect(() => validateEmbeddingDimensions(shortEmbedding)).toThrow(
        `Embedding must be exactly ${EMBEDDING_DIMENSIONS} dimensions`
      );
    });

    it("should throw for empty array", () => {
      const emptyEmbedding: number[] = [];
      expect(() => validateEmbeddingDimensions(emptyEmbedding)).toThrow();
    });
  });

  describe("Constants", () => {
    it("should have correct embedding dimensions constant", () => {
      expect(EMBEDDING_DIMENSIONS).toBe(1024);
    });
  });
});
