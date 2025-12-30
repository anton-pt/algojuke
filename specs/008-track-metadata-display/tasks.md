# Tasks: Track Metadata Display

**Input**: Design documents from `/specs/008-track-metadata-display/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Constitution requires test-first development. Tests are included per plan.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/src/`, `backend/tests/`
- **Frontend**: `frontend/src/`, `frontend/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: GraphQL schema extensions and Qdrant client enhancements

- [x] T001 Create GraphQL schema file for track metadata types at `backend/src/schema/trackMetadata.graphql`
- [x] T002 [P] Create TypeScript types for extended track metadata at `backend/src/types/trackMetadata.ts`
- [x] T003 [P] Add DataLoader dependency to backend package.json for batched Qdrant queries
- [x] T004 Register trackMetadata.graphql in Apollo Server schema at `backend/src/server.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend services and resolvers that ALL user stories depend on

**⚠️ CRITICAL**: No frontend work can begin until this phase is complete

### Tests for Foundational (Write FIRST - must fail before implementation)

- [x] T005 [P] Write contract test for AudioFeatures and ExtendedTrackMetadata types at `backend/tests/contract/trackMetadata.test.ts`
- [x] T006 [P] Write integration test for `getExtendedTrackMetadata` query at `backend/tests/integration/trackMetadata.test.ts`
- [x] T007 [P] Write integration test for `isIndexed` field resolver at `backend/tests/integration/trackMetadata.test.ts`

### Implementation for Foundational

- [x] T008 Extend BackendQdrantClient with `getTrackPayload(isrc)` method at `backend/src/clients/qdrantClient.ts`
- [x] T009 Create TrackMetadataService with `getExtendedMetadata(isrc)` method at `backend/src/services/trackMetadataService.ts`
- [x] T010 Create IsrcDataLoader for batching indexed status checks at `backend/src/loaders/isrcDataLoader.ts` (satisfies FR-017 batch endpoint via GraphQL field resolver pattern)
- [x] T011 Implement `isIndexed` field resolver for LibraryTrack type at `backend/src/resolvers/trackMetadata.ts`
- [x] T012 Implement `isIndexed` field resolver for TrackInfo type at `backend/src/resolvers/trackMetadata.ts`
- [x] T013 Implement `getExtendedTrackMetadata` query resolver at `backend/src/resolvers/trackMetadata.ts`
- [x] T014 Register trackMetadata resolvers in Apollo Server at `backend/src/server.ts`

**Checkpoint**: Backend API ready - frontend implementation can now begin

---

## Phase 3: User Story 1 - View Indexed Track Details (Priority: P1) 🎯 MVP

**Goal**: Display lyrics and interpretation in accordion panel when user clicks indexed track

**Independent Test**: Add indexed track to library → Navigate to Tracks view → Click track row → Verify accordion expands with lyrics and interpretation

### Tests for User Story 1

- [ ] T015 [P] [US1] Write component test for TrackAccordion expand/collapse behavior at `frontend/tests/components/TrackAccordion.test.tsx`
- [ ] T016 [P] [US1] Write component test for TrackMetadataPanel loading/content states at `frontend/tests/components/TrackMetadataPanel.test.tsx`

### Implementation for User Story 1

- [x] T017 [P] [US1] Create GraphQL query `GET_EXTENDED_TRACK_METADATA` at `frontend/src/graphql/trackMetadata.ts`
- [x] T018 [P] [US1] Create `useTrackMetadata` hook for accordion state and data fetching at `frontend/src/hooks/useTrackMetadata.ts`
- [x] T019 [US1] Create TrackMetadataPanel component (lyrics + interpretation sections) at `frontend/src/components/library/TrackMetadataPanel.tsx`
- [x] T020 [US1] Create TrackAccordion component with expand/collapse logic at `frontend/src/components/library/TrackAccordion.tsx`
- [x] T021 [US1] Integrate TrackAccordion into TracksView (library tracks list) at `frontend/src/components/library/TracksView.tsx`
- [x] T022 [US1] Integrate TrackAccordion into AlbumDetailView (album track listing) at `frontend/src/components/library/AlbumDetailView.tsx`
- [x] T023 [US1] Add skeleton loader for accordion content loading state at `frontend/src/components/library/TrackMetadataPanel.tsx`
- [x] T024 [US1] Implement single-expansion behavior (collapse other accordions on expand) at `frontend/src/hooks/useTrackMetadata.ts`

