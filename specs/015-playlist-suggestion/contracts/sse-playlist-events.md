# Contract: SSE Events for Playlist Suggestion

**Feature**: 015-playlist-suggestion
**Date**: 2026-01-02
**Extends**: [011-agent-tools/contracts/sse-tool-events.md](../../011-agent-tools/contracts/sse-tool-events.md)

## Overview

This document extends the existing SSE tool event contract to support the `suggestPlaylist` tool. The event types remain the same; only the `toolName` and payload structures are extended.

---

## Extended ToolName Type

```typescript
type ToolNameType =
  | 'semanticSearch'
  | 'tidalSearch'
  | 'batchMetadata'
  | 'albumTracks'
  | 'suggestPlaylist';  // NEW
```

---

## Event Payloads for suggestPlaylist

### tool_call_start

Sent when the agent invokes the playlist suggestion tool.

```typescript
interface PlaylistToolCallStartEvent {
  type: 'tool_call_start';
  toolCallId: string;
  toolName: 'suggestPlaylist';
  input: SuggestPlaylistInput;
}
```

**Example**:

```json
{
  "type": "tool_call_start",
  "toolCallId": "tc_playlist_001",
  "toolName": "suggestPlaylist",
  "input": {
    "title": "Chill Evening Mix",
    "tracks": [
      {
        "isrc": "USRC11700019",
        "title": "Someone Like You",
        "artist": "Adele",
        "reasoning": "Emotionally powerful ballad for winding down"
      },
      {
        "isrc": "GBUM71029614",
        "title": "Mad World",
        "artist": "Gary Jules",
        "reasoning": "Hauntingly beautiful for quiet reflection"
      }
    ]
  }
}
```

### tool_call_end

Sent when enrichment completes (including partial enrichment).

```typescript
interface PlaylistToolCallEndEvent {
  type: 'tool_call_end';
  toolCallId: string;
  summary: string;
  resultCount: number;  // Number of tracks
  durationMs: number;
  output: SuggestPlaylistOutput;
}
```

**Example (Full Enrichment)**:

```json
{
  "type": "tool_call_end",
  "toolCallId": "tc_playlist_001",
  "summary": "Created playlist 'Chill Evening Mix' with 2 tracks",
  "resultCount": 2,
  "durationMs": 1823,
  "output": {
    "summary": "Created playlist 'Chill Evening Mix' with 2 tracks",
    "durationMs": 1823,
    "title": "Chill Evening Mix",
    "tracks": [
      {
        "isrc": "USRC11700019",
        "title": "Someone Like You",
        "artist": "Adele",
        "album": "21",
        "artworkUrl": "https://resources.tidal.com/images/abc/160x160.jpg",
        "duration": 285,
        "reasoning": "Emotionally powerful ballad for winding down",
        "enriched": true,
        "tidalId": "12345678"
      },
      {
        "isrc": "GBUM71029614",
        "title": "Mad World",
        "artist": "Gary Jules",
        "album": "Trading Snakeoil for Wolftickets",
        "artworkUrl": "https://resources.tidal.com/images/def/160x160.jpg",
        "duration": 188,
        "reasoning": "Hauntingly beautiful for quiet reflection",
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
}
```

**Example (Partial Enrichment)**:

```json
{
  "type": "tool_call_end",
  "toolCallId": "tc_playlist_002",
  "summary": "Created playlist 'Underground Gems' with 3 tracks (1 without artwork)",
  "resultCount": 3,
  "durationMs": 2456,
  "output": {
    "summary": "Created playlist 'Underground Gems' with 3 tracks (1 without artwork)",
    "durationMs": 2456,
    "title": "Underground Gems",
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
      },
      {
        "isrc": "ZZUN00000002",
        "title": "Another Obscure Track",
        "artist": "Another Underground Artist",
        "album": null,
        "artworkUrl": null,
        "duration": null,
        "reasoning": "Raw and authentic sound",
        "enriched": false,
        "tidalId": null
      }
    ],
    "stats": {
      "totalTracks": 3,
      "enrichedTracks": 1,
      "failedTracks": 2
    }
  }
}
```

### tool_call_error

Only sent for validation failures, NOT for partial enrichment failures.

```typescript
interface PlaylistToolCallErrorEvent {
  type: 'tool_call_error';
  toolCallId: string;
  error: string;
  retryable: boolean;
  wasRetried: boolean;
}
```

**Example (Validation Error)**:

```json
{
  "type": "tool_call_error",
  "toolCallId": "tc_playlist_003",
  "error": "Playlist must have at least 1 track",
  "retryable": false,
  "wasRetried": false
}
```

---

## Event Sequence

### Successful Playlist Creation

