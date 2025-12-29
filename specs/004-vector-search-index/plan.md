# Implementation Plan: Vector Search Index Infrastructure

**Branch**: `004-vector-search-index` | **Date**: 2025-12-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-vector-search-index/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement vector search index infrastructure for music tracks using Qdrant vector database. The index supports hybrid search combining vector similarity (4096-dimensional embeddings from Qwen3-Embedding-8B) and BM25 keyword search across track metadata, lyrics, and AI-generated interpretations. Includes 11 optional audio features from reccobeats.com API. Infrastructure runs in Docker container with 4GB RAM / 2 CPU core limits. Provides index initialization scripts with test isolation. Ingestion pipeline implementation is explicitly out of scope.

## Technical Context

**Language/Version**: TypeScript 5.3.3 / Node.js 20.x
**Primary Dependencies**: Qdrant client library (qdrant-js), Zod (schema validation), Docker
**Storage**: Qdrant vector database (Docker container with volume persistence)
**Testing**: Vitest 1.x (contract and integration tests)
**Target Platform**: Local development environment (macOS/Linux with Docker)
**Project Type**: Single (infrastructure scripts and utilities)
**Performance Goals**: Vector search <500ms, keyword search <200ms for 10k documents
**Constraints**: 4GB RAM, 2 CPU cores (Docker limits); operates up to 100k track corpus
**Scale/Scope**: Index initialization, test utilities, schema definitions; ~500-1000 LOC estimated

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Test-First Development ✅
- **Contract tests**: Index schema validation, ISRC uniqueness, data type enforcement
- **Integration tests**: Docker container startup, index initialization, test data cleanup, vector/keyword search operations
- **Unit tests**: N/A (infrastructure scripts, no complex business logic)
- **Status**: COMPLIANT - Tests will be written before implementation scripts

### II. Code Quality Standards ✅
- **Simplicity First**: Direct Qdrant client usage, no unnecessary abstractions
- **Complexity Justification**: None required - straightforward infrastructure scripts
- **Linting**: TypeScript strict mode, ESLint
- **Clear Naming**: Index names, collection names, field names follow domain terminology
- **Status**: COMPLIANT - No complexity violations

### III. User Experience Consistency ✅
- **User-Centric Design**: Admin/developer personas from spec
- **Prioritization**: P1 (index creation), P2 (audio features), P1 (hybrid search)
- **Independent Validation**: Each user story has independent acceptance tests
- **Feedback and Errors**: Error logging for all operation failures (FR-013)
- **Status**: COMPLIANT - All UX requirements met

### IV. Robust Architecture ✅
- **Separation of Concerns**: Index schema (collection definition) separate from initialization scripts separate from test utilities
- **Error Handling**: Validation at system boundary (Qdrant API calls), error logging for failures
- **Observability**: Error logs for operation failures (minimal observability per clarification)
- **Data Integrity**: Schema validation via Qdrant, ISRC uniqueness constraint
- **Graceful Degradation**: N/A (infrastructure setup, not runtime service)
- **Status**: COMPLIANT - Architecture is simple and appropriate for scope

### V. Security by Design ✅
- **Input Validation**: Schema validation for all indexed documents
- **Authentication & Authorization**: N/A (local prototype, no network exposure per clarification)
- **Secrets Management**: N/A (no external credentials for Qdrant local instance)
- **OWASP Awareness**: N/A (no user input, no web exposure)
- **Status**: COMPLIANT - Security appropriate for local development infrastructure

### Overall Assessment: ✅ PASS
All constitution principles satisfied. No violations requiring justification in Complexity Tracking.

