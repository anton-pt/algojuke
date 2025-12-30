# Data Model: Semantic Discovery Search

**Feature**: 009-semantic-discovery-search
**Date**: 2025-12-30

## Entities

### 1. DiscoveryQuery

User-provided natural language search input.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| text | string | Yes | User's natural language query (1 to 2000 chars) |
| timestamp | DateTime | Yes | When the query was submitted |

**Validation Rules**:
- `text` must not be empty or whitespace-only
- `text` must be no more than 2000 characters
- `text` is trimmed before processing

### 2. ExpandedQuery

LLM-generated search query derived from user input.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| text | string | Yes | Optimized search query (5-50 words) |
| denseVector | number[1024] | Yes | Embedding vector from TEI |
| sparseVector | SparseVector | Yes | BM25 TF vector for keyword search |

**Relationships**:
- Generated from DiscoveryQuery (1 DiscoveryQuery → 1-3 ExpandedQueries)

### 3. SparseVector

BM25 term frequency vector for keyword search.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| indices | number[] | Yes | Token hash values (MD5 first 4 bytes) |
| values | number[] | Yes | Term frequency weights (BM25-style saturation) |

**Invariants**:
- `indices.length === values.length`
- All indices are positive integers

### 4. DiscoveryResult

A track returned from hybrid search.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Qdrant point UUID (derived from ISRC) |
| isrc | string | Yes | Track ISRC (12 alphanumeric characters) |
| title | string | Yes | Track title |
| artist | string | Yes | Artist name |
| album | string | Yes | Album name |
| score | number | Yes | RRF-combined relevance score |
| artworkUrl | string | No | Album artwork URL (if available) |

**Relationships**:
- References indexed track document in Qdrant
- Can be expanded to show ExtendedTrackMetadata (via existing 008 query)

### 5. DiscoverySearchResponse

Complete response for a discovery search request.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| results | DiscoveryResult[] | Yes | Ordered list of matching tracks |
| query | string | Yes | Original user query |
| expandedQueries | string[] | Yes | LLM-generated search queries (1-3) |
| page | number | Yes | Current page (0-indexed) |
| pageSize | number | Yes | Results per page (20) |
| totalResults | number | Yes | Total matches (capped at 100) |
| hasMore | boolean | Yes | Whether more results available |

### 6. QueryExpansionResult

Result from LLM query expansion step.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| queries | string[] | Yes | 1-3 expanded search queries |
| model | string | Yes | LLM model used (claude-haiku-4-5) |
| inputTokens | number | Yes | Prompt tokens consumed |
| outputTokens | number | Yes | Completion tokens generated |

---

## Existing Entities (Referenced)

### ExtendedTrackMetadata (from 008-track-metadata-display)

Extended metadata for accordion display. Fetched via existing `getExtendedTrackMetadata(isrc)` query.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| isrc | string | Yes | Track ISRC |
| lyrics | string | No | Full lyrics text |
| interpretation | string | No | LLM-generated thematic interpretation |
| audioFeatures | AudioFeatures | No | 11 audio analysis features |

### AudioFeatures (from 008-track-metadata-display)

| Field | Type | Description |
|-------|------|-------------|
| acousticness | number | 0.0-1.0 scale |
| danceability | number | 0.0-1.0 scale |
| energy | number | 0.0-1.0 scale |
| instrumentalness | number | 0.0-1.0 scale |
| key | number | Pitch class (0-11, -1 for unknown) |
| liveness | number | 0.0-1.0 scale |
| loudness | number | dB (-60 to 0) |
| mode | number | 0 (minor) or 1 (major) |
| speechiness | number | 0.0-1.0 scale |
| tempo | number | BPM |
| valence | number | 0.0-1.0 scale (sad to happy) |

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ User Input                                                               │
│ "melancholic songs about late nights"                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Query Expansion (Claude Haiku 4.5)                                      │
│ → ["sad melancholic songs about nighttime", "lonely late night music"]  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                        ┌───────────┴───────────┐
                        ▼                       ▼
┌───────────────────────────────┐  ┌───────────────────────────────┐
│ TEI Embedding                  │  │ Sparse Vector Generation      │
│ (1024-dim per query)           │  │ (BM25 TF per query)           │
└───────────────────────────────┘  └───────────────────────────────┘
                        │                       │
                        └───────────┬───────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Qdrant Hybrid Search                                                     │
│ - Prefetch: dense + sparse for each expanded query                      │
│ - Fusion: RRF                                                           │
│ - Deduplication: by ISRC                                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ DiscoverySearchResponse                                                  │
│ - results: DiscoveryResult[]                                            │
│ - pagination metadata                                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                        ┌───────────┴───────────┐
                        ▼                       ▼
┌───────────────────────────────┐  ┌───────────────────────────────┐
│ Display Results               │  │ On Accordion Expand            │
│ (title, artist, album, score) │  │ → getExtendedTrackMetadata()   │
└───────────────────────────────┘  └───────────────────────────────┘
```

---

## Storage Considerations

### No New Persistent Storage Required

- **Qdrant**: Already contains indexed tracks with all needed fields
- **Session State**: Search results are transient (not persisted)
- **Cache**: Optional Apollo Client cache for repeat queries

### Qdrant Collection Schema (Existing)

The `tracks` collection already supports all required operations:

| Index Type | Field | Purpose |
|------------|-------|---------|
| Dense vector | interpretation_embedding | Semantic similarity search |
| Sparse vector | text_sparse | BM25 keyword search |
| Text payload | lyrics | BM25 content matching |
| Text payload | interpretation | BM25 theme matching |
| Keyword payload | isrc | Deduplication grouping |

---

## Validation Schemas (Zod)

```typescript
import { z } from 'zod';

export const DiscoveryQuerySchema = z.object({
  text: z.string().min(1).max(2000).transform(s => s.trim()),
});

export const SparseVectorSchema = z.object({
  indices: z.array(z.number().int().nonnegative()),
  values: z.array(z.number()),
}).refine(
  data => data.indices.length === data.values.length,
  { message: 'indices and values must have same length' }
);

export const DiscoveryResultSchema = z.object({
  id: z.string(),
  isrc: z.string().regex(/^[A-Z0-9]{12}$/i),
  title: z.string(),
  artist: z.string(),
  album: z.string(),
  score: z.number(),
  artworkUrl: z.string().url().optional(),
});

export const DiscoverySearchResponseSchema = z.object({
  results: z.array(DiscoveryResultSchema),
  query: z.string(),
  expandedQueries: z.array(z.string()).min(1).max(3),
  page: z.number().int().nonnegative(),
  pageSize: z.number().int().positive(),
  totalResults: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});
```
