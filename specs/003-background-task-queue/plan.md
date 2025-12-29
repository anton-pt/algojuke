# Implementation Plan: Background Task Queue Infrastructure

**Branch**: `003-background-task-queue` | **Date**: 2025-12-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-background-task-queue/spec.md`

## Summary

Implement the background task queue infrastructure using Inngest to support durable execution of asynchronous workflows. The system will provide multi-step pipeline capabilities, automatic retries with exponential backoff, rate limiting, and comprehensive observability through Inngest's built-in dashboard. The Inngest server will run locally in Docker, with TypeScript-based functions. A simple placeholder demonstration task will validate the infrastructure is working correctly. **Note**: Actual track enrichment implementation (metadata fetching, lyrics, embeddings) will be delivered in a follow-up feature.

## Technical Context

**Language/Version**: TypeScript 5.3.3 / Node.js 20.x
**Primary Dependencies**:
- Inngest TypeScript SDK (latest)
- Zod 3.x (schema validation)
- Docker (for Inngest Dev Server)
- Express or Next.js (function serving)

**Storage**: PostgreSQL (via existing TypeORM setup) + Inngest managed state store (SQLite for dev, PostgreSQL for production self-hosting)
**Testing**: Vitest 1.x + @inngest/test package for function testing
**Target Platform**: Local development (Docker), Node.js server environment
**Project Type**: Web (backend service + Inngest functions service)
**Performance Goals**:
- 10,000 tasks/day minimum throughput
- <500ms task submission latency
- 95% task completion within 24 hours
- 10 concurrent task executions (configurable)

**Constraints**:
- Local prototype (no authentication required)
- Inngest step data limit: <4MB total per function run
- Rate limits: Respect external API quotas (configurable per API)
- History retention: 30 days

**Scale/Scope**:
- Infrastructure prototype for local development
- Demonstrate capabilities with placeholder demo task
- Foundation for future background workflow implementations

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Check Results

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Test-First Development** | ✅ PASS | Contract tests for Inngest functions, integration tests for demo workflow, using @inngest/test package |
| **II. Code Quality Standards** | ✅ PASS | TypeScript with strict mode, ESLint, Inngest provides strong typing and idiomatic patterns |
| **III. User Experience Consistency** | ✅ PASS | User stories prioritized (P1-P3), asynchronous processing ensures no blocking operations |
| **IV. Robust Architecture** | ✅ PASS | Clear separation: main app → events → Inngest functions. Durable execution with automatic retry. Comprehensive observability via Inngest dashboard |
| **V. Security by Design** | ⚠️  ACCEPTABLE | Local prototype without authentication per FR-017. External API keys managed via environment variables. Production deployment would require authentication layer |

**Post-Design Re-check Notes**:
- Inngest's step-based architecture naturally enforces separation of concerns
- Event-driven design provides clear boundaries between components
- Built-in observability satisfies monitoring requirements

## Project Structure

### Documentation (this feature)

```text
specs/003-background-task-queue/
├── plan.md              # This file
├── research.md          # Phase 0: Comprehensive Inngest research
├── data-model.md        # Phase 1: Entity definitions
├── quickstart.md        # Phase 1: Setup and development guide
├── contracts/           # Phase 1: Event schemas and API contracts
│   ├── events.ts        # Inngest event type definitions
│   └── api.openapi.yaml # REST API for task queries (if needed)
└── tasks.md             # Phase 2: Implementation tasks (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Background worker service (NEW)
services/
└── worker/
    ├── src/
    │   ├── inngest/
    │   │   ├── client.ts           # Inngest client configuration
    │   │   ├── functions/          # Function definitions
    │   │   │   ├── demoTask.ts     # Placeholder demo task (multi-step)
    │   │   │   └── index.ts        # Export all functions
    │   │   └── events.ts           # Event schemas (Zod)
    │   └── server.ts               # Express server to serve Inngest functions
    ├── tests/
    │   └── functions/              # Inngest function tests
    ├── Dockerfile
    ├── package.json
    └── tsconfig.json

# Main application (EXISTING - no changes for this feature)
backend/
└── ...
    # Note: Backend integration (sending events to Inngest)
    # will be implemented in follow-up feature

# Docker infrastructure (extends existing docker-compose.yml at root)
docker-compose.yml                  # Add Inngest Dev Server + worker service to existing composition

# Shared types (if needed)
packages/
└── shared/
    └── types/
        └── events.ts               # Shared event types
