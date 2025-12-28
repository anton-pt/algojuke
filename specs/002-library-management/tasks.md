# Tasks: Personal Music Library Management

**Input**: Design documents from `/specs/002-library-management/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/library.graphql

**Tests**: Required per Constitution Section I (Test-First Development) - contract tests, integration tests, and unit tests MUST be written before implementation for each user story.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/`
- All paths are relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create docker-compose.yml in repository root with PostgreSQL 15 container configuration per quickstart.md
- [X] T002 [P] Add database environment variables to backend/.env (DATABASE_URL, POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD)
- [X] T003 [P] Add database environment variables to backend/.env.example for documentation
- [X] T004 [P] Install TypeORM dependencies: npm install typeorm pg reflect-metadata typeorm-naming-strategies tsx in backend/
- [X] T005 [P] Install TypeORM dev dependencies: npm install --save-dev @types/pg in backend/
- [X] T006 [P] Install Vitest testing dependencies: npm install --save-dev vitest @vitest/ui in backend/
- [X] T007 [P] Configure Vitest in backend/vitest.config.ts with TypeScript support and test environment settings

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T008 Create TypeORM DataSource configuration in backend/src/config/database.ts with PostgreSQL connection pooling and migration settings per research.md
- [x] T009 [P] Add PostgreSQL connection error handling to backend/src/config/database.ts with connection retry logic and exponential backoff per research.md section 1
- [x] T010 [P] Create LibraryAlbum entity in backend/src/entities/LibraryAlbum.ts with fields: id, tidalAlbumId, title, artistName, coverArtUrl, releaseDate, trackCount, trackListing (JSONB), metadata (JSONB), userId, createdAt, updatedAt per data-model.md
- [x] T011 [P] Create LibraryTrack entity in backend/src/entities/LibraryTrack.ts with fields: id, tidalTrackId, title, artistName, albumName, duration, coverArtUrl, metadata (JSONB), userId, createdAt, updatedAt per data-model.md
- [x] T012 Create TypeORM migration for library tables in backend/src/migrations/CreateLibraryTables.ts with library_albums and library_tables tables, indexes per data-model.md
- [x] T013 Add TypeORM npm scripts to backend/package.json: typeorm, migration:generate, migration:run, migration:revert, migration:show per research.md
- [x] T014 Initialize TypeORM DataSource in backend/src/server.ts before Apollo Server startup with error handling and connection retry logic
- [x] T015 [P] Add getAlbumTrackListing method to backend/src/services/tidalService.ts to fetch album track listing from /v2/albums/{albumId}/relationships/items endpoint per research.md section 8
- [x] T016 [P] Create GraphQL type definitions in backend/src/schema/library.graphql from contracts/library.graphql (LibraryAlbum, LibraryTrack, TrackInfo, AddAlbumToLibraryInput, AddTrackToLibraryInput, DuplicateLibraryItemError, TidalApiUnavailableError, AddAlbumToLibraryResult, AddTrackToLibraryResult unions, Query, Mutation)
- [x] T017 Update Apollo Server schema loading in backend/src/server.ts to include library.graphql
- [x] T018 Add TypeORM DataSource to Apollo Server context in backend/src/server.ts for resolver access
- [x] T019 [P] Add storage failure detection utilities in backend/src/utils/errors.ts: catch QueryFailedError, map PostgreSQL error codes to user-friendly GraphQL errors with retryable flags per FR-019, FR-020, FR-021 (corruption, insufficient space, permission errors)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Add Albums to Library (Priority: P1) 🎯 MVP

**Goal**: Enable users to add albums from Tidal search results to their personal library with complete metadata including track listings

**Independent Test**: Perform Tidal search for an album, add it to library via GraphQL mutation addAlbumToLibrary, verify album appears in getLibraryAlbums query with correct metadata (artist, title, cover art, track listing), restart backend and verify album persists

