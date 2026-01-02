/**
 * Batch Metadata Tool
 *
 * Feature: 011-agent-tools
 *
 * Retrieves full metadata for multiple tracks by ISRC.
 * Efficiently fetches lyrics, interpretation, and audio features
 * for up to 100 tracks in a single operation.
 */

import { Repository } from 'typeorm';
import { BackendQdrantClient } from '../../clients/qdrantClient.js';
import { LibraryTrack } from '../../entities/LibraryTrack.js';
import { LibraryAlbum } from '../../entities/LibraryAlbum.js';
import { BatchMetadataInputSchema, type BatchMetadataInput } from '../../schemas/agentTools.js';
import type { BatchMetadataOutput, IndexedTrackResult, AudioFeatures } from '../../types/agentTools.js';
import { createToolError, type ToolError } from '../../types/agentTools.js';
import { getLibraryIsrcs } from './libraryStatus.js';
import { logger } from '../../utils/logger.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Context required for batch metadata tool execution
 */
export interface BatchMetadataContext {
  qdrantClient: BackendQdrantClient;
  libraryTrackRepository: Repository<LibraryTrack>;
  libraryAlbumRepository: Repository<LibraryAlbum>;
  userId: string;
}

// Mock user ID for MVP (single-user system)
const CURRENT_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * ISRC format pattern: 12 alphanumeric characters (ISO 3901)
 */
const ISRC_PATTERN = /^[A-Z0-9]{12}$/i;

/**
 * Validate ISRCs and return list of malformed ones
 */
function findMalformedIsrcs(isrcs: string[]): string[] {
  return isrcs.filter((isrc) => !ISRC_PATTERN.test(isrc));
}

// -----------------------------------------------------------------------------
// Tool Implementation
// -----------------------------------------------------------------------------

/**
 * Execute batch metadata tool
 *
 * @param input - Validated batch metadata input (array of ISRCs)
 * @param context - Required services and repositories
 * @returns BatchMetadataOutput with track results and found/notFound lists
 * @throws ToolError on validation or service errors
 */
