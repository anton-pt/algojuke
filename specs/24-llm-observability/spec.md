# Feature Specification: LLM Observability Infrastructure

**Feature Branch**: `005-llm-observability`
**Created**: 2025-12-29
**Status**: Draft
**Input**: User description: "LLM observability infrastructure running locally inside Docker which can track LLM invocations, vector search results, and various external API calls. This will be used for the ingestion pipeline and for user queries that retrieve relevant tracks and generate playlists based on the search results."

## Clarifications

### Session 2025-12-29

- Q: Which observability platform approach should the infrastructure use? → A: Langfuse (open-source LLM observability platform with built-in prompt/completion tracking)
- Q: Which LLM provider will the instrumentation primarily target? → A: Anthropic Claude (Claude 4.x family)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Track LLM Invocations (Priority: P1)

As a developer working on the ingestion pipeline or query handling features, I need to see detailed logs of all LLM invocations including prompts, completions, token usage, latency, and model metadata so I can debug issues, optimize costs, and understand system behavior.

**Why this priority**: LLM invocations are the core intelligence layer of the system. Without visibility into LLM calls, debugging pipeline failures, understanding response quality, and optimizing costs would be nearly impossible.

**Independent Test**: Can be fully tested by making a sample LLM API call with the observability client and verifying the invocation appears in the dashboard with all captured metadata.

**Acceptance Scenarios**:

1. **Given** the observability infrastructure is running, **When** an LLM invocation is made through the instrumented client, **Then** the invocation details (prompt, completion, model, tokens, latency, timestamp) are captured and visible in the observability dashboard.
2. **Given** multiple LLM invocations have been recorded, **When** a developer views the observability dashboard, **Then** they can see a chronological list of invocations with filtering and search capabilities.
3. **Given** an LLM invocation fails with an error, **When** the error occurs, **Then** the error details including error type, message, and request context are captured for debugging.

---

### User Story 2 - Track Vector Search Operations (Priority: P2)

As a developer building the retrieval system, I need to see detailed logs of all vector search operations including query embeddings, search parameters, result counts, relevance scores, and latency so I can optimize search quality and performance.

**Why this priority**: Vector search is the retrieval mechanism that feeds relevant context to LLMs. Visibility into search operations is essential for tuning retrieval quality and identifying bottlenecks.

**Independent Test**: Can be fully tested by executing a vector search operation and verifying the search details appear in the observability dashboard with captured metadata.

**Acceptance Scenarios**:

1. **Given** the observability infrastructure is running, **When** a vector search is executed, **Then** the search details (query metadata, collection, result count, top scores, latency) are captured and visible in the dashboard.
2. **Given** a vector search returns results, **When** viewing the search trace, **Then** the developer can see the relevance scores and identifiers of returned documents.

---

### User Story 3 - Track External API Calls (Priority: P3)

As a developer integrating with external services (Tidal API, embedding services, etc.), I need to see logs of all external API calls including endpoints, request/response payloads, status codes, and latency so I can debug integration issues and monitor service health.

**Why this priority**: External APIs are dependencies that can fail or degrade. Tracking these calls provides visibility into integration health and helps diagnose issues originating outside the application.

**Independent Test**: Can be fully tested by making an external API call through the instrumented HTTP client and verifying the call details appear in the observability dashboard.

**Acceptance Scenarios**:

1. **Given** the observability infrastructure is running, **When** an external API call is made, **Then** the call details (endpoint, method, status, latency, request/response metadata) are captured and visible in the dashboard.
2. **Given** an external API call fails, **When** the failure occurs, **Then** the error details including HTTP status, error response, and retry attempts are captured.

---

### User Story 4 - View Correlated Traces (Priority: P4)

As a developer debugging end-to-end flows, I need to see correlated traces that link related operations (e.g., a user query → vector search → LLM invocation → response) so I can understand the full request lifecycle and identify where issues occur.

**Why this priority**: While individual operation tracking is valuable, understanding how operations relate to each other is essential for debugging complex flows and optimizing end-to-end performance.

**Independent Test**: Can be fully tested by executing a multi-step operation with trace correlation and verifying all steps appear linked in the observability dashboard.

**Acceptance Scenarios**:

1. **Given** multiple operations are executed as part of a single request, **When** they share a trace ID, **Then** they appear grouped together in the observability dashboard.
2. **Given** a trace contains multiple spans, **When** viewing the trace, **Then** the developer can see the timing breakdown and parent-child relationships between operations.

