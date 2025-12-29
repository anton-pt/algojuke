# Tasks: Vector Search Index Infrastructure

**Input**: Design documents from `/specs/004-vector-search-index/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: This feature follows Test-First Development per constitution. Contract and integration tests MUST be written before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Project structure: `services/search-index/` (single TypeScript service)
- Source: `services/search-index/src/`
- Tests: `services/search-index/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and Docker configuration

- [X] T001 Create services/search-index directory structure per plan.md (src/, tests/, contracts/, integration/)
- [X] T002 Initialize TypeScript project in services/search-index with package.json (dependencies: @qdrant/js-client-rest, zod, vitest, typescript, tsx)
- [X] T003 [P] Configure TypeScript in services/search-index/tsconfig.json (strict mode, ES2022 target, Node.js 20 moduleResolution)
- [X] T004 [P] Configure Vitest in services/search-index/vitest.config.ts (contract and integration test patterns)
- [X] T005 [P] Configure ESLint in services/search-index/.eslintrc.json (TypeScript strict rules)
- [X] T006 Add Qdrant service to docker-compose.yml (port 6333/6334, 4GB memory limit, 2 CPU cores, volume ./data/qdrant)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 Implement Qdrant client configuration in services/search-index/src/client/qdrant.ts (connect to localhost:6333, error handling)
- [X] T008 Implement ISRC to UUID hashing utility in services/search-index/src/utils/isrcHash.ts (UUID v5 with deterministic namespace)
- [X] T009 Create TrackDocument Zod schema in services/search-index/src/schema/trackDocument.ts (all required fields, optional audio features, 4096-dim vector validation)
- [X] T010 [P] Create test utilities - random vector generator in services/search-index/src/scripts/testUtils.ts (4096-dim normalized vectors)
- [X] T011 [P] Create test utilities - ISRC generator in services/search-index/src/scripts/testUtils.ts (USTEST + 6-digit random format)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Index Creation and Readiness (Priority: P1) 🎯 MVP

**Goal**: Set up vector search index infrastructure so ingestion pipeline can immediately begin storing track data

**Independent Test**: Verify index schema exists, is properly configured with vector and BM25 capabilities, and can accept test documents with all required fields

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T012 [P] [US1] Contract test for collection schema validation in services/search-index/tests/contract/schema.test.ts (required fields present, data types correct, ISRC format, vector dimensions, audio feature ranges)
- [X] T013 [P] [US1] Contract test for ISRC uniqueness in services/search-index/tests/contract/schema.test.ts (same ISRC → same UUID, upsert behavior)
- [X] T014 [P] [US1] Integration test for Docker connectivity in services/search-index/tests/integration/initialization.test.ts (Qdrant server reachable, health check)
- [X] T015 [P] [US1] Integration test for index initialization in services/search-index/tests/integration/initialization.test.ts (collection creation, idempotent re-run, schema verification)
- [X] T016 [P] [US1] Integration test for test collection cleanup in services/search-index/tests/integration/initialization.test.ts (create test collection, verify exists, delete, verify gone)

### Implementation for User Story 1

- [X] T017 [US1] Define Qdrant collection schema in services/search-index/src/schema/trackCollection.ts (dense 4096-dim vector config, sparse BM25 vector config, HNSW parameters m=16 ef_construct=200, int8 quantization)
- [X] T018 [US1] Implement createTestCollection in services/search-index/src/scripts/testUtils.ts (generate unique name tracks-test-{uuid}, call initIndex logic, return name)
- [X] T019 [US1] Implement deleteTestCollection in services/search-index/src/scripts/testUtils.ts (safety check for tracks-test- prefix, delete via Qdrant API, handle not-found gracefully)
- [X] T020 [US1] Implement initIndex script in services/search-index/src/scripts/initIndex.ts (check collection exists, create with schema if missing, create payload indexes on isrc/title/artist/lyrics/interpretation, verify creation, log success/errors)
- [X] T021 [US1] Add CLI wrapper for initIndex in services/search-index/src/scripts/initIndex.ts (parse collection name argument, validate format, handle errors with exit codes)
- [X] T022 [US1] Add error logging to initIndex in services/search-index/src/scripts/initIndex.ts (connection failures, invalid names, schema mismatches, permissions errors)

**Checkpoint**: At this point, User Story 1 should be fully functional - index can be created, verified, and cleaned up for testing

---

## Phase 4: User Story 2 - Audio Feature Storage Support (Priority: P2)

**Goal**: Enable index to store audio analysis metadata from reccobeats.com API for future filtering and ranking

**Independent Test**: Insert test documents with audio feature fields and verify all fields are stored and retrievable with correct data types

### Tests for User Story 2

- [X] T023 [P] [US2] Contract test for audio feature validation in services/search-index/tests/contract/schema.test.ts (all 11 fields accept correct ranges, reject out-of-range, nullable fields)
- [X] T024 [P] [US2] Integration test for audio feature storage in services/search-index/tests/integration/operations.test.ts (insert with all features, retrieve and verify, insert with partial features, insert with no features)
- [X] T025 [P] [US2] Integration test for audio feature data types in services/search-index/tests/integration/operations.test.ts (floats stored as floats, integers stored as integers, ISRC lookup returns correct types)

