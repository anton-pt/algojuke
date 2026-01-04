# Tasks: Tidal Playlist Export

**Input**: Design documents from `/specs/017-tidal-playlist-export/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Test-First Development**: Per constitution, tests MUST be written BEFORE implementation and MUST fail before code is written.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, schemas, and type definitions

- [x] T001 [P] Create playlist export Zod schemas in `backend/src/schemas/playlist.ts`
- [x] T002 [P] Create playlist export TypeScript types in `backend/src/types/playlist.ts`
- [x] T003 [P] Create playlist routes skeleton in `backend/src/routes/playlists.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend infrastructure that MUST be complete before frontend can integrate

**CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational (TDD - must FAIL before implementation)

- [x] T004 [P] Add contract tests for playlist export API in `backend/tests/contract/playlistExport.test.ts`
- [x] T005 [P] Add integration tests for Tidal playlist API in `backend/tests/integration/tidalPlaylist.test.ts`

### Implementation for Foundational

- [x] T006 Extend TidalService with `createPlaylist` method in `backend/src/services/tidalService.ts`
- [x] T007 Extend TidalService with `addTracksToPlaylist` method in `backend/src/services/tidalService.ts` (depends on T006)
- [x] T008 Implement `exportPlaylistToTidal` GraphQL mutation in `backend/src/resolvers/playlistResolver.ts` (depends on T006, T007)
- [x] T009 Implement automatic token refresh in export endpoint using existing `refreshTidalTokens()` from `backend/src/services/tidalAuthService.ts`
- [x] T010 Register playlist schema and resolver in `backend/src/server.ts`

**Checkpoint**: Backend API ready, tests passing - frontend implementation can now begin

---

## Phase 3: User Story 1 - Save Playlist to Tidal Account (Priority: P1)

**Goal**: Enable users to save AI-generated playlists to their Tidal account with a single click

**Independent Test**: View playlist suggestion in chat, click "Save to Tidal", confirm in modal, verify playlist appears in Tidal with all tracks

### Tests for User Story 1 (TDD - must FAIL before implementation)

- [x] T011 [P] [US1] Add component tests for SavePlaylistModal in `frontend/tests/components/chat/SavePlaylistModal.test.tsx`
- [x] T012 [P] [US1] Add component tests for PlaylistCard save button in `frontend/tests/components/chat/PlaylistCard.test.tsx`

### Implementation for User Story 1

- [x] T013 [P] [US1] Create SavePlaylistModal component in `frontend/src/components/chat/SavePlaylistModal.tsx`
- [x] T014 [P] [US1] Create usePlaylistExport hook in `frontend/src/hooks/usePlaylistExport.ts`
- [x] T015 [US1] Add "Save to Tidal" button to PlaylistCard in `frontend/src/components/chat/PlaylistCard.tsx` (depends on T013, T014)
- [x] T016 [US1] Add button styles to `frontend/src/components/chat/PlaylistCard.css`
- [x] T017 [US1] Disable "Save to Tidal" button when user has no Tidal connection in `frontend/src/components/chat/PlaylistCard.tsx`
- [x] T018 [US1] Add tooltip to disabled button explaining Tidal connection required in `frontend/src/components/chat/PlaylistCard.tsx`
- [x] T019 [US1] Wire up modal open/close state in PlaylistCard (depends on T015)
- [x] T020 [US1] Implement save flow: call export API, handle response in PlaylistCard (depends on T019)

**Checkpoint**: User Story 1 complete - users can save playlists with default name, button disabled when no Tidal connection

---

## Phase 4: User Story 2 - Rename Playlist Before Saving (Priority: P1)

**Goal**: Allow users to customize the playlist name before saving to Tidal

**Independent Test**: Click "Save to Tidal", edit name in modal input, confirm, verify playlist appears in Tidal with custom name

**Dependencies**: Requires SavePlaylistModal from US1 (T013)

### Implementation for User Story 2

- [x] T021 [US2] Add editable name input to SavePlaylistModal with pre-filled title in `frontend/src/components/chat/SavePlaylistModal.tsx` (extends T013)
- [x] T022 [US2] Add client-side validation for empty name in SavePlaylistModal
- [x] T023 [US2] Add character limit (150 chars) with truncation feedback in SavePlaylistModal

**Checkpoint**: User Story 2 complete - users can rename playlists before saving

---

## Phase 5: User Story 3 - Cancel Save Operation (Priority: P2)

**Goal**: Allow users to cancel the save operation and close the modal without saving

**Independent Test**: Open save modal, click cancel, verify modal closes and no playlist was created

**Dependencies**: Requires SavePlaylistModal from US1 (T013)

### Implementation for User Story 3

- [x] T024 [US3] Add cancel button handler to SavePlaylistModal in `frontend/src/components/chat/SavePlaylistModal.tsx`
- [x] T025 [US3] Implement Escape key handling for modal dismiss
- [x] T026 [US3] Reset modal state (name field to original) when reopening in PlaylistCard

**Checkpoint**: User Story 3 complete - users can cancel save operation

---

## Phase 6: User Story 4 - Handle Save Failures Gracefully (Priority: P2)

**Goal**: Display clear error messages when save fails and provide recovery options

