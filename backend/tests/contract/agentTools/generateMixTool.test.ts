/**
 * Generate Mix Tool Contract Tests
 *
 * Feature: ALG-83
 *
 * Tests for schema validation and output structure.
 * Written FIRST per Constitution Principle I (Test-First Development).
 */

import { describe, it, expect } from "vitest";
import {
  GenerateMixInputSchema,
  GenerateMixArticleSchema,
  ToolName,
} from "../../../src/schemas/agentTools.js";
import type { GenerateMixOutput } from "../../../src/types/agentTools.js";

// -----------------------------------------------------------------------------
// US-02: Validate article array input
// -----------------------------------------------------------------------------

describe("GenerateMixArticleSchema", () => {
  const validArticle = {
    documentId: "doc-123",
    contentMode: "summary" as const,
  };

  it("validates a complete valid article", () => {
    const result = GenerateMixArticleSchema.safeParse(validArticle);
    expect(result.success).toBe(true);
  });

  it("validates all valid contentMode values", () => {
    const modes = ["summary", "excerpt", "full"] as const;
    for (const mode of modes) {
      const result = GenerateMixArticleSchema.safeParse({
        ...validArticle,
        contentMode: mode,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects empty documentId", () => {
    const result = GenerateMixArticleSchema.safeParse({
      ...validArticle,
      documentId: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("empty");
    }
  });

  it("rejects invalid contentMode", () => {
    const result = GenerateMixArticleSchema.safeParse({
      ...validArticle,
      contentMode: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing documentId", () => {
    const result = GenerateMixArticleSchema.safeParse({
      contentMode: "summary",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing contentMode", () => {
    const result = GenerateMixArticleSchema.safeParse({
      documentId: "doc-123",
    });
    expect(result.success).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// US-01: Generate mix with articles and music instructions
// -----------------------------------------------------------------------------

describe("GenerateMixInputSchema", () => {
  const validArticle = {
    documentId: "doc-123",
    contentMode: "summary" as const,
  };

  const validInput = {
    title: "Evening Wind-Down",
    articles: [validArticle],
  };

  it("validates minimal valid input (1 article)", () => {
    const result = GenerateMixInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("validates input with all optional fields", () => {
    const result = GenerateMixInputSchema.safeParse({
      ...validInput,
      description: "A relaxing mix for the evening",
      musicInstructions: "calm piano transitions building to ambient",
    });
    expect(result.success).toBe(true);
  });

  it("validates input with multiple articles", () => {
    const result = GenerateMixInputSchema.safeParse({
      ...validInput,
      articles: [
        { documentId: "doc-1", contentMode: "summary" },
        { documentId: "doc-2", contentMode: "excerpt" },
        { documentId: "doc-3", contentMode: "full" },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.articles).toHaveLength(3);
    }
  });

  it("validates null description", () => {
    const result = GenerateMixInputSchema.safeParse({
      ...validInput,
      description: null,
    });
    expect(result.success).toBe(true);
  });

  it("validates null musicInstructions", () => {
    const result = GenerateMixInputSchema.safeParse({
      ...validInput,
      musicInstructions: null,
    });
    expect(result.success).toBe(true);
  });

  // Title validation
  it("rejects empty title", () => {
    const result = GenerateMixInputSchema.safeParse({
      ...validInput,
      title: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("empty");
    }
  });

  it("rejects title over 255 characters", () => {
    const result = GenerateMixInputSchema.safeParse({
      ...validInput,
      title: "x".repeat(256),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("255");
    }
  });

  it("accepts title at exactly 255 characters", () => {
    const result = GenerateMixInputSchema.safeParse({
      ...validInput,
      title: "x".repeat(255),
    });
    expect(result.success).toBe(true);
  });

  // Description validation
  it("rejects description over 1000 characters", () => {
    const result = GenerateMixInputSchema.safeParse({
      ...validInput,
      description: "x".repeat(1001),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("1000");
    }
  });

  it("accepts description at exactly 1000 characters", () => {
    const result = GenerateMixInputSchema.safeParse({
      ...validInput,
      description: "x".repeat(1000),
    });
    expect(result.success).toBe(true);
  });

  // Articles validation
  it("rejects empty articles array (US-02 scenario 2)", () => {
    const result = GenerateMixInputSchema.safeParse({
      ...validInput,
      articles: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("At least one article");
    }
  });

  it("accepts 10 articles (maximum)", () => {
    const articles = Array.from({ length: 10 }, (_, i) => ({
      documentId: `doc-${i}`,
      contentMode: "summary" as const,
    }));
    const result = GenerateMixInputSchema.safeParse({
      ...validInput,
      articles,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.articles).toHaveLength(10);
    }
  });

  it("rejects more than 10 articles (US-02 scenario 4)", () => {
    const articles = Array.from({ length: 11 }, (_, i) => ({
      documentId: `doc-${i}`,
      contentMode: "summary" as const,
    }));
    const result = GenerateMixInputSchema.safeParse({
      ...validInput,
      articles,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("10");
    }
  });

  it("rejects article with invalid contentMode (US-02 scenario 3)", () => {
    const result = GenerateMixInputSchema.safeParse({
      ...validInput,
      articles: [{ documentId: "doc-1", contentMode: "invalid" }],
    });
    expect(result.success).toBe(false);
  });

  // Music instructions validation
  it("rejects musicInstructions over 2000 characters", () => {
    const result = GenerateMixInputSchema.safeParse({
      ...validInput,
      musicInstructions: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("2000");
    }
  });

  it("accepts musicInstructions at exactly 2000 characters", () => {
    const result = GenerateMixInputSchema.safeParse({
      ...validInput,
      musicInstructions: "x".repeat(2000),
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty musicInstructions (Edge case: empty allowed)", () => {
    const result = GenerateMixInputSchema.safeParse({
      ...validInput,
      musicInstructions: "",
    });
    // Empty string is allowed - DJ agent can use article themes as fallback
    expect(result.success).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// US-01: Generate mix output structure (US-01 scenario 3)
// -----------------------------------------------------------------------------

describe("GenerateMixOutput structure", () => {
  it("has required fields for GenerateMixOutput", () => {
    const output: GenerateMixOutput = {
      summary:
        "Started generating mix 'Evening Wind-Down' with 2 articles. You can track progress in the Radio section.",
      durationMs: 150,
      mixId: "550e8400-e29b-41d4-a716-446655440000",
      status: "generating",
      title: "Evening Wind-Down",
      articleCount: 2,
    };

    expect(output.mixId).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(output.status).toBe("generating");
    expect(output.title).toBe("Evening Wind-Down");
    expect(output.articleCount).toBe(2);
    expect(output.summary).toContain("Evening Wind-Down");
    expect(output.summary).toContain("2 articles");
    expect(output.durationMs).toBeGreaterThan(0);
  });

  it("status is always 'generating'", () => {
    const output: GenerateMixOutput = {
      summary: "Test",
      durationMs: 100,
      mixId: "test-id",
      status: "generating",
      title: "Test",
      articleCount: 1,
    };

    // TypeScript ensures status can only be "generating"
    expect(output.status).toBe("generating");
  });

  it("includes BaseToolOutput fields", () => {
    const output: GenerateMixOutput = {
      summary: "Started generating mix 'Test' with 1 article.",
      durationMs: 250,
      mixId: "test-id",
      status: "generating",
      title: "Test",
      articleCount: 1,
    };

    // BaseToolOutput requires summary and durationMs
    expect(typeof output.summary).toBe("string");
    expect(typeof output.durationMs).toBe("number");
  });
});

// -----------------------------------------------------------------------------
// ToolName enum includes generateMix
// -----------------------------------------------------------------------------

describe("ToolName enum includes generateMix", () => {
  it("includes generateMix in tool names", () => {
    const names = ToolName.options;
    expect(names).toContain("generateMix");
  });

  it("validates generateMix as valid tool name", () => {
    const result = ToolName.safeParse("generateMix");
    expect(result.success).toBe(true);
  });

  it("has correct total count of tool names", () => {
    const names = ToolName.options;
    // semanticSearch, tidalSearch, batchMetadata, albumTracks, suggestPlaylist,
    // readwiseList, readwiseFetch, generateMix
    expect(names).toHaveLength(8);
  });
});