### Implementation for User Story 2

- [X] T026 [US2] Extend TrackDocument schema in services/search-index/src/schema/trackDocument.ts with audio feature fields (acousticness, danceability, energy, instrumentalness, key, liveness, loudness, mode, speechiness, tempo, valence - all optional with validation)
- [X] T027 [US2] Implement insertTestTrack in services/search-index/src/scripts/testUtils.ts (default values for all fields including audio features, merge with overrides, validate schema, upsert to Qdrant, return ISRC)
- [X] T028 [US2] Update collection schema in services/search-index/src/schema/trackCollection.ts to document audio feature payload fields (schema-less but documented for reference)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - index supports full track metadata including audio features

---

## Phase 5: User Story 3 - Hybrid Search Configuration (Priority: P1)

**Goal**: Enable index to support both vector similarity and keyword matching for semantic and literal search

**Independent Test**: Insert sample documents and execute test queries using both vector similarity search and BM25 keyword search, verifying both return expected results

### Tests for User Story 3

- [X] T029 [P] [US3] Integration test for vector similarity search in services/search-index/tests/integration/operations.test.ts (insert tracks, search by embedding, verify cosine similarity ranking)
- [X] T030 [P] [US3] Integration test for BM25 keyword search in services/search-index/tests/integration/operations.test.ts (insert tracks with lyrics, search by keyword, verify BM25 relevance ranking)
- [X] T031 [P] [US3] Integration test for multi-field text search in services/search-index/tests/integration/operations.test.ts (search across title/artist/lyrics/interpretation, verify matches from any field)
- [X] T032 [P] [US3] Integration test for ISRC retrieval in services/search-index/tests/integration/operations.test.ts (insert track, retrieve by ISRC, verify payload matches)
- [X] T033 [P] [US3] Integration test for upsert behavior in services/search-index/tests/integration/operations.test.ts (insert track, upsert same ISRC with different data, verify update not duplicate)

### Implementation for User Story 3

- [X] T034 [US3] Verify vector search configuration in services/search-index/src/schema/trackCollection.ts (interpretation_embedding uses Cosine distance, HNSW index enabled)
- [X] T035 [US3] Verify BM25 text search configuration in services/search-index/src/schema/trackCollection.ts (text_sparse uses IDF modifier, text indexes on title/artist/lyrics/interpretation)
- [X] T036 [US3] Add search operation examples to services/search-index/src/scripts/testUtils.ts (vector search, keyword search, hybrid search with RRF fusion, ISRC lookup - documented for future search API)

**Checkpoint**: All user stories should now be independently functional - index supports initialization, audio features, and hybrid search

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T037 [P] Add package.json scripts in services/search-index/package.json (test, test:watch, type-check, init-index)
- [X] T038 [P] Create README for search-index service in services/search-index/README.md (quickstart reference, links to specs/, docker commands)
- [X] T039 Code cleanup and refactoring in services/search-index/src/ (remove dead code, consistent naming, add TSDoc comments to public APIs)
- [X] T040 Performance validation against success criteria (SC-001 to SC-006 from spec.md - 10k insert test, vector search <500ms, keyword search <200ms; SC-007 resource constraints enforced via docker-compose.yml, no testing required; load testing beyond 10k deferred)
- [X] T041 Run quickstart.md validation (follow all steps in quickstart.md, verify commands work, update if drift detected)
- [X] T042 Update CLAUDE.md with final project structure and commands (search-index service paths, docker compose commands, test commands)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3, 4, 5)**: All depend on Foundational phase completion
  - US1 (P1) and US3 (P1) are both priority 1 and can proceed in parallel after foundational
  - US2 (P2) can proceed in parallel with US1/US3 after foundational
  - All three stories are independently testable
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories (extends schema additively)
- **User Story 3 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories (verifies capabilities already in schema)

