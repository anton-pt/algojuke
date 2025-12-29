# Tasks: Background Task Queue Infrastructure

**Input**: Design documents from `/specs/003-background-task-queue/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/events.ts, quickstart.md

**Tests**: This feature uses @inngest/test for function contract testing. Tests are included per constitution requirements.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Important Note**: This feature implements ONLY the infrastructure with a placeholder demo task. Actual track enrichment (metadata fetching, lyrics, embeddings) is deferred to a follow-up feature. Demo tasks are triggered via Inngest UI, not backend integration.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Infrastructure Foundation)

**Purpose**: Initialize worker service structure and Docker orchestration

- [X] T001 Create worker service directory structure at services/worker/ with src/, tests/, and config subdirectories
- [X] T002 Initialize worker service package.json with TypeScript 5.3.3, Node.js 20.x, Inngest SDK, Zod 3.x, Express, and Vitest dependencies
- [X] T003 [P] Configure TypeScript in services/worker/tsconfig.json with strict mode and ES2022 target
- [X] T004 [P] Create services/worker/.env.example template with INNGEST_DEV, DATABASE_URL, and WORKER_PORT variables
- [X] T005 Extend existing docker-compose.yml at repository root to add Inngest Dev Server (port 8288) and worker service (port 3001) to existing PostgreSQL composition
- [X] T006 [P] Create services/worker/Dockerfile for worker service with Node.js 20 Alpine base image
- [X] T007 [P] Create services/worker/.gitignore excluding node_modules, .env, and build artifacts

---

## Phase 2: Foundational (Inngest Client & Event Schemas)

**Purpose**: Core Inngest infrastructure that MUST be complete before ANY user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T008 Copy event schemas from specs/003-background-task-queue/contracts/events.ts to services/worker/src/inngest/events.ts
- [X] T009 Create Inngest client configuration in services/worker/src/inngest/client.ts with typed event schemas
- [X] T010 [P] Create Express server in services/worker/src/server.ts to serve Inngest function endpoints at /api/inngest
- [X] T011 [P] Create function index file at services/worker/src/inngest/functions/index.ts for exporting all functions
- [X] T012 [P] Configure Vitest in services/worker/vitest.config.ts with @inngest/test integration

**Checkpoint**: Foundation ready - demo task and observability implementation can now begin in parallel

---

## Phase 3: User Story 1 - Track Metadata Enrichment Infrastructure (Priority: P1) 🎯 MVP

**Goal**: Demonstrate background task execution with multi-step workflow, durable execution, automatic retry, and state persistence through a placeholder demo task

**Independent Test**: Send demo/task.requested event via Inngest UI with taskId, observe 5-step execution in dashboard, verify step memoization by simulating failure and confirming successful steps don't re-execute on retry

**Note**: This implements ONLY the infrastructure validation. Actual track enrichment deferred to follow-up feature.

### Tests for User Story 1 (Contract Tests)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T013 [P] [US1] Create demo task contract test in services/worker/tests/functions/demoTask.test.ts testing successful completion of all 5 steps
- [X] T014 [P] [US1] Add contract test for simulated failure scenario in services/worker/tests/functions/demoTask.test.ts verifying retry behavior with failAtStep option
- [X] T015 [P] [US1] Add contract test for step memoization in services/worker/tests/functions/demoTask.test.ts verifying successful steps aren't re-executed on retry

### Implementation for User Story 1

- [X] T016 [US1] Create demo task function in services/worker/src/inngest/functions/demoTask.ts with function configuration (id: "demo-task", retries: 5, concurrency: 10)
- [X] T017 [US1] Implement step-1-initialize in services/worker/src/inngest/functions/demoTask.ts logging task start and returning initialization timestamp
- [X] T018 [US1] Implement step-2-process in services/worker/src/inngest/functions/demoTask.ts simulating data processing with 100ms delay
- [X] T019 [US1] Implement step-3-simulate-delay in services/worker/src/inngest/functions/demoTask.ts using configurable delayMs parameter from event data
- [X] T020 [US1] Implement step-4-simulate-api-call in services/worker/src/inngest/functions/demoTask.ts with conditional failure logic based on simulateFailure and failAtStep parameters
- [X] T021 [US1] Implement step-5-finalize in services/worker/src/inngest/functions/demoTask.ts accumulating all step results and returning DemoTaskResult
- [X] T022 [US1] Add demo/task.completed event emission in services/worker/src/inngest/functions/demoTask.ts on successful completion
- [X] T023 [US1] Add demo/task.failed event emission and error handling in services/worker/src/inngest/functions/demoTask.ts for permanent failures
- [X] T024 [US1] Export demoTask function from services/worker/src/inngest/functions/index.ts
- [X] T025 [US1] Register demoTask function with Inngest serve() in services/worker/src/server.ts

**Checkpoint**: At this point, demo task should execute successfully via Inngest UI, demonstrating durable multi-step execution with retry capability

---

## Phase 4: User Story 2 - Monitor Enrichment Progress (Priority: P2)

**Goal**: Validate that Inngest's built-in dashboard provides comprehensive task observability including status tracking, error inspection, and manual retry capability

**Independent Test**: Trigger multiple demo tasks with various configurations (success, simulated failure, different priorities), navigate Inngest dashboard to view task list, inspect individual run details including waterfall trace and step outputs, manually replay a failed task

**Note**: This story validates existing Inngest dashboard features - no custom implementation needed

### Implementation for User Story 2

**Note**: Dashboard documentation consolidated into Phase 7 T043 to avoid duplication

- [X] T026 [US2] Create test scenario script in services/worker/scripts/test-observability.sh triggering 5 demo tasks with various configurations (success, simulated failure at different steps, priority variations) for dashboard validation

**Checkpoint**: At this point, Inngest dashboard should provide full visibility into task execution with manual retry capability validated

---

## Phase 5: User Story 3 - Manage Rate Limits (Priority: P3)

**Goal**: Demonstrate rate limiting and throttling capabilities through Inngest's throttle configuration, validated via demo task execution

**Independent Test**: Configure throttle limit on demo task (e.g., 10 tasks per minute), queue 30 tasks rapidly via Inngest UI, observe in dashboard metrics that execution rate respects configured limit with tasks queuing appropriately

### Tests for User Story 3

- [X] T031 [P] [US3] Create rate limit test in services/worker/tests/functions/demoTask.test.ts verifying throttle configuration is applied
- [X] T032 [P] [US3] Add throttle behavior validation test in services/worker/tests/functions/demoTask.test.ts using @inngest/test to simulate rate-limited execution

### Implementation for User Story 3

- [X] T033 [US3] Add throttle configuration to demo task in services/worker/src/inngest/functions/demoTask.ts with limit: 100, period: "1m", key: "event.data.taskId"
- [X] T034 [US3] Create rate limit test scenario script in services/worker/scripts/test-rate-limits.sh submitting 30 events to validate throttling

**Checkpoint**: At this point, demo task should respect configured rate limits, preventing excessive execution and validating throttle infrastructure

---

## Phase 6: Integration & Validation

**Purpose**: End-to-end validation of all infrastructure capabilities

- [X] T037 Verify Docker Compose brings up Inngest Dev Server on port 8288 and worker service on port 3001
- [X] T038 [P] Validate idempotency by sending duplicate demo/task.requested events with same taskId within 24-hour window and confirming deduplication
- [X] T039 [P] Validate priority queue by sending 3 demo tasks with priorities -300, 0, 300 and confirming high-priority task executes first
- [X] T040 Validate concurrency limits by queuing 20 tasks and confirming max 10 execute simultaneously per Inngest metrics
- [X] T041 [P] Validate durable execution by stopping worker service mid-task and confirming task resumes on restart
- [X] T042 [P] Validate step memoization by triggering task with simulated failure at step-4, confirming steps 1-3 don't re-execute on retry
- [X] T043 Run all Vitest tests in services/worker/tests/ and confirm 100% pass rate
- [X] T044 Follow quickstart.md setup instructions from start to finish and confirm all validation scenarios execute successfully

---

## Phase 7: Polish & Documentation

**Purpose**: Finalize documentation and production-readiness guidance

**README.md Structure** (T035-T039 consolidate into single README):
```
services/worker/README.md:
├── Architecture Overview (T035)
├── Quick Start (T035)
├── Configuration (T036 - Environment variables, API keys)
├── Development Workflow (T037 - Hot reload, debugging, testing)
├── Throttle & Rate Limiting (US3 docs from T034/T036)
├── Dashboard & Observability (US2 docs from T026-T028,T030)
├── Infrastructure Limitations (T039 - 4MB limit, retention)
├── Troubleshooting (T040)
└── Future Enhancements (T041)
```

- [X] T035 [P] Create services/worker/README.md with architecture overview, quick start, and project structure sections
- [X] T036 [P] Add Configuration section to services/worker/README.md documenting environment variables (.env.example reference) with security notes about API key management for future workflows
- [X] T037 [P] Add Development Workflow section to services/worker/README.md covering npm run dev, hot reload behavior, debugging with breakpoints, and running tests
- [X] T038 [P] Create local deployment guidance in services/worker/VALIDATION.md covering Docker Compose setup, service verification, and Inngest UI access (scoped for local-only per FR-017)
- [X] T039 Add Infrastructure Limitations section to services/worker/README.md documenting Inngest constraints (4MB step data limit, unlimited history retention, SQLite for local dev)
- [X] T040 Add Troubleshooting section to services/worker/README.md with common issues from quickstart.md (service discovery failures, port conflicts, Docker network issues)
- [X] T041 Add Future Enhancements section to services/worker/README.md outlining track enrichment integration path for follow-up feature
- [X] T042 Add Throttle Configuration subsection to README.md explaining rate limit parameters (limit, period, key) and how to observe enforcement in dashboard metrics (consolidates US3 T034/T036)
- [X] T043 Add Observability Dashboard subsection to README.md with navigation guide (Functions, Events, Runs tabs), filtering instructions, and manual retry procedure (consolidates US2 T026-T028,T030)
- [X] T044 Update CLAUDE.md in repository root with worker service commands (npm install, npm run dev, npm test, docker-compose up) and infrastructure details

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Integration (Phase 6)**: Depends on all user stories being complete
- **Polish (Phase 7)**: Depends on Integration completion

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories - INFRASTRUCTURE FOUNDATION
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Validation of existing Inngest features, no code dependencies
- **User Story 3 (P3)**: Depends on User Story 1 completion (adds throttle config to demo task) - Can run independently after US1

### Within Each User Story

- Tests MUST be written and FAIL before implementation (per constitution)
- Demo task steps implemented sequentially (step-1 through step-5)
- Function registration after implementation complete
- Story validation before moving to next priority

### Parallel Opportunities

**Phase 1 (Setup)**:
- T003, T004, T006, T007 can all run in parallel (different files)

**Phase 2 (Foundational)**:
- T010, T011, T012 can run in parallel after T008-T009 complete (different files)

**Phase 3 (User Story 1)**:
- T013, T014, T015 can all run in parallel (different test cases)
- T016-T021 must run sequentially (same file, building multi-step function)
- T022-T025 can run after T016-T021 complete

**Phase 5 (User Story 3)**:
- T031, T032 can run in parallel (different test cases)
- T034, T035, T036 can run in parallel after T033 (different files)

**Phase 6 (Integration)**:
- T038, T039, T041, T042 can run in parallel (independent validation scenarios)

**Phase 7 (Polish)**:
- T045, T046, T047, T048 can all run in parallel (different documentation files)

---

## Parallel Example: User Story 1 Tests

```bash
# Launch all contract tests for User Story 1 together:
Task: "Create demo task contract test in services/worker/tests/functions/demoTask.test.ts testing successful completion"
Task: "Add contract test for simulated failure scenario verifying retry behavior"
Task: "Add contract test for step memoization verifying successful steps aren't re-executed"
```

## Parallel Example: Phase 1 Setup

```bash
# Launch configuration tasks together:
Task: "Configure TypeScript in services/worker/tsconfig.json"
Task: "Create services/worker/.env.example template"
Task: "Create services/worker/Dockerfile"
Task: "Create services/worker/.gitignore"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Demo task execution)
4. **STOP and VALIDATE**: Trigger demo tasks via Inngest UI, verify multi-step execution, retry behavior, and durable execution
5. Deploy/demo infrastructure capabilities

