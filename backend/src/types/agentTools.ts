/**
 * Agent Tools Types
 *
 * Feature: 011-agent-tools
 *
 * TypeScript types for agent tool outputs and related entities.
 */

import type {
  SemanticSearchInput,
  TidalSearchInput,
  BatchMetadataInput,
  AlbumTracksInput,
  ToolNameType,
} from '../schemas/agentTools.js';

// -----------------------------------------------------------------------------
// Audio Features
// -----------------------------------------------------------------------------

/**
 * Audio features from ReccoBeats API
 */
export interface AudioFeatures {
  acousticness?: number; // 0.0-1.0
  danceability?: number; // 0.0-1.0
  energy?: number; // 0.0-1.0
  instrumentalness?: number; // 0.0-1.0
  key?: number; // -1 to 11 (pitch class, -1 = unknown)
  liveness?: number; // 0.0-1.0
  loudness?: number; // -60 to 0 dB
  mode?: number; // 0 (minor) or 1 (major)
  speechiness?: number; // 0.0-1.0
  tempo?: number; // BPM (0-250)
  valence?: number; // 0.0-1.0 (musical positivity)
}

// -----------------------------------------------------------------------------
// Track Results
// -----------------------------------------------------------------------------

/**
 * Base track result from Tidal search
 */
export interface TrackResult {
  tidalId?: string; // Tidal track ID (may be undefined for indexed tracks)
  isrc: string; // ISO 3901 ISRC
  title: string;
  artist: string;
  album: string;
  artworkUrl?: string; // Album cover URL
  duration?: number; // Track duration in seconds
  explicit?: boolean; // Explicit content flag
  popularity?: number; // Tidal popularity score
  inLibrary: boolean; // Is track in user's library?
  isIndexed: boolean; // Is track in vector index?
}

/**
 * Extended track result from vector index with full metadata
 */
export interface IndexedTrackResult extends TrackResult {
  isIndexed: true; // Always true for semantic search results
  score: number; // Relevance score (0-1, higher is better)
  lyrics?: string; // Full lyrics text
  interpretation?: string; // AI-generated thematic interpretation
  audioFeatures?: AudioFeatures;
}

/**
 * Album result from Tidal search
 */
export interface AlbumResult {
  tidalId: string; // Tidal album ID
  title: string;
  artist: string;
  artworkUrl?: string; // Album cover URL
  releaseDate?: string; // ISO date string (YYYY-MM-DD)
  trackCount: number; // Number of tracks on album
  inLibrary: boolean; // Is album in user's library?
}

// -----------------------------------------------------------------------------
// Tool Outputs
// -----------------------------------------------------------------------------

/**
 * Base output structure for all tools
 */
interface BaseToolOutput {
  summary: string; // Human-readable summary for display
  durationMs: number; // Execution time in milliseconds
}

/**
 * Semantic Search Tool Output
 */
export interface SemanticSearchOutput extends BaseToolOutput {
  tracks: IndexedTrackResult[];
  query: string; // The original query (for display purposes)
  totalFound: number; // Total number of tracks found
}

/**
 * Tidal Search Tool Output
 */
export interface TidalSearchOutput extends BaseToolOutput {
  tracks?: TrackResult[];
  albums?: AlbumResult[];
  query: string;
  totalFound: {
    tracks: number;
    albums: number;
  };
}

/**
 * Batch Metadata Tool Output
 */
export interface BatchMetadataOutput extends BaseToolOutput {
  tracks: IndexedTrackResult[];
  found: string[]; // ISRCs that were found
  notFound: string[]; // ISRCs that were not found
}

/**
 * Album Tracks Tool Output
 */
export interface AlbumTracksOutput extends BaseToolOutput {
  albumId: string;
  albumTitle: string;
  artist: string;
  tracks: TrackResult[];
}

/**
 * Union of all tool outputs
 */
export type ToolOutput =
  | SemanticSearchOutput
  | TidalSearchOutput
  | BatchMetadataOutput
  | AlbumTracksOutput;

// -----------------------------------------------------------------------------
// SSE Event Types
// -----------------------------------------------------------------------------

/**
 * Tool call start event - sent when tool execution begins
 */
export interface ToolCallStartEvent {
  type: 'tool_call_start';
  toolCallId: string; // Unique ID for this invocation
  toolName: ToolNameType;
  input: SemanticSearchInput | TidalSearchInput | BatchMetadataInput | AlbumTracksInput;
}

/**
 * Tool call end event - sent when tool completes successfully
 */
export interface ToolCallEndEvent {
  type: 'tool_call_end';
  toolCallId: string; // Matches start event
  summary: string; // Human-readable summary
  resultCount: number; // Number of results
  durationMs: number; // Execution time
  output?: ToolOutput; // Full output for expansion (optional for display)
}

/**
 * Tool call error event - sent when tool execution fails
 */
export interface ToolCallErrorEvent {
  type: 'tool_call_error';
  toolCallId: string; // Matches start event
  error: string; // Human-readable error message
  retryable: boolean; // Whether the operation can be retried
  wasRetried: boolean; // Whether an automatic retry was already attempted
}

/**
 * Union of tool-related SSE events
 */
export type ToolSSEEvent = ToolCallStartEvent | ToolCallEndEvent | ToolCallErrorEvent;

// -----------------------------------------------------------------------------
// Tool Execution Types
// -----------------------------------------------------------------------------

/**
 * Tool execution result (internal use)
 */
export interface ToolExecutionResult<T extends ToolOutput> {
  output: T;
  wasRetried: boolean;
}

/**
 * Tool error with retry information
 */
export interface ToolError extends Error {
  retryable: boolean;
  wasRetried: boolean;
  code?: string;
}

/**
 * Create a ToolError
 */
export function createToolError(
  message: string,
  retryable: boolean,
  wasRetried: boolean,
  code?: string
): ToolError {
  const error = new Error(message) as ToolError;
  error.retryable = retryable;
  error.wasRetried = wasRetried;
  error.code = code;
  return error;
}

// -----------------------------------------------------------------------------
// Re-exports
// -----------------------------------------------------------------------------

export type {
  SemanticSearchInput,
  TidalSearchInput,
  BatchMetadataInput,
  AlbumTracksInput,
  ToolNameType,
};
