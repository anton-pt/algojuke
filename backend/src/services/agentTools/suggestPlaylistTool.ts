/**
 * Suggest Playlist Tool
 *
 * Feature: 015-playlist-suggestion
 *
 * Enriches agent-provided playlist tracks with Tidal metadata (artwork, duration, album).
 * Returns enriched tracks for display in the PlaylistCard component.
 */

import { TidalService } from '../tidalService.js';
import {
  SuggestPlaylistInputSchema,
  type SuggestPlaylistInput,
  type PlaylistInputTrack,
} from '../../schemas/agentTools.js';
import type {
  SuggestPlaylistOutput,
  EnrichedPlaylistTrack,
} from '../../types/agentTools.js';
import { createToolError } from '../../types/agentTools.js';
import { logger } from '../../utils/logger.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Context required for suggest playlist tool execution
 */
export interface SuggestPlaylistContext {
  tidalService: TidalService;
}

/**
 * Internal track data from Tidal batch fetch
 */
interface TidalTrackData {
  tidalId: string;
  title: string;
  artist: string;
  albumId: string | null;
  duration: number | null;
}

/**
 * Internal album data from Tidal batch fetch
 */
interface TidalAlbumData {
  title: string;
  artworkUrl: string | null;
}

// -----------------------------------------------------------------------------
// ISRC Validation
// -----------------------------------------------------------------------------

/**
 * ISRC format validation pattern.
 * ISO 3901 format: 12 alphanumeric characters.
 */
const ISRC_PATTERN = /^[A-Z0-9]{12}$/i;

/**
 * Validate an ISRC and log a warning if invalid.
 *
 * @param isrc - The ISRC to validate
 * @param trackIndex - Index of the track in the playlist (for logging)
 * @param title - Track title (for logging context)
 * @returns true if valid, false if invalid
 */
function validateIsrc(isrc: string, trackIndex: number, title: string): boolean {
  if (!ISRC_PATTERN.test(isrc)) {
    logger.warn('suggest_playlist_invalid_isrc', {
      trackIndex,
      title,
      isrc,
      reason: 'ISRC must be exactly 12 alphanumeric characters',
    });
    return false;
  }
  return true;
}

// -----------------------------------------------------------------------------
// Enrichment Functions
// -----------------------------------------------------------------------------

/**
 * Enrich playlist tracks with Tidal metadata.
 *
 * Fetches track data and album artwork from Tidal API in batches of 20.
 * Falls back to agent-provided data for tracks not found in Tidal.
 *
 * @param tracks - Array of playlist tracks from agent input
 * @param tidalService - TidalService instance for API calls
 * @param retryOnFailure - Whether to retry failed batch fetches (default: true)
 * @returns Array of enriched tracks with Tidal metadata where available
 */