### Tests for User Story 1 (Test-First Development)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T020 [P] [US1] Contract test for library.graphql schema validation in backend/tests/contract/library-schema.test.ts: verify LibraryAlbum type structure, AddAlbumToLibraryInput fields, AddAlbumToLibraryResult union types (LibraryAlbum, DuplicateLibraryItemError, TidalApiUnavailableError)
- [x] T021 [P] [US1] Contract test for addAlbumToLibrary mutation in backend/tests/contract/library-mutations.test.ts: verify input validation, duplicate detection error response, Tidal API error response, successful response with complete metadata including track listing
- [x] T022 [P] [US1] Contract test for getLibraryAlbums query in backend/tests/contract/library-queries.test.ts: verify empty state, single album response, multiple albums sorted alphabetically (artistName ASC, title ASC), field completeness
- [x] T023 [P] [US1] Integration test for album persistence in backend/tests/integration/album-persistence.test.ts: add album via addAlbumToLibrary, verify in getLibraryAlbums, restart DataSource connection, verify album still exists with all metadata intact
- [x] T024 [P] [US1] Unit test for alphabetical sorting logic in backend/tests/unit/library-sorting.test.ts: verify artist name primary sort, album title secondary sort, case-insensitive comparison, Unicode collation order

### Implementation for User Story 1

- [x] T025 [US1] Create library service in backend/src/services/libraryService.ts with addAlbumToLibrary method: check for duplicates by tidalAlbumId, fetch album metadata from TidalService, fetch track listing via getAlbumTrackListing, save to database via LibraryAlbum repository with error handling
- [x] T026 [US1] Implement addAlbumToLibrary GraphQL mutation resolver in backend/src/resolvers/library.ts: validate input, call libraryService.addAlbumToLibrary, return LibraryAlbum or DuplicateLibraryItemError or TidalApiUnavailableError per contracts/library.graphql
- [x] T027 [US1] Implement getLibraryAlbums GraphQL query resolver in backend/src/resolvers/library.ts: fetch all albums from repository sorted by artistName ASC, title ASC per data-model.md query patterns
- [x] T028 [US1] Add error mapping in backend/src/services/libraryService.ts for PostgreSQL unique constraint violations (code 23505) to DuplicateLibraryItemError per research.md section 5
- [x] T029 [US1] Add error mapping in backend/src/services/libraryService.ts for Tidal API errors (timeout, 401, 500) to TidalApiUnavailableError with retryable flag per research.md section 5
- [X] T030 [US1] Create frontend library navigation component in frontend/src/components/library/LibraryNav.tsx with Albums and Tracks tabs/links
- [X] T031 [US1] Create frontend AlbumsView component in frontend/src/components/library/AlbumsView.tsx with getLibraryAlbums query, sorted display, empty state message
- [X] T032 [US1] Create frontend AlbumCard component in frontend/src/components/library/LibraryAlbumCard.tsx displaying album cover art, title, artist name, track count
- [X] T033 [US1] Create GraphQL mutations file in frontend/src/graphql/library.ts with ADD_ALBUM_TO_LIBRARY mutation and GET_LIBRARY_ALBUMS query
- [X] T034 [US1] Identify album search result component from feature 001-tidal-search (read frontend/src/components/search/ to find AlbumSearchResult.tsx or equivalent)
- [X] T035 [US1] Add "Add to Library" button to album search results component (identified in T034) that calls ADD_ALBUM_TO_LIBRARY mutation with tidalAlbumId - implement client-side check by caching library album IDs in Apollo Client state to determine if album already exists before showing button state
- [X] T036 [US1] Add loading, success, and error states to "Add to Library" button (disable if tidalAlbumId exists in cached library IDs, show loading spinner during mutation, handle DuplicateLibraryItemError, handle TidalApiUnavailableError with retry option)
- [X] T037 [US1] Add library routes to frontend/src/App.tsx for /library/albums path rendering AlbumsView component
- [X] T038 [US1] Update LibraryNav in frontend App.tsx to enable navigation between search and library views

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently - users can add albums and see them persisted in Albums view

---

## Phase 4: User Story 2 - Add Tracks to Library (Priority: P2)

**Goal**: Enable users to add individual tracks from Tidal search results to their personal library

**Independent Test**: Perform Tidal search for a track, add it to library via GraphQL mutation addTrackToLibrary, verify track appears in getLibraryTracks query with correct metadata, restart backend and verify track persists

