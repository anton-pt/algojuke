# Feature Specification: Library Ingestion Scheduling

**Feature Branch**: `007-library-ingestion-scheduling`
**Created**: 2025-12-29
**Status**: Draft
**Input**: User description: "Scheduling of ingestion of tracks that the user adds to their library. Tracks and albums that are added to the library via specs/002-library-management/spec.md should automatically be added to the ingestion pipeline defined in specs/006-track-ingestion-pipeline/spec.md. This should apply to all tracks from an album. The ingestion tasks should be scheduled with an idempotency key that ensures that the same track isn't ingested multiple times to avoid excessive API costs. Tracks that have previously been ingested and are already present in the tracks collection defined in specs/004-vector-search-index/spec.md should not be re-ingested."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic Track Ingestion on Library Addition (Priority: P1)

As a music listener, when I add a track to my personal library, I want the system to automatically schedule it for ingestion into the search index so that I can later discover and search for the track by its lyrics, themes, and audio characteristics without any manual intervention.

**Why this priority**: This is the core automation that connects library management to the search index. Without automatic scheduling, users would never have their saved tracks become searchable, defeating the purpose of building a semantic music discovery system.

**Independent Test**: Can be fully tested by adding a track to the library via the library management system and verifying that an ingestion task is queued in the background task system with the correct track metadata (ISRC, title, artist, album).

**Acceptance Scenarios**:

1. **Given** I have searched for a track on Tidal and am viewing the results, **When** I add a track to my library, **Then** the system automatically schedules an ingestion task for that track within 5 seconds
2. **Given** I add a track to my library, **When** the ingestion task is scheduled, **Then** the task payload includes the track's ISRC, title, artist name, and album name
3. **Given** I add a track to my library, **When** I check the background task queue, **Then** I can see the pending ingestion task for that track

---

### User Story 2 - Album Addition Triggers Track Ingestion (Priority: P1)

As a music listener, when I add an entire album to my library, I want all tracks from that album to be automatically scheduled for ingestion so that every song on the album becomes searchable.

**Why this priority**: Album additions are a primary way users build their library. Each track on the album needs to be individually searchable by its unique lyrics and audio features, requiring individual ingestion tasks for each track.

**Independent Test**: Can be fully tested by adding an album with multiple tracks to the library and verifying that ingestion tasks are scheduled for each track on the album.

**Acceptance Scenarios**:

1. **Given** I have searched for an album on Tidal, **When** I add the album to my library, **Then** the system schedules ingestion tasks for every track on that album
2. **Given** an album with 12 tracks is added to my library, **When** checking the background task queue, **Then** 12 separate ingestion tasks are queued (one per track)
3. **Given** I add an album to my library, **When** the ingestion tasks are scheduled, **Then** each task includes the correct metadata for its respective track (ISRC, title, artist, album)

---

### User Story 3 - Idempotent Scheduling Prevents Duplicate Ingestion (Priority: P1)

As a system administrator, I need the scheduling mechanism to use idempotency keys so that if a user adds the same track multiple times (either directly or as part of different albums), the track is only ingested once, preventing wasted API calls and unnecessary processing costs.

**Why this priority**: Without idempotency, re-adding a track or adding an album containing a previously-added track would trigger redundant ingestion, wasting Anthropic API credits, Musixmatch API quota, and ReccoBeats requests. This protection is critical for cost control.

**Independent Test**: Can be tested by adding the same track twice (or adding a track then adding an album containing that track) and verifying only one ingestion task runs.

**Acceptance Scenarios**:

1. **Given** I have already added a track to my library, **When** I attempt to add the same track again, **Then** no new ingestion task is scheduled (duplicate is prevented by idempotency key)
2. **Given** I have added an individual track to my library, **When** I later add an album containing that track, **Then** the track is not re-scheduled for ingestion
3. **Given** I add an album containing tracks I've previously added individually, **When** checking the background task queue, **Then** only tracks not previously scheduled have new tasks

