# Data Model: Playlist Suggestion Agent Tool

**Feature**: 015-playlist-suggestion
**Date**: 2026-01-02

## Overview

This document defines the data structures for the playlist suggestion tool, including agent input, enriched output, and persistence formats.

---

## 1. Tool Input Schema

### SuggestPlaylistInput

The data provided by the agent when invoking the `suggestPlaylist` tool.

```typescript
interface SuggestPlaylistInput {
  /**
   * Descriptive title for the playlist.
   * Examples: "Upbeat Morning Mix", "Melancholic Evening Vibes"
   */
  title: string;  // min 1, max 200 characters

  /**
   * Array of tracks to include in the playlist.
   * Each track must have a valid ISRC and reasoning.
   */
  tracks: PlaylistInputTrack[];  // min 1, max 50 items
}

interface PlaylistInputTrack {
  /**
   * International Standard Recording Code.
   * Format: 12 alphanumeric characters (ISO 3901)
   */
  isrc: string;  // regex: /^[A-Z0-9]{12}$/i

  /**
   * Track title as known by the agent.
   * Used as fallback if Tidal lookup fails.
   */
  title: string;  // min 1, max 500 characters

  /**
   * Artist name as known by the agent.
   * Used as fallback if Tidal lookup fails.
   */
  artist: string;  // min 1, max 500 characters

  /**
   * One sentence explaining why this track was selected.
   * Displayed when user expands the track in the playlist UI.
   */
  reasoning: string;  // min 1, max 1000 characters
}
```

### Zod Schema

```typescript
const PlaylistInputTrackSchema = z.object({
  isrc: z.string().regex(/^[A-Z0-9]{12}$/i, 'Invalid ISRC format'),
  title: z.string().min(1).max(500),
  artist: z.string().min(1).max(500),
  reasoning: z.string().min(1).max(1000),
});

const SuggestPlaylistInputSchema = z.object({
  title: z.string().min(1).max(200),
  tracks: z.array(PlaylistInputTrackSchema).min(1).max(50),
});
```

---

## 2. Enriched Output Schema

### SuggestPlaylistOutput

The complete playlist data after Tidal API enrichment, returned to the agent and streamed to the frontend.

```typescript
interface SuggestPlaylistOutput {
  /**
   * Human-readable summary for SSE event.
   * Example: "Created playlist 'Workout Mix' with 10 tracks"
   */
  summary: string;

  /**
   * Execution time in milliseconds.
   */
  durationMs: number;

  /**
   * Playlist title (from input).
   */
  title: string;

  /**
   * Enriched tracks with Tidal metadata.
   */
  tracks: EnrichedPlaylistTrack[];

  /**
   * Statistics for observability.
   */
  stats: {
    totalTracks: number;      // Total tracks in input
    enrichedTracks: number;   // Tracks successfully enriched from Tidal
    failedTracks: number;     // Tracks that fell back to agent data
  };
}

interface EnrichedPlaylistTrack {
  /**
   * ISRC from input.
   */
  isrc: string;

  /**
   * Track title - from Tidal if enriched, from input otherwise.
   */
  title: string;

  /**
   * Artist name - from Tidal if enriched, from input otherwise.
   */
  artist: string;

  /**
   * Album name from Tidal. Null if not enriched.
   */
  album: string | null;

  /**
   * Album artwork URL (160x160px). Null if not available.
   * Frontend should display placeholder when null.
   */
  artworkUrl: string | null;

  /**
   * Track duration in seconds. Null if not available.
   */
  duration: number | null;

  /**
   * Agent's reasoning for including this track (from input).
   * Displayed in accordion expansion.
   */
  reasoning: string;

  /**
   * Whether this track was successfully enriched from Tidal.
   * false = using agent-provided fallback data.
   */
  enriched: boolean;

  /**
   * Tidal track ID if available. Null if not enriched.
   * May be useful for future playback integration.
   */
  tidalId: string | null;
}
```

---

## 3. Persistence Schema

### Content Blocks

Playlists are persisted as part of the Message entity's `content` JSONB array, using the existing `tool_use` and `tool_result` block pattern.

