# Implementation Plan: Track Ingestion Pipeline

**Branch**: `006-track-ingestion-pipeline` | **Date**: 2025-12-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-track-ingestion-pipeline/spec.md`

## Summary

Implement a music track ingestion pipeline as an Inngest function that receives track ISRC and metadata, fetches audio features from ReccoBeats API, retrieves lyrics from Musixmatch API, generates a thematic interpretation using Claude Sonnet 4.5 via Vercel AI SDK, embeds the interpretation using TEI (Docker/CPU) with Qwen3-Embedding-8B, and stores the complete document in Qdrant. All operations are traced via Langfuse.

## Technical Context

**Language/Version**: TypeScript 5.3.3 / Node.js 20.x
**Primary Dependencies**: Inngest 3.22.12, Vercel AI SDK (`ai`, `@ai-sdk/anthropic`), Zod 3.x, axios 1.6+
**Storage**: Qdrant (vector index), Inngest (step memoization)
**Testing**: Vitest 1.x
**Target Platform**: Local development (macOS, Docker)
**Project Type**: Services-based monorepo
**Performance Goals**: <60s end-to-end ingestion, ~10 vectors/minute throughput
**Constraints**: TEI runs in Docker (CPU-only), Musixmatch API rate limits (2000 req/day on free tier)
**Scale/Scope**: Local prototype, up to 10,000 tracks

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First Development | ✅ PASS | Contract tests for API clients, integration tests for pipeline steps |
| II. Code Quality Standards | ✅ PASS | Follows existing patterns in services/worker, no unnecessary complexity |
| III. User Experience Consistency | ✅ PASS | N/A - background pipeline, no user-facing UI |
| IV. Robust Architecture | ✅ PASS | Inngest provides durable execution, Langfuse provides observability, graceful degradation for missing data |
| V. Security by Design | ✅ PASS | API keys in environment variables, input validation via Zod |
| Development Workflow | ✅ PASS | Feature branch workflow, spec-first approach |
| Quality Gates | ✅ PASS | Tests required, observability built-in |

## Project Structure

### Documentation (this feature)

```text
specs/006-track-ingestion-pipeline/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0: API research, TEI configuration
├── data-model.md        # Phase 1: Entity definitions
├── quickstart.md        # Phase 1: Setup and running guide
├── contracts/           # Phase 1: Event schemas, API contracts
└── tasks.md             # Phase 2: Implementation tasks
```

### Source Code (repository root)

```text
services/worker/
├── src/
│   ├── inngest/
│   │   ├── client.ts                    # Existing Inngest client
│   │   ├── events.ts                    # Extended with ingestion events
│   │   └── functions/
│   │       ├── demoTask.ts              # Existing demo task
│   │       ├── trackIngestion.ts        # NEW: Main ingestion pipeline
│   │       └── index.ts                 # Function registry
│   ├── clients/                         # NEW: External API clients
│   │   ├── reccobeats.ts                # ReccoBeats audio features
│   │   ├── musixmatch.ts                # Musixmatch lyrics
│   │   ├── anthropic.ts                 # Vercel AI SDK wrapper
│   │   └── tei.ts                       # TEI embedding client
│   ├── prompts/                         # NEW: LLM prompts
│   │   └── lyricsInterpretation.ts      # Interpretation prompt
│   └── server.ts                        # Existing Express server
├── tests/
│   ├── contract/                        # NEW: API client contracts
│   │   ├── reccobeats.test.ts
│   │   ├── musixmatch.test.ts
│   │   └── tei.test.ts
│   └── integration/                     # NEW: Pipeline integration
│       └── trackIngestion.test.ts
└── package.json                         # Updated dependencies

docker-compose.yml                       # Extended with TEI service
```

**Structure Decision**: Extends existing `services/worker` service with new API clients and the ingestion function. Clients are placed in `src/clients/` to separate external API concerns from Inngest function logic. Prompts are stored in `src/prompts/` for maintainability.

## Complexity Tracking

> No violations - implementation follows existing patterns and simplest approach.

| Aspect | Approach | Rationale |
|--------|----------|-----------|
| LLM Integration | Vercel AI SDK | Per user input - simpler than direct Anthropic SDK |
| Prompt Storage | In-code (not Langfuse) | Per user input - simpler for local prototype |
| TEI Deployment | Docker CPU | Per user input - simpler than native Metal build, acceptable for ~10 vectors/min |
| API Clients | Simple axios wrappers | No need for complex retry logic - Inngest handles step retries |