**Checkpoint**: User Story 1 complete - Users can view lyrics and interpretation for indexed tracks

---

## Phase 4: User Story 2 - Graceful Missing Data Handling (Priority: P1)

**Goal**: Show appropriate messages when lyrics or interpretation are unavailable

**Independent Test**: Add instrumental track (no lyrics) to library → Ensure indexed → Expand accordion → Verify "No lyrics available" message

### Tests for User Story 2

- [ ] T025 [P] [US2] Write component tests for missing data states (no lyrics, no interpretation, non-indexed) at `frontend/tests/components/TrackMetadataPanel.test.tsx`

### Implementation for User Story 2

- [x] T026 [US2] Add "No lyrics available" message to TrackMetadataPanel for instrumentals at `frontend/src/components/library/TrackMetadataPanel.tsx`
- [x] T027 [US2] Add "No interpretation available" message to TrackMetadataPanel at `frontend/src/components/library/TrackMetadataPanel.tsx`
- [x] T028 [US2] Add "Extended metadata not yet available" for non-indexed tracks at `frontend/src/components/library/TrackMetadataPanel.tsx`
- [x] T029 [US2] Add error state with retry button for failed metadata fetches at `frontend/src/components/library/TrackMetadataPanel.tsx`

**Checkpoint**: User Stories 1 AND 2 complete - Graceful handling for all metadata states

---

## Phase 5: User Story 3 - Audio Features Display (Priority: P2)

**Goal**: Show formatted audio features (tempo, energy, danceability, etc.) in accordion

**Independent Test**: Expand accordion for indexed track with audio features → Verify audio features displayed with human-readable labels

### Tests for User Story 3

- [ ] T030 [P] [US3] Write component test for AudioFeaturesDisplay with all features at `frontend/tests/components/AudioFeaturesDisplay.test.tsx`
- [ ] T031 [P] [US3] Write component test for audio feature formatting (key names, percentages, BPM) at `frontend/tests/components/AudioFeaturesDisplay.test.tsx`

### Implementation for User Story 3

- [x] T032 [US3] Create audio feature formatting utilities (key names, percentages, BPM) at `frontend/src/utils/audioFeatureFormatters.ts`
- [x] T033 [US3] Create AudioFeaturesDisplay component with formatted values at `frontend/src/components/library/AudioFeaturesDisplay.tsx`
- [x] T034 [US3] Integrate AudioFeaturesDisplay into TrackMetadataPanel at `frontend/src/components/library/TrackMetadataPanel.tsx`
- [x] T035 [US3] Handle missing audio features (hide section or show "unavailable") at `frontend/src/components/library/AudioFeaturesDisplay.tsx`

**Checkpoint**: User Stories 1, 2, AND 3 complete - Full accordion content with audio features

---

## Phase 6: User Story 4 - Visual Indicator for Indexed Tracks (Priority: P3)

**Goal**: Show badge/icon on track rows to indicate indexed status

**Independent Test**: View library with mix of indexed/non-indexed tracks → Verify indexed tracks show visual indicator

### Tests for User Story 4

- [ ] T036 [P] [US4] Write component test for IndexedBadge display at `frontend/tests/components/IndexedBadge.test.tsx`
- [ ] T037 [P] [US4] Write integration test for indexed status in TracksView at `frontend/tests/components/TracksView.test.tsx`

### Implementation for User Story 4

- [x] T038 [P] [US4] Update library GraphQL queries to include `isIndexed` field at `frontend/src/graphql/library.ts`
- [x] T039 [US4] Create IndexedBadge component (icon/badge for indexed status) at `frontend/src/components/library/IndexedBadge.tsx`
- [x] T040 [US4] Integrate IndexedBadge into LibraryTrackCard at `frontend/src/components/library/LibraryTrackCard.tsx`
- [x] T041 [US4] Integrate IndexedBadge into album track listing rows at `frontend/src/components/library/AlbumDetailView.tsx`
- [x] T042 [US4] Handle IndexedBadge visibility when Qdrant unavailable (fail-open: hide badge) at `frontend/src/components/library/IndexedBadge.tsx`

