# Tasks: Clerk Authentication with Tidal Account Connection

**Input**: Design documents from `/specs/016-clerk-tidal-auth/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are included per Constitution (Test-First Development principle).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/`
- **Backend tests**: `backend/tests/contract/`, `backend/tests/integration/`
- **Frontend tests**: `frontend/tests/components/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and configure environment

- [x] T001 [P] Install Clerk backend dependencies (`@clerk/express`, `@clerk/backend`) in backend/package.json
- [x] T002 [P] Install Clerk frontend dependencies (`@clerk/clerk-react`) in frontend/package.json
- [x] T003 [P] Install Tidal SDK (`@tidal-music/auth`) in frontend/package.json
- [x] T004 [P] Add Clerk environment variables to backend/.env.example (CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY)
- [x] T005 [P] Add Clerk environment variables to frontend/.env.example (VITE_CLERK_PUBLISHABLE_KEY)
- [x] T006 [P] Add Tidal environment variables to frontend/.env.example (VITE_TIDAL_CLIENT_ID, VITE_TIDAL_REDIRECT_URI)
- [x] T007 Configure Vite for HTTPS in frontend/vite.config.ts (required for Tidal OAuth)
- [x] T008 Add TypeScript types for Clerk request context in backend/src/types/globals.d.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T009 Create allowlist configuration in backend/src/config/allowlist.ts with isApprovedUser() function
- [x] T010 Copy Zod schemas from contracts/schemas.ts to backend/src/schemas/auth.ts
- [x] T011 Create Clerk middleware setup in backend/src/middleware/clerkAuth.ts with clerkMiddleware()
- [x] T012 Create requireApproved middleware in backend/src/middleware/clerkAuth.ts (checks allowlist)
- [x] T013 Add Clerk middleware to Express app in backend/src/server.ts
- [x] T014 Create tidalAuthService in backend/src/services/tidalAuthService.ts (getTidalTokens, storeTidalTokens, hasTidalConnection)
- [x] T015 Create auth routes file in backend/src/routes/auth.ts with Express Router
- [x] T016 Register auth routes in backend/src/server.ts under /api/auth
- [x] T017 Wrap React app with ClerkProvider in frontend/src/main.tsx
- [x] T018 Create useTidalAuth hook in frontend/src/hooks/useTidalAuth.ts (manages Tidal SDK state)
- [x] T019 Create ProtectedRoute component in frontend/src/components/auth/ProtectedRoute.tsx
- [x] T020 Create AuthLayout component in frontend/src/components/layout/AuthLayout.tsx

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Approved User Signs In and Connects Tidal (Priority: P1)

**Goal**: Enable approved users to sign in with Google and connect their Tidal account

**Independent Test**: Sign in with anton.tcholakov@gmail.com, complete Tidal connection, verify access to main app

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T021 [P] [US1] Contract test for GET /api/auth/status endpoint in backend/tests/contract/auth/authStatus.test.ts
- [x] T022 [P] [US1] Contract test for POST /api/auth/tidal/tokens endpoint in backend/tests/contract/auth/tidalTokens.test.ts
- [x] T023 [P] [US1] Contract test for GET /api/auth/tidal/tokens endpoint in backend/tests/contract/auth/tidalTokenStatus.test.ts
- [x] T024 [P] [US1] Integration test for approved user auth flow in backend/tests/integration/auth/approvedUserFlow.test.ts

### Implementation for User Story 1

- [x] T025 [US1] Implement GET /api/auth/status endpoint in backend/src/routes/auth.ts
- [x] T026 [US1] Implement POST /api/auth/tidal/tokens endpoint in backend/src/routes/auth.ts (requires approved user)
- [x] T027 [US1] Implement GET /api/auth/tidal/tokens endpoint in backend/src/routes/auth.ts
- [x] T028 [P] [US1] Create TidalConnectPage in frontend/src/pages/TidalConnectPage.tsx
- [x] T029 [P] [US1] Create TidalConnectButton component in frontend/src/components/auth/TidalConnectButton.tsx
- [x] T030 [US1] Create CallbackPage for Tidal OAuth in frontend/src/pages/CallbackPage.tsx
- [x] T031 [US1] Add Tidal connection routes to frontend/src/App.tsx (/connect-tidal, /auth/tidal/callback)
- [x] T032 [US1] Implement redirect to main app after successful Tidal connection in CallbackPage
- [x] T033 [US1] Update ProtectedRoute to redirect approved users without Tidal to /connect-tidal

**Checkpoint**: Approved users can complete full sign-in and Tidal connection flow

---

## Phase 4: User Story 2 - Non-Approved User Experience (Priority: P2)

**Goal**: Show waitlist page to users not on the allowlist

**Independent Test**: Sign in with non-allowlisted Google account, verify waitlist page appears

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T034 [P] [US2] Contract test for 403 response on non-approved POST /api/auth/tidal/tokens in backend/tests/contract/auth/tidalTokensUnauthorized.test.ts
- [x] T035 [P] [US2] Component test for WaitlistPage in frontend/tests/components/auth/WaitlistPage.test.tsx

### Implementation for User Story 2

- [x] T036 [P] [US2] Create WaitlistPage in frontend/src/pages/WaitlistPage.tsx
- [x] T037 [US2] Update ProtectedRoute to redirect non-approved users to /waitlist
- [x] T038 [US2] Add waitlist route to frontend/src/App.tsx (/waitlist)
- [x] T039 [US2] Ensure direct URL access to protected routes redirects non-approved users to waitlist

**Checkpoint**: Non-approved users are gracefully handled with waitlist page

---

## Phase 5: User Story 3 - Landing Page Experience (Priority: P3)

**Goal**: Public landing page explaining AlgoJuke service

**Independent Test**: Visit root URL without signing in, verify landing page displays

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T040 [P] [US3] Component test for LandingPage in frontend/tests/components/auth/LandingPage.test.tsx

### Implementation for User Story 3

- [x] T041 [US3] Create LandingPage in frontend/src/pages/LandingPage.tsx with service description
- [x] T042 [US3] Add Clerk SignInButton to LandingPage (Sign in with Google)
- [x] T043 [US3] Add landing page route to frontend/src/App.tsx (root /)
- [x] T044 [US3] Style LandingPage with AlgoJuke branding and private beta messaging

**Checkpoint**: Landing page provides clear value proposition and sign-in option

---

## Phase 6: User Story 4 - Approved User Without Tidal Connection (Priority: P4)

**Goal**: Handle interrupted Tidal connection flow gracefully

**Independent Test**: Sign in as approved user, don't complete Tidal, revisit - verify redirect to connect page

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T045 [P] [US4] Integration test for incomplete Tidal flow in backend/tests/integration/auth/incompleteTidalFlow.test.ts

### Implementation for User Story 4

- [x] T046 [US4] Add error handling to TidalConnectPage for cancelled/failed OAuth
- [x] T047 [US4] Persist auth state check in useTidalAuth hook for returning users
- [x] T048 [US4] Add retry button to TidalConnectPage for failed connections

**Checkpoint**: Interrupted flows are handled with clear recovery path

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T049 [P] Contract test for POST /api/auth/tidal/refresh endpoint in backend/tests/contract/auth/tidalRefresh.test.ts
- [x] T050 Implement POST /api/auth/tidal/refresh endpoint in backend/src/routes/auth.ts
- [x] T051 [P] Add sign-out button (UserButton from Clerk) to authenticated pages
- [x] T052 [P] Add loading states to auth components (TidalConnectPage, CallbackPage)
- [x] T053 [P] Add error boundary for auth-related errors in frontend
- [x] T054 Run quickstart.md validation to verify full flow works
- [x] T055 Update backend/README.md with auth setup instructions
- [x] T056 Update frontend/README.md with auth setup instructions
- [x] T057 [FR-012] Integration test for session persistence in backend/tests/integration/auth/sessionPersistence.test.ts (verify Clerk session survives browser refresh)
- [x] T058 [SC-004] Add structured logging for Tidal token refresh operations in backend/src/services/tidalAuthService.ts (success/failure with duration)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3 → P4)
- **Polish (Phase 7)**: Depends on at least User Story 1 being complete

### User Story Dependencies

| Story | Can Start After | Dependencies on Other Stories |
|-------|-----------------|-------------------------------|
| US1 (P1) | Foundational | None |
| US2 (P2) | Foundational | None (but uses ProtectedRoute from US1) |
| US3 (P3) | Foundational | None |
| US4 (P4) | Foundational | Builds on US1 TidalConnectPage |

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Backend endpoints before frontend that calls them
- Core components before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T001-T008)
- Contract tests within a story marked [P] can run in parallel
- Frontend pages marked [P] can be created in parallel
- Different user stories can be worked on in parallel after Foundational phase

---

## Parallel Example: Phase 1 Setup

```bash
# All these can run simultaneously:
T001: Install Clerk backend dependencies in backend/package.json
T002: Install Clerk frontend dependencies in frontend/package.json
T003: Install Tidal SDK in frontend/package.json
T004: Add Clerk env vars to backend/.env.example
T005: Add Clerk env vars to frontend/.env.example
T006: Add Tidal env vars to frontend/.env.example
```

## Parallel Example: User Story 1 Tests

```bash
# All tests can be written in parallel:
T021: Contract test for GET /api/auth/status
T022: Contract test for POST /api/auth/tidal/tokens
T023: Contract test for GET /api/auth/tidal/tokens
T024: Integration test for approved user flow
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (8 tasks)
2. Complete Phase 2: Foundational (12 tasks)
3. Complete Phase 3: User Story 1 (13 tasks)
4. **STOP and VALIDATE**: Test with anton.tcholakov@gmail.com
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → **MVP Ready!**
3. Add User Story 2 → Non-approved users handled
4. Add User Story 3 → Public landing page
5. Add User Story 4 → Edge case recovery
6. Polish → Full feature complete

### Task Summary

| Phase | Tasks | Cumulative |
|-------|-------|------------|
| Setup | 8 | 8 |
| Foundational | 12 | 20 |
| User Story 1 | 13 | 33 |
| User Story 2 | 6 | 39 |
| User Story 3 | 5 | 44 |
| User Story 4 | 4 | 48 |
| Polish | 10 | 58 |

**Total Tasks**: 58

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- HTTPS required for Tidal OAuth (ensure vite.config.ts is configured)