This MVP demonstrates:
- ✅ Durable multi-step workflow execution
- ✅ Automatic retry with exponential backoff
- ✅ Step memoization (completed steps don't re-execute)
- ✅ State persistence across restarts
- ✅ Event-driven architecture
- ✅ Separate worker service (FR-010)

### Incremental Delivery

1. **Foundation** (Phases 1-2): Setup + Foundational → Infrastructure ready
2. **MVP** (Phase 3): User Story 1 → Test demo task independently → Demo multi-step execution
3. **Observability** (Phase 4): User Story 2 → Validate dashboard features → Demo task monitoring
4. **Rate Limiting** (Phase 5): User Story 3 → Add throttle config → Demo rate limit enforcement
5. **Production-Ready** (Phases 6-7): Integration validation + Documentation → Ready for track enrichment implementation

Each story adds infrastructure capability validation without breaking previous stories.

### Parallel Team Strategy

With multiple developers after Foundational phase completes:

1. **Team completes Setup + Foundational together** (Phases 1-2)
2. **Once Foundational is done**:
   - Developer A: User Story 1 (Demo task implementation)
   - Developer B: User Story 2 (Dashboard validation docs)
   - Developer C: User Story 3 (Rate limiting config) - waits for US1 completion
3. **Integration & Polish**: Team collaborates on validation and documentation

---

## Task Summary

**Total Tasks**: 44 (reduced from 52 via documentation consolidation)

**Tasks by Phase**:
- Phase 1 (Setup): 7 tasks (T001-T007)
- Phase 2 (Foundational): 5 tasks (T008-T012)
- Phase 3 (User Story 1): 13 tasks (T013-T025)
- Phase 4 (User Story 2): 1 task (T026) - dashboard documentation consolidated to Phase 7 T043
- Phase 5 (User Story 3): 4 tasks (T027 removed, T031-T034) - throttle documentation consolidated to Phase 7 T042
- Phase 6 (Integration): 8 tasks (T037-T044)
- Phase 7 (Polish): 10 tasks (T035-T044) - includes consolidated README sections

**Tasks by User Story**:
- US1 (Track Metadata Enrichment Infrastructure): 13 tasks
- US2 (Validate Observability Dashboard): 1 task (test script only, docs in Phase 7 T043)
- US3 (Validate Rate Limiting Infrastructure): 4 tasks (including tests, impl, script; docs in Phase 7 T042)

**Documentation Consolidation**:
- US2 dashboard documentation → Phase 7 T043
- US3 throttle documentation → Phase 7 T042
- All README sections organized into single coherent structure (T035-T043)

**Parallel Opportunities**: 14 tasks marked [P] can run in parallel within their phase

**MVP Scope** (Recommended first delivery):
- Phase 1: Setup (7 tasks)
- Phase 2: Foundational (5 tasks)
- Phase 3: User Story 1 (13 tasks)
- **Total MVP**: 25 tasks (unchanged)

**Success Criteria Mapping**:
- SC-001 (No user delay): Validated by infrastructure demonstration (async execution)
- SC-002 (95% completion in 24h): Validated by retry policy configuration
- SC-003 (10,000 tasks/day): Validated by concurrency configuration (10 concurrent)
- SC-004 (90% recovery in 2h): Validated by exponential backoff testing
- SC-005 (Zero rate limit violations): Validated by throttle configuration (US3)
- SC-006 (Zero lost tasks): Validated by durable execution testing (T041)
- SC-007 (No duplicate expensive calls): Validated by step memoization testing (T042)
- SC-008 (Identify failures in 2min): Validated by dashboard navigation (US2)
- SC-009 (Real-time metrics): Validated by Inngest dashboard metrics (US2)

---

## Notes

- All tasks follow strict checklist format: `- [ ] [ID] [P?] [Story] Description with file path`
- [P] tasks operate on different files with no dependencies
- [Story] labels (US1, US2, US3) map tasks to user stories for traceability
- Each user story is independently testable and deliverable
- Tests written FIRST per constitution, must FAIL before implementation
- Demo task is placeholder - actual track enrichment deferred to follow-up feature
- No backend integration in this feature - demo tasks triggered via Inngest UI
- Foundation (Phase 2) BLOCKS all user story work - must complete first
- Commit after each task or logical group for incremental progress
- Stop at any checkpoint to validate story independently before proceeding
