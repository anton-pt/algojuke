# Tasks: Tidal Music Search Application

**Input**: Design documents from `/specs/001-tidal-search/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/graphql.schema

**Tests**: Following test-first development (Red-Green-Refactor) - all tests written before implementation per constitution

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/`
- All paths relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create backend directory structure with src/ and tests/ subdirectories per plan.md
- [X] T002 Create frontend directory structure with src/ and tests/ subdirectories per plan.md
- [X] T003 [P] Initialize backend package.json with Node.js 20.x, TypeScript, Apollo Server, axios, Vitest dependencies
- [X] T004 [P] Initialize frontend package.json with React 18+, Vite, TypeScript, Apollo Client, Vitest dependencies
- [X] T005 [P] Create backend/tsconfig.json with strict mode and ES2020 target
- [X] T006 [P] Create frontend/tsconfig.json with React JSX and ES2020 target
- [X] T007 [P] Create frontend/vite.config.ts with Vitest integration and browser targets (Chrome 91+, Firefox 89+, Safari 14+, Edge 91+)
- [X] T008 [P] Configure ESLint for backend in backend/.eslintrc.js with TypeScript rules
- [X] T009 [P] Configure ESLint for frontend in frontend/.eslintrc.js with React and TypeScript rules
- [X] T010 [P] Create root .env.example with TIDAL_CLIENT_ID, TIDAL_CLIENT_SECRET, TIDAL_TOKEN_URL, TIDAL_API_BASE_URL, SEARCH_CACHE_TTL templates
- [X] T011 [P] Create backend/.env.example with backend-specific environment variable templates
- [X] T012 [P] Create .gitignore to exclude node_modules/, .env, build/, dist/, coverage/
- [X] T013 [P] Create README.md with project overview, tech stack, and setup instructions
- [X] T014 [P] Create placeholder album artwork SVG in frontend/public/images/placeholder-album.svg

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T015 Create GraphQL schema file in backend/src/schema/schema.graphql from contracts/graphql.schema
- [X] T016 [P] Create TypeScript types for Tidal API responses in backend/src/types/tidal.ts (TidalAlbum, TidalTrack, TidalArtist interfaces)
- [X] T017 [P] Create TypeScript types for GraphQL types in backend/src/types/graphql.ts (AlbumResult, TrackResult, SearchResults interfaces)
- [X] T018 [P] Create error types in backend/src/types/errors.ts (ApiError interface with code, message, details, retryAfter)
- [X] T019 Create input validation utility in backend/src/utils/validation.ts with query validation (1-200 chars, UTF-8, trim, reject empty)
- [X] T020 [P] Create image URL utility in backend/src/utils/imageUrl.ts with getTidalImageUrl function and placeholder fallback logic
- [X] T021 [P] Create logging utility in backend/src/utils/logger.ts with structured logging for API calls, errors, cache hits/misses
- [X] T022 Create cache service in backend/src/services/cacheService.ts with in-memory Map, 1-hour TTL, get/set/clear methods
- [X] T023 Create Tidal token service in backend/src/services/tidalTokenService.ts with OAuth2 client credentials flow, token caching, auto-refresh
- [X] T024 Create Tidal API service in backend/src/services/tidalService.ts with search method, response transformation, error handling
- [X] T025 Create GraphQL search resolver in backend/src/resolvers/searchResolver.ts with cache integration and error handling
- [X] T026 Create Apollo Server setup in backend/src/server.ts with schema, resolvers, context (cache, tidalService)
- [X] T027 Create frontend Apollo Client setup in frontend/src/graphql/client.ts with HTTP link to backend GraphQL endpoint
- [X] T028 [P] Create GraphQL queries in frontend/src/graphql/queries.ts with SEARCH_QUERY definition

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Basic Music Search (Priority: P1) 🎯 MVP

**Goal**: Users can search for music by text input and see albums and tracks with artwork

**Independent Test**: Enter "Beatles" in search box, submit, verify albums and tracks appear with artwork

### Tests for User Story 1 - Write FIRST, ensure they FAIL before implementation

