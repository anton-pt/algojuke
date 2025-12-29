/**
 * Vector Search Span Schema
 *
 * Defines the metadata schemas for vector search spans.
 * Used when tracing Qdrant search operations.
 */

import { z } from "zod";

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
