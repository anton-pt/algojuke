/**
 * GraphQL Resolvers for Semantic Discovery Search
 *
 * Feature: 009-semantic-discovery-search
 * Date: 2025-12-30
 *
 * Provides:
 * - discoverTracks query resolver
 * - DiscoverySearchResult union type resolver
 */

import { GraphQLError } from "graphql";
import { DiscoveryService } from "../services/discoveryService.js";
import { logger } from "../utils/logger.js";
import {
  isDiscoverySearchError,
  type DiscoverySearchInput,
  type DiscoverySearchResult,
} from "../types/discovery.js";

/**
 * Context type for discovery resolvers
 */
interface DiscoveryContext {
  discoveryService: DiscoveryService;
}

/**
 * GraphQL input type for discoverTracks query
 */
interface DiscoverTracksArgs {
  input: DiscoverySearchInput;
}

/**
 * GraphQL resolvers for discovery search
 */
export const discoveryResolvers = {
  Query: {
    /**
     * Discover tracks using natural language search
     *
     * Returns either DiscoverySearchResponse (success) or DiscoverySearchError (failure).
     * Uses union type for explicit success/error handling.
     */
    discoverTracks: async (
      _parent: unknown,
      args: DiscoverTracksArgs,
      context: DiscoveryContext
    ): Promise<DiscoverySearchResult> => {
      const { input } = args;

      try {
        const result = await context.discoveryService.search(input);

        // Log the result type for debugging
        if (isDiscoverySearchError(result)) {
          logger.debug("discovery_search_returned_error", {
            query: input.query,
            code: result.code,
            retryable: result.retryable,
          });
        } else {
          logger.debug("discovery_search_returned_results", {
            query: input.query,
            resultCount: result.results.length,
            expandedQueryCount: result.expandedQueries.length,
          });
        }

        return result;
      } catch (error) {
        // This shouldn't happen as DiscoveryService handles errors internally
        // But we catch it here as a safety net
        logger.error("discovery_resolver_unexpected_error", {
          query: input.query,
          error: error instanceof Error ? error.message : String(error),
        });

        throw new GraphQLError("An unexpected error occurred during discovery search", {
          extensions: {
            code: "INTERNAL_SERVER_ERROR",
          },
        });
      }
    },

    /**
     * Get the count of indexed tracks available for discovery search
     */
    discoveryIndexedCount: async (
      _parent: unknown,
      _args: unknown,
      context: DiscoveryContext
    ): Promise<number> => {
      return context.discoveryService.getIndexedCount();
    },
  },

  /**
   * Union type resolver for DiscoverySearchResult
   *
   * Determines whether the result is a success (DiscoverySearchResponse)
   * or an error (DiscoverySearchError).
   */
  DiscoverySearchResult: {
    __resolveType(obj: DiscoverySearchResult): string {
      if (isDiscoverySearchError(obj)) {
        return "DiscoverySearchError";
      }
      return "DiscoverySearchResponse";
    },
  },
};
