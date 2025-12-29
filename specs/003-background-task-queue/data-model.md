# Data Model: Background Task Queue Infrastructure

**Feature**: Background Task Queue Infrastructure
**Date**: 2025-12-29
**Status**: Design Complete

## Overview

This document defines the data entities involved in the background task queue infrastructure using Inngest. The system manages asynchronous enrichment of track metadata and lyric embeddings through durable, step-based workflows.

## Entity Relationship Diagram

```
┌──────────────────────┐
│  Track (Existing)    │
│──────────────────────│
│  id: UUID            │◄────────┐
│  tidalId: string     │         │
│  title: string       │         │
│  artist: string      │         │
│  album: string       │         │
│  ...                 │         │
│  enrichmentStatus*   │         │ references
│  enrichedAt*         │         │
│  enrichmentRunId*    │         │
└──────────────────────┘         │
                                 │
┌──────────────────────────────────┐
│  EnrichmentEvent             │
│  (Inngest Event)                 │
│──────────────────────────────────│
│  id: string                      │
│  name: enum                      │
│  ts: timestamp                   │
│  data:                           │
│    trackId: UUID     ────────────┘
│    tidalId: string               │
│    priority?: number             │
│    force?: boolean               │
└──────────────────────────────────┘
         │
         │ triggers
         ▼
┌──────────────────────────────────┐
│  FunctionRun                     │
│  (Inngest Internal State)        │
│──────────────────────────────────│
│  id: string                      │
│  function_id: string             │
│  event_id: string                │
│  status: enum                    │
│  started_at: timestamp           │
│  ended_at: timestamp?            │
│  output: JSON?                   │
│  error: string?                  │
└──────────────────────────────────┘
         │
         │ contains
         ▼
┌──────────────────────────────────┐
│  StepExecution                   │
│  (Inngest Step State)            │
│──────────────────────────────────│
│  id: string (hash)               │
│  name: string                    │
│  index: number                   │
│  status: enum                    │
│  input: JSON                     │
│  output: JSON?                   │
│  error: JSON?                    │
│  started_at: timestamp           │
│  ended_at: timestamp?            │
└──────────────────────────────────┘
         │
         │ produces
         ▼
┌──────────────────────────────────┐
│  EnrichmentResult                │
│  (Step Output Data)              │
│──────────────────────────────────│
│  metadata:                       │
│    artistBio: string             │
│    genres: string[]              │
│    releaseInfo: object           │
│  lyrics:                         │
│    text: string                  │
│    source: string                │
│  embeddings:                     │
│    vector: number[]              │
│    model: string                 │
└──────────────────────────────────┘
```

## Core Entities

### 1. Track (Extended Existing Entity)

**Purpose**: Represents a music track in the user's library, extended with enrichment status fields.

**Attributes**:
- `id` (UUID, PK): Unique identifier for the track
- `tidalId` (string, indexed): Tidal's unique identifier
- `title` (string): Track title
- `artist` (string): Artist name
- `album` (string): Album name
- `duration` (number): Track duration in seconds
- `... existing fields ...`

**New Enrichment Fields** (added by this feature):
- `enrichmentStatus` (enum): Current enrichment status
  - Values: `pending`, `in_progress`, `completed`, `failed`, `not_started`
- `enrichedAt` (timestamp, nullable): When enrichment completed
- `enrichmentRunId` (string, nullable, indexed): Latest Inngest function run ID
- `artistBio` (text, nullable): Artist biography (from enrichment)
- `genres` (string[], nullable): Genre classifications (from enrichment)
- `releaseInfo` (JSONB, nullable): Release information (year, label, etc.)
- `lyricsText` (text, nullable): Full lyrics text
- `lyricsSource` (string, nullable): Source of lyrics (e.g., "LyricsAPI")
- `lyricsEmbedding` (vector, nullable): Vector embedding of lyrics (for similarity search)

**Relationships**:
- One-to-many with `EnrichmentEvent` (via trackId)
- Referenced by Inngest function runs (via event data)

