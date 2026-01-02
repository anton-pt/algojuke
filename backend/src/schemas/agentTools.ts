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
   */
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(20),
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
 * Union type for all tool inputs
 */
export type ToolInput =
  | SemanticSearchInput
  | TidalSearchInput
  | BatchMetadataInput
  | AlbumTracksInput;

/**
 * Tool name enum for type safety
 */
export const ToolName = z.enum([
  'semanticSearch',
  'tidalSearch',
  'batchMetadata',
  'albumTracks',
]);

export type ToolNameType = z.infer<typeof ToolName>;
