# Tasks: Agent Tool Optimization

**Input**: Design documents from `/specs/013-agent-tool-optimization/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included based on Constitution principle "Test-First Development" and test file paths in plan.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `backend/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and type definitions

- [x] T001 [P] Add OptimizedIndexedTrackResult type and related exports in backend/src/types/agentTools.ts
- [x] T002 [P] Add AGENT_SEARCH_PAYLOAD_FIELDS constant in backend/src/clients/qdrantClient.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core Qdrant method that both US1 and US3 depend on

**CRITICAL**: US1/US3 require the optimized search method before implementation

- [x] T003 Add hybridSearchOptimized method to BackendQdrantClient in backend/src/clients/qdrantClient.ts (uses field selection with_payload array syntax)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Efficient Semantic Search Results (Priority: P1)

**Goal**: Agent semantic search returns short_description instead of interpretation/lyrics, reducing payload by 70%+

**Independent Test**: Ask the agent "find melancholic songs about loss" and verify results contain only short descriptions (50 words or fewer per track)

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T004 [P] [US1] Contract test for OptimizedIndexedTrackResult schema validation in backend/tests/contract/agentTools/optimizedSearch.test.ts
- [x] T005 [P] [US1] Contract test for SemanticSearchOutput with optimized tracks in backend/tests/contract/agentTools/optimizedSearch.test.ts
- [x] T006 [P] [US1] Integration test for hybridSearchOptimized with Qdrant field selection in backend/tests/integration/agentTools/semanticSearchOptimized.test.ts

### Implementation for User Story 1

- [x] T007 [US1] Create enrichResultsOptimized function in backend/src/services/agentTools/semanticSearchTool.ts (returns OptimizedIndexedTrackResult with shortDescription)
- [x] T008 [US1] Update executeSemanticSearch to use hybridSearchOptimized and enrichResultsOptimized in backend/src/services/agentTools/semanticSearchTool.ts
- [x] T009 [US1] Update SemanticSearchOutput type import to use OptimizedIndexedTrackResult in backend/src/services/agentTools/semanticSearchTool.ts
- [x] T010 [US1] Add logging for payload size in semantic search results in backend/src/services/agentTools/semanticSearchTool.ts

**Checkpoint**: Semantic search now returns optimized payload with short descriptions only

---

## Phase 4: User Story 2 - On-Demand Full Metadata Retrieval (Priority: P1)

**Goal**: Batch metadata tool continues returning full interpretation and lyrics for on-demand access

**Independent Test**: Request batch metadata for 3 ISRCs and verify response includes full interpretation and lyrics

### Tests for User Story 2

- [x] T011 [P] [US2] Contract test for IndexedTrackResult with interpretation/lyrics in backend/tests/contract/agentTools/batchMetadataTool.test.ts (verify existing behavior preserved)
- [x] T012 [P] [US2] Contract test for BatchMetadataOutput includes shortDescription field in backend/tests/contract/agentTools/batchMetadataTool.test.ts

### Implementation for User Story 2

- [x] T013 [US2] Update IndexedTrackResult type to include optional shortDescription field in backend/src/types/agentTools.ts
- [x] T014 [US2] Update batchMetadataTool to extract short_description from Qdrant payload in backend/src/services/agentTools/batchMetadataTool.ts
- [x] T015 [US2] Add logging for ISRCs requested and payload size in batch metadata results in backend/src/services/agentTools/batchMetadataTool.ts

**Checkpoint**: Batch metadata returns full data including interpretation, lyrics, AND shortDescription

---

## Phase 5: User Story 3 - Smart Metadata Fetching Strategy (Priority: P2)

**Goal**: Agent system prompt guides sparse use of batch metadata for key tracks only

**Independent Test**: Observe agent behavior across playlist requests; verify it fetches full metadata for 3-5 tracks rather than all results

### Implementation for User Story 3

- [x] T016 [US3] Update agent system prompt in backend/src/services/chatStreamService.ts to guide two-tier metadata approach
- [x] T017 [US3] Add documentation comment in semanticSearchTool.ts explaining when to use batchMetadata in backend/src/services/agentTools/semanticSearchTool.ts

