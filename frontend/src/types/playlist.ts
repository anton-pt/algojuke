/**
 * Playlist Types
 *
 * Feature: 017-tidal-playlist-export
 *
 * Shared types for playlist export functionality.
 */

/**
 * Track data for export request
 */
export interface TrackForExport {
  isrc: string;
  title: string;
  artist: string;
}

/**
 * Track that was skipped because it couldn't be found on Tidal
 */
export interface SkippedTrack {
  isrc: string;
  title: string;
  artist: string;
}

/**
 * Result of a successful playlist export
 */
export interface ExportPlaylistResult {
  playlistId: string;
  playlistName: string;
  tracksAdded: number;
  tracksSkipped: number;
  skippedTracks?: SkippedTrack[];
}

/**
 * Error from playlist export operation
 */
export interface PlaylistExportError {
  code: string;
  message: string;
  retryable?: boolean;
  retryAfter?: number;
}