```

**Structure Decision**: Separate worker service for Inngest functions (per FR-010 requirement for separate service process). Main application sends events to Inngest, worker service processes them. Docker Compose orchestrates local development environment with Inngest Dev Server. Demo task demonstrates infrastructure capabilities without implementing actual business logic (track enrichment reserved for follow-up feature).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Separate worker service | FR-010 explicitly requires pipeline execution in separate service. Inngest functions need dedicated serving process | Running in main app would violate functional requirement and create coupling |
| Docker Compose for local dev | Inngest Dev Server + worker + main app + DB requires orchestration for developer experience | Manual process management would be error-prone and reduce productivity |

## Phase 0: Research & Decisions

**Status**: ✅ COMPLETED

**Research Document**: [research.md](./research.md)

### Key Decisions

| Decision Area | Choice | Rationale |
|--------------|--------|-----------|
| **Task Queue Platform** | Inngest | Provides all required features out-of-box: durable execution, step-based workflows, retry policies, rate limiting, observability UI, TypeScript-first SDK |
| **Event Schema Validation** | Zod | Runtime validation + TypeScript types, integrates natively with Inngest SDK |
| **Function Serving** | Express | Lightweight, familiar, sufficient for serving Inngest HTTP endpoints |
| **Local Development** | Docker Compose | Orchestrates Inngest Dev Server + worker service + PostgreSQL for complete local environment |
| **Retry Strategy** | Inngest built-in exponential backoff + custom `RetryAfterError` | Meets FR-005 requirements (5 retries over 24 hours) with ability to customize for rate limits |
| **Demo Task Design** | Multi-step placeholder with simulated delays and failures | Demonstrates all infrastructure capabilities (steps, retries, rate limiting) without implementing actual business logic |
| **Rate Limiting** | Inngest `throttle` configuration | Non-lossy smoothing, validated via demo task |
| **Concurrency** | Inngest `concurrency` configuration | Default 10 concurrent executions per FR-018 |
| **Deduplication** | Inngest `idempotency` with task ID | Prevents duplicate task executions per FR-014 |
| **Observability** | Inngest Dashboard + optional custom endpoints | Built-in UI satisfies FR-015, FR-016 monitoring and manual retry requirements |

### Technical Unknowns Resolved

1. **Question**: Can Inngest handle 30-day history retention (FR-006)?
   **Resolution**: Inngest persists function run history in its managed database (SQLite for dev, PostgreSQL for production self-hosting). History retention is **unlimited by default** - no automatic cleanup occurs. For FR-006's 30-day requirement: (1) Local prototype accumulates history indefinitely in SQLite, (2) Production deployments can implement custom cleanup queries if needed, (3) **For this infrastructure feature, unlimited retention is acceptable** - cleanup job deferred to production deployment planning.

2. **Question**: How to implement pipeline version migration (FR-019)?
   **Resolution**: Inngest functions execute with latest code immediately upon deployment. Step memoization (by step ID hash based on step name) allows safe migration if step names remain consistent. Changed/removed steps will re-execute. **FR-019 is satisfied automatically by Inngest** - in-flight tasks continue with new code, successful steps memoized via consistent naming.

3. **Question**: Can we query task status via API (FR-007)?
   **Resolution**: **FR-007 is satisfied by Inngest REST API**. Inngest provides comprehensive REST API to query function runs by event ID, function ID, time range, and status. API returns run details including status, output, timing, error details, and step execution history. Equivalent to custom query endpoint without additional implementation. Dashboard UI also provides manual querying via filters.

4. **Question**: How to handle intermediate result persistence (FR-003)?
   **Resolution**: Inngest automatically persists each step's return value to managed state store. Successful steps never re-execute. <4MB total limit for all step data.

5. **Question**: How to track rate limit consumption and pause processing (FR-009)?
   **Resolution**: **FR-009 is satisfied automatically by Inngest's throttle configuration**. When `throttle` is configured with `limit` and `period`, Inngest's execution engine automatically tracks consumption and queues excess function runs until the throttle window resets. No custom consumption tracking or pausing logic needed - throttle is non-lossy (queued runs execute when capacity available).

6. **Question**: How to enforce typed step inputs/outputs (FR-012)?
   **Resolution**: **FR-012 is satisfied by TypeScript + Zod schemas**. Event schemas defined with Zod provide runtime validation for function inputs. TypeScript strict mode enforces compile-time type safety for step inputs/outputs. Inngest SDK provides typed step.run() helpers that leverage TypeScript's type inference for step return values.

## Phase 1: Design & Contracts

### Data Model

See [data-model.md](./data-model.md) for complete entity definitions.

**Key Entities**:
- **Inngest Event**: `demo/task.requested` (placeholder demonstration event)
- **Demo Task** (Inngest Function Run): Managed by Inngest, queryable via API
- **Demo Result** (Step Output): Stored in Inngest state for demonstration

**Note**: Data model focuses on infrastructure demonstration. Actual domain entities (Track enrichment) will be defined in follow-up feature.

### API Contracts

See [contracts/](./contracts/) for complete schemas.

**Event Schemas** (`contracts/events.ts`):
- `demo/task.requested`: Trigger demonstration multi-step task
- `demo/task.completed`: Task successfully finished
- `demo/task.failed`: Task permanently failed

**REST API** (Optional, for querying Inngest):
- `GET /api/tasks/:taskId/status`: Get task status
- `POST /api/tasks/:taskId/retry`: Manually retry failed task

### Quick start Guide

See [quickstart.md](./quickstart.md) for complete setup instructions.

**Quick Start Summary**:
1. Start services: `docker-compose up`
2. Install dependencies: `cd services/worker && npm install`
3. Access Inngest UI: http://localhost:8288
4. Trigger demo task: Send `demo/task.requested` event **via Inngest UI** (no backend integration needed)
5. Monitor multi-step execution, retries, and observability features in Inngest dashboard

**Note**: Demo task triggered directly from Inngest UI for infrastructure validation. Backend service integration deferred to follow-up feature.

## Architecture Overview

```
┌─────────────────┐
│  Main App       │
│  (backend/)     │
│                 │
│  User adds track│
│  to library     │
└────────┬────────┘
         │
         │ 1. Send event: track/enrichment.requested
         ▼
