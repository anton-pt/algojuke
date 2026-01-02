/**
 * Semantic Search Tool
 *
 * Feature: 011-agent-tools
 * Updated: 013-agent-tool-optimization
 *
 * Searches indexed tracks by mood, theme, or lyrical content using
 * hybrid vector + BM25 search.
 *
 * ## Optimization (013): Two-Tier Metadata Approach
 *
 * Returns tracks with `shortDescription` (max 50 words) instead of
 * full interpretation/lyrics to reduce token usage by ~70%.
 *
 * ### When to Use batchMetadata Instead
 *
 * Use the batchMetadata tool after semanticSearch when you need:
 * - **Full lyrics** - To quote or reference specific lines
 * - **Detailed interpretation** - For in-depth thematic analysis
 * - **Artist intent** - To explain the meaning behind a track
 *
 * ### Typical Workflow
 *
 * 1. semanticSearch → Get 20+ tracks with shortDescription (scanning)
 * 2. Select 3-5 key tracks based on relevance score and shortDescription
 * 3. batchMetadata → Get full details for those 3-5 tracks (deep dive)
 *
 * This keeps the agent response fast (~70% token reduction) while
 * maintaining recommendation quality for key tracks.
 */

import { Repository } from 'typeorm';
import { DiscoveryService } from '../discoveryService.js';
import { TrackMetadataService } from '../trackMetadataService.js';
import { LibraryTrack } from '../../entities/LibraryTrack.js';
import { LibraryAlbum } from '../../entities/LibraryAlbum.js';
import { SemanticSearchInputSchema, type SemanticSearchInput } from '../../schemas/agentTools.js';
import type {
  SemanticSearchOutput,
  IndexedTrackResult,
  AudioFeatures,
  OptimizedIndexedTrackResult,
  OptimizedSemanticSearchOutput,
} from '../../types/agentTools.js';
import { isDiscoverySearchError, type DiscoverySearchResponse } from '../../types/discovery.js';
import { createToolError, type ToolError } from '../../types/agentTools.js';
import { getLibraryIsrcs } from './libraryStatus.js';
import { logger } from '../../utils/logger.js';
import { type OptimizedSearchResult } from '../../clients/qdrantClient.js';

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

/**
 * Transform optimized search results to OptimizedIndexedTrackResult
 *
 * Feature: 013-agent-tool-optimization (T007)
 *
 * Unlike enrichResults, this function uses the optimized search results
 * directly from hybridSearchOptimized without additional Qdrant calls.
 * Returns shortDescription instead of interpretation/lyrics.
 */
function enrichResultsOptimized(
  optimizedResults: OptimizedSearchResult[],
  libraryIsrcs: Set<string>
): OptimizedIndexedTrackResult[] {
  return optimizedResults.map((result) => {
    const isrc = result.isrc.toUpperCase();

    // Build audio features if any are present
    let audioFeatures: AudioFeatures | undefined;
    if (
      result.acousticness !== null ||
      result.danceability !== null ||
      result.energy !== null ||
      result.instrumentalness !== null ||
      result.key !== null ||
      result.liveness !== null ||
      result.loudness !== null ||
      result.mode !== null ||
      result.speechiness !== null ||
      result.tempo !== null ||
      result.valence !== null
    ) {
      audioFeatures = {
        acousticness: result.acousticness ?? undefined,
        danceability: result.danceability ?? undefined,
        energy: result.energy ?? undefined,
        instrumentalness: result.instrumentalness ?? undefined,
        key: result.key ?? undefined,
        liveness: result.liveness ?? undefined,
        loudness: result.loudness ?? undefined,
        mode: result.mode ?? undefined,
        speechiness: result.speechiness ?? undefined,
        tempo: result.tempo ?? undefined,
        valence: result.valence ?? undefined,
      };
    }

    return {
      isrc,
      title: result.title,
      artist: result.artist,
      album: result.album,
      artworkUrl: undefined, // Not included in optimized payload
      duration: undefined, // Not available from search
      inLibrary: libraryIsrcs.has(isrc),
      isIndexed: true as const,
      score: result.score,
      shortDescription: result.shortDescription,
      audioFeatures,
    };
  });
}

// -----------------------------------------------------------------------------
// Tool Implementation
// -----------------------------------------------------------------------------

/**
 * Execute semantic search tool (optimized)
 *
 * Feature: 013-agent-tool-optimization (T008)
 *
 * Uses hybridSearchOptimized to return shortDescription instead of
 * full interpretation/lyrics, reducing token usage by ~70%.
 *
 * For full track details, use the batchMetadata tool with specific ISRCs.
 *
 * @param input - Validated semantic search input
 * @param context - Required services and repositories
 * @returns OptimizedSemanticSearchOutput with shortDescription tracks
 * @throws ToolError on validation or service errors
 */
export async function executeSemanticSearch(
  input: SemanticSearchInput,
  context: SemanticSearchContext
): Promise<OptimizedSemanticSearchOutput> {
  const startTime = Date.now();
  const userId = context.userId || CURRENT_USER_ID;

  logger.info('semantic_search_tool_start', {
    query: input.query.slice(0, 100),
    limit: input.limit,
    optimized: true, // T010: Log that we're using optimized path
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
    // Execute OPTIMIZED hybrid search via discovery service (T008)
    // This uses hybridSearchOptimized internally, returning only shortDescription
    const discoveryResult = await context.discoveryService.searchOptimized({
      query,
      limit,
    });

    // Check for discovery errors
    // Use inline check since optimized result has different type than DiscoverySearchResult
    if ('code' in discoveryResult && 'retryable' in discoveryResult) {
      const errorResult = discoveryResult as { code: string; message: string; retryable: boolean };
      throw createToolError(
        errorResult.message,
        errorResult.retryable,
        false,
        errorResult.code
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
      'semantic_search_optimized'
    );

    // Enrich results with library status (T007)
    // Uses optimized enrichment - no additional Qdrant calls needed
    const enrichedTracks = enrichResultsOptimized(
      discoveryResult.results,
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
