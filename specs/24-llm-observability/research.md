# Research: LLM Observability Infrastructure

**Feature**: 005-llm-observability
**Date**: 2025-12-29

## Decision Summary

| Topic | Decision | Rationale |
|-------|----------|-----------|
| Observability Platform | Langfuse v3 (self-hosted) | Purpose-built LLM observability with native prompt/completion tracking, open-source, Docker-compatible |
| LLM Provider | Anthropic Claude 4.x | Primary target for instrumentation; Vercel AI SDK integration planned for follow-up features |
| Docker Architecture | Separate compose file (docker-compose.langfuse.yml) | Modular approach, includes command in main compose file |
| SDK Choice | @langfuse/tracing + @langfuse/otel + @opentelemetry/sdk-node | OpenTelemetry-based, compatible with Vercel AI SDK |

## Research Findings

### 1. Langfuse Docker Deployment

**Decision**: Use Langfuse v3 with separate docker-compose.langfuse.yml file, referenced from main docker-compose.yml via `include` directive.

**Rationale**:
- Langfuse v3 provides the latest features including Claude 4 model support and cost tracking
- Separate compose file keeps infrastructure modular and maintainable
- Langfuse requires: PostgreSQL, Redis, ClickHouse, MinIO (S3-compatible storage)
- Self-hosted TypeScript SDK v4 requires Langfuse platform version >= 3.95.0

**Alternatives Considered**:
- Single docker-compose.yml: Rejected due to complexity; algojuke already has its own postgres service
- OpenTelemetry + Jaeger: Rejected; lacks native LLM-specific features (prompt/completion tracking, token counting, cost tracking)

**Implementation Notes**:
- Langfuse needs its own PostgreSQL instance (separate from algojuke-postgres) to avoid schema conflicts
- Use `langfuse-` prefix for all Langfuse-related container names
- Configure environment variables for local development (simplified secrets, localhost URLs)
- Dashboard accessible at http://localhost:3000

### 2. Langfuse Services Architecture

**Decision**: Deploy full Langfuse stack with 5 services: langfuse-web, langfuse-worker, clickhouse, minio, redis, postgres.

**Rationale**:
- langfuse-web: Web dashboard and API (port 3000)
- langfuse-worker: Background processing for trace ingestion (port 3030)
- clickhouse: Analytics database for high-volume trace storage
- minio: S3-compatible object storage for large payloads
- redis: Caching and queue management
- postgres: Relational data (users, projects, configs)

**Configuration for Local Development**:
- Simplified credentials (not production secrets)
- Bind to localhost for security where applicable
- Initialize default project with API keys for immediate use
- Use Docker volumes for data persistence

### 3. TypeScript SDK Integration

**Decision**: Use OpenTelemetry-based Langfuse SDK (@langfuse/tracing, @langfuse/otel, @opentelemetry/sdk-node).

**Rationale**:
- Native OpenTelemetry integration works with Vercel AI SDK
- Supports automatic context propagation for nested traces
- Compatible with any OTEL-instrumented library (HTTP, databases, etc.)
- Clean separation: instrumentation library in shared package, used by services

**SDK Installation**:
```bash
npm install @langfuse/tracing @langfuse/otel @opentelemetry/sdk-node
```

**Alternatives Considered**:
- Direct Langfuse client only: Rejected; OTEL approach provides better ecosystem integration
- LiteLLM proxy: Rejected; adds unnecessary complexity for this use case

### 4. Instrumentation Strategy

**Decision**: Create a shared observability service package (`services/observability/`) with wrapper utilities.

**Rationale**:
- Centralized configuration for Langfuse client
- Reusable wrappers for LLM calls, vector search, HTTP calls
- Consistent trace correlation across all services
- Non-blocking by design (failures don't impact application)

**Key Components**:
- `client.ts`: Langfuse client initialization with environment config
- `generation.ts`: LLM Generation span instrumentation (for Anthropic Claude via Vercel AI SDK)
- `search.ts`: Vector search span instrumentation (for Qdrant operations)
- `http.ts`: HTTP span instrumentation for external API calls
- `context.ts`: Trace correlation utilities

**Note**: The actual LLM and vector search instrumentation will be used by follow-up features (ingestion pipeline, playlist generation). This feature focuses on infrastructure setup.

### 5. Environment Configuration

**Decision**: Use environment variables with sensible local defaults.

**Required Variables** (with local defaults):
```env
# Langfuse server
LANGFUSE_BASE_URL=http://localhost:3000

# Langfuse API keys (auto-generated or set via init)
LANGFUSE_PUBLIC_KEY=pk-lf-local-dev
LANGFUSE_SECRET_KEY=sk-lf-local-dev

# Internal services (for docker-compose)
LANGFUSE_DATABASE_URL=postgresql://langfuse:langfuse@langfuse-postgres:5432/langfuse
LANGFUSE_REDIS_HOST=langfuse-redis
LANGFUSE_CLICKHOUSE_URL=http://langfuse-clickhouse:8123
```

### 6. Network Configuration

**Decision**: Langfuse services join the existing `algojuke-network` for inter-service communication.

**Rationale**:
- Allows future services to connect to Langfuse via internal network
- Consistent with existing docker-compose networking
- External access only through localhost:3000 (dashboard)

### 7. Data Retention

**Decision**: Configure 1-week retention policy for trace data.

**Rationale**:
- Local prototype for personal use doesn't need long-term retention
- Prevents excessive storage consumption over time
- Configured in Langfuse via environment variable or settings

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| @langfuse/tracing | ^1.x | Core tracing functions |
| @langfuse/otel | ^1.x | LangfuseSpanProcessor for OTEL export |
| @opentelemetry/sdk-node | ^0.57.x | OpenTelemetry Node.js SDK |
| zod | ^3.x | Schema validation (already in project) |

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Langfuse services consume significant resources | Set resource limits in docker-compose; use dev-appropriate settings |
| PostgreSQL port conflict with algojuke-postgres | Use separate container with different port mapping (5433 internal only) |
| Complex multi-container startup | Use depends_on with health checks; document startup order |
| SDK version compatibility | Pin to Langfuse v3, SDK v4+; document version requirements |

## Sources

- [Langfuse TypeScript SDK Overview](https://langfuse.com/docs/observability/sdk/typescript/overview)
- [Langfuse TypeScript SDK Setup](https://langfuse.com/docs/observability/sdk/typescript/setup)
- [Langfuse TypeScript Instrumentation](https://langfuse.com/docs/observability/sdk/typescript/instrumentation)
- [Langfuse Anthropic Integration](https://langfuse.com/integrations/model-providers/anthropic)
- [Langfuse Vercel AI SDK Integration](https://langfuse.com/integrations/frameworks/vercel-ai-sdk)
- [Langfuse Docker Compose](https://github.com/langfuse/langfuse/blob/main/docker-compose.yml)
- [Langfuse Claude 4 Support](https://langfuse.com/changelog/2025-05-22-claude-4-support)