**Checkpoint**: All user stories complete - Full feature functionality

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final quality improvements

- [x] T043 [P] Add structured logging for Qdrant query errors in TrackMetadataService at `backend/src/services/trackMetadataService.ts`
- [x] T044 [P] Add request cancellation for rapid track clicks in useTrackMetadata hook at `frontend/src/hooks/useTrackMetadata.ts`
- [x] T045 [P] Add scrollable container for long lyrics in TrackMetadataPanel at `frontend/src/components/library/TrackMetadataPanel.tsx`
- [x] T046 Run quickstart.md validation scenarios
- [x] T047 Update CLAUDE.md with new components and patterns (if needed)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all frontend user stories
- **User Stories (Phases 3-6)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 but US2 builds on US1 components
  - US3 (P2) can run in parallel with US1/US2 if different developers
  - US4 (P3) can run in parallel with US1/US2/US3
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

| Story | Priority | Depends On | Can Parallel With |
|-------|----------|------------|-------------------|
| US1 - View Details | P1 | Foundational | - |
| US2 - Missing Data | P1 | US1 (uses same components) | - |
| US3 - Audio Features | P2 | Foundational | US1, US2 |
| US4 - Visual Indicator | P3 | Foundational | US1, US2, US3 |

### Within Each User Story

1. Tests MUST be written and FAIL before implementation
2. GraphQL queries/hooks before components
3. Child components before parent integration
4. Core implementation before edge case handling

### Parallel Opportunities

**Phase 1 (Setup)**:
- T002 and T003 can run in parallel

**Phase 2 (Foundational)**:
- T005, T006, T007 tests can run in parallel (different test files)

**Per User Story**:
- All tests marked [P] can run in parallel
- T017 and T018 can run in parallel (different files)
- T038 can run in parallel with other US4 tasks (different file)

---

## Parallel Example: User Story 1

```bash
# Launch tests in parallel:
Task: "Write component test for TrackAccordion at frontend/tests/components/TrackAccordion.test.tsx"
Task: "Write component test for TrackMetadataPanel at frontend/tests/components/TrackMetadataPanel.test.tsx"

# Launch GraphQL and hook in parallel:
Task: "Create GET_EXTENDED_TRACK_METADATA query at frontend/src/graphql/trackMetadata.ts"
Task: "Create useTrackMetadata hook at frontend/src/hooks/useTrackMetadata.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all frontend)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test accordion with lyrics + interpretation
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Backend API ready
2. Add US1 → Accordion with lyrics/interpretation → MVP!
3. Add US2 → Graceful missing data handling
4. Add US3 → Audio features display
5. Add US4 → Visual indexed indicators
6. Polish → Production ready

### Single Developer Recommended Order

```text
T001 → T002 → T003 → T004 (Setup)
    ↓
T005 → T006 → T007 (Foundational tests - write FIRST, ensure they fail)
    ↓
T008 → T009 → T010 → T011 → T012 → T013 → T014 (Foundational implementation)
    ↓
T015 → T016 (US1 tests - ensure they fail)
    ↓
T017 → T018 → T019 → T020 → T021 → T022 → T023 → T024 (US1 implementation)
    ↓
T025 (US2 tests) → T026 → T027 → T028 → T029 (US2 implementation)
    ↓
T030 → T031 (US3 tests) → T032 → T033 → T034 → T035 (US3 implementation)
    ↓
T036 → T037 (US4 tests) → T038 → T039 → T040 → T041 → T042 (US4 implementation)
    ↓
T043 → T044 → T045 → T046 → T047 (Polish)
```

---

## Summary

| Phase | Task Count | Parallelizable |
|-------|------------|----------------|
| Setup | 4 | 2 |
| Foundational | 10 | 3 |
| US1 - View Details | 10 | 4 |
| US2 - Missing Data | 5 | 1 |
| US3 - Audio Features | 6 | 2 |
| US4 - Visual Indicator | 7 | 3 |
| Polish | 5 | 3 |
| **Total** | **47** | **18** |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
