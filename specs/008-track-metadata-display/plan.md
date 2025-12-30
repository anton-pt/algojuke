# Implementation Plan: Track Metadata Display

**Branch**: `008-track-metadata-display` | **Date**: 2025-12-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-track-metadata-display/spec.md`

## Summary

Enable users to view extended track metadata (lyrics, interpretation, audio features) for indexed tracks while browsing their library. The UI uses an accordion pattern—clicking a track row expands a details panel below—with visual indicators showing which tracks have been indexed. Backend provides GraphQL queries to fetch indexed status (batch) and extended metadata (single track) from the Qdrant vector index.

## Technical Context

**Language/Version**: TypeScript 5.3.3 / Node.js 20.x (backend), TypeScript 5.3.3 / React 18.2.0 (frontend)
**Primary Dependencies**: Apollo Server 4.x + Apollo Client 3.x (GraphQL), Qdrant JS client, Zod (validation), Vitest (testing)
**Storage**: PostgreSQL (library data via TypeORM), Qdrant (vector index with track documents)
**Testing**: Vitest 1.x (contract + integration tests)
**Target Platform**: Web application (SPA)
**Project Type**: Web (frontend + backend + services)
**Performance Goals**: <3 seconds for accordion content load (per SC-001)
**Constraints**: No real-time updates (page refresh for status changes)
**Scale/Scope**: Library size up to 500 items per spec assumption

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First Development | ✅ PASS | Contract tests for new GraphQL schema, integration tests for accordion behavior |
| II. Code Quality Standards | ✅ PASS | Following existing patterns in backend/frontend; no new complexity |
| III. User Experience Consistency | ✅ PASS | Accordion pattern, loading states, error handling with retry defined in spec |
| IV. Robust Architecture | ✅ PASS | Fail-open pattern for Qdrant queries (existing); structured logging |
| V. Security by Design | ✅ PASS | No new user input validation required (ISRCs from trusted library data) |
| Development Workflow | ✅ PASS | Feature branch workflow, spec-first approach |

**Gate Status**: PASS - Proceeding to Phase 0

## Project Structure

### Documentation (this feature)

```text
specs/008-track-metadata-display/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (GraphQL schema extensions)
│   └── track-metadata.graphql
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── schema/
│   │   └── trackMetadata.graphql    # New GraphQL types and queries
│   ├── resolvers/
│   │   └── trackMetadata.ts         # Resolver for extended metadata queries
│   ├── services/
│   │   └── trackMetadataService.ts  # Business logic for Qdrant queries
│   └── clients/
│       └── qdrantClient.ts          # Extend with payload retrieval
└── tests/
    ├── contract/
    │   └── trackMetadata.test.ts    # Schema validation tests
    └── integration/
        └── trackMetadata.test.ts    # End-to-end query tests

frontend/
├── src/
│   ├── components/
│   │   └── library/
│   │       ├── TrackAccordion.tsx       # Accordion UI component
│   │       ├── TrackMetadataPanel.tsx   # Expanded content panel
│   │       ├── AudioFeaturesDisplay.tsx # Audio features formatting
│   │       └── IndexedBadge.tsx         # Visual indicator component
│   ├── graphql/
│   │   └── trackMetadata.ts         # GraphQL queries for metadata
│   └── hooks/
│       └── useTrackMetadata.ts      # Custom hook for accordion state
└── tests/
    └── components/
        └── TrackAccordion.test.tsx  # Component tests
```

**Structure Decision**: Extends existing web application structure. New files follow established patterns from library management (002) implementation.

## Complexity Tracking

> No violations detected. All implementations follow existing patterns.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | - | - |
