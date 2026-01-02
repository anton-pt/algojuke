# Tasks: Track Short Description

**Input**: Design documents from `/specs/012-track-short-description/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Tests**: Constitution mandates test-first development. Tests included per principle.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extend existing schema and create shared utilities

- [x] T001 [P] Add `short_description` field to TrackDocumentSchema in `services/search-index/src/schema/trackDocument.ts`
- [x] T002 [P] Create prompt templates in `services/worker/src/prompts/shortDescription.ts`
- [x] T003 [P] Create Haiku model constant and types in `services/worker/src/clients/anthropic.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core short description generation function shared by pipeline and backfill

**⚠️ CRITICAL**: User stories 1-4 depend on this phase

- [x] T004 Contract test for short description prompts in `services/worker/tests/contract/shortDescription.test.ts`
- [x] T005 Implement `generateShortDescription` function using Haiku in `services/worker/src/clients/anthropic.ts`
- [x] T006 Implement audio feature formatter for instrumental prompt in `services/worker/src/prompts/shortDescription.ts`
- [x] T007 Update schema contract tests for `short_description` field in `services/search-index/tests/contract/trackDocument.test.ts`

**Checkpoint**: Foundation ready - `generateShortDescription()` function available for both pipeline and backfill

---

## Phase 3: User Story 1 - Short Description Generation During Ingestion (Priority: P1) 🎯 MVP

**Goal**: Tracks ingested via pipeline receive a `short_description` automatically

**Independent Test**: Submit track ISRC via Inngest, verify `short_description` exists in Qdrant document

### Tests for User Story 1

> **NOTE: Write tests FIRST, ensure they FAIL before implementation**

- [x] T008 [P] [US1] Integration test for pipeline with short description in `services/worker/tests/integration/trackIngestionShortDesc.test.ts`

### Implementation for User Story 1

- [x] T009 [US1] Add `generate-short-description` step to pipeline in `services/worker/src/inngest/functions/trackIngestion.ts`
- [x] T010 [US1] Update `store-document` step to include `short_description` in payload in `services/worker/src/inngest/functions/trackIngestion.ts`
- [x] T011 [US1] Handle generation failure gracefully (store null, continue) in `services/worker/src/inngest/functions/trackIngestion.ts`

**Checkpoint**: New track ingestion produces `short_description` in Qdrant. MVP complete.

---

## Phase 4: User Story 2 - Backfill Existing Tracks (Priority: P1)

**Goal**: Script processes existing tracks without `short_description` at 1 track/2 seconds

**Independent Test**: Run backfill script, verify tracks gain `short_description` fields

### Tests for User Story 2

- [x] T012 [P] [US2] Contract test for BackfillProgress schema in `services/worker/tests/contract/backfillProgress.test.ts`

### Implementation for User Story 2

- [x] T013 [P] [US2] Create BackfillProgress Zod schema in `services/worker/src/schemas/backfillProgress.ts`
- [x] T014 [US2] Implement backfill script with Qdrant scroll in `services/worker/scripts/backfill-short-descriptions.ts`
- [x] T015 [US2] Add progress file save/load for resumption in `services/worker/scripts/backfill-short-descriptions.ts`
- [x] T016 [US2] Add 2-second delay between tracks (rate limiting) in `services/worker/scripts/backfill-short-descriptions.ts`
- [x] T017 [US2] Add progress logging (count, errors, ETA) in `services/worker/scripts/backfill-short-descriptions.ts`
- [x] T018 [US2] Add `--reset` flag to restart from beginning in `services/worker/scripts/backfill-short-descriptions.ts`

**Checkpoint**: Backfill script processes existing tracks, resumable after interruption

---

## Phase 5: User Story 3 - Graceful Handling for Instrumental Tracks (Priority: P2)

**Goal**: Instrumental tracks get meaningful descriptions from metadata/audio features

**Independent Test**: Ingest instrumental track (no lyrics), verify `short_description` reflects audio characteristics

### Tests for User Story 3

- [x] T019 [P] [US3] Integration test for instrumental track description in `services/worker/tests/integration/trackIngestionInstrumental.test.ts`

### Implementation for User Story 3

