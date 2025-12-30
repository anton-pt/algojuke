/**
 * Discovery Service
 *
 * Feature: 009-semantic-discovery-search
 * Date: 2025-12-30
 *
 * Orchestrates the semantic discovery search pipeline:
 * 1. Query validation
 * 2. Query expansion (Claude Haiku 4.5)
 * 3. Embedding generation (TEI)
 * 4. Sparse vector generation (BM25)
 * 5. Hybrid search (Qdrant RRF)
 * 6. Result formatting
 */

import { BackendQdrantClient } from "../clients/qdrantClient.js";
import {
  AnthropicClient,
  AnthropicError,
  getAnthropicClient,
  QUERY_EXPANSION_MODEL,
} from "../clients/anthropicClient.js";
import { TEIClient, TEIError, getTEIClient, QUERY_EMBED_INSTRUCTION, TEI_MODEL_NAME } from "../clients/teiClient.js";
import { textToSparseVector } from "../utils/sparseVector.js";
import { logger } from "../utils/logger.js";
import {
  createDiscoveryTrace,
  createGenerationSpan,
  createEmbeddingSpan,
  createSearchSpan,
  flushLangfuse,
  type DiscoveryTrace,
} from "../utils/langfuse.js";
import {
  DiscoveryQuerySchema,
  DiscoveryErrorCode,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_TOTAL_RESULTS,
  SEARCH_TIMEOUT_MS,
  type DiscoverySearchInput,
  type DiscoverySearchResponse,
  type DiscoverySearchError,
  type DiscoverySearchResult,
  type ExpandedQuery,
} from "../types/discovery.js";

/**
 * Discovery Service configuration
 */
interface DiscoveryServiceConfig {
  qdrantClient: BackendQdrantClient;
  anthropicClient?: AnthropicClient;
  teiClient?: TEIClient;
}

/**
 * Discovery Service for semantic search
 */
export class DiscoveryService {
  private qdrantClient: BackendQdrantClient;
  private anthropicClient: AnthropicClient;
  private teiClient: TEIClient;

  constructor(config: DiscoveryServiceConfig) {
    this.qdrantClient = config.qdrantClient;
    this.anthropicClient = config.anthropicClient ?? getAnthropicClient();
    this.teiClient = config.teiClient ?? getTEIClient();
  }

