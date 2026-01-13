/**
 * Agent Tools GraphQL Resolvers
 *
 * Feature: ALG-77 - Cross-service agent tool invocation
 *
 * Exposes agent tools via GraphQL for both user and service authentication.
 * Supports dual auth modes:
 * - Service auth: X-API-Key header + userId in input
 * - User auth: Clerk JWT token (userId from context)
 */

import { GraphQLError } from "graphql";
import type { DataSource, Repository } from "typeorm";
import { resolveAgentToolUserId } from "../middleware/serviceAuth.js";
import {
  executeSemanticSearch,
  type SemanticSearchContext,
} from "../services/agentTools/semanticSearchTool.js";
import {
  executeTidalSearch,
  type TidalSearchContext,
} from "../services/agentTools/tidalSearchTool.js";
import {
  executeAlbumTracks,
  type AlbumTracksContext,
} from "../services/agentTools/albumTracksTool.js";
import {
  executeBatchMetadata,
  type BatchMetadataContext,
} from "../services/agentTools/batchMetadataTool.js";
import type { DiscoveryService } from "../services/discoveryService.js";
import type { TrackMetadataService } from "../services/trackMetadataService.js";
import type { TidalService } from "../services/tidalService.js";
import type { BackendQdrantClient } from "../clients/qdrantClient.js";
import { LibraryTrack } from "../entities/LibraryTrack.js";
import { LibraryAlbum } from "../entities/LibraryAlbum.js";
import type {
  ToolError,
  OptimizedSemanticSearchOutput,
  TidalSearchOutput,
  AlbumTracksOutput,
  BatchMetadataOutput,
} from "../types/agentTools.js";
import { logger } from "../utils/logger.js";

// =============================================================================
// Types
// =============================================================================

/**
 * GraphQL context for agent tool resolvers
 */
interface AgentToolsGraphQLContext {
  userId?: string;
  serviceApiKey?: string;
  tidalService: TidalService;
  discoveryService: DiscoveryService;
  trackMetadataService: TrackMetadataService;
  dataSources: {
    db: DataSource;
  };
}

/**
 * Extended context with qdrantClient (added in server.ts)
 */
interface AgentToolsContext extends AgentToolsGraphQLContext {
  qdrantClient: BackendQdrantClient;
}

/**
 * GraphQL input types (matching schema)
 */
interface AgentSemanticSearchInput {
  query: string;
  limit?: number | null;
  userId?: string | null;
}

interface AgentTidalSearchInput {
  query: string;
  searchType: "tracks" | "albums" | "both";
  limit?: number | null;
  userId?: string | null;
}

interface AgentAlbumTracksInput {
  albumId: string;
  userId?: string | null;
}

interface AgentBatchMetadataInput {
  isrcs: string[];
  userId?: string | null;
}

/**
 * GraphQL response types with __typename
 */
interface AgentSemanticSearchResponse extends OptimizedSemanticSearchOutput {
  __typename: "AgentSemanticSearchResponse";
}

interface AgentTidalSearchResponse extends TidalSearchOutput {
  __typename: "AgentTidalSearchResponse";
}

interface AgentAlbumTracksResponse extends AlbumTracksOutput {
  __typename: "AgentAlbumTracksResponse";
}

interface AgentBatchMetadataResponse extends BatchMetadataOutput {
  __typename: "AgentBatchMetadataResponse";
}

interface AgentToolErrorResponse {
  __typename: "AgentToolError";
  message: string;
  code: string;
  retryable: boolean;
}

type AgentSemanticSearchResult =
  | AgentSemanticSearchResponse
  | AgentToolErrorResponse;
type AgentTidalSearchResult = AgentTidalSearchResponse | AgentToolErrorResponse;
type AgentAlbumTracksResult = AgentAlbumTracksResponse | AgentToolErrorResponse;
type AgentBatchMetadataResult =
  | AgentBatchMetadataResponse
  | AgentToolErrorResponse;

// =============================================================================
// Error Handling
// =============================================================================

/**
 * Map error codes to GraphQL enum values
 */
function mapErrorCode(code: string | undefined): string {
  switch (code) {
    case "VALIDATION_ERROR":
      return "VALIDATION_ERROR";
    case "NOT_FOUND":
      return "NOT_FOUND";
    case "RATE_LIMIT":
      return "RATE_LIMIT";
    case "TIMEOUT":
      return "TIMEOUT";
    case "UNAUTHENTICATED":
      return "UNAUTHENTICATED";
    default:
      return "INTERNAL_ERROR";
  }
}

/**
 * Convert tool errors to GraphQL error responses
 */
function mapToolErrorToGraphQL(
  error: unknown,
  operationName: string,
): AgentToolErrorResponse {
  // Handle GraphQL errors (auth failures)
  if (error instanceof GraphQLError) {
    const code = (error.extensions?.code as string) || "UNAUTHENTICATED";
    return {
      __typename: "AgentToolError",
      message: error.message,
      code: mapErrorCode(code),
      retryable: false,
    };
  }

  // Handle tool errors
  const toolError = error as ToolError;
  const message = toolError.message || "An unexpected error occurred";
  const code = mapErrorCode(toolError.code);
  const retryable = toolError.retryable ?? false;

  logger.error(`${operationName}_error`, {
    message,
    code,
    retryable,
    originalCode: toolError.code,
  });

  return {
    __typename: "AgentToolError",
    message,
    code,
    retryable,
  };
}

