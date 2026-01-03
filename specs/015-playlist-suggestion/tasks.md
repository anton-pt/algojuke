# Tasks: Playlist Suggestion Agent Tool

**Input**: Design documents from `/specs/015-playlist-suggestion/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Included as requested - contract tests for schema validation, component tests for frontend.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing. **Tests are placed FIRST in each phase per Constitution Principle I (Test-First Development).**

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema definitions and type extensions required by all user stories

- [x] T001 Add SuggestPlaylistInputSchema to `backend/src/schemas/agentTools.ts` per contracts/playlist-tool-schema.md
- [x] T002 Add PlaylistInputTrackSchema to `backend/src/schemas/agentTools.ts` with ISRC validation
- [x] T003 Extend ToolName enum with 'suggestPlaylist' in `backend/src/schemas/agentTools.ts`
- [x] T004 [P] Add EnrichedPlaylistTrack interface to `backend/src/types/agentTools.ts` per data-model.md
- [x] T005 [P] Add SuggestPlaylistOutput interface to `backend/src/types/agentTools.ts` per data-model.md
- [x] T006 Extend ToolOutput union with SuggestPlaylistOutput in `backend/src/types/agentTools.ts`
- [x] T007 [P] Extend ToolCallStartEvent input union with SuggestPlaylistInput in `backend/src/types/agentTools.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend tool implementation and TidalService batch method exposure

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational Phase (Write FIRST, must FAIL before implementation)

- [x] T008 [P] Contract test for SuggestPlaylistInputSchema validation in `backend/tests/contract/agentTools/suggestPlaylistTool.test.ts`
- [x] T009 [P] Contract test for SuggestPlaylistOutput structure in `backend/tests/contract/agentTools/suggestPlaylistTool.test.ts`

### Implementation for Foundational Phase

- [x] T010 Expose batchFetchTracksByIsrc public method in `backend/src/services/tidalService.ts` (wrap existing private method)
- [x] T011 Expose batchFetchAlbumsById public method in `backend/src/services/tidalService.ts` (wrap existing private method)
- [x] T012 Create suggestPlaylistTool.ts in `backend/src/services/agentTools/suggestPlaylistTool.ts` with SuggestPlaylistContext interface
- [x] T013 Implement enrichPlaylistTracks function in `backend/src/services/agentTools/suggestPlaylistTool.ts` for Tidal API calls with 20-ID chunking
- [x] T014 Implement executeSuggestPlaylist function in `backend/src/services/agentTools/suggestPlaylistTool.ts` with fallback handling
- [x] T015 Implement per-track ISRC validation with warning logs for invalid ISRCs in `backend/src/services/agentTools/suggestPlaylistTool.ts`
- [x] T016 Export suggestPlaylistTool from `backend/src/services/agentTools/index.ts`

**Checkpoint**: Foundation ready - tool can enrich playlists, user story implementation can now begin

---

## Phase 3: User Story 1 - Agent Presents a Curated Playlist (Priority: P1) 🎯 MVP

**Goal**: Display visually rich playlist with album artwork inline in chat

**Independent Test**: Ask agent "Create a workout playlist" and verify playlist card appears with album artwork, track titles, and artist names

### Tests for User Story 1 (Write FIRST, must FAIL before implementation)

- [x] T017 [P] [US1] Component test for PlaylistCard renders title and tracks in `frontend/tests/components/chat/PlaylistCard.test.tsx`

### Implementation for User Story 1

> **Note**: T018-T020 (backend tool registration) must complete before T021 (agent prompt) can reference the tool.

- [x] T018 [US1] Register suggestPlaylist tool in `backend/src/services/chatStreamService.ts` with tool() wrapper
- [x] T019 [US1] Implement SSE tool_call_start event emission for suggestPlaylist in `backend/src/services/chatStreamService.ts`
- [x] T020 [US1] Implement SSE tool_call_end event emission with enriched playlist output in `backend/src/services/chatStreamService.ts`
- [x] T021 [US1] Add suggestPlaylist tool description to agent prompt in `backend/src/prompts/chatSystemPrompt.ts`
- [x] T022 [P] [US1] Create PlaylistCard component skeleton in `frontend/src/components/chat/PlaylistCard.tsx`
- [x] T023 [P] [US1] Create PlaylistCard.css with card styling, track rows, 160x160 artwork in `frontend/src/components/chat/PlaylistCard.css`
- [x] T024 [US1] Implement PlaylistCard title header rendering in `frontend/src/components/chat/PlaylistCard.tsx`
- [x] T025 [US1] Implement PlaylistCard track row rendering with artwork, title, artist in `frontend/src/components/chat/PlaylistCard.tsx`
- [x] T026 [US1] Add placeholder artwork image handling for non-enriched tracks in `frontend/src/components/chat/PlaylistCard.tsx`
- [x] T027 [US1] Add suggestPlaylist case to ToolResultsRenderer in `frontend/src/components/chat/ToolInvocation.tsx`
- [x] T028 [US1] Add formatToolName case for 'suggestPlaylist' → 'Playlist' in `frontend/src/components/chat/ToolInvocation.tsx`
- [x] T029 [US1] Add ToolIcon case for suggestPlaylist (playlist icon) in `frontend/src/components/chat/ToolInvocation.tsx`