**Validation Rules**:
- `enrichmentStatus` must be valid enum value
- If `enrichedAt` is set, `enrichmentStatus` must be `completed`
- `enrichmentRunId` format must match Inngest run ID pattern

**State Transitions**:
```
not_started ──(enrichment requested)──> pending
pending ──(function starts)──> in_progress
in_progress ──(all steps complete)──> completed
in_progress ──(max retries exceeded)──> failed
failed ──(manual retry)──> pending
completed ──(force re-enrichment)──> pending
```

---

### 2. EnrichmentEvent (Inngest Event Schema)

**Purpose**: Event payload sent to Inngest to trigger or signal enrichment workflows.

**Event Types**:

#### `track/enrichment.requested`
Triggers enrichment workflow for a track.

**Attributes**:
- `name` (string, const): `"track/enrichment.requested"`
- `id` (string, auto-generated): Unique event ID (UUID)
- `ts` (number, auto-generated): Event timestamp (Unix epoch ms)
- `data` (object):
  - `trackId` (UUID, required): Database track ID
  - `tidalId` (string, required): Tidal track identifier
  - `priority` (number, optional): Priority modifier (-600 to +600 seconds)
  - `force` (boolean, optional): Override idempotency, force re-enrichment
  - `steps` (string[], optional): Specific steps to run (default: all)

**Validation Rules**:
- `trackId` must be valid UUID format
- `tidalId` must be non-empty string
- `priority` must be between -600 and 600
- `force` defaults to false
- `steps` must be array of valid step names if provided

#### `track/enrichment.completed`
Signals successful enrichment completion (emitted by function).

**Attributes**:
- `name` (string, const): `"track/enrichment.completed"`
- `id` (string, auto-generated): Unique event ID
- `ts` (number, auto-generated): Event timestamp
- `data` (object):
  - `trackId` (UUID, required): Database track ID
  - `runId` (string, required): Inngest function run ID
  - `completedAt` (number, required): Completion timestamp
  - `stepsCompleted` (number, required): Number of steps executed
  - `metadata` (object, optional): Summary of enrichment data

#### `track/enrichment.failed`
Signals permanent enrichment failure (emitted by function or system).

**Attributes**:
- `name` (string, const): `"track/enrichment.failed"`
- `id` (string, auto-generated): Unique event ID
- `ts` (number, auto-generated): Event timestamp
- `data` (object):
  - `trackId` (UUID, required): Database track ID
  - `runId` (string, required): Inngest function run ID
  - `error` (string, required): Error message
  - `failedStep` (string, optional): Step that caused failure
  - `retries` (number, required): Number of retries attempted

---

### 3. FunctionRun (Inngest Managed State)

**Purpose**: Represents a single execution of an Inngest function. Managed entirely by Inngest, queryable via API.

**Attributes** (read-only via API):
- `id` (string, PK): Unique function run ID (generated by Inngest)
- `function_id` (string): Function identifier (e.g., `"enrich-track"`)
- `event_id` (string, FK): Triggering event ID
- `status` (enum): Current execution status
  - Values: `Running`, `Completed`, `Failed`, `Cancelled`
- `started_at` (timestamp): When execution started
- `ended_at` (timestamp, nullable): When execution finished
- `output` (JSON, nullable): Final function return value
- `error` (string, nullable): Error message if failed
- `pending_steps` (number): Number of steps not yet completed
- `version` (number): Function version at execution time

**Querying**:
- Via Inngest REST API: `GET /v1/events/{event_id}/runs`
- Returns array of runs for a given event
- Can filter by status, time range

**Lifecycle**:
1. Created when event triggers function
2. Status: `Running` while executing
3. Status: `Completed` if all steps succeed
4. Status: `Failed` if max retries exceeded
5. Persisted in Inngest database (SQLite dev, PostgreSQL production)

---

### 4. StepExecution (Inngest Step State)

**Purpose**: Represents execution state for a single step within a function run. Managed by Inngest's state store.

**Attributes** (memoized state):
- `id` (string, PK): Hash of step name + function context
- `name` (string): Step name (e.g., `"fetch-metadata"`)
- `index` (number): Step execution order (0-indexed)
- `status` (enum): Step execution status
  - Values: `Pending`, `Running`, `Completed`, `Failed`
- `input` (JSON): Input arguments to step function
- `output` (JSON, nullable): Step return value (memoized)
- `error` (JSON, nullable): Error details if failed
- `started_at` (timestamp): When step started
- `ended_at` (timestamp, nullable): When step finished
- `retry_count` (number): Number of retries for this step

**Memoization Behavior**:
- Successfully completed steps are never re-executed
- `output` is persisted and injected on function resume
- Failed steps retry from scratch with fresh attempt
- Step ID remains constant across retries (same name → same hash)

**Size Limits**:
- Total size of all step outputs in a function run must be <4MB
- Individual step outputs should be minimal (store references, not payloads)

---

### 5. EnrichmentResult (Step Output Data Structure)

**Purpose**: Structured data returned from enrichment steps, stored in Inngest state and optionally persisted to database.

**Structure**:

```typescript
interface EnrichmentResult {
  metadata?: {
    artistBio?: string;
    genres?: string[];
    releaseInfo?: {
      year?: number;
      label?: string;
      country?: string;
    };
    relatedArtists?: string[];
  };

  lyrics?: {
    text: string;
    source: string;
    language?: string;
    verified?: boolean;
  };

  embeddings?: {
    vector: number[];  // Vector embedding of lyrics
    model: string;     // Model used (e.g., "text-embedding-ada-002")
    dimensions: number; // Vector dimensionality
  };

  errors?: {
    [stepName: string]: string;  // Partial failure tracking
  };
}
```

**Usage**:
- Accumulated across steps via Inngest step outputs
- Final consolidated result stored in function run output
- Selected fields persisted to Track entity on completion
- Full result available via Inngest API for debugging

**Validation**:
- `vector` must have consistent dimensions
- `genres` must be from validated genre taxonomy (if enforced)
- `lyrics.text` must be non-empty if present

---

## Data Flow

### Enrichment Request Flow

```
1. User Action (add track to library)
   ↓
2. Track Entity Created/Updated (enrichmentStatus = "not_started")
   ↓
3. Main App Sends Event
   └─> track/enrichment.requested {trackId, tidalId}
       ↓
4. Inngest Receives Event
   ├─> Creates FunctionRun {status: "Running"}
   └─> Triggers enrichTrack function
       ↓
5. Worker Service Executes Steps
   ├─> Step: fetch-metadata
   │   ├─> StepExecution created {name: "fetch-metadata", status: "Running"}
   │   ├─> External API call
   │   ├─> StepExecution completed {output: {artistBio, genres, ...}}
   │   └─> Output memoized in Inngest state
   ├─> Step: fetch-lyrics
   │   └─> Similar flow...
   ├─> Step: generate-embeddings
   │   └─> Similar flow...
   └─> Step: update-database
       ├─> Write enrichmentResult to Track entity
       └─> Set enrichmentStatus = "completed"
       ↓
6. Function Completes
   ├─> FunctionRun {status: "Completed", output: {enrichmentResult}}
   └─> Optional: Send track/enrichment.completed event
       ↓
7. Track Entity Updated
   └─> {enrichmentStatus: "completed", enrichedAt: now(), enrichmentRunId: runId}
```

### Retry Flow (Step Failure)

```
1. Step Fails (e.g., external API timeout)
   ↓
2. StepExecution {status: "Failed", error: "Timeout", retry_count: 1}
   ↓
3. Inngest Retry Policy Applies
   ├─> Wait (exponential backoff: 5min, 15min, 1hr, 4hr, 14hr)
   └─> Retry Step
       ↓
4. Step Re-executes
   ├─> Previous steps NOT re-executed (memoized)
   └─> Failed step retries from scratch
       ↓
5. If Succeeds: Continue to next step
   If Fails Again: Increment retry_count, repeat
   If Max Retries Exceeded: Mark function as Failed
```

