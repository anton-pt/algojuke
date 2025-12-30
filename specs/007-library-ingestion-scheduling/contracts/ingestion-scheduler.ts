/**
 * Ingestion Scheduler Service Contract
 *
 * This file defines the TypeScript interface contract for the IngestionScheduler
 * service that will be implemented in backend/src/services/ingestionScheduler.ts.
 *
 * The service is responsible for scheduling track ingestion tasks when users
 * add tracks or albums to their library.
 */

import { z } from 'zod';

// ============================================================================
// Input Schemas (Zod validation at service boundary)
// ============================================================================

/**
 * Track ingestion request - data needed to schedule a single track
 */
export const TrackIngestionRequestSchema = z.object({
  /** ISO 3901 ISRC (12 alphanumeric characters) */
  isrc: z.string().length(12).regex(/^[A-Z0-9]{12}$/i, {
    message: 'ISRC must be 12 alphanumeric characters',
  }),
  /** Track title */
  title: z.string().min(1),
  /** Primary artist name */
  artist: z.string().min(1),
  /** Album name */
  album: z.string().min(1),
});

export type TrackIngestionRequest = z.infer<typeof TrackIngestionRequestSchema>;

/**
 * Album tracks ingestion request - data needed to schedule an album's tracks
 */
export const AlbumTracksIngestionRequestSchema = z.object({
  /** Album title (used for all tracks) */
  albumTitle: z.string().min(1),
  /** Primary artist name (used for all tracks) */
  artistName: z.string().min(1),
  /** Array of tracks with ISRC */
  tracks: z.array(
    z.object({
      isrc: z.string().length(12).regex(/^[A-Z0-9]{12}$/i).optional(),
      title: z.string().min(1),
    })
  ),
});

export type AlbumTracksIngestionRequest = z.infer<typeof AlbumTracksIngestionRequestSchema>;

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result of scheduling a single track
 */
export interface TrackSchedulingResult {
  /** ISRC of the track */
  isrc: string;
  /** Whether the track was scheduled for ingestion */
  scheduled: boolean;
  /** Reason if not scheduled */
  reason?: 'already_indexed' | 'invalid_isrc' | 'missing_isrc' | 'scheduling_error';
  /** Error message if scheduling failed */
  error?: string;
}

/**
 * Result of scheduling multiple tracks (album batch)
 */
export interface BatchSchedulingResult {
  /** Total tracks in request */
  total: number;
  /** Number of tracks scheduled */
  scheduled: number;
  /** Number of tracks skipped */
  skipped: number;
  /** Individual results for each track */
  results: TrackSchedulingResult[];
}

// ============================================================================
// Service Interface Contract
// ============================================================================

/**
 * IngestionScheduler service interface
 *
 * Implementation requirements:
 * - MUST check Qdrant for existing tracks before scheduling
 * - MUST use ISRC-based idempotency key when sending to Inngest
 * - MUST NOT throw exceptions that propagate to caller (fire-and-forget)
 * - MUST log all skipped tracks and scheduling errors
 * - MUST complete within 5 seconds for albums with up to 100 tracks
 */
export interface IIngestionScheduler {
  /**
   * Schedule ingestion for a single track
   *
   * @param request - Track metadata with ISRC
   * @returns Scheduling result
   *
   * Behavior:
   * - Checks if track exists in Qdrant by ISRC
   * - If not exists, sends track/ingestion.requested event to Inngest
   * - Logs result (scheduled, skipped, or error)
   * - Never throws - returns error in result object
   */
  scheduleTrack(request: TrackIngestionRequest): Promise<TrackSchedulingResult>;

  /**
   * Schedule ingestion for all tracks in an album
   *
   * @param request - Album metadata with track list
   * @returns Batch scheduling result
   *
   * Behavior:
   * - Filters out tracks without ISRC
   * - Batch checks Qdrant for existing tracks
   * - Batch sends track/ingestion.requested events for non-existing tracks
   * - Logs summary (total, scheduled, skipped)
   * - Never throws - returns errors in results array
   */
  scheduleAlbumTracks(request: AlbumTracksIngestionRequest): Promise<BatchSchedulingResult>;

  /**
   * Check if tracks exist in the vector index
   *
   * @param isrcs - Array of ISRCs to check
   * @returns Map of ISRC to existence boolean
   *
   * Behavior:
   * - Queries Qdrant by ISRC-derived UUIDs
   * - On Qdrant error, returns empty map (fail-open)
   */
  checkTracksExist(isrcs: string[]): Promise<Map<string, boolean>>;
}

// ============================================================================
// Inngest Event Schema (Backend-side definition)
// ============================================================================

/**
 * Event sent to Inngest to trigger track ingestion
 *
 * Must match schema in services/worker/src/inngest/events.ts
 */
export const InngestTrackIngestionEventSchema = z.object({
  name: z.literal('track/ingestion.requested'),
  data: TrackIngestionRequestSchema.extend({
    /** Priority modifier (-600 to +600) */
    priority: z.number().int().min(-600).max(600).optional(),
    /** Force re-ingestion even if idempotency key exists */
    force: z.boolean().optional(),
  }),
});

export type InngestTrackIngestionEvent = z.infer<typeof InngestTrackIngestionEventSchema>;
