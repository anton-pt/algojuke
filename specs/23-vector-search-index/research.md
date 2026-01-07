# Qdrant Vector Database Research for Music Track Search Index

Research compiled on 2025-12-29 for implementing a music track search system with vector embeddings, text search, and audio features.

---

## 1. Collection Schema Design

### Decision: Use Named Vectors with Payload Schema

**Rationale:**
- Qdrant supports **named vectors**, allowing multiple vector types per point (dense + sparse)
- Payload is schema-less by default, enabling flexible optional fields
- Collections support both structured vector configuration and arbitrary JSON payloads

**Recommended Schema:**

```typescript
{
  vectors: {
    interpretation_embedding: {
      size: 4096,
      distance: "Cosine",
      on_disk: false  // Keep in RAM for speed
    },
    text_sparse: {
      sparse: true,
      modifier: "IDF"  // For BM25 text search
    }
  },
  optimizers_config: {
    default_segment_number: 2  // Match CPU cores
  },
  hnsw_config: {
    m: 16,              // Balanced memory/precision
    ef_construct: 200,  // Quality index build
    on_disk: false      // Keep HNSW in RAM
  }
}
```

**Payload Structure:**

```typescript
{
  isrc: string,           // Unique identifier (primary key)
  title: string,          // For BM25 search
  artist: string,         // For BM25 search
  album: string | null,   // Optional
  lyrics: string | null,  // For BM25 search
  interpretation: string, // For BM25 search

  // Audio features (all optional, float/int)
  tempo?: number,
  energy?: number,
  danceability?: number,
  valence?: number,
  acousticness?: number,
  instrumentalness?: number,
  liveness?: number,
  speechiness?: number,
  loudness?: number,
  key?: number,
  mode?: number
}
```

**Alternatives Considered:**
1. **Single dense vector only**: Rejected - lacks keyword search capability for specialized music terms
2. **Separate collections**: Rejected - would duplicate payload data and complicate updates
3. **External metadata store**: Rejected - adds latency and complexity for ISRC lookups