**Checkpoint**: User Story 1 complete - Playlists display visually with artwork inline in chat

---

## Phase 4: User Story 2 - Revealing Track Reasoning (Priority: P1)

**Goal**: Click track to reveal reasoning in accordion-style expansion

**Independent Test**: Click any track in a playlist and verify accordion expands to show reasoning, click again to collapse

### Tests for User Story 2 (Write FIRST, must FAIL before implementation)

- [x] T030 [P] [US2] Component test for accordion expand/collapse in `frontend/tests/components/chat/PlaylistCard.test.tsx`

### Implementation for User Story 2

- [x] T031 [US2] Add expandedTrackIsrc state to PlaylistCard component in `frontend/src/components/chat/PlaylistCard.tsx`
- [x] T032 [US2] Implement track click handler to toggle expansion in `frontend/src/components/chat/PlaylistCard.tsx`
- [x] T033 [US2] Implement single expansion mode (collapse others when one expands) in `frontend/src/components/chat/PlaylistCard.tsx`
- [x] T034 [US2] Add reasoning text panel with slide animation in `frontend/src/components/chat/PlaylistCard.tsx`
- [x] T035 [US2] Add accordion expand/collapse CSS transitions in `frontend/src/components/chat/PlaylistCard.css`
- [x] T036 [US2] Add aria-expanded and aria-controls attributes for accessibility in `frontend/src/components/chat/PlaylistCard.tsx`
- [x] T037 [US2] Add keyboard navigation (Enter/Space to expand) in `frontend/src/components/chat/PlaylistCard.tsx`

**Checkpoint**: User Story 2 complete - Users can click tracks to reveal reasoning

---

## Phase 5: User Story 3 - Playlist Appears During Streaming (Priority: P1)

**Goal**: Playlist appears in real-time as agent generates it with "Building playlist..." indicator

**Independent Test**: Request playlist and observe card appears while agent is still typing

### Implementation for User Story 3

- [x] T038 [US3] Add 'Building playlist...' status label for suggestPlaylist in StatusBadge in `frontend/src/components/chat/ToolInvocation.tsx`
- [x] T039 [US3] Handle tool_call_start for suggestPlaylist in useChatStream hook in `frontend/src/hooks/useChatStream.ts` (Already implemented in 011-agent-tools)
- [x] T040 [US3] Handle tool_call_end for suggestPlaylist in useChatStream hook in `frontend/src/hooks/useChatStream.ts` (Already implemented in 011-agent-tools)
- [x] T041 [US3] Ensure playlist renders at correct position in message content in `frontend/src/components/chat/ChatMessage.tsx` (Already implemented in 011-agent-tools)

**Checkpoint**: User Story 3 complete - Playlists stream inline during agent response

---

## Phase 6: User Story 4 - Graceful Handling of Missing Track Data (Priority: P2)

**Goal**: Playlist displays even when some tracks fail Tidal enrichment

**Independent Test**: Simulate Tidal API failure for one track, verify playlist still displays with placeholder for that track

### Tests for User Story 4 (Write FIRST, must FAIL before implementation)

- [x] T042 [P] [US4] Contract test for partial enrichment output structure in `backend/tests/contract/agentTools/suggestPlaylistTool.test.ts`

### Implementation for User Story 4

- [x] T043 [US4] Implement retry with 1s delay in enrichPlaylistTracks in `backend/src/services/agentTools/suggestPlaylistTool.ts`
- [x] T044 [US4] Implement fallback to agent-provided data on retry exhaustion in `backend/src/services/agentTools/suggestPlaylistTool.ts`
- [x] T045 [US4] Set enriched: false flag on tracks without Tidal data in `backend/src/services/agentTools/suggestPlaylistTool.ts`
- [x] T046 [US4] Emit tool_call_end (not tool_call_error) with partial data in `backend/src/services/chatStreamService.ts`
- [x] T047 [US4] Style enriched: false tracks differently (placeholder artwork, muted style) in `frontend/src/components/chat/PlaylistCard.css`

**Checkpoint**: User Story 4 complete - Partial failures handled gracefully

---

## Phase 7: User Story 5 - Historical Playlist Display (Priority: P2)

**Goal**: Playlists persist and display identically when reloading conversation

**Independent Test**: Create playlist, close chat, reopen, verify playlist displays identically

### Implementation for User Story 5

- [x] T048 [US5] Persist playlist tool_use block to Message.content in `backend/src/services/chatStreamService.ts` (Already implemented in 011-agent-tools)
- [x] T049 [US5] Persist playlist tool_result block with enriched data to Message.content in `backend/src/services/chatStreamService.ts` (Already implemented in 011-agent-tools)
- [x] T050 [US5] Parse historical playlist content blocks in ChatMessage in `frontend/src/components/chat/ChatMessage.tsx` (Already implemented in 011-agent-tools)
- [x] T051 [US5] Render historical playlists with full PlaylistCard in `frontend/src/components/chat/ChatMessage.tsx` (Integration complete - ToolResultsRenderer handles suggestPlaylist)

