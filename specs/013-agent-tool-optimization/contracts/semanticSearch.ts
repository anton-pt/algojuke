/**
 * Semantic Search Tool Contract (Optimized)
 *
 * Feature: 013-agent-tool-optimization
 *
 * This contract defines the optimized input/output schemas for the
 * agent semantic search tool. The key optimization is returning
 * short_description instead of full interpretation/lyrics.
 */

import { z } from 'zod';

// -----------------------------------------------------------------------------
// Input Schema (Unchanged)
// -----------------------------------------------------------------------------

/**
 * Semantic search input parameters
 */
export const SemanticSearchInputSchema = z.object({
  /**
   * Natural language query describing the mood, theme, or characteristics
   * to search for in indexed tracks.
   */
  query: z.string().min(1).max(2000),

  /**
   * Maximum number of results to return (default: 20, max: 50)
   */
  limit: z.number().int().min(1).max(50).default(20),
});

export type SemanticSearchInput = z.infer<typeof SemanticSearchInputSchema>;

// -----------------------------------------------------------------------------
// Audio Features Schema
// -----------------------------------------------------------------------------

export const AudioFeaturesSchema = z.object({
  acousticness: z.number().min(0).max(1).optional(),
  danceability: z.number().min(0).max(1).optional(),
  energy: z.number().min(0).max(1).optional(),
  instrumentalness: z.number().min(0).max(1).optional(),
  key: z.number().int().min(-1).max(11).optional(),
  liveness: z.number().min(0).max(1).optional(),
  loudness: z.number().min(-60).max(0).optional(),
  mode: z.union([z.literal(0), z.literal(1)]).optional(),
  speechiness: z.number().min(0).max(1).optional(),
  tempo: z.number().min(0).max(250).optional(),
  valence: z.number().min(0).max(1).optional(),
});

export type AudioFeatures = z.infer<typeof AudioFeaturesSchema>;

// -----------------------------------------------------------------------------
// Optimized Track Result Schema
// -----------------------------------------------------------------------------

/**
 * Optimized track result for agent semantic search
 *
 * Key difference from IndexedTrackResult:
 * - Contains shortDescription (max 500 chars) instead of interpretation/lyrics
 * - Significantly smaller payload for reduced token usage
 */
export const OptimizedIndexedTrackResultSchema = z.object({
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

  /** Relevance score from hybrid search (0-1, higher is better) */
  score: z.number().min(0).max(1),

  /**
   * Short description of the track (max 500 chars)
   *
   * AI-generated summary from feature 012. Contains mood, theme,
   * and style information sufficient for initial filtering.
   * null if not yet backfilled.
   */
  shortDescription: z.string().max(500).nullable(),

  /** Audio features from ReccoBeats API */
  audioFeatures: AudioFeaturesSchema.optional(),
});

export type OptimizedIndexedTrackResult = z.infer<typeof OptimizedIndexedTrackResultSchema>;

// -----------------------------------------------------------------------------
// Output Schema
// -----------------------------------------------------------------------------

/**
 * Semantic search output with optimized track results
 */
export const SemanticSearchOutputSchema = z.object({
  /** Optimized track results (no interpretation/lyrics) */
  tracks: z.array(OptimizedIndexedTrackResultSchema),

  /** Original search query */
  query: z.string(),

  /** Total number of matching tracks in index */
  totalFound: z.number().int().min(0),

  /** Human-readable summary of results */
  summary: z.string(),

  /** Execution time in milliseconds */
  durationMs: z.number().int().min(0),
});

export type SemanticSearchOutput = z.infer<typeof SemanticSearchOutputSchema>;

// -----------------------------------------------------------------------------
// Field Constants
// -----------------------------------------------------------------------------

/**
 * Qdrant payload fields to request for optimized agent search
 *
 * Excludes: interpretation, lyrics (large text fields)
 * Includes: short_description (compact summary)
 */
export const AGENT_SEARCH_PAYLOAD_FIELDS = [
  'isrc',
  'title',
  'artist',
  'album',
  'short_description',
  'acousticness',
  'danceability',
  'energy',
  'instrumentalness',
  'key',
  'liveness',
  'loudness',
  'mode',
  'speechiness',
  'tempo',
  'valence',
] as const;

export type AgentSearchPayloadField = typeof AGENT_SEARCH_PAYLOAD_FIELDS[number];
