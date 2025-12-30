/**
 * Tidal API Batch Track ISRC Fetching Contract
 *
 * This file defines the TypeScript interface contract for batch fetching
 * track ISRCs from the Tidal API.
 *
 * Implementation location: backend/src/services/tidalService.ts
 */

import { z } from 'zod';

// ============================================================================
// Schemas
// ============================================================================

/**
 * Tidal track ID validation
 */
export const TidalTrackIdSchema = z.string().min(1);

/**
 * ISRC format validation (ISO 3901)
 */
export const IsrcSchema = z.string().length(12).regex(/^[A-Z0-9]{12}$/i, {
  message: 'ISRC must be 12 alphanumeric characters',
});

/**
 * Track with ISRC result
 */
export const TrackWithIsrcSchema = z.object({
  tidalId: z.string(),
  isrc: IsrcSchema.optional(),
  title: z.string().optional(),
});

export type TrackWithIsrc = z.infer<typeof TrackWithIsrcSchema>;

// ============================================================================
// Service Interface Extension
// ============================================================================

/**
 * Extension to TidalService for batch ISRC fetching
 *
 * Implementation requirements:
 * - MUST batch requests into chunks of 20 tracks (Tidal API limit)
 * - MUST use existing rate limiter and retry logic
 * - MUST handle partial failures gracefully
 * - SHOULD complete within 5 seconds for albums up to 100 tracks
 */
export interface ITidalBatchIsrcFetcher {
  /**
   * Batch fetch ISRCs for multiple tracks by Tidal ID
   *
   * @param tidalIds - Array of Tidal track IDs
   * @param countryCode - ISO country code (default: 'US')
   * @returns Map of Tidal ID to ISRC (missing entries = ISRC unavailable)
   *
   * Behavior:
   * - Chunks requests into batches of 20 tracks
   * - Uses /v2/tracks?filter[id]=id1,id2,... endpoint
   * - Extracts ISRC from track.attributes.isrc
   * - Logs warning for tracks without ISRC
   * - On batch error, logs and continues with remaining batches
   */
  batchFetchTrackIsrcs(
    tidalIds: string[],
    countryCode?: string
  ): Promise<Map<string, string>>;

  /**
   * Get album track listing with ISRCs
   *
   * @param albumId - Tidal album ID
   * @param countryCode - ISO country code (default: 'US')
   * @returns Enhanced track listing including ISRCs
   *
   * Behavior:
   * 1. Fetch album track listing (positions, titles, tidalIds)
   * 2. Batch fetch ISRCs for all tracks
   * 3. Merge ISRCs into track listing
   * 4. Return complete listing
   *
   * Note: This is an enhancement to the existing getAlbumTrackListing method
   */
  getAlbumTrackListingWithIsrcs(
    albumId: string,
    countryCode?: string
  ): Promise<TrackListingWithIsrcs>;
}

/**
 * Enhanced track listing with ISRCs
 */
export interface TrackListingWithIsrcs {
  tracks: Array<{
    position: number;
    title: string;
    duration: number;
    tidalId?: string;
    explicit?: boolean;
    isrc?: string;  // NEW: ISRC from batch fetch
  }>;
  /** Total tracks in listing */
  totalTracks: number;
  /** Tracks with valid ISRC */
  tracksWithIsrc: number;
  /** Tracks without ISRC (will be skipped for ingestion) */
  tracksWithoutIsrc: number;
}

// ============================================================================
// API Details
// ============================================================================

/**
 * Tidal Batch Tracks API Reference
 *
 * Endpoint: GET /v2/tracks
 * Parameters:
 *   - filter[id]: Comma-separated list of track IDs (max 20)
 *   - countryCode: ISO country code
 *   - include: Related resources (optional)
 *
 * Response structure:
 * {
 *   "data": [
 *     {
 *       "id": "123456",
 *       "type": "tracks",
 *       "attributes": {
 *         "title": "Track Title",
 *         "isrc": "USRC11234567",
 *         "duration": "PT3M45S",
 *         "explicit": false
 *       }
 *     }
 *   ]
 * }
 */
export const TIDAL_BATCH_TRACKS_CONFIG = {
  /** Maximum tracks per API request */
  MAX_BATCH_SIZE: 20,
  /** Request timeout in milliseconds */
  TIMEOUT_MS: 5000,
  /** Endpoint template */
  ENDPOINT: '/v2/tracks',
} as const;