```typescript
// Message.content: ContentBlock[]

// Tool invocation (agent input)
interface ToolUseBlock {
  type: 'tool_use';
  id: string;         // toolCallId, e.g., "tc_abc123"
  name: 'suggestPlaylist';
  input: SuggestPlaylistInput;
}

// Tool result (enriched output)
interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;  // Matches ToolUseBlock.id
  content: SuggestPlaylistOutput;
}
```

### Example Persisted Message

```json
{
  "id": "msg_xyz789",
  "conversationId": "conv_abc123",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "I've put together a workout playlist for you based on your request for high-energy tracks:"
    },
    {
      "type": "tool_use",
      "id": "tc_def456",
      "name": "suggestPlaylist",
      "input": {
        "title": "High Energy Workout",
        "tracks": [
          {
            "isrc": "USRC12345678",
            "title": "Lose Yourself",
            "artist": "Eminem",
            "reasoning": "Iconic motivational track with powerful lyrics about seizing the moment"
          },
          {
            "isrc": "GBUM71029604",
            "title": "Can't Hold Us",
            "artist": "Macklemore & Ryan Lewis",
            "reasoning": "Upbeat tempo and triumphant energy perfect for cardio"
          }
        ]
      }
    },
    {
      "type": "tool_result",
      "tool_use_id": "tc_def456",
      "content": {
        "summary": "Created playlist 'High Energy Workout' with 2 tracks",
        "durationMs": 1845,
        "title": "High Energy Workout",
        "tracks": [
          {
            "isrc": "USRC12345678",
            "title": "Lose Yourself",
            "artist": "Eminem",
            "album": "8 Mile: Music from and Inspired by the Motion Picture",
            "artworkUrl": "https://resources.tidal.com/images/abc/160x160.jpg",
            "duration": 326,
            "reasoning": "Iconic motivational track with powerful lyrics about seizing the moment",
            "enriched": true,
            "tidalId": "12345678"
          },
          {
            "isrc": "GBUM71029604",
            "title": "Can't Hold Us",
            "artist": "Macklemore & Ryan Lewis",
            "album": "The Heist",
            "artworkUrl": "https://resources.tidal.com/images/def/160x160.jpg",
            "duration": 258,
            "reasoning": "Upbeat tempo and triumphant energy perfect for cardio",
            "enriched": true,
            "tidalId": "23456789"
          }
        ],
        "stats": {
          "totalTracks": 2,
          "enrichedTracks": 2,
          "failedTracks": 0
        }
      }
    },
    {
      "type": "text",
      "text": "I hope this playlist helps power your workout! Let me know if you'd like to add more tracks or adjust the selection."
    }
  ],
  "createdAt": "2026-01-02T10:30:00.000Z"
}
```

---

## 4. SSE Event Payloads

### tool_call_start

Sent when the agent invokes the playlist tool.

```typescript
{
  type: 'tool_call_start',
  toolCallId: 'tc_def456',
  toolName: 'suggestPlaylist',
  input: {
    title: 'High Energy Workout',
    tracks: [
      { isrc: 'USRC12345678', title: 'Lose Yourself', artist: 'Eminem', reasoning: '...' },
      // ... more tracks
    ]
  }
}
```

### tool_call_end

Sent when enrichment completes (success or partial).

```typescript
{
  type: 'tool_call_end',
  toolCallId: 'tc_def456',
  summary: "Created playlist 'High Energy Workout' with 10 tracks",
  resultCount: 10,  // Number of tracks
  durationMs: 2345,
  output: {
    // Full SuggestPlaylistOutput
    title: 'High Energy Workout',
    tracks: [...],
    stats: { totalTracks: 10, enrichedTracks: 8, failedTracks: 2 },
    summary: "...",
    durationMs: 2345
  }
}
```

### tool_call_error

Only sent for complete failures (not partial enrichment failures).

```typescript
{
  type: 'tool_call_error',
  toolCallId: 'tc_def456',
  error: 'Playlist generation failed: Invalid input format',
  retryable: false,
  wasRetried: false
}
```

---

## 5. Frontend State

### PlaylistDisplayState

Local component state for the PlaylistCard.

