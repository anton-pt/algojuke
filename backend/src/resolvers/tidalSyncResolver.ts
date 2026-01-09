/**
 * Tidal Library Sync Resolver
 *
 * Feature: ALG-32 - Tidal Library Synchronisation Flow
 *
 * GraphQL resolver for Tidal library sync operations.
 */

import {
  TidalLibrarySyncService,
  TidalConnectionError,
  TidalSyncApiError as TidalSyncApiServiceError,
} from "../services/tidalLibrarySyncService.js";
import type {
  TidalSyncAlbum,
  TidalSyncTrack,
  TidalImportItem,
} from "../services/tidalLibrarySyncService.js";
import { logger } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResolverContext {
  tidalLibrarySyncService: TidalLibrarySyncService;
  userId?: string;
}

// GraphQL input types
interface TidalImportItemInput {
  type: "ALBUM" | "TRACK";
  tidalId: string;
}

// Result union member types
interface TidalAlbumDiffResult {
  __typename: "TidalAlbumDiffResult";
  items: TidalSyncAlbum[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface TidalTrackDiffResult {
  __typename: "TidalTrackDiffResult";
  items: TidalSyncTrack[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface TidalSyncConnectionError {
  __typename: "TidalSyncConnectionError";
  message: string;
  requiresReconnect: boolean;
}

interface TidalSyncApiError {
  __typename: "TidalSyncApiError";
  message: string;
  retryable: boolean;
}

// GraphQL result type for individual import results
interface GraphQLTidalImportItemResult {
  tidalId: string;
  type: "ALBUM" | "TRACK";
  success: boolean;
  error?: string;
}

interface TidalImportSuccess {
  __typename: "TidalImportSuccess";
  imported: number;
  skipped: number;
  failed: number;
  results: GraphQLTidalImportItemResult[];
}

type TidalAlbumDiffUnion =
  | TidalAlbumDiffResult
  | TidalSyncConnectionError
  | TidalSyncApiError;

type TidalTrackDiffUnion =
  | TidalTrackDiffResult
  | TidalSyncConnectionError
  | TidalSyncApiError;

type TidalImportResult =
  | TidalImportSuccess
  | TidalSyncConnectionError
  | TidalSyncApiError;

// ---------------------------------------------------------------------------
// Resolvers
// ---------------------------------------------------------------------------

export const tidalSyncResolvers = {
  Query: {
    getTidalAlbumDiff: async (
      _parent: unknown,
      args: { cursor?: string; limit?: number },
      context: ResolverContext,
    ): Promise<TidalAlbumDiffUnion> => {
      const startTime = Date.now();
      const userId = context.userId;

      if (!userId) {
        return {
          __typename: "TidalSyncConnectionError",
          message: "User not authenticated",
          requiresReconnect: true,
        };
      }

      logger.info("tidal_sync_album_diff_query", {
        userId,
        cursor: args.cursor,
        limit: args.limit,
      });

      try {
        const result = await context.tidalLibrarySyncService.getAlbumDiff(
          userId,
          {
            cursor: args.cursor ?? undefined,
            limit: args.limit ?? undefined,
          },
        );

        const duration = Date.now() - startTime;
        logger.info("tidal_sync_album_diff_query_success", {
          userId,
          itemCount: result.items.length,
          hasMore: result.hasMore,
          durationMs: duration,
        });

        return {
          __typename: "TidalAlbumDiffResult",
          items: result.items,
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
        };
      } catch (error) {
        const duration = Date.now() - startTime;

        if (error instanceof TidalConnectionError) {
          logger.warn("tidal_sync_album_diff_connection_error", {
            userId,
            durationMs: duration,
            requiresReconnect: error.requiresReconnect,
          });
          return {
            __typename: "TidalSyncConnectionError",
            message: error.message,
            requiresReconnect: error.requiresReconnect,
          };
        }

        if (error instanceof TidalSyncApiServiceError) {
          logger.error("tidal_sync_album_diff_api_error", {
            userId,
            durationMs: duration,
            retryable: error.retryable,
            error: error.message,
          });
          return {
            __typename: "TidalSyncApiError",
            message: error.message,
            retryable: error.retryable,
          };
        }

        logger.error("tidal_sync_album_diff_unknown_error", {
          userId,
          durationMs: duration,
          error: error instanceof Error ? error.message : String(error),
        });

        return {
          __typename: "TidalSyncApiError",
          message: "An unexpected error occurred",
          retryable: true,
        };
      }
    },

    getTidalTrackDiff: async (
      _parent: unknown,
      args: { cursor?: string; limit?: number },
      context: ResolverContext,
    ): Promise<TidalTrackDiffUnion> => {
      const startTime = Date.now();
      const userId = context.userId;

      if (!userId) {
        return {
          __typename: "TidalSyncConnectionError",
          message: "User not authenticated",
          requiresReconnect: true,
        };
      }

      logger.info("tidal_sync_track_diff_query", {
        userId,
        cursor: args.cursor,
        limit: args.limit,
      });

      try {
        const result = await context.tidalLibrarySyncService.getTrackDiff(
          userId,
          {
            cursor: args.cursor ?? undefined,
            limit: args.limit ?? undefined,
          },
        );

        const duration = Date.now() - startTime;
        logger.info("tidal_sync_track_diff_query_success", {
          userId,
          itemCount: result.items.length,
          hasMore: result.hasMore,
          durationMs: duration,
        });

        return {
          __typename: "TidalTrackDiffResult",
          items: result.items,
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
        };
      } catch (error) {
        const duration = Date.now() - startTime;

        if (error instanceof TidalConnectionError) {
          logger.warn("tidal_sync_track_diff_connection_error", {
            userId,
            durationMs: duration,
            requiresReconnect: error.requiresReconnect,
          });
          return {
            __typename: "TidalSyncConnectionError",
            message: error.message,
            requiresReconnect: error.requiresReconnect,
          };
        }

        if (error instanceof TidalSyncApiServiceError) {
          logger.error("tidal_sync_track_diff_api_error", {
            userId,
            durationMs: duration,
            retryable: error.retryable,
            error: error.message,
          });
          return {
            __typename: "TidalSyncApiError",
            message: error.message,
            retryable: error.retryable,
          };
        }

        logger.error("tidal_sync_track_diff_unknown_error", {
          userId,
          durationMs: duration,
          error: error instanceof Error ? error.message : String(error),
        });

        return {
          __typename: "TidalSyncApiError",
          message: "An unexpected error occurred",
          retryable: true,
        };
      }
    },
  },

  Mutation: {
    importFromTidal: async (
      _parent: unknown,
      args: { items: TidalImportItemInput[] },
      context: ResolverContext,
    ): Promise<TidalImportResult> => {
      const startTime = Date.now();
      const userId = context.userId;

      if (!userId) {
        return {
          __typename: "TidalSyncConnectionError",
          message: "User not authenticated",
          requiresReconnect: true,
        };
      }

      logger.info("tidal_sync_import_mutation", {
        userId,
        itemCount: args.items.length,
      });

      // Convert GraphQL input to service format
      const items: TidalImportItem[] = args.items.map((item) => ({
        type: item.type === "ALBUM" ? "album" : "track",
        tidalId: item.tidalId,
      }));

      try {
        const result = await context.tidalLibrarySyncService.importItems(
          userId,
          items,
        );

        const duration = Date.now() - startTime;
        logger.info("tidal_sync_import_mutation_success", {
          userId,
          imported: result.imported,
          skipped: result.skipped,
          failed: result.failed,
          durationMs: duration,
        });

        // Convert service results to GraphQL format (type enum)
        const graphqlResults = result.results.map((r) => ({
          ...r,
          type: (r.type === "album" ? "ALBUM" : "TRACK") as "ALBUM" | "TRACK",
        }));

        return {
          __typename: "TidalImportSuccess",
          imported: result.imported,
          skipped: result.skipped,
          failed: result.failed,
          results: graphqlResults,
        };
      } catch (error) {
        const duration = Date.now() - startTime;

        if (error instanceof TidalConnectionError) {
          logger.warn("tidal_sync_import_connection_error", {
            userId,
            durationMs: duration,
            requiresReconnect: error.requiresReconnect,
          });
          return {
            __typename: "TidalSyncConnectionError",
            message: error.message,
            requiresReconnect: error.requiresReconnect,
          };
        }

        if (error instanceof TidalSyncApiServiceError) {
          logger.error("tidal_sync_import_api_error", {
            userId,
            durationMs: duration,
            retryable: error.retryable,
            error: error.message,
          });
          return {
            __typename: "TidalSyncApiError",
            message: error.message,
            retryable: error.retryable,
          };
        }

        logger.error("tidal_sync_import_unknown_error", {
          userId,
          durationMs: duration,
          error: error instanceof Error ? error.message : String(error),
        });

        return {
          __typename: "TidalSyncApiError",
          message: "An unexpected error occurred during import",
          retryable: true,
        };
      }
    },
  },

  // Union type resolvers
  TidalAlbumDiffUnion: {
    __resolveType(obj: TidalAlbumDiffUnion) {
      return obj.__typename;
    },
  },

  TidalTrackDiffUnion: {
    __resolveType(obj: TidalTrackDiffUnion) {
      return obj.__typename;
    },
  },

  TidalImportResult: {
    __resolveType(obj: TidalImportResult) {
      return obj.__typename;
    },
  },
};
