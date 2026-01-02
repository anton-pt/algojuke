# Tasks: Tidal Search Tool Refinement

**Input**: Design documents from `/specs/014-tidal-search-refinement/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, quickstart.md

**Tests**: Contract tests and integration tests are included as specified in plan.md (Test-First Development principle).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `backend/tests/`

---

## Phase 1: Setup

**Purpose**: Verify current state and prepare for changes

- [x] T001 Review current tool descriptions in backend/src/services/chatStreamService.ts (lines 230 and 324)
- [x] T002 Review current system prompt in backend/src/prompts/chatSystemPrompt.ts

---

## Phase 2: Foundational (Contract Tests)

**Purpose**: Write tests that validate tool description content - these MUST fail before implementation

**⚠️ CRITICAL**: Tests should fail initially, proving the current descriptions lack required clarity

- [x] T003 [P] Create contract test file backend/tests/contract/toolDescriptions.test.ts with test structure
- [x] T004 [P] Add test: Tidal search description contains "text-based" or "keyword" in backend/tests/contract/toolDescriptions.test.ts
- [x] T005 [P] Add test: Tidal search description contains "does NOT" warning about mood queries in backend/tests/contract/toolDescriptions.test.ts
- [x] T006 [P] Add test: Semantic search description contains "lyrics interpretation" clarification in backend/tests/contract/toolDescriptions.test.ts
- [x] T007 [P] Add test: Semantic search description mentions library-only scope in backend/tests/contract/toolDescriptions.test.ts
- [x] T008 Add test: System prompt contains "Tool Selection Strategy" section in backend/tests/contract/toolDescriptions.test.ts
- [x] T008a Verify all contract tests FAIL by running `cd backend && npm test -- tests/contract/toolDescriptions.test.ts` (expected: 6 failures)

**Checkpoint**: All 6 contract tests MUST fail before proceeding to Phase 3

---

## Phase 3: User Story 1 & 2 - Tool Description Clarity (Priority: P1) 🎯 MVP

**Goal**: Update tool descriptions so the agent clearly understands each tool's capabilities and limitations

**Independent Test**: After changes, contract tests should pass. Agent should use correct tools for different query types.

**Story Mapping**:
- **US1** (Knowledge-Driven Discovery): Agent uses music knowledge to augment semantic search → Addressed by T011-T015 (system prompt)
- **US2** (Clear Tool Selection): Tool descriptions clarify capabilities → Addressed by T009-T010 (tool descriptions)

**Note**: US1 and US2 are implemented together as they both require the same tool description and system prompt changes. They remain independently testable via their respective acceptance scenarios.

### Implementation for User Stories 1 & 2

- [x] T009 [US1+US2] Update Tidal search tool description in backend/src/services/chatStreamService.ts (line ~324) to clarify text-only keyword search and warn against mood queries
- [x] T010 [US1+US2] Update semantic search tool description in backend/src/services/chatStreamService.ts (line ~230) to clarify lyrics interpretation matching and library-only scope
- [x] T011 [US1+US2] Add "Tool Selection Strategy" section to system prompt in backend/src/prompts/chatSystemPrompt.ts
- [x] T012 [US1+US2] Add "Understanding Tool Capabilities" subsection explaining semanticSearch matches lyrics interpretation, not musical style in backend/src/prompts/chatSystemPrompt.ts
- [x] T013 [US1+US2] Add "When to Use Each Tool" decision tree (mood → semantic+tidal, artist → tidal only) in backend/src/prompts/chatSystemPrompt.ts
- [x] T014 [US1+US2] Add "Using Your Music Knowledge" guidance with CRITICAL note about always augmenting semantic search in backend/src/prompts/chatSystemPrompt.ts
- [x] T015 [US1+US2] Add example workflow showing semantic search + knowledge-derived Tidal queries in backend/src/prompts/chatSystemPrompt.ts

**Checkpoint**: Run `npm test -- tests/contract/toolDescriptions.test.ts` - all tests should PASS

---

## Phase 4: User Story 3 - Transparent Search Strategy (Priority: P2)

**Goal**: Agent explains its reasoning when using music knowledge for Tidal searches

**Independent Test**: Ask agent for mood-based music and verify it explains why it searched for specific artists

**Note**: This is primarily achieved through the system prompt guidance added in Phase 3. This phase validates the behavior.

### Implementation for User Story 3

- [x] T016 [US3] Verify system prompt includes guidance for agent to "explain why you suggested those artists" in backend/src/prompts/chatSystemPrompt.ts
- [x] T017 [US3] Verify example workflow shows agent explaining reasoning ("masters of the ambient genre") in backend/src/prompts/chatSystemPrompt.ts

**Checkpoint**: Manual test - ask agent for mood-based music, verify explanation is provided

---

## Phase 5: User Story 4 - Empty Library Handling (Priority: P2)

**Goal**: Agent gracefully handles users with empty/small indexed libraries by leaning on Tidal search

**Independent Test**: Test with empty indexed library, ask for mood-based music, verify agent acknowledges and offers Tidal suggestions

**Note**: This behavior emerges from the "always augment" guidance in Phase 3. This phase validates the behavior.

### Implementation for User Story 4

- [x] T018 [US4] Verify system prompt guidance covers scenario where semantic search returns low-relevance results (always augment with Tidal) in backend/src/prompts/chatSystemPrompt.ts
- [x] T018a [US4] Verify system prompt includes guidance for agent to "suggest different search terms" when no results found (covers FR-014) in backend/src/prompts/chatSystemPrompt.ts
- [x] T018b [US4] Verify system prompt includes guidance for agent to "try alternative artists" when suggested artists unavailable (covers FR-015) in backend/src/prompts/chatSystemPrompt.ts

**Checkpoint**: Manual test - with empty library, ask for mood music, verify Tidal suggestions provided

---

## Phase 6: Integration Tests (Optional)

**Purpose**: Automated validation of agent behavior

**Mock Strategy**: Use Vitest to mock the `streamText` function from Vercel AI SDK. Capture tool call arguments to verify:
- Which tools the agent attempts to call
- What query text is passed to each tool
- The order of tool invocations

- [x] T019 [P] Create integration test file backend/tests/integration/agentToolSelection.test.ts with Vitest mock setup for streamText
- [x] T020 [P] Add test: For mood query input, verify semanticSearch is called in backend/tests/integration/agentToolSelection.test.ts
- [x] T021 [P] Add test: For artist query input ("Radiohead"), verify tidalSearch is called with "Radiohead" (not mood text) in backend/tests/integration/agentToolSelection.test.ts
- [x] T022 [P] Add test: For mood query, verify any tidalSearch call uses artist/album names (not the original mood text) in backend/tests/integration/agentToolSelection.test.ts

**Checkpoint**: Run `npm test -- tests/integration/agentToolSelection.test.ts` - tests should pass

---

## Phase 7: Polish & Validation

**Purpose**: Final validation and documentation

- [x] T023 Run quickstart.md validation checklist from specs/014-tidal-search-refinement/quickstart.md
- [x] T024 Run full test suite: `cd backend && npm test`
- [x] T025 Manual end-to-end test: Mood query ("I want dreamy ambient music") - verify both semanticSearch AND tidalSearch used
- [x] T026 Manual end-to-end test: Artist query ("What albums does Radiohead have") - verify only tidalSearch used
- [x] T027 Update specs/014-tidal-search-refinement/checklists/requirements.md to mark all items complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - creates tests that MUST fail initially
- **US1+US2 (Phase 3)**: Depends on Phase 2 - implementation makes tests pass
- **US3 (Phase 4)**: Depends on Phase 3 - validates transparency behavior
- **US4 (Phase 5)**: Depends on Phase 3 - validates empty library handling
- **Integration Tests (Phase 6)**: Depends on Phase 3 - can run in parallel with US3/US4
- **Polish (Phase 7)**: Depends on all prior phases

### User Story Dependencies

- **User Stories 1+2 (P1)**: Implemented together - same file changes
- **User Story 3 (P2)**: Can be validated immediately after US1+2
- **User Story 4 (P2)**: Can be validated immediately after US1+2

### Within Each Phase

- Contract tests MUST be written and FAIL before implementation (TDD)
- Tool descriptions updated before system prompt additions
- System prompt sections added in logical order (capabilities → decision tree → guidance → example)

### Parallel Opportunities

- All Phase 2 tasks (T003-T008) can run in parallel - different test cases
- Phase 4 and Phase 5 can run in parallel (both just validate Phase 3 changes)
- All Phase 6 tasks (T019-T022) can run in parallel - different test cases

---

## Parallel Example: Contract Tests (Phase 2)

```bash
# Launch all contract tests together:
Task: "Add test: Tidal search description contains 'text-based' in backend/tests/contract/toolDescriptions.test.ts"
Task: "Add test: Tidal search description contains 'does NOT' warning in backend/tests/contract/toolDescriptions.test.ts"
Task: "Add test: Semantic search description contains 'lyrics interpretation' in backend/tests/contract/toolDescriptions.test.ts"
Task: "Add test: Semantic search description mentions library-only scope in backend/tests/contract/toolDescriptions.test.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup (review current state)
2. Complete Phase 2: Contract tests (they should FAIL)
3. Complete Phase 3: US1+US2 implementation (tests should PASS)
4. **STOP and VALIDATE**: Run contract tests, manual test with chat
5. Deploy if ready - this is the core feature

### Incremental Delivery

1. Complete Setup + Contract Tests → Tests fail (expected)
2. Add US1+US2 implementation → Tests pass → Deploy (MVP!)
3. Validate US3 behavior → Confirm transparency
4. Validate US4 behavior → Confirm empty library handling
5. Add integration tests → Full automated coverage
6. Polish → Final validation

### Single Developer Flow

Since this feature touches only 2 source files:

1. T001-T002: Review (5 min)
2. T003-T008a: Write contract tests + verify failures (15 min)
3. T009-T015: Update source files (30 min)
4. T016-T018b: Validate behaviors (10 min)
5. T019-T022: Integration tests (20 min)
6. T023-T027: Polish (10 min)

**Total estimated time**: ~90 minutes
**Total tasks**: 30

---

## Notes

- [P] tasks = different files or test cases, no dependencies
- [US1+US2] label indicates tasks serve both User Story 1 and User Story 2 (tightly coupled)
- This feature is primarily documentation/prompt changes - no new logic
- Contract tests validate string content in tool descriptions and system prompt
- Integration tests would require mocking the LLM to verify tool selection behavior
- Manual testing recommended for final validation of agent behavior
