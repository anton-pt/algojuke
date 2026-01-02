# Tool Contract: Tidal Catalogue Search

**Feature**: 011-agent-tools
**Date**: 2025-12-31

## Overview

The Tidal search tool allows the chat agent to search the Tidal music catalogue by artist, album, or track name. Results include library membership and vector index status flags.

---

## Tool Definition

**Name**: `tidalSearch`

**Description**: Search the Tidal catalogue for tracks, albums, or both. Returns results with library membership and indexing status. Use this to discover new music or find specific artists/albums.

---

## Input Schema

```typescript
interface TidalSearchInput {
  /**
   * Search query text (artist name, album title, track title, or combination).
   * Examples:
   * - "Radiohead"
   * - "OK Computer"
   * - "Karma Police Radiohead"
   */
  query: string;

  /**
   * What type of content to search for.
   * - 'tracks': Search for individual tracks
   * - 'albums': Search for albums
   * - 'both': Search for both tracks and albums
   */
  searchType: 'tracks' | 'albums' | 'both';

  /**
   * Maximum number of results per type.
   * @minimum 1
   * @maximum 100
   * @default 20
   */
  limit?: number;
}
```

**Zod Schema**:
```typescript
const TidalSearchInputSchema = z.object({
  query: z.string()
    .min(1, 'Query cannot be empty')
    .max(500, 'Query too long (max 500 characters)'),
  searchType: z.enum(['tracks', 'albums', 'both']),
  limit: z.number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20),
});
```

---

## Output Schema

```typescript
interface TidalSearchOutput {
  /**
   * Array of matching tracks (only if searchType is 'tracks' or 'both').
   */
  tracks?: TrackResult[];

  /**
   * Array of matching albums (only if searchType is 'albums' or 'both').
   */
  albums?: AlbumResult[];

  /**
   * The original query.
   */
  query: string;

  /**
   * Total results found per type.
   */
  totalFound: {
    tracks: number;
    albums: number;
  };

  /**
   * Human-readable summary.
   * Example: "Found 15 tracks and 3 albums for 'Radiohead'"
   */
  summary: string;

  /**
   * Execution time in milliseconds.
   */
  durationMs: number;
}

interface TrackResult {
  tidalId: string;           // Tidal track ID
  isrc: string;              // ISO 3901 ISRC (may be null for some tracks)
  title: string;
  artist: string;
  album: string;
  artworkUrl?: string;       // Album cover URL
  duration?: number;         // Track duration in seconds
  explicit?: boolean;        // Explicit content flag
  popularity?: number;       // Tidal popularity score

  // Status flags
  inLibrary: boolean;        // Is track in user's library?
  isIndexed: boolean;        // Is track in vector index?
}

interface AlbumResult {
  tidalId: string;           // Tidal album ID
  title: string;
  artist: string;
  artworkUrl?: string;       // Album cover URL
  releaseDate?: string;      // ISO date string (YYYY-MM-DD)
  trackCount: number;        // Number of tracks on album

  // Status flag
  inLibrary: boolean;        // Is album in user's library?
}
```

---

## Behavior

### Execution Flow

1. **Validate input** - Check query, searchType, limit
2. **Execute Tidal search** - Call existing TidalService.search()
3. **Enrich track results** - For each track:
   - Check library membership by Tidal ID
   - Check vector index by ISRC (if ISRC available)
4. **Enrich album results** - Check library membership by Tidal ID
5. **Build response** - Format results with summary

### Error Handling

| Error Condition | Behavior |
|-----------------|----------|
| Empty query | Return validation error |
| Tidal API unavailable | Retry once, then return error with `retryable: true` |
| Tidal rate limited (429) | Retry once after 1s delay |
| No results found | Return success with empty arrays |

### Performance Targets

- **SC-002**: Complete search within 3 seconds
- **SC-005**: 100% of results include accurate `inLibrary` and `isIndexed` flags

---

## SSE Events

### Tool Call Start

```json
{
  "type": "tool_call_start",
  "toolCallId": "tc_def456",
  "toolName": "tidalSearch",
  "input": {
    "query": "Radiohead",
    "searchType": "both",
    "limit": 10
  }
}
```

### Tool Call End (Success)

```json
{
  "type": "tool_call_end",
  "toolCallId": "tc_def456",
  "summary": "Found 10 tracks and 5 albums for 'Radiohead'",
  "resultCount": 15,
  "durationMs": 876
}
```

### Tool Call Error

```json
{
  "type": "tool_call_error",
  "toolCallId": "tc_def456",
  "error": "Tidal service is temporarily unavailable. Try searching your indexed collection instead.",
  "retryable": true,
  "wasRetried": true
}
```

---

## Example Usage

### Agent Request

```
User: "What albums does Björk have?"

Agent thinks: I should search Tidal for Björk's albums.
Agent calls: tidalSearch({ query: "Björk", searchType: "albums", limit: 15 })
```

### Tool Response

```json
{
  "albums": [
    {
      "tidalId": "12345",
      "title": "Homogenic",
      "artist": "Björk",
      "artworkUrl": "https://resources.tidal.com/images/...",
      "releaseDate": "1997-09-22",
      "trackCount": 10,
      "inLibrary": true
    },
    {
      "tidalId": "12346",
      "title": "Post",
      "artist": "Björk",
      "artworkUrl": "https://resources.tidal.com/images/...",
      "releaseDate": "1995-06-12",
      "trackCount": 11,
      "inLibrary": false
    }
  ],
  "query": "Björk",
  "totalFound": { "tracks": 0, "albums": 12 },
  "summary": "Found 12 albums for 'Björk'",
  "durationMs": 543
}
```

---

## Related Tool: Album Tracks

For retrieving tracks from a specific album:

**Name**: `albumTracks`

**Description**: Get all tracks from a specific album by Tidal album ID.

### Input Schema

```typescript
interface AlbumTracksInput {
  /**
   * Tidal album ID from a previous search result.
   */
  albumId: string;
}
```

### Output Schema

```typescript
interface AlbumTracksOutput {
  albumId: string;
  albumTitle: string;
  artist: string;
  tracks: TrackResult[];    // All tracks on the album
  summary: string;
  durationMs: number;
}
```

### Example

```json
{
  "albumId": "12345",
  "albumTitle": "Homogenic",
  "artist": "Björk",
  "tracks": [
    {
      "tidalId": "123451",
      "isrc": "GBAYE9700123",
      "title": "Hunter",
      "artist": "Björk",
      "album": "Homogenic",
      "duration": 284,
      "inLibrary": true,
      "isIndexed": true
    }
  ],
  "summary": "Homogenic has 10 tracks",
  "durationMs": 234
}
```

---

## Langfuse Tracing

Each tool invocation creates a span:

```
Span: tool-tidalSearch
├── input: { query, searchType, limit }
├── output: { tracksCount, albumsCount, durationMs }
├── metadata:
│   ├── tidalApiDurationMs: 456
│   ├── libraryCheckDurationMs: 123
│   └── indexCheckDurationMs: 234
└── duration: 876ms
```
