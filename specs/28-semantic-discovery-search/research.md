# Research: Semantic Discovery Search

**Feature**: 009-semantic-discovery-search
**Date**: 2025-12-30

## 1. Qdrant Hybrid Search with RRF

### Decision: Use Qdrant Query API with prefetch + RRF fusion

**Rationale**: Qdrant's Query API natively supports combining multiple retrieval methods (dense vectors + sparse vectors) using Reciprocal Rank Fusion. This aligns with the clarified requirement to use RRF for score combination.

**Alternatives Considered**:

- Custom weighted scoring: Rejected - requires score normalization between incompatible methods
- Client-side result merging: Rejected - inefficient, loses Qdrant's optimized fusion

### Implementation Pattern

```typescript
import { QdrantClient } from "@qdrant/js-client-rest";

const result = await client.query(collectionName, {
  prefetch: [
    {
      query: denseVector,
      using: "interpretation_embedding",
      limit: prefetchLimit,
    },
    {
      query: sparseVector,
      using: "text_sparse",
      limit: prefetchLimit,
    },
  ],
  query: { fusion: "rrf" }, // or { rrf: { k: 60 } } for parameterized
  limit,
  offset,
  with_payload: true,
});
```

### Key Configuration

- **Prefetch limit**: Must be >= `offset + limit` for pagination
- **RRF k parameter**: Default 60; lower k gives more weight to top-ranked results
- **Collection already configured**: `text_sparse` with IDF modifier enables BM25-style scoring

---

## 2. Multi-Query Hybrid Search

### Decision: Combine all query expansions into single prefetch array

**Rationale**: Qdrant's prefetch accepts multiple queries that are all fused via RRF. By adding prefetch entries for each expanded query (1-3), we get automatic cross-query fusion and deduplication.

**Implementation Pattern**:

```typescript
// For 1-3 expanded queries, build combined prefetch
const prefetch = expandedQueries.flatMap((q) => [
  {
    query: q.denseVector,
    using: "interpretation_embedding",
    limit: prefetchLimit,
  },
  { query: q.sparseVector, using: "text_sparse", limit: prefetchLimit },
]);

// RRF fuses all prefetch results together
const result = await client.query(collectionName, {
  prefetch,
  query: { fusion: "rrf" },
  limit,
  offset,
});
```

### Deduplication

For explicit deduplication by ISRC, use `queryGroups`:

```typescript
const result = await client.queryGroups(collectionName, {
  prefetch,
  query: { fusion: "rrf" },
  group_by: "isrc",
  limit: limit + offset,
  group_size: 1,
});
```

---

## 3. BM25 Sparse Vector Generation

### Decision: Generate client-side TF vectors with Qdrant's server-side IDF

**Rationale**: The collection's `text_sparse` is configured with `modifier: 'idf'`, meaning Qdrant applies IDF weighting server-side. We only need to provide Term Frequency (TF) vectors.

**Implementation Pattern**:

```typescript
function textToSparseVector(text: string): {
  indices: number[];
  values: number[];
} {
  const tokens = tokenize(text);
  const termFreq = new Map<number, number>();

  for (const token of tokens) {
    const hash = hashToken(token); // MD5 first 4 bytes as uint32
    termFreq.set(hash, (termFreq.get(hash) || 0) + 1);
  }

  const indices: number[] = [];
  const values: number[] = [];

  for (const [hash, count] of termFreq) {
    indices.push(hash);
    // BM25-style TF saturation
    const tf = count / (count + 1.2);
    values.push(tf);
  }

  return { indices, values };
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function hashToken(token: string): number {
  const hash = crypto.createHash("md5").update(token).digest();
  return hash.readUInt32BE(0);
}
```

---

## 4. Query Embedding (Asymmetric Search)

### Decision: Use instruction-prefixed query embeddings

**Rationale**: The mxbai-embed-large-v1 model supports instruction prefixes for asymmetric search. Query embeddings should include a retrieval instruction prefix for better semantic matching.

**Implementation Pattern**:

```typescript
// Document embedding (during ingestion - no prefix)
const docEmbedding = await teiClient.embed(interpretation);

// Query embedding (during search - with instruction prefix)
const queryText = `Instruct: Find music tracks matching this description\nQuery: ${userQuery}`;
const queryEmbedding = await teiClient.embed(queryText);
```

**Note**: The existing TEI client's `embedWithInstruct` method supports this pattern:

