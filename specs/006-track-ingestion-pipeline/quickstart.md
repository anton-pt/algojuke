# Quickstart: Track Ingestion Pipeline

**Feature**: 006-track-ingestion-pipeline
**Date**: 2025-12-29

## Prerequisites

- Node.js 20.x
- Docker and Docker Compose
- Anthropic API key
- Musixmatch API key

## Environment Setup

1. **Create/update `.env` file** in repository root:

```bash
# Anthropic (required for LLM interpretation)
ANTHROPIC_API_KEY=sk-ant-...

# Musixmatch (required for lyrics)
MUSIXMATCH_API_KEY=your_musixmatch_api_key

# Langfuse (from 005-llm-observability)
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_HOST=http://localhost:3000
```

2. **Install dependencies**:

```bash
cd services/worker
npm install
```

## Start Infrastructure

1. **Start all services** (PostgreSQL, Inngest, Qdrant, Langfuse, TEI):

```bash
docker compose up -d
```

2. **Verify services are running**:

```bash
# Check all containers
docker compose ps

# Expected services:
# - algojuke-postgres (port 5433)
# - algojuke-inngest (port 8288)
# - algojuke-qdrant (port 6333)
# - algojuke-langfuse-* (port 3000)
# - algojuke-tei (port 8080)
```

3. **Wait for TEI model download** (first run only, ~5-10 minutes for 8B model):

```bash
# Check TEI logs
docker compose logs -f tei

# Look for: "Ready" or "Model loaded"
```

4. **Initialize Qdrant index** (if not already done):

```bash
cd services/search-index
npm run init-index tracks
```

## Start Worker Service

```bash
cd services/worker
npm run dev
```

The worker will:
- Start Express server on port 3001
- Register with Inngest Dev Server
- Begin processing events

## Trigger Ingestion

### Option 1: Via Inngest Dashboard

1. Open http://localhost:8288
2. Go to "Send Event" tab
3. Enter event:

```json
{
  "name": "track/ingestion.requested",
  "data": {
    "isrc": "USRC11700001",
    "title": "Bohemian Rhapsody",
    "artist": "Queen",
    "album": "A Night at the Opera"
  }
}
```

4. Click "Send Event"
5. Navigate to "Runs" to monitor progress

### Option 2: Via curl

```bash
curl -X POST http://localhost:8288/e/test \
  -H "Content-Type: application/json" \
  -d '{
    "name": "track/ingestion.requested",
    "data": {
      "isrc": "USRC11700001",
      "title": "Bohemian Rhapsody",
      "artist": "Queen",
      "album": "A Night at the Opera"
    }
  }'
```

## Monitor Execution

### Inngest Dashboard

- URL: http://localhost:8288
- View function runs, step execution, retry attempts
- Inspect step inputs/outputs

### Langfuse Dashboard

- URL: http://localhost:3000
- Login: `admin@localhost.dev` / `adminadmin`
- Project: `algojuke-ingestion`
- View traces for LLM calls, HTTP requests, embeddings

### Qdrant Dashboard

- URL: http://localhost:6333/dashboard
- Collection: `tracks`
- Verify document was stored

## Verify Ingestion

Query Qdrant to confirm track was indexed:

```bash
curl -X POST http://localhost:6333/collections/tracks/points/scroll \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "must": [
        { "key": "isrc", "match": { "value": "USRC11700001" } }
      ]
    },
    "with_payload": true,
    "limit": 1
  }'
```

Expected response includes:
- `title`, `artist`, `album`
- `lyrics` (if found)
- `interpretation` (if lyrics available)
- `interpretation_embedding` (4096-dim vector)
- Audio features (if found in ReccoBeats)

## Troubleshooting

### TEI Container Fails to Start

```bash
# Check logs
docker compose logs tei

# Common issues:
# - Insufficient memory (needs ~16GB for 8B model)
# - Model download failed (retry with: docker compose restart tei)
```

### No Lyrics Found

Musixmatch may not have all tracks. Check:
- ISRC is valid format (12 characters)
- Track exists in Musixmatch catalog
- API key is valid (check 401 errors in logs)

### LLM Interpretation Fails

Check Anthropic API key:
```bash
# Test API key
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

### Embedding Dimension Mismatch

If you see "Embedding must be exactly 4096 dimensions":
- Verify TEI is using `Qwen/Qwen3-Embedding-8B` model
- Check TEI container is running: `docker compose ps tei`

## Running Tests

```bash
cd services/worker

# All tests
npm test

# Contract tests only
npm test -- --grep "contract"

# Integration tests only
npm test -- --grep "integration"

# Watch mode
npm run test:watch
```

## Stop Services

```bash
# Stop all services
docker compose down

# Stop and remove volumes (clears all data)
docker compose down -v
```