- [X] T029 [P] [US1] Create contract test for GraphQL search query in backend/tests/contract/searchSchema.test.ts (verify schema matches contracts/graphql.schema, validate response structure)
- [X] T030 [P] [US1] Create unit test for query validation in backend/tests/unit/validation.test.ts (test 1-200 char limit, UTF-8, special chars, empty/whitespace rejection)
- [X] T031 [P] [US1] Create unit test for image URL generation in backend/tests/unit/imageUrl.test.ts (test UUID to URL conversion, placeholder fallback, size parameters)
- [X] T032 [P] [US1] Create unit test for cache service in backend/tests/unit/cacheService.test.ts (test TTL expiry, get/set operations, cache key uniqueness)
- [X] T033 [P] [US1] Create unit test for Tidal token service in backend/tests/unit/tidalTokenService.test.ts (test token refresh, expiry handling, OAuth flow)
- [X] T034 [P] [US1] Create unit test for Tidal API service in backend/tests/unit/tidalService.test.ts (test response transformation, error handling, API calls with mocked axios)
- [X] T035 [US1] Create integration test for search flow in backend/tests/integration/search.integration.test.ts (test end-to-end search with mocked Tidal API, verify caching, test error scenarios)
- [X] T036 [P] [US1] Create unit test for SearchBar component in frontend/tests/unit/SearchBar.test.tsx (test input handling, form submission, loading state, error display)
- [X] T037 [P] [US1] Create unit test for AlbumCard component in frontend/tests/unit/AlbumCard.test.tsx (test artwork display, fallback image, metadata rendering)
- [X] T038 [P] [US1] Create unit test for TrackCard component in frontend/tests/unit/TrackCard.test.tsx (test track info display, artwork, duration formatting)
- [X] T039 [US1] Create integration test for search user journey in frontend/tests/integration/searchFlow.test.tsx (test full search interaction with mocked GraphQL responses)

### Implementation for User Story 1 - Only after all tests are written and failing

- [X] T040 [US1] Implement input validation logic in backend/src/utils/validation.ts to pass T030 tests (validateQuery function)
- [X] T041 [US1] Implement image URL generation logic in backend/src/utils/imageUrl.ts to pass T031 tests (getTidalImageUrl, buildImageUrls functions)
- [X] T042 [US1] Implement cache service in backend/src/services/cacheService.ts to pass T032 tests (CacheService class with Map storage)
- [X] T043 [US1] Implement Tidal token service in backend/src/services/tidalTokenService.ts to pass T033 tests (TidalTokenService with OAuth flow)
- [X] T044 [US1] Implement Tidal API service in backend/src/services/tidalService.ts to pass T034 tests (TidalService.search method, transformResponse)
- [X] T045 [US1] Implement GraphQL search resolver in backend/src/resolvers/searchResolver.ts to pass T029 and T035 tests (searchResolver with cache integration)
- [X] T046 [US1] Wire up Apollo Server in backend/src/server.ts with all services and resolvers
- [X] T047 [P] [US1] Create SearchBar React component in frontend/src/components/SearchBar.tsx to pass T036 tests (input, submit, loading, error states)
- [X] T048 [P] [US1] Create AlbumCard React component in frontend/src/components/AlbumCard.tsx to pass T037 tests (artwork, title, artist, metadata display)
- [X] T049 [P] [US1] Create TrackCard React component in frontend/src/components/TrackCard.tsx to pass T038 tests (track info, artwork, duration)
- [X] T050 [P] [US1] Create ResultsList React component in frontend/src/components/ResultsList.tsx (albums and tracks sections, uses AlbumCard and TrackCard)
- [X] T051 [US1] Create SearchPage React component in frontend/src/pages/SearchPage.tsx integrating SearchBar and ResultsList with Apollo Client
- [X] T052 [US1] Create main App component in frontend/src/App.tsx with Apollo Provider and SearchPage
- [X] T053 [US1] Create frontend entry point in frontend/src/main.tsx
- [X] T054 [US1] Create index.html in frontend/index.html with root div and UTF-8 meta tag
- [X] T055 [US1] Add logging to search resolver in backend/src/resolvers/searchResolver.ts for API calls, errors, cache hits/misses
- [X] T056 [US1] Verify all User Story 1 tests pass (T029-T039) and search functionality works end-to-end

**Checkpoint**: At this point, User Story 1 should be fully functional - users can search and see results with artwork

---

## Phase 4: User Story 2 - No Results Handling (Priority: P2)

**Goal**: Users get clear feedback when search returns no results with suggestions to try different terms

**Independent Test**: Search for "xyzabc123notarealband" and verify helpful "no results" message appears

### Tests for User Story 2 - Write FIRST, ensure they FAIL before implementation

- [X] T057 [P] [US2] Create unit test for empty results handling in backend/tests/unit/tidalService.test.ts (test transformation of empty Tidal response)
- [X] T058 [P] [US2] Create unit test for NoResultsMessage component in frontend/tests/unit/NoResultsMessage.test.tsx (test message display, suggestions text)
- [X] T059 [US2] Create integration test for no results flow in frontend/tests/integration/noResultsFlow.test.tsx (test search with no results shows message)

