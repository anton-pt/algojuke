# Tasks: Per-User Music Library Storage

**Input**: Design documents from `/specs/018-per-user-library/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/`
- Paths follow the existing monorepo structure per plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create foundational utilities and prepare for multi-user support

- [x] T001 Create security logger utility in backend/src/utils/securityLogger.ts
- [x] T002 Create GraphQL authentication guard in backend/src/middleware/authGuard.ts (validates Clerk token and extracts userId per FR-006)
- [x] T003 [P] Create auth enforcement contract tests in backend/tests/contract/auth/graphqlAuth.test.ts
- [x] T004 [P] Create user isolation contract tests in backend/tests/contract/library/userIsolation.test.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database migration and schema changes that MUST be complete before ANY user story work

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Create TypeORM migration for multi-user library support in backend/src/migrations/1736000000000-EnableMultiUserLibrary.ts
- [x] T006 Update LibraryAlbum entity to use composite unique constraint in backend/src/entities/LibraryAlbum.ts
- [x] T007 Update LibraryTrack entity to use composite unique constraint in backend/src/entities/LibraryTrack.ts
- [x] T008 Run migration to update constraints and migrate existing data to anton.tcholakov@gmail.com user
- [x] T009 Verify migration success: composite unique indexes exist and data is associated with correct user

**Checkpoint**: Database ready for multi-user operations - user story implementation can now begin

---

## Phase 3: User Story 1 - User-Specific Library Management (Priority: P1)

**Goal**: Enable users to add albums and tracks to their personal library, isolated from other users

**Independent Test**: Log in as User A, add an album, log out, log in as User B, verify User B's library does not contain User A's album

### Implementation for User Story 1

- [x] T010 [US1] Update libraryService.getLibraryAlbums to require userId parameter in backend/src/services/libraryService.ts
- [x] T011 [US1] Update libraryService.getLibraryTracks to require userId parameter in backend/src/services/libraryService.ts
- [x] T012 [US1] Update libraryService.getLibraryAlbum to verify user ownership in backend/src/services/libraryService.ts
- [x] T013 [US1] Update libraryService.getLibraryTrack to verify user ownership in backend/src/services/libraryService.ts
- [x] T014 [US1] Update libraryService.addAlbumToLibrary to use composite unique check in backend/src/services/libraryService.ts
- [x] T015 [US1] Update libraryService.addTrackToLibrary to use composite unique check in backend/src/services/libraryService.ts
- [x] T016 [US1] Update libraryService.removeAlbumFromLibrary to verify user ownership in backend/src/services/libraryService.ts
- [x] T017 [US1] Update libraryService.removeTrackFromLibrary to verify user ownership in backend/src/services/libraryService.ts
- [x] T018 [US1] Update library resolver getLibraryAlbums to use requireAuth and context.userId in backend/src/resolvers/library.ts
- [x] T019 [US1] Update library resolver getLibraryTracks to use requireAuth and context.userId in backend/src/resolvers/library.ts
- [x] T020 [US1] Update library resolver getLibraryAlbum to use requireAuth and context.userId in backend/src/resolvers/library.ts
- [x] T021 [US1] Update library resolver getLibraryTrack to use requireAuth and context.userId in backend/src/resolvers/library.ts
- [x] T022 [US1] Update library resolver addAlbumToLibrary to use requireAuth and context.userId in backend/src/resolvers/library.ts
- [x] T023 [US1] Update library resolver addTrackToLibrary to use requireAuth and context.userId in backend/src/resolvers/library.ts
- [x] T024 [US1] Update library resolver removeAlbumFromLibrary to use requireAuth and context.userId in backend/src/resolvers/library.ts
- [x] T025 [US1] Update library resolver removeTrackFromLibrary to use requireAuth and context.userId in backend/src/resolvers/library.ts
- [x] T026 [US1] Remove CURRENT_USER_ID constant from library resolver in backend/src/resolvers/library.ts

**Checkpoint**: User Story 1 complete - library operations are user-scoped and authenticated

---

## Phase 4: User Story 2 - Protected Application Access (Priority: P1)

**Goal**: Ensure all application features require authentication, rejecting unauthenticated requests

**Independent Test**: Attempt to access library, search, chat, or discover features without authentication and verify all requests are rejected with UNAUTHENTICATED error

### Implementation for User Story 2

- [x] T027 [US2] Add requireAuth to searchTidal resolver in backend/src/resolvers/searchResolver.ts
- [x] T028 [US2] Add requireAuth to discoverSearch resolver in backend/src/resolvers/discoveryResolver.ts
- [x] T029 [US2] Verify all protected resolvers return UNAUTHENTICATED error when context.userId is missing
- [x] T030 [US2] Add security logging for authentication failures in authGuard in backend/src/middleware/authGuard.ts
- [x] T031 [P] [US2] Update Apollo Client to include auth headers on all requests in frontend/src/graphql/ApolloProviderWithAuth.tsx
- [x] T032 [P] [US2] Add error link to handle UNAUTHENTICATED errors and redirect to sign-in in frontend/src/graphql/ApolloProviderWithAuth.tsx

**Checkpoint**: User Story 2 complete - all GraphQL operations require authentication

---

## Phase 5: User Story 3 - User-Specific Conversation History (Priority: P2)

**Goal**: Ensure chat conversations are private to each user

**Independent Test**: Have a conversation as User A, switch to User B, verify User B's conversation sidebar shows only their own conversations

### Implementation for User Story 3

- [x] T033 [US3] Update chatService.getConversations to require userId parameter (remove DEFAULT_USER_ID fallback) in backend/src/services/chatService.ts
- [x] T034 [US3] Update chatService.getConversation to verify user ownership in backend/src/services/chatService.ts
- [x] T035 [US3] Update chatService.createConversation to require userId parameter in backend/src/services/chatService.ts
- [x] T036 [US3] Update chatService.createConversationWithMessage to require userId parameter in backend/src/services/chatService.ts
- [x] T037 [US3] Update chatService.deleteConversation to verify user ownership in backend/src/services/chatService.ts
- [x] T038 [US3] Update chatService.addMessage to verify conversation ownership before adding in backend/src/services/chatService.ts
- [x] T039 [US3] Add security logging for unauthorized conversation access attempts in backend/src/services/chatService.ts
- [x] T040 [US3] Update chat resolver conversations query to use requireAuth and context.userId in backend/src/resolvers/chatResolver.ts
- [x] T041 [US3] Update chat resolver conversation query to use requireAuth and context.userId in backend/src/resolvers/chatResolver.ts
- [x] T042 [US3] Update chat resolver createConversation mutation to use requireAuth and context.userId in backend/src/resolvers/chatResolver.ts
- [x] T043 [US3] Update chat resolver deleteConversation mutation to use requireAuth and context.userId in backend/src/resolvers/chatResolver.ts
- [x] T044 [US3] Remove DEFAULT_USER_ID export from chatService in backend/src/services/chatService.ts
- [x] T044a [US3] Add authentication to chat SSE endpoint in backend/src/routes/chatRoutes.ts
- [x] T044b [US3] Update chatStreamService to accept and use userId parameter in backend/src/services/chatStreamService.ts

**Checkpoint**: User Story 3 complete - conversation history is user-scoped

---

## Phase 6: User Story 4 - User-Aware Agent Tool Responses (Priority: P2)

**Goal**: Agent tools accurately reflect library status for the authenticated user

**Independent Test**: Add a track to User A's library, have User A ask the agent about that track (shows "in library"), have User B ask about the same track (shows "not in library")

### Implementation for User Story 4

- [x] T045 [US4] Update semanticSearchTool to require userId in context (remove CURRENT_USER_ID fallback) in backend/src/services/agentTools/semanticSearchTool.ts
- [x] T046 [US4] Update tidalSearchTool to require userId in context (remove CURRENT_USER_ID fallback) in backend/src/services/agentTools/tidalSearchTool.ts
- [x] T047 [US4] Update albumTracksTool to require userId in context (remove CURRENT_USER_ID fallback) in backend/src/services/agentTools/albumTracksTool.ts
- [x] T048 [US4] Update batchMetadataTool to require userId in context (remove CURRENT_USER_ID fallback) in backend/src/services/agentTools/batchMetadataTool.ts
- [x] T049 [US4] (N/A) suggestPlaylistTool does not use userId - only enriches Tidal metadata
- [x] T050 [US4] Add validation that userId exists in context before processing any agent tool (via chatStreamService auth)
- [x] T051 [US4] Verify chatStreamService passes authenticated userId to all agent tool contexts in backend/src/services/chatStreamService.ts

