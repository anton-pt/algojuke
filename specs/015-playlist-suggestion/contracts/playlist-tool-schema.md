# Contract: Playlist Suggestion Tool Schema

**Feature**: 015-playlist-suggestion
**Date**: 2026-01-02
**Extends**: [011-agent-tools](../../011-agent-tools/contracts/)

## Overview

This document defines the input/output contract for the `suggestPlaylist` agent tool. The tool enables the chat agent to present visually rich playlist suggestions with album artwork and expandable track reasoning.

---

## Tool Definition

### Tool Name

`suggestPlaylist`

### Description (for Agent)

```text
Present a curated playlist to the user with visual album artwork and track details.

WHEN TO USE: After you have finalized a playlist recommendation and want to present it visually.
Do NOT use this for searching - use semanticSearch or tidalSearch instead.

REQUIRED INPUT:
- title: A descriptive playlist title (e.g., "Upbeat Morning Mix", "Melancholic Evening Vibes")
- tracks: Array of 1-50 tracks, each with:
  - isrc: The track's ISRC (12 alphanumeric characters)
  - title: Track title
  - artist: Artist name
  - reasoning: One sentence explaining why this track fits the playlist theme

The system will enrich each track with album artwork and metadata from Tidal.
If a track cannot be found on Tidal, it will still appear with your provided title/artist.
```

---

## Input Schema

### Zod Definition

```typescript
import { z } from 'zod';

/**
 * ISRC format validation pattern.
 * ISO 3901 format: 12 alphanumeric characters.
 */
const ISRC_PATTERN = /^[A-Z0-9]{12}$/i;

/**
 * Individual track in the playlist input.
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

/**
 * Playlist Suggestion Tool Input Schema.
 */
export const SuggestPlaylistInputSchema = z.object({
  /**
   * Descriptive title for the playlist.
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

export type PlaylistInputTrack = z.infer<typeof PlaylistInputTrackSchema>;
export type SuggestPlaylistInput = z.infer<typeof SuggestPlaylistInputSchema>;
```

### Example Input

```json
{
  "title": "Melancholic Evening Vibes",
  "tracks": [
    {
      "isrc": "USRC11700019",
      "title": "Someone Like You",
      "artist": "Adele",
      "reasoning": "Emotionally powerful ballad with themes of lost love and longing"
    },
    {
      "isrc": "GBUM71029614",
      "title": "Mad World",
      "artist": "Gary Jules",
      "reasoning": "Hauntingly beautiful cover that captures melancholic introspection"
    },
    {
      "isrc": "USEE10900306",
      "title": "The Scientist",
      "artist": "Coldplay",
      "reasoning": "Wistful melody and regretful lyrics perfect for evening reflection"
    }
  ]
}
```

---

## Output Schema

### TypeScript Definition

```typescript
/**
 * Enriched track in the playlist output.
 */
export interface EnrichedPlaylistTrack {
  /** ISRC from input */
  isrc: string;

  /** Track title (from Tidal if enriched, from input otherwise) */
  title: string;

  /** Artist name (from Tidal if enriched, from input otherwise) */
  artist: string;

  /** Album name from Tidal (null if not enriched) */
  album: string | null;

  /** Album artwork URL, 160x160px (null if not available) */
  artworkUrl: string | null;

  /** Track duration in seconds (null if not available) */
  duration: number | null;

  /** Agent's reasoning for including this track (from input) */
  reasoning: string;

  /** Whether track was successfully enriched from Tidal */
  enriched: boolean;

  /** Tidal track ID (null if not enriched) */
  tidalId: string | null;
}

/**
 * Playlist Suggestion Tool Output.
 */
export interface SuggestPlaylistOutput {
  /** Human-readable summary for SSE event */
  summary: string;

  /** Execution time in milliseconds */
  durationMs: number;

  /** Playlist title (from input) */
  title: string;

  /** Enriched tracks with Tidal metadata */
  tracks: EnrichedPlaylistTrack[];

  /** Statistics for observability */
  stats: {
    totalTracks: number;
    enrichedTracks: number;
    failedTracks: number;
  };
}
```

### Example Output

```json
{
  "summary": "Created playlist 'Melancholic Evening Vibes' with 3 tracks",
  "durationMs": 1823,
  "title": "Melancholic Evening Vibes",
  "tracks": [
    {
      "isrc": "USRC11700019",
      "title": "Someone Like You",
      "artist": "Adele",
      "album": "21",
      "artworkUrl": "https://resources.tidal.com/images/abc123/160x160.jpg",
      "duration": 285,
      "reasoning": "Emotionally powerful ballad with themes of lost love and longing",
      "enriched": true,
      "tidalId": "12345678"
    },
    {
      "isrc": "GBUM71029614",
      "title": "Mad World",
      "artist": "Gary Jules",
      "album": "Trading Snakeoil for Wolftickets",
      "artworkUrl": "https://resources.tidal.com/images/def456/160x160.jpg",
      "duration": 188,
      "reasoning": "Hauntingly beautiful cover that captures melancholic introspection",
      "enriched": true,
      "tidalId": "23456789"
    },
    {
      "isrc": "USEE10900306",
      "title": "The Scientist",
      "artist": "Coldplay",
      "album": "A Rush of Blood to the Head",
      "artworkUrl": "https://resources.tidal.com/images/ghi789/160x160.jpg",
      "duration": 309,
      "reasoning": "Wistful melody and regretful lyrics perfect for evening reflection",
      "enriched": true,
      "tidalId": "34567890"
    }
  ],
  "stats": {
    "totalTracks": 3,
    "enrichedTracks": 3,
    "failedTracks": 0
  }
}
```

