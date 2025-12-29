# Data Model: Track Ingestion Pipeline

**Feature**: 006-track-ingestion-pipeline
**Date**: 2025-12-29

## Entities

### TrackIngestionEvent

The Inngest event that triggers the ingestion pipeline.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `isrc` | string | Yes | ISO 3901 ISRC (12 alphanumeric characters) |
| `title` | string | Yes | Track title from Tidal |
| `artist` | string | Yes | Artist name from Tidal |
| `album` | string | Yes | Album name from Tidal |
| `priority` | number | No | Priority modifier (-600 to +600), default 0 |
| `force` | boolean | No | Override idempotency check, default false |

**Validation Rules**:
- `isrc`: Must match regex `/^[A-Z0-9]{12}$/i`
- `title`, `artist`, `album`: Non-empty strings
- `priority`: Integer between -600 and +600

**Idempotency**: Keyed by `isrc` with 24-hour window (unless `force: true`)

---

### AudioFeatures

Audio analysis data from ReccoBeats API. All fields optional to handle missing data.

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `acousticness` | number \| null | 0.0-1.0 | Acoustic vs electronic (1.0 = acoustic) |
| `danceability` | number \| null | 0.0-1.0 | Suitability for dancing |
| `energy` | number \| null | 0.0-1.0 | Intensity and liveliness |
| `instrumentalness` | number \| null | 0.0-1.0 | Likelihood of no vocals (>0.5 = instrumental) |
| `key` | number \| null | -1 to 11 | Pitch class (-1 = no key, 0 = C, 11 = B) |
| `liveness` | number \| null | 0.0-1.0 | Probability of live audience |
| `loudness` | number \| null | -60 to 0 | Average loudness in dB |
| `mode` | 0 \| 1 \| null | 0 or 1 | Musical mode (0 = minor, 1 = major) |
| `speechiness` | number \| null | 0.0-1.0 | Presence of spoken words |
| `tempo` | number \| null | 0-250 | Beats per minute |
| `valence` | number \| null | 0.0-1.0 | Musical positivity |

**Source**: ReccoBeats API `/v1/audio-features?isrc={ISRC}`

---

### LyricsContent

Lyrics data from Musixmatch API.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `lyrics_body` | string | Yes | Full lyric text |
| `lyrics_language` | string | No | Language code (e.g., "en") |
| `explicit` | number | No | Explicit flag (0 or 1) |

**Source**: Musixmatch API `track.lyrics.get?track_isrc={ISRC}`

**Empty State**: When lyrics unavailable, the pipeline proceeds with:
- `lyrics`: null
- `interpretation`: null
- `interpretation_embedding`: zero vector (4096 zeros)

---

### Interpretation

LLM-generated thematic analysis of lyrics.

| Field | Type | Description |
|-------|------|-------------|
| `text` | string | 150-300 word interpretation |
| `model` | string | Model identifier (e.g., "claude-sonnet-4-20250514") |
| `input_tokens` | number | Prompt token count |
| `output_tokens` | number | Completion token count |

**Generation**: Via Vercel AI SDK with Claude Sonnet 4.5

---

### InterpretationEmbedding

Vector representation of the interpretation.

| Field | Type | Description |
|-------|------|-------------|
| `vector` | number[] | 4096-dimensional dense vector |

**Source**: TEI with Qwen3-Embedding-8B

**Validation**: Must have exactly 4096 dimensions

**Zero Vector**: Used when no lyrics available (4096 zeros)

---

### TrackDocument

Complete document stored in Qdrant vector index. Combines all entities above.