### Implementation for User Story 2 - Only after tests are written and failing

- [X] T060 [US2] Update Tidal service in backend/src/services/tidalService.ts to handle empty results gracefully (ensure albums:[], tracks:[], total counts 0)
- [X] T061 [US2] Create NoResultsMessage React component in frontend/src/components/NoResultsMessage.tsx with helpful message and suggestions
- [X] T062 [US2] Update ResultsList component in frontend/src/components/ResultsList.tsx to show NoResultsMessage when albums and tracks are both empty
- [X] T063 [US2] Verify all User Story 2 tests pass (T057-T059) and no results handling works

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - search with results OR no results both handled gracefully

---

## Phase 5: User Story 3 - Search Results Organization (Priority: P2)

**Goal**: Search results are organized with albums in one section and tracks in another for easy browsing

**Independent Test**: Search for "rock" and verify albums and tracks are in separate clearly labeled sections

### Tests for User Story 3 - Write FIRST, ensure they FAIL before implementation

- [X] T064 [P] [US3] Create unit test for ResultsList organization in frontend/tests/unit/ResultsList.test.tsx (test albums section, tracks section, section headings, visual separation)
- [X] T065 [US3] Create integration test for results organization in frontend/tests/integration/resultsOrganization.test.tsx (test broad search shows organized sections)

### Implementation for User Story 3 - Only after tests are written and failing

- [X] T066 [US3] Update ResultsList component in frontend/src/components/ResultsList.tsx to add section headings for Albums and Tracks with result counts
- [X] T067 [US3] Add CSS/styling to ResultsList in frontend/src/components/ResultsList.tsx for visual separation between albums and tracks sections (grid for albums, list for tracks)
- [X] T068 [US3] Verify all User Story 3 tests pass (T064-T065) and results are clearly organized

**Checkpoint**: All user stories should now be independently functional with clear organization

---

## Phase 6: User Story 4 - Batch API Optimization (Priority: P1) 🚀 PERFORMANCE

**Goal**: Replace individual API calls with batch requests to reduce search time from ~10s to ~2s

**Why this priority**: Current implementation makes 2N+1 API calls (40+ calls for 20 albums = 20s). Batch approach reduces to 3 calls total, dramatically improving user experience. This is a critical performance enhancement that affects SC-001 (3s response time).

**Independent Test**: Search for "Beatles", verify response completes in under 3 seconds with artist names and cover art displayed. Monitor network tab to confirm only 3 Tidal API calls are made (search, batch tracks, batch albums).

### Tests for User Story 4 - Write FIRST, ensure they FAIL before implementation

- [x] T083 [P] [US4] Create unit test for batch URL construction in backend/tests/unit/tidalService.test.ts (test comma-separated IDs, URL encoding, length limits)
- [x] T084 [P] [US4] Create unit test for batch response parsing in backend/tests/unit/tidalService.test.ts (test included array parsing, artist/artwork map building, fallback handling)
- [x] T085 [P] [US4] Create unit test for ISRC extraction in backend/tests/unit/tidalService.test.ts (test extracting ISRCs from track results, handling missing ISRCs)
- [x] T086 [US4] Create integration test for batch API flow in backend/tests/integration/batchApi.integration.test.ts (test 3-call pattern: search → batch tracks → batch albums, verify timing improvement)

### Implementation for User Story 4 - Only after tests are written and failing

- [X] T087 [US4] Add TidalTrackBatchResponse type in backend/src/types/tidal.ts with data/included array structure per JSON:API spec
- [X] T088 [P] [US4] Add TidalAlbumBatchResponse type in backend/src/types/tidal.ts with data/included array structure per JSON:API spec
- [X] T089 [P] [US4] Add TidalArtworkAttributes type in backend/src/types/tidal.ts with files array (href, meta.width, meta.height)
- [X] T090 [US4] Implement batchFetchTracks method in backend/src/services/tidalService.ts (GET /v2/tracks?filter[isrc]=..., parse included albums)
- [X] T091 [US4] Implement batchFetchAlbums method in backend/src/services/tidalService.ts (GET /v2/albums?filter[id]=...&include=artists,coverArt, parse included artists/artworks)
- [X] T092 [US4] Implement buildLookupMaps helper in backend/src/services/tidalService.ts (build artistId→name and artworkId→URL maps from included array)
- [X] T093 [US4] Update search method in backend/src/services/tidalService.ts to use 3-step batch flow: extract ISRCs → batch tracks → collect album IDs → batch albums
- [X] T094 [US4] Remove old fetchAlbumDetails and fetchCoverArt methods from backend/src/services/tidalService.ts (replaced by batch methods)
- [X] T095 [US4] Update rate limiter default in backend/src/services/tidalService.ts from 2 req/s to 3 req/s (safe with only 3 calls per search)
- [X] T096 [US4] Update transformV2Response in backend/src/services/tidalService.ts to use lookup maps instead of individual fetch results
- [X] T097 [US4] Update TIDAL_REQUESTS_PER_SECOND in backend/.env.example to 3 (documented safe rate with batch approach)
- [X] T098 [US4] Verify all User Story 4 tests pass (T083-T086) and search completes in <3s with only 3 API calls

