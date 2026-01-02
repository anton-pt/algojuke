# Data Model: Track Short Description

**Feature**: 012-track-short-description
**Date**: 2026-01-02

## Entity Changes

### TrackDocument (Extended)

Extends the existing track document schema with a new field.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| isrc | string | Yes | ISO 3901 ISRC (12 alphanumeric chars) |
| title | string | Yes | Track title |
| artist | string | Yes | Artist name |
| album | string | Yes | Album name |
| lyrics | string \| null | No | Plain text lyrics |
| interpretation | string \| null | No | LLM-generated thematic analysis |
| **short_description** | **string \| null** | **No** | **Single-sentence summary (≤50 words)** |
| interpretation_embedding | number[] | Yes | 1024-dim vector |
| acousticness | number \| null | No | 0.0-1.0 |
| danceability | number \| null | No | 0.0-1.0 |
| energy | number \| null | No | 0.0-1.0 |
| instrumentalness | number \| null | No | 0.0-1.0 |
| key | number \| null | No | -1 to 11 |
| liveness | number \| null | No | 0.0-1.0 |
| loudness | number \| null | No | -60 to 0 dB |
| mode | 0 \| 1 \| null | No | Minor/Major |
| speechiness | number \| null | No | 0.0-1.0 |
| tempo | number \| null | No | 0-250 BPM |
| valence | number \| null | No | 0.0-1.0 |

### New Field Details

#### short_description

- **Purpose**: Provides agents with quick context about a track in search results
- **Generation Source**:
  - Tracks with lyrics: Summarized from `interpretation` field
  - Instrumental tracks: Generated from metadata + audio features
- **Length Constraint**: Single sentence, maximum 50 words
- **Model**: claude-haiku-4-5-20251001
- **Nullable**: Yes (null when generation fails or not yet backfilled)

### Validation Rules

```typescript
short_description: z
  .string()
  .max(500)  // ~100 words max for safety buffer
  .nullable()
  .optional()
```

## New Entities

### BackfillProgress

Tracks the state of the backfill script for resumable execution.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| lastProcessedOffset | number | Yes | Scroll offset for Qdrant pagination |
| totalProcessed | number | Yes | Count of successfully processed tracks |
| errorCount | number | Yes | Count of failed tracks |
| errors | ErrorRecord[] | No | Recent error details |
| startedAt | ISO timestamp | Yes | When backfill started |
| lastUpdatedAt | ISO timestamp | Yes | Last progress update |

### ErrorRecord

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| isrc | string | Yes | Track ISRC that failed |
| error | string | Yes | Error message |
| timestamp | ISO timestamp | Yes | When error occurred |

### Zod Schema

```typescript
const BackfillProgressSchema = z.object({
  lastProcessedOffset: z.number().int().min(0),
  totalProcessed: z.number().int().min(0),
  errorCount: z.number().int().min(0),
  errors: z.array(z.object({
    isrc: z.string(),
    error: z.string(),
    timestamp: z.string().datetime(),
  })).optional().default([]),
  startedAt: z.string().datetime(),
  lastUpdatedAt: z.string().datetime(),
});
```

## State Transitions

### Track Ingestion Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Track Ingestion Flow                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. fetch-audio-features                                             │
│         ↓                                                            │
│  2. fetch-lyrics                                                     │
│         ↓                                                            │
│  3. generate-interpretation                                          │
│         ↓                                                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 4. generate-short-description  ← NEW STEP                    │   │
│  │    ├── Has interpretation? → Summarize interpretation        │   │
│  │    └── No interpretation? → Generate from metadata/features  │   │
│  │    └── On failure → Store null, continue pipeline            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│         ↓                                                            │
│  5. embed-interpretation                                             │
│         ↓                                                            │
│  6. store-document (includes short_description)                      │
│         ↓                                                            │
│  7. emit-completion                                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Backfill Script Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Backfill Flow                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Load progress file (if exists)                                   │
│         ↓                                                            │
│  2. Query Qdrant for tracks without short_description                │
│     (scroll from lastProcessedOffset)                                │
│         ↓                                                            │
│  ┌─────────────────────── FOR EACH TRACK ────────────────────────┐  │
│  │                                                                │  │
│  │  3a. Has interpretation?                                       │  │
│  │      → Generate from interpretation (Haiku prompt A)           │  │
│  │                                                                │  │
│  │  3b. No interpretation, has audio features?                    │  │
│  │      → Generate from metadata + features (Haiku prompt B)      │  │
│  │                                                                │  │
│  │  3c. No interpretation, no features?                           │  │
│  │      → Generate minimal description from metadata only         │  │
│  │                                                                │  │
│  │  4. Update track in Qdrant with short_description              │  │
│  │                                                                │  │
│  │  5. Save progress to file                                      │  │
│  │                                                                │  │
│  │  6. Sleep 2 seconds (rate limit)                               │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│         ↓                                                            │
│  7. Log completion summary                                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Relationships

```
┌────────────────────────────────────┐
│          TrackDocument             │
├────────────────────────────────────┤
│ • isrc (primary identifier)        │
│ • title, artist, album             │
│ • lyrics                           │
│ • interpretation                   │──────► Summarized by Haiku
│ • short_description ◄──────────────│          into 1 sentence
│ • interpretation_embedding         │
│ • audio features (11 fields)       │
└────────────────────────────────────┘
           │
           │ Indexed in
           ▼
┌────────────────────────────────────┐
│       Qdrant Collection            │
│         (tracks)                   │
└────────────────────────────────────┘
```

## Index Considerations

No new indexes needed. The `short_description` field is stored as a payload field in Qdrant alongside existing metadata. It is:
- Returned in search results via payload filtering
- Not used for vector similarity search
- Filtered optionally to find tracks needing backfill: `{"must": [{"is_null": {"key": "short_description"}}]}`
