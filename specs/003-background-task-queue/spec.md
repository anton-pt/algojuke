# Feature Specification: Background Task Queue Infrastructure

**Feature Branch**: `003-background-task-queue`
**Created**: 2025-12-29
**Status**: Draft
**Input**: User description: "Infrastructure for queueing background tasks such as ingestion of music tracks from the user's library to gather more comprehensive metadata and embeddings of lyrics. The queueing infrastructure should support scheduling of background tasks and durable execution to drive these tasks to completion by retrying steps in case of failures. It should offer observability of tasks in flight and previous invocations. It should support queueing and rate limiting of steps to avoid hitting rate limits on downstream APIs. The infrastructure should support persistent storage of the background tasks so that they can be resumed if the supporting infrastructure is restarted. Furthermore, intermediate results of steps in the ingestion pipeline should be persisted to avoid repeating expensive API calls in case of failures. Ingestion pipelines should be defined in code that runs in a separate service from the main application."

## Clarifications

### Session 2025-12-29

- Q: Administrator authentication model for observability interface? → A: No authentication - this is a local prototype not intended for internet deployment, accessible without access control
- Q: Task history retention period? → A: 30 days
- Q: Duplicate task handling strategy? → A: Deduplicate on submission - infrastructure detects existing queued/in-progress tasks for same track and prevents duplicate creation, but allows application to override and force rerun if needed
- Q: Worker concurrency model? → A: 10 concurrent tasks
- Q: Pipeline version migration strategy? → A: Migrate in-flight tasks to new pipeline version when code changes - local service runs latest code immediately, cannot preserve old pipeline snapshots

## Implementation Scope

**IMPORTANT**: This feature implements **ONLY the background task queue infrastructure** with a placeholder demonstration task. Actual track enrichment implementation (metadata fetching, lyrics API integration, embeddings generation) is **deferred to a follow-up feature**.

The demo task validates all infrastructure capabilities (multi-step workflows, retries, rate limiting, observability) without implementing business logic. This allows the infrastructure to be tested and validated independently before adding domain-specific enrichment workflows.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Infrastructure Validation via Demo Task (Priority: P1)

A developer needs to validate that the background task infrastructure correctly handles multi-step workflows with durable execution, automatic retries, and state persistence. A placeholder demo task with configurable failure scenarios demonstrates these capabilities without requiring external API integrations.

**Why this priority**: This validates the core infrastructure capabilities - durable execution, retry logic, and step memoization. Without this working, actual enrichment workflows cannot be reliably implemented.

**Independent Test**: Can be fully tested by triggering demo tasks via Inngest UI with various configurations (success, simulated failures), observing multi-step execution in dashboard, and verifying durable execution survives service restarts. Delivers value by proving infrastructure readiness for future enrichment workflows.

**Acceptance Scenarios**:

1. **Given** a demo task is triggered via Inngest UI, **When** all 5 steps execute successfully, **Then** the Inngest dashboard shows completed status with all step outputs and total duration
2. **Given** a demo task is configured to fail at step 4, **When** the task executes and fails, **Then** the system automatically retries with exponential backoff and steps 1-3 are not re-executed (memoized)
3. **Given** a demo task has partially completed steps 1-3, **When** the worker service restarts, **Then** the task resumes from step 4 without re-executing completed steps

---

### User Story 2 - Validate Observability Dashboard (Priority: P2)

A developer needs to validate that the Inngest dashboard provides comprehensive observability for background tasks, including status tracking, error inspection, step-by-step execution traces, and manual retry capability.

**Why this priority**: Observability is critical for debugging and operational monitoring, but infrastructure execution can be validated without extensive dashboard documentation in MVP.

**Independent Test**: Can be tested by triggering multiple demo tasks with various configurations, navigating the Inngest dashboard to inspect runs, viewing waterfall traces, and manually replaying failed tasks. Delivers value by proving operational visibility without custom UI implementation.

**Acceptance Scenarios**:

1. **Given** multiple demo tasks are queued, **When** developer views Inngest dashboard Functions tab, **Then** they see each task's current status (Running, Completed, Failed), start time, and duration
2. **Given** a demo task has failed after retries, **When** developer views task run details, **Then** they see the error message, which step failed, waterfall trace showing retry attempts, and step-by-step outputs
3. **Given** demo tasks completed in the past, **When** developer filters runs by date range and status, **Then** they can audit task execution history and identify patterns
4. **Given** a demo task has permanently failed, **When** developer clicks Replay button in Inngest UI, **Then** the task re-executes with same event payload and attempts completion again

---

### User Story 3 - Validate Rate Limiting Infrastructure (Priority: P3)

The infrastructure needs to demonstrate throttle configuration capabilities to ensure future enrichment workflows can respect external API rate limits without manual intervention.

**Why this priority**: Rate limiting is important for production workflows but can be validated at small scale in infrastructure demo without actual API integrations.

**Independent Test**: Can be tested by configuring throttle limits on demo tasks (e.g., 10 tasks per minute), queuing 30 demo tasks rapidly via Inngest UI, then observing in dashboard metrics that execution rate respects configured limits with tasks queuing appropriately. Delivers value by proving throttle infrastructure works before adding real API calls.

**Acceptance Scenarios**:

1. **Given** a throttle limit of 10 executions per minute is configured on demo task, **When** 30 demo tasks are queued simultaneously, **Then** the Inngest metrics show execution rate stays at ~10/minute until all tasks complete
2. **Given** demo task has throttle configuration applied, **When** tasks execute, **Then** excess tasks queue and wait for throttle window to open rather than executing immediately
3. **Given** the system is restarted with queued throttled tasks, **When** services resume, **Then** throttle limits continue to apply correctly without burst execution

---

### Edge Cases

**Note**: Edge cases describe infrastructure behavior applicable to future workflows. Demo task validates these behaviors through simulation.

- **Permanent step failure**: What happens when a step fails permanently (e.g., simulated failure without resolution)? System marks demo task as permanently failed after 5 retry attempts per FR-005, visible in dashboard with error details. Validated via `simulateFailure: true` configuration.
- **Corrupted step output**: How does system handle invalid step results? Inngest validates step outputs against TypeScript types; invalid data throws error triggering step retry. Demo task validates this via Zod schema validation on event data.
- **Workflow version migration** (FR-019): What happens when demo task code changes mid-execution? Inngest migrates in-flight tasks to new code version automatically, memoizing successful steps by name (hash-based ID) and re-executing changed steps. Validated by code changes during execution.
- **Queue backpressure**: How does system behave if queue grows faster than processing capacity? Inngest queues excess demo tasks beyond 10 concurrent limit, visible in dashboard metrics showing pending count. Priority configuration (FR-013) allows critical tasks to execute first.
- **Duplicate task prevention** (FR-014): What happens when duplicate demo tasks are submitted? Inngest's idempotency configuration (24-hour window, keyed by taskId) automatically deduplicates. Demo task supports `force: true` to override idempotency and force re-execution.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST persist queued tasks to durable storage so tasks survive system restarts
- **FR-002**: System MUST support defining multi-step pipelines where each step can be retried independently
- **FR-003**: System MUST persist intermediate results from each pipeline step to avoid repeating expensive operations on retry
- **FR-004**: System MUST support configurable retry policies with exponential backoff for transient failures
- **FR-005**: System MUST mark tasks as permanently failed after 5 automatic retry attempts over 24 hours using exponential backoff (5 minutes, 15 minutes, 1 hour, 4 hours, 14 hours)
- **FR-006**: System MUST record task execution history including start time, end time, status, and error details for completed and failed tasks, retaining history for 30 days before automatic deletion
- **FR-007**: System MUST support querying task status by task identifier, track identifier, date range, and status
- **FR-008**: System MUST enforce configurable rate limits per external API to prevent quota exhaustion
- **FR-009**: System MUST track rate limit consumption and pause processing when limits are approached
- **FR-010**: System MUST run pipeline execution in a separate service process from the main application
- **FR-011**: System MUST support scheduling tasks for delayed execution (e.g., retry in 5 minutes)
- **FR-012**: System MUST allow pipelines to be defined declaratively in code with typed step inputs/outputs
- **FR-013**: System MUST support task prioritization to process critical enrichments before bulk operations
- **FR-014**: System MUST detect existing queued or in-progress tasks for the same track and prevent duplicate task creation by default, while allowing the calling application to explicitly override deduplication to force a rerun when required
- **FR-015**: System MUST expose task metrics (queue depth, processing rate, failure rate) for monitoring
- **FR-016**: System MUST allow users to manually retry failed tasks from the point of failure through the observability interface
- **FR-017**: System is designed for local development/prototype use without authentication or access control (not intended for internet-facing deployment)
- **FR-018**: System MUST support configurable worker concurrency with a default of 10 concurrent task executions to balance throughput with local machine resource constraints
- **FR-019**: System MUST migrate in-flight tasks to new pipeline versions when pipeline code changes, reusing intermediate results from steps with matching names and re-executing steps that have been added or renamed

