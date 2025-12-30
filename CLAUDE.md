# algojuke Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-27

## Active Technologies
- TypeScript 5.3.3 / Node.js 20.x (backend), TypeScript 5.3.3 / React 18.2.0 (frontend) (001-tidal-search)
- In-memory caching (Map-based, 1-hour TTL) (001-tidal-search)
- TypeScript 5.3.3 / Node.js 20.x (backend), TypeScript 5.3.3 / React 18.2.0 (frontend) + Apollo Server 4.x + Apollo Client 3.x (GraphQL), axios 1.6+ (HTTP), Vitest 1.x (testing) (001-tidal-search)
- TypeScript 5.3.3 / Node.js 20.x (backend), TypeScript 5.3.3 / React 18.2.0 (frontend) + Apollo Server 4.x + Apollo Client 3.x (GraphQL), TypeORM (ORM), pg (PostgreSQL driver), axios 1.6+ (Tidal API), Vitest 1.x (testing), React Testing Library (frontend tests) (002-library-management)
- PostgreSQL (persistent library data via TypeORM entities) (002-library-management)
- TypeScript 5.3.3 / Node.js 20.x + Inngest 3.22.12 + Zod 3.x + Express 4.x + Vitest 1.x (003-background-task-queue)
- PostgreSQL (via existing TypeORM setup) + Inngest managed state store (SQLite for dev, PostgreSQL for production self-hosting) (003-background-task-queue)
- TypeScript 5.3.3 / Node.js 20.x + Qdrant client library (qdrant-js), Zod (schema validation), Docker (004-vector-search-index)
- Qdrant vector database (Docker container with volume persistence) (004-vector-search-index)
- TypeScript 5.3.3 / Node.js 20.x + @langfuse/tracing, @langfuse/otel, @opentelemetry/sdk-node, zod (005-llm-observability)
- Langfuse-managed (PostgreSQL, ClickHouse, MinIO, Redis) - all in Docker (005-llm-observability)
- TypeScript 5.3.3 / Node.js 20.x + Inngest 3.22.12, Vercel AI SDK (`ai`, `@ai-sdk/anthropic`), Zod 3.x, axios 1.6+ (006-track-ingestion-pipeline)
- Qdrant (vector index), Inngest (step memoization) (006-track-ingestion-pipeline)
- TypeScript 5.3.3 / Node.js 20.x + Apollo Server 4.x (GraphQL), TypeORM, Inngest 3.22.12, @qdrant/js-client-rest, axios 1.6+ (007-library-ingestion-scheduling)
- PostgreSQL (library data via TypeORM), Qdrant (vector index existence checks), Inngest (task queue) (007-library-ingestion-scheduling)
- TypeScript 5.3.3 / Node.js 20.x (backend), TypeScript 5.3.3 / React 18.2.0 (frontend) + Apollo Server 4.x + Apollo Client 3.x (GraphQL), Qdrant JS client, Zod (validation), Vitest (testing) (008-track-metadata-display)
- PostgreSQL (library data via TypeORM), Qdrant (vector index with track documents) (008-track-metadata-display)

## Project Structure

```text
algojuke/
├── services/
│   ├── api/                    # GraphQL API server (future)
│   ├── worker/                 # Background task queue worker (Inngest)
│   │   ├── src/
│   │   │   ├── inngest/
│   │   │   │   ├── client.ts          # Inngest client
│   │   │   │   ├── events.ts          # Event schemas (Zod)
│   │   │   │   └── functions/         # Task functions
│   │   │   │       ├── demoTask.ts    # Demo task (infrastructure validation)
│   │   │   │       └── index.ts       # Function registry
│   │   │   └── server.ts              # Express server
│   │   ├── tests/
│   │   │   └── functions/             # Vitest tests
│   │   ├── scripts/
│   │   │   ├── test-observability.sh  # Dashboard validation
│   │   │   └── test-rate-limits.sh    # Rate limit validation
│   │   ├── README.md                  # Worker service documentation
│   │   └── VALIDATION.md              # End-to-end validation checklist
│   ├── search-index/           # Vector search index infrastructure
│   │   ├── src/
│   │   │   ├── client/                # Qdrant client
│   │   │   ├── schema/                # Collection and document schemas
│   │   │   ├── scripts/               # Init scripts and test utilities
│   │   │   └── utils/                 # ISRC hashing
│   │   ├── tests/
│   │   │   ├── contract/              # Schema validation tests
│   │   │   └── integration/           # Search operation tests
│   │   └── README.md                  # Search index documentation
│   └── observability/          # LLM observability service (Langfuse)
│       ├── src/
│       │   ├── config.ts              # Configuration (Zod validation)
│       │   ├── client.ts              # Langfuse client wrapper
│       │   ├── generation.ts          # LLM generation spans
│       │   ├── search.ts              # Vector search spans
│       │   ├── http.ts                # HTTP call spans
│       │   ├── context.ts             # Trace context propagation
│       │   └── schemas/               # Zod validation schemas
│       ├── tests/
│       │   ├── contract/              # Schema validation tests
│       │   └── integration/           # Langfuse integration tests
│       ├── scripts/                   # Demo scripts
│       └── README.md                  # Observability documentation
├── docker-compose.yml          # All services (Inngest, PostgreSQL, Qdrant, Langfuse)
├── docker-compose.langfuse.yml # Langfuse infrastructure
└── CLAUDE.md                   # This file
```

