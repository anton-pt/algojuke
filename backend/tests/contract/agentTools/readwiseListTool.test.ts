/**
 * Readwise List Tool Contract Tests
 *
 * Feature: ALG-82
 *
 * Tests the Readwise list tool implementation contract.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeReadwiseList,
  type ReadwiseListContext,
} from "../../../src/services/agentTools/readwiseListTool.js";
import type { ReadwiseListInput } from "../../../src/schemas/agentTools.js";

// Mock axios
vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    isAxiosError: (error: unknown) =>
      error instanceof Error && "code" in error && "isAxiosError" in error,
  },
}));

// Mock readwiseAuthService
vi.mock("../../../src/services/readwiseAuthService.js", () => ({
  getReadwiseTokens: vi.fn(),
}));

// Mock logger
vi.mock("../../../src/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import axios from "axios";
import { getReadwiseTokens } from "../../../src/services/readwiseAuthService.js";

const mockAxios = axios as { get: ReturnType<typeof vi.fn> };
const mockGetReadwiseTokens = getReadwiseTokens as ReturnType<typeof vi.fn>;

describe("executeReadwiseList", () => {
  const mockContext: ReadwiseListContext = {
    userId: "test-user-123",
  };

  const mockReadwiseTokens = {
    accessToken: "test-access-token",
    connectedAt: Date.now(),
  };

  const mockApiDocument = {
    id: "doc-123",
    url: "https://example.com/article",
    title: "Test Article",
    author: "Test Author",
    source: "example.com",
    category: "article",
    location: "new",
    word_count: 1500,
    reading_progress: 0.3,
    published_date: "2024-01-15T10:00:00Z",
    created_at: "2024-01-16T08:00:00Z",
    tags: { tech: "tech", ai: "ai" },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: user has Readwise connected
    mockGetReadwiseTokens.mockResolvedValue(mockReadwiseTokens);

    // Default: successful API response
    mockAxios.get.mockResolvedValue({
      status: 200,
      data: {
        count: 1,
        nextPageCursor: null,
        results: [mockApiDocument],
      },
    });
  });

  describe("input validation", () => {
    it("rejects limit below 1", async () => {
      const input: ReadwiseListInput = {
        limit: 0,
      };

      await expect(
        executeReadwiseList(input, mockContext),
      ).rejects.toMatchObject({
        retryable: false,
        code: "VALIDATION_ERROR",
      });
    });

    it("rejects limit above 100", async () => {
      const input: ReadwiseListInput = {
        limit: 101,
      };

      await expect(
        executeReadwiseList(input, mockContext),
      ).rejects.toMatchObject({
        retryable: false,
        code: "VALIDATION_ERROR",
      });
    });

    it("rejects more than 5 tags", async () => {
      const input: ReadwiseListInput = {
        tags: ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"],
        limit: 20,
      };

      await expect(
        executeReadwiseList(input, mockContext),
      ).rejects.toMatchObject({
        retryable: false,
        code: "VALIDATION_ERROR",
      });
    });

    it("accepts valid input with all filters", async () => {
      const input: ReadwiseListInput = {
        location: "new",
        category: "article",
        tags: ["tech", "ai"],
        limit: 20,
      };

      const result = await executeReadwiseList(input, mockContext);

      expect(result).toBeDefined();
      expect(result.documents).toHaveLength(1);
    });
  });

  describe("authentication", () => {
    it("throws NOT_CONNECTED when user has no Readwise token", async () => {
      mockGetReadwiseTokens.mockResolvedValue(null);

      const input: ReadwiseListInput = {
        limit: 20,
      };

      await expect(
        executeReadwiseList(input, mockContext),
      ).rejects.toMatchObject({
        message: expect.stringContaining("not connected"),
        retryable: false,
        code: "NOT_CONNECTED",
      });
    });

    it("throws UNAUTHORIZED when token is invalid", async () => {
      mockAxios.get.mockResolvedValue({
        status: 401,
        data: {},
      });

      const input: ReadwiseListInput = {
        limit: 20,
      };

      await expect(
        executeReadwiseList(input, mockContext),
      ).rejects.toMatchObject({
        message: expect.stringContaining("invalid or has been revoked"),
        retryable: false,
        code: "UNAUTHORIZED",
      });
    });
  });

  describe("API interaction", () => {
    it("calls Readwise API with correct parameters", async () => {
      const input: ReadwiseListInput = {
        location: "later",
        category: "pdf",
        tags: ["tech"],
        limit: 10,
      };

      await executeReadwiseList(input, mockContext);

      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining("/api/v3/list/"),
        expect.objectContaining({
          headers: {
            Authorization: "Token test-access-token",
          },
        }),
      );
    });

    it("returns RATE_LIMIT error when rate limited", async () => {
      mockAxios.get.mockResolvedValue({
        status: 429,
        data: {},
      });

      const input: ReadwiseListInput = {
        limit: 20,
      };

      await expect(
        executeReadwiseList(input, mockContext),
      ).rejects.toMatchObject({
        message: expect.stringContaining("rate limit"),
        retryable: true,
        code: "RATE_LIMIT",
      });
    });

    it("returns INTERNAL_ERROR on server errors", async () => {
      mockAxios.get.mockResolvedValue({
        status: 500,
        data: {},
      });

      const input: ReadwiseListInput = {
        limit: 20,
      };

      await expect(
        executeReadwiseList(input, mockContext),
      ).rejects.toMatchObject({
        message: expect.stringContaining("temporarily unavailable"),
        retryable: true,
        code: "INTERNAL_ERROR",
      });
    });
  });

  describe("result transformation", () => {
    it("transforms documents correctly", async () => {
      const input: ReadwiseListInput = {
        limit: 20,
      };

      const result = await executeReadwiseList(input, mockContext);

      expect(result.documents[0]).toMatchObject({
        id: "doc-123",
        url: "https://example.com/article",
        title: "Test Article",
        author: "Test Author",
        source: "example.com",
        category: "article",
        location: "new",
        wordCount: 1500,
        readingTimeMinutes: 8, // 1500/200 rounded up
        publishedAt: "2024-01-15T10:00:00Z",
        savedAt: "2024-01-16T08:00:00Z",
        tags: ["tech", "ai"],
      });
    });

    it("returns empty documents array when no results", async () => {
      mockAxios.get.mockResolvedValue({
        status: 200,
        data: {
          count: 0,
          nextPageCursor: null,
          results: [],
        },
      });

      const input: ReadwiseListInput = {
        limit: 20,
      };

      const result = await executeReadwiseList(input, mockContext);

      expect(result.documents).toHaveLength(0);
      expect(result.totalFound).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it("calculates readingTimeMinutes from word count", async () => {
      const docWithDifferentWordCount = {
        ...mockApiDocument,
        word_count: 450, // Should be 3 minutes (450/200 = 2.25, rounded up)
      };

      mockAxios.get.mockResolvedValue({
        status: 200,
        data: {
          count: 1,
          nextPageCursor: null,
          results: [docWithDifferentWordCount],
        },
      });

      const input: ReadwiseListInput = {
        limit: 20,
      };

      const result = await executeReadwiseList(input, mockContext);

      expect(result.documents[0].readingTimeMinutes).toBe(3);
    });

    it("returns null readingTimeMinutes when word count is null", async () => {
      const docWithNullWordCount = {
        ...mockApiDocument,
        word_count: null,
      };

      mockAxios.get.mockResolvedValue({
        status: 200,
        data: {
          count: 1,
          nextPageCursor: null,
          results: [docWithNullWordCount],
        },
      });

      const input: ReadwiseListInput = {
        limit: 20,
      };

      const result = await executeReadwiseList(input, mockContext);

      expect(result.documents[0].readingTimeMinutes).toBeNull();
    });
  });

  describe("pagination", () => {
    it("sets hasMore=true when more results exist", async () => {
      mockAxios.get.mockResolvedValue({
        status: 200,
        data: {
          count: 50,
          nextPageCursor: "abc123",
          results: [mockApiDocument],
        },
      });

      const input: ReadwiseListInput = {
        limit: 1,
      };

      const result = await executeReadwiseList(input, mockContext);

      expect(result.hasMore).toBe(true);
      expect(result.totalFound).toBe(50);
    });

    it("sets hasMore=false when no more results", async () => {
      mockAxios.get.mockResolvedValue({
        status: 200,
        data: {
          count: 1,
          nextPageCursor: null,
          results: [mockApiDocument],
        },
      });

      const input: ReadwiseListInput = {
        limit: 20,
      };

      const result = await executeReadwiseList(input, mockContext);

      expect(result.hasMore).toBe(false);
    });

    it("limits results to requested amount", async () => {
      const manyDocs = Array(25)
        .fill(null)
        .map((_, i) => ({
          ...mockApiDocument,
          id: `doc-${i}`,
        }));

      mockAxios.get.mockResolvedValue({
        status: 200,
        data: {
          count: 100,
          nextPageCursor: "abc123",
          results: manyDocs,
        },
      });

      const input: ReadwiseListInput = {
        limit: 10,
      };

      const result = await executeReadwiseList(input, mockContext);

      expect(result.documents.length).toBe(10);
      expect(result.hasMore).toBe(true);
    });
  });

  describe("summary generation", () => {
    it("generates correct summary for results", async () => {
      const input: ReadwiseListInput = {
        limit: 20,
      };

      const result = await executeReadwiseList(input, mockContext);

      expect(result.summary).toBe("Found 1 document");
    });

    it("generates correct summary for plural results", async () => {
      mockAxios.get.mockResolvedValue({
        status: 200,
        data: {
          count: 5,
          nextPageCursor: null,
          results: [
            mockApiDocument,
            { ...mockApiDocument, id: "doc-2" },
            { ...mockApiDocument, id: "doc-3" },
          ],
        },
      });

      const input: ReadwiseListInput = {
        limit: 20,
      };

      const result = await executeReadwiseList(input, mockContext);

      expect(result.summary).toBe("Found 3 documents");
    });

    it("indicates more available in summary", async () => {
      mockAxios.get.mockResolvedValue({
        status: 200,
        data: {
          count: 100,
          nextPageCursor: "abc123",
          results: [mockApiDocument],
        },
      });

      const input: ReadwiseListInput = {
        limit: 1,
      };

      const result = await executeReadwiseList(input, mockContext);

      expect(result.summary).toContain("more available");
    });

    it("generates correct summary for no results", async () => {
      mockAxios.get.mockResolvedValue({
        status: 200,
        data: {
          count: 0,
          nextPageCursor: null,
          results: [],
        },
      });

      const input: ReadwiseListInput = {
        limit: 20,
      };

      const result = await executeReadwiseList(input, mockContext);

      expect(result.summary).toContain("No documents found");
    });

    it("includes filters in empty results summary", async () => {
      mockAxios.get.mockResolvedValue({
        status: 200,
        data: {
          count: 0,
          nextPageCursor: null,
          results: [],
        },
      });

      const input: ReadwiseListInput = {
        location: "archive",
        category: "pdf",
        limit: 20,
      };

      const result = await executeReadwiseList(input, mockContext);

      expect(result.summary).toContain("archive");
      expect(result.summary).toContain("pdf");
    });
  });

  describe("output structure", () => {
    it("includes durationMs in output", async () => {
      const input: ReadwiseListInput = {
        limit: 20,
      };

      const result = await executeReadwiseList(input, mockContext);

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("includes filters in output", async () => {
      const input: ReadwiseListInput = {
        location: "later",
        category: "article",
        tags: ["tech"],
        limit: 20,
      };

      const result = await executeReadwiseList(input, mockContext);

      expect(result.filters).toEqual({
        location: "later",
        category: "article",
        tags: ["tech"],
      });
    });
  });
});
