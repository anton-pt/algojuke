/**
 * Playlist Export Resolver
 *
 * Feature: 017-tidal-playlist-export
 *
 * GraphQL resolver for exporting playlists to Tidal.
 */

import { PlaylistExportRequestSchema } from "../schemas/playlist.js";
import {
  getTidalTokens,
  isTokenExpired,
  attemptTokenRefresh,
} from "../services/tidalAuthService.js";
import type { TidalService } from "../services/tidalService.js";
import {
  RateLimitError,
  ApiUnavailableError,
  TimeoutError,
} from "../types/errors.js";
import { logger } from "../utils/logger.js";

// Input types
interface TrackForExportInput {
  isrc: string;
  title: string;
  artist: string;
}

interface ExportPlaylistToTidalInput {
  name: string;
  tracks: TrackForExportInput[];
}

// Context from GraphQL server
interface ResolverContext {
  tidalService: TidalService;
  userId?: string;
}

// Result types for the union
interface ExportPlaylistSuccess {
  __typename: "ExportPlaylistSuccess";
  playlistId: string;
  playlistName: string;
  tracksAdded: number;
  tracksSkipped: number;
  skippedTracks?: Array<{ isrc: string; title: string; artist: string }>;
}

interface NoTidalConnectionError {
  __typename: "NoTidalConnectionError";
  message: string;
  code: string;
}

interface TokenRefreshFailedError {
  __typename: "TokenRefreshFailedError";
  message: string;
  code: string;
}

interface NoTracksAvailableError {
  __typename: "NoTracksAvailableError";
  message: string;
  code: string;
}

interface PlaylistCreationFailedError {
  __typename: "PlaylistCreationFailedError";
  message: string;
  code: string;
  retryable: boolean;
  retryAfter?: number;
}

interface PlaylistValidationError {
  __typename: "PlaylistValidationError";
  message: string;
  code: string;
  details?: string[];
}

type ExportPlaylistToTidalResult =
  | ExportPlaylistSuccess
  | NoTidalConnectionError
  | TokenRefreshFailedError
  | NoTracksAvailableError
  | PlaylistCreationFailedError
  | PlaylistValidationError;