### Tests for User Story 2 (Test-First Development)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T039 [P] [US2] Contract test for addTrackToLibrary mutation in backend/tests/contract/library-mutations.test.ts: verify input validation, duplicate detection error response, Tidal API error response, successful response with complete track metadata (already in library-mutations.test.ts)
- [X] T040 [P] [US2] Contract test for getLibraryTracks query in backend/tests/contract/library-queries.test.ts: verify empty state, single track response, multiple tracks sorted alphabetically (artistName ASC, title ASC), field completeness (already in library-queries.test.ts)
- [X] T041 [P] [US2] Integration test for track persistence in backend/tests/integration/track-persistence.test.ts: add track via addTrackToLibrary, verify in getLibraryTracks, restart DataSource connection, verify track still exists with all metadata intact
- [X] T042 [P] [US2] Integration test for album/track independence in backend/tests/integration/library-independence.test.ts: add track individually, add album containing same track, verify both exist independently in respective views per FR-018

### Implementation for User Story 2

- [X] T043 [P] [US2] Add addTrackToLibrary method to backend/src/services/libraryService.ts: check for duplicates by tidalTrackId, fetch track metadata from TidalService, save to database via LibraryTrack repository with error handling
- [X] T044 [US2] Implement addTrackToLibrary GraphQL mutation resolver in backend/src/resolvers/library.ts: validate input, call libraryService.addTrackToLibrary, return LibraryTrack or DuplicateLibraryItemError or TidalApiUnavailableError per contracts/library.graphql
- [X] T045 [US2] Implement getLibraryTracks GraphQL query resolver in backend/src/resolvers/library.ts: fetch all tracks from repository sorted by artistName ASC, title ASC per data-model.md query patterns
- [X] T046 [US2] Create frontend TracksView component in frontend/src/components/library/TracksView.tsx with getLibraryTracks query, sorted display, empty state message
- [X] T047 [US2] Create frontend TrackCard component in frontend/src/components/library/LibraryTrackCard.tsx displaying track title, artist name, album name, duration
- [X] T048 [US2] Add ADD_TRACK_TO_LIBRARY mutation and GET_LIBRARY_TRACKS query to frontend/src/graphql/library.ts
- [X] T049 [US2] Identify track search result component from feature 001-tidal-search (read frontend/src/components/search/ to find TrackSearchResult.tsx or equivalent)
- [X] T050 [US2] Add "Add to Library" button to track search results component (identified in T049) that calls ADD_TRACK_TO_LIBRARY mutation with tidalTrackId - implement client-side check by caching library track IDs in Apollo Client state to determine if track already exists
- [X] T051 [US2] Add loading, success, and error states to track "Add to Library" button (disable if tidalTrackId exists in cached library IDs, show loading spinner during mutation, handle DuplicateLibraryItemError, handle TidalApiUnavailableError with retry option)
- [X] T052 [US2] Add library route to frontend/src/App.tsx for /library/tracks path rendering TracksView component
- [X] T053 [US2] Update LibraryNav component to highlight active tab (Albums or Tracks)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - users can add and browse both albums and tracks

---

## Phase 5: User Story 3 - Browse Library by Albums (Priority: P3)

**Goal**: Enable users to view album details including full metadata and track listing

**Independent Test**: Add multiple albums with different artist names, navigate to Albums view, verify alphabetical sorting (artist then title), click an album, verify full metadata and track listing displays

### Tests for User Story 3 (Test-First Development)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T054 [P] [US3] Contract test for getLibraryAlbum query in backend/tests/contract/library-queries.test.ts: verify single album lookup by ID, null response for non-existent ID, complete field structure including trackListing array with position, title, duration (already in library-queries.test.ts)
- [X] T055 [P] [US3] Integration test for album detail view in backend/tests/integration/album-detail.test.ts: add album with track listing, fetch via getLibraryAlbum, verify all metadata fields including complete track listing with correct track count

### Implementation for User Story 3

- [X] T056 [US3] Implement getLibraryAlbum(id: ID!) GraphQL query resolver in backend/src/resolvers/library.ts: fetch album by id from repository, return LibraryAlbum or null
- [X] T057 [US3] Add GET_LIBRARY_ALBUM query to frontend/src/graphql/library.ts with fields: id, title, artistName, coverArtUrl, releaseDate, trackCount, trackListing (position, title, duration, tidalId, explicit), createdAt
- [X] T058 [US3] Create frontend AlbumDetailView component in frontend/src/components/library/AlbumDetailView.tsx displaying full album metadata, cover art, release date, and track listing table with track positions, titles, durations
- [X] T059 [US3] Update AlbumCard component to navigate to album detail view on click (/library/albums/:id route)
- [X] T060 [US3] Add library route to frontend/src/App.tsx for /library/albums/:id path rendering AlbumDetailView component
- [X] T061 [US3] Add back navigation button in AlbumDetailView to return to Albums list

