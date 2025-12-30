# Implementation Plan: Semantic Discovery Search

**Branch**: `009-semantic-discovery-search` | **Date**: 2025-12-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-semantic-discovery-search/spec.md`

## Summary

Implement a natural language music discovery feature that enables users to search for indexed tracks by describing moods, themes, or feelings. The search pipeline uses Claude Haiku 4.5 for query expansion (1-3 queries), TEI embeddings for vector search, and Qdrant's hybrid search (vector + BM25) with Reciprocal Rank Fusion. Results are displayed in a new "Discover" page with expandable track details reusing the 008-track-metadata-display accordion pattern.

## Technical Context

**Language/Version**: TypeScript 5.3.3 / Node.js 20.x (backend), TypeScript 5.3.3 / React 18.2.0 (frontend)
**Primary Dependencies**: Apollo Server 4.x + Apollo Client 3.x (GraphQL), @qdrant/js-client-rest (Qdrant), Vercel AI SDK (`ai`, `@ai-sdk/anthropic`), axios (HTTP), Zod 3.x (validation), Vitest (testing)
**Storage**: Qdrant vector database (hybrid search with dense vectors + BM25), no new persistent storage needed
**Testing**: Vitest 1.x (contract + integration tests), React Testing Library (frontend)
**Target Platform**: Web application (local development, macOS)
**Project Type**: Web application (frontend + backend + services)
**Performance Goals**: <10s end-to-end discovery search, <3s accordion metadata load (per SC-001, SC-005)
**Constraints**: 30s timeout for search operations (FR-018), max 100 results (5 pages of 20)
**Scale/Scope**: Local prototype, indexed track corpus up to 100k tracks

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First Development | ✅ Pass | Contract tests for GraphQL schema, integration tests for hybrid search pipeline, component tests for Discover UI |
| II. Code Quality Standards | ✅ Pass | Follows existing patterns from 008-track-metadata-display and worker service; no unnecessary complexity |
| III. User Experience Consistency | ✅ Pass | Reuses accordion pattern from 008; navigation consistent with existing Search/Library; loading/error states defined |
| IV. Robust Architecture | ✅ Pass | Clear separation: GraphQL resolver → search service → Qdrant client; observability via Langfuse; error handling at boundaries |
| V. Security by Design | ✅ Pass | Input validation (empty/whitespace checks), no secrets in code, Anthropic API key via env var |

**All gates passed.** No constitution violations.

## Project Structure

### Documentation (this feature)

```text
specs/009-semantic-discovery-search/
├── plan.md              # This file
├── research.md          # Phase 0 output (hybrid search patterns, query expansion)
├── data-model.md        # Phase 1 output (discovery query, result entities)
├── quickstart.md        # Phase 1 output (developer setup guide)
├── contracts/           # Phase 1 output (GraphQL schema extensions)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── resolvers/
│   │   └── discoveryResolver.ts      # NEW: Discovery search GraphQL resolver
│   ├── schema/
│   │   └── discovery.graphql         # NEW: Discovery types and queries
│   ├── services/
│   │   └── discoveryService.ts       # NEW: Search pipeline orchestration
│   ├── clients/
│   │   ├── qdrantClient.ts           # EXTEND: Add hybrid search method
│   │   ├── anthropicClient.ts        # NEW: Haiku query expansion client
│   │   └── teiClient.ts              # NEW: Embedding client (mirror from worker)
│   └── server.ts                     # MODIFY: Register discovery resolvers
└── tests/
    ├── contract/
    │   └── discoverySchema.test.ts   # NEW: GraphQL schema validation
    └── integration/
        └── discoverySearch.test.ts   # NEW: End-to-end search tests

frontend/
├── src/
│   ├── pages/
│   │   └── DiscoverPage.tsx          # NEW: Discover feature page
│   ├── components/
│   │   ├── discover/                 # NEW: Discovery-specific components
│   │   │   ├── DiscoverySearchBar.tsx
│   │   │   ├── DiscoveryResults.tsx
│   │   │   └── DiscoveryTrackItem.tsx
│   │   └── library/
│   │       └── TrackAccordion.tsx    # REUSE: Extended metadata display
│   ├── graphql/
│   │   └── discovery.ts              # NEW: Discovery queries
│   ├── hooks/
│   │   └── useDiscoverySearch.ts     # NEW: Search state management
│   └── App.tsx                       # MODIFY: Add /discover route
└── tests/
    └── components/
        └── DiscoverPage.test.tsx     # NEW: Component tests

services/
└── observability/                    # REUSE: Langfuse tracing
```

**Structure Decision**: Follows existing web application structure. New discovery feature adds:
- Backend: New resolver + service + clients pattern (mirrors track metadata flow)
- Frontend: New page + components + hooks pattern (mirrors library feature)
- Reuses existing observability and search-index services

## Complexity Tracking

> No constitution violations requiring justification.

| Item | Rationale |
|------|-----------|
| Multi-query expansion | Required by spec (FR-004); LLM generates 1-3 queries for better semantic coverage |
| RRF score fusion | Qdrant's built-in method; simpler than custom weighting |
| Backend embedding client | Mirrors worker/tei.ts pattern; shares same TEI service |