**Key Independence**: All three user stories are independently testable because:
- US1 tests basic index creation/initialization
- US2 tests audio feature storage (optional fields that don't affect US1)
- US3 tests search capabilities (uses same schema as US1)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Tests for US1 block implementation tasks T017-T022
- Tests for US2 block implementation tasks T026-T028
- Tests for US3 block implementation tasks T034-T036
- Test utilities (T010, T011) must complete before any tests can be written
- Schema definition (T017) must complete before test utilities that reference it (T018, T019)

### Parallel Opportunities

- **Setup phase**: Tasks T003, T004, T005 can run in parallel (different config files)
- **Foundational phase**: Tasks T010, T011 can run in parallel (independent utility functions)
- **US1 tests**: Tasks T012, T013, T014, T015, T016 can run in parallel (different test files/suites)
- **US2 tests**: Tasks T023, T024, T025 can run in parallel
- **US3 tests**: Tasks T029, T030, T031, T032, T033 can run in parallel
- **Polish phase**: Tasks T037, T038, T042 can run in parallel (different files)

**Major parallelization**: After Foundational phase completes, all three user stories can be worked on simultaneously by different developers:
- Developer A: User Story 1 (T012-T022)
- Developer B: User Story 2 (T023-T028)
- Developer C: User Story 3 (T029-T036)

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Contract test for collection schema validation in services/search-index/tests/contract/schema.test.ts"
Task: "Contract test for ISRC uniqueness in services/search-index/tests/contract/schema.test.ts"
Task: "Integration test for Docker connectivity in services/search-index/tests/integration/initialization.test.ts"
Task: "Integration test for index initialization in services/search-index/tests/integration/initialization.test.ts"
Task: "Integration test for test collection cleanup in services/search-index/tests/integration/initialization.test.ts"

# After tests fail, launch implementation tasks that don't depend on each other:
Task: "Define Qdrant collection schema in services/search-index/src/schema/trackCollection.ts"
# (Once T017 completes, T018 and T019 can run in parallel)
Task: "Implement createTestCollection in services/search-index/src/scripts/testUtils.ts"
Task: "Implement deleteTestCollection in services/search-index/src/scripts/testUtils.ts"
```

---

## Parallel Example: User Story 2

```bash
# Launch all tests for User Story 2 together:
Task: "Contract test for audio feature validation in services/search-index/tests/contract/schema.test.ts"
Task: "Integration test for audio feature storage in services/search-index/tests/integration/operations.test.ts"
Task: "Integration test for audio feature data types in services/search-index/tests/integration/operations.test.ts"

# After tests fail, implementation tasks can run together:
Task: "Extend TrackDocument schema in services/search-index/src/schema/trackDocument.ts"
Task: "Implement insertTestTrack in services/search-index/src/scripts/testUtils.ts"
Task: "Update collection schema in services/search-index/src/schema/trackCollection.ts"
```

---

## Parallel Example: User Story 3

```bash
# Launch all tests for User Story 3 together:
Task: "Integration test for vector similarity search in services/search-index/tests/integration/operations.test.ts"
Task: "Integration test for BM25 keyword search in services/search-index/tests/integration/operations.test.ts"
Task: "Integration test for multi-field text search in services/search-index/tests/integration/operations.test.ts"
Task: "Integration test for ISRC retrieval in services/search-index/tests/integration/operations.test.ts"
Task: "Integration test for upsert behavior in services/search-index/tests/integration/operations.test.ts"

# After tests fail, verification tasks can run together:
Task: "Verify vector search configuration in services/search-index/src/schema/trackCollection.ts"
Task: "Verify BM25 text search configuration in services/search-index/src/schema/trackCollection.ts"
Task: "Add search operation examples in services/search-index/src/scripts/testUtils.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 3 Only)

Since both US1 and US3 are Priority P1, the MVP should include both:

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (index creation)
4. Complete Phase 5: User Story 3 (hybrid search)
5. **STOP and VALIDATE**: Test US1 and US3 independently
6. Ready for ingestion pipeline integration

Rationale: US3 (hybrid search) is P1 because it's core to the value proposition. However, US1 must complete first as it creates the index that US3 validates.

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Index infrastructure complete
3. Add User Story 3 → Test independently → Hybrid search validated (MVP ready!)
4. Add User Story 2 → Test independently → Audio features enabled
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (T012-T022)
   - Developer B: User Story 3 (T029-T036) - starts in parallel
   - Developer C: User Story 2 (T023-T028) - starts in parallel
3. US1 completes first (provides index for US3 to validate)
4. US3 and US2 complete independently

---

## Task Summary

- **Total Tasks**: 42
- **Setup**: 6 tasks
- **Foundational**: 5 tasks (BLOCKS all stories)
- **User Story 1 (P1)**: 11 tasks (5 tests + 6 implementation)
- **User Story 2 (P2)**: 6 tasks (3 tests + 3 implementation)
- **User Story 3 (P1)**: 8 tasks (5 tests + 3 implementation)
- **Polish**: 6 tasks

### Tasks Per User Story

- **US1**: 11 tasks (index creation, initialization, test utilities)
- **US2**: 6 tasks (audio feature storage)
- **US3**: 8 tasks (hybrid search validation)

### Parallel Opportunities

- 16 tasks marked [P] can run in parallel within their phases
- All 3 user stories can be implemented in parallel after foundational phase
- Test tasks within each story can run in parallel (5 tests for US1, 3 for US2, 5 for US3)

### Independent Test Criteria

- **US1**: Run `npx tsx src/scripts/initIndex.ts tracks-test`, verify collection created, insert test document, verify stored
- **US2**: Run US1 setup, insert track with audio features, retrieve by ISRC, verify all 11 fields present with correct types
- **US3**: Run US1 setup, insert multiple tracks, execute vector search, execute keyword search, verify results ranked correctly

### Suggested MVP Scope

**Minimum**: User Story 1 only (index infrastructure)
**Recommended MVP**: User Stories 1 + 3 (both P1 - infrastructure + hybrid search validation)
**Full Feature**: All 3 user stories (adds audio feature support)

---

## Notes

- [P] tasks = different files, no dependencies within phase
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Tests MUST fail before implementing (Test-First Development per constitution)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- US1 and US3 are both P1 but US3 should start after US1 schema is defined (T017) for best efficiency