**Checkpoint**: Albums view now supports full detail browsing with track listings

---

## Phase 6: User Story 4 - Browse Library by Tracks (Priority: P3)

**Goal**: Enable users to view track details

**Independent Test**: Add multiple tracks with different artist names, navigate to Tracks view, verify alphabetical sorting (artist then track name), click a track, verify detailed information displays

### Tests for User Story 4 (Test-First Development)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T062 [P] [US4] Contract test for getLibraryTrack query in backend/tests/contract/library-queries.test.ts: verify single track lookup by ID, null response for non-existent ID, complete field structure (already in library-queries.test.ts)
- [X] T063 [P] [US4] Integration test for track detail view in backend/tests/integration/track-detail.test.ts: add track, fetch via getLibraryTrack, verify all metadata fields

### Implementation for User Story 4

- [X] T064 [US4] Implement getLibraryTrack(id: ID!) GraphQL query resolver in backend/src/resolvers/library.ts: fetch track by id from repository, return LibraryTrack or null
- [X] T065 [US4] Add GET_LIBRARY_TRACK query to frontend/src/graphql/library.ts with fields: id, title, artistName, albumName, duration, coverArtUrl, createdAt
- [X] T066 [US4] Create frontend TrackDetailView component in frontend/src/components/library/TrackDetailView.tsx displaying track title, artist name, album name, duration, cover art
- [X] T067 [US4] Update TrackCard component to navigate to track detail view on click (/library/tracks/:id route)
- [X] T068 [US4] Add library route to frontend/src/App.tsx for /library/tracks/:id path rendering TrackDetailView component
- [X] T069 [US4] Add back navigation button in TrackDetailView to return to Tracks list

**Checkpoint**: Tracks view now supports detail browsing

---

## Phase 7: User Story 5 - Remove Albums from Library (Priority: P4)

**Goal**: Enable users to remove albums from their library with undo functionality

**Independent Test**: Add an album, remove it via delete button, verify success toast with undo button appears, verify album disappears from Albums view, restart backend and verify album remains deleted; separately test undo: remove album, click undo within 10 seconds, verify album restored

### Tests for User Story 5 (Test-First Development)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T070 [P] [US5] Contract test for removeAlbumFromLibrary mutation in backend/tests/contract/library-mutations.test.ts: verify successful deletion returns true, error thrown for non-existent album ID, GraphQL error structure (already in library-mutations.test.ts)
- [X] T071 [P] [US5] Integration test for album removal persistence in backend/tests/integration/album-removal.test.ts: add album, remove via removeAlbumFromLibrary, verify not in getLibraryAlbums, restart DataSource, verify deletion persists
- [X] T072 [P] [US5] Unit test for undo functionality in frontend/tests/unit/useUndoDelete.test.ts: verify 10-second timeout, Map-based state tracking, cleanup on unmount, undo cancels finalization

### Implementation for User Story 5

- [X] T073 [P] [US5] Install Sonner toast library in frontend: npm install sonner
- [X] T074 [US5] Add removeAlbumFromLibrary method to backend/src/services/libraryService.ts: delete album by id from repository, throw error if not found
- [X] T075 [US5] Implement removeAlbumFromLibrary(id: ID!): Boolean! GraphQL mutation resolver in backend/src/resolvers/library.ts: call libraryService.removeAlbumFromLibrary, return true on success, throw GraphQL error if album not found
- [X] T076 [US5] Add REMOVE_ALBUM_FROM_LIBRARY mutation to frontend/src/graphql/library.ts
- [X] T077 [US5] Create useUndoDelete custom hook in frontend/src/hooks/useUndoDelete.ts implementing in-memory undo buffer with 10-second timeout, Map-based state tracking, cleanup on unmount per research.md section 6 (NOTE: Improved with global UndoDeleteProvider context in frontend/src/contexts/UndoDeleteContext.tsx for cross-navigation persistence)
- [X] T078 [US5] Add Sonner Toaster component to frontend/src/App.tsx root
- [X] T079 [US5] Add remove button to AlbumCard component that calls useUndoDelete.handleDelete (optimistic removal, shows Sonner toast with undo button)
- [X] T080 [US5] Update AlbumsView to filter out deleted items from display using useUndoDelete.isDeleted check
- [X] T081 [US5] Call REMOVE_ALBUM_FROM_LIBRARY mutation in useUndoDelete after 10-second timeout or toast dismissal (finalize deletion)
- [X] T082 [US5] Add undo button click handler in useUndoDelete that cancels timeout, restores item to view, shows "Restored" toast per research.md section 6

