# Tasks: Semantic Discovery Search

**Input**: Design documents from `/specs/009-semantic-discovery-search/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included per Constitution principle I (Test-First Development)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/src/`, `backend/tests/`
- **Frontend**: `frontend/src/`, `frontend/tests/`
- **Services**: `services/` (observability, search-index reused)

---

## Phase 1: Setup

**Purpose**: Project initialization and shared infrastructure

- [ ] T001 Copy GraphQL schema from contracts/discovery.graphql to backend/src/schema/discovery.graphql
- [ ] T002 [P] Create Zod validation schemas in backend/src/types/discovery.ts per data-model.md
- [ ] T003 [P] Create sparse vector utility in backend/src/utils/sparseVector.ts per research.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend clients and services that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create TEI embedding client in backend/src/clients/teiClient.ts (mirror from services/worker/src/clients/tei.ts)
- [ ] T005 [P] Create Anthropic Haiku client for query expansion in backend/src/clients/anthropicClient.ts
- [ ] T006 [P] Create query expansion prompt template in backend/src/prompts/queryExpansion.ts
- [ ] T007 Extend Qdrant client with hybrid search method in backend/src/clients/qdrantClient.ts
- [ ] T008 Create DiscoveryService orchestrating search pipeline in backend/src/services/discoveryService.ts
- [ ] T009 Create discovery resolver in backend/src/resolvers/discoveryResolver.ts
- [ ] T010 Register discovery resolver and schema in backend/src/server.ts

**Checkpoint**: Backend search pipeline ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Natural Language Music Discovery (Priority: P1) 🎯 MVP

**Goal**: Users can enter natural language queries and receive semantically relevant track results

**Independent Test**: Enter "uplifting songs about overcoming adversity" and verify relevant indexed tracks are returned ranked by hybrid score

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T011 [P] [US1] Contract test for discoverTracks query schema in backend/tests/contract/discoverySchema.test.ts
- [ ] T012 [P] [US1] Integration test for end-to-end search pipeline in backend/tests/integration/discoverySearch.test.ts

### Implementation for User Story 1

- [ ] T013 [P] [US1] Create useDiscoverySearch hook in frontend/src/hooks/useDiscoverySearch.ts
- [ ] T014 [P] [US1] Create discovery GraphQL query in frontend/src/graphql/discovery.ts
- [ ] T015 [P] [US1] Create DiscoverySearchBar component in frontend/src/components/discover/DiscoverySearchBar.tsx
- [ ] T016 [P] [US1] Create DiscoveryTrackItem component in frontend/src/components/discover/DiscoveryTrackItem.tsx
- [ ] T017 [US1] Create DiscoveryResults component in frontend/src/components/discover/DiscoveryResults.tsx
- [ ] T018 [US1] Create DiscoverPage with search and results in frontend/src/pages/DiscoverPage.tsx
- [ ] T019 [US1] Add loading skeleton state to DiscoverPage in frontend/src/pages/DiscoverPage.tsx
- [ ] T020 [US1] Add Langfuse observability tracing to discoveryService in backend/src/services/discoveryService.ts

**Checkpoint**: User Story 1 complete - users can perform semantic discovery searches

---

## Phase 4: User Story 2 - Expandable Track Details (Priority: P1)

**Goal**: Users can expand discovery results to see lyrics, interpretation, and audio features

**Independent Test**: Click a result track and verify accordion expands showing extended metadata

### Tests for User Story 2

- [ ] T021 [P] [US2] Component test for accordion expand/collapse in frontend/tests/components/DiscoveryTrackItem.test.tsx

### Implementation for User Story 2

- [ ] T022 [US2] Integrate TrackAccordion component from library into DiscoveryTrackItem in frontend/src/components/discover/DiscoveryTrackItem.tsx
- [ ] T023 [US2] Add useTrackMetadata hook integration for fetching extended metadata in frontend/src/components/discover/DiscoveryTrackItem.tsx
- [ ] T024 [US2] Add single-expansion behavior (collapse others when one expands) in frontend/src/pages/DiscoverPage.tsx
- [ ] T025 [US2] Handle instrumental tracks (no lyrics) messaging in frontend/src/components/discover/DiscoveryTrackItem.tsx

**Checkpoint**: User Story 2 complete - users can view extended track details in results

---

## Phase 5: User Story 3 - Paginated Discovery Results (Priority: P2)

**Goal**: Users can browse through multiple pages of results up to 100 total

**Independent Test**: Search for common theme, verify "Load More" loads additional batches up to 100 max

### Tests for User Story 3

- [ ] T026 [P] [US3] Integration test for pagination in backend/tests/integration/discoveryPagination.test.ts

### Implementation for User Story 3

