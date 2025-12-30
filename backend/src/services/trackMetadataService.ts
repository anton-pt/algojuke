/**
 * Track Metadata Service
 *
 * Feature: 008-track-metadata-display
 * Date: 2025-12-30
 *
 * Provides business logic for retrieving extended track metadata
 * from the Qdrant vector index.
 */

import { BackendQdrantClient } from '../clients/qdrantClient.js';
import { logger } from '../utils/logger.js';
import {
  ExtendedTrackMetadata,
  transformPayloadToMetadata,
} from '../types/trackMetadata.js';

/**
 * ISRC validation regex: 12 alphanumeric characters
 */
const ISRC_REGEX = /^[A-Z0-9]{12}$/i;

/**
 * Validates ISRC format
 * @param isrc - ISRC to validate
 * @returns true if valid ISRC format
 */
function isValidIsrc(isrc: string): boolean {
  return ISRC_REGEX.test(isrc);
}

/**
 * Service for retrieving extended track metadata from Qdrant
 */
export class TrackMetadataService {
  private qdrantClient: BackendQdrantClient;

  constructor(qdrantClient: BackendQdrantClient) {
    this.qdrantClient = qdrantClient;
  }

  /**
   * Get extended metadata for a single track by ISRC
   *
   * Retrieves lyrics, interpretation, and audio features from Qdrant.
   * Returns null if track not found or ISRC is invalid.
   *
   * @param isrc - Track ISRC (12 alphanumeric characters)
   * @returns ExtendedTrackMetadata or null
   */
  async getExtendedMetadata(isrc: string): Promise<ExtendedTrackMetadata | null> {
    const normalizedIsrc = isrc.toUpperCase();

    // Validate ISRC format
    if (!isValidIsrc(normalizedIsrc)) {
      logger.debug('track_metadata_invalid_isrc', { isrc: normalizedIsrc });
      return null;
    }

    try {
      const payload = await this.qdrantClient.getTrackPayload(normalizedIsrc);

      if (!payload) {
        logger.debug('track_metadata_not_found', { isrc: normalizedIsrc });
        return null;
      }

      return transformPayloadToMetadata(payload);
    } catch (error) {
      logger.error('track_metadata_fetch_error', {
        isrc: normalizedIsrc,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Check indexed status for multiple ISRCs (batch operation)
   *
   * Used by DataLoader for efficient batching of isIndexed field resolution.
   * Filters out null/undefined ISRCs and returns a map of ISRC -> boolean.
   *
   * @param isrcs - Array of ISRCs to check
   * @returns Map of ISRC to indexed status
   */
  async checkIsIndexed(isrcs: (string | null | undefined)[]): Promise<Map<string, boolean>> {
    // Filter out null/undefined ISRCs
    const validIsrcs = isrcs.filter(
      (isrc): isrc is string => isrc != null && typeof isrc === 'string' && isrc.length > 0
    );

    if (validIsrcs.length === 0) {
      return new Map();
    }

    try {
      return await this.qdrantClient.checkTracksExist(validIsrcs);
    } catch (error) {
      logger.error('check_indexed_error', {
        isrcCount: validIsrcs.length,
        error: error instanceof Error ? error.message : String(error),
      });
      // Fail-open: return empty map (all tracks assumed not indexed)
      return new Map();
    }
  }
}
