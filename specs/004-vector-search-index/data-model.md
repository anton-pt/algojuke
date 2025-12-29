# Data Model: Vector Search Index Infrastructure

**Feature**: 004-vector-search-index
**Created**: 2025-12-29
**Source**: [spec.md](./spec.md), [research.md](./research.md)

## Overview

This data model defines the Qdrant collection schema for storing music track documents with hybrid search capabilities (vector similarity + BM25 keyword search).

## Entities

### 1. Track Document (Qdrant Point)

A single music track stored in the Qdrant vector database.

**Qdrant Point ID**: UUID (deterministic hash of ISRC)
**Collection Name**: `tracks` (configurable parameter to `initIndex.ts`)

#### Vectors

| Vector Name | Type | Dimensions | Purpose |
|-------------|------|------------|---------|
| `interpretation_embedding` | Dense | 4096 | Semantic search via Qwen3-Embedding-8B model embeddings |
| `text_sparse` | Sparse | Variable | BM25 keyword search across text fields |

#### Payload Fields

##### Required Fields

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| `isrc` | string | International Standard Recording Code | 12 alphanumeric chars (ISO 3901); indexed for lookup |
| `title` | string | Track title | Non-empty; indexed for BM25 |
| `artist` | string | Primary artist name | Non-empty; indexed for BM25 |
| `album` | string | Album name | Non-empty |

##### Optional Text Fields

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| `lyrics` | string? | Full lyrics text | Nullable (instrumental tracks); indexed for BM25 |
| `interpretation` | string? | AI-generated lyric interpretation/summary | Nullable; indexed for BM25 |

##### Optional Audio Features (reccobeats.com API)

All audio features are nullable (missing when reccobeats.com data unavailable).

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `acousticness` | float? | 0.0–1.0 | Confidence track is acoustic (organic vs electronic) |
| `danceability` | float? | 0.0–1.0 | Suitability for dancing (tempo, rhythm, beat) |
| `energy` | float? | 0.0–1.0 | Intensity and liveliness |
| `instrumentalness` | float? | 0.0–1.0 | Likelihood of no vocals (>0.5 = instrumental) |
| `key` | integer? | -1–11 | Pitch class notation (0=C, 1=C♯/D♭, ..., -1=no key detected) |
| `liveness` | float? | 0.0–1.0 | Probability of live audience (>0.8 = high confidence) |
| `loudness` | float? | -60–0 | Average loudness in dB |
| `mode` | integer? | 0 or 1 | 0=minor, 1=major |
| `speechiness` | float? | 0.0–1.0 | Presence of spoken words (>0.66 = speech-like) |
| `tempo` | float? | 0–250 | Beats per minute |
| `valence` | float? | 0.0–1.0 | Musical positivity (0=sad/dark, 1=happy/uplifting) |

#### Indexes

- **Payload index on `isrc`**: Keyword index for efficient ISRC lookups
- **Text indexes**: `title`, `artist`, `lyrics`, `interpretation` for BM25 full-text search
- **Vector index on `interpretation_embedding`**: HNSW (m=16, ef_construct=200)

### 2. Collection Configuration

**Collection Name**: `tracks` (production) / `tracks-test-{uuid}` (testing)

**Vector Config**:
```typescript
{
  interpretation_embedding: {
    size: 4096,
    distance: "Cosine",
    on_disk: false,  // Keep in memory for performance
    quantization_config: {
      scalar: {
        type: "int8",
        quantile: 0.99,
        always_ram: true
      }
    }
  },
  text_sparse: {
    sparse: true,
    modifier: "idf"  // BM25 weighting (IDF must be explicitly enabled; uses default word tokenizer with case-insensitive matching per Qdrant docs)
  }
}
```

**HNSW Config**:
```typescript
{
  m: 16,                 // Bi-directional links per node
  ef_construct: 200,     // Construction-time search depth
  hnsw_ef: 128,          // Query-time search depth
  full_scan_threshold: 10000  // Use brute force below this size
}
```

