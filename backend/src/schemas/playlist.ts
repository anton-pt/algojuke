/**
 * Playlist Export Schemas
 *
 * Feature: 017-tidal-playlist-export
 *
 * Zod schemas for playlist export request/response validation.
 */

import { z } from 'zod';

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * Track data for export request
 */
export const TrackForExportSchema = z.object({
  isrc: z.string().regex(/^[A-Z0-9]{12}$/i, 'Invalid ISRC format (must be 12 alphanumeric characters)'),
  title: z.string().min(1, 'Track title is required'),
  artist: z.string().min(1, 'Artist name is required'),
});

/**
 * Playlist export request body
 * POST /api/playlists/export
 */
export const PlaylistExportRequestSchema = z.object({
  name: z.string().trim().min(1, 'Playlist name is required').max(150, 'Playlist name must be 150 characters or less'),
  tracks: z.array(TrackForExportSchema).min(1, 'At least one track is required').max(50, 'Maximum 50 tracks per playlist'),
});

export type PlaylistExportRequest = z.infer<typeof PlaylistExportRequestSchema>;
export type TrackForExport = z.infer<typeof TrackForExportSchema>;

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Skipped track details (track not found on Tidal)
 */
export const SkippedTrackSchema = z.object({
  isrc: z.string(),
  title: z.string(),
  artist: z.string(),
});

export type SkippedTrack = z.infer<typeof SkippedTrackSchema>;

/**
 * Successful playlist export response
 */
export const PlaylistExportResponseSchema = z.object({
  success: z.literal(true),
  playlistId: z.string().uuid(),
  playlistName: z.string(),
  tracksAdded: z.number().int().nonnegative(),
  tracksSkipped: z.number().int().nonnegative(),
  skippedTracks: z.array(SkippedTrackSchema).optional(),
});

export type PlaylistExportResponse = z.infer<typeof PlaylistExportResponseSchema>;

// ============================================================================
// Error Schemas
// ============================================================================

/**
 * Error codes for playlist export failures
 */
export const PlaylistExportErrorCode = z.enum([
  'validation_error',
  'no_tidal_connection',
  'token_refresh_failed',
  'no_tracks_available',
  'playlist_creation_failed',
  'rate_limit_exceeded',
  'tidal_unavailable',
]);

export type PlaylistExportErrorCode = z.infer<typeof PlaylistExportErrorCode>;

/**
 * Error response for playlist export
 */
export const PlaylistExportErrorSchema = z.object({
  error: z.object({
    code: PlaylistExportErrorCode,
    message: z.string(),
    retryable: z.boolean(),
    details: z.array(z.any()).optional(),
    retryAfter: z.number().optional(),
  }),
});

export type PlaylistExportError = z.infer<typeof PlaylistExportErrorSchema>;
