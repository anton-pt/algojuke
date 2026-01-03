# Research: Playlist Suggestion Agent Tool

**Feature**: 015-playlist-suggestion
**Date**: 2026-01-02

## 1. Existing Agent Tool Patterns

### Decision: Follow established tool definition pattern from 011-agent-tools

**Rationale**: The codebase has a well-established pattern for agent tools that handles validation, retry, tracing, SSE events, and persistence. Reusing this pattern ensures consistency and reduces implementation risk.

**Existing Pattern (from `chatStreamService.ts`)**:

```typescript
const toolName = tool({
  description: 'Tool description for agent...',
  inputSchema: ToolInputSchema,  // Zod schema
  execute: async (input, options) => {
    const toolCallId = options.toolCallId;

    // 1. Track for persistence
    context.toolCallsMap.set(toolCallId, { name: 'toolName', input });

    // 2. Emit SSE start event
    context.onEvent({
      type: 'tool_call_start',
      toolCallId,
      toolName: 'toolName',
      input,
    });

    // 3. Create tracing span
    const span = createToolSpan(context.trace, { toolName: 'toolName', toolCallId, input });
    const startTime = Date.now();

    try {
      // 4. Execute with retry wrapper
      const { result, wasRetried } = await executeWithRetry(
        async () => executeToolFunction(input, toolContext),
        'toolName'
      );

      const durationMs = Date.now() - startTime;

      // 5. End span and track result
      span.endSuccess({ summary, resultCount, durationMs, metadata: { wasRetried } });
      context.toolResultsMap.set(toolCallId, result);

      // 6. Emit SSE end event
      context.onEvent({
        type: 'tool_call_end',
        toolCallId,
        summary,
        resultCount,
        durationMs,
        output: result,
      });

      return result;
    } catch (error) {
      // 7. Handle error with span closure and SSE error event
      span.endError({ error, retryable, wasRetried, durationMs });
      context.onEvent({ type: 'tool_call_error', ... });
      throw error;
    }
  },
});
```

**Alternatives Considered**:
- Custom tool implementation outside SDK: Rejected - would bypass streaming, tracing, persistence infrastructure
- Simplified tool without retry: Rejected - Tidal API calls may have transient failures

---

## 2. Tidal API Batch Endpoints

### Decision: Use existing `batchFetchTracks` and `batchFetchAlbums` patterns with chunking

**Rationale**: The Tidal API limits batch requests to 20 IDs. The existing `batchFetchAlbums` method already handles chunking. We'll apply the same pattern to tracks.

**Existing Album Batch Pattern (from `tidalService.ts`)**:

```typescript
private async batchFetchAlbums(albumIds: string[], countryCode: string, token: string) {
  const BATCH_SIZE = 20;  // Tidal API limit
  const chunks: string[][] = [];

  for (let i = 0; i < albumIds.length; i += BATCH_SIZE) {
    chunks.push(albumIds.slice(i, i + BATCH_SIZE));
  }

  // Process chunks sequentially (rate limiter handles throttling)
  for (const chunk of chunks) {
    const chunkResults = await this.fetchAlbumBatch(chunk, countryCode, token);
    // Merge results...
  }
}
```

**Track Batch API**:
- Endpoint: `GET /v2/tracks`
- Query: `filter[isrc]=ISRC1,ISRC2,...&include=albums&countryCode=US`
- Limit: 20 ISRCs per request (same as albums)
- Returns: Track data with album relationships

**Album Batch API**:
- Endpoint: `GET /v2/albums`
- Query: `filter[id]=ID1,ID2,...&include=artists,coverArt&countryCode=US`
- Limit: 20 album IDs per request
- Returns: Album data with artwork URLs (640x640 preferred, fallback to available)

**Alternatives Considered**:
- Single track lookups: Rejected - too many API calls for 50-track playlists
- Parallel batch calls: Rejected - would bypass rate limiter, risk 429 errors
- Pre-caching artwork: Rejected - over-engineering for current scale

---

## 3. Artwork Size Selection

### Decision: Request 160x160px artwork via URL parameter

**Rationale**: Per spec clarification, 160x160px was chosen as the display size. Tidal provides multiple artwork sizes (80, 160, 320, 640, 1280). We'll fetch the 160px version or construct the URL from the base artwork URL.

**Artwork URL Pattern**:

The Tidal API returns artwork files in the `included` resources:
```json
{
  "type": "artworks",
  "id": "abc123",
  "attributes": {
    "files": [
      { "href": "https://resources.tidal.com/images/.../160x160.jpg", "meta": { "width": 160, "height": 160 } },
      { "href": "https://resources.tidal.com/images/.../640x640.jpg", "meta": { "width": 640, "height": 640 } }
    ]
  }
}
```

**Implementation**: Find the 160x160 file, or fallback to the smallest available size.

**Alternatives Considered**:
- 640x640 with CSS scaling: Rejected - larger payload, slower SSE
- Dynamic size selection: Rejected - over-engineering, 160px is fixed per spec

---

## 4. SSE Event Extension

### Decision: Reuse existing SSE event types with `toolName: 'suggestPlaylist'`

**Rationale**: The existing `tool_call_start`, `tool_call_end`, `tool_call_error` event types are designed to be tool-agnostic. Adding a new tool only requires adding to the `ToolNameType` enum and handling the output shape.

**Existing Event Types (from 011-agent-tools)**:

```typescript
type ToolCallStartEvent = {
  type: 'tool_call_start';
  toolCallId: string;
  toolName: 'semanticSearch' | 'tidalSearch' | 'batchMetadata' | 'albumTracks' | 'suggestPlaylist';  // Add new
  input: unknown;
};

type ToolCallEndEvent = {
  type: 'tool_call_end';
  toolCallId: string;
  summary: string;
  resultCount: number;
  durationMs: number;
  output?: SuggestPlaylistOutput;  // New output type
};
```