**Independent Test**: Simulate Tidal API failure, verify appropriate error message and retry option

**Dependencies**: Requires core save flow from US1 (T020)

### Implementation for User Story 4

- [x] T027 [US4] Add error state handling to usePlaylistExport hook in `frontend/src/hooks/usePlaylistExport.ts`
- [x] T028 [US4] Display error messages in SavePlaylistModal with error codes from API
- [x] T029 [US4] Add retry button for transient errors (rate_limit_exceeded, tidal_unavailable)
- [x] T030 [US4] Add "Reconnect Tidal" prompt for auth errors (no_tidal_connection, token_refresh_failed)
- [x] T031 [US4] Display partial success message showing tracks added/skipped

**Checkpoint**: User Story 4 complete - users see clear feedback on failures

---

## Phase 7: User Story 5 - Visual Feedback During Save (Priority: P3)

**Goal**: Show loading state during save to prevent duplicate saves and confirm system is working

**Independent Test**: Click save, observe loading indicator on button, verify button disabled, modal stays open until completion

**Dependencies**: Requires core save flow from US1 (T020) and error handling from US4 (T027)

### Implementation for User Story 5

- [x] T032 [US5] Add loading state to save button in SavePlaylistModal
- [x] T033 [US5] Disable save button during active save operation
- [x] T034 [US5] Add loading spinner/indicator styles
- [x] T035 [US5] Show success toast/message after successful save with playlist name and track count

**Checkpoint**: User Story 5 complete - full visual feedback during save

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Edge case handling and final validation

- [x] T036 Handle edge case: no tracks available on Tidal (display error, don't create empty playlist)
- [ ] T037 Run quickstart.md validation including:
  - Manual testing checklist
  - Verify SC-001: Export completes in <10s for 20-track playlist
  - Verify SC-003: Loading feedback appears within 500ms of click

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
  - Tests (T004-T005) must be written and FAIL before implementation (T006-T010)
- **User Stories (Phases 3-7)**: All depend on Foundational phase completion
  - US1 tests (T011-T012) must FAIL before US1 implementation
  - US1 and US2 are both P1 priority - US2 can start after T013 (modal created)
  - US3 and US4 are P2 priority - can run after P1 or in parallel with each other
  - US5 is P3 priority - depends on US1 and US4
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Depends on T013 (SavePlaylistModal) from US1
- **User Story 3 (P2)**: Depends on T013 (SavePlaylistModal) from US1
- **User Story 4 (P2)**: Depends on T020 (save flow) from US1
- **User Story 5 (P3)**: Depends on T020 (save flow) from US1 and T027 (error handling) from US4

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models/Schemas before services
- Services before endpoints/hooks
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T001, T002, T003 (Setup) can run in parallel
- T004, T005 (Foundational tests) can run in parallel
- T011, T012 (US1 tests) can run in parallel
- T013, T014 (US1 components) can run in parallel
- US2 and US3 can proceed in parallel after T013 completes

---

## Parallel Example: Phase 1 Setup

```bash
# Launch all setup tasks together:
Task: "Create playlist export Zod schemas in backend/src/schemas/playlist.ts"
Task: "Create playlist export TypeScript types in backend/src/types/playlist.ts"
Task: "Create playlist routes skeleton in backend/src/routes/playlists.ts"
```

## Parallel Example: Phase 2 Tests (TDD)

```bash
# Launch all foundational tests together (must FAIL initially):
Task: "Add contract tests for playlist export API in backend/tests/contract/playlistExport.test.ts"
Task: "Add integration tests for Tidal playlist API in backend/tests/integration/tidalPlaylist.test.ts"
```

## Parallel Example: User Story 1

```bash
# Launch US1 tests first (must FAIL):
Task: "Add component tests for SavePlaylistModal in frontend/tests/components/chat/SavePlaylistModal.test.tsx"
Task: "Add component tests for PlaylistCard save button in frontend/tests/components/chat/PlaylistCard.test.tsx"

# Then launch frontend components in parallel:
Task: "Create SavePlaylistModal component in frontend/src/components/chat/SavePlaylistModal.tsx"
Task: "Create usePlaylistExport hook in frontend/src/hooks/usePlaylistExport.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (tests first, then implementation)
3. Complete Phase 3: User Story 1 (tests first, then implementation)
4. Complete Phase 4: User Story 2 (rename functionality)
5. **STOP and VALIDATE**: Test save flow end-to-end
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational (TDD) -> Backend API ready
2. Add User Story 1 (TDD) -> Test save with default name -> Demo
3. Add User Story 2 -> Test rename functionality -> Demo
4. Add User Stories 3+4 -> Test cancel and error handling -> Demo
5. Add User Story 5 -> Test loading states -> Final release

### Suggested MVP Scope

- **MVP**: User Stories 1 + 2 (save and rename)
- **Post-MVP**: User Stories 3, 4, 5 (cancel, errors, loading states)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests MUST fail before implementation begins (Red-Green-Refactor)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Backend uses existing TidalService rate limiter (2 req/s, max 3 concurrent)
- Max 20 tracks per Tidal API batch call (handled in addTracksToPlaylist)
