/**
 * LLM Generation Span Schema
 *
 * Defines the metadata schemas for LLM Generation spans.
 * Langfuse uses "Generation" to refer to LLM invocation spans.
 */

import { z } from "zod";

/**
 * LLM Generation span metadata.
 * Used when tracing LLM API calls.
 */
export const LLMGenerationMetadataSchema = z.object({
  /** Model identifier (e.g., "claude-opus-4-20250514") */
  model: z.string(),

  /** Model parameters */
  modelParameters: z
    .object({
      temperature: z.number().optional(),
      maxTokens: z.number().optional(),
      topP: z.number().optional(),
      stopSequences: z.array(z.string()).optional(),
    })
    .optional(),

  /** Provider name */
  provider: z.enum(["anthropic", "openai", "other"]).default("anthropic"),
});

export type LLMGenerationMetadata = z.infer<typeof LLMGenerationMetadataSchema>;

/**
 * Usage details for LLM generation spans.
 */
export const UsageDetailsSchema = z.object({
  /** Number of input tokens */
  input: z.number().int().nonnegative(),

  /** Number of output tokens */
  output: z.number().int().nonnegative(),

  /** Total tokens (computed if not provided) */
  total: z.number().int().nonnegative().optional(),

  /** Cost for input tokens (USD) */
  inputCost: z.number().nonnegative().optional(),

  /** Cost for output tokens (USD) */
  outputCost: z.number().nonnegative().optional(),

  /** Total cost (USD) */
  totalCost: z.number().nonnegative().optional(),
});

export type UsageDetails = z.infer<typeof UsageDetailsSchema>;