```typescript
// In services/worker/src/clients/tei.ts
async embedWithInstruct(query: string, instruct: string): Promise<number[]> {
  const formattedInput = `${instruct} ${query}`;
  return embed(formattedInput);
}
```

---

## 5. Query Expansion with Claude Haiku 4.5

### Decision: Generate 1-3 semantically diverse search queries

**Rationale**: LLM query expansion improves recall by generating multiple interpretations of user intent. Each expanded query targets different aspects of the search (exact keywords, synonyms, related themes).

**Prompt Pattern**:

```typescript
const QUERY_EXPANSION_PROMPT = `You are a music search assistant. Given a user's natural language query describing the mood, theme, or feeling they want in music, generate 1 to 3 focused search queries optimized for finding matching songs.

Guidelines:
- If the user query is specific (e.g., "songs about summer"), generate 1-2 queries
- If the user query is complex or multi-faceted, generate 2-3 queries covering different aspects
- Each query should be 5-15 words, suitable for semantic and keyword search
- Focus on themes, emotions, imagery, and lyrical content
- Do not include artist names or song titles unless the user specified them

User query: {userQuery}

Respond with a JSON array of strings. Example:
["uplifting songs about overcoming hardship", "hopeful lyrics about perseverance"]`;
```

**Model Selection**: Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) for cost efficiency and speed.

---

## 6. Pagination Strategy

### Decision: Offset-based pagination with prefetch buffer

**Rationale**: Qdrant supports offset/limit natively. The prefetch limit must accommodate the total results needed (offset + limit) to ensure consistent pagination.

**Implementation Pattern**:

```typescript
const PAGE_SIZE = 20;
const MAX_RESULTS = 100;

async function paginatedSearch(
  queries: SearchQuery[],
  page: number // 0-indexed
) {
  const offset = page * PAGE_SIZE;
  const limit = PAGE_SIZE;

  // Cap at max results
  if (offset >= MAX_RESULTS) {
    return { results: [], hasMore: false };
  }

  // Prefetch buffer for RRF fusion quality
  const prefetchLimit = Math.min(offset + limit + 50, MAX_RESULTS + 50);

  const results = await hybridSearch(queries, { limit, offset, prefetchLimit });

  return {
    results,
    hasMore: results.length === PAGE_SIZE && offset + limit < MAX_RESULTS,
    page,
    totalPages: Math.ceil(MAX_RESULTS / PAGE_SIZE),
  };
}
```

---

## 7. Error Handling Strategy

### Decision: Fail gracefully with specific error types

**Rationale**: Discovery search involves multiple external services (LLM, embedding, Qdrant). Each failure mode should provide actionable feedback to users.

**Error Types**:

| Error                         | User Message                                                      | Retry |
| ----------------------------- | ----------------------------------------------------------------- | ----- |
| LLM unavailable               | "Search service temporarily unavailable. Please try again."       | Yes   |
| Embedding service unavailable | "Search service temporarily unavailable. Please try again."       | Yes   |
| Qdrant unavailable            | "Search service temporarily unavailable. Please try again."       | Yes   |
| Empty query                   | "Please enter a search term."                                     | No    |
| Timeout (30s)                 | "Search took too long. Please try a simpler query."               | Yes   |
| No results                    | "No tracks found matching your description. Try different terms." | No    |

---

## 8. Observability Integration

### Decision: Reuse existing Langfuse observability patterns from worker service

**Rationale**: The worker service already has comprehensive Langfuse integration for LLM calls, HTTP spans, and search operations. The same patterns apply to discovery search.

**Spans to Create**:

1. **LLM Generation Span**: Query expansion (Haiku)

   - Prompt, completion, tokens, model

2. **HTTP Span**: TEI embedding request

   - URL, method, status, latency

3. **Search Span**: Qdrant hybrid query
   - Collection, operation, result count, latency

**Trace Correlation**: All spans within a single search request share a trace ID for end-to-end debugging.

---

## Summary

| Topic           | Decision                        |
| --------------- | ------------------------------- |
| Score fusion    | Qdrant RRF via Query API        |
| Multi-query     | Combined prefetch array         |
| BM25 vectors    | Client-side TF, server-side IDF |
| Query embedding | Instruction-prefixed asymmetric |
| Query expansion | Claude Haiku 4.5, 1-3 queries   |
| Pagination      | Offset-based, 20/page, max 100  |
| Observability   | Langfuse trace correlation      |
