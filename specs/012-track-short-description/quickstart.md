# Quickstart: Track Short Description

**Feature**: 012-track-short-description
**Date**: 2026-01-02

## Prerequisites

1. **Running services**:
   - Qdrant vector database (port 6333)
   - Inngest Dev Server (port 8288)
   - Langfuse (port 3000) - for observability

2. **Environment variables** (in `services/worker/.env`):
   ```bash
   ANTHROPIC_API_KEY=sk-ant-...  # Already configured for interpretation
   QDRANT_URL=http://localhost:6333
   QDRANT_COLLECTION=tracks
   LANGFUSE_PUBLIC_KEY=pk-lf-...
   LANGFUSE_SECRET_KEY=sk-lf-...
   ```

3. **Existing tracks in index**:
   - Tracks must be ingested via the existing pipeline
   - Tracks should have `interpretation` field populated (for best results)

## Quick Test: Ingestion with Short Description

### 1. Start the worker service

```bash
cd services/worker
npm run dev
```

### 2. Trigger a track ingestion

Use the Inngest Dev Server UI (http://localhost:8288) or send an event:

```bash
curl -X POST http://localhost:8288/e \
  -H "Content-Type: application/json" \
  -d '{
    "name": "track/ingestion.requested",
    "data": {
      "isrc": "USRC12345678",
      "title": "Test Track",
      "artist": "Test Artist",
      "album": "Test Album"
    }
  }'
```

### 3. Verify short description in Qdrant

```bash
curl http://localhost:6333/collections/tracks/points/scroll \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "must": [{"key": "isrc", "match": {"value": "USRC12345678"}}]
    },
    "with_payload": true
  }'
```

Expected response includes:
```json
{
  "result": {
    "points": [{
      "payload": {
        "isrc": "USRC12345678",
        "short_description": "A melancholic indie rock ballad exploring themes of loss and redemption with ethereal vocals.",
        ...
      }
    }]
  }
}
```

## Backfill Existing Tracks

### 1. Check for tracks without short_description

```bash
curl http://localhost:6333/collections/tracks/points/scroll \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "must": [{"is_null": {"key": "short_description"}}]
    },
    "limit": 10,
    "with_payload": ["isrc", "title"]
  }'
```

### 2. Run the backfill script

```bash
cd services/worker
npx tsx scripts/backfill-short-descriptions.ts
```

### 3. Monitor progress

The script logs progress every 10 tracks:
```
[Backfill] Starting... Found 150 tracks without short_description
[Backfill] Processed 10/150 (6.7%) - ETA: 5 minutes
[Backfill] Processed 20/150 (13.3%) - ETA: 4 minutes
...
[Backfill] Complete! Processed 150 tracks, 2 errors
```

### 4. Resume after interruption

If the script is interrupted (Ctrl+C, crash), simply run it again:
```bash
npx tsx scripts/backfill-short-descriptions.ts
```

It will resume from the last checkpoint stored in `backfill-progress.json`.

### 5. Force restart (ignore progress)

```bash
npx tsx scripts/backfill-short-descriptions.ts --reset
```

## Verify in Langfuse

1. Open http://localhost:3000
2. Navigate to Traces
3. Filter by tag: `short-description` or `backfill`
4. View generation spans for token usage and prompts

## Common Issues

### "ANTHROPIC_API_KEY not set"

Ensure the environment variable is set in `services/worker/.env`.

### Backfill processing too slowly

Rate is intentionally limited to 1 track every 2 seconds (30/minute). This prevents API throttling. For faster processing, modify the delay in the backfill script (not recommended for production).

### Some tracks have null short_description

This is expected for:
- Tracks where LLM generation failed
- Tracks that errored during backfill (check `backfill-progress.json` for error details)

Re-run the backfill script to retry failed tracks.

### Short descriptions too long

The LLM is instructed to limit to 50 words. If descriptions exceed this:
1. Check the prompt in `services/worker/src/prompts/shortDescription.ts`
2. Consider post-processing truncation as a fallback

## Validation Checklist

- [ ] Worker service starts without errors
- [ ] New track ingestion includes short_description in Qdrant
- [ ] Backfill script finds tracks without short_description
- [ ] Backfill progress is saved and resumable
- [ ] Langfuse shows generation spans for short descriptions
- [ ] Short descriptions are single sentences (≤50 words)
