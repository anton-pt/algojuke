/**
 * Contract tests for Generation Span Schema
 *
 * TDD: These tests are written FIRST and should FAIL until generation.ts is implemented.
 * Terminology: Langfuse uses "Generation" to refer to LLM invocation spans.
 */

import { describe, it, expect } from "vitest";

// Import will fail until implementation exists
import {
  LLMGenerationMetadataSchema,
  UsageDetailsSchema,
  type LLMGenerationMetadata,
  type UsageDetails,
} from "../../src/schemas/generation.js";

describe("LLMGenerationMetadataSchema", () => {
  it("should validate valid generation metadata", () => {
    const validMetadata = {
      model: "claude-opus-4-20250514",
      modelParameters: {
        temperature: 0.7,
        maxTokens: 1000,
      },
      provider: "anthropic" as const,
    };

    const result = LLMGenerationMetadataSchema.safeParse(validMetadata);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model).toBe("claude-opus-4-20250514");
      expect(result.data.provider).toBe("anthropic");
      expect(result.data.modelParameters?.temperature).toBe(0.7);
    }
  });

  it("should use default provider as anthropic", () => {
    const minimalMetadata = {
      model: "claude-sonnet-4-20250514",
    };

    const result = LLMGenerationMetadataSchema.safeParse(minimalMetadata);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.provider).toBe("anthropic");
    }
  });

  it("should accept all valid providers", () => {
    const providers = ["anthropic", "openai", "other"] as const;

    for (const provider of providers) {
      const metadata = { model: "test-model", provider };
      const result = LLMGenerationMetadataSchema.safeParse(metadata);
      expect(result.success).toBe(true);
    }
  });

  it("should reject invalid provider", () => {
    const invalidMetadata = {
      model: "test-model",
      provider: "invalid-provider",
    };

    const result = LLMGenerationMetadataSchema.safeParse(invalidMetadata);
    expect(result.success).toBe(false);
  });

  it("should reject missing model", () => {
    const invalidMetadata = {
      provider: "anthropic",
    };

    const result = LLMGenerationMetadataSchema.safeParse(invalidMetadata);
    expect(result.success).toBe(false);
  });

  it("should accept optional model parameters", () => {
    const metadata = {
      model: "claude-opus-4-20250514",
      modelParameters: {
        temperature: 0.5,
        maxTokens: 2000,
        topP: 0.9,
        stopSequences: ["END", "STOP"],
      },
    };

    const result = LLMGenerationMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.modelParameters?.stopSequences).toEqual(["END", "STOP"]);
    }
  });
});

describe("UsageDetailsSchema", () => {
  it("should validate valid usage details", () => {
    const validUsage = {
      input: 100,
      output: 50,
      total: 150,
    };

    const result = UsageDetailsSchema.safeParse(validUsage);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.input).toBe(100);
      expect(result.data.output).toBe(50);
      expect(result.data.total).toBe(150);
    }
  });

  it("should accept minimal usage (input and output only)", () => {
    const minimalUsage = {
      input: 100,
      output: 50,
    };

    const result = UsageDetailsSchema.safeParse(minimalUsage);
    expect(result.success).toBe(true);
  });

  it("should accept usage with cost details", () => {
    const usageWithCost = {
      input: 100,
      output: 50,
      inputCost: 0.001,
      outputCost: 0.002,
      totalCost: 0.003,
    };

    const result = UsageDetailsSchema.safeParse(usageWithCost);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inputCost).toBe(0.001);
      expect(result.data.outputCost).toBe(0.002);
      expect(result.data.totalCost).toBe(0.003);
    }
  });

  it("should reject negative token counts", () => {
    const invalidUsage = {
      input: -10,
      output: 50,
    };

    const result = UsageDetailsSchema.safeParse(invalidUsage);
    expect(result.success).toBe(false);
  });

  it("should reject non-integer token counts", () => {
    const invalidUsage = {
      input: 100.5,
      output: 50,
    };

    const result = UsageDetailsSchema.safeParse(invalidUsage);
    expect(result.success).toBe(false);
  });

  it("should reject missing required fields", () => {
    const invalidUsage = {
      input: 100,
    };

    const result = UsageDetailsSchema.safeParse(invalidUsage);
    expect(result.success).toBe(false);
  });
});