```typescript
interface PlaylistDisplayState {
  /**
   * Currently expanded track ISRC. Null if none expanded.
   * Only one track can be expanded at a time (single expansion mode).
   */
  expandedTrackIsrc: string | null;
}
```

### ToolInvocationProps Extension

The existing `ToolInvocationProps` type is unchanged. The `output` field will contain `SuggestPlaylistOutput` when `toolName === 'suggestPlaylist'`.

```typescript
interface ToolInvocationProps {
  toolCallId: string;
  toolName: string;  // Will be 'suggestPlaylist'
  input: unknown;    // Will be SuggestPlaylistInput
  status: 'executing' | 'completed' | 'failed';
  summary?: string;
  resultCount?: number;
  output?: unknown;  // Will be SuggestPlaylistOutput
  error?: string;
  durationMs?: number;
}
```

---

## 6. Type Extensions

### ToolName Enum Addition

```typescript
// In schemas/agentTools.ts
export const ToolName = z.enum([
  'semanticSearch',
  'tidalSearch',
  'batchMetadata',
  'albumTracks',
  'suggestPlaylist',  // NEW
]);
```

### ToolOutput Union Extension

```typescript
// In types/agentTools.ts
export type ToolOutput =
  | SemanticSearchOutput
  | OptimizedSemanticSearchOutput
  | TidalSearchOutput
  | BatchMetadataOutput
  | AlbumTracksOutput
  | SuggestPlaylistOutput;  // NEW
```

### ToolInput Union Extension

```typescript
// In schemas/agentTools.ts
export type ToolInput =
  | SemanticSearchInput
  | TidalSearchInput
  | BatchMetadataInput
  | AlbumTracksInput
  | SuggestPlaylistInput;  // NEW
```

---

## 7. Entity Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                         Message                                  │
│  (PostgreSQL via TypeORM)                                       │
├─────────────────────────────────────────────────────────────────┤
│  id: string                                                     │
│  conversationId: string                                         │
│  role: 'user' | 'assistant'                                     │
│  content: ContentBlock[]  ─────────────────────────────┐        │
│  createdAt: Date                                       │        │
└─────────────────────────────────────────────────────────┼───────┘
                                                          │
                                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ContentBlock (Union)                          │
├─────────────────────────────────────────────────────────────────┤
│  TextBlock { type: 'text', text: string }                       │
│  ToolUseBlock { type: 'tool_use', id, name, input }             │
│  ToolResultBlock { type: 'tool_result', tool_use_id, content }  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ When name === 'suggestPlaylist'
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  SuggestPlaylistInput                            │
├─────────────────────────────────────────────────────────────────┤
│  title: string                                                  │
│  tracks: PlaylistInputTrack[]                                   │
│    ├── isrc: string                                             │
│    ├── title: string                                            │
│    ├── artist: string                                           │
│    └── reasoning: string                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Enriched via Tidal API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 SuggestPlaylistOutput                            │
├─────────────────────────────────────────────────────────────────┤
│  title: string                                                  │
│  summary: string                                                │
│  durationMs: number                                             │
│  stats: { totalTracks, enrichedTracks, failedTracks }           │
│  tracks: EnrichedPlaylistTrack[]                                │
│    ├── isrc: string                                             │
│    ├── title: string (Tidal or fallback)                        │
│    ├── artist: string (Tidal or fallback)                       │
│    ├── album: string | null                                     │
│    ├── artworkUrl: string | null (160x160)                      │
│    ├── duration: number | null                                  │
│    ├── reasoning: string (from input)                           │
│    ├── enriched: boolean                                        │
│    └── tidalId: string | null                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| `title` | 1-200 characters | "Playlist title must be 1-200 characters" |
| `tracks` | 1-50 items | "Playlist must have 1-50 tracks" |
| `tracks[].isrc` | 12 alphanumeric | "Invalid ISRC format (must be 12 alphanumeric characters)" |
| `tracks[].title` | 1-500 characters | "Track title must be 1-500 characters" |
| `tracks[].artist` | 1-500 characters | "Artist name must be 1-500 characters" |
| `tracks[].reasoning` | 1-1000 characters | "Reasoning must be 1-1000 characters" |

All validation is performed at the Zod schema level before tool execution.