| Field | Type | Required | Indexed | Description |
|-------|------|----------|---------|-------------|
| `isrc` | string | Yes | Keyword | Unique track identifier |
| `title` | string | Yes | Text (BM25) | Track title |
| `artist` | string | Yes | Text (BM25) | Artist name |
| `album` | string | Yes | Text (BM25) | Album name |
| `lyrics` | string \| null | No | Text (BM25) | Full lyrics |
| `interpretation` | string \| null | No | Text (BM25) | LLM interpretation |
| `interpretation_embedding` | number[] | Yes | Vector | 4096-dim embedding |
| `acousticness` | number \| null | No | Payload | Audio feature |
| `danceability` | number \| null | No | Payload | Audio feature |
| `energy` | number \| null | No | Payload | Audio feature |
| `instrumentalness` | number \| null | No | Payload | Audio feature |
| `key` | number \| null | No | Payload | Audio feature |
| `liveness` | number \| null | No | Payload | Audio feature |
| `loudness` | number \| null | No | Payload | Audio feature |
| `mode` | number \| null | No | Payload | Audio feature |
| `speechiness` | number \| null | No | Payload | Audio feature |
| `tempo` | number \| null | No | Payload | Audio feature |
| `valence` | number \| null | No | Payload | Audio feature |

**Storage**: Qdrant collection `tracks` (defined in 004-vector-search-index)

**Identity**: Document ID derived from ISRC using deterministic UUID hashing (existing `isrcHash` utility)

**Upsert Behavior**: Existing documents with same ISRC are updated (not duplicated)

---

## State Transitions

### Pipeline Execution States

```
┌─────────────┐
│   Pending   │  Event received, awaiting execution
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Fetching   │  Steps 1-2: Audio features + lyrics
│    Data     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Generating  │  Step 3: LLM interpretation (skipped if no lyrics)
│Interpretation│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Embedding  │  Step 4: Vector embedding
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Storing   │  Step 5: Qdrant upsert
└──────┬──────┘
       │
       ├──────────────┐
       ▼              ▼
┌─────────────┐ ┌─────────────┐
│  Completed  │ │   Failed    │  After max retries exhausted
└─────────────┘ └─────────────┘
```

### Step Retry Behavior

Each step has independent retry with exponential backoff:
- Attempt 1: Immediate
- Attempt 2: +5 minutes
- Attempt 3: +15 minutes
- Attempt 4: +1 hour
- Attempt 5: +4 hours

After 5 failures: Pipeline marked as permanently failed.

---

## Relationships

```
TrackIngestionEvent
        │
        │ triggers
        ▼
┌───────────────────────────────────────────────────┐
│                  Pipeline Steps                    │
│                                                    │
│  ┌─────────────┐    ┌─────────────┐               │
│  │ ReccoBeats  │    │  Musixmatch │               │
│  │    API      │    │     API     │               │
│  └──────┬──────┘    └──────┬──────┘               │
│         │                  │                       │
│         ▼                  ▼                       │
│  ┌─────────────┐    ┌─────────────┐               │
│  │AudioFeatures│    │LyricsContent│               │
│  └──────┬──────┘    └──────┬──────┘               │
│         │                  │                       │
│         │                  ▼                       │
│         │           ┌─────────────┐               │
│         │           │ Claude LLM  │               │
│         │           └──────┬──────┘               │
│         │                  │                       │
│         │                  ▼                       │
│         │           ┌─────────────┐               │
│         │           │Interpretation│              │
│         │           └──────┬──────┘               │
│         │                  │                       │
│         │                  ▼                       │
│         │           ┌─────────────┐               │
│         │           │     TEI     │               │
│         │           └──────┬──────┘               │
│         │                  │                       │
│         │                  ▼                       │
│         │      ┌───────────────────┐              │
│         │      │InterpretationEmbed│              │
│         │      └─────────┬─────────┘              │
│         │                │                        │
│         └────────────────┼────────────────────────│
│                          │                        │
│                          ▼                        │
│                  ┌─────────────┐                  │
│                  │TrackDocument│                  │
│                  └──────┬──────┘                  │
│                         │                         │
└─────────────────────────┼─────────────────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │   Qdrant    │
                   │   Index     │
                   └─────────────┘
```
