/**
 * Batch Metadata Tool Contract
 *
 * Feature: 013-agent-tool-optimization
 *
 * This contract defines the input/output schemas for the batch metadata tool.
 * Unlike semantic search, this tool returns FULL metadata including
 * interpretation and lyrics for detailed track analysis.
 */

import { z } from 'zod';
import { AudioFeaturesSchema } from './semanticSearch.js';

// -----------------------------------------------------------------------------
// Input Schema (Unchanged from feature 011)
// -----------------------------------------------------------------------------

/**
 * ISRC format validation
 */
const IsrcSchema = z.string().length(12).regex(/^[A-Z0-9]{12}$/i, {
  message: 'ISRC must be 12 alphanumeric characters (ISO 3901)',
});

/**
 * Batch metadata input parameters
 */
export const BatchMetadataInputSchema = z.object({
  /**
   * Array of ISRCs to retrieve metadata for (max 100)
   */
  isrcs: z.array(IsrcSchema).min(0).max(100),
});

export type BatchMetadataInput = z.infer<typeof BatchMetadataInputSchema>;

// -----------------------------------------------------------------------------
// Full Track Result Schema
// -----------------------------------------------------------------------------

/**
 * Full indexed track result with all metadata
 *
 * Includes interpretation and lyrics (unlike OptimizedIndexedTrackResult)
 * for detailed track analysis and playlist curation.
 */
export const IndexedTrackResultSchema = z.object({
  /** ISRC identifier (12 alphanumeric characters) */
  isrc: z.string().length(12).regex(/^[A-Z0-9]{12}$/i),

  /** Track title */
  title: z.string().min(1),

  /** Artist name */
  artist: z.string().min(1),

  /** Album name */
  album: z.string().min(1),

  /** Album artwork URL */
  artworkUrl: z.string().url().optional(),

  /** Track duration in seconds */
  duration: z.number().positive().optional(),

  /** Whether track is in user's library */
  inLibrary: z.boolean(),

  /** Always true for indexed tracks */
  isIndexed: z.literal(true),

  /** Relevance score (1.0 for direct lookup) */
  score: z.number().min(0).max(1),

  /**
   * Full lyrics text
   *
   * Complete lyrics from Musixmatch. null if not available (instrumental).
   */
  lyrics: z.string().optional(),

  /**
   * Full AI-generated interpretation
   *
   * Thematic analysis of the track's meaning, mood, and style.
   * null if not yet generated (rare edge case).
   */
  interpretation: z.string().optional(),

  /**
   * Short description (also included for consistency)
   *
   * Compact summary from feature 012.
   */
  shortDescription: z.string().max(500).optional(),

  /** Audio features from ReccoBeats API */
  audioFeatures: AudioFeaturesSchema.optional(),
});

export type IndexedTrackResult = z.infer<typeof IndexedTrackResultSchema>;

// -----------------------------------------------------------------------------
// Output Schema
// -----------------------------------------------------------------------------

/**
 * Batch metadata output with full track results
 */
export const BatchMetadataOutputSchema = z.object({
  /** Full track results including interpretation and lyrics */
  tracks: z.array(IndexedTrackResultSchema),

  /** ISRCs that were found in the index */
  found: z.array(z.string()),

  /** ISRCs that were not found in the index */
  notFound: z.array(z.string()),

  /** Human-readable summary of results */
  summary: z.string(),

  /** Execution time in milliseconds */
  durationMs: z.number().int().min(0),
});

export type BatchMetadataOutput = z.infer<typeof BatchMetadataOutputSchema>;
