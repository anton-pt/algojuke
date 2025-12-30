/**
 * TypeScript types and Zod schemas for Semantic Discovery Search
 *
 * Feature: 009-semantic-discovery-search
 * Date: 2025-12-30
 *
 * These types correspond to the GraphQL schema in discovery.graphql
 */

import { z } from "zod";

// =============================================================================
// Zod Validation Schemas
// =============================================================================

/**
 * Schema for user-provided discovery search query.
 * Validates input is non-empty, non-whitespace, and under 2000 characters.
 */
export const DiscoveryQuerySchema = z.object({
  text: z
    .string()
    .min(1, "Query must not be empty")
    .max(2000, "Query must be no more than 2000 characters")
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, "Query must contain non-whitespace characters"),
});

/**
 * Schema for sparse vector (BM25 term frequency vector).
 * Used for keyword search in hybrid queries.
 */
export const SparseVectorSchema = z
  .object({
    indices: z.array(z.number().int().nonnegative()),
    values: z.array(z.number()),
  })
  .refine((data) => data.indices.length === data.values.length, {
    message: "indices and values must have same length",
  });

/**
 * Schema for a single discovery result from hybrid search.
 */
export const DiscoveryResultSchema = z.object({
  id: z.string(),
  isrc: z.string().regex(/^[A-Z0-9]{12}$/i, "ISRC must be 12 alphanumeric characters"),
  title: z.string(),
  artist: z.string(),
  album: z.string(),
  score: z.number(),
  artworkUrl: z.string().url().optional().nullable(),
});

/**
 * Schema for discovery search response.
 */
export const DiscoverySearchResponseSchema = z.object({
  results: z.array(DiscoveryResultSchema),
  query: z.string(),
  expandedQueries: z.array(z.string()).min(1).max(3),
  page: z.number().int().nonnegative(),
  pageSize: z.number().int().positive(),
  totalResults: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});

/**
 * Schema for query expansion result from Claude Haiku.
 */
export const QueryExpansionResultSchema = z.object({
  queries: z.array(z.string()).min(1).max(3),
  model: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
});

/**
 * Schema for discovery search input (GraphQL input type).
 */
export const DiscoverySearchInputSchema = z.object({
  query: z.string().min(1).max(2000),
  page: z.number().int().nonnegative().default(0),
  pageSize: z.number().int().positive().max(20).default(20),
});

// =============================================================================
// TypeScript Types (inferred from Zod schemas)
// =============================================================================

/** User-provided natural language search input */
export type DiscoveryQuery = z.infer<typeof DiscoveryQuerySchema>;

/** BM25 term frequency vector for keyword search */
export type SparseVector = z.infer<typeof SparseVectorSchema>;

/** A track returned from discovery search */
export type DiscoveryResult = z.infer<typeof DiscoveryResultSchema>;

/** Complete response for a discovery search request */
export type DiscoverySearchResponse = z.infer<typeof DiscoverySearchResponseSchema>;

/** Result from LLM query expansion */
export type QueryExpansionResult = z.infer<typeof QueryExpansionResultSchema>;

/** Input for discovery search GraphQL query */
export type DiscoverySearchInput = z.infer<typeof DiscoverySearchInputSchema>;

// =============================================================================
// Error Codes
// =============================================================================

/**
 * Error codes for discovery search failures.
 * Matches DiscoveryErrorCode enum in GraphQL schema.
 */
export enum DiscoveryErrorCode {
  EMPTY_QUERY = "EMPTY_QUERY",
  LLM_UNAVAILABLE = "LLM_UNAVAILABLE",
  EMBEDDING_UNAVAILABLE = "EMBEDDING_UNAVAILABLE",
  INDEX_UNAVAILABLE = "INDEX_UNAVAILABLE",
  TIMEOUT = "TIMEOUT",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

/**
 * Discovery search error with code and retry information.
 */
export interface DiscoverySearchError {
  message: string;
  code: DiscoveryErrorCode;
  retryable: boolean;
}

/**
 * Union type for discovery search result (success or error).
 */
export type DiscoverySearchResult = DiscoverySearchResponse | DiscoverySearchError;

/**
 * Type guard to check if result is an error.
 */
export function isDiscoverySearchError(
  result: DiscoverySearchResult
): result is DiscoverySearchError {
  return "code" in result && "retryable" in result;
}

// =============================================================================
// Expanded Query Type (internal use)
// =============================================================================

/**
 * An expanded query with its embeddings ready for hybrid search.
 */
export interface ExpandedQuery {
  /** The expanded search query text */
  text: string;
  /** Dense embedding vector (1024 dimensions from mxbai-embed-large-v1) */
  denseVector: number[];
  /** Sparse BM25 term frequency vector */
  sparseVector: SparseVector;
}

// =============================================================================
// Constants
// =============================================================================

/** Default page size for discovery search */
export const DEFAULT_PAGE_SIZE = 20;

/** Maximum page size for discovery search */
export const MAX_PAGE_SIZE = 20;

/** Maximum total results across all pages */
export const MAX_TOTAL_RESULTS = 100;

/** Search timeout in milliseconds */
export const SEARCH_TIMEOUT_MS = 30000;

/** Embedding vector dimension */
export const EMBEDDING_DIMENSION = 1024;
