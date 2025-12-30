# Quickstart: Semantic Discovery Search

**Feature**: 009-semantic-discovery-search
**Date**: 2025-12-30

## Prerequisites

Before implementing this feature, ensure the following are running:

### Required Services

```bash
# Start all infrastructure
docker compose up -d

# Verify services are running
docker compose ps
```

| Service | Port | Status Check |
|---------|------|--------------|
| PostgreSQL | 5432 | `docker compose exec db pg_isready` |
| Qdrant | 6333 | http://localhost:6333/dashboard |
| Langfuse | 3000 | http://localhost:3000 |
| TEI (Embeddings) | 8080 | `curl http://localhost:8080/health` |

### Environment Variables

Create/update `.env` in repo root:

```bash
# Existing (should already be set)
ANTHROPIC_API_KEY=sk-ant-...
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=tracks
TEI_URL=http://localhost:8080

# Langfuse (should already be set from 005)
LANGFUSE_PUBLIC_KEY=pk-...
LANGFUSE_SECRET_KEY=sk-...
LANGFUSE_BASEURL=http://localhost:3000
```

### Indexed Tracks

Discovery search requires indexed tracks in Qdrant:

```bash
# Check collection exists and has documents
curl http://localhost:6333/collections/tracks | jq '.result.points_count'

# If empty, run ingestion first via Inngest dashboard
# http://localhost:8288 → Send track/ingestion.requested event
```

---

## Development Setup

### Backend

```bash
cd backend

# Install dependencies
npm install

# Start development server
npm run dev
# → GraphQL API at http://localhost:4000/graphql
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
# → React app at http://localhost:5173
```

---

## Testing the Feature

### 1. GraphQL Playground

Open http://localhost:4000/graphql and run:

```graphql
query TestDiscovery {
  discoverTracks(input: { query: "uplifting songs about hope" }) {
    ... on DiscoverySearchResponse {
      results {
        title
        artist
        album
        score
        isrc
      }
      expandedQueries
      totalResults
      hasMore
    }
    ... on DiscoverySearchError {
      message
      code
      retryable
    }
  }
}
```

### 2. Frontend Navigation

1. Open http://localhost:5173
2. Click "Discover" in the top navigation
3. Enter a natural language query (e.g., "sad songs about lost love")
4. View search results
5. Click a track row to expand and see lyrics/interpretation

### 3. Manual Semantic Relevance Validation (SC-002)

Verify that search results are semantically relevant to the query:

| Test Query | Expected Results | Pass Criteria |
|------------|------------------|---------------|
| "uplifting songs about hope" | Tracks with themes of optimism, perseverance, positive outlook | Top 5 results contain interpretations mentioning hope, optimism, or overcoming |
| "sad songs about lost love" | Tracks about heartbreak, breakups, romantic loss | Top 5 results contain interpretations mentioning love, loss, or heartbreak |
| "energetic party music" | Upbeat tracks with high energy | Top 5 results have high energy/danceability in audio features |

**Validation Process**:
1. Run each test query in the Discover page
2. Expand top 5 results to view interpretations
3. Verify interpretations align with query theme
4. Mark test as PASS if 4/5 results are thematically relevant

### 4. Observability

Check Langfuse for traces:

1. Open http://localhost:3000
2. Login: `admin@localhost.dev` / `adminadmin`
3. Select project: `algojuke`
4. View traces for discovery search operations

---

## Running Tests

### Backend Tests

```bash
cd backend

# All tests
npm test

# Discovery-specific tests
npm test -- --grep "discovery"

# Contract tests only
npm test -- tests/contract/

# Integration tests only
npm test -- tests/integration/
```

### Frontend Tests

```bash
cd frontend

# All tests
npm test

# Discover page tests
npm test -- DiscoverPage
```

---

## File Structure

After implementation, the following files will be added/modified:

```
backend/src/
├── resolvers/
│   └── discoveryResolver.ts      # NEW
├── schema/
│   └── discovery.graphql         # NEW
├── services/
│   └── discoveryService.ts       # NEW
├── clients/
│   ├── qdrantClient.ts           # EXTEND (add hybridSearch)
│   ├── anthropicClient.ts        # NEW (Haiku for query expansion)
│   └── teiClient.ts              # NEW (embedding client)
└── server.ts                     # MODIFY (register resolver)

frontend/src/
├── pages/
│   └── DiscoverPage.tsx          # NEW
├── components/
│   ├── AppHeader.tsx             # MODIFY (add Discover nav)
│   └── discover/
│       ├── DiscoverySearchBar.tsx
│       ├── DiscoveryResults.tsx
│       └── DiscoveryTrackItem.tsx
├── graphql/
│   └── discovery.ts              # NEW
├── hooks/
│   └── useDiscoverySearch.ts     # NEW
└── App.tsx                       # MODIFY (add /discover route)
```

---

## Troubleshooting

### "LLM unavailable" error

- Check `ANTHROPIC_API_KEY` is set correctly
- Verify API key has access to Claude Haiku 4.5
- Check Anthropic API status: https://status.anthropic.com

### "Embedding unavailable" error

- Check TEI container is running: `docker compose ps tei`
- Check TEI health: `curl http://localhost:8080/health`
- Check TEI logs: `docker compose logs tei`

### "Index unavailable" error

- Check Qdrant is running: `docker compose ps qdrant`
- Check Qdrant dashboard: http://localhost:6333/dashboard
- Verify `tracks` collection exists

### Empty search results

- Verify tracks are indexed: check Qdrant dashboard points count
- Try broader search terms
- Check Langfuse traces for query expansion output

### Slow search (>10s)

- Check TEI container resources (may need more CPU/memory)
- Check Qdrant HNSW parameters (ef_construct, hnsw_ef)
- Consider reducing number of expanded queries (1 vs 3)

---

## Key Dependencies

| Package | Purpose | Docs |
|---------|---------|------|
| `@qdrant/js-client-rest` | Qdrant hybrid search | https://qdrant.tech/documentation/ |
| `ai` + `@ai-sdk/anthropic` | Claude Haiku query expansion | https://sdk.vercel.ai/docs |
| `axios` | TEI embedding requests | https://axios-http.com |
| `langfuse` | Observability tracing | https://langfuse.com/docs |
