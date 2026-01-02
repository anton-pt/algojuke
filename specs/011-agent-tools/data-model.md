# Data Model: Agent Tools for Discover Chat

**Feature**: 011-agent-tools
**Date**: 2025-12-31

## Overview

This feature extends the existing chat data model to support tool invocations. No new database tables are required - tool calls are stored as content blocks within existing Message entities.

## Existing Entities (Extended)

### Message (Extended)

The `Message` entity already supports tool content blocks via its JSONB `content` column.

**Entity**: `messages` table

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| conversation_id | UUID | Foreign key to conversations |
| role | VARCHAR(20) | 'user' \| 'assistant' |
| content | JSONB | Array of ContentBlock |
| created_at | TIMESTAMP | Creation timestamp |

**ContentBlock Union Type** (already implemented):

```typescript
type ContentBlock =
  | TextBlock
  | ToolUseBlock
  | ToolResultBlock;

interface TextBlock {
  type: 'text';
  text: string;
}

interface ToolUseBlock {
  type: 'tool_use';
  id: string;           // Unique tool call ID (matches SSE toolCallId)
  name: string;         // Tool name: 'semanticSearch' | 'tidalSearch' | 'batchMetadata'
  input: ToolInput;     // Tool-specific input parameters
}

interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;  // References ToolUseBlock.id
  content: ToolOutput;  // Tool-specific output
}
```

## New Types

### Tool Input Types

```typescript
// Semantic Search Tool Input
interface SemanticSearchInput {
  query: string;        // Natural language search query
  limit?: number;       // Max results (1-50, default 20)
}

// Tidal Search Tool Input
interface TidalSearchInput {
  query: string;              // Search query text
  searchType: 'tracks' | 'albums' | 'both';  // What to search
  limit?: number;             // Max results (1-100, default 20)
}

// Batch Metadata Tool Input
interface BatchMetadataInput {
  isrcs: string[];      // Array of ISRCs (max 100)
}

// Tidal Album Tracks Tool Input
interface AlbumTracksInput {
  albumId: string;      // Tidal album ID
}

// Union of all tool inputs
type ToolInput =
  | SemanticSearchInput
  | TidalSearchInput
  | BatchMetadataInput
  | AlbumTracksInput;
```

### Tool Output Types

```typescript
// Common track metadata in results
interface TrackResult {
  isrc: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl?: string;
  duration?: number;      // Duration in seconds
  inLibrary: boolean;     // Is track in user's library?
  isIndexed: boolean;     // Is track in vector index?
  score?: number;         // Relevance score (semantic search only)
}

// Extended track with full metadata (from vector index)
interface IndexedTrackResult extends TrackResult {
  lyrics?: string;
  interpretation?: string;
  audioFeatures?: {
    acousticness?: number;
    danceability?: number;
    energy?: number;
    instrumentalness?: number;
    key?: number;
    liveness?: number;
    loudness?: number;
    mode?: number;
    speechiness?: number;
    tempo?: number;
    valence?: number;
  };
}

// Album result from Tidal search
interface AlbumResult {
  id: string;             // Tidal album ID
  title: string;
  artist: string;
  artworkUrl?: string;
  releaseDate?: string;
  trackCount: number;
  inLibrary: boolean;
}

// Semantic Search Output
interface SemanticSearchOutput {
  tracks: IndexedTrackResult[];
  query: string;
  totalFound: number;
  summary: string;        // "Found 12 tracks matching 'melancholic love songs'"
  durationMs: number;
}

// Tidal Search Output
interface TidalSearchOutput {
  tracks?: TrackResult[];
  albums?: AlbumResult[];
  query: string;
  totalFound: { tracks: number; albums: number };
  summary: string;
  durationMs: number;
}

// Batch Metadata Output
interface BatchMetadataOutput {
  tracks: IndexedTrackResult[];
  found: string[];        // ISRCs that were found
  notFound: string[];     // ISRCs that were not found
  summary: string;
  durationMs: number;
}

// Album Tracks Output
interface AlbumTracksOutput {
  albumId: string;
  albumTitle: string;
  tracks: TrackResult[];
  summary: string;
  durationMs: number;
}

// Union of all tool outputs
type ToolOutput =
  | SemanticSearchOutput
  | TidalSearchOutput
  | BatchMetadataOutput
  | AlbumTracksOutput;
```

### SSE Event Types (Extended)

