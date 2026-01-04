# Implementation Plan: Per-User Music Library Storage

**Branch**: `018-per-user-library` | **Date**: 2026-01-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/018-per-user-library/spec.md`

## Summary

Enable multi-user support by associating library albums, tracks, and chat conversations with authenticated Clerk users. Update GraphQL resolvers to use the authenticated user's ID instead of hardcoded mock IDs, enforce authentication on all operations, add security logging, and migrate existing data to the primary user (anton.tcholakov@gmail.com). Change unique constraints from global to per-user composite keys to allow multiple users to have the same items.

## Technical Context

**Language/Version**: TypeScript 5.3.3 / Node.js 20.x (backend), TypeScript 5.3.3 / React 18.2.0 (frontend)
**Primary Dependencies**: TypeORM, Apollo Server 4.x, Apollo Client 3.x, Clerk SDK, Vercel AI SDK
**Storage**: PostgreSQL (existing, via TypeORM)
**Testing**: Vitest (backend), React Testing Library (frontend)
**Target Platform**: Web application (Node.js backend + React frontend)
**Project Type**: Web application with monorepo structure (backend/, frontend/, services/)
**Performance Goals**: Match existing library/chat operation response times (<2s for library browse, <3s for chat operations)
**Constraints**: Zero cross-user data leakage, 100% authentication enforcement
**Scale/Scope**: Private beta with single approved user initially, designed for multi-user expansion

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First Development | PASS | Tests will be written before implementation for all resolver changes, middleware, and migration |
| II. Code Quality Standards | PASS | Simple changes to existing patterns (add userId filtering, remove hardcoded IDs) |
| III. User Experience Consistency | PASS | No UX changes - users see their own data transparently |
| IV. Robust Architecture | PASS | Leverages existing separation of concerns; adds security logging |
| V. Security by Design | PASS | Core focus: authentication enforcement, authorization checks, audit logging |

**All gates PASS** - Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/018-per-user-library/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── graphql-schema-changes.md
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── entities/
│   │   ├── LibraryAlbum.ts      # Update: composite unique constraint
│   │   ├── LibraryTrack.ts      # Update: composite unique constraint
│   │   ├── Conversation.ts      # No changes needed (already has userId)
│   │   └── Message.ts           # No changes needed
│   ├── migrations/
│   │   └── [timestamp]-EnableMultiUserLibrary.ts  # New: alter constraints, migrate data
│   ├── middleware/
│   │   ├── clerkAuth.ts         # Existing: already provides getAuth()
│   │   └── authGuard.ts         # New: GraphQL authentication guard
│   ├── resolvers/
│   │   ├── library.ts           # Update: use context.userId, add auth checks
│   │   └── chatResolver.ts      # Update: use context.userId, add auth checks
│   ├── services/
│   │   ├── libraryService.ts    # Update: add user ownership verification
│   │   ├── chatService.ts       # Update: add user ownership verification
│   │   ├── tidalService.ts      # Update: accept userId for library status lookup (US5)
│   │   └── agentTools/          # Update: remove CURRENT_USER_ID fallbacks
│   │       ├── semanticSearchTool.ts
│   │       ├── tidalSearchTool.ts
│   │       ├── albumTracksTool.ts
│   │       ├── batchMetadataTool.ts
│   │       └── suggestPlaylistTool.ts
│   └── utils/
│       └── securityLogger.ts    # New: audit logging utility
└── tests/
    ├── contract/
    │   ├── auth/
    │   │   └── graphqlAuth.test.ts    # New: auth enforcement tests
    │   └── library/
    │       └── userIsolation.test.ts  # New: user isolation tests
    └── integration/
        └── multiUser/
            └── libraryIsolation.test.ts  # New: cross-user isolation tests

frontend/
├── src/
│   └── lib/
│       └── apollo.ts            # Update: ensure auth headers on all requests
└── tests/
    └── auth/
        └── protectedRoutes.test.ts  # New: auth enforcement UI tests
```

**Structure Decision**: Web application with existing monorepo structure. Changes are primarily in backend resolvers, services, and a new migration. Frontend changes are minimal (auth header configuration).

## Complexity Tracking

> No Constitution Check violations requiring justification.

| Item | Complexity Level | Justification |
|------|-----------------|---------------|
| Migration strategy | Low | Single migration to alter constraints and assign existing data to known user |
| Auth guard implementation | Low | Reuse existing Clerk middleware patterns |
| Resolver changes | Low | Replace hardcoded ID with context.userId |