---

## Indexing Strategy

### Track Entity Indexes

```sql
-- Existing indexes (assumed)
CREATE INDEX idx_track_tidal_id ON tracks(tidal_id);
CREATE INDEX idx_track_user_id ON tracks(user_id);

-- New indexes for enrichment queries
CREATE INDEX idx_track_enrichment_status ON tracks(enrichment_status);
CREATE INDEX idx_track_enrichment_run_id ON tracks(enrichment_run_id);
CREATE INDEX idx_track_enriched_at ON tracks(enriched_at) WHERE enriched_at IS NOT NULL;

-- Composite index for common query: "Find pending enrichments for user"
CREATE INDEX idx_track_user_enrichment ON tracks(user_id, enrichment_status);
```

**Query Optimization**:
- Find all pending enrichments: `WHERE enrichment_status = 'pending'`
- Find failed enrichments needing retry: `WHERE enrichment_status = 'failed'`
- Find recently enriched tracks: `WHERE enriched_at > NOW() - INTERVAL '7 days'`
- Lookup by Inngest run ID: `WHERE enrichment_run_id = '...'`

---

## Storage Considerations

### Inngest State Store
- **What's Stored**: Event payloads, step outputs, function state
- **Size Limit**: <4MB total per function run
- **Retention**: Indefinite for completed runs (SQLite dev, PostgreSQL production)
- **Access**: Via Inngest API or dashboard

### PostgreSQL (Track Entity)
- **What's Stored**: Track metadata, enrichment results, status
- **Size Estimate**: ~10KB per track (with full metadata + lyrics)
- **Retention**: Indefinite (user data)
- **Cleanup**: Optional job to archive old enrichment history (>30 days)

### Optimization Strategies
1. **Store References**: For large data (audio files, images), store URLs/IDs not payloads
2. **Lazy Loading**: Don't load embeddings unless needed (store in separate column)
3. **Compression**: Use JSONB compression for metadata objects
4. **Partitioning**: Consider partitioning tracks by enrichment status for large datasets

---

## Migration Considerations

### Adding to Existing Schema

```sql
-- Add enrichment columns to existing tracks table
ALTER TABLE tracks
  ADD COLUMN enrichment_status VARCHAR(20) DEFAULT 'not_started',
  ADD COLUMN enriched_at TIMESTAMP,
  ADD COLUMN enrichment_run_id VARCHAR(255),
  ADD COLUMN artist_bio TEXT,
  ADD COLUMN genres VARCHAR(100)[],
  ADD COLUMN release_info JSONB,
  ADD COLUMN lyrics_text TEXT,
  ADD COLUMN lyrics_source VARCHAR(100),
  ADD COLUMN lyrics_embedding VECTOR(1536);  -- Assuming OpenAI ada-002 dimensions

-- Add check constraint for valid status
ALTER TABLE tracks
  ADD CONSTRAINT chk_enrichment_status
  CHECK (enrichment_status IN ('not_started', 'pending', 'in_progress', 'completed', 'failed'));

-- Add indexes
CREATE INDEX idx_track_enrichment_status ON tracks(enrichment_status);
CREATE INDEX idx_track_enrichment_run_id ON tracks(enrichment_run_id);
CREATE INDEX idx_track_enriched_at ON tracks(enriched_at) WHERE enriched_at IS NOT NULL;
```

### Backfilling Strategy

For existing tracks without enrichment:
1. Set `enrichment_status = 'not_started'` (default)
2. Optionally trigger bulk enrichment via batch events
3. Monitor Inngest dashboard for progress

---

## Data Contracts (Type Definitions)

See [contracts/events.ts](./contracts/events.ts) for TypeScript/Zod schemas implementing these entities.

**Key Type Exports**:
- `EnrichmentRequestedEvent`
- `EnrichmentCompletedEvent`
- `EnrichmentFailedEvent`
- `EnrichmentResult`
- `EnrichmentStatus` (enum)

---

**Document Status**: ✅ Complete - Ready for implementation