---

### Edge Cases

- What happens when the observability infrastructure is unavailable? The application should continue to function normally; observability is non-blocking.
- What happens when trace volume is very high? The system should handle high throughput without significantly impacting application performance.
- How is storage managed over time? For local development, storage can be cleared via Docker volume management or Langfuse dashboard retention settings. Data persists indefinitely by default.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a Docker-based observability stack that runs entirely locally alongside other infrastructure services.
- **FR-002**: System MUST capture LLM invocations with the following metadata: prompt text, completion text, model identifier, input tokens, output tokens, total tokens, latency (milliseconds), timestamp, and success/error status.
- **FR-003**: System MUST capture vector search operations with the following metadata: query identifier, collection name, search parameters (top_k, filters), result count, top relevance scores, latency, and timestamp.
- **FR-004**: System MUST capture external API calls with the following metadata: endpoint URL, HTTP method, request headers, request body, response status code, response body, latency, and timestamp.
- **FR-005**: System MUST support distributed trace correlation using trace IDs and span IDs that can be propagated across operations within a request lifecycle.
- **FR-006**: System MUST provide a web-based dashboard accessible at localhost for viewing and querying captured traces and spans.
- **FR-007**: System MUST provide instrumentation libraries/utilities that application code can use to record observations with minimal boilerplate.
- **FR-008**: Observability operations MUST be non-blocking; failures in the observability system must not cause application failures or significant latency increases (< 5ms overhead per operation).
- **FR-009**: System MUST persist trace data locally to survive container restarts using Docker volume mounts.
- **FR-010**: System MUST provide health check endpoints to verify infrastructure availability.
- **FR-011**: System SHOULD support data retention management to avoid excessive storage consumption. For local development, this is achieved via Docker volume management (`docker compose down -v`) or Langfuse dashboard settings (Project Settings → Data Retention).

### Key Entities

- **Trace**: A logical grouping of related operations representing an end-to-end request flow. Contains a unique trace ID and one or more spans.
- **Span**: An individual operation within a trace (LLM call, vector search, API call). Contains span ID, parent span ID (optional), operation type, timestamps, duration, status, and type-specific metadata.
- **Generation**: Langfuse's term for a specialized span representing LLM invocations. Contains prompt, completion, model identifier, and token metrics. (Also referred to as "LLM Span" in general observability contexts.)
- **Search Span**: Specialized span for vector search operations with query parameters and result metadata.
- **HTTP Span**: Specialized span for external API calls with request/response details.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Developers can view any captured operation in the observability dashboard within 5 seconds of its completion.
- **SC-002**: The instrumentation utilities add less than 5 milliseconds of latency overhead per operation.
- **SC-003**: Developers can query and filter traces by operation type, time range, status, and custom tags within the dashboard.
- **SC-004**: The observability stack starts alongside other Docker services with a single command (docker compose up).
- **SC-005**: Captured trace data persists across container restarts and is available upon restart.
- **SC-006**: Developers can correlate related operations (e.g., search + LLM call) through shared trace IDs visible in the dashboard.

## Scope & Constraints

### In Scope

- Docker-based local observability infrastructure
- Instrumentation utilities for TypeScript/Node.js applications
- Web dashboard for viewing traces and spans
- Support for LLM (Generation), vector search, and HTTP span types
- Data persistence via Docker volumes with 1-week retention

### Out of Scope

- Cloud deployment or production-grade scaling
- Public internet accessibility
- Multi-tenant or team features
- Long-term retention policies or data archival
- Alerting or anomaly detection
- Integration with external observability platforms (Datadog, New Relic, etc.)
- Actual implementation of ingestion pipeline or query handling (these are follow-up features)

## Assumptions

- The observability infrastructure will be used exclusively for local development and prototyping.
- Developers have Docker and Docker Compose available in their development environment.
- The existing docker-compose.yml will be extended to include the observability services.
- Langfuse will be used as the observability platform, providing native LLM tracing, prompt/completion tracking, and a built-in web dashboard.
- Primary LLM provider is Anthropic Claude (Claude 4.x family); instrumentation will target Claude's API format and token counting.
- Token counts for LLM calls will be provided by the Anthropic SDK or API response (input_tokens, output_tokens).
- Vector search relevance scores are available from the Qdrant client response.
- Langfuse's trace/span model will be used for correlation (compatible with OpenTelemetry concepts).
