/**
 * Tidal Search Tool
 *
 * Feature: 011-agent-tools
 *
 * Searches the Tidal catalogue by artist, album, or track name.
 * Returns results with library membership and vector index status flags.
 */

import { Repository } from 'typeorm';
import { TidalService } from '../tidalService.js';
import { BackendQdrantClient } from '../../clients/qdrantClient.js';
import { LibraryTrack } from '../../entities/LibraryTrack.js';
import { LibraryAlbum } from '../../entities/LibraryAlbum.js';
import { TidalSearchInputSchema, type TidalSearchInput } from '../../schemas/agentTools.js';
import type { TidalSearchOutput, TrackResult, AlbumResult } from '../../types/agentTools.js';
import { createToolError, type ToolError } from '../../types/agentTools.js';
import { getLibraryIsrcs, getLibraryAlbumIds } from './libraryStatus.js';
import { logger } from '../../utils/logger.js';
import type { SearchResults, TrackResult as TidalTrackResult, AlbumResult as TidalAlbumResult } from '../../types/graphql.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Context required for Tidal search tool execution
 */
export interface TidalSearchContext {
  tidalService: TidalService;
  qdrantClient: BackendQdrantClient;
  libraryTrackRepository: Repository<LibraryTrack>;
  libraryAlbumRepository: Repository<LibraryAlbum>;
  userId: string;
}

// Mock user ID for MVP (single-user system)
const CURRENT_USER_ID = '00000000-0000-0000-0000-000000000001';

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Transform Tidal track results to agent tool format with enrichment
 */
function transformTrackResults(
  tidalTracks: TidalTrackResult[],
  isrcMap: Map<string, string | undefined>,
  libraryIsrcs: Set<string>,
  indexedIsrcs: Map<string, boolean>
): TrackResult[] {
  return tidalTracks.map((track) => {
    // Get ISRC from the batch-fetched map
    const isrc = isrcMap.get(track.id) ?? '';
    const normalizedIsrc = isrc.toUpperCase();

    return {
      tidalId: track.id,
      isrc,
      title: track.title,
      artist: track.artist,
      album: track.albumTitle || '',
      artworkUrl: track.artworkUrl,
      duration: track.duration,
      explicit: track.explicit,
      inLibrary: normalizedIsrc.length > 0 ? libraryIsrcs.has(normalizedIsrc) : false,
      isIndexed: normalizedIsrc.length > 0 ? (indexedIsrcs.get(normalizedIsrc) ?? false) : false,
    };
  });
}

/**
 * Transform Tidal album results to agent tool format with enrichment
 */
function transformAlbumResults(
  tidalAlbums: TidalAlbumResult[],
  libraryAlbumIds: Set<string>
): AlbumResult[] {
  return tidalAlbums.map((album) => ({
    tidalId: album.id,
    title: album.title,
    artist: album.artist,
    artworkUrl: album.artworkUrl,
    releaseDate: album.releaseDate,
    trackCount: album.trackCount,
    inLibrary: libraryAlbumIds.has(album.id),
  }));
}

/**
 * Build summary message based on results
 */
function buildSummary(
  query: string,
  tracksCount: number,
  albumsCount: number,
  searchType: 'tracks' | 'albums' | 'both'
): string {
  const parts: string[] = [];

  if (searchType === 'both' || searchType === 'tracks') {
    parts.push(`${tracksCount} track${tracksCount === 1 ? '' : 's'}`);
  }

  if (searchType === 'both' || searchType === 'albums') {
    parts.push(`${albumsCount} album${albumsCount === 1 ? '' : 's'}`);
  }

  const total = tracksCount + albumsCount;
  if (total === 0) {
    return `No results found for "${query}"`;
  }

  return `Found ${parts.join(' and ')} for "${query}"`;
}

// -----------------------------------------------------------------------------
// Tool Implementation
// -----------------------------------------------------------------------------

/**
 * Execute Tidal search tool
 *
 * @param input - Validated Tidal search input
 * @param context - Required services and repositories
 * @returns TidalSearchOutput with enriched results
 * @throws ToolError on validation or service errors
 */