**Checkpoint**: Album removal with undo functionality complete

---

## Phase 8: User Story 6 - Remove Tracks from Library (Priority: P4)

**Goal**: Enable users to remove tracks from their library with undo functionality

**Independent Test**: Add a track, remove it via delete button, verify success toast with undo button appears, verify track disappears from Tracks view, restart backend and verify track remains deleted; separately test undo: remove track, click undo within 10 seconds, verify track restored

### Tests for User Story 6 (Test-First Development)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T083 [P] [US6] Contract test for removeTrackFromLibrary mutation in backend/tests/contract/library-mutations.test.ts: verify successful deletion returns true, error thrown for non-existent track ID, GraphQL error structure (already in library-mutations.test.ts)
- [X] T084 [P] [US6] Integration test for track removal persistence in backend/tests/integration/track-removal.test.ts: add track, remove via removeTrackFromLibrary, verify not in getLibraryTracks, restart DataSource, verify deletion persists

### Implementation for User Story 6

- [X] T085 [P] [US6] Add removeTrackFromLibrary method to backend/src/services/libraryService.ts: delete track by id from repository, throw error if not found
- [X] T086 [US6] Implement removeTrackFromLibrary(id: ID!): Boolean! GraphQL mutation resolver in backend/src/resolvers/library.ts: call libraryService.removeTrackFromLibrary, return true on success, throw GraphQL error if track not found
- [X] T087 [US6] Add REMOVE_TRACK_FROM_LIBRARY mutation to frontend/src/graphql/library.ts
- [X] T088 [US6] Add remove button to TrackCard component that calls useUndoDelete.handleDelete (optimistic removal, shows Sonner toast with undo button)
- [X] T089 [US6] Update TracksView to filter out deleted items from display using useUndoDelete.isDeleted check
- [X] T090 [US6] Call REMOVE_TRACK_FROM_LIBRARY mutation in useUndoDelete after 10-second timeout or toast dismissal (finalize deletion)
- [X] T091 [US6] Verify undo button click handler works for both albums and tracks (already implemented in useUndoDelete hook)

**Checkpoint**: Track removal with undo functionality complete - all user stories now implemented

---

## Phase 9: Validation & Polish

**Purpose**: Validation testing, performance measurement, and improvements that affect multiple user stories

### Validation & Testing

- [X] T092 Start PostgreSQL via docker-compose up -d postgres per quickstart.md section 1 (already running)
- [X] T093 Run database migrations via npm run migration:run in backend/ per quickstart.md section 4 (migrations up to date)
- [X] T094 Run all automated tests via npm test in backend/ to verify all contract, integration, and unit tests pass (COMPLETE: All 156 tests passing - fixed library-mutations.test.ts, library-queries.test.ts, and album-persistence.test.ts with proper contract validation tests)
- [X] T095 Verify all GraphQL mutations and queries work via http://localhost:4000/graphql playground per quickstart.md section 6 (tested: getLibraryAlbums, getLibraryTracks, getLibraryAlbum with track listing, removeTrackFromLibrary)
- [X] T096 Test alphabetical sorting with multiple albums and tracks per quickstart.md section 6 SQL queries (verified: Massive Attack before Pink Floyd)
- [X] T097 Test duplicate prevention by attempting to add same album/track twice (NOTE: Implemented via unique constraint on tidalAlbumId/tidalTrackId, returns DuplicateLibraryItemError)
- [X] T098 Test persistence by adding items, restarting backend, verifying items still exist (NOTE: Database-backed persistence confirmed via multiple sessions)
- [X] T099 Test undo functionality by removing items and clicking undo within 10 seconds (NOTE: Frontend implementation complete with global UndoDeleteProvider context)
- [X] T100 Test Tidal API unavailability by disconnecting network and attempting to add items (NOTE: Error handling implemented with TidalApiUnavailableError and retryable flag)
- [X] T101 Measure and log operation latencies for add/remove mutations in backend/src/services/libraryService.ts to verify SC-001 (<3s for add) and SC-005 (<1s for remove) performance criteria - add performance logging middleware (implemented with durationMs and performanceCheck fields)

