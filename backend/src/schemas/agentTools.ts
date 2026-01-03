/**
 * Agent Tools Schemas
 *
 * Feature: 011-agent-tools
 *
 * Zod schemas for validating agent tool inputs.
 * Used by Vercel AI SDK for type-safe tool definitions.
 */

import { z } from 'zod';

/**
 * ISRC format validation pattern.
 * ISO 3901 format: 12 alphanumeric characters.
 */
const ISRC_PATTERN = /^[A-Z0-9]{12}$/i;

/**
 * Semantic Search Tool Input Schema
 *
 * For searching indexed tracks by mood, theme, or lyrics description.
 */
export const SemanticSearchInputSchema = z.object({
  /**
   * Natural language search query describing the desired mood, theme, or content.
   * Examples:
   * - "melancholic songs about lost love"
   * - "upbeat summer vibes"
   * - "introspective late night music"
   */
  query: z
    .string()
    .min(1, 'Query cannot be empty')
    .max(2000, 'Query too long (max 2000 characters)'),

  /**
   * Maximum number of results to return.
   * Default increased to 50 (feature 013) for better initial scanning.
   */
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(50),
});

export type SemanticSearchInput = z.infer<typeof SemanticSearchInputSchema>;

/**
 * Tidal Search Tool Input Schema
 *
 * For searching the Tidal catalogue by artist, album, or track name.
 */
export const TidalSearchInputSchema = z.object({
  /**
   * Search query text (artist name, album title, track title, or combination).
   * Examples:
   * - "Radiohead"
   * - "OK Computer"
   * - "Karma Police Radiohead"
   */
  query: z
    .string()
    .min(1, 'Query cannot be empty')
    .max(500, 'Query too long (max 500 characters)'),

  /**
   * What type of content to search for.
   */
  searchType: z.enum(['tracks', 'albums', 'both']),

  /**
   * Maximum number of results per type.
   */
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20),
});

export type TidalSearchInput = z.infer<typeof TidalSearchInputSchema>;

/**
 * Batch Metadata Tool Input Schema
 *
 * For retrieving full metadata for multiple tracks by ISRC.
 */
export const BatchMetadataInputSchema = z.object({
  /**
   * Array of ISRCs (International Standard Recording Codes).
   * Each ISRC must be exactly 12 alphanumeric characters.
   * Empty array returns empty result (per US3 acceptance scenario 4).
   */
  isrcs: z
    .array(
      z
        .string()
        .regex(ISRC_PATTERN, 'Invalid ISRC format (must be 12 alphanumeric characters)')
    )
    .min(0)
    .max(100, 'Maximum 100 ISRCs per request'),
});

export type BatchMetadataInput = z.infer<typeof BatchMetadataInputSchema>;

/**
 * Album Tracks Tool Input Schema
 *
 * For retrieving all tracks from a specific album.
 */
export const AlbumTracksInputSchema = z.object({
  /**
   * Tidal album ID from a previous search result.
   */
  albumId: z.string().min(1, 'Album ID cannot be empty'),
});

export type AlbumTracksInput = z.infer<typeof AlbumTracksInputSchema>;

/**
 * Playlist Input Track Schema
 *
 * Feature: 015-playlist-suggestion
 *
 * Individual track in the playlist input from the agent.
 */
export const PlaylistInputTrackSchema = z.object({
  /**
   * International Standard Recording Code.
   * Used to look up track in Tidal catalogue.
   */
  isrc: z
    .string()
    .regex(ISRC_PATTERN, 'Invalid ISRC format (must be 12 alphanumeric characters)'),

  /**
   * Track title (fallback if Tidal lookup fails).
   */
  title: z
    .string()
    .min(1, 'Track title cannot be empty')
    .max(500, 'Track title too long (max 500 characters)'),

  /**
   * Artist name (fallback if Tidal lookup fails).
   */
  artist: z
    .string()
    .min(1, 'Artist name cannot be empty')
    .max(500, 'Artist name too long (max 500 characters)'),

  /**
   * One sentence explaining why this track was selected.
   * Displayed when user expands the track in the playlist UI.
   */
  reasoning: z
    .string()
    .min(1, 'Reasoning cannot be empty')
    .max(1000, 'Reasoning too long (max 1000 characters)'),
});

export type PlaylistInputTrack = z.infer<typeof PlaylistInputTrackSchema>;

/**
 * Suggest Playlist Tool Input Schema
 *
 * Feature: 015-playlist-suggestion
 *
 * For presenting a curated playlist to the user with visual album artwork.
 */
export const SuggestPlaylistInputSchema = z.object({
  /**
   * Descriptive title for the playlist.
   * Examples: "Upbeat Morning Mix", "Melancholic Evening Vibes"
   */
  title: z
    .string()
    .min(1, 'Playlist title cannot be empty')
    .max(200, 'Playlist title too long (max 200 characters)'),

  /**
   * Array of tracks to include in the playlist.
   * Minimum 1, maximum 50 tracks.
   */
  tracks: z
    .array(PlaylistInputTrackSchema)
    .min(1, 'Playlist must have at least 1 track')
    .max(50, 'Playlist cannot exceed 50 tracks'),
});

export type SuggestPlaylistInput = z.infer<typeof SuggestPlaylistInputSchema>;

/**
 * Union type for all tool inputs
 */
export type ToolInput =
  | SemanticSearchInput
  | TidalSearchInput
  | BatchMetadataInput
  | AlbumTracksInput
  | SuggestPlaylistInput;

/**
 * Tool name enum for type safety
 */
export const ToolName = z.enum([
  'semanticSearch',
  'tidalSearch',
  'batchMetadata',
  'albumTracks',
  'suggestPlaylist',
]);

export type ToolNameType = z.infer<typeof ToolName>;
