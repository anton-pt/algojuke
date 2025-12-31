# AlgoJuke

AlgoJuke is an algorithmic jukebox designed to help you discover new music fitting your tastes and current mood. It creates playlists that tell a story using the lyrics to help you connect with your music more deeply.

**Key capabilities:**

- **Search Tidal** for albums and tracks to build your personal music library
- **Semantic Discovery** - describe a mood or theme in natural language and find matching tracks
- **Automatic Enrichment** - tracks are automatically enriched with lyrics, AI-generated interpretations, and audio features
- **Hybrid Search** - combines vector similarity (semantic meaning) with keyword matching (lyrics)

## Features

### 1. Tidal Music Search

Search for albums and tracks on Tidal with album artwork display. Results can be added to your personal library.

### 2. Personal Music Library

Manage your collection of saved albums and tracks:

- Add/remove albums and tracks from search results
- Browse by Albums view or Tracks view (sorted alphabetically by artist)
- Persistent storage survives application restarts
- View enriched metadata for indexed tracks (lyrics, interpretations, audio features)

### 3. Semantic Discovery Search

Find music by describing what you're looking for in natural language:

- Enter anything from keywords to full paragraphs describing a mood or theme
- AI-powered query expansion converts your input into optimized search queries
- Hybrid scoring combines vector similarity and BM25 keyword matching
- Browse up to 100 results with expandable track details

### 4. Background Infrastructure

Behind the scenes, AlgoJuke uses:

- **Track Ingestion Pipeline** - automatically enriches library tracks with:
  - Lyrics from Musixmatch API
  - AI-generated thematic interpretations (Claude Sonnet 4.5)
  - Semantic embeddings for discovery search
  - Audio features (tempo, energy, danceability, etc.) from ReccoBeats API
- **Vector Search Index** - Qdrant-powered hybrid search supporting both semantic and keyword queries
- **LLM Observability** - Langfuse tracing for debugging and cost monitoring
- **Durable Task Queue** - Inngest-based background processing with automatic retries

## Tech Stack