```
1. data: {"type":"message_start","messageId":"msg_001","conversationId":"conv_001"}
2. data: {"type":"text_delta","content":"I've put together a playlist for you based on your request:"}
3. data: {"type":"tool_call_start","toolCallId":"tc_playlist_001","toolName":"suggestPlaylist","input":{...}}
   [Backend: Fetch tracks from Tidal (chunked if > 20)]
   [Backend: Fetch albums from Tidal (chunked if > 20)]
4. data: {"type":"tool_call_end","toolCallId":"tc_playlist_001","summary":"Created playlist...",..."output":{...}}
5. data: {"type":"text_delta","content":"\n\nI hope you enjoy this selection! Let me know if you'd like to adjust it."}
6. data: {"type":"message_end","usage":{"inputTokens":500,"outputTokens":200}}
```

### Partial Enrichment (No Error Event)

```
1. data: {"type":"message_start","messageId":"msg_002","conversationId":"conv_001"}
2. data: {"type":"text_delta","content":"Here's a playlist with some underground tracks:"}
3. data: {"type":"tool_call_start","toolCallId":"tc_playlist_002","toolName":"suggestPlaylist","input":{...}}
   [Backend: Fetch tracks - some not found in Tidal]
   [Backend: Fetch albums - some missing artwork]
4. data: {"type":"tool_call_end","toolCallId":"tc_playlist_002","summary":"Created playlist 'Underground' with 5 tracks (2 without artwork)","output":{...}}
   [Note: stats.failedTracks = 2, but NO tool_call_error event]
5. data: {"type":"text_delta","content":"\n\nSome tracks are rare finds, so I couldn't fetch all the artwork."}
6. data: {"type":"message_end","usage":{...}}
```

### Validation Error

```
1. data: {"type":"message_start","messageId":"msg_003","conversationId":"conv_001"}
2. data: {"type":"text_delta","content":"Let me create a playlist for you:"}
3. data: {"type":"tool_call_start","toolCallId":"tc_playlist_003","toolName":"suggestPlaylist","input":{"title":"","tracks":[]}}
4. data: {"type":"tool_call_error","toolCallId":"tc_playlist_003","error":"Playlist must have at least 1 track","retryable":false,"wasRetried":false}
5. data: {"type":"text_delta","content":"I apologize, but I need to include at least one track in the playlist. Could you tell me what kind of music you're looking for?"}
6. data: {"type":"message_end","usage":{...}}
```

---

## Frontend Handling

### State Update on Events

```typescript
// In useChatStream.ts

case 'tool_call_start':
  if (event.toolName === 'suggestPlaylist') {
    setToolInvocations((prev) => {
      const next = new Map(prev);
      next.set(event.toolCallId, {
        toolCallId: event.toolCallId,
        toolName: 'suggestPlaylist',
        input: event.input,
        status: 'executing',
      });
      return next;
    });
    setStreamingParts((prev) => [
      ...prev,
      { type: 'tool', toolId: event.toolCallId },
    ]);
  }
  break;

case 'tool_call_end':
  if (/* matches a suggestPlaylist invocation */) {
    setToolInvocations((prev) => {
      const next = new Map(prev);
      const existing = next.get(event.toolCallId);
      next.set(event.toolCallId, {
        ...existing,
        status: 'completed',
        summary: event.summary,
        resultCount: event.resultCount,
        durationMs: event.durationMs,
        output: event.output,  // Contains full SuggestPlaylistOutput
      });
      return next;
    });
  }
  break;
```

### Rendering Decision in ToolInvocation

```tsx
// In ToolInvocation.tsx or ToolResultsRenderer

function ToolResultsRenderer({ toolName, output }: Props) {
  if (toolName === 'suggestPlaylist' && output && 'tracks' in output) {
    return (
      <PlaylistCard
        title={output.title}
        tracks={output.tracks}
        stats={output.stats}
      />
    );
  }

  // Existing rendering for other tools...
}
```

---

## Performance Requirements

| Metric | Requirement | Notes |
|--------|-------------|-------|
| **SC-001** | Playlist displays within 5s | For up to 20 tracks |
| **SC-008** | SSE events within 500ms | After enrichment completion |

The backend MUST emit `tool_call_end` immediately when enrichment completes. Enrichment includes:
1. All Tidal API calls (tracks + albums, chunked)
2. Result merging and fallback application
3. Output construction

---

## Backward Compatibility

No changes to existing event types or frontend SSE parsing. The `suggestPlaylist` tool is additive:

- Existing tools continue to work unchanged
- Frontend SSE parser handles unknown `toolName` values gracefully (falls back to generic rendering)
- Historical messages with existing tools remain valid

---

## Updated Event Union

```typescript
type SSEEvent =
  // Existing events
  | MessageStartEvent
  | TextDeltaEvent
  | MessageEndEvent
  | ErrorEvent
  // Tool events (now includes suggestPlaylist)
  | ToolCallStartEvent   // toolName can be 'suggestPlaylist'
  | ToolCallEndEvent     // output can be SuggestPlaylistOutput
  | ToolCallErrorEvent;
```