export async function executeTidalSearch(
  input: TidalSearchInput,
  context: TidalSearchContext
): Promise<TidalSearchOutput> {
  const startTime = Date.now();
  const userId = context.userId || CURRENT_USER_ID;

  logger.info('tidal_search_tool_start', {
    query: input.query.slice(0, 100),
    searchType: input.searchType,
    limit: input.limit,
  });

  // Validate input
  const validationResult = TidalSearchInputSchema.safeParse(input);
  if (!validationResult.success) {
    const errorMessage = validationResult.error.issues
      .map((e) => e.message)
      .join(', ');
    throw createToolError(errorMessage, false, false, 'VALIDATION_ERROR');
  }

  const { query, searchType, limit } = validationResult.data;

  try {
    // Execute Tidal search
    const searchResults: SearchResults = await context.tidalService.search(
      query,
      limit,
      0, // offset
      'US' // countryCode
    );

    // Filter results based on searchType
    let tracks: TidalTrackResult[] = [];
    let albums: TidalAlbumResult[] = [];

    if (searchType === 'tracks' || searchType === 'both') {
      tracks = searchResults.tracks;
    }
    if (searchType === 'albums' || searchType === 'both') {
      albums = searchResults.albums;
    }

    // Batch-fetch ISRCs for all track results
    // This is critical for accurate library and index status flags
    let isrcMap = new Map<string, string | undefined>();
    const trackTidalIds = tracks.map((t) => t.id);

    if (trackTidalIds.length > 0) {
      try {
        isrcMap = await context.tidalService.batchFetchTrackIsrcs(trackTidalIds);
        logger.debug('tidal_search_isrcs_fetched', {
          trackCount: trackTidalIds.length,
          isrcCount: Array.from(isrcMap.values()).filter(Boolean).length,
        });
      } catch (error) {
        logger.warn('tidal_search_isrc_fetch_failed', {
          trackCount: trackTidalIds.length,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue without ISRCs - library/index checks will fail-open
      }
    }

    // Collect all ISRCs for library and index checks
    const trackIsrcs: string[] = [];
    for (const tidalId of trackTidalIds) {
      const isrc = isrcMap.get(tidalId);
      if (isrc) {
        trackIsrcs.push(isrc.toUpperCase());
      }
    }

    // Check library status for tracks (by ISRC)
    const libraryIsrcs = await getLibraryIsrcs(
      trackIsrcs,
      context.libraryTrackRepository,
      context.libraryAlbumRepository,
      userId,
      'tidal_search'
    );

    // Check index status for tracks (by ISRC)
    let indexedIsrcs = new Map<string, boolean>();
    if (trackIsrcs.length > 0) {
      try {
        indexedIsrcs = await context.qdrantClient.checkTracksExist(trackIsrcs);
      } catch (error) {
        logger.warn('tidal_search_index_check_failed', {
          isrcCount: trackIsrcs.length,
          error: error instanceof Error ? error.message : String(error),
        });
        // Fail-open: continue with empty index status
      }
    }

    // Check library status for albums by Tidal ID
    const albumTidalIds = albums.map((a) => a.id);
    const libraryAlbumIds = await getLibraryAlbumIds(
      albumTidalIds,
      context.libraryAlbumRepository,
      userId,
      'tidal_search'
    );

    // Transform results with enrichment
    const enrichedTracks = transformTrackResults(tracks, isrcMap, libraryIsrcs, indexedIsrcs);
    const enrichedAlbums = transformAlbumResults(albums, libraryAlbumIds);

    const durationMs = Date.now() - startTime;
    const summary = buildSummary(
      query,
      searchType === 'albums' ? 0 : enrichedTracks.length,
      searchType === 'tracks' ? 0 : enrichedAlbums.length,
      searchType
    );

    logger.info('tidal_search_tool_complete', {
      query: query.slice(0, 100),
      searchType,
      tracksFound: enrichedTracks.length,
      albumsFound: enrichedAlbums.length,
      tracksWithIsrc: trackIsrcs.length,
      durationMs,
    });

    const output: TidalSearchOutput = {
      query,
      totalFound: {
        tracks: searchType === 'albums' ? 0 : searchResults.total.tracks,
        albums: searchType === 'tracks' ? 0 : searchResults.total.albums,
      },
      summary,
      durationMs,
    };

    // Only include arrays based on search type
    if (searchType === 'tracks' || searchType === 'both') {
      output.tracks = enrichedTracks;
    }
    if (searchType === 'albums' || searchType === 'both') {
      output.albums = enrichedAlbums;
    }

    return output;
  } catch (error) {
    const durationMs = Date.now() - startTime;

    // Re-throw ToolErrors
    if (error instanceof Error && 'retryable' in error) {
      logger.error('tidal_search_tool_error', {
        query: query.slice(0, 100),
        durationMs,
        error: error.message,
        retryable: (error as ToolError).retryable,
      });
      throw error;
    }

    // Check for specific Tidal API errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRateLimitError = errorMessage.toLowerCase().includes('rate limit');
    const isTimeoutError = errorMessage.toLowerCase().includes('timeout');
    const isUnavailableError = errorMessage.toLowerCase().includes('unavailable');

    logger.error('tidal_search_tool_unexpected_error', {
      query: query.slice(0, 100),
      durationMs,
      error: errorMessage,
    });

    throw createToolError(
      isRateLimitError
        ? 'Rate limit exceeded. Please wait a moment and try again.'
        : isTimeoutError
          ? 'Tidal search timed out. Please try again.'
          : 'Tidal search is temporarily unavailable',
      isRateLimitError || isTimeoutError || isUnavailableError,
      false,
      isRateLimitError ? 'RATE_LIMIT' : isTimeoutError ? 'TIMEOUT' : 'INTERNAL_ERROR'
    );
  }
}