- [ ] T027 [US3] Add pagination state (page, hasMore) to useDiscoverySearch hook in frontend/src/hooks/useDiscoverySearch.ts
- [ ] T028 [US3] Add "Load More" button to DiscoveryResults in frontend/src/components/discover/DiscoveryResults.tsx
- [ ] T029 [US3] Add max results (100) enforcement with user messaging in frontend/src/components/discover/DiscoveryResults.tsx
- [ ] T030 [US3] Add pagination loading state distinct from initial search loading in frontend/src/pages/DiscoverPage.tsx

**Checkpoint**: User Story 3 complete - users can paginate through results

---

## Phase 6: User Story 4 - Navigation to Discover Area (Priority: P2)

**Goal**: Users can access Discover from main navigation alongside Search and Library

**Independent Test**: Load app and verify "Discover" nav item appears and navigates correctly

### Tests for User Story 4

- [ ] T031 [P] [US4] Component test for navigation links in frontend/tests/components/AppHeader.test.tsx

### Implementation for User Story 4

- [ ] T032 [US4] Add "Discover" NavLink to AppHeader in frontend/src/components/AppHeader.tsx
- [ ] T033 [US4] Add /discover route to App.tsx in frontend/src/App.tsx
- [ ] T034 [US4] Add CSS styling for Discover nav link in frontend/src/components/AppHeader.css

**Checkpoint**: User Story 4 complete - Discover is accessible from navigation

---

## Phase 7: User Story 5 - No Results Handling (Priority: P2)

**Goal**: Users see clear feedback when searches return no matches

**Independent Test**: Search for nonsensical theme, verify helpful "no results" message appears

### Tests for User Story 5

- [ ] T035 [P] [US5] Component test for no results state in frontend/tests/components/DiscoveryResults.test.tsx

### Implementation for User Story 5

- [ ] T036 [US5] Create NoResultsMessage component in frontend/src/components/discover/NoResultsMessage.tsx
- [ ] T037 [US5] Add empty index detection and messaging in frontend/src/components/discover/DiscoveryResults.tsx
- [ ] T038 [US5] Add suggestions for broadening search terms in NoResultsMessage

**Checkpoint**: User Story 5 complete - all user stories functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Error handling, timeout, and final validation

- [ ] T039 [P] Add 30-second timeout handling to discoveryService in backend/src/services/discoveryService.ts
- [ ] T040 [P] Create error display component for service failures in frontend/src/components/discover/DiscoveryError.tsx
- [ ] T041 Add retry functionality for retryable errors in frontend/src/pages/DiscoverPage.tsx
- [ ] T042 Add error handling for LLM/embedding/index unavailability in discoveryService
- [ ] T043 Run quickstart.md validation - verify all test scenarios pass
- [ ] T044 Update specs/009-semantic-discovery-search/spec.md status from Draft to Complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Stories (Phases 3-7)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 - implement in sequence (US2 depends on US1 UI)
  - US3, US4, US5 are all P2 - can proceed after US1/US2, or in parallel
- **Polish (Phase 8)**: Can start after US1, complete after all stories done

### User Story Dependencies

| Story | Priority | Can Start After | Dependencies |
|-------|----------|-----------------|--------------|
| US1 - Search | P1 | Foundational | None |
| US2 - Accordion | P1 | US1 | Needs US1 result display |
| US3 - Pagination | P2 | US1 | Needs US1 search hook |
| US4 - Navigation | P2 | Foundational | Independent (UI only) |
| US5 - No Results | P2 | US1 | Needs US1 result display |

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Backend before frontend for each story
- Components before pages
- Core implementation before polish

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- Foundational T005, T006 can run in parallel (different files)
- US1 tests T011, T012 can run in parallel
- US1 frontend components T013-T016 can run in parallel
- US4 is fully independent and can run in parallel with US3 or US5

---

## Parallel Example: User Story 1

```bash
# After Foundational phase completes, launch US1 tests in parallel:
Task: "Contract test for discoverTracks query schema"
Task: "Integration test for end-to-end search pipeline"

# After tests fail (TDD), launch frontend components in parallel:
Task: "Create useDiscoverySearch hook"
Task: "Create discovery GraphQL query"
Task: "Create DiscoverySearchBar component"
Task: "Create DiscoveryTrackItem component"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 - Core Search
4. Complete Phase 4: User Story 2 - Accordion Details
5. **STOP and VALIDATE**: Test search + accordion flow end-to-end
6. Deploy/demo if ready (functional MVP!)

### Full Feature Delivery

1. Complete MVP (US1 + US2)
2. Add Phase 5: US3 - Pagination
3. Add Phase 6: US4 - Navigation (can parallel with US3)
4. Add Phase 7: US5 - No Results
5. Complete Phase 8: Polish
6. Final validation against quickstart.md

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Reuse existing TrackAccordion from 008-track-metadata-display
- Reuse existing getExtendedTrackMetadata query for accordion data
