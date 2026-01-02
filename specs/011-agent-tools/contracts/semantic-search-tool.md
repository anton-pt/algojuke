# Tool Contract: Semantic Search

**Feature**: 011-agent-tools
**Date**: 2025-12-31

## Overview

The semantic search tool allows the chat agent to search indexed tracks by mood, theme, or lyrical content using hybrid vector + BM25 search.

---

## Tool Definition

**Name**: `semanticSearch`

**Description**: Search indexed tracks by mood, theme, or lyrics description. Returns tracks from the vector index with full metadata including lyrics, interpretation, and audio features.

---

## Input Schema

```typescript
interface SemanticSearchInput {
  /**
   * Natural language search query describing the desired mood, theme, or content.
   * Examples:
   * - "melancholic songs about lost love"
   * - "upbeat summer vibes"
   * - "introspective late night music"
   */
  query: string;

  /**
   * Maximum number of results to return.
   * @minimum 1
   * @maximum 50
   * @default 20
   */
  limit?: number;
}
```

**Zod Schema**:
```typescript
const SemanticSearchInputSchema = z.object({
  query: z.string()
    .min(1, 'Query cannot be empty')
    .max(2000, 'Query too long (max 2000 characters)'),
  limit: z.number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(20),
});
```

---

## Output Schema

```typescript
interface SemanticSearchOutput {
  /**
   * Array of matching tracks with full metadata.
   */
  tracks: IndexedTrackResult[];

  /**
   * The original query (for display purposes).
   */
  query: string;

  /**
   * Total number of tracks found (may be more than returned if limited).
   */
  totalFound: number;

  /**
   * Human-readable summary for display.
   * Example: "Found 12 tracks matching 'melancholic love songs'"
   */
  summary: string;

  /**
   * Execution time in milliseconds.
   */
  durationMs: number;
}

interface IndexedTrackResult {
  isrc: string;              // ISO 3901 ISRC
  title: string;
  artist: string;
  album: string;
  artworkUrl?: string;       // Album cover URL
  duration?: number;         // Track duration in seconds
  inLibrary: boolean;        // Is track in user's library?
  isIndexed: true;           // Always true for semantic search results
  score: number;             // Relevance score (0-1, higher is better)

  // Extended metadata from vector index
  lyrics?: string;           // Full lyrics text
  interpretation?: string;   // AI-generated thematic interpretation

  // Audio features from ReccoBeats (nullable)
  audioFeatures?: {
    acousticness?: number;     // 0.0-1.0
    danceability?: number;     // 0.0-1.0
    energy?: number;           // 0.0-1.0
    instrumentalness?: number; // 0.0-1.0
    key?: number;              // -1 to 11 (pitch class, -1 = unknown)
    liveness?: number;         // 0.0-1.0
    loudness?: number;         // -60 to 0 dB
    mode?: number;             // 0 (minor) or 1 (major)
    speechiness?: number;      // 0.0-1.0
    tempo?: number;            // BPM (0-250)
    valence?: number;          // 0.0-1.0 (musical positivity)
  };
}
```

---

## Behavior

### Execution Flow

1. **Validate input** - Check query length, limit bounds
2. **Expand query** - Use Claude Haiku to generate 1-3 search queries (from 009-semantic-discovery-search)
3. **Generate embeddings** - Embed expanded queries via TEI
4. **Execute hybrid search** - Query Qdrant with vector + BM25 (RRF scoring)
5. **Enrich with library status** - Check each result's ISRC against user's library
6. **Build response** - Format results with summary

### Error Handling

| Error Condition | Behavior |
|-----------------|----------|
| Empty query | Return validation error |
| Qdrant unavailable | Retry once, then return error with `retryable: false` |
| TEI/embedding unavailable | Retry once, then return error |
| No results found | Return success with `tracks: []`, `totalFound: 0` |

### Performance Targets

- **SC-001**: Complete search within 3 seconds
- **SC-004**: 100% of results include accurate `inLibrary` status

---

## SSE Events

### Tool Call Start

```json
{
  "type": "tool_call_start",
  "toolCallId": "tc_abc123",
  "toolName": "semanticSearch",
  "input": {
    "query": "melancholic songs about lost love",
    "limit": 10
  }
}
```

### Tool Call End (Success)

```json
{
  "type": "tool_call_end",
  "toolCallId": "tc_abc123",
  "summary": "Found 8 tracks matching 'melancholic songs about lost love'",
  "resultCount": 8,
  "durationMs": 1234
}
```

### Tool Call Error

```json
{
  "type": "tool_call_error",
  "toolCallId": "tc_abc123",
  "error": "Vector search service is temporarily unavailable",
  "retryable": false,
  "wasRetried": true
}
```

---

## Example Usage

### Agent Request

```
User: "Find me some songs about overcoming hardship"

Agent thinks: I should search for uplifting songs about resilience and triumph.
Agent calls: semanticSearch({ query: "uplifting songs about overcoming challenges and resilience", limit: 10 })
```

### Tool Response

```json
{
  "tracks": [
    {
      "isrc": "USRC12345678",
      "title": "Stronger",
      "artist": "Kelly Clarkson",
      "album": "Stronger",
      "artworkUrl": "https://resources.tidal.com/images/...",
      "duration": 222,
      "inLibrary": true,
      "isIndexed": true,
      "score": 0.92,
      "lyrics": "What doesn't kill you makes you stronger...",
      "interpretation": "An anthem of empowerment about emerging from difficult situations with renewed strength...",
      "audioFeatures": {
        "energy": 0.85,
        "valence": 0.72,
        "danceability": 0.68,
        "tempo": 116
      }
    }
  ],
  "query": "uplifting songs about overcoming challenges and resilience",
  "totalFound": 15,
  "summary": "Found 15 tracks matching 'uplifting songs about overcoming challenges and resilience'",
  "durationMs": 1876
}
```

---

## Langfuse Tracing

Each tool invocation creates a span:

```
Span: tool-semanticSearch
├── input: { query, limit }
├── output: { tracks (count only), totalFound, durationMs }
├── metadata:
│   ├── expandedQueries: ["query1", "query2"]
│   ├── embeddingDurationMs: 234
│   └── searchDurationMs: 890
└── duration: 1876ms
```