### Example Output (Partial Enrichment)

When some tracks cannot be found on Tidal:

```json
{
  "summary": "Created playlist 'Indie Deep Cuts' with 3 tracks (1 without artwork)",
  "durationMs": 2456,
  "title": "Indie Deep Cuts",
  "tracks": [
    {
      "isrc": "USRC12345678",
      "title": "Known Track",
      "artist": "Known Artist",
      "album": "Known Album",
      "artworkUrl": "https://resources.tidal.com/images/xyz/160x160.jpg",
      "duration": 245,
      "reasoning": "Great indie vibes",
      "enriched": true,
      "tidalId": "45678901"
    },
    {
      "isrc": "ZZUN00000001",
      "title": "Obscure Track",
      "artist": "Underground Artist",
      "album": null,
      "artworkUrl": null,
      "duration": null,
      "reasoning": "Hidden gem from the underground scene",
      "enriched": false,
      "tidalId": null
    }
  ],
  "stats": {
    "totalTracks": 2,
    "enrichedTracks": 1,
    "failedTracks": 1
  }
}
```

---

## Validation Errors

### Input Validation Errors

When the agent provides invalid input, the tool returns an error (not a partial result):

| Condition | Error Message |
|-----------|---------------|
| Empty title | "Playlist title cannot be empty" |
| Title > 200 chars | "Playlist title too long (max 200 characters)" |
| No tracks | "Playlist must have at least 1 track" |
| > 50 tracks | "Playlist cannot exceed 50 tracks" |
| Invalid ISRC format | "Invalid ISRC format (must be 12 alphanumeric characters)" |
| Empty track title | "Track title cannot be empty" |
| Empty artist name | "Artist name cannot be empty" |
| Empty reasoning | "Reasoning cannot be empty" |

Validation errors result in `tool_call_error` SSE event with `retryable: false`.

---

## Backend Implementation Contract

### Required Methods

```typescript
interface SuggestPlaylistContext {
  tidalService: TidalService;
  tokenService: TidalTokenService;
  userId: string;
  trace: LangfuseTrace | null;
}

/**
 * Execute the playlist suggestion tool.
 *
 * @param input - Validated SuggestPlaylistInput
 * @param context - Services and context
 * @returns SuggestPlaylistOutput with enriched tracks
 * @throws ToolError on validation failure (not on partial enrichment)
 */
async function executeSuggestPlaylist(
  input: SuggestPlaylistInput,
  context: SuggestPlaylistContext
): Promise<SuggestPlaylistOutput>;
```

### Tidal API Calls

The tool makes the following Tidal API calls:

1. **Batch Tracks** (`GET /v2/tracks`):
   - Query: `filter[isrc]=ISRC1,ISRC2,...&include=albums&countryCode=US`
   - Limit: 20 ISRCs per request (chunked if > 20 tracks)
   - Purpose: Get track details and album IDs

2. **Batch Albums** (`GET /v2/albums`):
   - Query: `filter[id]=ID1,ID2,...&include=artists,coverArt&countryCode=US`
   - Limit: 20 album IDs per request (chunked if > 20 albums)
   - Purpose: Get album artwork URLs (160x160px preferred)

### Rate Limiting

- Uses existing `RateLimiter` (default: 2 req/s, max 3 concurrent)
- Retry once with 1s delay on transient failures
- Sequential chunked requests (not parallel)

---

## Frontend Implementation Contract

### PlaylistCard Component Props

```typescript
interface PlaylistCardProps {
  /** Playlist title */
  title: string;

  /** Enriched tracks */
  tracks: EnrichedPlaylistTrack[];

  /** Statistics (optional, for display) */
  stats?: {
    totalTracks: number;
    enrichedTracks: number;
    failedTracks: number;
  };
}
```

### Rendering Behavior

| Condition | Behavior |
|-----------|----------|
| `toolName === 'suggestPlaylist'` | Render PlaylistCard instead of generic results |
| `status === 'executing'` | Show "Building playlist..." with spinner |
| `status === 'completed'` | Show full playlist card with tracks |
| `status === 'failed'` | Show error message (generic ToolInvocation behavior) |
| `artworkUrl === null` | Show placeholder image (160x160 gray box with music icon) |
| Track clicked | Expand accordion to show reasoning, collapse others |

### Accessibility

- Track rows are keyboard navigable (Tab, Enter/Space to expand)
- `aria-expanded` attribute on expandable rows
- `aria-controls` linking to reasoning panel
- Focus management on expand/collapse

---

## Observability

### Langfuse Tracing

```typescript
// Span metadata
{
  toolName: 'suggestPlaylist',
  toolCallId: 'tc_abc123',
  input: {
    title: 'Playlist Title',
    trackCount: 10,
    isrcs: ['ISRC1', 'ISRC2', ...],  // Truncated if > 10
  },
  output: {
    summary: '...',
    resultCount: 10,
    enrichedCount: 8,
    failedCount: 2,
  },
  durationMs: 2345,
  metadata: {
    wasRetried: false,
    tidalApiCalls: 4,  // 2 for tracks, 2 for albums (if chunked)
  }
}
```

### Logging

```typescript
// Start
logger.info('suggest_playlist_start', { title, trackCount });

// Tidal batch calls
logger.info('suggest_playlist_tracks_batch', { batchNumber, batchSize, total });
logger.info('suggest_playlist_albums_batch', { batchNumber, batchSize, total });

// Completion
logger.info('suggest_playlist_complete', {
  title,
  totalTracks,
  enrichedTracks,
  failedTracks,
  durationMs,
});

// Errors (only for validation failures)
logger.warn('suggest_playlist_validation_error', { error: message });
```