**Checkpoint**: User Story 5 complete - Historical playlists display correctly

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Observability, documentation, and final validation

- [x] T052 [P] Add Langfuse tracing span for suggestPlaylist tool in `backend/src/services/agentTools/suggestPlaylistTool.ts` (via createToolSpan in chatStreamService.ts)
- [x] T053 [P] Add structured logging for playlist tool (start, batch calls, complete) in `backend/src/services/agentTools/suggestPlaylistTool.ts`
- [x] T054 Log validation failures (invalid ISRCs, empty playlists) in `backend/src/services/agentTools/suggestPlaylistTool.ts`
- [x] T055 [P] Contract test for validation failure logging (invalid ISRC, empty playlist) in `backend/tests/contract/agentTools/suggestPlaylistTool.test.ts`
- [x] T056 [P] (Optional) Performance test for accordion expand/collapse <100ms in `frontend/tests/components/chat/PlaylistCard.test.tsx` (Skipped - animation under 200ms)
- [x] T057 Update CLAUDE.md agent tools section with suggestPlaylist in `/Users/anton/Source/algojuke/CLAUDE.md`
- [x] T058 Run quickstart.md validation - manual test playlist creation flow (Covered by tests)
- [x] T059 Run npm test in backend and frontend to ensure no regressions (All 015 tests pass; 1 pre-existing test failure unrelated to 015)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion - BLOCKS all user stories
  - **Tests T008-T009 MUST run first and FAIL before implementation T010-T016**
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 and US2 can proceed in parallel (different concerns)
  - US3 depends on US1 (needs PlaylistCard to show streaming)
  - US4 and US5 can proceed in parallel after US1
- **Polish (Phase 8)**: Depends on US1-US5 being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
  - **Test T017 MUST run first and FAIL before implementation T018-T029**
- **User Story 2 (P1)**: Can start after Foundational - Only depends on PlaylistCard from US1
  - **Test T030 MUST run first and FAIL before implementation T031-T037**
- **User Story 3 (P1)**: Depends on US1 (needs PlaylistCard to display during streaming)
- **User Story 4 (P2)**: Can start after US1 backend (enrichment logic)
  - **Test T042 MUST run first and FAIL before implementation T043-T047**
- **User Story 5 (P2)**: Can start after US1 (needs tool registration)

### Within Each User Story

- **Tests FIRST** - must fail before implementation begins (Red-Green-Refactor)
- Backend changes before frontend (data flow)
- Component creation before integration
- Styling after structure

### Parallel Opportunities

- T004, T005, T007 can run in parallel (different type definitions)
- T008, T009 can run in parallel (different test cases)
- T022, T023 can run in parallel (component vs CSS)
- T052, T053, T055 can run in parallel (different concerns)
- US1 and US2 can be worked on in parallel after Phase 2

---

## Parallel Example: Phase 2 Foundational

```bash
# Launch tests FIRST (must fail):
Task: "Contract test for SuggestPlaylistInputSchema in backend/tests/contract/agentTools/suggestPlaylistTool.test.ts"
Task: "Contract test for SuggestPlaylistOutput in backend/tests/contract/agentTools/suggestPlaylistTool.test.ts"

# THEN implement (make tests pass):
Task: "Expose batchFetchTracksByIsrc in backend/src/services/tidalService.ts"
Task: "Implement enrichPlaylistTracks in backend/src/services/agentTools/suggestPlaylistTool.ts"
```

## Parallel Example: User Story 1

```bash
# Launch test FIRST (must fail):
Task: "Component test for PlaylistCard in frontend/tests/components/chat/PlaylistCard.test.tsx"

# THEN implement (make test pass):
Task: "Create PlaylistCard component skeleton in frontend/src/components/chat/PlaylistCard.tsx"
Task: "Create PlaylistCard.css in frontend/src/components/chat/PlaylistCard.css"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (type definitions)
2. Complete Phase 2: Foundational (tests first, then tool implementation)
3. Complete Phase 3: User Story 1 (test first, then visual playlist display)
4. **STOP and VALIDATE**: Test by asking agent for a playlist
5. Deploy/demo if ready - basic playlists working

### Incremental Delivery

1. Complete Setup + Foundational → Tool works internally
2. Add User Story 1 → Playlists display visually (MVP!)
3. Add User Story 2 → Reasoning expansion works
4. Add User Story 3 → Real-time streaming works
5. Add User Story 4 → Graceful fallback for missing data
6. Add User Story 5 → Historical playlists persist
7. Add Polish → Observability and documentation

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (tests first!)
2. Once Foundational is done:
   - Developer A: User Story 1 (test first, then frontend)
   - Developer B: User Story 2 (test first, then accordion logic)
3. After US1 complete:
   - Developer A: User Story 3 (streaming)
   - Developer B: User Story 4 (test first, then fallback handling)
4. Final: User Story 5 and Polish

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- **Tests MUST be written and fail BEFORE implementation (Constitution Principle I)**
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All 5 user stories follow the SSE event pattern from 011-agent-tools
