# Data Model: Library Ingestion Scheduling

**Feature**: 007-library-ingestion-scheduling
**Date**: 2025-12-29

## Entity Changes

### Existing Entities (No Schema Changes Required)

The feature uses existing entities without schema modifications:

#### LibraryTrack (PostgreSQL)

```typescript
// backend/src/entities/LibraryTrack.ts
// No changes - ISRC already stored in metadata.isrc
interface LibraryTrack {
  id: string;            // UUID
  tidalTrackId: string;
  title: string;
  artistName: string;
  albumName: string | null;
  duration: number;
  coverArtUrl: string | null;
  metadata: {
    isrc?: string;         // <-- Used for ingestion scheduling
    explicitContent?: boolean;
    popularity?: number;
    genres?: string[];
  };
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### LibraryAlbum (PostgreSQL)

```typescript
// backend/src/entities/LibraryAlbum.ts
// No changes - but TrackInfo interface needs ISRC addition
interface LibraryAlbum {
  id: string;
  tidalAlbumId: string;
  title: string;
  artistName: string;
  coverArtUrl: string | null;
  releaseDate: Date | null;
  trackCount: number;
  trackListing: TrackInfo[];  // <-- Modified interface below
  metadata: object;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Interface Modifications

#### TrackInfo (Extend for ISRC)

```typescript
// backend/src/entities/LibraryAlbum.ts
// ADD isrc field to existing interface
export interface TrackInfo {
  position: number;
  title: string;
  duration: number;
  tidalId?: string;
  explicit?: boolean;
  isrc?: string;         // NEW: Required for ingestion scheduling
}
```

#### TrackIngestionPayload (New)

```typescript
// backend/src/services/ingestionScheduler.ts
// Internal type for scheduling
export interface TrackIngestionPayload {
  isrc: string;          // 12-character ISO 3901 ISRC
  title: string;         // Track title
  artist: string;        // Primary artist name
  album: string;         // Album name
}
```

---

## Event Schemas

### track/ingestion.requested (Existing - No Changes)

The event schema is already defined in the worker service. The backend will emit events matching this schema.

```typescript
// Reference: services/worker/src/inngest/events.ts
interface TrackIngestionRequestedEvent {
  isrc: string;          // ISO 3901 ISRC (12 alphanumeric)
  title: string;         // Track title (min 1 char)
  artist: string;        // Artist name (min 1 char)
  album: string;         // Album name (min 1 char)
  priority?: number;     // -600 to +600
  force?: boolean;       // Override idempotency
}
```

---

## Data Flow

### Track Addition Flow

```
User adds track via GraphQL
        ↓
LibraryService.addTrackToLibrary()
        ↓
    [Save to PostgreSQL]
        ↓
IngestionScheduler.scheduleTrack()
        ↓
    [Check Qdrant for existing document by ISRC]
        ↓
    [If not exists: Send to Inngest]
        ↓
Worker picks up track/ingestion.requested event
```

### Album Addition Flow

```
User adds album via GraphQL
        ↓
LibraryService.addAlbumToLibrary()
        ↓
    [Fetch album metadata + track listing with ISRCs from Tidal]
        ↓
    [Save to PostgreSQL]
        ↓
IngestionScheduler.scheduleAlbumTracks()
        ↓
    [Batch check Qdrant for existing documents by ISRCs]
        ↓
    [Filter to non-existing tracks]
        ↓
    [Batch send to Inngest]
        ↓
Worker picks up track/ingestion.requested events
```

---

## Validation Rules

### ISRC Validation

```typescript
// Validation at scheduling boundary
function isValidIsrc(isrc: string): boolean {
  return /^[A-Z0-9]{12}$/i.test(isrc);
}
```

- Must be exactly 12 alphanumeric characters
- Case-insensitive (normalized to uppercase)
- Invalid ISRCs result in skipped scheduling with warning log

### Track Metadata Validation

- `title`: Non-empty string
- `artist`: Non-empty string
- `album`: Non-empty string (use "Unknown Album" if missing)

Tracks failing validation are logged and skipped (not queued for ingestion).

---

## State Transitions

This feature does not introduce new entity states. Tracks/albums transition through existing states:

1. **Library Item Created** → Stored in PostgreSQL
2. **Ingestion Scheduled** → Event sent to Inngest (not persisted - fire and forget)
3. **Ingestion Completed** → Document in Qdrant (handled by 006-track-ingestion-pipeline)

---

## Relationships

### Cross-Service Data Dependencies

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   PostgreSQL        │     │      Inngest         │     │     Qdrant      │
│   (Library Data)    │     │   (Task Queue)       │     │ (Vector Index)  │
│                     │     │                      │     │                 │
│ LibraryTrack        │────▶│ track/ingestion      │────▶│ Track Document  │
│ - metadata.isrc     │     │ .requested event     │     │ - id (from ISRC)│
│                     │     │                      │     │                 │
│ LibraryAlbum        │     │ idempotency key:     │     │ Existence Check │
│ - trackListing.isrc │     │ event.data.isrc      │     │ by ISRC hash    │
└─────────────────────┘     └──────────────────────┘     └─────────────────┘
```

### Idempotency Keys

| Level | Key | Window | Purpose |
|-------|-----|--------|---------|
| Inngest | `event.data.isrc` | 24 hours | Prevents duplicate task creation |
| Qdrant | `hashIsrcToUuid(isrc)` | Permanent | Point ID for upsert semantics |

---

## Conceptual Entities (Not Persisted)

The following entities from the spec are **conceptual** - they represent logical concepts for understanding the system but are not persisted as database records:

### Library Addition Event

Represents the action of a user adding a track or album to their library. This is a **transient event** that triggers ingestion scheduling but is not stored. The event exists only during the execution of `addTrackToLibrary()` or `addAlbumToLibrary()` methods.

**Lifecycle**: Created → Processed → Discarded (no persistence)

### Index Existence Check

A query operation to determine if a track already exists in the vector index. This is a **point-in-time check** that returns a boolean result, not a persisted entity.

**Implementation**: `IngestionScheduler.checkTracksExist(isrcs: string[])` → `Map<string, boolean>`

---

## Migration Notes

**No database migrations required.**

The only schema change is adding `isrc?: string` to the `TrackInfo` TypeScript interface. This is:
- Backward compatible (optional field)
- Stored in JSONB column (`track_listing`)
- No PostgreSQL schema change needed
