# Implementation Plan: Personal Music Library Management

**Branch**: `002-library-management` | **Date**: 2025-12-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-library-management/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement a personal music library management system that allows users to add/remove albums and tracks from Tidal search results and browse them through Albums and Tracks views. Library data is persisted using PostgreSQL with TypeORM, exposed via GraphQL API, and browsable without Tidal API calls by caching complete metadata including track listings.

**Technical Approach**: Extend existing GraphQL API with library CRUD operations, add TypeORM entities for albums/tracks with PostgreSQL persistence, enrich Tidal metadata on add operations by fetching track listings and caching in database, implement independent album/track collections with alphabetical sorting, provide graceful degradation for storage failures and Tidal API unavailability, support undo functionality for removals.

## Technical Context

**Language/Version**: TypeScript 5.3.3 / Node.js 20.x (backend), TypeScript 5.3.3 / React 18.2.0 (frontend)
**Primary Dependencies**: Apollo Server 4.x + Apollo Client 3.x (GraphQL), TypeORM (ORM), pg (PostgreSQL driver), axios 1.6+ (Tidal API), Vitest 1.x (testing), React Testing Library (frontend tests)
**Storage**: PostgreSQL (persistent library data via TypeORM entities)
**Testing**: Vitest (backend contract + integration tests), React Testing Library (frontend component tests)
**Target Platform**: Web application (Node.js server + React SPA)
**Project Type**: Web (backend + frontend)
**Performance Goals**: Library add operations <3s (SC-001), library views load <2s for 500 items (SC-002), remove operations <1s (SC-005)
**Constraints**: 100% persistence across restarts (SC-003), 100% duplicate prevention (SC-006), graceful degradation on storage/API failures
**Scale/Scope**: Support 0-1000 items per user library (assumption), single-user initially, PostgreSQL for relational integrity

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Initial Check (Pre-Phase 0)

- ✅ **Test-First Development**: Contract tests for GraphQL mutations/queries, integration tests for persistence, unit tests for sorting logic - all written before implementation
- ✅ **Code Quality Standards**: Starting with simplest solution (CRUD + caching), complexity justified in tracking section
- ✅ **User Experience Consistency**: User stories prioritized (P1-P4), clear error messages for storage/API failures, undo for removals
- ✅ **Robust Architecture**: TypeORM for data integrity, error handling at Tidal API boundary, graceful degradation on failures, structured logging
- ✅ **Security by Design**: Input validation on GraphQL layer, no sensitive data in library (only metadata from Tidal)
- ✅ **Incremental Delivery**: User stories implemented P1→P4, each independently testable
- ✅ **Documentation**: API contracts (GraphQL schema), data model (TypeORM entities), quickstart for development setup

**Gate Status**: ✅ PASS - All principles satisfied

### Post-Phase 1 Design Check

**Status**: ✅ COMPLETE - Phase 1 artifacts generated and verified

**Artifacts Reviewed**:
- ✅ research.md: TypeORM setup, GraphQL integration, undo patterns, Docker Compose, Tidal API endpoints
- ✅ data-model.md: LibraryAlbum and LibraryTrack entities with complete field definitions
- ✅ contracts/library.graphql: Complete GraphQL schema for library operations
- ✅ quickstart.md: Development setup guide with PostgreSQL Docker configuration

**Constitution Principles Re-verified**:

- ✅ **Test-First Development**: tasks.md now includes 25 test tasks (contract, integration, unit) BEFORE implementation tasks for all user stories - Constitution violation resolved
- ✅ **Code Quality Standards**: Complexity justified in Tracking section remains valid - TypeORM for type safety, separate entities for independence, undo mechanism for UX, track listing cache for offline browsing
- ✅ **User Experience Consistency**: User stories (P1-P4) with independent test criteria maintained; error messages for storage/API failures specified in data-model.md and research.md; undo functionality detailed in research.md section 6
- ✅ **Robust Architecture**:
  - TypeORM entities provide data integrity (data-model.md)
  - Error handling at Tidal API boundary documented (research.md section 5, section 8)
  - Graceful degradation for storage failures specified (research.md section 5, tasks.md T019)
  - Structured logging planned (tasks.md T105)
- ✅ **Security by Design**:
  - Input validation via GraphQL schema (contracts/library.graphql with input types)
  - No sensitive data stored - only Tidal metadata (data-model.md confirms public metadata fields only)
  - PostgreSQL error codes mapped without exposing SQL details (research.md section 5)
- ✅ **Incremental Delivery**: tasks.md organized by user story (P1→P4), each independently testable with checkpoints
- ✅ **Documentation**: All required artifacts complete per constitution

**Research Decisions Alignment**:

- ✅ TypeORM DataSource with connection pooling (research.md section 1) → data-model.md entities use TypeORM decorators
- ✅ TypeORM migrations with tsx runner (research.md section 2) → quickstart.md documents migration workflow
- ✅ Separate Album/Track entities with JSONB (research.md section 3) → data-model.md defines both with JSONB columns
- ✅ Repository pattern with Apollo Server context (research.md section 4) → aligns with GraphQL resolvers in contracts/
- ✅ PostgreSQL error code mapping (research.md section 5) → tasks.md T019, T028 implement error handling
- ✅ In-memory undo buffer with Sonner (research.md section 6) → tasks.md T055, T077 implement useUndoDelete hook
- ✅ Docker Compose PostgreSQL with health checks (research.md section 7) → quickstart.md includes complete docker-compose.yml
- ✅ Tidal album track listing endpoint (research.md section 8) → tasks.md T015 implements getAlbumTrackListing

**Data Model Coverage**:

- ✅ LibraryAlbum entity (data-model.md) covers spec.md Album entity requirements (FR-005)
- ✅ LibraryTrack entity (data-model.md) covers spec.md Track entity requirements (FR-006)
- ✅ Library as independent collections (data-model.md section on relationships) aligns with FR-018
- ✅ All indexes specified for alphabetical sorting (FR-010, FR-011) documented in data-model.md
- ✅ JSONB track listing structure (data-model.md section on JSONB) enables offline browsing per FR-008

**Contract Alignment**:

- ✅ contracts/library.graphql defines all GraphQL operations from tasks.md:
  - addAlbumToLibrary mutation (T026 resolver)
  - addTrackToLibrary mutation (T044 resolver)
  - getLibraryAlbums query (T027 resolver)
  - getLibraryTracks query (T045 resolver)
  - getLibraryAlbum(id) query (T056 resolver)
  - getLibraryTrack(id) query (T064 resolver)
  - removeAlbumFromLibrary mutation (T075 resolver)
  - removeTrackFromLibrary mutation (T086 resolver)
- ✅ Union types (AddAlbumToLibraryResult, AddTrackToLibraryResult) support error handling per FR-003, FR-004, FR-026, FR-027
- ✅ TrackInfo type in contracts matches data-model.md JSONB structure

**Gate Status**: ✅ PASS - All constitution principles satisfied, all design artifacts complete and aligned with specification

## Project Structure

### Documentation (this feature)

```text
specs/002-library-management/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output: TypeORM setup, PostgreSQL schema decisions
├── data-model.md        # Phase 1 output: Entity definitions, relationships
├── quickstart.md        # Phase 1 output: Development setup with PostgreSQL
├── contracts/           # Phase 1 output: GraphQL schema for library operations
│   └── library.graphql  # GraphQL type definitions and operations
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Web application (frontend + backend)
backend/
├── src/
│   ├── entities/            # TypeORM entities (NEW)
│   │   ├── Album.ts         # Album entity with track listing
│   │   └── Track.ts         # Track entity
│   ├── services/
│   │   ├── tidal.ts         # Existing Tidal API service
│   │   └── library.ts       # NEW: Library CRUD operations
│   ├── resolvers/
│   │   ├── search.ts        # Existing search resolvers
│   │   └── library.ts       # NEW: Library GraphQL resolvers
│   ├── schema/
│   │   ├── search.graphql   # Existing search schema
│   │   └── library.graphql  # NEW: Library schema
│   ├── utils/
│   │   ├── cache.ts         # Existing in-memory cache
│   │   ├── rate-limiter.ts  # Existing rate limiter
│   │   └── db.ts            # NEW: TypeORM connection setup
│   └── server.ts            # Updated to initialize TypeORM
├── tests/
│   ├── contract/
│   │   └── library.test.ts  # NEW: GraphQL contract tests
│   ├── integration/
│   │   └── library-persistence.test.ts  # NEW: Database integration tests
│   └── unit/
│       └── library-service.test.ts      # NEW: Service logic tests
└── migrations/              # NEW: TypeORM migrations
    └── 001-create-library-tables.ts

frontend/
├── src/
│   ├── components/
│   │   ├── search/          # Existing search components
│   │   └── library/         # NEW: Library components
│   │       ├── LibraryNav.tsx       # Albums/Tracks navigation
│   │       ├── AlbumsView.tsx       # Albums list + detail
│   │       ├── TracksView.tsx       # Tracks list + detail
│   │       ├── AlbumCard.tsx        # Album display component
│   │       ├── TrackCard.tsx        # Track display component
│   │       └── UndoToast.tsx        # Removal undo notification
│   ├── graphql/
│   │   ├── queries.ts       # Existing search queries
│   │   └── library.ts       # NEW: Library queries/mutations
│   ├── hooks/
│   │   └── useLibrary.ts    # NEW: Library state management hook
│   └── App.tsx              # Updated with library routes
└── tests/
    └── components/
        └── library/         # NEW: Library component tests
            ├── AlbumsView.test.tsx
            ├── TracksView.test.tsx
            └── UndoToast.test.tsx

docker-compose.yml           # NEW: PostgreSQL container for local development
```

**Structure Decision**: Web application pattern (Option 2) with backend/frontend separation. Backend extends existing Apollo Server with TypeORM for PostgreSQL persistence. Frontend extends existing React app with new library views and Apollo Client mutations. PostgreSQL runs in Docker for local development.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| TypeORM ORM layer | Provides type-safe database operations, migrations, entity relationships, and abstracts SQL complexity | Direct SQL would require manual schema management, migration tracking, and lose type safety - increases error risk and maintenance burden |
| Separate Album/Track entities | Albums and tracks are independent collections per clarification Q1, requiring distinct storage and duplicate tracking by Tidal ID | Single entity would force artificial relationships and complicate independent add/remove operations |
| Undo mechanism for removals | Required by UX decision (clarification Q3) to provide post-removal undo option within success message | Pre-confirmation dialogs rejected in favor of streamlined UX - undo provides safety without friction |
| Track listing cache in Album entity | Required by clarification Q4 and user input - library browsing must work without Tidal API calls | Fetching track listings on-demand would violate offline browsing requirement and add latency |

**Justification Summary**: All complexity items are driven by explicit requirements (clarifications, user input) or constitution principles (type safety, error reduction). Each provides measurable value (type safety, performance, UX) that outweighs the added complexity.

## Phase 0: Outline & Research

### Research Tasks

1. **TypeORM Setup with PostgreSQL**: Best practices for TypeORM configuration, connection pooling, migration strategy
2. **GraphQL + TypeORM Integration**: Patterns for exposing TypeORM entities via Apollo Server resolvers
3. **Undo Functionality**: Implementation patterns for time-limited undo with in-memory state or database soft deletes
4. **Tidal Track Listing API**: Endpoint and format for fetching complete album track listings
5. **PostgreSQL Schema Design**: Optimal indexes for alphabetical sorting by artist/album/track names
6. **Docker Compose PostgreSQL**: Standard setup for local development with persistent volumes

### Research Output

See [research.md](./research.md) for detailed findings and decisions.

## Phase 1: Design & Contracts

### Data Model

See [data-model.md](./data-model.md) for complete entity definitions, relationships, and validation rules.

**Key Entities**:
- `Album` entity: Tidal album ID (unique), artist name, album title, cover art URL, release date, track count, track listing (JSON), date added
- `Track` entity: Tidal track ID (unique), artist name, track title, album name, duration, date added

### API Contracts

See [contracts/library.graphql](./contracts/library.graphql) for complete GraphQL schema.

**Operations**:
- `addAlbumToLibrary(tidalAlbumId: String!): Album!`
- `addTrackToLibrary(tidalTrackId: String!): Track!`
- `removeAlbumFromLibrary(id: ID!): Boolean!`
- `removeTrackFromLibrary(id: ID!): Boolean!`
- `getLibraryAlbums: [Album!]!` (sorted alphabetically)
- `getLibraryTracks: [Track!]!` (sorted alphabetically)

### Development Setup

See [quickstart.md](./quickstart.md) for step-by-step local development setup including PostgreSQL Docker container.

## Phase 2: Task Decomposition

*Output generated by `/speckit.tasks` command - not part of this plan*

Tasks will be generated based on prioritized user stories (P1→P4) with test-first approach per constitution.

## Implementation Notes

### Migration Strategy

1. Add TypeORM dependencies to backend/package.json
2. Create docker-compose.yml for PostgreSQL
3. Implement entities with migrations
4. Extend GraphQL schema with library operations
5. Implement resolvers with error handling
6. Add frontend library views and hooks
7. Implement undo toast component

### Error Handling Strategy

- **Tidal API Unavailable**: Block add operations, return GraphQL error with user-friendly message (FR-026, FR-027)
- **Storage Unavailable**: Allow reads (FR-019), block writes (FR-020), return descriptive errors (FR-021)
- **Duplicate Detection**: Check Tidal ID before insert, return error if exists (FR-003, FR-004)

### Testing Strategy

1. **Contract Tests**: GraphQL schema validation, mutation responses, query responses
2. **Integration Tests**: Database CRUD operations, transaction handling, sorting verification
3. **Unit Tests**: Duplicate detection logic, alphabetical sorting, error handling branches
4. **Frontend Tests**: Component rendering, mutation calls, undo interaction, error states

All tests written before implementation per constitution Test-First Development principle.