**Optimizers**:
```typescript
{
  indexing_threshold: 20000,    // Rebuild index when >20k unindexed points
  memmap_threshold: 50000,      // Memory-map segments >50k points
  max_segment_size: 200000      // Split segments above 200k points
}
```

**Resource Limits** (Docker):
- Memory: 4GB
- CPU: 2 cores

## State Transitions

### Document Lifecycle

```
[Non-existent]
    ↓ (insert via upsert)
[Indexed] ← (update via upsert with same ISRC)
    ↓ (delete - out of scope)
[Deleted]
```

**Upsert Operation** (idempotent):
1. Hash ISRC to deterministic UUID
2. Check if point with UUID exists
   - If exists: Update payload + vectors
   - If not exists: Create new point
3. Return point ID

**Uniqueness Enforcement**: ISRC uniqueness guaranteed by deterministic UUID point ID. Attempting to index same ISRC updates existing document.

## Validation Rules

### Schema Validation (Zod)

```typescript
import { z } from 'zod';

const TrackDocumentSchema = z.object({
  // Required fields
  isrc: z.string().length(12).regex(/^[A-Z0-9]{12}$/),
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().min(1),

  // Optional text fields
  lyrics: z.string().nullable().optional(),
  interpretation: z.string().nullable().optional(),

  // Vector (validated separately by Qdrant)
  interpretation_embedding: z.array(z.number()).length(4096),

  // Optional audio features
  acousticness: z.number().min(0).max(1).nullable().optional(),
  danceability: z.number().min(0).max(1).nullable().optional(),
  energy: z.number().min(0).max(1).nullable().optional(),
  instrumentalness: z.number().min(0).max(1).nullable().optional(),
  key: z.number().int().min(-1).max(11).nullable().optional(),
  liveness: z.number().min(0).max(1).nullable().optional(),
  loudness: z.number().min(-60).max(0).nullable().optional(),
  mode: z.union([z.literal(0), z.literal(1)]).nullable().optional(),
  speechiness: z.number().min(0).max(1).nullable().optional(),
  tempo: z.number().min(0).max(250).nullable().optional(),
  valence: z.number().min(0).max(1).nullable().optional(),
});

export type TrackDocument = z.infer<typeof TrackDocumentSchema>;
```

### Qdrant-Level Validation

- **Vector dimension check**: Qdrant rejects vectors with incorrect dimensionality (not 4096)
- **UUID uniqueness**: Point ID enforces ISRC uniqueness (deterministic hash)
- **Data type enforcement**: Qdrant payload schema (optional, but recommended for production)

## Relationships

### External References

- **ISRC → External Music Databases**: ISRC serves as foreign key to services like Tidal, Spotify, MusicBrainz
- **ISRC → reccobeats.com API**: ISRC used to fetch audio features (future ingestion pipeline)

### Internal References

None (single collection, no foreign keys within Qdrant).

## Query Patterns

### 1. Vector Similarity Search

Find tracks semantically similar to query embedding:

```typescript
const results = await qdrantClient.search('tracks', {
  vector: {
    name: 'interpretation_embedding',
    vector: queryEmbedding  // 4096-dim array
  },
  limit: 10,
  with_payload: true
});
```

**Expected Performance**: <500ms for 10k corpus, <200ms for 100k corpus (with quantization)

### 2. BM25 Keyword Search

Find tracks matching keyword query across text fields:

```typescript
const results = await qdrantClient.search('tracks', {
  vector: {
    name: 'text_sparse',
    vector: await generateSparseVector(queryText)  // Tokenized, IDF-weighted
  },
  limit: 10,
  with_payload: true
});
```

**Expected Performance**: <200ms for 10k corpus, <100ms for 100k corpus

### 3. Hybrid Search (Vector + Text)

Combine semantic and keyword search with Reciprocal Rank Fusion:

```typescript
const results = await qdrantClient.queryPoints('tracks', {
  prefetch: [
    {
      query: queryEmbedding,
      using: 'interpretation_embedding',
      limit: 20
    },
    {
      query: await generateSparseVector(queryText),
      using: 'text_sparse',
      limit: 20
    }
  ],
  query: { fusion: 'rrf' },  // Reciprocal Rank Fusion
  limit: 10,
  with_payload: true
});
```

### 4. ISRC Lookup

Retrieve specific track by ISRC:

```typescript
const pointId = await hashIsrcToUuid(isrc);
const result = await qdrantClient.retrieve('tracks', {
  ids: [pointId],
  with_payload: true,
  with_vector: false
});
```

**Expected Performance**: <10ms (indexed lookup)

### 5. Filtered Search

Search with audio feature filters:

```typescript
const results = await qdrantClient.search('tracks', {
  vector: {
    name: 'interpretation_embedding',
    vector: queryEmbedding
  },
  filter: {
    must: [
      { key: 'danceability', range: { gte: 0.7 } },
      { key: 'energy', range: { gte: 0.6 } },
      { key: 'mode', match: { value: 1 } }  // Major key
    ]
  },
  limit: 10
});
```

## Schema Evolution

### Adding Optional Fields

New optional fields can be added without re-indexing (schema-less payload):

```typescript
// Add new field to existing documents via upsert
await qdrantClient.setPayload('tracks', {
  points: [pointId],
  payload: {
    new_optional_field: value
  }
});
```

### Breaking Changes (Requires Re-indexing)

- Changing vector dimensions (4096 → X)
- Changing required field types
- Changing distance metric (Cosine → Euclidean)

**Re-indexing Process**:
1. Create new collection with updated schema (`tracks_v2`)
2. Copy documents with transformation
3. Swap collection names (atomic via alias)
4. Delete old collection

## Performance Characteristics

### Memory Footprint (100k corpus)

| Component | Size | Notes |
|-----------|------|-------|
| Vector data (4096 × 100k × 4 bytes) | 1.6 GB | Float32 vectors |
| Quantized vectors (4096 × 100k × 1 byte) | 410 MB | int8 quantization |
| HNSW graph (m=16) | ~200 MB | Graph structure |
| Payload data | ~100 MB | JSON metadata |
| **Total** | **~2.3 GB** | Fits within 4GB Docker limit |

### Latency Targets

| Operation | Target | Expected (100k corpus) |
|-----------|--------|------------------------|
| Vector search | <500ms | 150-200ms |
| Keyword search | <200ms | 50-100ms |
| Hybrid search | <600ms | 200-300ms |
| ISRC lookup | <50ms | 5-10ms |
| Insert/update | <100ms | 20-50ms |

### Throughput

- **Indexing**: ~1000-2000 docs/sec (batch upserts)
- **Search**: ~100-200 queries/sec (concurrent reads)

## Testing Considerations

### Test Fixtures

```typescript
const testTrack: TrackDocument = {
  isrc: 'USRC17607839',
  title: 'Test Track',
  artist: 'Test Artist',
  album: 'Test Album',
  lyrics: 'Sample lyrics for testing',
  interpretation: 'This song is about testing',
  interpretation_embedding: new Array(4096).fill(0.1),  // Dummy vector
  acousticness: 0.5,
  danceability: 0.7,
  energy: 0.6,
  // ... other audio features
};
```

### Test Collection Lifecycle

```typescript
// Setup: Create test collection
const testCollectionName = `tracks-test-${randomUUID()}`;
await initIndex(testCollectionName);

// Test operations...

// Teardown: Delete test collection
await qdrantClient.deleteCollection(testCollectionName);
```

### Schema Validation Tests

- Valid documents pass schema validation
- Invalid ISRC format rejected
- Missing required fields rejected
- Out-of-range audio features rejected
- Incorrect vector dimensions rejected by Qdrant

### Uniqueness Tests

- Inserting same ISRC twice updates (no duplicate)
- Different ISRCs create separate documents
- UUID collision test (virtually impossible, but verify hash determinism)
