# Implementation Plan: LLM Observability Infrastructure

**Branch**: `005-llm-observability` | **Date**: 2025-12-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-llm-observability/spec.md`

## Summary

Implement Docker-based LLM observability infrastructure using Langfuse v3 for local development. The infrastructure enables tracking of LLM invocations, vector search operations, and external API calls with trace correlation. This provides the foundation for observability in the upcoming ingestion pipeline and playlist generation features.

**Technical Approach**: Deploy Langfuse as a separate docker-compose file (`docker-compose.langfuse.yml`) included from the main `docker-compose.yml`. Create a shared observability service package with TypeScript utilities for instrumentation using the Langfuse SDK directly (simplified from initial OpenTelemetry-based approach for better DX and reduced complexity).

## Technical Context

**Language/Version**: TypeScript 5.3.3 / Node.js 20.x
**Primary Dependencies**: langfuse (^3.x), zod (^3.x), dotenv (^16.x)
**Storage**: Langfuse-managed (PostgreSQL, ClickHouse, MinIO, Redis) - all in Docker
**Testing**: Vitest 1.x (contract tests, integration tests)
**Target Platform**: Local Docker environment (macOS/Linux)
**Project Type**: Multi-service (services/observability as new shared package)
**Performance Goals**: <5ms instrumentation overhead per operation; 100+ ops/sec throughput
**Constraints**: Local-only deployment; no cloud/public internet; non-blocking observability
**Scale/Scope**: Single developer local environment; ~6 new Docker containers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First Development | PASS | Contract tests for SDK wrappers; integration tests for Docker setup |
| II. Code Quality Standards | PASS | Simplicity: use existing Langfuse SDK; no over-engineering |
| III. User Experience Consistency | PASS | Developers can access dashboard immediately after `docker compose up` |
| IV. Robust Architecture | PASS | Non-blocking design; graceful degradation if Langfuse unavailable |
| V. Security by Design | PASS | Local-only; secrets in env vars; no credentials in code |

**Post-Design Check**: All principles satisfied. Observability logging aligns with IV. Robust Architecture guidance.

## Project Structure

### Documentation (this feature)

```text
specs/005-llm-observability/
├── plan.md              # This file
├── research.md          # Research findings (completed)
├── data-model.md        # Entity definitions (completed)
├── quickstart.md        # Developer guide (completed)
├── contracts/           # TypeScript interfaces (completed)
│   ├── observability-config.ts
│   └── span-types.ts
└── tasks.md             # Implementation tasks (created by /speckit.tasks)
```

### Source Code (repository root)

```text
# Docker configuration
docker-compose.yml               # Updated: includes docker-compose.langfuse.yml
docker-compose.langfuse.yml      # NEW: Langfuse stack (6 services)

# Observability service package
services/observability/
├── src/
│   ├── config.ts               # Configuration from env (Zod validation)
│   ├── client.ts               # Langfuse client initialization
│   ├── generation.ts           # LLM Generation span wrapper
│   ├── search.ts               # Vector search span wrapper
│   ├── http.ts                 # HTTP span wrapper
│   ├── context.ts              # Trace correlation utilities
│   ├── schemas/                # Zod schemas for span types
│   └── index.ts                # Public exports
├── tests/
│   ├── contract/               # Schema validation tests
│   └── integration/            # Docker integration tests
├── scripts/                    # Demo scripts
├── package.json
├── tsconfig.json
└── README.md

# Environment configuration
.env.example                     # Updated: Langfuse variables
```

**Structure Decision**: New `services/observability/` package following existing pattern from `services/worker/` and `services/search-index/`. Langfuse infrastructure in separate compose file for modularity.

## Complexity Tracking

> No violations requiring justification.

The implementation uses existing, well-documented patterns:
- Docker Compose include directive (standard Docker feature)
- Langfuse official Docker deployment configuration
- Langfuse SDK direct integration (simpler than OpenTelemetry wrapper)

| Decision | Rationale |
|----------|-----------|
| Separate compose file | Keeps Langfuse configuration isolated; easier to upgrade or remove |
| Separate Langfuse PostgreSQL | Avoids schema conflicts with algojuke-postgres |
| Direct Langfuse SDK | Simpler integration, better DX; OpenTelemetry can be added later if needed for Vercel AI SDK |

## Implementation Overview

### Phase 1: Infrastructure (Docker)

1. Create `docker-compose.langfuse.yml` with Langfuse services
2. Update `docker-compose.yml` to include Langfuse compose file
3. Configure environment variables with local defaults
4. Verify all services start and Langfuse dashboard is accessible

### Phase 2: Observability Service Package

1. Create `services/observability/` package structure
2. Implement configuration loading with Zod validation
3. Implement Langfuse client initialization with health check
4. Write contract tests for configuration
5. Write integration tests for health check

### Phase 3: Documentation & Validation

1. Update `.env.example` with Langfuse variables
2. Update `CLAUDE.md` with observability commands
3. Validate end-to-end: start services, send test trace, view in dashboard

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| langfuse | ^3.x | Langfuse SDK for tracing |
| zod | ^3.x | Configuration and schema validation |
| dotenv | ^16.x | Environment variable loading |
| vitest | ^1.x | Testing framework (dev) |
| tsx | ^4.x | TypeScript execution for demo scripts (dev) |

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Resource consumption from 6 new containers | Set memory limits; document requirements |
| Port conflicts (3000, 5432) | Use unique ports; bind Langfuse postgres internally only |
| Complex multi-service startup | Health checks with depends_on; startup order documented |
| SDK breaking changes | Pin to specific versions; document upgrade path |

## Artifacts Generated

- [x] research.md
- [x] data-model.md
- [x] quickstart.md
- [x] contracts/observability-config.ts
- [x] contracts/span-types.ts
- [x] tasks.md

## Next Steps

Run `/speckit.implement` to begin task execution.