export async function executeBatchMetadata(
  input: BatchMetadataInput,
  context: BatchMetadataContext
): Promise<BatchMetadataOutput> {
  const startTime = Date.now();
  const userId = context.userId || CURRENT_USER_ID;

  logger.info('batch_metadata_tool_start', {
    isrcCount: input.isrcs.length,
  });

  // Check for array size limit first (before individual validation)
  if (input.isrcs.length > 100) {
    throw createToolError(
      `Maximum 100 ISRCs per request (received ${input.isrcs.length}). Please split into multiple requests.`,
      false,
      false,
      'VALIDATION_ERROR'
    );
  }

  // Find malformed ISRCs and provide specific error message
  const malformedIsrcs = findMalformedIsrcs(input.isrcs);
  if (malformedIsrcs.length > 0) {
    // Limit the number of examples shown to avoid overly long error messages
    const exampleCount = Math.min(malformedIsrcs.length, 5);
    const examples = malformedIsrcs.slice(0, exampleCount);
    const moreCount = malformedIsrcs.length - exampleCount;

    let errorMessage = `Invalid ISRC format (must be 12 alphanumeric characters): ${examples.map((i) => `"${i}"`).join(', ')}`;
    if (moreCount > 0) {
      errorMessage += ` and ${moreCount} more`;
    }

    logger.warn('batch_metadata_invalid_isrcs', {
      totalCount: input.isrcs.length,
      malformedCount: malformedIsrcs.length,
      examples,
    });

    throw createToolError(errorMessage, false, false, 'VALIDATION_ERROR');
  }

  // Run full schema validation for any other issues
  const validationResult = BatchMetadataInputSchema.safeParse(input);
  if (!validationResult.success) {
    const errorMessage = validationResult.error.issues
      .map((e) => e.message)
      .join(', ');
    throw createToolError(errorMessage, false, false, 'VALIDATION_ERROR');
  }

  const { isrcs } = validationResult.data;

  // Handle empty input (per spec: return empty result without error)
  if (isrcs.length === 0) {
    return {
      tracks: [],
      found: [],
      notFound: [],
      summary: 'No ISRCs provided',
      durationMs: Date.now() - startTime,
    };
  }

  // Normalize ISRCs
  const normalizedIsrcs = isrcs.map((isrc) => isrc.toUpperCase());

  try {
    // Fetch metadata for all ISRCs concurrently
    const metadataPromises = normalizedIsrcs.map(async (isrc) => {
      const payload = await context.qdrantClient.getTrackPayload(isrc);
      return { isrc, payload };
    });

    const metadataResults = await Promise.all(metadataPromises);

    // Separate found and not found
    const foundIsrcs: string[] = [];
    const notFoundIsrcs: string[] = [];
    const foundPayloads: { isrc: string; payload: NonNullable<Awaited<ReturnType<typeof context.qdrantClient.getTrackPayload>>> }[] = [];

    for (const result of metadataResults) {
      if (result.payload) {
        foundIsrcs.push(result.isrc);
        foundPayloads.push({ isrc: result.isrc, payload: result.payload });
      } else {
        notFoundIsrcs.push(result.isrc);
      }
    }

    // Check library status for found tracks
    const libraryIsrcs = await getLibraryIsrcs(
      foundIsrcs,
      context.libraryTrackRepository,
      context.libraryAlbumRepository,
      userId,
      'batch_metadata'
    );

    // Build enriched track results
    const tracks: IndexedTrackResult[] = foundPayloads.map(({ isrc, payload }) => {
      // Build audio features if available
      let audioFeatures: AudioFeatures | undefined;
      if (
        payload.acousticness !== null ||
        payload.danceability !== null ||
        payload.energy !== null ||
        payload.instrumentalness !== null ||
        payload.key !== null ||
        payload.liveness !== null ||
        payload.loudness !== null ||
        payload.mode !== null ||
        payload.speechiness !== null ||
        payload.tempo !== null ||
        payload.valence !== null
      ) {
        audioFeatures = {
          acousticness: payload.acousticness ?? undefined,
          danceability: payload.danceability ?? undefined,
          energy: payload.energy ?? undefined,
          instrumentalness: payload.instrumentalness ?? undefined,
          key: payload.key ?? undefined,
          liveness: payload.liveness ?? undefined,
          loudness: payload.loudness ?? undefined,
          mode: payload.mode ?? undefined,
          speechiness: payload.speechiness ?? undefined,
          tempo: payload.tempo ?? undefined,
          valence: payload.valence ?? undefined,
        };
      }

      return {
        isrc,
        title: payload.title,
        artist: payload.artist,
        album: payload.album,
        artworkUrl: undefined, // Not stored in Qdrant payload
        duration: undefined, // Not available from Qdrant
        inLibrary: libraryIsrcs.has(isrc),
        isIndexed: true,
        score: 1.0, // Direct lookup, not a search result
        lyrics: payload.lyrics ?? undefined,
        interpretation: payload.interpretation ?? undefined,
        audioFeatures,
      };
    });

    const durationMs = Date.now() - startTime;

    // Build summary
    let summary: string;
    if (foundIsrcs.length === normalizedIsrcs.length) {
      summary = `Found metadata for all ${foundIsrcs.length} track${foundIsrcs.length === 1 ? '' : 's'}`;
    } else if (foundIsrcs.length === 0) {
      summary = `No tracks found for ${notFoundIsrcs.length} ISRC${notFoundIsrcs.length === 1 ? '' : 's'}`;
    } else {
      summary = `Found ${foundIsrcs.length} of ${normalizedIsrcs.length} tracks (${notFoundIsrcs.length} not indexed)`;
    }

    logger.info('batch_metadata_tool_complete', {
      requestedCount: normalizedIsrcs.length,
      foundCount: foundIsrcs.length,
      notFoundCount: notFoundIsrcs.length,
      durationMs,
    });

    return {
      tracks,
      found: foundIsrcs,
      notFound: notFoundIsrcs,
      summary,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;

    // Re-throw ToolErrors
    if (error instanceof Error && 'retryable' in error) {
      logger.error('batch_metadata_tool_error', {
        isrcCount: normalizedIsrcs.length,
        durationMs,
        error: error.message,
        retryable: (error as ToolError).retryable,
      });
      throw error;
    }

    // Wrap unknown errors
    logger.error('batch_metadata_tool_unexpected_error', {
      isrcCount: normalizedIsrcs.length,
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    });

    throw createToolError(
      'Metadata service is temporarily unavailable',
      true,
      false,
      'INTERNAL_ERROR'
    );
  }
}