### Post-Design Re-evaluation: ✅ PASS
After completing Phase 1 design (data-model.md, contracts/, quickstart.md):
- Architecture remains simple: 3 TypeScript modules (schema, initIndex, testUtils) + tests
- No additional complexity introduced
- All contracts specify clear test requirements (contract + integration tests)
- Separation of concerns maintained (schema definition, initialization logic, test utilities)
- **Conclusion**: Constitution compliance confirmed. Ready for Phase 2 (task generation).

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
services/
└── search-index/              # NEW: Vector search index infrastructure
    ├── src/
    │   ├── schema/
    │   │   └── trackCollection.ts    # Qdrant collection schema definition
    │   ├── scripts/
    │   │   ├── initIndex.ts          # Index initialization (takes collection name param)
    │   │   └── testUtils.ts          # Test helpers (create/cleanup test index)
    │   └── client/
    │       └── qdrant.ts             # Qdrant client configuration
    ├── tests/
    │   ├── contract/
    │   │   └── schema.test.ts        # Schema validation, ISRC uniqueness, data types
    │   └── integration/
    │       ├── initialization.test.ts # Index init, Docker connectivity
    │       └── operations.test.ts     # Insert/update/search/retrieve operations
    ├── package.json
    ├── tsconfig.json
    └── vitest.config.ts

docker-compose.yml              # MODIFIED: Add Qdrant service
```

**Structure Decision**: Single project structure with new `services/search-index/` directory. This service contains only infrastructure scripts (no runtime server). Qdrant runs as Docker service defined in root `docker-compose.yml`. Test isolation achieved through test-specific collection names that are cleaned up after test execution.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No complexity violations. Constitution Check passed all gates.

---

## Planning Summary

### Artifacts Generated

✅ **Phase 0 - Research** (COMPLETED)
- [research.md](./research.md) - Qdrant best practices, schema design, performance tuning

✅ **Phase 1 - Design** (COMPLETED)
- [data-model.md](./data-model.md) - Qdrant collection schema, entities, query patterns
- [contracts/initIndex.contract.md](./contracts/initIndex.contract.md) - Index initialization contract
- [contracts/testUtils.contract.md](./contracts/testUtils.contract.md) - Test utilities contract
- [contracts/README.md](./contracts/README.md) - Contracts overview
- [quickstart.md](./quickstart.md) - Setup and usage guide
- [CLAUDE.md](../../CLAUDE.md) - Updated with TypeScript, Qdrant, Zod technologies

### Implementation Readiness

**Constitution Compliance**: ✅ All gates passed (pre and post-design)

**Technology Stack**:
- TypeScript 5.3.3 / Node.js 20.x
- Qdrant 1.7+ (Docker)
- qdrant-js client library
- Zod schema validation
- Vitest testing framework

**Architecture**:
- Single project (`services/search-index/`)
- 3 core modules: schema definition, initialization script, test utilities
- Contract tests (schema validation) + integration tests (Qdrant operations)
- Test isolation via temporary collections

**Performance Targets**:
- Vector search: <500ms (10k docs), <200ms (100k docs with quantization)
- Keyword search: <200ms (10k docs), <100ms (100k docs)
- Resource limits: 4GB RAM, 2 CPU cores

**Next Phase**: Task generation (`/speckit.tasks`)

### Key Decisions

1. **Vector Database**: Qdrant selected for hybrid search (dense + sparse vectors), int8 quantization support, and Docker deployment simplicity
2. **Schema Design**: Named vectors (`interpretation_embedding` + `text_sparse`) with schema-less JSON payload for flexibility
3. **Uniqueness Strategy**: ISRC → deterministic UUID (v5) as Qdrant point ID
4. **Test Strategy**: Unique collection per test run (`tracks-test-{uuid}`) with automatic cleanup
5. **Initialization**: Idempotent script taking collection name as parameter (supports production + test environments)

### Risk Mitigation

- **Memory constraints**: int8 quantization reduces vector memory 75% (1.6GB → 400MB for 100k docs)
- **Test pollution**: Isolated test collections with safety checks preventing production deletion
- **Schema evolution**: Collection metadata for versioning; breaking changes require explicit re-indexing
- **Performance**: HNSW parameters tuned for 100k corpus; quantization + indexed payloads achieve latency targets