**Checkpoint**: Search performance dramatically improved, meets SC-001 success criteria

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T099 [P] Create unit test for error boundary in frontend/tests/unit/ErrorBoundary.test.tsx (test crash handling, fallback UI)
- [x] T100 [P] Create error boundary component in frontend/src/components/ErrorBoundary.tsx to catch React errors and show fallback UI
- [x] T101 Wrap App in ErrorBoundary in frontend/src/App.tsx
- [x] T102 [P] Add Tidal API error handling tests in backend/tests/unit/tidalService.test.ts (401, 429, 503, timeout scenarios)
- [X] T103 Update Tidal service error handling in backend/src/services/tidalService.ts to handle all error codes per data-model.md (INVALID_QUERY, RATE_LIMIT_EXCEEDED, API_UNAVAILABLE, TIMEOUT)
- [x] T104 [P] Create loading skeleton components in frontend/src/components/LoadingSkeleton.tsx for better UX during searches
- [x] T105 Add loading skeletons to SearchPage in frontend/src/pages/SearchPage.tsx while query is in loading state
- [X] T106 [P] Add batch API optimization documentation in README.md explaining the 3-call pattern and performance improvements
- [X] T107 [P] Create development setup guide in README.md with .env setup, npm install, npm run dev instructions
- [X] T108 [P] Add package.json scripts for frontend: "dev", "build", "test", "lint"
- [X] T109 [P] Add package.json scripts for backend: "dev", "build", "test", "lint", "start"
- [x] T110 Run all tests across backend and frontend to ensure full passing test suite (Unit tests updated for batch optimization, all 89 tests passing)
- [X] T111 Test application end-to-end manually per quickstart.md validation scenarios (verify <3s response time)
- [X] T112 [P] Create deployment documentation in README.md for environment variables, build process, and running in production

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion (T001-T014) - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion (T015-T028)
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1: US1 → P2: US2 → P2: US3)
- **Batch Optimization (Phase 6)**: Depends on User Story 1 completion (T029-T068) - Performance enhancement
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Builds on US1 components but independently testable
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Enhances US1 components but independently testable
- **User Story 4 (P1)**: MUST complete after User Story 1 (requires existing search implementation) - Refactors API calls for performance

### Within Each User Story

**CRITICAL: Test-First Development (Red-Green-Refactor)**
1. **RED**: Write all tests for the story FIRST (e.g., T029-T039 for US1)
2. **Verify tests FAIL**: Run tests, confirm they fail (no implementation yet)
3. **GREEN**: Implement functionality to make tests pass (e.g., T040-T056 for US1)
4. **Verify tests PASS**: Run tests, confirm all pass
5. **REFACTOR**: Clean up if needed
6. **Checkpoint**: Story complete and independently testable

Models/utilities before services → Services before resolvers → Resolvers before UI → UI integration

### Parallel Opportunities

- **Phase 1 Setup**: T003-T014 can all run in parallel (different files)
- **Phase 2 Foundational**: T016-T021, T028 can run in parallel (different files)
- **User Story 1 Tests**: T029-T034, T036-T038 can run in parallel (different test files)
- **User Story 1 Implementation**: T047-T050 (React components) can run in parallel after T040-T046 complete
- **Once Foundational completes**: US1, US2, US3 can all be worked on in parallel by different team members
- **Phase 6 Polish**: T069-T070, T072, T074, T076-T079, T082 can run in parallel

---

## Parallel Example: User Story 1

