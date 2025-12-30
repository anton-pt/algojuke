/**
 * GraphQL resolvers for Track Metadata Display feature
 *
 * Feature: 008-track-metadata-display
 * Date: 2025-12-30
 *
 * Provides:
 * - getExtendedTrackMetadata query resolver
 * - isIndexed field resolver for LibraryTrack type
 * - isIndexed field resolver for TrackInfo type
 */

import { GraphQLError } from 'graphql';
import { TrackMetadataService } from '../services/trackMetadataService.js';
import { IsrcDataLoader } from '../loaders/isrcDataLoader.js';
import { logger } from '../utils/logger.js';

/**
 * Context type for track metadata resolvers
 */
interface TrackMetadataContext {
  trackMetadataService: TrackMetadataService;
  isrcDataLoader: IsrcDataLoader;
}

/**
 * LibraryTrack parent type (from library resolver)
 * Contains metadata with optional ISRC
 */
interface LibraryTrackParent {
  id: string;
  metadata?: {
    isrc?: string;
  };
}

/**
 * TrackInfo parent type (from album track listing)
 * May have ISRC directly on the object
 */
interface TrackInfoParent {
  position: number;
  title: string;
  duration: number;
  isrc?: string;
  tidalId?: string;
}

/**
 * Result type for batch indexed status check
 */
interface IndexedStatusResult {
  isrc: string;
  isIndexed: boolean;
}

/**
 * GraphQL resolvers for track metadata
 */
export const trackMetadataResolvers = {
  Query: {
    /**
     * Retrieve extended metadata for a single track by ISRC
     *
     * Returns null if track not found, ISRC invalid, or Qdrant unavailable.
     */
    getExtendedTrackMetadata: async (
      _parent: unknown,
      args: { isrc: string },
      context: TrackMetadataContext
    ) => {
      const { isrc } = args;

      try {
        const metadata = await context.trackMetadataService.getExtendedMetadata(isrc);

        if (!metadata) {
          // Return null (not an error) - track not found or not indexed
          return null;
        }

        return metadata;
      } catch (error) {
        logger.error('get_extended_track_metadata_resolver_error', {
          isrc,
          error: error instanceof Error ? error.message : String(error),
        });

        // For unexpected errors, throw GraphQL error
        throw new GraphQLError('Failed to fetch extended track metadata', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    /**
     * Check indexed status for multiple tracks by ISRC (batch operation)
     *
     * FR-017: System MUST provide a backend endpoint to check indexed status
     * for a list of track identifiers (batch lookup).
     *
     * Returns indexed status for each provided ISRC.
     * Fail-open: If Qdrant is unavailable, returns all tracks as not indexed.
     */
    checkIndexedStatus: async (
      _parent: unknown,
      args: { isrcs: string[] },
      context: TrackMetadataContext
    ): Promise<IndexedStatusResult[]> => {
      const { isrcs } = args;

      if (isrcs.length === 0) {
        return [];
      }

      try {
        const statusMap = await context.trackMetadataService.checkIsIndexed(isrcs);

        // Return results in the same order as input, with normalized ISRCs
        return isrcs.map((isrc) => ({
          isrc: isrc.toUpperCase(),
          isIndexed: statusMap.get(isrc.toUpperCase()) ?? false,
        }));
      } catch (error) {
        logger.error('check_indexed_status_resolver_error', {
          isrcCount: isrcs.length,
          error: error instanceof Error ? error.message : String(error),
        });

        // Fail-open: return all as not indexed on error
        return isrcs.map((isrc) => ({
          isrc: isrc.toUpperCase(),
          isIndexed: false,
        }));
      }
    },
  },

  /**
   * Field resolvers for LibraryTrack type
   * Extends the existing LibraryTrack with isIndexed field
   */
  LibraryTrack: {
    /**
     * Resolve isIndexed field for LibraryTrack
     *
     * Uses DataLoader for efficient batching when resolving
     * multiple tracks in a single request.
     *
     * Returns false if:
     * - Track has no ISRC in metadata
     * - Track is not in the vector index
     * - Qdrant is unavailable (fail-open)
     */
    isIndexed: async (
      parent: LibraryTrackParent,
      _args: unknown,
      context: TrackMetadataContext
    ): Promise<boolean> => {
      const isrc = parent.metadata?.isrc;

      if (!isrc) {
        // No ISRC means track cannot be indexed
        return false;
      }

      try {
        return await context.isrcDataLoader.load(isrc);
      } catch (error) {
        logger.warn('library_track_is_indexed_error', {
          trackId: parent.id,
          isrc,
          error: error instanceof Error ? error.message : String(error),
        });
        // Fail-open: return false on error
        return false;
      }
    },
  },

  /**
   * Field resolvers for TrackInfo type
   * Extends the existing TrackInfo (album track listing) with isIndexed field
   */
  TrackInfo: {
    /**
     * Resolve isIndexed field for TrackInfo (album track listing)
     *
     * Uses DataLoader for efficient batching when resolving
     * multiple tracks in an album's track listing.
     *
     * Returns false if:
     * - Track has no ISRC
     * - Track is not in the vector index
     * - Qdrant is unavailable (fail-open)
     */
    isIndexed: async (
      parent: TrackInfoParent,
      _args: unknown,
      context: TrackMetadataContext
    ): Promise<boolean> => {
      const isrc = parent.isrc;

      if (!isrc) {
        // No ISRC means track cannot be indexed
        return false;
      }

      try {
        return await context.isrcDataLoader.load(isrc);
      } catch (error) {
        logger.warn('track_info_is_indexed_error', {
          title: parent.title,
          isrc,
          error: error instanceof Error ? error.message : String(error),
        });
        // Fail-open: return false on error
        return false;
      }
    },
  },
};