## Commands

### Worker Service (Background Tasks)

```bash
# Setup
cd services/worker
npm install

# Development (run locally, NOT in Docker for simpler DX)
npm run dev              # Start worker with hot reload (port 3001)

# Testing
npm test                 # Run all Vitest tests
npm run test:watch       # Run tests in watch mode
npm run type-check       # TypeScript type checking

# Infrastructure
docker compose up inngest -d    # Start Inngest Dev Server (port 8288)
docker compose up db -d         # Start PostgreSQL (port 5432)

# Validation
cd services/worker
./scripts/test-observability.sh   # Test dashboard features
./scripts/test-rate-limits.sh     # Test throttling
```

### Inngest Dashboard

Access at http://localhost:8288 when Inngest Dev Server is running.

### Search Index Service (Vector Search)

```bash
# Setup
cd services/search-index
npm install

# Development
npm test                        # Run all tests
npm run test:watch              # Run tests in watch mode
npm run type-check              # TypeScript type checking

# Infrastructure
docker compose up qdrant -d     # Start Qdrant (port 6333/6334)

# Index Management
npm run init-index tracks       # Initialize production collection
npm run init-index tracks-test  # Initialize test collection
```

### Qdrant Dashboard

Access at http://localhost:6333/dashboard when Qdrant is running.

### Observability Service (LLM Tracing)

```bash
# Setup
cd services/observability
npm install

# Testing
npm test                 # Run all tests (91 tests)
npm run test:watch       # Run tests in watch mode
npm run type-check       # TypeScript type checking

# Demo scripts
npm run demo:generation  # LLM generation tracing
npm run demo:search      # Vector search tracing
npm run demo:http        # HTTP call tracing
npm run demo:correlated  # Correlated multi-operation traces

# Infrastructure
docker compose up -d     # Start all services including Langfuse
```

### Langfuse Dashboard

Access at http://localhost:3000 when Langfuse is running.
- **Login**: `admin@localhost.dev` / `adminadmin`
- **Projects**:
  - `algojuke` - Application backend operations
  - `algojuke-ingestion` - Background task/ingestion pipeline operations

## Code Style

- TypeScript strict mode
- ES2022 target
- Follow standard conventions

## Environment Variables

### Backend Service

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `4000` | GraphQL API server port |
| `NODE_ENV` | No | `development` | Runtime environment |
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `TIDAL_CLIENT_ID` | Yes | - | Tidal API client ID |
| `TIDAL_CLIENT_SECRET` | Yes | - | Tidal API client secret |
| `SEARCH_CACHE_TTL` | No | `3600` | Search cache TTL in seconds |

### Ingestion Scheduling (007)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `QDRANT_URL` | No | `http://localhost:6333` | Qdrant server URL |
| `QDRANT_COLLECTION` | No | `tracks` | Qdrant collection name |
| `INNGEST_EVENT_KEY` | Prod only | - | Inngest event key (required in production) |
| `INNGEST_APP_ID` | No | `algojuke-backend` | Inngest application ID |
| `INGESTION_CONCURRENCY` | No | `10` | Max parallel scheduling operations |
| `INGESTION_SLA_MS` | No | `5000` | SLA threshold for scheduling (ms) |

### Worker Service

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `INNGEST_DEV` | Dev only | `1` | Enable Inngest dev mode |
| `ANTHROPIC_API_KEY` | Yes | - | Anthropic API key for LLM |
| `MUSIXMATCH_API_KEY` | Yes | - | Musixmatch API key for lyrics |
| `RECCOBEATS_API_KEY` | Yes | - | ReccoBeats API key for audio features |

### Observability (Langfuse)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LANGFUSE_PUBLIC_KEY` | Yes | - | Langfuse public key |
| `LANGFUSE_SECRET_KEY` | Yes | - | Langfuse secret key |
| `LANGFUSE_BASEURL` | No | `http://localhost:3000` | Langfuse server URL |

## Recent Changes
- 008-track-metadata-display: Added TypeScript 5.3.3 / Node.js 20.x (backend), TypeScript 5.3.3 / React 18.2.0 (frontend) + Apollo Server 4.x + Apollo Client 3.x (GraphQL), Qdrant JS client, Zod (validation), Vitest (testing)
- 007-library-ingestion-scheduling: Added TypeScript 5.3.3 / Node.js 20.x + Apollo Server 4.x (GraphQL), TypeORM, Inngest 3.22.12, @qdrant/js-client-rest, axios 1.6+
- 006-track-ingestion-pipeline: Added TypeScript 5.3.3 / Node.js 20.x + Inngest 3.22.12, Vercel AI SDK (`ai`, `@ai-sdk/anthropic`), Zod 3.x, axios 1.6+


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
