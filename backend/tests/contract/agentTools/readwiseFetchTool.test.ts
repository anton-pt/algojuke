/**
 * Readwise Fetch Tool Contract Tests
 *
 * Feature: ALG-82
 *
 * Tests the Readwise fetch tool implementation contract.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeReadwiseFetch,
  type ReadwiseFetchContext,
} from "../../../src/services/agentTools/readwiseFetchTool.js";
import type { ReadwiseFetchInput } from "../../../src/schemas/agentTools.js";

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

// Mock AI SDK
vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn(() => "mock-model"),
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
import { generateText } from "ai";

const mockAxios = axios as { get: ReturnType<typeof vi.fn> };
const mockGetReadwiseTokens = getReadwiseTokens as ReturnType<typeof vi.fn>;
const mockGenerateText = generateText as ReturnType<typeof vi.fn>;

describe("executeReadwiseFetch", () => {
  const mockContext: ReadwiseFetchContext = {
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
    tags: [{ name: "tech" }, { name: "ai" }],
    html_content: "<html><body><p>Test content</p></body></html>",
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

    // Default: successful Claude extraction/summarization
    mockGenerateText.mockResolvedValue({
      text: "Extracted content from the article.",
      usage: { inputTokens: 100, outputTokens: 50 },
    });
  });

  describe("input validation", () => {
    it("rejects empty document ID", async () => {
      const input: ReadwiseFetchInput = {
        documentId: "",
        contentMode: "full",
      };

      await expect(
        executeReadwiseFetch(input, mockContext),
      ).rejects.toMatchObject({
        retryable: false,
        code: "VALIDATION_ERROR",
      });
    });

    it("accepts valid input with full mode", async () => {
      const input: ReadwiseFetchInput = {
        documentId: "doc-123",
        contentMode: "full",
      };

      const result = await executeReadwiseFetch(input, mockContext);

      expect(result).toBeDefined();
      expect(result.document.id).toBe("doc-123");
      expect(result.contentMode).toBe("full");
    });

    it("accepts valid input with summary mode", async () => {
      const input: ReadwiseFetchInput = {
        documentId: "doc-123",
        contentMode: "summary",
        summaryLength: "short",
      };

      const result = await executeReadwiseFetch(input, mockContext);

      expect(result).toBeDefined();
      expect(result.contentMode).toBe("summary");
    });
  });

  describe("authentication", () => {
    it("throws NOT_CONNECTED when user has no Readwise token", async () => {
      mockGetReadwiseTokens.mockResolvedValue(null);

      const input: ReadwiseFetchInput = {
        documentId: "doc-123",
        contentMode: "full",
      };

      await expect(
        executeReadwiseFetch(input, mockContext),
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

      const input: ReadwiseFetchInput = {
        documentId: "doc-123",
        contentMode: "full",
      };

      await expect(
        executeReadwiseFetch(input, mockContext),
      ).rejects.toMatchObject({
        message: expect.stringContaining("invalid or has been revoked"),
        retryable: false,
        code: "UNAUTHORIZED",
      });
    });
  });

  describe("document not found", () => {
    it("throws NOT_FOUND when document does not exist", async () => {
      mockAxios.get.mockResolvedValue({
        status: 200,
        data: {
          count: 0,
          nextPageCursor: null,
          results: [],
        },
      });

      const input: ReadwiseFetchInput = {
        documentId: "nonexistent-doc",
        contentMode: "full",
      };

      await expect(
        executeReadwiseFetch(input, mockContext),
      ).rejects.toMatchObject({
        message: expect.stringContaining("was not found"),
        retryable: false,
        code: "NOT_FOUND",
      });
    });
  });

  describe("content extraction (full mode)", () => {
    it("calls Claude for content extraction", async () => {
      const input: ReadwiseFetchInput = {
        documentId: "doc-123",
        contentMode: "full",
      };

      await executeReadwiseFetch(input, mockContext);

      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("Extract the main content"),
        }),
      );
    });

    it("returns extracted content in output", async () => {
      mockGenerateText.mockResolvedValue({
        text: "This is the *extracted* content from the article.",
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      const input: ReadwiseFetchInput = {
        documentId: "doc-123",
        contentMode: "full",
      };

      const result = await executeReadwiseFetch(input, mockContext);

      expect(result.content).toBe(
        "This is the *extracted* content from the article.",
      );
    });

    it("handles extraction failure", async () => {
      mockGenerateText.mockRejectedValue(new Error("Claude API error"));

      const input: ReadwiseFetchInput = {
        documentId: "doc-123",
        contentMode: "full",
      };

      await expect(
        executeReadwiseFetch(input, mockContext),
      ).rejects.toMatchObject({
        message: expect.stringContaining("Failed to extract"),
        retryable: true,
        code: "EXTRACTION_ERROR",
      });
    });
  });

  describe("content summarization (summary mode)", () => {
    it("calls Claude twice for extraction and summarization", async () => {
      const input: ReadwiseFetchInput = {
        documentId: "doc-123",
        contentMode: "summary",
        summaryLength: "medium",
      };

      await executeReadwiseFetch(input, mockContext);

      // First call extracts, second call summarizes
      expect(mockGenerateText).toHaveBeenCalledTimes(2);
    });

    it("uses correct word target for short summary", async () => {
      const input: ReadwiseFetchInput = {
        documentId: "doc-123",
        contentMode: "summary",
        summaryLength: "short",
      };

      await executeReadwiseFetch(input, mockContext);

      // Second call should have short word target
      expect(mockGenerateText).toHaveBeenLastCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("100 words"),
        }),
      );
    });

    it("uses correct word target for medium summary", async () => {
      const input: ReadwiseFetchInput = {
        documentId: "doc-123",
        contentMode: "summary",
        summaryLength: "medium",
      };

      await executeReadwiseFetch(input, mockContext);

      expect(mockGenerateText).toHaveBeenLastCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("250 words"),
        }),
      );
    });

    it("uses correct word target for long summary", async () => {
      const input: ReadwiseFetchInput = {
        documentId: "doc-123",
        contentMode: "summary",
        summaryLength: "long",
      };

      await executeReadwiseFetch(input, mockContext);

      expect(mockGenerateText).toHaveBeenLastCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("500 words"),
        }),
      );
    });

    it("handles summarization failure", async () => {
      // First call (extraction) succeeds, second call (summary) fails
      mockGenerateText
        .mockResolvedValueOnce({
          text: "Extracted content",
          usage: { inputTokens: 100, outputTokens: 50 },
        })
        .mockRejectedValueOnce(new Error("Claude API error"));

      const input: ReadwiseFetchInput = {
        documentId: "doc-123",
        contentMode: "summary",
        summaryLength: "medium",
      };

      await expect(
        executeReadwiseFetch(input, mockContext),
      ).rejects.toMatchObject({
        message: expect.stringContaining("Failed to summarize"),
        retryable: true,
        code: "EXTRACTION_ERROR",
      });
    });
  });

  describe("content unavailable", () => {
    it("throws error when HTML content is missing", async () => {
      const docWithoutContent = {
        ...mockApiDocument,
        html_content: undefined,
      };

      mockAxios.get.mockResolvedValue({
        status: 200,
        data: {
          count: 1,
          nextPageCursor: null,
          results: [docWithoutContent],
        },
      });

      const input: ReadwiseFetchInput = {
        documentId: "doc-123",
        contentMode: "full",
      };

      await expect(
        executeReadwiseFetch(input, mockContext),
      ).rejects.toMatchObject({
        message: expect.stringContaining("not available"),
        retryable: true,
        code: "CONTENT_UNAVAILABLE",
      });
    });
  });

  describe("API errors", () => {
    it("returns RATE_LIMIT error when rate limited", async () => {
      mockAxios.get.mockResolvedValue({
        status: 429,
        data: {},
      });

      const input: ReadwiseFetchInput = {
        documentId: "doc-123",
        contentMode: "full",
      };

      await expect(
        executeReadwiseFetch(input, mockContext),
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

      const input: ReadwiseFetchInput = {
        documentId: "doc-123",
        contentMode: "full",
      };

      await expect(
        executeReadwiseFetch(input, mockContext),
      ).rejects.toMatchObject({
        message: expect.stringContaining("temporarily unavailable"),
        retryable: true,
        code: "INTERNAL_ERROR",
      });
    });
  });

  describe("result transformation", () => {
    it("transforms document correctly", async () => {
      const input: ReadwiseFetchInput = {
        documentId: "doc-123",
        contentMode: "full",
      };

      const result = await executeReadwiseFetch(input, mockContext);

      expect(result.document).toMatchObject({
        id: "doc-123",
        url: "https://example.com/article",
        title: "Test Article",
        author: "Test Author",
        source: "example.com",
        category: "article",
        location: "new",
        wordCount: 1500,
        readingTimeMinutes: 8,
        publishedAt: "2024-01-15T10:00:00Z",
        savedAt: "2024-01-16T08:00:00Z",
        tags: ["tech", "ai"],
      });
    });
  });

  describe("summary generation", () => {
    it("generates correct summary for full mode", async () => {
      const input: ReadwiseFetchInput = {
        documentId: "doc-123",
        contentMode: "full",
      };

      const result = await executeReadwiseFetch(input, mockContext);

      expect(result.summary).toContain("Extracted full content");
      expect(result.summary).toContain("Test Article");
    });

    it("generates correct summary for summary mode", async () => {
      const input: ReadwiseFetchInput = {
        documentId: "doc-123",
        contentMode: "summary",
        summaryLength: "short",
      };

      const result = await executeReadwiseFetch(input, mockContext);

      expect(result.summary).toContain("short summary");
      expect(result.summary).toContain("Test Article");
    });
  });

  describe("output structure", () => {
    it("includes durationMs in output", async () => {
      const input: ReadwiseFetchInput = {
        documentId: "doc-123",
        contentMode: "full",
      };

      const result = await executeReadwiseFetch(input, mockContext);

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("includes contentMode in output", async () => {
      const input: ReadwiseFetchInput = {
        documentId: "doc-123",
        contentMode: "summary",
        summaryLength: "long",
      };

      const result = await executeReadwiseFetch(input, mockContext);

      expect(result.contentMode).toBe("summary");
    });
  });
});