export async function enrichPlaylistTracks(
  tracks: PlaylistInputTrack[],
  tidalService: TidalService,
  retryOnFailure: boolean = true
): Promise<EnrichedPlaylistTrack[]> {
  // Validate ISRCs and filter valid ones for batch lookup
  const validTracks: Array<{ track: PlaylistInputTrack; index: number }> = [];
  const invalidTracks: Array<{ track: PlaylistInputTrack; index: number }> = [];

  tracks.forEach((track, index) => {
    if (validateIsrc(track.isrc, index, track.title)) {
      validTracks.push({ track, index });
    } else {
      invalidTracks.push({ track, index });
    }
  });

  logger.info('suggest_playlist_validation', {
    totalTracks: tracks.length,
    validTracks: validTracks.length,
    invalidTracks: invalidTracks.length,
  });

  // Collect valid ISRCs for batch lookup
  const validIsrcs = validTracks.map(({ track }) => track.isrc.toUpperCase());

  // Fetch track data from Tidal (with retry support)
  let trackDataMap = new Map<string, TidalTrackData>();
  if (validIsrcs.length > 0) {
    try {
      trackDataMap = await tidalService.batchFetchTracksByIsrc(validIsrcs);
    } catch (error) {
      if (retryOnFailure) {
        logger.info('suggest_playlist_tracks_retry', {
          isrcCount: validIsrcs.length,
          error: error instanceof Error ? error.message : String(error),
        });
        // Wait 1 second before retry per spec
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          trackDataMap = await tidalService.batchFetchTracksByIsrc(validIsrcs);
        } catch (retryError) {
          logger.warn('suggest_playlist_tracks_retry_failed', {
            isrcCount: validIsrcs.length,
            error: retryError instanceof Error ? retryError.message : String(retryError),
          });
          // Continue with empty map (fallback to agent data)
        }
      } else {
        logger.warn('suggest_playlist_tracks_failed', {
          isrcCount: validIsrcs.length,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // Collect album IDs for artwork fetch
  const albumIds = new Set<string>();
  trackDataMap.forEach((data) => {
    if (data.albumId) {
      albumIds.add(data.albumId);
    }
  });

  // Fetch album data from Tidal (with retry support)
  let albumDataMap = new Map<string, TidalAlbumData>();
  if (albumIds.size > 0) {
    try {
      albumDataMap = await tidalService.batchFetchAlbumsById(Array.from(albumIds));
    } catch (error) {
      if (retryOnFailure) {
        logger.info('suggest_playlist_albums_retry', {
          albumCount: albumIds.size,
          error: error instanceof Error ? error.message : String(error),
        });
        // Wait 1 second before retry per spec
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          albumDataMap = await tidalService.batchFetchAlbumsById(Array.from(albumIds));
        } catch (retryError) {
          logger.warn('suggest_playlist_albums_retry_failed', {
            albumCount: albumIds.size,
            error: retryError instanceof Error ? retryError.message : String(retryError),
          });
          // Continue with empty map (fallback to agent data)
        }
      } else {
        logger.warn('suggest_playlist_albums_failed', {
          albumCount: albumIds.size,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // Build enriched tracks maintaining original order
  const enrichedTracks: EnrichedPlaylistTrack[] = [];

  tracks.forEach((track, index) => {
    const normalizedIsrc = track.isrc.toUpperCase();
    const tidalTrack = trackDataMap.get(normalizedIsrc);

    if (tidalTrack) {
      // Track found in Tidal - enrich with metadata
      const album = tidalTrack.albumId ? albumDataMap.get(tidalTrack.albumId) : null;

      enrichedTracks.push({
        isrc: normalizedIsrc,
        title: tidalTrack.title,
        artist: tidalTrack.artist,
        album: album?.title || null,
        artworkUrl: album?.artworkUrl || null,
        duration: tidalTrack.duration,
        reasoning: track.reasoning,
        enriched: true,
        tidalId: tidalTrack.tidalId,
      });
    } else {
      // Track not found or invalid ISRC - fallback to agent data
      enrichedTracks.push({
        isrc: normalizedIsrc,
        title: track.title,
        artist: track.artist,
        album: null,
        artworkUrl: null,
        duration: null,
        reasoning: track.reasoning,
        enriched: false,
        tidalId: null,
      });
    }
  });

  return enrichedTracks;
}

// -----------------------------------------------------------------------------
// Tool Implementation
// -----------------------------------------------------------------------------

/**
 * Build summary message based on enrichment results
 */
function buildSummary(
  title: string,
  totalTracks: number,
  enrichedTracks: number,
  failedTracks: number
): string {
  if (failedTracks === 0) {
    return `Created playlist '${title}' with ${totalTracks} track${totalTracks === 1 ? '' : 's'}`;
  }
  return `Created playlist '${title}' with ${totalTracks} track${totalTracks === 1 ? '' : 's'} (${failedTracks} without artwork)`;
}

/**
 * Execute suggest playlist tool
 *
 * @param input - Validated suggest playlist input
 * @param context - Required services
 * @returns SuggestPlaylistOutput with enriched tracks
 * @throws ToolError on validation errors
 */
export async function executeSuggestPlaylist(
  input: SuggestPlaylistInput,
  context: SuggestPlaylistContext
): Promise<SuggestPlaylistOutput> {
  const startTime = Date.now();

  logger.info('suggest_playlist_tool_start', {
    title: input.title.slice(0, 100),
    trackCount: input.tracks.length,
  });

  // Validate input
  const validationResult = SuggestPlaylistInputSchema.safeParse(input);
  if (!validationResult.success) {
    const errorMessage = validationResult.error.issues
      .map((e) => e.message)
      .join(', ');

    logger.warn('suggest_playlist_validation_failed', {
      title: input.title?.slice(0, 100),
      errors: validationResult.error.issues.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });

    throw createToolError(errorMessage, false, false, 'VALIDATION_ERROR');
  }

  const { title, tracks } = validationResult.data;

  // Log empty playlist warning (still valid per schema, but unusual)
  if (tracks.length === 0) {
    logger.warn('suggest_playlist_empty', { title });
  }

  try {
    // Enrich tracks with Tidal metadata
    const enrichedTracks = await enrichPlaylistTracks(
      tracks,
      context.tidalService,
      true // retry on failure
    );

    // Calculate stats
    const enrichedCount = enrichedTracks.filter(t => t.enriched).length;
    const failedCount = enrichedTracks.length - enrichedCount;

    const durationMs = Date.now() - startTime;
    const summary = buildSummary(title, tracks.length, enrichedCount, failedCount);

    logger.info('suggest_playlist_tool_complete', {
      title: title.slice(0, 100),
      totalTracks: tracks.length,
      enrichedTracks: enrichedCount,
      failedTracks: failedCount,
      durationMs,
    });

    return {
      summary,
      durationMs,
      title,
      tracks: enrichedTracks,
      stats: {
        totalTracks: tracks.length,
        enrichedTracks: enrichedCount,
        failedTracks: failedCount,
      },
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.warn('suggest_playlist_enrichment_failed', {
      title: title.slice(0, 100),
      trackCount: tracks.length,
      durationMs,
      error: errorMessage,
    });

    // FR-016: Handle Tidal API failures by returning unenriched tracks
    // instead of throwing an error. The playlist still displays with
    // agent-provided data (title, artist) and placeholder artwork.
    const unenrichedTracks: EnrichedPlaylistTrack[] = tracks.map((track) => ({
      isrc: track.isrc.toUpperCase(),
      title: track.title,
      artist: track.artist,
      album: null,
      artworkUrl: null,
      duration: null,
      reasoning: track.reasoning,
      enriched: false,
      tidalId: null,
    }));

    const summary = buildSummary(title, tracks.length, 0, tracks.length);

    logger.info('suggest_playlist_tool_complete_unenriched', {
      title: title.slice(0, 100),
      totalTracks: tracks.length,
      enrichedTracks: 0,
      failedTracks: tracks.length,
      durationMs,
    });

    return {
      summary,
      durationMs,
      title,
      tracks: unenrichedTracks,
      stats: {
        totalTracks: tracks.length,
        enrichedTracks: 0,
        failedTracks: tracks.length,
      },
    };
  }
}
