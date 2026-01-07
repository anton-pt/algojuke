# Research: Agent Tool Optimization

**Feature**: 013-agent-tool-optimization
**Date**: 2026-01-02

## Research Questions

1. How does Qdrant field selection work in the JavaScript client?
2. What is the current payload size for semantic search results?
3. How does the agent currently use interpretation/lyrics data?

---

## 1. Qdrant Field Selection

### Decision: Use `with_payload` array for field selection

### Rationale

The Qdrant REST API and JavaScript client support selective payload retrieval using the `with_payload` parameter:

- `with_payload: true` - returns all payload fields (current behavior)
- `with_payload: false` - returns no payload fields
- `with_payload: ["field1", "field2"]` - returns only specified fields
- `with_payload: { include: ["field1"] }` - explicit include syntax
- `with_payload: { exclude: ["field1"] }` - exclude specific fields

The array syntax is the simplest and most readable option.

### Alternatives Considered

1. **Exclude syntax** (`with_payload: { exclude: ["interpretation", "lyrics"] }`)
   - Rejected: Less explicit; adding new fields would be included by default

2. **Post-fetch filtering** (fetch all, filter in code)
   - Rejected: Does not reduce network transfer; negates the optimization goal

3. **Separate Qdrant collection** (optimized schema for agent)
   - Rejected: Overengineered; would require data duplication

### Implementation

```typescript
// In qdrantClient.ts - new hybridSearchOptimized method
const AGENT_SEARCH_FIELDS = [
  "isrc",
  "title",
  "artist",
  "album",
  "short_description",
  "acousticness",
  "danceability",
  "energy",
  "instrumentalness",
  "key",
  "liveness",
  "loudness",
  "mode",
  "speechiness",
  "tempo",
  "valence",
];

// Use in query:
await this.client.query(this.collection, {
  prefetch,
  query: { fusion: "rrf" },
  limit,
  offset,
  with_payload: AGENT_SEARCH_FIELDS,  // ← Field selection
});
```

### Source

- [Qdrant Documentation - Search](https://qdrant.tech/documentation/concepts/search/)
- [Qdrant Documentation - Payload](https://qdrant.tech/documentation/concepts/payload/)

---

## 2. Payload Size Analysis

### Current State

Based on codebase exploration:

| Field | Typical Size | Included in Optimized? |
|-------|--------------|----------------------|
| isrc | 12 bytes | ✅ Yes |
| title | ~50 bytes | ✅ Yes |
| artist | ~30 bytes | ✅ Yes |
| album | ~40 bytes | ✅ Yes |
| lyrics | ~2000-5000 bytes | ❌ No |
| interpretation | ~500-2000 bytes | ❌ No |
| short_description | ~200 bytes (max 500) | ✅ Yes |
| audio features (11) | ~88 bytes | ✅ Yes |

### Estimated Savings

- **Before optimization**: ~3000-7000 bytes per track
- **After optimization**: ~420-620 bytes per track
- **Reduction**: 80-90% per track

For 20 search results:
- Before: ~60-140 KB
- After: ~8-12 KB
- **Savings: 85%+ (exceeds 70% target)**

### Decision: Proceed with implementation

The payload reduction significantly exceeds the 70% target specified in SC-001.

---

## 3. Agent Usage of Interpretation/Lyrics

### Current Flow

1. Agent calls `semanticSearch` with natural language query
2. Tool returns `IndexedTrackResult[]` with full `interpretation` and `lyrics`
3. Agent uses this data to:
   - Understand why tracks matched the query
   - Explain matches to the user
   - Decide which tracks to include in recommendations

### Optimized Flow

1. Agent calls `semanticSearch` → receives `short_description` only
2. Agent scans short descriptions to identify promising tracks
3. For key tracks (3-5), agent calls `batchMetadata` to get full details
4. Agent uses full data for those specific tracks only

### Decision: Update agent system prompt with guidance

Add explicit guidance to the chat agent system prompt:

```text
When searching for tracks:
1. Use semanticSearch to find matching tracks - you'll receive short descriptions
2. Scan the short descriptions to identify the most promising matches
3. Only call batchMetadata for tracks you want to explain in detail (typically 3-5)
4. Use the full interpretation and lyrics to craft meaningful recommendations
```

### Implementation Location

- `backend/src/services/chatStreamService.ts` - System prompt configuration

---

## Summary

| Research Question | Decision | Confidence |
|-------------------|----------|------------|
| Qdrant field selection | Use `with_payload: ["field1", ...]` array | High |
| Payload size reduction | 85%+ reduction achievable | High |
| Agent usage pattern | Two-tier: scan with short, detail with batch | High |

All research questions resolved. Ready for Phase 1 design.
