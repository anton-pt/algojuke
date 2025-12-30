# Tasks: Library Ingestion Scheduling

**Input**: Design documents from `/specs/007-library-ingestion-scheduling/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend API**: `backend/src/`
- **Search Index Service**: `services/search-index/src/`
- **Worker Service**: `services/worker/src/` (reference only - no modifications)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add required dependencies and create project structure

- [x] T001 Add `inngest` package to backend dependencies in `backend/package.json`
- [x] T002 [P] Add `@qdrant/js-client-rest` package to backend dependencies in `backend/package.json`
- [x] T003 [P] Create clients directory structure at `backend/src/clients/`
- [x] T004 Run `npm install` in `backend/` to install new dependencies

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Create Inngest client for backend in `backend/src/clients/inngestClient.ts` with typed event schema for `track/ingestion.requested`
- [x] T006 [P] Create ISRC validation utility function in `backend/src/utils/isrc.ts` matching the 12-character ISO 3901 format
- [x] T007 [P] Create hashIsrcToUuid utility in `backend/src/utils/isrcHash.ts` using SHA-256 with namespace UUID (copy pattern from `services/worker/src/inngest/functions/trackIngestion.ts`)
- [x] T008 Create Qdrant client for backend in `backend/src/clients/qdrantClient.ts` with `checkTracksExist(isrcs: string[])` method that returns `Map<string, boolean>` - this is a new backend client (not importing from search-index service)
- [x] T009 Update `TrackInfo` interface in `backend/src/entities/LibraryAlbum.ts` to add optional `isrc?: string` field
- [x] T010 Define structured logging format for ingestion scheduling in `backend/src/utils/logger.ts` with fields: `event`, `isrc`, `trackTitle`, `result`, `reason`, `error`, `duration_ms`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Automatic Track Ingestion on Library Addition (Priority: P1) 🎯 MVP

**Goal**: When a user adds a track to their library, automatically schedule it for ingestion into the search index

**Independent Test**: Add a track via GraphQL mutation, verify ingestion task appears in Inngest dashboard with correct ISRC, title, artist, album

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T011 [P] [US1] Contract test for `IngestionScheduler.scheduleTrack()` in `backend/tests/services/ingestionScheduler.test.ts` - verify interface accepts TrackIngestionRequest, returns TrackSchedulingResult
- [x] T012 [P] [US1] Integration test for track addition → ingestion scheduling in `backend/tests/integration/libraryIngestion.test.ts` - mock Inngest, verify event sent

### Implementation for User Story 1

- [x] T013 [US1] Create `IngestionScheduler` class skeleton in `backend/src/services/ingestionScheduler.ts` implementing `IIngestionScheduler` interface from contracts
- [x] T014 [US1] Implement `scheduleTrack(request: TrackIngestionRequest)` method in `backend/src/services/ingestionScheduler.ts` that checks Qdrant existence via `checkTracksExist()` from T008, then sends to Inngest
- [x] T015 [US1] Add structured logging for track scheduling in `backend/src/services/ingestionScheduler.ts` using format from T010 (events: `ingestion_scheduled`, `ingestion_skipped`, `ingestion_error`)
- [x] T016 [US1] Add warning log when track has missing/invalid ISRC in `backend/src/services/ingestionScheduler.ts` (event: `ingestion_skipped`, reason: `missing_isrc` or `invalid_isrc`) per FR-011
- [x] T017 [US1] Inject `IngestionScheduler` dependency into `LibraryService` constructor in `backend/src/services/libraryService.ts`
- [x] T018 [US1] Call `scheduleTrack` after successful track save in `LibraryService.addTrackToLibrary()` method in `backend/src/services/libraryService.ts` (fire-and-forget pattern)
- [x] T019 [US1] Update server context in `backend/src/server.ts` to instantiate and provide `IngestionScheduler` to `LibraryService`

**Checkpoint**: User Story 1 complete - single track additions trigger ingestion scheduling

---

## Phase 4: User Story 2 - Album Addition Triggers Track Ingestion (Priority: P1)

**Goal**: When a user adds an album, automatically schedule ingestion for all tracks on that album

**Independent Test**: Add an album with 12 tracks via GraphQL mutation, verify 12 separate ingestion tasks appear in Inngest dashboard

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T020 [P] [US2] Contract test for `IngestionScheduler.scheduleAlbumTracks()` in `backend/tests/services/ingestionScheduler.test.ts` - verify returns BatchSchedulingResult with individual results per track
- [x] T021 [P] [US2] Integration test for album addition → batch ingestion scheduling in `backend/tests/integration/libraryIngestion.test.ts` - mock Inngest, verify N separate events sent (one per track, not batched)

### Implementation for User Story 2

- [x] T022 [US2] Add `batchFetchTrackIsrcs(tidalIds: string[], countryCode?: string)` method to `TidalService` in `backend/src/services/tidalService.ts` using batch tracks API with 20-track chunks
- [x] T023 [US2] Implement `scheduleAlbumTracks(request: AlbumTracksIngestionRequest)` method in `backend/src/services/ingestionScheduler.ts` with batch Qdrant check via `checkTracksExist()` from T008, then individual Inngest event per track
- [x] T024 [US2] Add error log when album track listing is missing/unavailable in `backend/src/services/libraryService.ts` (event: `album_track_listing_error`) per FR-012
- [x] T025 [US2] Update `LibraryService.addAlbumToLibrary()` in `backend/src/services/libraryService.ts` to fetch ISRCs via `batchFetchTrackIsrcs` after getting track listing
- [x] T026 [US2] Store ISRCs in `trackListing` when saving album to database in `backend/src/services/libraryService.ts`
- [x] T027 [US2] Call `scheduleAlbumTracks` after successful album save in `LibraryService.addAlbumToLibrary()` in `backend/src/services/libraryService.ts` (fire-and-forget pattern)
- [x] T028 [US2] Add structured logging for album batch scheduling in `backend/src/services/ingestionScheduler.ts` (event: `album_ingestion_batch`, fields: `total_tracks`, `scheduled_count`, `skipped_count`)

**Checkpoint**: User Story 2 complete - album additions trigger ingestion for all tracks

---

## Phase 5: User Story 3 - Idempotent Scheduling Prevents Duplicate Ingestion (Priority: P1)

**Goal**: Ensure the same track is never ingested twice, even if added multiple times or via different albums

**Independent Test**: Add same track twice, verify only one ingestion task exists in Inngest; add album containing previously-added track, verify no duplicate task

### Tests for User Story 3 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T029 [P] [US3] Unit test for ISRC normalization in `backend/tests/services/ingestionScheduler.test.ts` - verify "usrc12345678" normalizes to "USRC12345678"
- [x] T030 [P] [US3] Unit test for duplicate detection via Qdrant mock in `backend/tests/services/ingestionScheduler.test.ts` - verify scheduleTrack returns `already_indexed` when track exists

### Implementation for User Story 3

- [x] T031 [US3] Verify Inngest idempotency key configuration in `services/worker/src/inngest/functions/trackIngestion.ts` uses `event.data.isrc` (read-only verification - document finding)
- [x] T032 [US3] Add ISRC normalization (uppercase) in `IngestionScheduler.scheduleTrack()` in `backend/src/services/ingestionScheduler.ts` before Qdrant check and Inngest send

**Checkpoint**: User Story 3 complete - idempotency enforced at scheduling layer

---

## Phase 6: User Story 4 - Skip Ingestion for Already-Indexed Tracks (Priority: P2)

**Goal**: Check vector index before scheduling and skip tracks that already exist

**Independent Test**: Manually insert track document into Qdrant with specific ISRC, add track with same ISRC to library, verify no ingestion task scheduled

### Tests for User Story 4 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T033 [P] [US4] Integration test in `backend/tests/integration/libraryIngestion.test.ts` verifying tracks existing in Qdrant are not scheduled (setup: seed Qdrant with test ISRC)

### Implementation for User Story 4

- [x] T034 [US4] Add logging for skipped tracks (already indexed) in `IngestionScheduler` in `backend/src/services/ingestionScheduler.ts` (event: `ingestion_skipped`, reason: `already_indexed`) per FR-008

**Checkpoint**: User Story 4 complete - existing tracks are skipped

---

## Phase 7: User Story 5 - Graceful Handling of Scheduling Failures (Priority: P3)

**Goal**: Library operations succeed even when ingestion scheduling fails; failures are logged appropriately

**Independent Test**: Simulate Inngest unavailability, add track to library, verify track is saved but error is logged

### Tests for User Story 5 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T035 [P] [US5] Unit test in `backend/tests/services/ingestionScheduler.test.ts` verifying fire-and-forget pattern - mock Inngest to throw, verify no exception propagates to caller
- [x] T036 [P] [US5] Unit test in `backend/tests/services/ingestionScheduler.test.ts` verifying fail-open on Qdrant error - mock Qdrant to throw, verify empty map returned and scheduling proceeds

### Implementation for User Story 5

- [x] T037 [US5] Add try/catch wrapper around scheduling calls in `LibraryService.addTrackToLibrary()` in `backend/src/services/libraryService.ts` with error logging
- [x] T038 [US5] Add try/catch wrapper around scheduling calls in `LibraryService.addAlbumToLibrary()` in `backend/src/services/libraryService.ts` with error logging
- [x] T039 [US5] Implement fail-open behavior in `IngestionScheduler.checkTracksExist()` in `backend/src/services/ingestionScheduler.ts` - return empty map on Qdrant error per FR-013
- [x] T040 [US5] Add structured error logging in `IngestionScheduler` for all failure modes in `backend/src/services/ingestionScheduler.ts` (events: `qdrant_error`, `inngest_error`, `validation_error`)

**Checkpoint**: User Story 5 complete - graceful degradation implemented

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and validation

- [x] T041 [P] Verify type safety across all new files with `npm run type-check` in `backend/`
- [x] T042 [P] Run all tests with `npm test` in `backend/`
- [x] T043 Run quickstart.md validation: manually test track addition → verify Inngest event → verify Qdrant document after ingestion completes
- [x] T044 Update `CLAUDE.md` with new service locations and commands if needed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Phase 2 completion
  - Tests MUST be written and failing BEFORE implementation begins
  - US1 and US2 are both P1 but US2 depends on TidalService extension
  - US3 (idempotency) can run in parallel once US1 is complete
  - US4 (index check) depends on US1 for scheduleTrack
  - US5 (error handling) can run after US1/US2
- **Polish (Phase 8)**: Depends on all user story phases

### User Story Dependencies

| Story | Priority | Dependencies | Can Parallelize With |
|-------|----------|--------------|---------------------|
| US1 | P1 | Foundational | None (first) |
| US2 | P1 | Foundational, uses TidalService | US1 (different files) |
| US3 | P1 | US1 (scheduleTrack exists) | US4, US5 |
| US4 | P2 | US1 (checkTracksExist method) | US3, US5 |
| US5 | P3 | US1, US2 (error handling wraps both) | US3, US4 |

### Within Each User Story

- **Tests FIRST**: Write tests, verify they FAIL
- **Then implementation**: Service methods before integration into LibraryService
- Integration before logging/error handling polish

### Parallel Opportunities

**Phase 1** (all parallel):
```
T001, T002, T003 can run together
```

**Phase 2** (partial parallel):
```
T006, T007 can run in parallel (different utility files)
```

**User Stories** (after Phase 2):
```
Within each story: Test tasks marked [P] can run in parallel
US1 and US2 implementation can overlap (different services)
US3, US4, US5 can all proceed in parallel after US1 core is done
```

---

## Parallel Example: User Story 1

```bash
# After Phase 2 is complete, launch US1:

