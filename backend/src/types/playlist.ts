/**
 * Playlist Export Types
 *
 * Feature: 017-tidal-playlist-export
 *
 * TypeScript types for Tidal playlist API payloads and internal use.
 */

// ============================================================================
// Tidal API Payloads
// ============================================================================

/**
 * Payload for POST /v2/playlists (create playlist)
 */
export interface TidalPlaylistCreatePayload {
  data: {
    type: 'playlists';
    attributes: {
      name: string;
      accessType: 'UNLISTED'; // Private playlist
      description?: string;
    };
  };
}

/**
 * Response from POST /v2/playlists
 */
export interface TidalPlaylistCreateResponse {
  data: {
    id: string; // UUID of created playlist
    type: 'playlists';
    attributes: {
      name: string;
      createdAt: string; // ISO 8601
      accessType: string;
    };
  };
}

/**
 * Payload for POST /v2/playlists/{id}/relationships/items (add tracks)
 */
export interface TidalPlaylistItemsPayload {
  data: Array<{
    type: 'tracks';
    id: string; // Tidal track ID
    meta: {
      addedAt: string; // ISO 8601 datetime
    };
  }>;
}

/**
 * Response from POST /v2/playlists/{id}/relationships/items
 */
export interface TidalPlaylistItemsResponse {
  data: Array<{
    type: 'tracks';
    id: string;
  }>;
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Result of resolving ISRCs to Tidal track IDs
 */
export interface IsrcResolutionResult {
  /** Map of ISRC -> Tidal track ID for found tracks */
  found: Map<string, string>;
  /** ISRCs that could not be resolved */
  notFound: string[];
}

/**
 * Options for creating a playlist
 */
export interface CreatePlaylistOptions {
  /** Playlist name (max 150 chars) */
  name: string;
  /** User's Tidal access token */
  accessToken: string;
  /** User's country code (default: 'US') */
  countryCode?: string;
  /** Optional playlist description */
  description?: string;
}

/**
 * Options for adding tracks to a playlist
 */
export interface AddTracksOptions {
  /** Tidal playlist UUID */
  playlistId: string;
  /** Tidal track IDs to add */
  trackIds: string[];
  /** User's Tidal access token */
  accessToken: string;
  /** User's country code (default: 'US') */
  countryCode?: string;
}

/**
 * Result of playlist export operation
 */
export interface PlaylistExportResult {
  success: true;
  playlistId: string;
  playlistName: string;
  tracksAdded: number;
  tracksSkipped: number;
  skippedTracks?: Array<{
    isrc: string;
    title: string;
    artist: string;
  }>;
}
