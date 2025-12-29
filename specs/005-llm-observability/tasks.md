# Tasks: LLM Observability Infrastructure

**Input**: Design documents from `/specs/005-llm-observability/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Tests are included per constitution requirement (Test-First Development).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md structure:
- **Docker configs**: Repository root (`docker-compose.yml`, `docker-compose.langfuse.yml`)
- **Observability service**: `services/observability/src/`, `services/observability/tests/`
- **Environment**: `.env.example` at repository root

---

## Phase 1: Setup (Docker Infrastructure)

**Purpose**: Create Langfuse Docker infrastructure that runs alongside existing algojuke services

- [x] T001 Create docker-compose.langfuse.yml with all Langfuse services (langfuse-web, langfuse-worker, postgres, redis, clickhouse, minio) with persistent volumes in docker-compose.langfuse.yml (Note: data retention configured per-project via Langfuse dashboard)
- [x] T002 Update docker-compose.yml to include docker-compose.langfuse.yml via include directive in docker-compose.yml
- [x] T003 [P] Add Langfuse environment variables to .env.example
- [x] T004 Verify Docker stack starts correctly with `docker compose up -d` and dashboard is accessible at http://localhost:3000

---

## Phase 2: Foundational (Observability Service Package)

**Purpose**: Create the observability service package with core configuration and client - MUST be complete before user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Create services/observability/ directory structure with package.json, tsconfig.json per plan.md in services/observability/package.json
- [x] T006 [P] Install dependencies (langfuse, zod, dotenv) in services/observability/
- [x] T007 [P] Create tsconfig.json with TypeScript strict mode in services/observability/tsconfig.json
- [x] T008 Contract test for configuration schema validation (write FIRST, must FAIL) in services/observability/tests/contract/config.test.ts
- [x] T009 Implement configuration loading with Zod validation from specs/005-llm-observability/contracts/observability-config.ts in services/observability/src/config.ts
- [x] T010 Integration test for Langfuse health check (write FIRST, must FAIL) in services/observability/tests/integration/health.test.ts
- [x] T011 Implement Langfuse client initialization with health check in services/observability/src/client.ts
- [x] T012 ~~Create OpenTelemetry instrumentation setup~~ (Simplified: using direct Langfuse SDK instead of OpenTelemetry wrapper for better DX)
- [x] T013 Create public exports in services/observability/src/index.ts
- [x] T014 Verify contract and integration tests pass

**Checkpoint**: Foundation ready - observability service package is complete and verified

---

## Phase 3: User Story 1 - Track LLM Invocations (Priority: P1) 🎯 MVP

**Goal**: Enable developers to track LLM API calls as Langfuse "Generation" spans with full metadata (prompts, completions, tokens, latency)

**Independent Test**: Make a sample LLM API call through the instrumented client and verify the Generation appears in the Langfuse dashboard with all metadata.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**
> **Terminology**: Langfuse uses "Generation" to refer to LLM invocation spans

- [x] T015 [P] [US1] Contract test for Generation span schema validation in services/observability/tests/contract/generation.test.ts
- [x] T016 [P] [US1] Integration test for Generation capture and visibility in dashboard in services/observability/tests/integration/generation-trace.test.ts

### Implementation for User Story 1

- [x] T017 [P] [US1] Copy LLMGenerationMetadataSchema and UsageDetailsSchema from contracts to services/observability/src/schemas/generation.ts
- [x] T018 [US1] Implement Generation span wrapper utility in services/observability/src/generation.ts
- [x] T019 [US1] Add Generation span exports to services/observability/src/index.ts
- [x] T020 [US1] Create example/demo script showing Generation trace capture in services/observability/scripts/demo-generation-trace.ts
- [x] T021 [US1] Verify tests pass and Generation appears in Langfuse dashboard

**Checkpoint**: User Story 1 complete - LLM invocations (Generations) can be tracked and viewed in dashboard

---

## Phase 4: User Story 2 - Track Vector Search Operations (Priority: P2)

**Goal**: Enable developers to track Qdrant vector search operations with query parameters and result metadata

**Independent Test**: Execute a vector search operation and verify search details appear in the Langfuse dashboard.

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T022 [P] [US2] Contract test for vector search span schema validation in services/observability/tests/contract/search-span.test.ts
- [x] T023 [P] [US2] Integration test for search span capture and visibility in services/observability/tests/integration/search-trace.test.ts

### Implementation for User Story 2

- [x] T024 [P] [US2] Copy VectorSearchMetadataSchema and VectorSearchResultSchema from contracts to services/observability/src/schemas/search.ts
- [x] T025 [US2] Implement vector search span wrapper utility in services/observability/src/search.ts
- [x] T026 [US2] Add search span exports to services/observability/src/index.ts
- [x] T027 [US2] Create example/demo script showing search trace capture in services/observability/scripts/demo-search-trace.ts
- [x] T028 [US2] Verify tests pass and search trace appears in Langfuse dashboard

**Checkpoint**: User Story 2 complete - vector search operations can be tracked and viewed in dashboard

---

## Phase 5: User Story 3 - Track External API Calls (Priority: P3)

**Goal**: Enable developers to track external HTTP API calls (Tidal API, embedding services) with request/response metadata

**Independent Test**: Make an external API call through the instrumented HTTP client and verify call details appear in dashboard.

### Tests for User Story 3 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T029 [P] [US3] Contract test for HTTP span schema validation in services/observability/tests/contract/http-span.test.ts
- [x] T030 [P] [US3] Integration test for HTTP span capture and visibility in services/observability/tests/integration/http-trace.test.ts

### Implementation for User Story 3

- [x] T031 [P] [US3] Copy HTTPSpanMetadataSchema and HTTPResponseMetadataSchema from contracts to services/observability/src/schemas/http.ts
- [x] T032 [US3] Implement HTTP span wrapper utility in services/observability/src/http.ts
- [x] T033 [US3] Add HTTP span exports to services/observability/src/index.ts
- [x] T034 [US3] Create example/demo script showing HTTP trace capture in services/observability/scripts/demo-http-trace.ts
- [x] T035 [US3] Verify tests pass and HTTP trace appears in Langfuse dashboard

**Checkpoint**: User Story 3 complete - external API calls can be tracked and viewed in dashboard

---

## Phase 6: User Story 4 - View Correlated Traces (Priority: P4)

**Goal**: Enable developers to see correlated traces linking related operations (search → LLM → response)

**Independent Test**: Execute a multi-step operation with shared trace ID and verify all steps appear linked in dashboard.

### Tests for User Story 4 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T036 [P] [US4] Contract test for trace correlation and nested span structure in services/observability/tests/contract/correlation.test.ts
- [x] T037 [P] [US4] Integration test for correlated multi-operation trace visibility in services/observability/tests/integration/correlation-trace.test.ts

### Implementation for User Story 4

- [x] T038 [US4] Implement trace context propagation utilities in services/observability/src/context.ts
- [x] T039 [US4] Add context propagation exports to services/observability/src/index.ts
- [x] T040 [US4] Create example/demo script showing correlated trace (search + LLM + HTTP) in services/observability/scripts/demo-correlated-trace.ts
- [x] T041 [US4] Verify tests pass and correlated trace appears correctly nested in Langfuse dashboard

**Checkpoint**: User Story 4 complete - correlated traces visible with parent-child relationships

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation updates, validation, and cleanup

- [x] T042 [P] Create README.md for observability service with usage examples in services/observability/README.md
- [x] T043 [P] Update CLAUDE.md with observability service commands and documentation
- [x] T044 Run end-to-end validation: start services, run all demo scripts, verify dashboard
- [x] T045 Run full test suite and verify all tests pass
- [x] T046 Validate quickstart.md instructions work correctly

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3 → P4)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational - No dependencies on other stories
- **User Story 3 (P3)**: Can start after Foundational - No dependencies on other stories
- **User Story 4 (P4)**: Can start after Foundational - Uses utilities from US1-3 but is independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Schema/types before utility implementation
- Utility implementation before demo scripts
- All tests must pass before marking story complete

### Parallel Opportunities

- Phase 1: T003 can run parallel to T001-T002
- Phase 2: T006, T007 can run in parallel; T008, T010 can run in parallel
- Phase 3-6: Tests for each story (marked [P]) can run in parallel within the story
- Phase 7: T042, T043 can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Contract test for LLM generation span schema validation in services/observability/tests/contract/llm-span.test.ts"
Task: "Integration test for LLM span capture and visibility in dashboard in services/observability/tests/integration/llm-trace.test.ts"

# After tests fail, implement schema:
Task: "Copy LLMGenerationMetadataSchema and UsageDetailsSchema from contracts to services/observability/src/schemas/llm.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (Docker infrastructure)
2. Complete Phase 2: Foundational (observability package)
3. Complete Phase 3: User Story 1 (LLM tracking)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready - LLM observability is functional

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → **MVP: LLM tracking works!**
3. Add User Story 2 → Test independently → Search tracking added
4. Add User Story 3 → Test independently → HTTP tracking added
5. Add User Story 4 → Test independently → Full correlation available
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (LLM)
   - Developer B: User Story 2 (Search)
   - Developer C: User Story 3 (HTTP)
   - Developer D: User Story 4 (Correlation) - may start slightly later
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing (TDD per constitution)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Docker must be running for integration tests
