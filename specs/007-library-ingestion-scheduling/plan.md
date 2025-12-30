# Implementation Plan: Library Ingestion Scheduling

**Branch**: `007-library-ingestion-scheduling` | **Date**: 2025-12-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-library-ingestion-scheduling/spec.md`

## Summary

Implement automatic scheduling of track ingestion tasks when users add tracks or albums to their personal library. The system integrates the existing library management GraphQL mutations with the Inngest-based background task queue to schedule `track/ingestion.requested` events with ISRC-based idempotency keys. Before scheduling, the system checks both the Qdrant vector index and Inngest's built-in idempotency to prevent duplicate ingestion.

## Technical Context

**Language/Version**: TypeScript 5.3.3 / Node.js 20.x
**Primary Dependencies**: Apollo Server 4.x (GraphQL), TypeORM, Inngest 3.22.12, @qdrant/js-client-rest, axios 1.6+
**Storage**: PostgreSQL (library data via TypeORM), Qdrant (vector index existence checks), Inngest (task queue)
**Testing**: Vitest 1.x, Apollo Client (GraphQL testing)
**Target Platform**: Local development (Docker services)
**Project Type**: Web application (backend GraphQL API + worker service)
**Performance Goals**: Scheduling within 5 seconds of library addition
**Constraints**: Non-blocking library additions; graceful degradation on scheduling failures
**Scale/Scope**: Support albums with 100+ tracks without timeout

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First Development | ✅ Pass | Contract tests for ingestion scheduling service, integration tests for GraphQL mutations |
| II. Code Quality Standards | ✅ Pass | Simple integration layer; minimal new abstractions; reuses existing Inngest/Qdrant clients |
| III. User Experience Consistency | ✅ Pass | Non-blocking library additions; clear error logging; graceful degradation |
| IV. Robust Architecture | ✅ Pass | Fail-open for index unavailability; idempotency prevents duplicates; structured logging |
| V. Security by Design | ✅ Pass | No new external inputs; uses existing authenticated services |

## Project Structure

### Documentation (this feature)

```text
specs/007-library-ingestion-scheduling/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── services/
│   │   ├── libraryService.ts         # MODIFY: Add ingestion scheduling after save
│   │   └── ingestionScheduler.ts     # NEW: Ingestion scheduling service
│   ├── clients/
│   │   └── inngestClient.ts          # NEW: Inngest client for backend
│   ├── resolvers/
│   │   └── library.ts                # VERIFY: Error handling unchanged
│   └── types/
│       └── errors.ts                 # VERIFY: May add IngestionSchedulingError
└── tests/
    ├── services/
    │   └── ingestionScheduler.test.ts  # NEW: Unit tests
    └── integration/
        └── libraryIngestion.test.ts    # NEW: Integration tests

services/search-index/
└── src/
    └── client/
        └── qdrant.ts                 # REFERENCE: Pattern for Qdrant client (not imported)

# NOTE: Backend creates its own Qdrant client (backend/src/clients/qdrantClient.ts)
# rather than importing from search-index service to avoid cross-service dependencies
```

**Structure Decision**: Extend existing web application structure. The ingestion scheduling logic is added to the backend service since it must run synchronously (within 5s) after library additions. The scheduling service is a simple adapter between LibraryService and Inngest.

## Complexity Tracking

No complexity violations. The implementation:
- Reuses existing Inngest client pattern from worker service
- Reuses existing Qdrant client from search-index service
- Adds minimal new code (IngestionScheduler service ~150 LOC)
- No new abstractions or patterns introduced

## Implementation Approach

### Integration Points

1. **Library Service → Inngest**: After successful track/album save, call IngestionScheduler
2. **IngestionScheduler → Qdrant**: Check if track already exists by ISRC before scheduling
3. **IngestionScheduler → Inngest**: Send `track/ingestion.requested` event with idempotency key

### Key Design Decisions

1. **ISRC Source for Album Tracks**: Current `TrackInfo` interface lacks ISRC. Options:
   - **Option A (Selected)**: Use Tidal batch tracks API `/v2/tracks?filter[id]=...` to fetch ISRCs
   - Chunks requests into batches of 20 tracks (Tidal API limit)
   - Most albums complete in single API call
   - Option B: Make separate API calls per track (rejected - inefficient)

2. **Scheduling Pattern**: Fire-and-forget with logging
   - Scheduling failures logged but don't rollback library addition
   - Inngest idempotency (24-hour window, keyed by ISRC) prevents duplicates

3. **Index Existence Check**: Query Qdrant by ISRC before scheduling
   - Fail-open: If Qdrant unavailable, proceed with scheduling (ingestion pipeline handles upsert)
   - Batch check for album tracks to minimize API calls

4. **Inngest Client Location**: Create separate client in backend service
   - Cannot import from worker service (different package)
   - Share event type definitions via common types package (future) or inline

## Generated Artifacts

| Artifact | Description |
|----------|-------------|
| [research.md](./research.md) | Technical research findings and decisions |
| [data-model.md](./data-model.md) | Entity changes and data flow diagrams |
| [contracts/ingestion-scheduler.ts](./contracts/ingestion-scheduler.ts) | IngestionScheduler service interface |
| [contracts/track-existence.ts](./contracts/track-existence.ts) | Qdrant existence check interface |
| [contracts/tidal-batch-isrc.ts](./contracts/tidal-batch-isrc.ts) | Tidal API batch ISRC fetching interface |
| [quickstart.md](./quickstart.md) | Developer setup and testing guide |

## Next Steps

Run `/speckit.tasks` to generate the implementation task list based on this plan.