export const playlistResolvers = {
  Mutation: {
    exportPlaylistToTidal: async (
      _parent: unknown,
      args: { input: ExportPlaylistToTidalInput },
      context: ResolverContext,
    ): Promise<ExportPlaylistToTidalResult> => {
      const startTime = Date.now();
      const userId = context.userId;
      const { tidalService } = context;

      // Check authentication
      if (!userId) {
        return {
          __typename: "NoTidalConnectionError",
          message: "User not authenticated",
          code: "no_tidal_connection",
        };
      }

      // Validate input using Zod schema
      const parseResult = PlaylistExportRequestSchema.safeParse(args.input);
      if (!parseResult.success) {
        logger.warn("playlist_export_validation_failed", {
          userId,
          errors: parseResult.error.issues,
        });
        return {
          __typename: "PlaylistValidationError",
          message: "Invalid request",
          code: "validation_error",
          details: parseResult.error.issues.map(
            (issue) => `${issue.path.join(".")}: ${issue.message}`,
          ),
        };
      }

      const { name, tracks } = parseResult.data;

      try {
        // Get user's Tidal tokens
        let tidalTokens = await getTidalTokens(userId);
        if (!tidalTokens) {
          logger.warn("playlist_export_no_tidal_connection", { userId });
          return {
            __typename: "NoTidalConnectionError",
            message:
              "Tidal account not connected. Please connect your Tidal account to save playlists.",
            code: "no_tidal_connection",
          };
        }

        // Check if token is expired and attempt refresh
        const tokenExpired = await isTokenExpired(userId);
        if (tokenExpired) {
          logger.info("playlist_export_token_expired_attempting_refresh", {
            userId,
          });

          const refreshedAccessToken = await attemptTokenRefresh(userId);
          if (!refreshedAccessToken) {
            logger.warn("playlist_export_token_refresh_failed", { userId });
            return {
              __typename: "TokenRefreshFailedError",
              message:
                "Your Tidal session has expired. Please reconnect your Tidal account.",
              code: "token_refresh_failed",
            };
          }

          tidalTokens = { ...tidalTokens, accessToken: refreshedAccessToken };
          logger.info("playlist_export_token_refreshed", { userId });
        }

        // Resolve ISRCs to Tidal track IDs
        const isrcs = tracks.map((t) => t.isrc.toUpperCase());
        const trackMap = await tidalService.batchFetchTracksByIsrc(isrcs);

        // Build lists of found and skipped tracks
        const foundTracks: Array<{ isrc: string; tidalId: string }> = [];
        const skippedTracks: Array<{
          isrc: string;
          title: string;
          artist: string;
        }> = [];

        for (const track of tracks) {
          const normalizedIsrc = track.isrc.toUpperCase();
          const tidalData = trackMap.get(normalizedIsrc);
          if (tidalData) {
            foundTracks.push({
              isrc: normalizedIsrc,
              tidalId: tidalData.tidalId,
            });
          } else {
            skippedTracks.push({
              isrc: track.isrc,
              title: track.title,
              artist: track.artist,
            });
          }
        }

        logger.info("playlist_export_isrc_resolution", {
          userId,
          requested: tracks.length,
          found: foundTracks.length,
          skipped: skippedTracks.length,
        });

        // Check if any tracks were found
        if (foundTracks.length === 0) {
          logger.warn("playlist_export_no_tracks_available", {
            userId,
            trackCount: tracks.length,
          });
          return {
            __typename: "NoTracksAvailableError",
            message:
              "None of the tracks in this playlist could be found on Tidal.",
            code: "no_tracks_available",
          };
        }

        // Create playlist
        // TODO: Get countryCode from user's Tidal profile in the future
        const countryCode = "US";
        const playlistId = await tidalService.createPlaylist(
          name,
          tidalTokens.accessToken,
          countryCode,
        );

        logger.info("playlist_export_playlist_created", {
          userId,
          playlistId,
          playlistName: name,
        });

        // Add tracks to playlist
        const trackIds = foundTracks.map((t) => t.tidalId);
        await tidalService.addTracksToPlaylist(
          playlistId,
          trackIds,
          tidalTokens.accessToken,
          countryCode,
        );

        const duration = Date.now() - startTime;
        logger.info("playlist_export_success", {
          userId,
          playlistId,
          playlistName: name,
          tracksAdded: foundTracks.length,
          tracksSkipped: skippedTracks.length,
          duration,
        });

        return {
          __typename: "ExportPlaylistSuccess",
          playlistId,
          playlistName: name,
          tracksAdded: foundTracks.length,
          tracksSkipped: skippedTracks.length,
          skippedTracks: skippedTracks.length > 0 ? skippedTracks : undefined,
        };
      } catch (error) {
        const duration = Date.now() - startTime;

        // Handle specific error types using instanceof for type safety
        if (error instanceof RateLimitError) {
          logger.warn("playlist_export_rate_limited", { userId, duration });
          return {
            __typename: "PlaylistCreationFailedError",
            message:
              "Tidal API rate limit reached. Please try again in a few seconds.",
            code: "rate_limit_exceeded",
            retryable: true,
            retryAfter: error.retryAfter ?? 5,
          };
        }

        if (error instanceof ApiUnavailableError) {
          logger.error("playlist_export_tidal_unavailable", {
            userId,
            duration,
            error: error.message,
          });
          return {
            __typename: "PlaylistCreationFailedError",
            message:
              "Tidal is temporarily unavailable. Please try again later.",
            code: "tidal_unavailable",
            retryable: true,
          };
        }

        if (error instanceof TimeoutError) {
          logger.error("playlist_export_timeout", {
            userId,
            duration,
            error: error.message,
          });
          return {
            __typename: "PlaylistCreationFailedError",
            message: "Request timed out. Please try again.",
            code: "tidal_unavailable",
            retryable: true,
          };
        }

        // Check for authorization errors from Tidal
        if (
          error instanceof Error &&
          error.message.includes("authorization failed")
        ) {
          logger.warn("playlist_export_auth_error", {
            userId,
            duration,
            error: error.message,
          });
          return {
            __typename: "TokenRefreshFailedError",
            message:
              "Your Tidal session has expired. Please reconnect your Tidal account.",
            code: "token_refresh_failed",
          };
        }

        // Generic error
        logger.error("playlist_export_failed", {
          userId,
          duration,
          error: error instanceof Error ? error.message : String(error),
        });

        return {
          __typename: "PlaylistCreationFailedError",
          message: "Failed to create playlist. Please try again.",
          code: "playlist_creation_failed",
          retryable: true,
        };
      }
    },
  },

  // Union type resolver
  ExportPlaylistToTidalResult: {
    __resolveType(obj: ExportPlaylistToTidalResult) {
      return obj.__typename;
    },
  },
};
