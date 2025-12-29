/**
 * Span Type Contracts
 *
 * Defines the metadata schemas for different span types used in algojuke.
 * These contracts ensure consistent span creation across all services.
 */

import { z } from "zod";

/**
 * Base span options shared by all span types.
 */
export const BaseSpanOptionsSchema = z.object({
  /** Human-readable span name */
  name: z.string(),

  /** Optional user ID for filtering */
  userId: z.string().optional(),

  /** Optional session ID for grouping */
  sessionId: z.string().optional(),

  /** Arbitrary metadata */
  metadata: z.record(z.unknown()).optional(),

  /** Searchable tags */
  tags: z.array(z.string()).optional(),
});

export type BaseSpanOptions = z.infer<typeof BaseSpanOptionsSchema>;

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

/**
 * Vector search span metadata.
 * Used when tracing Qdrant search operations.
 */
export const VectorSearchMetadataSchema = z.object({
  /** Qdrant collection name */
  collection: z.string(),

  /** Number of results requested */
  topK: z.number().int().positive(),

  /** Search filters applied */
  filters: z.record(z.unknown()).optional(),

  /** Whether sparse vectors were used */
  useSparse: z.boolean().default(false),
});

export type VectorSearchMetadata = z.infer<typeof VectorSearchMetadataSchema>;

/**
 * Vector search result metadata.
 */
export const VectorSearchResultSchema = z.object({
  /** Number of results returned */
  resultCount: z.number().int().nonnegative(),

  /** Relevance scores of top results */
  topScores: z.array(z.number()).optional(),

  /** IDs of returned documents */
  resultIds: z.array(z.string()).optional(),
});

export type VectorSearchResult = z.infer<typeof VectorSearchResultSchema>;

/**
 * HTTP request span metadata.
 * Used when tracing external API calls.
 */
export const HTTPSpanMetadataSchema = z.object({
  /** HTTP method */
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]),

  /** Request URL */
  url: z.string().url(),

  /** Request headers */
  headers: z.record(z.string()).optional(),
});

export type HTTPSpanMetadata = z.infer<typeof HTTPSpanMetadataSchema>;

/**
 * HTTP response metadata.
 */
export const HTTPResponseMetadataSchema = z.object({
  /** HTTP status code */
  statusCode: z.number().int(),

  /** Response headers */
  headers: z.record(z.string()).optional(),

  /** Response time in milliseconds */
  durationMs: z.number().nonnegative(),
});

export type HTTPResponseMetadata = z.infer<typeof HTTPResponseMetadataSchema>;
