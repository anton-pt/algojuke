/**
 * Contract tests for Vector Search Span Schema
 *
 * TDD: These tests are written FIRST and should FAIL until search.ts is implemented.
 */

import { describe, it, expect } from "vitest";

// Import will fail until implementation exists
import {
  VectorSearchMetadataSchema,
  VectorSearchResultSchema,
  type VectorSearchMetadata,
  type VectorSearchResult,
} from "../../src/schemas/search.js";

describe("VectorSearchMetadataSchema", () => {
  it("should validate valid search metadata", () => {
    const validMetadata = {
      collection: "tracks",
      topK: 10,
      filters: { genre: "jazz" },
      useSparse: true,
    };

    const result = VectorSearchMetadataSchema.safeParse(validMetadata);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.collection).toBe("tracks");
      expect(result.data.topK).toBe(10);
      expect(result.data.useSparse).toBe(true);
    }
  });

  it("should accept minimal metadata (collection and topK)", () => {
    const minimalMetadata = {
      collection: "tracks",
      topK: 5,
    };

    const result = VectorSearchMetadataSchema.safeParse(minimalMetadata);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.useSparse).toBe(false); // default
    }
  });

  it("should reject missing collection", () => {
    const invalidMetadata = {
      topK: 10,
    };

    const result = VectorSearchMetadataSchema.safeParse(invalidMetadata);
    expect(result.success).toBe(false);
  });

  it("should reject missing topK", () => {
    const invalidMetadata = {
      collection: "tracks",
    };

    const result = VectorSearchMetadataSchema.safeParse(invalidMetadata);
    expect(result.success).toBe(false);
  });

  it("should reject non-positive topK", () => {
    const invalidMetadata = {
      collection: "tracks",
      topK: 0,
    };

    const result = VectorSearchMetadataSchema.safeParse(invalidMetadata);
    expect(result.success).toBe(false);
  });

  it("should reject negative topK", () => {
    const invalidMetadata = {
      collection: "tracks",
      topK: -5,
    };

    const result = VectorSearchMetadataSchema.safeParse(invalidMetadata);
    expect(result.success).toBe(false);
  });

  it("should accept complex filters", () => {
    const metadata = {
      collection: "tracks",
      topK: 10,
      filters: {
        must: [
          { key: "genre", match: { value: "jazz" } },
          { key: "year", range: { gte: 2000 } },
        ],
      },
    };

    const result = VectorSearchMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });
});

describe("VectorSearchResultSchema", () => {
  it("should validate valid search result", () => {
    const validResult = {
      resultCount: 5,
      topScores: [0.95, 0.87, 0.82, 0.75, 0.70],
      resultIds: ["id1", "id2", "id3", "id4", "id5"],
    };

    const result = VectorSearchResultSchema.safeParse(validResult);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.resultCount).toBe(5);
      expect(result.data.topScores).toHaveLength(5);
    }
  });

  it("should accept minimal result (resultCount only)", () => {
    const minimalResult = {
      resultCount: 3,
    };

    const result = VectorSearchResultSchema.safeParse(minimalResult);
    expect(result.success).toBe(true);
  });

  it("should accept empty results", () => {
    const emptyResult = {
      resultCount: 0,
      topScores: [],
      resultIds: [],
    };

    const result = VectorSearchResultSchema.safeParse(emptyResult);
    expect(result.success).toBe(true);
  });

  it("should reject missing resultCount", () => {
    const invalidResult = {
      topScores: [0.95, 0.87],
    };

    const result = VectorSearchResultSchema.safeParse(invalidResult);
    expect(result.success).toBe(false);
  });

  it("should reject negative resultCount", () => {
    const invalidResult = {
      resultCount: -1,
    };

    const result = VectorSearchResultSchema.safeParse(invalidResult);
    expect(result.success).toBe(false);
  });

  it("should reject non-integer resultCount", () => {
    const invalidResult = {
      resultCount: 3.5,
    };

    const result = VectorSearchResultSchema.safeParse(invalidResult);
    expect(result.success).toBe(false);
  });
});