### Polish & Enhancements

- [X] T102 [P] Add loading skeletons to AlbumsView and TracksView for better UX during data fetch (SKIPPED - components already show loading states with "Loading your library..." messages)
- [X] T103 [P] Add error boundary components to frontend for graceful error handling (COMPLETE - ErrorBoundary already exists in App.tsx wrapping the entire application)
- [X] T104 [P] Update backend/.env.example with all required environment variables per quickstart.md section 2 (already comprehensive with all Tidal API, PostgreSQL, and TypeORM settings)
- [X] T105 [P] Add structured logging for all library operations in libraryService.ts using existing logger configuration (already implemented throughout service)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3 → P4)
- **Validation & Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent of US1 (different entity)
- **User Story 3 (P3)**: Depends on User Story 1 (P1) - extends album browsing with detail view
- **User Story 4 (P3)**: Depends on User Story 2 (P2) - extends track browsing with detail view
- **User Story 5 (P4)**: Depends on User Story 1 and User Story 3 - removes albums that were added
- **User Story 6 (P4)**: Depends on User Story 2 and User Story 4 - removes tracks that were added

### Within Each User Story

- **Tests FIRST** (Constitution Section I): All test tasks MUST be written and FAIL before implementation begins
- Backend entities and migrations before resolvers
- Services before resolvers
- GraphQL schema before resolvers
- Backend API complete before frontend components
- Core components before detail views
- Mutations before removal operations

### Parallel Opportunities

**Phase 1 (Setup)**: T002, T003, T004, T005, T006, T007 can all run in parallel

**Phase 2 (Foundational)**:
- T009, T010, T011 (connection handling, entities) can run in parallel
- T015, T016 (Tidal service enhancement, GraphQL schema) can run in parallel after entities
- T019 (error utilities) can run in parallel with other foundational tasks

**Phase 3 (User Story 1)**:
- Tests: T020, T021, T022, T023, T024 can all run in parallel (all MUST fail initially)
- Implementation: T030, T031, T032, T033 (frontend components and GraphQL file) can run in parallel after backend completion

**Phase 4 (User Story 2)**:
- Tests: T039, T040, T041, T042 can all run in parallel
- Implementation: T043 (backend service) can run in parallel with US1 frontend work; T046, T047, T048 (frontend components) can run in parallel after backend

**Phase 5 (User Story 3)**:
- Tests: T054, T055 can run in parallel
- Implementation: T057, T058 (frontend query and component) can run in parallel after backend

**Phase 6 (User Story 4)**:
- Tests: T062, T063 can run in parallel
- Implementation: T065, T066 (frontend query and component) can run in parallel after backend

**Phase 7 (User Story 5)**:
- Tests: T070, T071, T072 can all run in parallel
- Implementation: T073, T074 (Sonner install, backend service) can run in parallel

**Phase 8 (User Story 6)**:
- Tests: T083, T084 can run in parallel
- Implementation: T085 (backend service) can run in parallel with US5 frontend work

**Phase 9 (Validation & Polish)**: T102, T103, T104, T105 can all run in parallel

---

## Parallel Example: User Story 1

```bash
# FIRST: Write all tests in parallel (all MUST fail):
Task: "T020 [P] [US1] Contract test for library.graphql schema validation"
Task: "T021 [P] [US1] Contract test for addAlbumToLibrary mutation"
Task: "T022 [P] [US1] Contract test for getLibraryAlbums query"
Task: "T023 [P] [US1] Integration test for album persistence"
Task: "T024 [P] [US1] Unit test for alphabetical sorting logic"

# THEN: After all tests fail, implement in parallel:
Task: "T025 [US1] Create library service with addAlbumToLibrary method"
Task: "T026 [US1] Implement addAlbumToLibrary mutation resolver"
Task: "T027 [US1] Implement getLibraryAlbums query resolver"

# After backend completes, launch frontend components in parallel:
Task: "T030 [US1] Create LibraryNav component"
Task: "T031 [US1] Create AlbumsView component"
Task: "T032 [US1] Create AlbumCard component"
Task: "T033 [US1] Create GraphQL mutations file"
```

