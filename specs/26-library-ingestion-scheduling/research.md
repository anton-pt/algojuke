# Research: Library Ingestion Scheduling

**Feature**: 007-library-ingestion-scheduling
**Date**: 2025-12-29

## Research Tasks

### 1. ISRC Availability in Album Track Listings

**Context**: Need to schedule ingestion for album tracks, but current `TrackInfo` interface lacks ISRC.

**Finding**: The Tidal API v2 `/albums/{id}/relationships/items` endpoint returns track details including `tidalId` but the ISRC attribute is not reliably included in the items response. The ISRC is definitively available via the batch tracks endpoint `/v2/tracks?filter[id]=id1,id2,...` which is already used in the codebase for search enrichment.

**Decision**: Use the existing `batchFetchTracks` pattern with Tidal track IDs to retrieve ISRCs after getting the album track listing.

**Rationale**:
- Tidal batch tracks API supports up to 20 tracks per request (already implemented in tidalService.ts)
- Most albums have fewer than 20 tracks, so typically single API call
- Reuses existing rate-limited, retry-enabled batch fetching pattern
- ISRC is reliably returned in `track.attributes.isrc` from this endpoint

**Implementation Pattern**:
```typescript
// 1. Get album track listing (returns tidalIds)
const trackListing = await this.tidalService.getAlbumTrackListing(tidalAlbumId);
const tidalIds = trackListing.map(t => t.tidalId).filter(Boolean);

// 2. Batch fetch tracks by ID to get ISRCs (chunks of 20)
const trackIsrcs = await this.tidalService.batchFetchTrackIsrcs(tidalIds);

// 3. Merge ISRCs into track listing
trackListing.forEach(track => {
  if (track.tidalId) {
    track.isrc = trackIsrcs.get(track.tidalId);
  }
});
```

**Alternatives Considered**:
- Extend items endpoint parsing: Rejected - ISRC not reliably in items response
- Separate API call per track: Rejected - inefficient, would hit rate limits

---

### 2. Inngest Client Integration Pattern

**Context**: Backend service needs to send events to Inngest, but worker service client can't be imported.

**Finding**: The Inngest client is initialized with event schemas for type safety. The worker service defines `TrackIngestionRequestedEvent` in `services/worker/src/inngest/events.ts`.

**Decision**: Create a minimal Inngest client in the backend with inline event schema definition.

**Rationale**:
- Keeps backend independent of worker service
- Type safety for event data
- Future: Can extract to shared package when needed

**Code Pattern**:
```typescript
// backend/src/clients/inngestClient.ts
import { Inngest, EventSchemas } from "inngest";
import { z } from "zod";

const TrackIngestionRequestedEvent = z.object({
  isrc: z.string().length(12),
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().min(1),
  priority: z.number().int().min(-600).max(600).optional(),
  force: z.boolean().optional(),
});

const backendEvents = new EventSchemas().fromZod({
  "track/ingestion.requested": { data: TrackIngestionRequestedEvent },
});

export const inngest = new Inngest({
  id: "algojuke-backend",
  schemas: backendEvents,
});
```

---

### 3. Qdrant Existence Check Pattern

**Context**: Need to check if track already exists in vector index before scheduling.

**Finding**: The `services/search-index` service has a Qdrant client. Track documents use ISRC-based deterministic UUIDs via `hashIsrcToUuid()`.

**Decision**: Add a utility function to check point existence by ISRC in the search-index service, importable by backend.

**Rationale**:
- Reuses existing ISRC-to-UUID hashing
- Single Qdrant call per track (or batch for albums)
- Consistent with existing patterns

**Code Pattern**:
```typescript
// services/search-index/src/client/existence.ts
export async function checkTracksExist(isrcs: string[]): Promise<Map<string, boolean>> {
  const client = createQdrantClient();
  const ids = isrcs.map(hashIsrcToUuid);

  const result = await client.retrieve(COLLECTION_NAME, { ids, with_payload: false });

  const existenceMap = new Map<string, boolean>();
  isrcs.forEach((isrc, i) => {
    existenceMap.set(isrc, result.some(r => r.id === ids[i]));
  });

  return existenceMap;
}
```

---

### 4. Inngest Idempotency Configuration

**Context**: Need to ensure duplicate events don't trigger redundant ingestion.

**Finding**: The existing `trackIngestion` function uses `idempotency: "event.data.isrc"` which creates a 24-hour deduplication window keyed by ISRC.

**Decision**: Rely on existing idempotency configuration. No changes needed to worker.

**Rationale**:
- Already configured in `services/worker/src/inngest/functions/trackIngestion.ts`
- 24-hour window sufficient for typical use cases
- Force flag available if re-ingestion needed

---

### 5. Error Handling Strategy

**Context**: Scheduling failures should not block library additions.

**Finding**: Current `libraryService.ts` uses try/catch with custom error types. Scheduling should follow same pattern.

**Decision**: Fire-and-forget scheduling with error logging.

**Rationale**:
- Library addition is the primary user action
- Scheduling is background optimization
- Logged errors can be monitored/retried manually

**Pattern**:
```typescript
// After successful save in libraryService
try {
  await this.ingestionScheduler.scheduleTrack(trackData);
} catch (error) {
  logger.error('ingestion_scheduling_failed', {
    isrc: trackData.isrc,
    error: String(error),
  });
  // Don't rethrow - library save succeeded
}
```

---

### 6. Album Track Scheduling Performance

**Context**: Albums can have 100+ tracks; need to schedule efficiently.

**Finding**: Inngest `send()` method accepts arrays of events for batch sending.

**Decision**: Batch send all track ingestion events for an album in a single Inngest call.

**Rationale**:
- Single API call to Inngest instead of N calls
- Inngest handles individual event processing
- Respects existing throttle limits (10/minute)

**Pattern**:
```typescript
await inngest.send(
  tracks.map(track => ({
    name: "track/ingestion.requested",
    data: { isrc: track.isrc, title: track.title, artist, album },
  }))
);
```

---

## Summary of Decisions

| Topic | Decision |
|-------|----------|
| ISRC for album tracks | Extend `getAlbumTrackListing` to include ISRC |
| Inngest client | Create separate client in backend with inline schema |
| Existence check | Add utility to search-index service, batch check by ISRC |
| Idempotency | Rely on existing worker configuration (24h window) |
| Error handling | Fire-and-forget with logging; don't block library save |
| Album batch | Use `inngest.send()` with array for batch scheduling |

## Dependencies Identified

- `inngest` package needs to be added to backend `package.json`
- `@qdrant/js-client-rest` already in search-index, may need path alias or local import
- `zod` already in backend dependencies
