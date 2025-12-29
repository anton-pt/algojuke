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
│   └── search-index/           # Vector search index infrastructure
│       ├── src/
│       │   ├── client/                # Qdrant client
│       │   ├── schema/                # Collection and document schemas
│       │   ├── scripts/               # Init scripts and test utilities
│       │   └── utils/                 # ISRC hashing
│       ├── tests/
│       │   ├── contract/              # Schema validation tests
│       │   └── integration/           # Search operation tests
│       └── README.md                  # Search index documentation
├── docker-compose.yml          # Inngest Dev Server + PostgreSQL + Qdrant
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

## Code Style

- TypeScript strict mode
- ES2022 target
- Follow standard conventions

## Recent Changes
- 004-vector-search-index: Added TypeScript 5.3.3 / Node.js 20.x + Qdrant client library (qdrant-js), Zod (schema validation), Docker
- 003-background-task-queue: Added TypeScript 5.3.3 / Node.js 20.x
- 002-library-management: Added TypeScript 5.3.3 / Node.js 20.x (backend), TypeScript 5.3.3 / React 18.2.0 (frontend) + Apollo Server 4.x + Apollo Client 3.x (GraphQL), TypeORM (ORM), pg (PostgreSQL driver), axios 1.6+ (Tidal API), Vitest 1.x (testing), React Testing Library (frontend tests)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