**Alternatives Considered**:
- New event type `playlist_created`: Rejected - breaks consistency, requires frontend changes to SSE parser
- Custom streaming (not SSE): Rejected - infrastructure already exists for SSE

---

## 5. Playlist Display Component

### Decision: Create new `PlaylistCard` component, render from `ToolInvocation` when `toolName === 'suggestPlaylist'`

**Rationale**: The playlist display is significantly different from generic tool results (requires album art grid, accordion expansion for reasoning, custom styling). A dedicated component provides better maintainability.

**Integration Point (ToolInvocation.tsx)**:

```tsx
// In ToolResultsRenderer
if (toolName === 'suggestPlaylist' && 'playlist' in data) {
  return <PlaylistCard playlist={data.playlist} title={data.title} />;
}
```

**PlaylistCard Features**:
- Title header
- Track rows with 160x160 artwork (or placeholder)
- Artist/title text
- Click to expand reasoning (single expansion mode)
- Smooth accordion animation

**Alternatives Considered**:
- Extend generic ToolResultsRenderer: Rejected - too different from track/album lists, would bloat component
- Separate rendering path in ChatMessage: Rejected - duplicates tool invocation state management

---

## 6. Persistence Strategy

### Decision: Store enriched playlist in `tool_result` content block

**Rationale**: Historical conversations should display playlists with artwork immediately. Storing only agent input would require re-fetching from Tidal on every load (slow, may fail).

**Content Block Structure**:

```typescript
// tool_use block (agent input)
{
  type: 'tool_use',
  id: 'tc_abc123',
  name: 'suggestPlaylist',
  input: {
    title: 'Workout Mix',
    tracks: [
      { isrc: 'USRC12345678', title: 'Song', artist: 'Artist', reasoning: 'High energy beat' },
      ...
    ]
  }
}

// tool_result block (enriched output)
{
  type: 'tool_result',
  tool_use_id: 'tc_abc123',
  content: {
    title: 'Workout Mix',
    tracks: [
      {
        isrc: 'USRC12345678',
        title: 'Song',
        artist: 'Artist',
        album: 'Album Name',
        artworkUrl: 'https://resources.tidal.com/images/.../160x160.jpg',
        duration: 210,
        reasoning: 'High energy beat',
        enriched: true
      },
      ...
    ],
    summary: 'Created playlist "Workout Mix" with 10 tracks',
    durationMs: 2345
  }
}
```

**Alternatives Considered**:
- Store only agent input, fetch on load: Rejected - slow, may fail if Tidal unavailable
- Store base64 encoded images: Rejected - massive payload size, impractical

---

## 7. Retry and Fallback Strategy

### Decision: Single retry with 1s delay, then graceful degradation using agent-provided data

**Rationale**: Per spec clarification (FR-009a), retry once before fallback. Matches existing tool retry pattern. Never emit `tool_call_error` for partial enrichment failures.

**Retry Flow**:

```
1. Call Tidal /tracks with ISRCs (chunked by 20)
   - Success: Continue to step 2
   - Failure: Wait 1s, retry once
     - Retry success: Continue to step 2
     - Retry failure: Mark tracks as unenriched, continue

2. Call Tidal /albums with album IDs (chunked by 20)
   - Success: Attach artwork URLs
   - Failure: Wait 1s, retry once
     - Retry success: Attach artwork URLs
     - Retry failure: Tracks show placeholder artwork

3. Emit tool_call_end with available data (never tool_call_error)
```

**Alternatives Considered**:
- Multiple retries: Rejected - increases latency, existing pattern uses single retry
- Fail entire playlist on any error: Rejected - spec requires graceful degradation (FR-009, FR-016)

---

## 8. Tool Description for Agent

### Decision: Clear description emphasizing when to use and required fields

**Rationale**: The agent must understand this tool is for presenting final playlist recommendations, not for searching. It requires pre-validated ISRCs and reasoning.

**Proposed Description**:

```
Present a curated playlist to the user with visual album artwork and track details.

WHEN TO USE: After you have finalized a playlist recommendation and want to present it visually.
Do NOT use this for searching - use semanticSearch or tidalSearch instead.

REQUIRED INPUT:
- title: A descriptive playlist title (e.g., "Upbeat Morning Mix", "Melancholic Evening Vibes")
- tracks: Array of 1-50 tracks, each with:
  - isrc: The track's ISRC (12 alphanumeric characters, e.g., "USRC12345678")
  - title: Track title
  - artist: Artist name
  - reasoning: One sentence explaining why this track fits the playlist theme

The system will enrich each track with album artwork and metadata from Tidal.
If a track cannot be found on Tidal, it will still appear with your provided title/artist.
```

**Alternatives Considered**:
- Minimal description: Rejected - agent may misuse tool for search
- Very detailed description: Rejected - token overhead, agent already understands tools

---

## Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tool pattern | Reuse 011-agent-tools pattern | Consistency, infrastructure reuse |
| Tidal batching | 20-ID chunks, sequential | API limit compliance, rate limiter |
| Artwork size | 160x160px | Per spec clarification, balance quality/payload |
| SSE events | Reuse existing types | No frontend parser changes needed |
| Playlist display | New PlaylistCard component | Distinct UI from generic tool results |
| Persistence | Store enriched data | Fast historical load, no re-fetch |
| Retry strategy | Single retry, graceful fallback | Per spec FR-009a, never error on partial |
| Agent description | Clear purpose, required fields | Prevent misuse as search tool |