**Test Phase (RED):**
```bash
# Launch all unit tests for User Story 1 backend together:
Task T030: "Create unit test for query validation"
Task T031: "Create unit test for image URL generation"
Task T032: "Create unit test for cache service"
Task T033: "Create unit test for Tidal token service"
Task T034: "Create unit test for Tidal API service"

# Launch all unit tests for User Story 1 frontend together:
Task T036: "Create unit test for SearchBar component"
Task T037: "Create unit test for AlbumCard component"
Task T038: "Create unit test for TrackCard component"
```

**Implementation Phase (GREEN):**
```bash
# After backend services are implemented, launch all React components together:
Task T047: "Create SearchBar React component"
Task T048: "Create AlbumCard React component"
Task T049: "Create TrackCard React component"
Task T050: "Create ResultsList React component"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. **Phase 1**: Complete Setup (T001-T014)
2. **Phase 2**: Complete Foundational (T015-T028) - CRITICAL, blocks all stories
3. **Phase 3**: Complete User Story 1 (T029-T056)
   - Write all tests FIRST (T029-T039)
   - Verify tests FAIL
   - Implement functionality (T040-T056)
   - Verify all tests PASS
4. **STOP and VALIDATE**: Test User Story 1 end-to-end independently
5. **Deploy/demo** if ready - this is a functional MVP!

### Incremental Delivery

1. Complete Setup + Foundational (T001-T028) → **Foundation ready**
2. Add User Story 1 (T029-T056) → Test independently → **Deploy/Demo (MVP!)**
   - Users can search and see results with artwork
3. Add User Story 2 (T057-T063) → Test independently → **Deploy/Demo**
   - Users get helpful feedback when no results found
4. Add User Story 3 (T064-T068) → Test independently → **Deploy/Demo**
   - Results are well-organized by type
5. Add User Story 4 (T083-T098) → **Deploy/Demo (Performance Optimized)**
   - Search response time reduced from ~10s to ~2s via batch API calls
6. Add Polish (T099-T112) → **Deploy/Demo (Production-ready)**
   - Error handling, loading states, documentation complete

Each story adds value without breaking previous stories!

### Parallel Team Strategy

With multiple developers after Foundational phase completes:

1. Team completes Setup (Phase 1) + Foundational (Phase 2) together
2. Once Foundational is done:
   - **Developer A**: User Story 1 (T029-T056) - Core search
   - **Developer B**: User Story 2 (T057-T063) - No results handling
   - **Developer C**: User Story 3 (T064-T068) - Results organization
3. Stories complete and integrate independently
4. **Developer A**: User Story 4 (T083-T098) - Batch API optimization (requires US1 complete)
5. **Team**: Polish phase together (T099-T112)

---

## Task Count Summary

- **Total Tasks**: 112
- **Phase 1 (Setup)**: 14 tasks
- **Phase 2 (Foundational)**: 14 tasks (BLOCKING)
- **Phase 3 (User Story 1 - Basic Search)**: 28 tasks (11 tests + 17 implementation)
- **Phase 4 (User Story 2 - No Results)**: 7 tasks (3 tests + 4 implementation)
- **Phase 5 (User Story 3 - Organization)**: 5 tasks (2 tests + 3 implementation)
- **Phase 6 (User Story 4 - Batch API Optimization)**: 16 tasks (4 tests + 12 implementation) 🚀 PERFORMANCE
- **Phase 7 (Polish)**: 28 tasks

**Parallel Opportunities Identified**: 51 tasks marked with [P] can run in parallel

**MVP Scope**: Phase 1 + Phase 2 + Phase 3 (User Story 1) = **56 tasks** for a functional music search application

**Optimized Scope**: MVP + Phase 6 (User Story 4) = **72 tasks** for a fast, production-ready search application

---

## Notes

- **[P] tasks**: Different files, no dependencies - can run in parallel
- **[Story] label**: Maps task to specific user story for traceability
- **Test-First (RED-GREEN-REFACTOR)**: All tests written before implementation per constitution
- **Each user story** independently completable and testable
- **Verify tests FAIL** before implementing functionality
- **Commit** after each task or logical group
- **Stop at any checkpoint** to validate story independently
- **Constitution compliance**: Follows test-first, simplicity-first, clear separation principles

**Success Criteria Validation**:
- SC-001 (3s response): Caching ensures <100ms cached, <3s fresh searches
- SC-002 (95% artwork): Image URL generation with placeholder fallback
- SC-003 (90% success): Comprehensive error handling and validation
- SC-004 (100 concurrent): Stateless architecture, in-memory caching
- SC-005 (zero crashes): Error boundaries, comprehensive error handling