### Key Entities

**Note**: Entity descriptions use general terminology applicable to any background workflow. This infrastructure feature demonstrates these concepts via a placeholder demo task.

- **Demo Task** (Inngest Function): Represents a unit of background work with attributes including unique identifier (taskId), priority modifier, simulated failure configuration, execution status (Running/Completed/Failed), creation timestamp, and configuration for delays and failure scenarios
- **Multi-Step Workflow**: Defines a sequence of processing steps (demo task has 5 steps: initialize, process, simulate-delay, simulate-api-call, finalize) with configuration for retries, concurrency, and throttling
- **Step Execution**: Records the execution of a single workflow step with attributes including step name, execution status, start/end timestamps, input data, output data (memoized for successful steps), and error information if failed
- **Throttle Configuration**: Defines rate limiting rules with attributes including execution limit per time window, time window duration (e.g., "1m"), and throttle key for scoping limits

## Success Criteria *(mandatory)*

### Measurable Outcomes

**Note**: Success criteria focus on infrastructure validation. Production-scale metrics (SC-003, SC-004 percentages) are benchmarks for future enrichment workflows, not validated in this infrastructure-only feature.

- **SC-001**: Demo task submission via Inngest UI completes in under 500ms, with multi-step execution happening asynchronously
- **SC-002**: Demo tasks configured with 5 retry attempts complete successfully within 24 hours when transient failures are simulated (validates retry policy configuration)
- **SC-003**: *(Future Production Metric)* System architecture supports processing at least 10,000 tasks per day without performance degradation (validated via concurrency configuration of 10 concurrent executions, extrapolated throughput capacity)
- **SC-004**: Demo tasks with simulated failures retry with exponential backoff (5min, 15min, 1hr, 4hr, 14hr intervals), with successful recovery demonstrated after transient failure resolution
- **SC-005**: Throttle configuration prevents execution rate from exceeding configured limits (validated via demo task with 100 tasks/minute throttle configuration)
- **SC-006**: Worker service restarts result in zero lost demo tasks, with all queued and in-progress tasks resuming automatically (validates durable execution)
- **SC-007**: Demo tasks with simulated failures at specific steps do not re-execute successful steps on retry (validates step memoization preventing duplicate work)
- **SC-008**: Developers can identify failed demo tasks and root causes within 2 minutes via Inngest dashboard (validates observability interface)
- **SC-009**: Demo task queue depth and processing metrics (throughput, concurrency, failure rate) are visible in real-time via Inngest dashboard metrics tab