**Checkpoint**: Agent understands to use short descriptions for scanning, full metadata sparingly

---

## Phase 6: User Story 4 - Transparent Token Optimization (Priority: P3)

**Goal**: Observability traces show payload sizes for semantic search and batch metadata

**Independent Test**: Compare Langfuse traces before/after optimization; verify reduced token counts

### Tests for User Story 4

- [x] T018 [P] [US4] Contract test for semantic search trace includes payload size metadata in backend/tests/contract/agentTools/optimizedSearch.test.ts

### Implementation for User Story 4

- [x] T019 [US4] Add payload size calculation to semantic search Langfuse trace in backend/src/services/chatStreamService.ts
- [x] T020 [US4] Add payload size calculation to batch metadata Langfuse trace in backend/src/services/chatStreamService.ts

**Checkpoint**: Observability shows payload sizes for cost analysis

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validation and cleanup

- [x] T021 Verify Discover UI search (discoveryService.ts) still uses hybridSearch with full payload - NO CHANGES NEEDED (verified: discoveryResolver.ts:54 uses search())
- [x] T022 Run full test suite to ensure no regressions: npm test in backend/ (584 tests passed)
- [x] T023 Run quickstart.md validation scenarios manually (skipped: no new validation scenarios needed for backend optimization)
- [x] T024 Update CLAUDE.md if any new technologies or patterns introduced (skipped: no new technologies - uses existing Qdrant, Langfuse, Zod)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on T001, T002 - BLOCKS US1 and US3
- **US1 (Phase 3)**: Depends on T003 (hybridSearchOptimized method)
- **US2 (Phase 4)**: No blocking dependencies (batch metadata is separate path)
- **US3 (Phase 5)**: Depends on US1 completion (needs optimized search working)
- **US4 (Phase 6)**: Depends on US1 and US2 (needs both tools working to trace)
- **Polish (Phase 7)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: Requires Foundational phase - Core optimization
- **User Story 2 (P1)**: Independent of US1 - Parallel implementation possible
- **User Story 3 (P2)**: Requires US1 complete - Agent guidance for optimized workflow
- **User Story 4 (P3)**: Requires US1 + US2 - Observability for both paths

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Core changes before integration
- Logging/observability after main implementation

### Parallel Opportunities

Within Phase 1:
- T001 and T002 can run in parallel (different files)

Within Phase 3 Tests:
- T004, T005, T006 can run in parallel (different test files)

Within Phase 4 Tests:
- T011, T012 can run in parallel (same file but different test cases)

Cross-Story Parallelism:
- US1 and US2 can be developed in parallel by different developers
- US3 requires US1 completion
- US4 requires both US1 and US2

---

## Parallel Example: User Stories 1 & 2

```bash
# Developer A works on US1:
Task: "T004 Contract test for OptimizedIndexedTrackResult"
Task: "T007 Create enrichResultsOptimized function"
Task: "T008 Update executeSemanticSearch"

# Developer B works on US2 (in parallel):
Task: "T011 Contract test for IndexedTrackResult with interpretation/lyrics"
Task: "T013 Update IndexedTrackResult type"
Task: "T014 Update batchMetadataTool"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup (T001, T002)
2. Complete Phase 2: Foundational (T003)
3. Complete Phase 3: User Story 1 - Optimized semantic search
4. Complete Phase 4: User Story 2 - Full batch metadata
5. **STOP and VALIDATE**: Test both tools independently
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (Semantic Search Optimization) → Test → Deploy (Core Optimization!)
3. Add US2 (Batch Metadata Full Data) → Test → Deploy
4. Add US3 (Agent Guidance) → Test → Deploy
5. Add US4 (Observability) → Test → Deploy
6. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1 and US2 are both P1 priority and can be developed in parallel
- US3 (agent prompt) should only be done after US1 is verified working
- discoveryService.ts is explicitly NOT modified (Discover UI unaffected)
- Total: 24 tasks across 7 phases