```typescript
// Existing events
interface MessageStartEvent { type: 'message_start'; messageId: string; conversationId: string; }
interface TextDeltaEvent { type: 'text_delta'; content: string; }
interface MessageEndEvent { type: 'message_end'; usage: { inputTokens: number; outputTokens: number; }; }
interface ErrorEvent { type: 'error'; code: string; message: string; retryable: boolean; }

// NEW: Tool invocation events
interface ToolCallStartEvent {
  type: 'tool_call_start';
  toolCallId: string;
  toolName: 'semanticSearch' | 'tidalSearch' | 'batchMetadata' | 'albumTracks';
  input: ToolInput;
}

interface ToolCallEndEvent {
  type: 'tool_call_end';
  toolCallId: string;
  summary: string;
  resultCount: number;
  durationMs: number;
}

interface ToolCallErrorEvent {
  type: 'tool_call_error';
  toolCallId: string;
  error: string;
  retryable: boolean;
  wasRetried: boolean;
}

// Updated union
type SSEEvent =
  | MessageStartEvent
  | TextDeltaEvent
  | ToolCallStartEvent
  | ToolCallEndEvent
  | ToolCallErrorEvent
  | MessageEndEvent
  | ErrorEvent;
```

## Example: Stored Message with Tool Calls

```json
{
  "id": "msg_456",
  "conversation_id": "conv_123",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Let me search for some melancholic songs about lost love..."
    },
    {
      "type": "tool_use",
      "id": "tc_789",
      "name": "semanticSearch",
      "input": {
        "query": "melancholic songs about lost love",
        "limit": 10
      }
    },
    {
      "type": "tool_result",
      "tool_use_id": "tc_789",
      "content": {
        "tracks": [
          {
            "isrc": "USRC12345678",
            "title": "Someone Like You",
            "artist": "Adele",
            "album": "21",
            "artworkUrl": "https://...",
            "inLibrary": true,
            "isIndexed": true,
            "score": 0.95,
            "lyrics": "I heard that you're settled down...",
            "interpretation": "A poignant ballad about accepting...",
            "audioFeatures": {
              "acousticness": 0.89,
              "energy": 0.31,
              "valence": 0.18
            }
          }
        ],
        "query": "melancholic songs about lost love",
        "totalFound": 8,
        "summary": "Found 8 tracks matching 'melancholic songs about lost love'",
        "durationMs": 1234
      }
    },
    {
      "type": "text",
      "text": "I found 8 tracks that match your mood. Here are the top results:\n\n1. **Someone Like You** by Adele..."
    }
  ],
  "created_at": "2025-12-31T12:00:00Z"
}
```

## Entity Relationships

```
┌─────────────────┐       ┌─────────────────┐
│  Conversation   │       │    Message      │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │◄──────│ conversation_id │
│ user_id         │       │ id (PK)         │
│ created_at      │       │ role            │
│ updated_at      │       │ content (JSONB) │──────┐
└─────────────────┘       │ created_at      │      │
                          └─────────────────┘      │
                                                   │
                          ┌────────────────────────┘
                          │
                          ▼
              ┌───────────────────────────────────────────┐
              │         ContentBlock (JSONB Array)        │
              ├───────────────────────────────────────────┤
              │ ┌─────────┐ ┌──────────┐ ┌─────────────┐ │
              │ │TextBlock│ │ToolUse   │ │ToolResult   │ │
              │ │         │ │Block     │ │Block        │ │
              │ └─────────┘ └──────────┘ └─────────────┘ │
              └───────────────────────────────────────────┘
```

## Data Flow

### Creating a Tool Invocation

1. **Agent decides to call tool** → Vercel AI SDK emits `toolCall` event
2. **Stream tool_call_start** → Frontend shows "Searching..."
3. **Execute tool** → Backend calls appropriate service
4. **Stream tool_call_end** → Frontend shows summary
5. **Continue generation** → Agent processes results and generates text
6. **Save message** → All content blocks (text + tool_use + tool_result) saved to DB

### Loading Historical Conversation

1. **Query messages** → Load all messages for conversation
2. **Parse content blocks** → Deserialize JSONB into ContentBlock[]
3. **Render in UI** → Each content block rendered with appropriate component
4. **Expandable results** → Tool results can be expanded to show full data

## Validation Rules

### Tool Inputs

| Tool | Field | Rule |
|------|-------|------|
| semanticSearch | query | Non-empty string, max 2000 chars |
| semanticSearch | limit | 1-50, default 20 |
| tidalSearch | query | Non-empty string, max 500 chars |
| tidalSearch | searchType | 'tracks' \| 'albums' \| 'both' |
| tidalSearch | limit | 1-100, default 20 |
| batchMetadata | isrcs | 1-100 valid ISRCs (12 alphanumeric chars) |
| albumTracks | albumId | Non-empty Tidal album ID |

### Tool Outputs

- All outputs include `summary` and `durationMs` for display
- Track results always include `inLibrary` and `isIndexed` flags
- Empty results are valid (tracks: [], totalFound: 0)

## Migration

**No migration required.** The existing `messages.content` JSONB column already supports the `tool_use` and `tool_result` content block types defined in the codebase.