---

### User Story 4 - Skip Ingestion for Already-Indexed Tracks (Priority: P2)

As a system administrator, I want the system to check whether a track already exists in the search index before scheduling ingestion so that tracks that have already been fully processed are not redundantly re-ingested.

**Why this priority**: Even with idempotent scheduling, tracks may have been ingested in previous sessions or by other means. Checking the index before scheduling provides an additional layer of protection against redundant processing.

**Independent Test**: Can be tested by manually inserting a track document into the vector index, then adding that track to the library, and verifying no ingestion task is scheduled.

**Acceptance Scenarios**:

1. **Given** a track already exists in the vector search index (by ISRC), **When** I add that track to my library, **Then** no ingestion task is scheduled for that track
2. **Given** an album is added to the library where some tracks already exist in the index, **When** ingestion tasks are scheduled, **Then** only tracks not present in the index are scheduled
3. **Given** a track exists in the index, **When** checking system logs after adding that track to library, **Then** a message indicates the track was skipped because it's already indexed

---

### User Story 5 - Graceful Handling of Scheduling Failures (Priority: P3)

As a system administrator, I need the system to handle failures gracefully when scheduling ingestion tasks so that library operations are not blocked and users receive appropriate feedback.

**Why this priority**: While the background task queue should be reliable, network issues or service unavailability can occur. Users should still be able to manage their library even if ingestion scheduling temporarily fails.

**Independent Test**: Can be tested by simulating a background task queue unavailability and verifying that library addition still succeeds with appropriate error logging.

**Acceptance Scenarios**:

1. **Given** the background task queue is unavailable, **When** I add a track to my library, **Then** the library addition succeeds but the system logs an error about failed ingestion scheduling
2. **Given** ingestion scheduling fails for a track, **When** I check the library, **Then** the track is present in my library (addition was not rolled back)
3. **Given** scheduling fails for some tracks in an album, **When** the operation completes, **Then** successfully scheduled tracks proceed and failed ones are logged for retry

---

### Edge Cases

- **Track has no ISRC**: Skip ingestion scheduling for tracks without ISRC identifiers (cannot be looked up in external APIs). Log a warning.
- **Album track listing unavailable**: If album metadata doesn't include track details, log an error and skip track scheduling for that album.
- **Vector index unavailable during pre-check**: If the index cannot be queried to check existing tracks, proceed with scheduling (let the ingestion pipeline handle duplicates via upsert).
- **Partial album track failures**: If some tracks from an album fail to schedule, continue scheduling remaining tracks and log failures.
- **Race condition on duplicate adds**: If the same track is added twice nearly simultaneously, idempotency key ensures only one ingestion runs.
- **Track removed before ingestion completes**: The ingestion pipeline completes independently; removing a track from the library does not cancel pending ingestion.
- **Very large albums (100+ tracks)**: System should handle bulk scheduling without timeout; tasks are queued individually with no batch size limit. Note: Ingestion is fully asynchronous via Inngest. Each track ingestion takes ~20 seconds (LLM + embedding). Tasks queue and execute with rate limiting per the worker pipeline's throttle configuration. Progress is monitored via Inngest dashboard. Retry policies are defined in the ingestion pipeline (006-track-ingestion-pipeline), not in scheduling.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST automatically schedule an ingestion task when a track is added to the user's library
- **FR-002**: System MUST automatically schedule ingestion tasks for all tracks when an album is added to the user's library
- **FR-003**: System MUST use the track's ISRC as the basis for generating an idempotency key to prevent duplicate task scheduling
- **FR-004**: System MUST include track metadata (ISRC, title, artist name, album name) in the ingestion task payload
- **FR-005**: System MUST check the vector search index for existing track documents (by ISRC) before scheduling ingestion
- **FR-006**: System MUST NOT schedule ingestion for tracks that already exist in the vector search index
- **FR-007**: System MUST schedule ingestion within 5 seconds of a library addition operation completing
- **FR-008**: System MUST log a warning when skipping ingestion for tracks already present in the index
- **FR-009**: System MUST log an error when ingestion scheduling fails, including the track's ISRC and failure reason
- **FR-010**: System MUST NOT block or roll back library addition operations if ingestion scheduling fails
- **FR-011**: System MUST skip scheduling for tracks without valid ISRC identifiers and log a warning
- **FR-012**: System MUST handle album additions with missing track listings by logging an error and proceeding with available tracks
- **FR-013**: System MUST proceed with scheduling if the vector index is unavailable for pre-checks (fail-open for index unavailability)
- **FR-014**: System MUST schedule individual tasks for each track (no batch ingestion tasks)

