# Tool Contract: Batch Track Metadata Retrieval

**Feature**: 011-agent-tools
**Date**: 2025-12-31

## Overview

The batch metadata tool allows the chat agent to retrieve full metadata for multiple tracks by ISRC from the vector index. This enables efficient lookups when building playlists or comparing tracks.

---

## Tool Definition

**Name**: `batchMetadata`

**Description**: Retrieve full metadata for multiple tracks by ISRC. Returns detailed information including lyrics, interpretation, and audio features for tracks that exist in the vector index.

---

## Input Schema

```typescript
interface BatchMetadataInput {
  /**
   * Array of ISRCs (International Standard Recording Codes).
   * Each ISRC must be exactly 12 alphanumeric characters.
   * Maximum 100 ISRCs per request.
   */
  isrcs: string[];
}
```

**Zod Schema**:
```typescript
const ISRCPattern = /^[A-Z0-9]{12}$/i;

const BatchMetadataInputSchema = z.object({
  isrcs: z.array(
    z.string()
      .regex(ISRCPattern, 'Invalid ISRC format (must be 12 alphanumeric characters)')
  )
    .min(1, 'At least one ISRC required')
    .max(100, 'Maximum 100 ISRCs per request'),
});
```

---

## Output Schema

```typescript
interface BatchMetadataOutput {
  /**
   * Array of tracks found in the vector index with full metadata.
   */
  tracks: IndexedTrackResult[];

  /**
   * ISRCs that were found in the index.
   */
  found: string[];

  /**
   * ISRCs that were not found in the index.
   */
  notFound: string[];

  /**
   * Human-readable summary.
   * Example: "Retrieved metadata for 8 of 10 requested tracks"
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
  artworkUrl?: string;       // Album cover URL (if available)
  duration?: number;         // Track duration in seconds
  inLibrary: boolean;        // Is track in user's library?
  isIndexed: true;           // Always true (only indexed tracks returned)

  // Extended metadata from vector index
  lyrics?: string;           // Full lyrics text (may be null for instrumentals)
  interpretation?: string;   // AI-generated thematic interpretation

  // Audio features from ReccoBeats (nullable)
  audioFeatures?: {
    acousticness?: number;     // 0.0-1.0
    danceability?: number;     // 0.0-1.0
    energy?: number;           // 0.0-1.0
    instrumentalness?: number; // 0.0-1.0
    key?: number;              // -1 to 11
    liveness?: number;         // 0.0-1.0
    loudness?: number;         // -60 to 0 dB
    mode?: number;             // 0 or 1
    speechiness?: number;      // 0.0-1.0
    tempo?: number;            // BPM
    valence?: number;          // 0.0-1.0
  };
}
```

---

## Behavior

### Execution Flow

1. **Validate input** - Check ISRC formats, count <= 100
2. **Query vector index** - Batch lookup by ISRCs in Qdrant
3. **Enrich with library status** - Check each found track against user's library
4. **Categorize results** - Separate found vs. not found ISRCs
5. **Build response** - Format results with summary

### Error Handling

| Error Condition | Behavior |
|-----------------|----------|
| Empty array | Return validation error |
| More than 100 ISRCs | Return validation error with guidance |
| Invalid ISRC format | Include in `notFound` with validation note |
| Qdrant unavailable | Retry once, then return error |
| All ISRCs not found | Return success with empty `tracks`, all in `notFound` |

### Performance Targets

- **SC-003**: Complete retrieval within 2 seconds for up to 100 ISRCs
- **SC-004**: 100% of results include accurate `inLibrary` status

---

## SSE Events

### Tool Call Start

```json
{
  "type": "tool_call_start",
  "toolCallId": "tc_ghi789",
  "toolName": "batchMetadata",
  "input": {
    "isrcs": ["USRC12345678", "GBAYE9700123", "FRXXX1234567"]
  }
}
```

### Tool Call End (Success)

```json
{
  "type": "tool_call_end",
  "toolCallId": "tc_ghi789",
  "summary": "Retrieved metadata for 2 of 3 requested tracks",
  "resultCount": 2,
  "durationMs": 345
}
```

### Tool Call Error

```json
{
  "type": "tool_call_error",
  "toolCallId": "tc_ghi789",
  "error": "Request exceeds maximum of 100 ISRCs. Please split into multiple requests.",
  "retryable": false,
  "wasRetried": false
}
```

---

## Example Usage

### Agent Request

```
User: "Compare the energy levels of these songs I mentioned"

Agent thinks: I need to get metadata for the tracks discussed. I have their ISRCs from previous results.
Agent calls: batchMetadata({ isrcs: ["USRC12345678", "GBAYE9700123", "FRXXX1234567"] })
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
      "lyrics": "What doesn't kill you makes you stronger...",
      "interpretation": "An empowering anthem about resilience...",
      "audioFeatures": {
        "energy": 0.85,
        "valence": 0.72,
        "tempo": 116
      }
    },
    {
      "isrc": "GBAYE9700123",
      "title": "Hunter",
      "artist": "Björk",
      "album": "Homogenic",
      "duration": 284,
      "inLibrary": true,
      "isIndexed": true,
      "lyrics": "If travel is searching...",
      "interpretation": "A fierce declaration of artistic independence...",
      "audioFeatures": {
        "energy": 0.78,
        "valence": 0.45,
        "tempo": 140
      }
    }
  ],
  "found": ["USRC12345678", "GBAYE9700123"],
  "notFound": ["FRXXX1234567"],
  "summary": "Retrieved metadata for 2 of 3 requested tracks",
  "durationMs": 345
}
```

---

## Use Cases

### 1. Playlist Curation

When the agent is building a playlist, it may need to compare audio features across multiple candidate tracks:

```
Agent: Let me check the energy levels of these potential workout songs.
→ batchMetadata({ isrcs: [list of candidate ISRCs] })
→ Filter/sort by energy > 0.7
→ Present curated selection
```

### 2. Track Comparison

When user asks to compare specific tracks:

```
User: "How does the mood of 'Stronger' compare to 'Hunter'?"
→ batchMetadata({ isrcs: ["USRC12345678", "GBAYE9700123"] })
→ Compare valence, energy, interpretation
→ Present analysis
```

### 3. Context Enrichment

After semantic or Tidal search, the agent may want full details:

```
Agent: Found these tracks in your library. Let me get the full details.
→ batchMetadata({ isrcs: [ISRCs from previous search] })
→ Present rich track information
```

---

## Langfuse Tracing

Each tool invocation creates a span:

```
Span: tool-batchMetadata
├── input: { isrcCount: 10 }
├── output: { foundCount: 8, notFoundCount: 2, durationMs }
├── metadata:
│   ├── qdrantDurationMs: 234
│   ├── libraryCheckDurationMs: 89
│   └── invalidIsrcs: []
└── duration: 345ms
```

---

## Validation Notes

### ISRC Format

ISRCs follow ISO 3901 format:
- 12 characters total
- First 2: Country code (e.g., US, GB, FR)
- Next 3: Registrant code (alphanumeric)
- Next 2: Year of registration
- Last 5: Designation code (numeric)

Example: `USRC12345678`
- US = Country (United States)
- RC1 = Registrant
- 23 = Year (2023)
- 45678 = Designation

### Handling Invalid ISRCs

Invalid ISRCs are silently added to `notFound` rather than failing the entire request. This allows partial success when some ISRCs are malformed.