┌─────────────────────────────────────────┐
│     Inngest Platform (Docker)           │
│                                         │
│  ┌────────────────────────────────┐   │
│  │  Durable Execution Engine      │   │
│  │  - Event routing               │   │
│  │  - Step orchestration          │   │
│  │  - Retry management            │   │
│  │  - State persistence           │   │
│  └──────────────┬─────────────────┘   │
│                 │                       │
│  ┌──────────────▼─────────────────┐   │
│  │  Built-in Dashboard (UI)       │   │
│  │  - Function runs               │   │
│  │  - Event logs                  │   │
│  │  - Metrics & monitoring        │   │
│  │  - Manual replay               │   │
│  └────────────────────────────────┘   │
└────────────┬────────────────────────────┘
             │
             │ 2. HTTP request to execute function
             ▼
┌──────────────────────────────────────────┐
│   Worker Service (services/worker/)      │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  Inngest Functions                 │ │
│  │                                    │ │
│  │  demoTask():                       │ │
│  │    step 1: Simulate processing    │ │
│  │    step 2: Simulate delay          │ │
│  │    step 3: Simulate API call       │ │
│  │    step 4: Demonstrate retry       │ │
│  │    step 5: Return result           │ │
│  │                                    │ │
│  │  (Each step independently retried) │ │
│  └──────────┬─────────────────────────┘ │
│             │                            │
│  ┌──────────▼─────────────────────────┐ │
│  │  Placeholder Implementations       │ │
│  │  - Simulated delays                │ │
│  │  - Mock API responses              │ │
│  │  - Configurable failure scenarios  │ │
│  └────────────────────────────────────┘ │
└──────────────────────────────────────────┘

