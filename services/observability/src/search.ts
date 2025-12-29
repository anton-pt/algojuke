/**
 * Vector Search Span Wrapper
 *
 * Provides utilities for creating and managing vector search spans.
 * Used when tracing Qdrant search operations.
 */

import type { LangfuseTraceClient, LangfuseSpanClient } from "langfuse";
import {
  VectorSearchMetadataSchema,
  VectorSearchResultSchema,
} from "./schemas/search.js";

/**
 * Options for creating a Search span.
 */
export interface SearchSpanOptions {
  /** Human-readable name for the search */
  name: string;

  /** Qdrant collection name */
  collection: string;

  /** Number of results requested */
  topK: number;

  /** Query parameters */
  query: unknown;

  /** Whether sparse vectors were used (optional) */
  useSparse?: boolean;

  /** Search filters (optional) */
  filters?: Record<string, unknown>;

  /** Additional metadata (optional) */
  metadata?: Record<string, unknown>;

  /** Searchable tags (optional) */
  tags?: string[];
}

/**
 * Options for ending a Search span.
 */
export interface SearchEndOptions {
  /** Number of results returned */
  resultCount: number;

  /** Relevance scores of top results (optional) */
  topScores?: number[];

  /** IDs of returned documents (optional) */
  resultIds?: string[];

  /** Error if search failed (optional) */
  error?: Error | null;

  /** Log level (optional) */
  level?: "DEBUG" | "DEFAULT" | "WARNING" | "ERROR";
}

/**
 * Wrapper around Langfuse Span for search operations.
 */
export interface SearchSpan {
  /** Unique span ID */
  id: string;

  /** End the search span with results */
  end: (options: SearchEndOptions) => void;

  /** Update span metadata */
  update: (data: Partial<SearchSpanOptions>) => void;

  /** Raw Langfuse span client */
  raw: LangfuseSpanClient;
}

/**
 * Create a Search span for tracking vector search operations.
 *
 * @param parent - Parent trace or span
 * @param options - Search options
 * @returns Search span wrapper
 *
 * @example
 * ```typescript
 * const trace = client.langfuse.trace({ name: "user-query" });
 * const search = createSearchSpan(trace, {
 *   name: "vector-search",
 *   collection: "tracks",
 *   topK: 10,
 *   query: { text: "relaxing jazz" },
 * });
 *
 * // Perform search...
 *
 * search.end({
 *   resultCount: 10,
 *   topScores: [0.95, 0.87, ...],
 *   resultIds: ["track-1", "track-2", ...],
 * });
 * ```
 */
export function createSearchSpan(
  parent: LangfuseTraceClient | LangfuseSpanClient,
  options: SearchSpanOptions
): SearchSpan {
  // Validate metadata
  VectorSearchMetadataSchema.parse({
    collection: options.collection,
    topK: options.topK,
    filters: options.filters,
    useSparse: options.useSparse,
  });

  // Create the span using Langfuse's span method
  const span = parent.span({
    name: options.name,
    input: options.query,
    metadata: {
      ...options.metadata,
      collection: options.collection,
      topK: options.topK,
      useSparse: options.useSparse ?? false,
      filters: options.filters,
    },
  });

  return {
    id: span.id,

    end: (endOptions: SearchEndOptions) => {
      // Validate result if provided
      VectorSearchResultSchema.parse({
        resultCount: endOptions.resultCount,
        topScores: endOptions.topScores,
        resultIds: endOptions.resultIds,
      });

      span.end({
        output: {
          resultCount: endOptions.resultCount,
          topScores: endOptions.topScores,
          resultIds: endOptions.resultIds,
        },
        level: endOptions.error ? "ERROR" : endOptions.level,
        statusMessage: endOptions.error?.message,
      });
    },

    update: (data: Partial<SearchSpanOptions>) => {
      span.update({
        name: data.name,
        input: data.query,
        metadata: {
          ...data.metadata,
          collection: data.collection,
          topK: data.topK,
          useSparse: data.useSparse,
          filters: data.filters,
        },
      });
    },

    raw: span,
  };
}