**Sources:**
- [Collections - Qdrant](https://qdrant.tech/documentation/concepts/collections/)
- [Vectors - Qdrant](https://qdrant.tech/documentation/concepts/vectors/)
- [Named Vectors - Optimizing Semantic Search](https://qdrant.tech/articles/storing-multiple-vectors-per-object-in-qdrant/)

---

## 2. BM25 Text Search Configuration

### Decision: Use Sparse Vectors with IDF Modifier + Payload Text Indexes

**Rationale:**
- Qdrant's sparse vectors with `Modifier.IDF` enable proper BM25 scoring
- FastEmbed integration simplifies BM25 vector generation
- Combines with dense vectors for powerful hybrid search
- Text processing options (stemming, stopwords) optimize for English lyrics/titles

**Configuration:**

```typescript
// Collection creation with sparse vectors for BM25
await client.createCollection(COLLECTION_NAME, {
  vectors: {
    interpretation_embedding: {
      size: 4096,
      distance: "Cosine"
    },
    text_sparse: {
      sparse: true,
      modifier: "IDF"  // Required for BM25
    }
  }
});

// Create text indexes for fields
await client.createPayloadIndex(COLLECTION_NAME, {
  field_name: "title",
  field_schema: "text",
  text_index_params: {
    tokenizer: "word",
    min_token_len: 2,
    max_token_len: 20,
    lowercase: true,
    remove_stopwords: true  // English by default
  }
});

// Repeat for artist, lyrics, interpretation fields
```

**BM25 Parameters:**
- `k` (default: 1.2): Controls term frequency saturation - suitable for music metadata
- `b` (default: 0.75): Document length normalization - good for variable-length lyrics
- `avg_len` (default: 256): Average words - adjust to ~50 for song titles, ~200 for lyrics

**Best Practices:**
1. Enable IDF modifier when using BM25 sparse vectors
2. Configure English stemming/stopwords for lyrics
3. Use separate text indexes on `title`, `artist`, `lyrics`, `interpretation` for efficient filtering
4. Combine BM25 with dense vectors using hybrid search for best results

**Alternatives Considered:**
1. **Tantivy-based text index only**: Rejected - limited to text, no semantic search
2. **Dense vectors only**: Rejected - poor performance on exact artist/title matches
3. **BM42**: Rejected - newer experimental approach, BM25 proven for production

**Sources:**
- [BM25: New Baseline for Hybrid Search - Qdrant](https://qdrant.tech/articles/bm42/)
- [Text Search - Qdrant](https://qdrant.tech/documentation/guides/text-search/)
- [Hybrid Search Revamped - Qdrant](https://qdrant.tech/articles/hybrid-search/)
- [Qdrant/bm25 · Hugging Face](https://huggingface.co/Qdrant/bm25)

---

## 3. ISRC Uniqueness Enforcement

### Decision: Use ISRC as Point ID with UUID Mapping

**Rationale:**
- Qdrant requires point IDs to be either uint64 or UUID
- ISRC (12 alphanumeric characters) doesn't fit directly
- Hash ISRC to UUID for use as point ID
- Store original ISRC in payload with keyword index for lookups
- Upsert operations naturally handle uniqueness

**Implementation:**

```typescript
import { createHash } from 'crypto';

function isrcToUUID(isrc: string): string {
  // Generate deterministic UUID from ISRC
  const hash = createHash('sha256').update(isrc).digest('hex');
  // Format as UUID v4
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16),  // Version 4
    hash.substring(16, 20),
    hash.substring(20, 32)
  ].join('-');
}

// Upsert point with ISRC-derived UUID
await client.upsert(COLLECTION_NAME, {
  points: [{
    id: isrcToUUID(track.isrc),
    vector: {
      interpretation_embedding: embedding,
      text_sparse: sparseVector
    },
    payload: {
      isrc: track.isrc,  // Store original
      title: track.title,
      // ... other fields
    }
  }]
});
```

**Create Keyword Index for ISRC:**

```typescript
await client.createPayloadIndex(COLLECTION_NAME, {
  field_name: "isrc",
  field_schema: "keyword"
});
```

**Uniqueness Behavior:**
- Upserting with same ID **replaces** the existing point
- No duplicate prevention needed - deterministic UUID ensures same ISRC = same ID
- Concurrent updates: Use optimistic concurrency control with version field if needed

**Alternatives Considered:**
1. **Auto-increment IDs**: Rejected - requires external mapping, loses ISRC semantics
2. **Random UUIDs**: Rejected - allows duplicates, requires pre-check queries
3. **ISRC in payload only**: Rejected - slower retrieval, requires filter queries

**Sources:**
- [Points - Qdrant](https://qdrant.tech/documentation/concepts/points/)
- [Best practices for ID generation · Discussion #3461](https://github.com/orgs/qdrant/discussions/3461)
- [Handling duplicates · Discussion #3268](https://github.com/orgs/qdrant/discussions/3268)

---

## 4. Handling Optional/Nullable Fields

### Decision: Schema-less Payload with Null Checking Filters

**Rationale:**
- Qdrant payloads are schema-less JSON by default
- Optional fields can be omitted or set to `null`
- Use `is_null` and `is_empty` filter conditions for queries
- Payload indexes work with sparse data automatically

**Implementation:**

```typescript
// Insert with optional fields
await client.upsert(COLLECTION_NAME, {
  points: [{
    id: pointId,
    vector: { interpretation_embedding: embedding },
    payload: {
      isrc: "USRC12345678",
      title: "Song Title",
      artist: "Artist Name",
      album: null,              // Explicitly null
      tempo: 120.5,
      // energy field omitted entirely
      danceability: 0.8
    }
  }]
});

// Query for tracks with missing album
const results = await client.scroll(COLLECTION_NAME, {
  filter: {
    must: [{
      key: "album",
      is_null: true
    }]
  }
});

// Query for tracks with tempo defined
const withTempo = await client.scroll(COLLECTION_NAME, {
  filter: {
    must_not: [{
      key: "tempo",
      is_null: true
    }]
  }
});
```

**Indexing Optional Fields:**
- Create indexes only for frequently filtered fields
- Sparse data doesn't impact index efficiency significantly
- "The more different values a payload value has, the more efficiently the index will be used"

**Best Practices:**
1. Use `null` for known-but-missing data (album not provided)
2. Omit fields entirely for unknown data (feature not calculated)
3. Create indexes on optional fields used in filters (e.g., `tempo` for range queries)
4. Use `is_null` / `is_empty` conditions to filter by field presence

**Alternatives Considered:**
1. **Strict schema with defaults**: Rejected - inflates storage, complicates nullability semantics
2. **Separate collections per data completeness**: Rejected - maintenance nightmare
3. **Bitmap for field presence**: Rejected - unnecessary complexity, filters handle this

**Sources:**
- [Payload - Qdrant](https://qdrant.tech/documentation/concepts/payload/)
- [Filtering - Qdrant](https://qdrant.tech/documentation/concepts/filtering/)
- [qdrant_client.http.models.models — Documentation](https://python-client.qdrant.tech/qdrant_client.http.models.models)

---

## 5. Collection Initialization and Schema Management

### Decision: Idempotent Initialization with Runtime Updates

**Rationale:**
- Check collection existence before creation (idempotent)
- Create payload indexes after collection creation
- Qdrant 1.4+ allows runtime updates to HNSW, quantization, disk configs
- Version collection metadata for schema migrations

**Implementation:**

```typescript
import { QdrantClient } from "@qdrant/js-client-rest";

const COLLECTION_NAME = "music_tracks";
const VECTOR_SIZE = 4096;

async function initializeCollection(client: QdrantClient): Promise<void> {
  // Check if collection exists
  const collections = await client.getCollections();
  const exists = collections.collections.some(
    c => c.name === COLLECTION_NAME
  );

  if (!exists) {
    // Create collection
    await client.createCollection(COLLECTION_NAME, {
      vectors: {
        interpretation_embedding: {
          size: VECTOR_SIZE,
          distance: "Cosine",
          on_disk: false
        },
        text_sparse: {
          sparse: true,
          modifier: "IDF"
        }
      },
      optimizers_config: {
        default_segment_number: 2
      },
      hnsw_config: {
        m: 16,
        ef_construct: 200,
        on_disk: false
      },
      // Store schema version in metadata
      metadata: {
        schema_version: "1.0",
        created_at: new Date().toISOString(),
        embedding_model: "text-embedding-3-large"
      }
    });

    // Create payload indexes
    await createPayloadIndexes(client);
  } else {
    // Optionally validate/update schema
    await validateCollectionSchema(client);
  }
}

async function createPayloadIndexes(client: QdrantClient): Promise<void> {
  // ISRC keyword index (unique lookups)
  await client.createPayloadIndex(COLLECTION_NAME, {
    field_name: "isrc",
    field_schema: "keyword"
  });

  // Text indexes for BM25 search
  const textFields = ["title", "artist", "lyrics", "interpretation"];
  for (const field of textFields) {
    await client.createPayloadIndex(COLLECTION_NAME, {
      field_name: field,
      field_schema: "text"
    });
  }

  // Integer/float indexes for audio features
  await client.createPayloadIndex(COLLECTION_NAME, {
    field_name: "tempo",
    field_schema: "float"
  });

  await client.createPayloadIndex(COLLECTION_NAME, {
    field_name: "key",
    field_schema: "integer"
  });

  // Repeat for other frequently filtered audio features
}

async function validateCollectionSchema(client: QdrantClient): Promise<void> {
  const info = await client.getCollection(COLLECTION_NAME);
  const currentVersion = info.metadata?.schema_version;

  // Handle migrations if schema_version differs
  if (currentVersion !== "1.0") {
    // Run migration logic
  }
}
```

**Runtime Configuration Updates:**

```typescript
// Update HNSW parameters without recreating collection (Qdrant 1.4+)
await client.updateCollection(COLLECTION_NAME, {
  hnsw_config: {
    m: 32,              // Increase for better recall
    ef_construct: 400
  }
});

// Enable quantization for existing collection
await client.updateCollection(COLLECTION_NAME, {
  quantization_config: {
    scalar: {
      type: "int8",
      quantile: 0.99,
      always_ram: true
    }
  }
});
```

**Best Practices:**
1. Always check existence before creation (idempotent)
2. Store schema version in collection metadata
3. Create indexes immediately after collection creation
4. Use descriptive metadata (model name, creation time)
5. Leverage runtime updates for HNSW/quantization tuning

**Alternatives Considered:**
1. **Recreate on every startup**: Rejected - data loss risk, slow
2. **Manual schema migrations**: Rejected - error-prone, not version-controlled
3. **Fixed schema forever**: Rejected - can't optimize post-deployment

**Sources:**
- [Collections - Qdrant](https://qdrant.tech/documentation/concepts/collections/)
- [GitHub - qdrant-js SDK](https://github.com/qdrant/qdrant-js)
- [Administration - Qdrant](https://qdrant.tech/documentation/guides/administration/)
- [Collection initialization guide](https://encore.dev/blog/qdrant-semantic-search)

---

## 6. HNSW Vector Indexing Parameters

### Decision: Balanced Profile for 100k Corpus

**Rationale:**
- 100k vectors is medium-scale, fits comfortably in RAM
- Target <500ms search requires in-memory HNSW with moderate recall
- Balanced m/ef_construct provides 95%+ recall with reasonable build time

**Recommended Parameters:**

```typescript
{
  hnsw_config: {
    m: 16,                    // 16-32 edges per node (16 for balanced)
    ef_construct: 200,        // Build quality (100-400 range)
    full_scan_threshold: 10000  // Use brute force below this count
  },
  optimizers_config: {
    default_segment_number: 2  // Match available CPU cores (2 for Docker limit)
  }
}
```

**Query-time Parameter:**

```typescript
const results = await client.search(COLLECTION_NAME, {
  vector: queryEmbedding,
  limit: 10,
  params: {
    hnsw_ef: 128  // 64-256 typical, higher = better recall, slower
  }
});
```

**Parameter Tuning Guide:**

| Profile | m | ef_construct | hnsw_ef | Use Case |
|---------|---|--------------|---------|----------|
| Fast Ingest | 0 | 100 | N/A | Bulk upload only (disable indexing) |
| Memory Optimized | 8 | 100 | 64 | Low RAM, acceptable recall |
| **Balanced (Recommended)** | **16** | **200** | **128** | **General purpose, 100k corpus** |
| High Quality | 32 | 400 | 256 | Maximum recall, slower build/search |

**Performance Expectations (100k corpus, 4096-dim vectors):**
- Memory: ~600MB (vectors) + ~150MB (HNSW) = 750MB
- Build time: ~30-60 seconds with ef_construct=200
- Search latency: <100ms for hnsw_ef=128 (well under 500ms target)
- Recall: 95-98% at top-10

**Optimization Strategies:**
1. **For bulk ingestion**: Set `m=0` during upload, rebuild index after
2. **For tight RAM**: Reduce `m=8`, keep `ef_construct=200` for quality links
3. **For maximum recall**: Increase `m=32`, `ef_construct=400`, `hnsw_ef=256`
4. **For latency**: Keep `hnsw_ef=64-128`, use quantization

**Alternatives Considered:**
1. **High-quality profile (m=32)**: Rejected for 100k - overkill, doubles memory, minimal recall gain
2. **Fast profile (m=8)**: Rejected - recall drops to ~90%, unacceptable for music recommendations
3. **GPU indexing**: Rejected - requires specialized hardware, not needed for 100k scale

**Sources:**
- [Indexing - Qdrant](https://qdrant.tech/documentation/concepts/indexing/)
- [Demo: HNSW Performance Tuning](https://qdrant.tech/course/essentials/day-2/collection-tuning-demo/)
- [Optimize Performance - Qdrant](https://qdrant.tech/documentation/guides/optimize/)
- [Vector Search Resource Optimization](https://qdrant.tech/articles/vector-search-resource-optimization/)

---

## 7. Docker Deployment with Resource Limits

### Decision: 4GB RAM / 2 CPU with Scalar Quantization

**Rationale:**
- 100k × 4096-dim vectors = ~1.6GB raw data
- HNSW adds ~300MB overhead
- Quantization reduces memory by 75% (1.6GB → 400MB)
- Headroom for payload, OS, buffers

**Docker Compose Configuration:**

```yaml
version: '3.8'

services:
  qdrant:
    image: qdrant/qdrant:v1.13.2  # Use latest stable
    ports:
      - "6333:6333"  # HTTP API
      - "6334:6334"  # gRPC API
    volumes:
      - ./qdrant_storage:/qdrant/storage
    environment:
      - QDRANT__SERVICE__HTTP_PORT=6333
      - QDRANT__SERVICE__GRPC_PORT=6334
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
```

**Collection Configuration for Resource Limits:**

```typescript
await client.createCollection(COLLECTION_NAME, {
  vectors: {
    interpretation_embedding: {
      size: 4096,
      distance: "Cosine",
      on_disk: false  // Keep in RAM with quantization
    }
  },
  optimizers_config: {
    default_segment_number: 2,  // Match CPU limit
    memmap_threshold: 20000      // Memory-map segments over 20k vectors
  },
  hnsw_config: {
    m: 16,
    ef_construct: 200,
    on_disk: false
  },
  quantization_config: {
    scalar: {
      type: "int8",           // 75% memory reduction
      quantile: 0.99,         // Preserve 99% of value range
      always_ram: true        // Keep quantized vectors in RAM
    }
  }
});
```

**Memory Budget Breakdown (4GB limit):**

| Component | Size | Notes |
|-----------|------|-------|
| Original vectors (on-disk) | 1.6GB | Memory-mapped, not counted |
| Quantized vectors (RAM) | 400MB | int8 compression |
| HNSW graph (RAM) | 150MB | m=16, 100k points |
| Payload data (RAM) | 200MB | ~2KB per track × 100k |
| Sparse vectors (RAM) | 100MB | BM25 sparse vectors |
| OS + Qdrant overhead | 500MB | Runtime, buffers |
| **Total** | **~1.4GB** | **Well under 4GB limit** |

**CPU Utilization:**
- 2 CPU cores → `default_segment_number: 2`
- Each search query parallelized across 2 segments
- Bulk ingestion benefits from parallel segment processing

**Best Practices:**
1. Use **scalar quantization** (int8) for 75% memory reduction
2. Set `always_ram: true` for quantized vectors (fast access)
3. Keep original vectors on-disk with memory-mapping
4. Match `default_segment_number` to CPU cores
5. Use local SSD storage for on-disk vectors (50k+ IOPS)
6. Monitor with Prometheus metrics (Qdrant exposes `/metrics`)

**Performance Impact:**
- Quantization: ~5% recall reduction (negligible with rescoring)
- Memory-mapped vectors: +10-20ms latency on cold reads
- Expected search latency: 100-200ms (well under 500ms target)

**Alternatives Considered:**
1. **Binary quantization**: Rejected - 40x faster but significant accuracy loss for 4096-dim vectors
2. **Full on-disk storage**: Rejected - exceeds 500ms latency target
3. **8GB RAM**: Rejected - unnecessary, quantization fits in 4GB

**Sources:**
- [Minimal RAM for Million Vectors - Qdrant](https://qdrant.tech/articles/memory-consumption/)
- [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints/)
- [Database Optimization - Qdrant](https://qdrant.tech/documentation/faq/database-optimization/)
- [Qdrant Docker Hub](https://hub.docker.com/r/qdrant/qdrant)

---

## 8. TypeScript Client API

### 8.1 Collection Creation

```typescript
import { QdrantClient } from "@qdrant/js-client-rest";

const client = new QdrantClient({
  url: "http://localhost:6333",
  apiKey: process.env.QDRANT_API_KEY  // Optional for cloud
});

// Create collection with multiple named vectors
await client.createCollection("music_tracks", {
  vectors: {
    interpretation_embedding: {
      size: 4096,
      distance: "Cosine"
    },
    text_sparse: {
      sparse: true,
      modifier: "IDF"
    }
  },
  optimizers_config: {
    default_segment_number: 2
  },
  hnsw_config: {
    m: 16,
    ef_construct: 200
  }
});
```

### 8.2 Document Upsert (by ISRC)

```typescript
import { createHash } from 'crypto';

function isrcToUUID(isrc: string): string {
  const hash = createHash('sha256').update(isrc).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16),
    hash.substring(16, 20),
    hash.substring(20, 32)
  ].join('-');
}

// Upsert single track
await client.upsert("music_tracks", {
  points: [{
    id: isrcToUUID(track.isrc),
    vector: {
      interpretation_embedding: interpretationEmbedding,
      text_sparse: sparseVector  // From BM25 model
    },
    payload: {
      isrc: track.isrc,
      title: track.title,
      artist: track.artist,
      album: track.album,
      lyrics: track.lyrics,
      interpretation: track.interpretation,
      tempo: track.tempo,
      energy: track.energy
      // ... other audio features
    }
  }]
});

// Batch upsert (more efficient)
const points = tracks.map(track => ({
  id: isrcToUUID(track.isrc),
  vector: {
    interpretation_embedding: track.embedding,
    text_sparse: track.sparseVector
  },
  payload: {
    isrc: track.isrc,
    title: track.title,
    // ... other fields
  }
}));

await client.upsert("music_tracks", {
  points,
  wait: true  // Wait for indexing to complete
});
```

### 8.3 Vector Similarity Search

```typescript
// Search by interpretation embedding
const results = await client.search("music_tracks", {
  vector: {
    name: "interpretation_embedding",
    vector: queryEmbedding
  },
  limit: 10,
  params: {
    hnsw_ef: 128  // Search precision parameter
  },
  with_payload: true,
  with_vector: false  // Don't return vectors to save bandwidth
});

// Search with filters
const filteredResults = await client.search("music_tracks", {
  vector: {
    name: "interpretation_embedding",
    vector: queryEmbedding
  },
  filter: {
    must: [
      {
        key: "artist",
        match: { value: "The Beatles" }
      },
      {
        key: "tempo",
        range: { gte: 100, lte: 140 }
      }
    ]
  },
  limit: 20
});
```

### 8.4 BM25 Text Search

```typescript
// Text search using sparse vectors
const textResults = await client.search("music_tracks", {
  vector: {
    name: "text_sparse",
    vector: textSparseVector  // Generated from query text
  },
  limit: 10,
  with_payload: true
});

// Alternative: Use text index filter (if payload indexed)
const filterResults = await client.scroll("music_tracks", {
  filter: {
    should: [
      {
        key: "title",
        match: { text: "love song" }
      },
      {
        key: "lyrics",
        match: { text: "love song" }
      }
    ]
  },
  limit: 10,
  with_payload: true
});
```

### 8.5 Hybrid Search (Vector + Text)

```typescript
// Hybrid search with reciprocal rank fusion
const hybridResults = await client.query("music_tracks", {
  prefetch: [
    {
      // Dense vector search
      query: queryEmbedding,
      using: "interpretation_embedding",
      limit: 20
    },
    {
      // Sparse BM25 search
      query: textSparseVector,
      using: "text_sparse",
      limit: 20
    }
  ],
  query: {
    fusion: "rrf"  // Reciprocal Rank Fusion
  },
  limit: 10,
  with_payload: true
});

// Alternative: Distribution-based score fusion
const hybridResults2 = await client.query("music_tracks", {
  prefetch: [
    { query: queryEmbedding, using: "interpretation_embedding", limit: 20 },
    { query: textSparseVector, using: "text_sparse", limit: 20 }
  ],
  query: {
    fusion: "dbsf"  // Distribution Based Score Fusion
  },
  limit: 10
});
```

### 8.6 Retrieve by ISRC (Unique ID)

```typescript
// Direct retrieval by point ID
const track = await client.retrieve("music_tracks", {
  ids: [isrcToUUID("USRC12345678")],
  with_payload: true,
  with_vector: false
});

// Retrieve by ISRC payload field (requires keyword index)
const trackByISRC = await client.scroll("music_tracks", {
  filter: {
    must: [{
      key: "isrc",
      match: { value: "USRC12345678" }
    }]
  },
  limit: 1,
  with_payload: true
});

// Batch retrieve multiple ISRCs
const tracks = await client.retrieve("music_tracks", {
  ids: isrcs.map(isrcToUUID),
  with_payload: true
});
```

**Sources:**
- [GitHub - qdrant-js SDK](https://github.com/qdrant/qdrant-js)
- [Qdrant API Reference](https://api.qdrant.tech/api-reference)
- [Points - Qdrant](https://qdrant.tech/documentation/concepts/points/)
- [Hybrid Queries - Qdrant](https://qdrant.tech/documentation/concepts/hybrid-queries/)

---

## 9. Performance Tuning for 100k Corpus

### Decision: In-Memory Quantized Vectors + Indexed Payloads

**Target Performance:**
- Vector search: <500ms (target: 100-200ms)
- Text search: <200ms (target: 50-100ms)
- Corpus size: 100k documents

**Recommended Configuration:**

```typescript
{
  vectors: {
    interpretation_embedding: {
      size: 4096,
      distance: "Cosine",
      on_disk: false  // Keep in RAM for speed
    }
  },
  optimizers_config: {
    default_segment_number: 2,     // Match CPU cores
    indexing_threshold: 20000,     // Build HNSW after 20k points
    memmap_threshold: 20000        // Memory-map large segments
  },
  hnsw_config: {
    m: 16,
    ef_construct: 200,
    on_disk: false,
    full_scan_threshold: 10000
  },
  quantization_config: {
    scalar: {
      type: "int8",
      quantile: 0.99,
      always_ram: true
    }
  }
}
```

**Query Optimization:**

```typescript
// Optimized search query
const results = await client.search("music_tracks", {
  vector: {
    name: "interpretation_embedding",
    vector: queryEmbedding
  },
  limit: 10,
  params: {
    hnsw_ef: 128,          // Balanced recall/speed
    exact: false,          // Use approximate search
    quantization: {
      rescore: true,       // Rescore with original vectors
      oversampling: 2.0    // Fetch 2x candidates for rescoring
    }
  },
  with_payload: true,
  with_vector: false       // Skip vectors in response
});
```

**Performance Optimization Checklist:**

1. **Segment Configuration**
   - Set `default_segment_number` = CPU cores (2 for Docker limit)
   - Each segment processes in parallel

2. **Quantization Strategy**
   - Use scalar int8 quantization (75% memory reduction)
   - Enable `rescore: true` for accuracy recovery
   - Set `oversampling: 2.0` (fetch 20 candidates, rescore to 10)

3. **Payload Indexing**
   - Create keyword index on `isrc` (unique lookups)
   - Create text indexes on `title`, `artist`, `lyrics`, `interpretation`
   - Create float/int indexes on frequently filtered audio features

4. **HNSW Tuning**
   - Use `hnsw_ef=128` for queries (adjust 64-256 based on recall needs)
   - Set `full_scan_threshold=10000` (brute force for small result sets)

5. **Disk I/O Optimization**
   - Use local SSD with 50k+ IOPS
   - Memory-map large segments (above `memmap_threshold`)
   - Keep quantized vectors + HNSW in RAM

**Expected Performance (100k corpus):**

| Operation | Latency | Throughput | Notes |
|-----------|---------|------------|-------|
| Vector search (top-10) | 80-150ms | ~100 RPS | With quantization + rescoring |
| Text search (BM25) | 30-80ms | ~200 RPS | With payload text indexes |
| Hybrid search | 120-200ms | ~70 RPS | RRF fusion of dense + sparse |
| ISRC retrieval | 5-15ms | ~1000 RPS | Direct ID lookup |
| Batch upsert (1k points) | 2-5 sec | ~200-500 points/sec | With indexing |

**Latency Reduction Strategies:**

1. **For faster search (<100ms)**:
   - Reduce `hnsw_ef` to 64
   - Use binary quantization (40x speedup, some accuracy loss)
   - Increase `default_segment_number` to 4 (if more CPUs available)

2. **For better recall (>98%)**:
   - Increase `hnsw_ef` to 256
   - Increase `m` to 32
   - Set `oversampling: 3.0` for quantization rescoring

3. **For high throughput (>200 RPS)**:
   - Scale horizontally (Qdrant cluster)
   - Use read replicas
   - Enable request batching

**Monitoring & Tuning:**

```bash
# Check Prometheus metrics
curl http://localhost:6333/metrics

# Key metrics to monitor:
# - search_request_duration_seconds_bucket (latency)
# - search_request_total (throughput)
# - memory_rss_bytes (RAM usage)
# - disk_read_bytes_total (I/O load)
```

**Alternatives Considered:**
1. **Full on-disk storage**: Rejected - latency >500ms, misses target
2. **No quantization**: Rejected - requires 6GB+ RAM for 100k corpus
3. **Binary quantization**: Rejected - too much accuracy loss for 4096-dim embeddings

**Sources:**
- [Optimize Performance - Qdrant](https://qdrant.tech/documentation/guides/optimize/)
- [Demo: HNSW Performance Tuning](https://qdrant.tech/course/essentials/day-2/collection-tuning-demo/)
- [Vector Search Resource Optimization](https://qdrant.tech/articles/vector-search-resource-optimization/)
- [Database Optimization - Qdrant](https://qdrant.tech/documentation/faq/database-optimization/)

---

## 10. Testing Strategies

### Decision: Vitest with Testcontainers Pattern

**Rationale:**
- Vitest aligns with existing algojuke stack
- Testcontainers provides isolated Qdrant instances
- Fixtures pattern handles setup/cleanup elegantly
- Can test against real Qdrant (not mocks)

**Test Setup:**

```typescript
// tests/qdrant.setup.ts
import { beforeAll, afterAll, afterEach } from 'vitest';
import { QdrantClient } from '@qdrant/js-client-rest';
import { GenericContainer, StartedTestContainer } from 'testcontainers';

let qdrantContainer: StartedTestContainer;
let client: QdrantClient;

export const COLLECTION_NAME = "test_music_tracks";

beforeAll(async () => {
  // Start Qdrant in Docker
  qdrantContainer = await new GenericContainer("qdrant/qdrant:v1.13.2")
    .withExposedPorts(6333)
    .start();

  const port = qdrantContainer.getMappedPort(6333);
  const url = `http://localhost:${port}`;

  client = new QdrantClient({ url });
}, 60000);  // 60s timeout for container startup

afterAll(async () => {
  await qdrantContainer.stop();
});

export { client };
```

**Collection Creation/Cleanup:**

```typescript
// tests/qdrant.fixtures.ts
import { test as base } from 'vitest';
import { client, COLLECTION_NAME } from './qdrant.setup';

export const test = base.extend({
  collection: async ({}, use) => {
    // Setup: Create collection before each test
    await client.createCollection(COLLECTION_NAME, {
      vectors: {
        interpretation_embedding: {
          size: 4096,
          distance: "Cosine"
        },
        text_sparse: {
          sparse: true,
          modifier: "IDF"
        }
      },
      hnsw_config: {
        m: 16,
        ef_construct: 100  // Lower for faster tests
      }
    });

    // Create payload indexes
    await client.createPayloadIndex(COLLECTION_NAME, {
      field_name: "isrc",
      field_schema: "keyword"
    });

    // Provide collection name to test
    await use(COLLECTION_NAME);

    // Cleanup: Delete collection after each test
    await client.deleteCollection(COLLECTION_NAME);
  }
});
```

**Test Examples:**

```typescript
// tests/qdrant.test.ts
import { describe, expect } from 'vitest';
import { test } from './qdrant.fixtures';
import { client } from './qdrant.setup';
import { isrcToUUID } from '../src/utils';

describe("Qdrant Music Track Index", () => {
  test("should upsert track by ISRC", async ({ collection }) => {
    const track = {
      isrc: "USRC12345678",
      title: "Test Song",
      artist: "Test Artist",
      embedding: new Array(4096).fill(0.1)
    };

    await client.upsert(collection, {
      points: [{
        id: isrcToUUID(track.isrc),
        vector: { interpretation_embedding: track.embedding },
        payload: {
          isrc: track.isrc,
          title: track.title,
          artist: track.artist
        }
      }],
      wait: true  // Wait for indexing
    });

    // Verify insertion
    const retrieved = await client.retrieve(collection, {
      ids: [isrcToUUID(track.isrc)]
    });

    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].payload?.isrc).toBe(track.isrc);
  });

  test("should enforce ISRC uniqueness on upsert", async ({ collection }) => {
    const isrc = "USRC12345678";
    const id = isrcToUUID(isrc);

    // Insert first version
    await client.upsert(collection, {
      points: [{
        id,
        vector: { interpretation_embedding: new Array(4096).fill(0.1) },
        payload: { isrc, title: "Original Title" }
      }],
      wait: true
    });

    // Upsert second version (should replace)
    await client.upsert(collection, {
      points: [{
        id,
        vector: { interpretation_embedding: new Array(4096).fill(0.2) },
        payload: { isrc, title: "Updated Title" }
      }],
      wait: true
    });

    // Should only have one point
    const results = await client.scroll(collection, { limit: 10 });
    expect(results.points).toHaveLength(1);
    expect(results.points[0].payload?.title).toBe("Updated Title");
  });

  test("should search by vector similarity", async ({ collection }) => {
    // Insert test data
    const tracks = [
      { isrc: "US001", embedding: new Array(4096).fill(0.9), title: "Track 1" },
      { isrc: "US002", embedding: new Array(4096).fill(0.5), title: "Track 2" },
      { isrc: "US003", embedding: new Array(4096).fill(0.1), title: "Track 3" }
    ];

    await client.upsert(collection, {
      points: tracks.map(t => ({
        id: isrcToUUID(t.isrc),
        vector: { interpretation_embedding: t.embedding },
        payload: { isrc: t.isrc, title: t.title }
      })),
      wait: true
    });

    // Search with vector similar to Track 1
    const queryVector = new Array(4096).fill(0.85);
    const results = await client.search(collection, {
      vector: {
        name: "interpretation_embedding",
        vector: queryVector
      },
      limit: 2
    });

    expect(results).toHaveLength(2);
    expect(results[0].payload?.isrc).toBe("US001");  // Most similar
  });

  test("should handle optional/null payload fields", async ({ collection }) => {
    await client.upsert(collection, {
      points: [{
        id: isrcToUUID("US001"),
        vector: { interpretation_embedding: new Array(4096).fill(0.5) },
        payload: {
          isrc: "US001",
          title: "Track",
          album: null,      // Explicitly null
          tempo: 120        // Optional field present
          // energy omitted
        }
      }],
      wait: true
    });

    // Query for tracks with null album
    const withNullAlbum = await client.scroll(collection, {
      filter: {
        must: [{ key: "album", is_null: true }]
      }
    });

    expect(withNullAlbum.points).toHaveLength(1);
  });
});
```

**Schema Validation Test:**

```typescript
test("should validate collection schema", async ({ collection }) => {
  const info = await client.getCollection(collection);

  // Validate vector configuration
  expect(info.config?.params?.vectors).toHaveProperty("interpretation_embedding");
  expect(info.config?.params?.vectors?.interpretation_embedding?.size).toBe(4096);
  expect(info.config?.params?.vectors?.interpretation_embedding?.distance).toBe("Cosine");

  // Validate HNSW config
  expect(info.config?.hnsw_config?.m).toBe(16);

  // Validate indexes
  const indexes = await client.listPayloadIndexes(collection);
  expect(indexes).toContain("isrc");
});
```

**Performance Test:**

```typescript
test("should search within 500ms for 10k docs", async ({ collection }) => {
  // Insert 10k documents
  const tracks = Array.from({ length: 10000 }, (_, i) => ({
    id: isrcToUUID(`US${i.toString().padStart(6, '0')}`),
    vector: {
      interpretation_embedding: new Array(4096).fill(Math.random())
    },
    payload: {
      isrc: `US${i.toString().padStart(6, '0')}`,
      title: `Track ${i}`
    }
  }));

  // Batch upsert (chunks of 100)
  for (let i = 0; i < tracks.length; i += 100) {
    await client.upsert(collection, {
      points: tracks.slice(i, i + 100),
      wait: false
    });
  }

  // Wait for indexing
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Measure search latency
  const queryVector = new Array(4096).fill(Math.random());
  const start = Date.now();

  await client.search(collection, {
    vector: {
      name: "interpretation_embedding",
      vector: queryVector
    },
    limit: 10,
    params: { hnsw_ef: 128 }
  });

  const latency = Date.now() - start;
  expect(latency).toBeLessThan(200);  // Target: <200ms for 10k docs
}, 60000);
```

**Best Practices:**
1. Use testcontainers for isolated Qdrant instances
2. Clean up collections in `afterEach` via fixtures
3. Set `wait: true` on upsert for deterministic tests
4. Use lower `ef_construct` values for faster test execution
5. Test edge cases: null fields, empty payloads, duplicate ISRCs
6. Validate schema after collection creation
7. Test performance with representative data sizes

**Alternatives Considered:**
1. **Mock Qdrant client**: Rejected - can't test actual vector search behavior
2. **Shared test collection**: Rejected - tests interfere with each other
3. **Manual cleanup**: Rejected - fixtures pattern is cleaner

**Sources:**
- [Test API Reference | Vitest](https://vitest.dev/api/)
- [Test Context | Vitest](https://vitest.dev/guide/test-context)
- [Qdrant Python test examples](https://github.com/qdrant/qdrant-client/blob/master/tests/test_qdrant_client.py)
- [Testcontainers for .NET - Qdrant](https://dotnet.testcontainers.org/modules/qdrant/)

---

## Summary of Key Decisions

1. **Collection Schema**: Named vectors (dense 4096-dim + sparse BM25), schema-less payload with optional audio features
2. **BM25 Configuration**: Sparse vectors with IDF modifier, text indexes on title/artist/lyrics/interpretation
3. **ISRC Uniqueness**: Hash ISRC to UUID for point ID, store original in indexed payload
4. **Optional Fields**: Use null/omit pattern, leverage `is_null` filters, index frequently filtered fields
5. **Initialization**: Idempotent creation with version metadata, create indexes post-creation
6. **HNSW Parameters**: Balanced profile (m=16, ef_construct=200, hnsw_ef=128) for 100k corpus
7. **Docker Deployment**: 4GB RAM / 2 CPU with scalar int8 quantization, memory-mapped segments
8. **TypeScript Client**: Use qdrant-js with batch upserts, hybrid search, ISRC-based retrieval
9. **Performance**: Scalar quantization + indexed payloads for <200ms search latency
10. **Testing**: Vitest + Testcontainers with fixtures pattern for isolated tests

---

## Additional Resources

- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [qdrant-js GitHub](https://github.com/qdrant/qdrant-js)
- [Qdrant API Reference](https://api.qdrant.tech/api-reference)
- [Qdrant Discord Community](https://discord.gg/qdrant)
- [Vector Search Benchmarks](https://qdrant.tech/benchmarks/)
- [Hybrid Search Guide](https://qdrant.tech/articles/hybrid-search/)
- [Memory Optimization Guide](https://qdrant.tech/articles/memory-consumption/)

---

**Compiled Sources:**

- [Collections - Qdrant](https://qdrant.tech/documentation/concepts/collections/)
- [Vectors - Qdrant](https://qdrant.tech/documentation/concepts/vectors/)
- [Points - Qdrant](https://qdrant.tech/documentation/concepts/points/)
- [Payload - Qdrant](https://qdrant.tech/documentation/concepts/payload/)
- [Indexing - Qdrant](https://qdrant.tech/documentation/concepts/indexing/)
- [Filtering - Qdrant](https://qdrant.tech/documentation/concepts/filtering/)
- [Text Search - Qdrant](https://qdrant.tech/documentation/guides/text-search/)
- [Hybrid Search Revamped - Qdrant](https://qdrant.tech/articles/hybrid-search/)
- [BM42: New Baseline for Hybrid Search - Qdrant](https://qdrant.tech/articles/bm42/)
- [Optimize Performance - Qdrant](https://qdrant.tech/documentation/guides/optimize/)
- [Database Optimization - Qdrant](https://qdrant.tech/documentation/faq/database-optimization/)
- [Minimal RAM for Million Vectors - Qdrant](https://qdrant.tech/articles/memory-consumption/)
- [Vector Search Resource Optimization](https://qdrant.tech/articles/vector-search-resource-optimization/)
- [Binary Quantization - Qdrant](https://qdrant.tech/articles/binary-quantization/)
- [Demo: HNSW Performance Tuning](https://qdrant.tech/course/essentials/day-2/collection-tuning-demo/)
- [GitHub - qdrant-js SDK](https://github.com/qdrant/qdrant-js)
- [Qdrant API Reference](https://api.qdrant.tech/api-reference)
- [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints/)
- [Test API Reference | Vitest](https://vitest.dev/api/)