  /**
   * Perform semantic discovery search
   *
   * @param input - Search input with query, page, and pageSize
   * @returns DiscoverySearchResult (response or error)
   */
  async search(input: DiscoverySearchInput): Promise<DiscoverySearchResult> {
    const startTime = Date.now();

    // Normalize input
    const page = input.page ?? 0;
    const pageSize = Math.min(input.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = page * pageSize;

    // Check pagination bounds
    if (offset >= MAX_TOTAL_RESULTS) {
      return this.createSuccessResponse([], input.query, [], page, pageSize);
    }

    // Validate query
    const validationResult = DiscoveryQuerySchema.safeParse({ text: input.query });
    if (!validationResult.success) {
      logger.debug("discovery_empty_query", { query: input.query });
      return this.createError(
        DiscoveryErrorCode.EMPTY_QUERY,
        "Please enter a search term",
        false
      );
    }

    const query = validationResult.data.text;

    // Create Langfuse trace for observability
    const trace = createDiscoveryTrace(query);

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Search operation timed out"));
        }, SEARCH_TIMEOUT_MS);
      });

      // Execute search with timeout and tracing
      const searchPromise = this.executeSearch(query, pageSize, offset, trace);
      const result = await Promise.race([searchPromise, timeoutPromise]);

      const duration = Date.now() - startTime;
      logger.info("discovery_search_complete", {
        query,
        page,
        pageSize,
        resultCount: result.results.length,
        expandedQueryCount: result.expandedQueries.length,
        durationMs: duration,
      });

      // Flush trace data to Langfuse
      flushLangfuse().catch(() => {});

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("discovery_search_error", {
        query,
        page,
        pageSize,
        durationMs: duration,
        error: error instanceof Error ? error.message : String(error),
      });

      // Flush trace data even on error
      flushLangfuse().catch(() => {});

      return this.handleError(error);
    }
  }

  /**
   * Execute the search pipeline
   */
  private async executeSearch(
    query: string,
    limit: number,
    offset: number,
    trace: DiscoveryTrace | null = null
  ): Promise<DiscoverySearchResponse> {
    // Step 1: Query expansion
    const generationSpan = createGenerationSpan(trace, {
      name: "query-expansion",
      model: QUERY_EXPANSION_MODEL,
      prompt: query,
      metadata: { step: "query_expansion" },
    });

    const expansionResult = await this.anthropicClient.expandQuery(query);
    const expandedQueryTexts = expansionResult.queries;

    generationSpan.end({
      completion: JSON.stringify(expandedQueryTexts),
      inputTokens: expansionResult.inputTokens,
      outputTokens: expansionResult.outputTokens,
    });

    logger.debug("discovery_queries_expanded", {
      original: query,
      expanded: expandedQueryTexts,
      inputTokens: expansionResult.inputTokens,
      outputTokens: expansionResult.outputTokens,
    });

    // Step 2: Generate embeddings and sparse vectors for each expanded query
    const embeddingSpan = createEmbeddingSpan(trace, {
      name: "generate-embeddings",
      model: TEI_MODEL_NAME,
      inputCount: expandedQueryTexts.length,
      metadata: { step: "embedding_generation" },
    });

    const embeddingStartTime = Date.now();
    const expandedQueries = await this.prepareQueries(expandedQueryTexts);
    const embeddingDuration = Date.now() - embeddingStartTime;

    embeddingSpan.end({
      dimensions: expandedQueries[0]?.denseVector.length ?? 0,
      durationMs: embeddingDuration,
    });

    // Step 3: Execute hybrid search
    const searchSpan = createSearchSpan(trace, {
      name: "hybrid-search",
      collection: "tracks",
      operation: "hybrid_search",
      queryCount: expandedQueries.length,
      metadata: { step: "vector_search", limit, offset },
    });

    const searchStartTime = Date.now();
    const results = await this.qdrantClient.hybridSearch(expandedQueries, {
      limit,
      offset,
      prefetchLimit: Math.min(offset + limit + 50, MAX_TOTAL_RESULTS + 50),
    });
    const searchDuration = Date.now() - searchStartTime;

    searchSpan.end({
      resultCount: results.length,
      durationMs: searchDuration,
    });

    // Calculate total results (approximate based on whether we got a full page)
    const hasMore = results.length === limit && (offset + limit) < MAX_TOTAL_RESULTS;
    const totalResults = hasMore
      ? Math.min(offset + limit + 1, MAX_TOTAL_RESULTS)
      : offset + results.length;

    return this.createSuccessResponse(
      results,
      query,
      expandedQueryTexts,
      Math.floor(offset / limit),
      limit,
      totalResults,
      hasMore
    );
  }

  /**
   * Prepare expanded queries with embeddings and sparse vectors
   */
  private async prepareQueries(queryTexts: string[]): Promise<ExpandedQuery[]> {
    const queries: ExpandedQuery[] = [];

    for (const text of queryTexts) {
      // Generate dense embedding with instruction prefix
      const denseVector = await this.teiClient.embedWithInstruct(
        text,
        QUERY_EMBED_INSTRUCTION
      );

      // Generate sparse vector for BM25
      const sparseVector = textToSparseVector(text);

      queries.push({
        text,
        denseVector,
        sparseVector,
      });
    }

    return queries;
  }

  /**
   * Create a success response
   */
  private createSuccessResponse(
    results: DiscoverySearchResponse["results"],
    query: string,
    expandedQueries: string[],
    page: number,
    pageSize: number,
    totalResults?: number,
    hasMore?: boolean
  ): DiscoverySearchResponse {
    return {
      results,
      query,
      expandedQueries,
      page,
      pageSize,
      totalResults: totalResults ?? results.length,
      hasMore: hasMore ?? false,
    };
  }

  /**
   * Create an error response
   */
  private createError(
    code: DiscoveryErrorCode,
    message: string,
    retryable: boolean
  ): DiscoverySearchError {
    return {
      code,
      message,
      retryable,
    };
  }

  /**
   * Handle errors from the search pipeline
   */
  private handleError(error: unknown): DiscoverySearchError {
    // Timeout
    if (error instanceof Error && error.message.includes("timed out")) {
      return this.createError(
        DiscoveryErrorCode.TIMEOUT,
        "Search took too long. Please try a simpler query.",
        true
      );
    }

    // Anthropic errors
    if (error instanceof AnthropicError) {
      return this.createError(
        DiscoveryErrorCode.LLM_UNAVAILABLE,
        "Search service temporarily unavailable. Please try again.",
        error.retryable
      );
    }

    // TEI errors
    if (error instanceof TEIError) {
      return this.createError(
        DiscoveryErrorCode.EMBEDDING_UNAVAILABLE,
        "Search service temporarily unavailable. Please try again.",
        error.retryable
      );
    }

    // Qdrant errors (check error message)
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (
        message.includes("qdrant") ||
        message.includes("connection") ||
        message.includes("econnrefused")
      ) {
        return this.createError(
          DiscoveryErrorCode.INDEX_UNAVAILABLE,
          "Search service temporarily unavailable. Please try again.",
          true
        );
      }
    }

    // Generic error
    return this.createError(
      DiscoveryErrorCode.INTERNAL_ERROR,
      "An unexpected error occurred. Please try again.",
      true
    );
  }

  /**
   * Health check for discovery service
   *
   * Checks all three dependencies: Anthropic (LLM), TEI (embeddings), and Qdrant (search)
   */
  async isHealthy(): Promise<boolean> {
    try {
      const [anthropicHealthy, teiHealthy, qdrantHealthy] = await Promise.all([
        this.anthropicClient.isHealthy(),
        this.teiClient.isHealthy(),
        this.qdrantClient.isHealthy(),
      ]);

      return anthropicHealthy && teiHealthy && qdrantHealthy;
    } catch {
      return false;
    }
  }

  /**
   * Get indexed track count
   */
  async getIndexedCount(): Promise<number> {
    return this.qdrantClient.getCollectionCount();
  }
}

/**
 * Singleton discovery service instance
 */
let _discoveryService: DiscoveryService | null = null;

/**
 * Create or get the discovery service singleton
 */
export function getDiscoveryService(
  qdrantClient: BackendQdrantClient
): DiscoveryService {
  if (!_discoveryService) {
    _discoveryService = new DiscoveryService({ qdrantClient });
  }
  return _discoveryService;
}

/**
 * Reset the singleton (for testing)
 */
export function resetDiscoveryService(): void {
  _discoveryService = null;
}