| Layer                | Technologies                                                                     |
| -------------------- | -------------------------------------------------------------------------------- |
| **Frontend**         | React 18, TypeScript, Vite, Apollo Client 3.x                                    |
| **Backend**          | Node.js 20.x, TypeScript, Apollo Server 4.x, Express                             |
| **Database**         | PostgreSQL (library data via TypeORM)                                            |
| **Vector Search**    | Qdrant (hybrid dense vectors + BM25 sparse vectors)                              |
| **Background Tasks** | Inngest (durable execution, step memoization)                                    |
| **LLM**              | Anthropic Claude (Sonnet 4.5 for interpretations, Haiku 4.5 for query expansion) |
| **Embeddings**       | TEI with mxbai-embed-large-v1 (1024 dimensions)                                  |
| **Observability**    | Langfuse (LLM tracing and cost tracking)                                         |
| **Testing**          | Vitest, React Testing Library                                                    |

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- Docker and Docker Compose
- API credentials:
  - [Tidal API](https://developer.tidal.com) (search and library)
  - [Anthropic API](https://console.anthropic.com) (LLM interpretations)
  - [Musixmatch API](https://developer.musixmatch.com) (lyrics)

### 1. Environment Setup

```bash
# Copy environment templates
cp backend/.env.example backend/.env
cp services/worker/.env.example services/worker/.env
cp services/observability/.env.example services/observability/.env
```

Edit the `.env` files with your API credentials (see [Environment Variables](#environment-variables) below).

### 2. Start Infrastructure

```bash
# Start all Docker services (PostgreSQL, Qdrant, Inngest, Langfuse)
docker compose up -d

# Initialize the vector search index
cd services/search-index
npm install
npm run init-index tracks
cd ../..
```

### 3. Install Dependencies

```bash
# Backend
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..

# Worker service
cd services/worker && npm install && cd ..

# Other services
cd services/search-index && npm install && cd ..
cd services/observability && npm install && cd ..
```

### 4. Run Development Servers

```bash
# Terminal 1: Backend GraphQL server
cd backend && npm run dev

# Terminal 2: Frontend dev server
cd frontend && npm run dev

# Terminal 3: Background worker
cd services/worker && npm run dev
```

### Access Points

| Service            | URL                             |
| ------------------ | ------------------------------- |
| Frontend           | http://localhost:5173           |
| GraphQL API        | http://localhost:4000/graphql   |
| Inngest Dashboard  | http://localhost:8288           |
| Qdrant Dashboard   | http://localhost:6333/dashboard |
| Langfuse Dashboard | http://localhost:3000           |

## Project Structure

```
algojuke/
├── backend/                    # GraphQL API server
│   ├── src/
│   │   ├── resolvers/          # GraphQL resolvers
│   │   ├── services/           # Business logic (Tidal, library, search)
│   │   └── entities/           # TypeORM entities
│   └── tests/
├── frontend/                   # React web application
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── pages/              # Page components (Search, Library, Discover)
│   │   └── graphql/            # Apollo Client queries/mutations
│   └── tests/
├── services/
│   ├── worker/                 # Background task worker (Inngest)
│   │   ├── src/inngest/
│   │   │   ├── functions/      # Task functions (ingestion pipeline)
│   │   │   └── events.ts       # Event schemas
│   │   └── tests/
│   ├── search-index/           # Vector search infrastructure
│   │   ├── src/
│   │   │   ├── client/         # Qdrant client
│   │   │   ├── schema/         # Collection schemas
│   │   │   └── scripts/        # Index initialization
│   │   └── tests/
│   └── observability/          # LLM tracing service
│       ├── src/
│       │   ├── generation.ts   # LLM span tracking
│       │   ├── search.ts       # Vector search tracking
│       │   └── http.ts         # HTTP call tracking
│       └── tests/
├── specs/                      # Feature specifications
├── docker-compose.yml          # All infrastructure services
└── CLAUDE.md                   # Development guidelines
```

## Environment Variables

### Backend (`backend/.env`)

```bash
# Server
PORT=4000
NODE_ENV=development
DATABASE_URL=postgresql://algojuke:algojuke@localhost:5432/algojuke

# Tidal API (REQUIRED)
TIDAL_CLIENT_ID=your_client_id
TIDAL_CLIENT_SECRET=your_client_secret
TIDAL_TOKEN_URL=https://auth.tidal.com/v1/oauth2/token
TIDAL_API_BASE_URL=https://openapi.tidal.com

# Rate Limiting
TIDAL_REQUESTS_PER_SECOND=3
TIDAL_MAX_CONCURRENT=3
TIDAL_MAX_RETRIES=3
TIDAL_RETRY_DELAY_MS=1000

# Caching
SEARCH_CACHE_TTL=3600

# Vector Search
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=tracks

# Inngest
INNGEST_APP_ID=algojuke-backend
```

### Worker Service (`services/worker/.env`)

```bash
# Inngest
INNGEST_DEV=1

# Anthropic (REQUIRED for interpretations)
ANTHROPIC_API_KEY=your_anthropic_key

# Musixmatch (REQUIRED for lyrics)
MUSIXMATCH_API_KEY=your_musixmatch_key

# Embedding Service
TEI_URL=http://localhost:8080

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=tracks

# Langfuse
LANGFUSE_PUBLIC_KEY=your_public_key
LANGFUSE_SECRET_KEY=your_secret_key
LANGFUSE_BASEURL=http://localhost:3000
```

## Testing

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# Worker service tests
cd services/worker && npm test

# Search index tests
cd services/search-index && npm test

# Observability tests
cd services/observability && npm test
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                       │
│  │  Search  │  │  Library │  │ Discover │                       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                       │
└───────┼─────────────┼─────────────┼─────────────────────────────┘
        │             │             │
        ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (GraphQL API)                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│  │ Tidal API  │  │  Library   │  │  Discovery │                 │
│  │  Service   │  │  Service   │  │  Service   │                 │
│  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘                 │
└─────────┼───────────────┼───────────────┼───────────────────────┘
          │               │               │
          ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ Tidal    │    │PostgreSQL│    │  Qdrant  │
    │ API      │    │ (Library)│    │ (Vectors)│
    └──────────┘    └─────┬────┘    └────┬─────┘
                          │              │
                          ▼              │
                    ┌──────────┐         │
                    │ Inngest  │◄────────┘
                    │ (Tasks)  │
                    └────┬─────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   Worker Service    │
              │  (Ingestion Tasks)  │
              └──────────┬──────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │Musixmatch│   │ Anthropic│   │   TEI    │
    │ (Lyrics) │   │  (LLM)   │   │(Embed)   │
    └──────────┘   └──────────┘   └──────────┘
```

## How Semantic Discovery Works

1. **User enters a natural language query** (e.g., "melancholic songs about lost love")

2. **Query expansion** - Claude Haiku 4.5 converts the input into 1-3 optimized search queries

3. **Embedding generation** - Each query is converted to a 1024-dimensional vector

4. **Hybrid search** - Qdrant searches using:

   - Vector similarity on track interpretation embeddings
   - BM25 keyword matching on interpretation text
   - BM25 keyword matching on lyrics text

5. **Score fusion** - Results are combined using Reciprocal Rank Fusion (RRF)

6. **Deduplication** - Duplicate tracks from multiple queries keep highest score

7. **Results display** - Top 100 results with expandable track details

## Performance

| Operation        | Target | Notes                                  |
| ---------------- | ------ | -------------------------------------- |
| Tidal search     | <3s    | Batch API optimization (3 calls vs 41) |
| Library load     | <2s    | Up to 500 items                        |
| Discovery search | <10s   | Including LLM query expansion          |
| Track details    | <3s    | On-demand metadata fetch               |
| Track ingestion  | <60s   | Full pipeline with all enrichments     |

## Browser Support

Chrome 91+, Firefox 89+, Safari 14+, Edge 91+ (ES2020 support required)

## Contributing

See `specs/` for detailed feature specifications and `CLAUDE.md` for development guidelines.

## License

[Add license information]

---

Happy listening!