- [x] T020 [US3] Add instrumental prompt template in `services/worker/src/prompts/shortDescription.ts`
- [x] T021 [US3] Update `generate-short-description` step to detect instrumental and use alternate prompt in `services/worker/src/inngest/functions/trackIngestion.ts`
- [x] T022 [US3] Add metadata-only fallback for tracks with no audio features in `services/worker/src/prompts/shortDescription.ts`

**Checkpoint**: Instrumental tracks receive contextual descriptions based on audio features

---

## Phase 6: User Story 4 - Observability for Short Description Generation (Priority: P3)

**Goal**: Langfuse traces capture short description generation spans with token usage

**Independent Test**: Run ingestion, verify Langfuse shows `llm-short-description` span with model/prompt/completion

### Tests for User Story 4

- [x] T023 [P] [US4] Contract test for generation span configuration in `services/worker/tests/contract/shortDescriptionObservability.test.ts`

### Implementation for User Story 4

- [x] T024 [US4] Add Langfuse generation span for short description in `services/worker/src/inngest/functions/trackIngestion.ts`
- [x] T025 [US4] Add trace metadata (isrc, hasInterpretation flag) in `services/worker/src/inngest/functions/trackIngestion.ts`
- [x] T026 [US4] Add Langfuse tracing to backfill script in `services/worker/scripts/backfill-short-descriptions.ts`

**Checkpoint**: All short description generations visible in Langfuse with accurate metrics

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and validation

- [x] T027 [P] Update worker README with short description documentation in `services/worker/README.md`
- [x] T028 Run quickstart.md validation checklist in `specs/012-track-short-description/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 but can proceed in parallel after Foundational
  - US3 depends on US1 completion (extends pipeline logic)
  - US4 depends on US1 completion (adds observability to pipeline)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - Core MVP
- **User Story 2 (P1)**: Can start after Foundational - Backfill script is independent
- **User Story 3 (P2)**: After US1 - Extends pipeline with instrumental handling
- **User Story 4 (P3)**: After US1 - Adds observability to pipeline

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Prompts/schemas before service functions
- Service functions before pipeline integration
- Pipeline integration before validation

### Parallel Opportunities

- T001, T002, T003 can run in parallel (Setup phase)
- T008, T012, T019, T023 can run in parallel (tests for different stories)
- US1 and US2 can be developed in parallel after Foundational phase
- T027, T028 can run in parallel (Polish phase)

---

## Parallel Example: Setup Phase

```bash
# Launch all setup tasks together:
Task: "Add short_description field to TrackDocumentSchema in services/search-index/src/schema/trackDocument.ts"
Task: "Create prompt templates in services/worker/src/prompts/shortDescription.ts"
Task: "Create Haiku model constant and types in services/worker/src/clients/anthropic.ts"
```

## Parallel Example: User Stories 1 & 2

```bash
# After Foundational phase, launch US1 and US2 in parallel:
# Developer A:
Task: "Integration test for pipeline with short description in services/worker/tests/integration/trackIngestionShortDesc.test.ts"
Task: "Add generate-short-description step to pipeline..."

# Developer B:
Task: "Contract test for BackfillProgress schema..."
Task: "Implement backfill script with Qdrant scroll..."
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T007)
3. Complete Phase 3: User Story 1 (T008-T011)
4. **STOP and VALIDATE**: Test pipeline with single track ingestion
5. Deploy - new tracks will have short descriptions

### Incremental Delivery

1. Complete Setup + Foundational → Core generation ready
2. Add User Story 1 → Pipeline generates descriptions → Deploy MVP
3. Add User Story 2 → Backfill existing tracks → Run backfill
4. Add User Story 3 → Instrumentals get proper descriptions → Re-run backfill
5. Add User Story 4 → Full observability → Monitor in Langfuse

### Backfill Timing Note

Run backfill script AFTER User Story 3 is complete to ensure instrumental tracks get proper descriptions on first pass.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Backfill rate: 1 track every 2 seconds (per user specification)
- Short descriptions: single sentence, max 50 words
- Model: claude-haiku-4-5-20251001
- Graceful failure: store null, continue pipeline
- Verify tests fail before implementing
- Commit after each task or logical group