### Key Entities

- **Library Addition Event**: Represents the action of a user adding a track or album to their library. Contains item type (track/album), item identifier, and associated metadata.
- **Ingestion Task**: A background job scheduled to process a single track through the ingestion pipeline. Contains ISRC, title, artist, album, and idempotency key.
- **Idempotency Key**: A unique identifier derived from the track's ISRC that prevents duplicate task scheduling. Format: deterministic hash or direct ISRC value.
- **Index Existence Check**: A query to the vector search index to determine if a track document already exists by ISRC, used to skip unnecessary ingestion.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of tracks added to the library (either individually or as part of albums) have ingestion scheduled within 5 seconds, unless already indexed
- **SC-002**: Zero duplicate ingestion tasks are executed for the same track, regardless of how many times the track is added to the library
- **SC-003**: Tracks already present in the vector index result in zero scheduled ingestion tasks (100% skip rate for indexed tracks)
- **SC-004**: Library addition operations complete successfully even when ingestion scheduling fails (0% rollback rate due to scheduling failures)
- **SC-005**: For album additions with N tracks where M are already indexed, exactly N-M ingestion tasks are scheduled
- **SC-006**: System logs all skipped tracks (already indexed) and all scheduling failures with sufficient detail for debugging

## Assumptions

- The library management system (002-library-management) provides a hook or event mechanism for detecting library additions
- The track ingestion pipeline (006-track-ingestion-pipeline) accepts tasks with ISRC and metadata payload as documented
- The vector search index (004-vector-search-index) supports efficient lookup by ISRC to check for existing documents
- Album metadata from Tidal includes track listings with individual track ISRCs, titles, artists, and durations
- The background task queue (003-background-task-queue) supports idempotency keys for preventing duplicate task execution
- Track ISRCs are unique and stable identifiers from Tidal that do not change over time
- The ingestion pipeline handles upsert semantics, so if a duplicate somehow gets scheduled, it updates rather than creates duplicate entries

## Dependencies

- **specs/002-library-management**: Provides library addition events/hooks and album track listing data
- **specs/003-background-task-queue**: Provides Inngest-based task scheduling with idempotency key support
- **specs/004-vector-search-index**: Provides ISRC-based lookup to check for existing track documents
- **specs/006-track-ingestion-pipeline**: Provides the ingestion function that processes scheduled tracks

## Scope Boundaries

### In Scope

- Automatic scheduling of ingestion tasks when tracks/albums are added to library
- Idempotency key generation to prevent duplicate task scheduling
- Pre-check against vector index to skip already-indexed tracks
- Error handling and logging for scheduling failures
- Support for both individual track and album additions

### Out of Scope

- Modifications to the ingestion pipeline itself (uses existing 006-track-ingestion-pipeline)
- Retry mechanisms for failed scheduling (handled by error logging only)
- User interface for viewing scheduled/pending ingestion tasks
- Manual triggering of re-ingestion for existing tracks
- Cancellation of pending ingestion when tracks are removed from library
- Batch scheduling optimizations (individual tasks per track)
- Priority ordering of ingestion tasks (FIFO default from task queue)
