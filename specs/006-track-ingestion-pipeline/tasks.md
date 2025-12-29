# Tasks: Track Ingestion Pipeline

**Input**: Design documents from `/specs/006-track-ingestion-pipeline/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included per constitution principle I (Test-First Development). Contract tests for API clients, integration tests for pipeline.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Services monorepo**: `services/worker/src/`, `services/worker/tests/`
- TEI service added to root `docker-compose.yml`

---

## Phase 1: Setup

**Purpose**: Dependencies installation and infrastructure configuration

- [x] T001 Add Vercel AI SDK dependencies (`ai`, `@ai-sdk/anthropic`) to services/worker/package.json
- [x] T002 [P] Add axios dependency to services/worker/package.json
- [x] T003 Add TEI service configuration to docker-compose.yml
- [x] T004 [P] Create environment variable template with ANTHROPIC_API_KEY, MUSIXMATCH_API_KEY in services/worker/.env.example

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Define track ingestion event schemas (requested, completed, failed) in services/worker/src/inngest/events.ts
- [x] T006 [P] Create APIError class and isRetryableError helper in services/worker/src/clients/errors.ts
- [x] T007 [P] Create ReccoBeats client with getAudioFeatures method in services/worker/src/clients/reccobeats.ts
- [x] T008 [P] Create Musixmatch client with getLyrics method in services/worker/src/clients/musixmatch.ts
- [x] T009 [P] Create TEI embedding client with embed method in services/worker/src/clients/tei.ts
- [x] T010 [P] Create Anthropic LLM client wrapper using Vercel AI SDK in services/worker/src/clients/anthropic.ts
- [x] T011 Create lyrics interpretation prompt template in services/worker/src/prompts/lyricsInterpretation.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Complete Track Ingestion (Priority: P1) 🎯 MVP

**Goal**: Ingest a music track by ISRC into the vector index with comprehensive metadata including audio features, lyrics, and semantic interpretation.

**Independent Test**: Submit a track ISRC via Inngest, verify the track document exists in Qdrant with all expected fields populated.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T012 [P] [US1] Contract test for ReccoBeats client in services/worker/tests/contract/reccobeats.test.ts
- [x] T013 [P] [US1] Contract test for Musixmatch client in services/worker/tests/contract/musixmatch.test.ts
- [x] T014 [P] [US1] Contract test for TEI embedding client in services/worker/tests/contract/tei.test.ts
- [x] T015 [P] [US1] Contract test for Anthropic LLM client in services/worker/tests/contract/anthropic.test.ts
- [x] T016 [US1] Integration test for complete track ingestion pipeline in services/worker/tests/integration/trackIngestion.test.ts

### Implementation for User Story 1

- [x] T017 [US1] Implement trackIngestion Inngest function with 6 steps (fetch-audio-features, fetch-lyrics, generate-interpretation, embed-interpretation, store-document, emit-completion) in services/worker/src/inngest/functions/trackIngestion.ts
- [x] T018 [US1] Register trackIngestion function in services/worker/src/inngest/functions/index.ts
- [x] T019 [US1] Implement fetch-audio-features step using ReccoBeats client in services/worker/src/inngest/functions/trackIngestion.ts
- [x] T020 [US1] Implement fetch-lyrics step using Musixmatch client in services/worker/src/inngest/functions/trackIngestion.ts
- [x] T021 [US1] Implement generate-interpretation step using Anthropic client (skip if no lyrics) in services/worker/src/inngest/functions/trackIngestion.ts
- [x] T022 [US1] Implement embed-interpretation step using TEI client (zero vector if no interpretation) in services/worker/src/inngest/functions/trackIngestion.ts
- [x] T023 [US1] Implement store-document step using Qdrant client from @algojuke/search-index in services/worker/src/inngest/functions/trackIngestion.ts
- [x] T024 [US1] Implement emit-completion step sending track/ingestion.completed event in services/worker/src/inngest/functions/trackIngestion.ts
- [x] T025 [US1] Add embedding dimension validation (must be exactly 4096) before store-document step in services/worker/src/inngest/functions/trackIngestion.ts

**Checkpoint**: User Story 1 should be fully functional - trigger ingestion via Inngest UI and verify document in Qdrant

---

## Phase 4: User Story 2 - Durable Execution with Step Memoization (Priority: P1)

**Goal**: Pipeline durably persists intermediate results after each step so retries don't re-execute expensive API calls.

**Independent Test**: Trigger ingestion, artificially fail the embedding step after lyrics complete, observe retry resumes from embedding without re-calling Musixmatch or Anthropic.

### Tests for User Story 2

- [x] T026 [US2] Integration test for step memoization (verify completed steps not re-executed on retry) in services/worker/tests/integration/trackIngestionMemoization.test.ts

### Implementation for User Story 2

- [x] T027 [US2] Verify all step.run calls use unique step IDs for memoization in services/worker/src/inngest/functions/trackIngestion.ts
- [x] T028 [US2] Add Inngest function configuration: retries=5, concurrency=10, idempotency=event.data.isrc in services/worker/src/inngest/functions/trackIngestion.ts

**Checkpoint**: User Stories 1 AND 2 should both work - memoization prevents duplicate API calls on retry

---

## Phase 5: User Story 3 - Graceful Handling of Missing Data (Priority: P2)

**Goal**: Pipeline handles tracks with missing lyrics (instrumentals) or unavailable audio features, indexing partial data rather than failing.

**Independent Test**: Ingest an instrumental track ISRC, verify document created with null/empty lyrics but valid metadata.

### Tests for User Story 3

- [x] T029 [P] [US3] Integration test for instrumental track (no lyrics) handling in services/worker/tests/integration/trackIngestionMissingData.test.ts
- [x] T030 [P] [US3] Integration test for missing audio features handling in services/worker/tests/integration/trackIngestionMissingData.test.ts

### Implementation for User Story 3

- [x] T031 [US3] Handle ReccoBeats returning empty array (proceed with null audio features) in services/worker/src/clients/reccobeats.ts
- [x] T032 [US3] Handle ReccoBeats returning multiple results (use first, log warning) in services/worker/src/clients/reccobeats.ts
- [x] T033 [US3] Handle Musixmatch 404 (return null lyrics, don't throw) in services/worker/src/clients/musixmatch.ts
- [x] T034 [US3] Create zero-vector utility (4096 zeros) for instrumental tracks in services/worker/src/clients/tei.ts
- [x] T035 [US3] Skip interpretation step when lyrics null, use zero vector in services/worker/src/inngest/functions/trackIngestion.ts

**Checkpoint**: Pipeline handles all missing data scenarios gracefully

---

## Phase 6: User Story 4 - Observability and Trace Correlation (Priority: P2)

**Goal**: All external API calls, LLM invocations, and vector operations traced in Langfuse with correlated span IDs.

**Independent Test**: Run an ingestion, verify Langfuse shows correlated traces with spans for all pipeline steps.

### Tests for User Story 4

- [x] T036 [US4] Integration test for Langfuse trace creation and span correlation in services/worker/tests/integration/trackIngestionObservability.test.ts

### Implementation for User Story 4

- [x] T037 [US4] Add langfuse dependency to services/worker/package.json
- [x] T038 [US4] Create trace at pipeline start with ISRC identifier in services/worker/src/inngest/functions/trackIngestion.ts
- [x] T039 [US4] Wrap ReccoBeats call with createHTTPSpan in services/worker/src/inngest/functions/trackIngestion.ts
- [x] T040 [US4] Wrap Musixmatch call with createHTTPSpan in services/worker/src/inngest/functions/trackIngestion.ts
- [x] T041 [US4] Wrap LLM call with createGenerationSpan (capture prompt, completion, tokens) in services/worker/src/inngest/functions/trackIngestion.ts
- [x] T042 [US4] Wrap TEI call with createHTTPSpan in services/worker/src/inngest/functions/trackIngestion.ts
- [x] T043 [US4] Wrap Qdrant upsert with createSearchSpan in services/worker/src/inngest/functions/trackIngestion.ts

**Checkpoint**: All pipeline operations visible in Langfuse with correlated traces

---

## Phase 7: User Story 5 - Rate Limiting for External APIs (Priority: P3)

**Goal**: Pipeline respects rate limits for external APIs so bulk operations don't exhaust quotas.

**Independent Test**: Configure throttle limit (10 tasks/minute), queue 30 tasks, verify execution rate stays within limit via Inngest dashboard.

### Tests for User Story 5

- [x] T044 [US5] Integration test for throttle configuration (verify rate limiting applies) in services/worker/tests/integration/trackIngestionRateLimit.test.ts

### Implementation for User Story 5

- [x] T045 [US5] Add throttle configuration (10/minute) to trackIngestion function in services/worker/src/inngest/functions/trackIngestion.ts
- [x] T046 [US5] Handle 429 responses in ReccoBeats client (throw retryable error) in services/worker/src/clients/reccobeats.ts
- [x] T047 [US5] Handle 429 responses in Musixmatch client (throw retryable error) in services/worker/src/clients/musixmatch.ts

**Checkpoint**: Rate limiting protects against quota exhaustion

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation

- [x] T048 [P] Type-check all new code with `npm run type-check` in services/worker/
- [x] T049 [P] Run all tests with `npm test` in services/worker/
- [x] T050 Validate end-to-end ingestion following specs/006-track-ingestion-pipeline/quickstart.md
- [x] T051 [P] Update CLAUDE.md if any new patterns established

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 priority but US2 depends on US1 implementation
  - US3 and US4 are both P2 priority and can be done in parallel after US1/US2
  - US5 is P3 priority, can be done last
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies
- **User Story 2 (P1)**: Depends on US1 implementation (adds memoization config)
- **User Story 3 (P2)**: Can start after US1 - Independent error handling
- **User Story 4 (P2)**: Can start after US1 - Independent observability layer
- **User Story 5 (P3)**: Can start after US1 - Independent rate limiting

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Client tests before pipeline tests
- Client implementation before pipeline steps
- Core implementation before edge cases

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational client tasks (T007-T010) can run in parallel
- All contract tests (T012-T015) can run in parallel
- US3 and US4 can be worked on in parallel after US1/US2 complete

---

## Parallel Example: User Story 1 Contract Tests

```bash
# Launch all contract tests for User Story 1 together:
Task: "Contract test for ReccoBeats client in services/worker/tests/contract/reccobeats.test.ts"
Task: "Contract test for Musixmatch client in services/worker/tests/contract/musixmatch.test.ts"
Task: "Contract test for TEI embedding client in services/worker/tests/contract/tei.test.ts"
Task: "Contract test for Anthropic LLM client in services/worker/tests/contract/anthropic.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (Complete Track Ingestion)
4. **STOP and VALIDATE**: Trigger ingestion via Inngest UI, verify document in Qdrant
5. This is a functional MVP - tracks can be ingested and searched

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (Complete Ingestion) → Test → MVP!
3. Add US2 (Step Memoization) → Test → Reliable retries
4. Add US3 (Missing Data) → Test → Handles instrumentals
5. Add US4 (Observability) → Test → Full debugging capability
6. Add US5 (Rate Limiting) → Test → Production-ready

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- TEI model download takes ~5-10 minutes on first run
- Musixmatch free tier: 2000 requests/day