# FIRST: Write tests (parallel)
Task: T011 - Contract test for scheduleTrack
Task: T012 - Integration test for track → ingestion

# Verify tests FAIL (no implementation yet)

# THEN: Implementation (sequential)
Task: T013 - Create IngestionScheduler skeleton
Task: T014 - Implement scheduleTrack (uses checkTracksExist from T008)
Task: T015 - Add structured logging
Task: T016 - Add missing ISRC warning
Task: T017 - Inject into LibraryService
Task: T018 - Call after track save
Task: T019 - Update server context

# Verify tests PASS
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (4 tasks)
2. Complete Phase 2: Foundational (6 tasks)
3. Complete Phase 3: User Story 1 (9 tasks - 2 tests + 7 implementation)
4. **STOP and VALIDATE**: Tests pass, track addition → Inngest event
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Tests pass → Track scheduling works
3. Add User Story 2 → Tests pass → Album scheduling works
4. Add User Story 3 → Tests pass → Idempotency enforced
5. Add User Story 4 → Tests pass → Index check works
6. Add User Story 5 → Tests pass → Graceful failures
7. Polish phase → Full validation

### Suggested MVP Scope

**MVP = Phase 1 + Phase 2 + Phase 3 (User Story 1)**
- Total: 19 tasks
- Delivers: Single track ingestion scheduling with tests
- Value: Core automation working end-to-end

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- **Tests MUST be written FIRST and FAIL before implementation begins** (Constitution Principle I)
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Fire-and-forget pattern means scheduling failures logged but not thrown
- ISRC validation uses `/^[A-Z0-9]{12}$/i` regex (case-insensitive, normalized to uppercase)
- Qdrant existence check uses hashIsrcToUuid from worker service pattern
- Tidal batch API limited to 20 tracks per request - chunk larger albums
- **No timeout concerns**: Ingestion is asynchronous via Inngest; monitor from dashboard. Each track ~20s due to LLM/embedding. Tasks queue with rate limiting. Retry policies defined in worker pipeline.

## Logging Structure

All ingestion scheduling logs use this structured format:

```typescript
{
  event: string,        // e.g., "ingestion_scheduled", "ingestion_skipped", "ingestion_error"
  isrc: string,         // Track ISRC (if available)
  trackTitle?: string,  // Track title (if available)
  result: "success" | "skipped" | "error",
  reason?: string,      // e.g., "already_indexed", "missing_isrc", "invalid_isrc"
  error?: string,       // Error message (if applicable)
  duration_ms?: number, // Operation duration
  // Album batch fields:
  total_tracks?: number,
  scheduled_count?: number,
  skipped_count?: number
}
```