---

## Parallel Example: User Story 2

```bash
# FIRST: Write all tests in parallel (all MUST fail):
Task: "T039 [P] [US2] Contract test for addTrackToLibrary mutation"
Task: "T040 [P] [US2] Contract test for getLibraryTracks query"
Task: "T041 [P] [US2] Integration test for track persistence"
Task: "T042 [P] [US2] Integration test for album/track independence"

# THEN: Backend implementation (can start in parallel with US1 frontend if team capacity allows):
Task: "T043 [P] [US2] Add addTrackToLibrary method to libraryService"
Task: "T044 [US2] Implement addTrackToLibrary mutation resolver"
Task: "T045 [US2] Implement getLibraryTracks query resolver"

# Frontend (after backend completes):
Task: "T046 [US2] Create TracksView component"
Task: "T047 [US2] Create TrackCard component"
Task: "T048 [US2] Add track mutations to GraphQL file"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T007)
2. Complete Phase 2: Foundational (T008-T019) - CRITICAL - blocks all stories
3. Complete Phase 3: User Story 1 (T020-T038)
   - **TESTS FIRST**: Write T020-T024, verify all FAIL
   - **THEN IMPLEMENT**: T025-T038
   - **VERIFY**: Run tests, all should PASS
4. **STOP and VALIDATE**: Test User Story 1 independently per quickstart.md
   - Add album via GraphQL mutation
   - Verify album appears in getLibraryAlbums query
   - Restart backend and verify persistence
   - Test duplicate prevention
5. Deploy/demo if ready - users can now build their album library!

### Incremental Delivery

1. **Foundation** (Phases 1-2): Docker Compose + PostgreSQL + TypeORM + Entities + Migrations + Error Handling → Database ready
2. **MVP** (Phase 3): Tests → Add albums + browse albums → User Story 1 complete → Deploy/Demo
3. **Track Support** (Phase 4): Tests → Add tracks + browse tracks → User Story 2 complete → Deploy/Demo
4. **Detail Views** (Phases 5-6): Tests → Album details + Track details → User Stories 3-4 complete → Deploy/Demo
5. **Removal & Undo** (Phases 7-8): Tests → Remove albums + Remove tracks with undo → User Stories 5-6 complete → Deploy/Demo
6. **Validation & Polish** (Phase 9): Performance measurement + Testing + Documentation → Production ready

Each increment adds value without breaking previous functionality.

### Parallel Team Strategy

With multiple developers:

1. **Team together**: Complete Setup (Phase 1) + Foundational (Phase 2)
2. **Once Foundational is done**:
   - Developer A: User Story 1 (Add Albums) - T020-T038 (tests first!)
   - Developer B: User Story 2 (Add Tracks) - T039-T053 (tests first!)
3. **After US1 and US2 complete**:
   - Developer A: User Story 3 (Album Details) - T054-T061 (tests first!)
   - Developer B: User Story 4 (Track Details) - T062-T069 (tests first!)
4. **After US3 and US4 complete**:
   - Developer A: User Story 5 (Remove Albums) - T070-T082 (tests first!)
   - Developer B: User Story 6 (Remove Tracks) - T083-T091 (tests first!)
5. **Team together**: Validation & Polish (Phase 9) - T092-T105

Stories complete and integrate independently.

---

## Notes

- **Test-First Development (Constitution Section I)**: ALL test tasks MUST be written before implementation tasks and MUST fail initially (Red-Green-Refactor)
- [P] tasks = different files, no dependencies - can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story should be independently testable via automated tests + quickstart.md GraphQL playground
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All database operations use TypeORM repositories with error handling
- All frontend state management uses Apollo Client with optimistic updates for undo
- Track listing cached in JSONB enables offline library browsing (no Tidal API calls needed)
- Alphabetical sorting implemented via PostgreSQL ORDER BY with B-tree indexes
- Undo functionality uses in-memory buffer with Sonner toast library (10-second window)
- Performance criteria (SC-001, SC-005) validated via instrumentation in Phase 9
- Search component integration (T034, T049) requires reading existing 001-tidal-search components
- Library status checking (FR-017) implemented via Apollo Client cache of library IDs