Note: Actual external APIs (metadata, lyrics, etc.)
will be integrated in follow-up feature implementation
```

**Flow** (Infrastructure Validation):
1. User triggers demo via Inngest UI → Sends `demo/task.requested` event
2. Inngest receives event → Routes to `demoTask` function → Calls worker service via HTTP
3. Worker service executes function step-by-step, with Inngest managing state between steps
4. Each step (simulate processing, delays, failures) executes independently with automatic retry
5. Inngest applies rate limiting/throttling per configuration
6. Step results persisted to Inngest state store
7. On completion, worker optionally sends `demo/task.completed` event
8. Monitor entire workflow in Inngest dashboard (no custom UI needed for this feature)

**Key Design Principles**:
- **Event-Driven**: All workflows triggered by events, enabling decoupling
- **Durable Steps**: Each step is a checkpoint, failures don't lose progress
- **Idempotent Operations**: Steps designed for safe retry
- **Infrastructure Validation**: Demo task proves all capabilities work without implementing domain logic
- **Foundation for Future**: Clean architecture ready for actual workflow implementations

### Edge Case Handling

**How Infrastructure Addresses Specification Edge Cases**:

1. **Permanent Step Failure**:
   - **Inngest Solution**: Automatic retry with exponential backoff (FR-005: 5 retries over 24 hours)
   - **Demo Validation**: `simulateFailure: true` with `failAtStep` parameter triggers permanent failure scenario
   - **Observable Outcome**: Dashboard shows Failed status with error details and retry attempt history

2. **Corrupted Step Output**:
   - **TypeScript + Zod Solution**: Event schemas validated at runtime, step outputs typed at compile-time
   - **Inngest Behavior**: Invalid step output throws error, triggers step retry (not entire function retry)
   - **Demo Validation**: Zod schemas in `events.ts` enforce data contracts

3. **Workflow Version Migration** (FR-019):
   - **Inngest Solution**: Step memoization uses content-based hashing of step name
   - **Migration Behavior**: Successful steps with consistent names reuse memoized outputs; renamed/new steps re-execute
   - **Demo Validation**: Code changes during demo task execution demonstrate migration without data loss

4. **Queue Backpressure**:
   - **Inngest Solution**: Automatic queuing beyond concurrency limit (FR-018: 10 concurrent)
   - **Priority Handling**: Tasks with higher priority modifiers (-600 to +600) execute before lower priority
   - **Observable Outcome**: Dashboard metrics show pending queue depth and throughput rate

5. **Duplicate Task Prevention** (FR-014):
   - **Inngest Solution**: Idempotency configuration with 24-hour window keyed by `taskId`
   - **Override Mechanism**: Event data supports `force: true` to bypass idempotency check
   - **Demo Validation**: Sending identical `taskId` within 24 hours prevents duplicate execution

## Implementation Phases

### Phase 2: Task Generation (via /speckit.tasks)

The `/speckit.tasks` command will generate detailed implementation tasks in `tasks.md` based on this plan. Tasks will be organized by priority and dependency order.

**Expected Task Categories**:
1. **Infrastructure Setup** (P1)
   - Docker Compose configuration
   - Inngest Dev Server setup
   - Worker service scaffolding

2. **Core Function Implementation** (P1)
   - Inngest client configuration
   - Event schema definitions (Zod)
   - Demo task function with multi-step workflow
   - Simulated delays and configurable failure scenarios

3. **Testing** (P1)
   - Function tests with @inngest/test
   - Integration tests for demo workflow
   - Test retry behavior, rate limiting, concurrency

4. **Observability** (P2)
   - Query API for task status (optional)
   - Dashboard validation
   - Metrics verification

5. **Documentation** (P2)
   - Setup instructions
   - Demo task usage guide
   - Architecture documentation for future implementers

**Note**: Tasks related to actual track enrichment (metadata APIs, lyrics, embeddings, DB operations) are explicitly excluded and will be defined in follow-up feature.

## Next Steps

1. **Run `/speckit.tasks`** to generate implementation task breakdown
2. **Implement tasks in priority order** (P1 → P2 → P3)
3. **Test each user story independently** per constitution requirements
4. **Validate success criteria** from specification

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Inngest step data >4MB limit | High | Store references (URLs, IDs) instead of large payloads; use external storage (S3) for large data |
| External API rate limits exceeded | Medium | Conservative throttle configuration; monitor Inngest metrics for limit hits |
| Pipeline version migration breaks in-flight tasks | Medium | Use consistent step naming; test migrations in dev; implement version conditionals if needed |
| 30-day retention not enforced by Inngest | Low | Implement cleanup job if needed; verify retention behavior in production self-hosting |
| Vendor lock-in to Inngest | Low | Inngest offers self-hosting option; abstraction layer could be added if needed |

## Success Validation

After implementation, verify infrastructure capabilities:

**Infrastructure Validation**:
- ✅ **Demo task execution**: Multi-step workflow completes successfully
- ✅ **Step independence**: Individual steps can be retried without re-executing successful steps
- ✅ **Retry mechanism**: Failed steps retry with exponential backoff (observable in dashboard)
- ✅ **State persistence**: Tasks survive service restarts (durable execution)
- ✅ **Rate limiting**: Throttle configuration prevents excessive execution
- ✅ **Concurrency control**: Concurrent execution limits are enforced
- ✅ **Idempotency**: Duplicate events are detected and deduplicated
- ✅ **Observability**: Dashboard shows task status, step progress, errors, and metrics
- ✅ **Manual replay**: Failed tasks can be manually retried via dashboard
- ✅ **Performance**: Task submission completes in <500ms

**Ready for Production Workflows**:
- Architecture proven with demo task
- Foundation ready for actual business logic implementation
- All FR requirements validated through infrastructure demonstration

---

**Plan Status**: ✅ Complete - Ready for task generation via `/speckit.tasks`
