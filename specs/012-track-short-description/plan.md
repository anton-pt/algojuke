# Implementation Plan: Track Short Description

**Branch**: `012-track-short-description` | **Date**: 2026-01-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-track-short-description/spec.md`

## Summary

Extend the track ingestion pipeline to generate a single-sentence short description for each track using Claude Haiku 4.5. The short description is derived from the interpretation (for tracks with lyrics) or metadata/audio features (for instrumentals). A backfill script processes existing tracks at a rate-limited 1 track every 2 seconds to respect API limits.

## Technical Context

**Language/Version**: TypeScript 5.3.3 / Node.js 20.x
**Primary Dependencies**: Inngest 3.22.12, Vercel AI SDK (`ai`, `@ai-sdk/anthropic`), Zod 3.x, Langfuse 3.0.0, @qdrant/js-client-rest 1.16.2
**Storage**: Qdrant vector database (extending track document schema)
**Testing**: Vitest 1.x
**Target Platform**: Node.js server (worker service)
**Project Type**: Web application (services/worker)
**Performance Goals**: Short description generation adds ≤2 seconds per track; backfill processes at 1 track/2 seconds (30 tracks/minute)
**Constraints**: Backfill rate: 1 track every 2 seconds; Short descriptions: single sentence, ≤50 words
**Scale/Scope**: All tracks in index (existing + new)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First Development | ✅ Pass | Contract tests for schema extension, integration tests for pipeline step |
| II. Code Quality Standards | ✅ Pass | Follows existing patterns in trackIngestion.ts |
| III. User Experience Consistency | ✅ Pass | User stories prioritized P1/P2/P3 with acceptance scenarios |
| IV. Robust Architecture | ✅ Pass | Graceful degradation (null on failure), observability via Langfuse |
| V. Security by Design | ✅ Pass | No new secrets; uses existing ANTHROPIC_API_KEY |

**Gate Result**: ✅ PASSED - Proceed to Phase 0

## Project Structure

### Documentation (this feature)

```text
specs/012-track-short-description/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A - no new API endpoints)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
services/worker/
├── src/
│   ├── clients/
│   │   └── anthropic.ts              # Extend with short description method
│   ├── prompts/
│   │   └── shortDescription.ts       # NEW: Prompt templates for descriptions
│   ├── inngest/
│   │   └── functions/
│   │       └── trackIngestion.ts     # Add short description step
│   └── observability/
│       └── langfuse.ts               # Existing (no changes needed)
├── scripts/
│   └── backfill-short-descriptions.ts  # NEW: Backfill script
└── tests/
    ├── contract/
    │   └── shortDescription.test.ts    # NEW: Schema/prompt validation
    └── integration/
        └── trackIngestionShortDesc.test.ts  # NEW: Pipeline integration

services/search-index/
├── src/
│   └── schema/
│       └── trackDocument.ts          # Add short_description field
└── tests/
    └── contract/
        └── trackDocument.test.ts     # Update schema tests
```

**Structure Decision**: Extends existing worker service structure. Minimal new files - primarily adds a step to existing pipeline and a standalone backfill script.

## Complexity Tracking

> No constitution violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | - | - |
