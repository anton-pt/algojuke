/**
 * Playlist Routes
 *
 * Feature: 017-tidal-playlist-export
 *
 * REST API routes for playlist export functionality.
 */

import { Router, Request, Response } from "express";
import { requireAuth, getAuth } from "../middleware/clerkAuth.js";
import {
  PlaylistExportRequestSchema,
  type PlaylistExportErrorCode,
} from "../schemas/playlist.js";
import {
  getTidalTokens,
  isTokenExpired,
  attemptTokenRefresh,
} from "../services/tidalAuthService.js";
import { TidalService } from "../services/tidalService.js";
import { logger } from "../utils/logger.js";

/**
 * Create playlist routes with injected TidalService
 */
export function createPlaylistRoutes(tidalService: TidalService): Router {
  const router = Router();

  /**
   * POST /api/playlists/export
   *
   * Export an AI-generated playlist to the user's Tidal account.
   */
  router.post("/export", requireAuth, async (req: Request, res: Response) => {
    const startTime = Date.now();
    const auth = getAuth(req);
    const userId = auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: {
          code: "no_tidal_connection" as PlaylistExportErrorCode,
          message: "User not authenticated",
          retryable: false,
        },
      });
    }

    // 1. Validate request body
    const parseResult = PlaylistExportRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      logger.warn("playlist_export_validation_failed", {
        userId,
        errors: parseResult.error.issues,
      });
      return res.status(400).json({
        error: {
          code: "validation_error" as PlaylistExportErrorCode,
          message: "Invalid request body",
          retryable: false,
          details: parseResult.error.issues,
        },
      });
    }

    const { name, tracks } = parseResult.data;

    try {
      // 2. Get user's Tidal tokens
      let tidalTokens = await getTidalTokens(userId);
      if (!tidalTokens) {
        logger.warn("playlist_export_no_tidal_connection", { userId });
        return res.status(401).json({
          error: {
            code: "no_tidal_connection" as PlaylistExportErrorCode,
            message:
              "Tidal account not connected. Please connect your Tidal account to save playlists.",
            retryable: false,
          },
        });
      }

      // 3. Check if token is expired and attempt refresh if needed
      const tokenExpired = await isTokenExpired(userId);
      if (tokenExpired) {
        logger.info("playlist_export_token_expired_attempting_refresh", {
          userId,
        });

        // Attempt server-side token refresh
        const refreshedAccessToken = await attemptTokenRefresh(userId);
        if (!refreshedAccessToken) {
          logger.warn("playlist_export_token_refresh_failed", { userId });
          return res.status(401).json({
            error: {
              code: "token_refresh_failed" as PlaylistExportErrorCode,
              message:
                "Your Tidal session has expired. Please reconnect your Tidal account.",
              retryable: false,
            },
          });
        }

        // Update tokens reference with refreshed token
        tidalTokens = { ...tidalTokens, accessToken: refreshedAccessToken };
        logger.info("playlist_export_token_refreshed", { userId });
      }

      // 4. Resolve ISRCs to Tidal track IDs
      const isrcs = tracks.map((t) => t.isrc.toUpperCase());
      const trackMap = await tidalService.batchFetchTracksByIsrc(isrcs);

      // Build list of found and not found tracks
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

      // 5. Check if any tracks were found
      if (foundTracks.length === 0) {
        logger.warn("playlist_export_no_tracks_available", {
          userId,
          trackCount: tracks.length,
        });
        return res.status(422).json({
          error: {
            code: "no_tracks_available" as PlaylistExportErrorCode,
            message:
              "None of the tracks in this playlist could be found on Tidal.",
            retryable: false,
          },
        });
      }

      // 6. Create playlist
      const playlistId = await tidalService.createPlaylist(
        name,
        tidalTokens.accessToken,
      );

      logger.info("playlist_export_playlist_created", {
        userId,
        playlistId,
        playlistName: name,
      });

      // 7. Add tracks to playlist in batches
      const trackIds = foundTracks.map((t) => t.tidalId);
      await tidalService.addTracksToPlaylist(
        playlistId,
        trackIds,
        tidalTokens.accessToken,
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

      // 8. Return success response
      return res.status(200).json({
        success: true,
        playlistId,
        playlistName: name,
        tracksAdded: foundTracks.length,
        tracksSkipped: skippedTracks.length,
        ...(skippedTracks.length > 0 && { skippedTracks }),
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      // Handle specific error types
      if (error instanceof Error) {
        // Rate limit error
        if (
          error.message.includes("rate limit") ||
          error.message.includes("429")
        ) {
          logger.warn("playlist_export_rate_limited", { userId, duration });
          return res.status(429).json({
            error: {
              code: "rate_limit_exceeded" as PlaylistExportErrorCode,
              message:
                "Tidal API rate limit reached. Please try again in a few seconds.",
              retryable: true,
              retryAfter: 5,
            },
          });
        }

        // API unavailable
        if (
          error.message.includes("unavailable") ||
          error.message.includes("503")
        ) {
          logger.error("playlist_export_tidal_unavailable", {
            userId,
            duration,
            error: error.message,
          });
          return res.status(503).json({
            error: {
              code: "tidal_unavailable" as PlaylistExportErrorCode,
              message:
                "Tidal is temporarily unavailable. Please try again later.",
              retryable: true,
            },
          });
        }
      }

      // Generic error
      logger.error("playlist_export_failed", {
        userId,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });

      return res.status(500).json({
        error: {
          code: "playlist_creation_failed" as PlaylistExportErrorCode,
          message: "Failed to create playlist. Please try again.",
          retryable: true,
        },
      });
    }
  });

  return router;
}
