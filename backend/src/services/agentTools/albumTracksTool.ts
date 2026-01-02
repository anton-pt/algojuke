/**
 * Album Tracks Tool
 *
 * Feature: 011-agent-tools
 *
 * Retrieves all tracks from a specific album by Tidal album ID.
 * Returns tracks with library membership and vector index status flags.
 */

import { Repository } from 'typeorm';
import { TidalService } from '../tidalService.js';
import { BackendQdrantClient } from '../../clients/qdrantClient.js';
import { LibraryTrack } from '../../entities/LibraryTrack.js';
import { LibraryAlbum } from '../../entities/LibraryAlbum.js';
import { AlbumTracksInputSchema, type AlbumTracksInput } from '../../schemas/agentTools.js';
import type { AlbumTracksOutput, TrackResult } from '../../types/agentTools.js';
import { createToolError, type ToolError } from '../../types/agentTools.js';
import { getLibraryIsrcs } from './libraryStatus.js';
import { logger } from '../../utils/logger.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Context required for album tracks tool execution
 */
export interface AlbumTracksContext {
  tidalService: TidalService;
  qdrantClient: BackendQdrantClient;
  libraryTrackRepository: Repository<LibraryTrack>;
  libraryAlbumRepository: Repository<LibraryAlbum>;
  userId: string;
}

// Mock user ID for MVP (single-user system)
const CURRENT_USER_ID = '00000000-0000-0000-0000-000000000001';

// -----------------------------------------------------------------------------
// Tool Implementation
// -----------------------------------------------------------------------------

/**
 * Execute album tracks tool
 *
 * @param input - Validated album tracks input
 * @param context - Required services and repositories
 * @returns AlbumTracksOutput with enriched track results
 * @throws ToolError on validation or service errors
 */
export async function executeAlbumTracks(
  input: AlbumTracksInput,
  context: AlbumTracksContext
): Promise<AlbumTracksOutput> {
  const startTime = Date.now();
  const userId = context.userId || CURRENT_USER_ID;

  logger.info('album_tracks_tool_start', {
    albumId: input.albumId,
  });

  // Validate input
  const validationResult = AlbumTracksInputSchema.safeParse(input);
  if (!validationResult.success) {
    const errorMessage = validationResult.error.issues
      .map((e) => e.message)
      .join(', ');
    throw createToolError(errorMessage, false, false, 'VALIDATION_ERROR');
  }

  const { albumId } = validationResult.data;

  try {
    // Fetch album metadata first
    const albumData = await context.tidalService.getAlbumById(albumId);

    // Fetch album track listing with ISRCs
    const tidalIds = await context.tidalService.getAlbumTrackListing(albumId);

    // Extract Tidal track IDs for ISRC batch fetch
    const trackTidalIds = tidalIds
      .filter(t => t.tidalId)
      .map(t => t.tidalId!);

    // Fetch ISRCs for all tracks
    let isrcMap = new Map<string, string | undefined>();
    if (trackTidalIds.length > 0) {
      try {
        isrcMap = await context.tidalService.batchFetchTrackIsrcs(trackTidalIds);
      } catch (error) {
        logger.warn('album_tracks_isrc_fetch_failed', {
          albumId,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue without ISRCs - library/index checks will fail-open
      }
    }

    // Collect all ISRCs for library and index checks
    const isrcs: string[] = [];
    for (const trackInfo of tidalIds) {
      if (trackInfo.tidalId) {
        const isrc = isrcMap.get(trackInfo.tidalId);
        if (isrc) {
          isrcs.push(isrc.toUpperCase());
        }
      }
    }

    // Check library status for all tracks
    const libraryIsrcs = await getLibraryIsrcs(
      isrcs,
      context.libraryTrackRepository,
      context.libraryAlbumRepository,
      userId,
      'album_tracks'
    );

    // Check index status for all tracks
    let indexedIsrcs = new Map<string, boolean>();
    if (isrcs.length > 0) {
      try {
        indexedIsrcs = await context.qdrantClient.checkTracksExist(isrcs);
      } catch (error) {
        logger.warn('album_tracks_index_check_failed', {
          albumId,
          isrcCount: isrcs.length,
          error: error instanceof Error ? error.message : String(error),
        });
        // Fail-open: continue with empty index status
      }
    }

    // Transform tracks with enrichment
    const tracks: TrackResult[] = tidalIds.map((trackInfo) => {
      const isrc = trackInfo.tidalId ? isrcMap.get(trackInfo.tidalId) ?? '' : '';
      const normalizedIsrc = isrc.toUpperCase();

      return {
        tidalId: trackInfo.tidalId,
        isrc,
        title: trackInfo.title,
        artist: albumData.artist.name,
        album: albumData.title,
        artworkUrl: albumData.cover,
        duration: trackInfo.duration,
        explicit: trackInfo.explicit,
        inLibrary: normalizedIsrc ? libraryIsrcs.has(normalizedIsrc) : false,
        isIndexed: normalizedIsrc ? (indexedIsrcs.get(normalizedIsrc) ?? false) : false,
      };
    });

    const durationMs = Date.now() - startTime;
    const summary = `${albumData.title} has ${tracks.length} track${tracks.length === 1 ? '' : 's'}`;

    logger.info('album_tracks_tool_complete', {
      albumId,
      albumTitle: albumData.title,
      trackCount: tracks.length,
      durationMs,
    });

    return {
      albumId,
      albumTitle: albumData.title,
      artist: albumData.artist.name,
      tracks,
      summary,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;

    // Re-throw ToolErrors
    if (error instanceof Error && 'retryable' in error) {
      logger.error('album_tracks_tool_error', {
        albumId,
        durationMs,
        error: error.message,
        retryable: (error as ToolError).retryable,
      });
      throw error;
    }

    // Check for specific error types
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isNotFoundError = errorMessage.toLowerCase().includes('not found');
    const isRateLimitError = errorMessage.toLowerCase().includes('rate limit');
    const isTimeoutError = errorMessage.toLowerCase().includes('timeout');

    logger.error('album_tracks_tool_unexpected_error', {
      albumId,
      durationMs,
      error: errorMessage,
    });

    if (isNotFoundError) {
      throw createToolError(
        `Album not found: ${albumId}`,
        false,
        false,
        'NOT_FOUND'
      );
    }

    throw createToolError(
      isRateLimitError
        ? 'Rate limit exceeded. Please wait a moment and try again.'
        : isTimeoutError
          ? 'Album fetch timed out. Please try again.'
          : 'Failed to retrieve album tracks',
      isRateLimitError || isTimeoutError,
      false,
      isRateLimitError ? 'RATE_LIMIT' : isTimeoutError ? 'TIMEOUT' : 'INTERNAL_ERROR'
    );
  }
}
