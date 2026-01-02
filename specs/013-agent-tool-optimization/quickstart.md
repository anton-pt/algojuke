# Quickstart: Agent Tool Optimization

**Feature**: 013-agent-tool-optimization
**Date**: 2026-01-02

## Overview

This guide explains how to test the agent tool optimization that reduces token usage by returning `short_description` instead of full `interpretation` and `lyrics` in semantic search results.

---

## Prerequisites

1. **Docker services running**:
   ```bash
   docker compose up -d qdrant inngest
   ```

2. **Environment variables** (in `.env`):
   ```bash
   QDRANT_URL=http://localhost:6333
   QDRANT_COLLECTION=tracks
   ANTHROPIC_API_KEY=<your-key>
   ```

3. **Indexed tracks with short descriptions** (feature 012 complete):
   ```bash
   # Verify tracks have short_description field
   curl http://localhost:6333/collections/tracks/points/scroll \
     -H "Content-Type: application/json" \
     -d '{"limit": 1, "with_payload": ["short_description"]}'
   ```

---

## Running Tests

### Contract Tests

Validate the optimized response schemas:

```bash
cd backend
npm test -- tests/contract/agentTools/optimizedSearch.test.ts
```

### Integration Tests

Test field selection with actual Qdrant:

```bash
cd backend
npm test -- tests/integration/agentTools/semanticSearchOptimized.test.ts
```

### Full Test Suite

```bash
cd backend
npm test
```

---

## Manual Testing

### 1. Test Semantic Search (Optimized)

Use the chat interface to perform a semantic search:

```
User: Find me some melancholic songs about lost love

Agent: [Uses semanticSearch tool]
       → Receives tracks with shortDescription only
       → Should NOT have interpretation or lyrics in response
```

**Verify in Langfuse trace**:
- Tool response payload size should be ~80-90% smaller
- No `interpretation` or `lyrics` fields in result

### 2. Test Batch Metadata (Full Data)

Ask the agent for details about a specific track:

```
User: Tell me more about that first track

Agent: [Uses batchMetadata tool with ISRC]
       → Receives full interpretation and lyrics
       → Can now explain the track in detail
```

**Verify**:
- Response includes `interpretation` and `lyrics`
- Agent can reference specific lyrical themes

### 3. Verify Discover UI Unchanged

Navigate to the Discover page and perform a search:

1. Go to http://localhost:3000/discover
2. Search for "uplifting songs"
3. Click on a result to expand
4. **Verify**: Full interpretation and lyrics are displayed

---

## Payload Size Comparison

### Before Optimization

```bash
# Simulated with full payload
curl http://localhost:6333/collections/tracks/points/search \
  -H "Content-Type: application/json" \
  -d '{
    "vector": [/* query vector */],
    "limit": 20,
    "with_payload": true
  }' | wc -c

# Typical result: 60,000-140,000 bytes
```

### After Optimization

```bash
# With field selection
curl http://localhost:6333/collections/tracks/points/search \
  -H "Content-Type: application/json" \
  -d '{
    "vector": [/* query vector */],
    "limit": 20,
    "with_payload": ["isrc", "title", "artist", "album", "short_description",
                     "acousticness", "danceability", "energy", "instrumentalness",
                     "key", "liveness", "loudness", "mode", "speechiness",
                     "tempo", "valence"]
  }' | wc -c

# Expected result: 8,000-12,000 bytes (85%+ reduction)
```

---

## Troubleshooting

### Short description is null

**Cause**: Track was ingested before feature 012 backfill completed.

**Fix**: Run the backfill script:
```bash
cd services/worker
npm run backfill:short-descriptions
```

### Agent still receiving full interpretation

**Cause**: Code not updated to use `hybridSearchOptimized()`.

**Fix**: Verify `semanticSearchTool.ts` uses the new method:
```typescript
// Should use:
const results = await context.qdrantClient.hybridSearchOptimized(queries, options);

// Not:
const results = await context.qdrantClient.hybridSearch(queries, options);
```

### Discover UI broken

**Cause**: Wrong method used in discovery service.

**Fix**: `discoveryService.ts` should still use `hybridSearch()` (unchanged):
```typescript
// discoveryService.ts - SHOULD BE UNCHANGED
const results = await this.qdrantClient.hybridSearch(expandedQueries, options);
```

---

## Success Criteria Validation

| Criterion | How to Verify |
|-----------|---------------|
| SC-001: 70%+ payload reduction | Compare Langfuse trace sizes before/after |
| SC-002: Same response time | Check durationMs in tool output |
| SC-003: ≤5 batch metadata calls | Count batchMetadata calls in trace |
| SC-004: Short descriptions present | Check shortDescription field in results |
| SC-005: Quality maintained | Subjective: recommendations still relevant |
| SC-006: All operations traced | Check Langfuse for complete traces |
| SC-007: Two-tier approach works | Verify scan→detail workflow in chat |

---

## Next Steps

After implementation:

1. Run full test suite: `npm test`
2. Deploy to staging
3. Monitor Langfuse for token usage reduction
4. Collect agent recommendation quality feedback