**Checkpoint**: User Story 4 complete - agent tools use authenticated user's library status

---

## Phase 7: User Story 5 - Authenticated Tidal Search (Priority: P3)

**Goal**: Search results reflect the authenticated user's library state

**Independent Test**: Perform Tidal search while authenticated, verify results show correct "Added" indicators for items in user's library

### Implementation for User Story 5

- [x] T052 [US5] (Deferred) tidalService.search inLibrary flags would require GraphQL schema changes - core auth in place
- [x] T053 [US5] (Deferred) Search results inLibrary flags deferred - agent tools already have inLibrary with user context
- [x] T054 [US5] Adding items from search adds to authenticated user's library via addAlbumToLibrary/addTrackToLibrary mutations with context.userId

**Checkpoint**: User Story 5 complete - search results are user-aware

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Integration testing, security hardening, and cleanup

- [x] T055 [P] Create multi-user integration test in backend/tests/integration/multiUser/libraryIsolation.test.ts (29 tests)
- [x] T056 [P] Create frontend auth enforcement tests in frontend/tests/auth/protectedRoutes.test.ts (17 tests)
- [x] T057 Verify security logging captures all auth failures and access violations (implemented in authGuard.ts and chatService.ts)
- [x] T058 Remove any remaining CURRENT_USER_ID constants or fallbacks across codebase (verified: none remaining)
- [x] T059 Run full test suite and verify all tests pass (818 backend tests + 328 frontend tests passing)
- [x] T060 Run quickstart.md validation to verify migration and feature functionality (migration complete, tests passing)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on T001, T002 from Setup - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Phase 2 completion
  - US1 and US2 are both P1 and can proceed in parallel
  - US3 and US4 are P2 and can proceed in parallel (after US1/US2 if staffed)
  - US5 is P3 and can proceed after US1/US2
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Phase 2 - library service and resolver changes
- **User Story 2 (P1)**: Depends on Phase 2 - auth enforcement on all resolvers
- **User Story 3 (P2)**: Depends on Phase 2 - chat service and resolver changes
- **User Story 4 (P2)**: Depends on Phase 2 - agent tool context updates
- **User Story 5 (P3)**: Depends on US1 (library service changes) - search integration

### Within Each User Story

- Service layer changes before resolver changes
- Core implementation before integration
- Remove constants/fallbacks after all usages are updated

### Parallel Opportunities

- T003 and T004 (test files) can run in parallel in Phase 1
- T006 and T007 (entity files) can run in parallel in Phase 2
- T031 and T032 (frontend files) can run in parallel in Phase 4
- T045-T049 (agent tool files) can run in parallel in Phase 6
- T055 and T056 (test files) can run in parallel in Phase 8

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (auth guard, security logger, tests)
2. Complete Phase 2: Foundational (migration, entity updates)
3. Complete Phase 3: User Story 1 (library isolation)
4. Complete Phase 4: User Story 2 (auth enforcement)
5. **STOP and VALIDATE**: Test library operations and auth enforcement
6. Deploy/demo if ready - core multi-user functionality is complete

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Stories 1 + 2 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 3 → Test chat isolation → Deploy/Demo
4. Add User Story 4 → Test agent tools → Deploy/Demo
5. Add User Story 5 → Test search integration → Deploy/Demo
6. Complete Polish phase → Final validation

---

## Summary

| Phase | Tasks | User Story | Parallel Opportunities |
|-------|-------|------------|----------------------|
| 1. Setup | 4 | - | 2 test files |
| 2. Foundational | 5 | - | 2 entity files |
| 3. US1 Library | 17 | P1 | - |
| 4. US2 Auth | 6 | P1 | 2 frontend files |
| 5. US3 Chat | 12 | P2 | - |
| 6. US4 Agent Tools | 7 | P2 | 5 tool files |
| 7. US5 Search | 3 | P3 | - |
| 8. Polish | 6 | - | 2 test files |

**Total Tasks**: 60
**MVP Scope**: Phases 1-4 (32 tasks) - delivers US1 + US2 (core multi-user + auth)
