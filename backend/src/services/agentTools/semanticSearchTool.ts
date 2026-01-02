/**
 * Semantic Search Tool
 *
 * Feature: 011-agent-tools
 *
 * Searches indexed tracks by mood, theme, or lyrical content using
 * hybrid vector + BM25 search. Returns tracks with full metadata
 * including lyrics, interpretation, and audio features.
 */

import { Repository } from 'typeorm';
import { DiscoveryService } from '../discoveryService.js';
import { TrackMetadataService } from '../trackMetadataService.js';
import { LibraryTrack } from '../../entities/LibraryTrack.js';
import { LibraryAlbum } from '../../entities/LibraryAlbum.js';
import { SemanticSearchInputSchema, type SemanticSearchInput } from '../../schemas/agentTools.js';
import type { SemanticSearchOutput, IndexedTrackResult, AudioFeatures } from '../../types/agentTools.js';
import { isDiscoverySearchError, type DiscoverySearchResponse } from '../../types/discovery.js';
import { createToolError, type ToolError } from '../../types/agentTools.js';
import { getLibraryIsrcs } from './libraryStatus.js';
import { logger } from '../../utils/logger.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Context required for semantic search tool execution
 */
export interface SemanticSearchContext {
  discoveryService: DiscoveryService;
  trackMetadataService: TrackMetadataService;
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
 * Transform discovery results to IndexedTrackResult with full metadata
 */
async function enrichResults(
  discoveryResults: DiscoverySearchResponse,
  trackMetadataService: TrackMetadataService,
  libraryIsrcs: Set<string>
): Promise<IndexedTrackResult[]> {
  const enrichedTracks: IndexedTrackResult[] = [];

  for (const result of discoveryResults.results) {
    const isrc = result.isrc.toUpperCase();

    // Fetch full metadata from Qdrant
    const extendedMetadata = await trackMetadataService.getExtendedMetadata(isrc);

    // Build audio features if available
    let audioFeatures: AudioFeatures | undefined;
    if (extendedMetadata?.audioFeatures) {
      const af = extendedMetadata.audioFeatures;
      if (
        af.acousticness !== null ||
        af.danceability !== null ||
        af.energy !== null ||
        af.instrumentalness !== null ||
        af.key !== null ||
        af.liveness !== null ||
        af.loudness !== null ||
        af.mode !== null ||
        af.speechiness !== null ||
        af.tempo !== null ||
        af.valence !== null
      ) {
        audioFeatures = {
          acousticness: af.acousticness ?? undefined,
          danceability: af.danceability ?? undefined,
          energy: af.energy ?? undefined,
          instrumentalness: af.instrumentalness ?? undefined,
          key: af.key ?? undefined,
          liveness: af.liveness ?? undefined,
          loudness: af.loudness ?? undefined,
          mode: af.mode ?? undefined,
          speechiness: af.speechiness ?? undefined,
          tempo: af.tempo ?? undefined,
          valence: af.valence ?? undefined,
        };
      }
    }

    enrichedTracks.push({
      isrc,
      title: result.title,
      artist: result.artist,
      album: result.album,
      artworkUrl: result.artworkUrl ?? undefined,
      duration: undefined, // Not available from discovery search
      inLibrary: libraryIsrcs.has(isrc),
      isIndexed: true,
      score: result.score,
      lyrics: extendedMetadata?.lyrics ?? undefined,
      interpretation: extendedMetadata?.interpretation ?? undefined,
      audioFeatures,
    });
  }

  return enrichedTracks;
}

// -----------------------------------------------------------------------------
// Tool Implementation
// -----------------------------------------------------------------------------

/**
 * Execute semantic search tool
 *
 * @param input - Validated semantic search input
 * @param context - Required services and repositories
 * @returns SemanticSearchOutput with enriched track results
 * @throws ToolError on validation or service errors
 */
export async function executeSemanticSearch(
  input: SemanticSearchInput,
  context: SemanticSearchContext
): Promise<SemanticSearchOutput> {
  const startTime = Date.now();
  const userId = context.userId || CURRENT_USER_ID;

  logger.info('semantic_search_tool_start', {
    query: input.query.slice(0, 100),
    limit: input.limit,
  });

  // Validate input
  const validationResult = SemanticSearchInputSchema.safeParse(input);
  if (!validationResult.success) {
    const errorMessage = validationResult.error.issues
      .map((e) => e.message)
      .join(', ');
    throw createToolError(errorMessage, false, false, 'VALIDATION_ERROR');
  }

  const { query, limit } = validationResult.data;

  try {
    // Execute hybrid search via discovery service
    const discoveryResult = await context.discoveryService.search({
      query,
      page: 0,
      pageSize: limit,
    });

    // Check for discovery errors
    if (isDiscoverySearchError(discoveryResult)) {
      const retryable = discoveryResult.retryable;
      throw createToolError(
        discoveryResult.message,
        retryable,
        false,
        discoveryResult.code
      );
    }

    // Extract ISRCs for library status check
    const isrcs = discoveryResult.results.map((r) => r.isrc.toUpperCase());

    // Check library status for all results
    const libraryIsrcs = await getLibraryIsrcs(
      isrcs,
      context.libraryTrackRepository,
      context.libraryAlbumRepository,
      userId,
      'semantic_search'
    );

    // Enrich results with full metadata and library status
    const enrichedTracks = await enrichResults(
      discoveryResult,
      context.trackMetadataService,
      libraryIsrcs
    );

    const durationMs = Date.now() - startTime;
    const totalFound = discoveryResult.totalResults;
    const summary =
      totalFound > 0
        ? `Found ${totalFound} track${totalFound === 1 ? '' : 's'} matching "${query}"`
        : `No tracks found matching "${query}"`;

    logger.info('semantic_search_tool_complete', {
      query: query.slice(0, 100),
      resultCount: enrichedTracks.length,
      totalFound,
      durationMs,
    });

    return {
      tracks: enrichedTracks,
      query,
      totalFound,
      summary,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;

    // Re-throw ToolErrors
    if (error instanceof Error && 'retryable' in error) {
      logger.error('semantic_search_tool_error', {
        query: query.slice(0, 100),
        durationMs,
        error: error.message,
        retryable: (error as ToolError).retryable,
      });
      throw error;
    }

    // Wrap unknown errors
    logger.error('semantic_search_tool_unexpected_error', {
      query: query.slice(0, 100),
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    });

    throw createToolError(
      'Vector search service is temporarily unavailable',
      true,
      false,
      'INTERNAL_ERROR'
    );
  }
}