// =============================================================================
// Repository Helpers
// =============================================================================

/**
 * Get repositories from data source
 */
function getRepositories(dataSource: DataSource): {
  libraryTrackRepository: Repository<LibraryTrack>;
  libraryAlbumRepository: Repository<LibraryAlbum>;
} {
  return {
    libraryTrackRepository: dataSource.getRepository(LibraryTrack),
    libraryAlbumRepository: dataSource.getRepository(LibraryAlbum),
  };
}

// =============================================================================
// Resolvers
// =============================================================================

export const agentToolsResolvers = {
  Query: {
    /**
     * Search indexed tracks by mood, theme, or lyrical content
     */
    agentSemanticSearch: async (
      _parent: unknown,
      args: { input: AgentSemanticSearchInput },
      context: AgentToolsContext,
    ): Promise<AgentSemanticSearchResult> => {
      try {
        const userId = resolveAgentToolUserId(
          context,
          args.input.userId,
          "agentSemanticSearch",
        );

        const { libraryTrackRepository, libraryAlbumRepository } =
          getRepositories(context.dataSources.db);

        const toolContext: SemanticSearchContext = {
          discoveryService: context.discoveryService,
          trackMetadataService: context.trackMetadataService,
          libraryTrackRepository,
          libraryAlbumRepository,
          userId,
        };

        const result = await executeSemanticSearch(
          {
            query: args.input.query,
            limit: args.input.limit ?? 50,
          },
          toolContext,
        );

        return {
          __typename: "AgentSemanticSearchResponse",
          ...result,
        };
      } catch (error) {
        return mapToolErrorToGraphQL(error, "agentSemanticSearch");
      }
    },

    /**
     * Search Tidal catalogue by artist, album, or track name
     */
    agentTidalSearch: async (
      _parent: unknown,
      args: { input: AgentTidalSearchInput },
      context: AgentToolsContext,
    ): Promise<AgentTidalSearchResult> => {
      try {
        const userId = resolveAgentToolUserId(
          context,
          args.input.userId,
          "agentTidalSearch",
        );

        const { libraryTrackRepository, libraryAlbumRepository } =
          getRepositories(context.dataSources.db);

        const toolContext: TidalSearchContext = {
          tidalService: context.tidalService,
          qdrantClient: context.qdrantClient,
          libraryTrackRepository,
          libraryAlbumRepository,
          userId,
        };

        const result = await executeTidalSearch(
          {
            query: args.input.query,
            searchType: args.input.searchType,
            limit: args.input.limit ?? 20,
          },
          toolContext,
        );

        return {
          __typename: "AgentTidalSearchResponse",
          ...result,
        };
      } catch (error) {
        return mapToolErrorToGraphQL(error, "agentTidalSearch");
      }
    },

    /**
     * Get all tracks from a specific Tidal album
     */
    agentAlbumTracks: async (
      _parent: unknown,
      args: { input: AgentAlbumTracksInput },
      context: AgentToolsContext,
    ): Promise<AgentAlbumTracksResult> => {
      try {
        const userId = resolveAgentToolUserId(
          context,
          args.input.userId,
          "agentAlbumTracks",
        );

        const { libraryTrackRepository, libraryAlbumRepository } =
          getRepositories(context.dataSources.db);

        const toolContext: AlbumTracksContext = {
          tidalService: context.tidalService,
          qdrantClient: context.qdrantClient,
          libraryTrackRepository,
          libraryAlbumRepository,
          userId,
        };

        const result = await executeAlbumTracks(
          { albumId: args.input.albumId },
          toolContext,
        );

        return {
          __typename: "AgentAlbumTracksResponse",
          ...result,
        };
      } catch (error) {
        return mapToolErrorToGraphQL(error, "agentAlbumTracks");
      }
    },

    /**
     * Get full metadata for tracks by ISRC
     */
    agentBatchMetadata: async (
      _parent: unknown,
      args: { input: AgentBatchMetadataInput },
      context: AgentToolsContext,
    ): Promise<AgentBatchMetadataResult> => {
      try {
        const userId = resolveAgentToolUserId(
          context,
          args.input.userId,
          "agentBatchMetadata",
        );

        const { libraryTrackRepository, libraryAlbumRepository } =
          getRepositories(context.dataSources.db);

        const toolContext: BatchMetadataContext = {
          qdrantClient: context.qdrantClient,
          libraryTrackRepository,
          libraryAlbumRepository,
          userId,
        };

        const result = await executeBatchMetadata(
          { isrcs: args.input.isrcs },
          toolContext,
        );

        return {
          __typename: "AgentBatchMetadataResponse",
          ...result,
        };
      } catch (error) {
        return mapToolErrorToGraphQL(error, "agentBatchMetadata");
      }
    },
  },

  // Union type resolvers
  AgentSemanticSearchResult: {
    __resolveType(obj: { __typename: string }) {
      return obj.__typename;
    },
  },
  AgentTidalSearchResult: {
    __resolveType(obj: { __typename: string }) {
      return obj.__typename;
    },
  },
  AgentAlbumTracksResult: {
    __resolveType(obj: { __typename: string }) {
      return obj.__typename;
    },
  },
  AgentBatchMetadataResult: {
    __resolveType(obj: { __typename: string }) {
      return obj.__typename;
    },
  },
};
