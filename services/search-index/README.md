# Vector Search Index Infrastructure

Vector search index infrastructure for music tracks using Qdrant vector database. Supports hybrid search combining vector similarity (4096-dimensional embeddings) and BM25 keyword search.

## Features

- **Hybrid Search**: Combines dense vector similarity and sparse BM25 keyword search
- **Audio Features**: Stores 11 optional audio features from reccobeats.com API
- **ISRC Uniqueness**: Deterministic UUID-based point IDs ensure track uniqueness
- **Float16 Vectors**: Efficient storage with float16 data type
- **Test Isolation**: Safe test collection management with automatic cleanup

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 20+
- TypeScript 5.3+

### Installation

```bash
cd services/search-index
npm install
```

### Start Qdrant

```bash
# From repository root
docker compose up qdrant -d
```

### Initialize Index

```bash
# Initialize production collection
npm run init-index tracks

# Initialize test collection
npm run init-index tracks-test-dev
```

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test:watch

# Type check
npm run type-check
```

## Architecture

### Collection Schema

- **Dense Vector**: `interpretation_embedding` (4096-dim, Cosine distance, float16)
- **Sparse Vector**: `text_sparse` (BM25 with IDF modifier)
- **Payload Fields**: isrc, title, artist, album, lyrics, interpretation + 11 audio features
- **Indexes**: isrc (keyword), title/artist/lyrics/interpretation (text)

### HNSW Configuration

- `m=16`: Bi-directional links per node
- `ef_construct=200`: Construction-time search depth
- Resource limits: 4GB RAM, 2 CPU cores

### Audio Features

All optional fields from reccobeats.com API:

- `acousticness`, `danceability`, `energy`, `instrumentalness` (0.0-1.0)
- `key` (-1 to 11), `mode` (0 or 1)
- `liveness`, `speechiness`, `valence` (0.0-1.0)
- `loudness` (-60 to 0 dB), `tempo` (0-250 BPM)

## Usage Examples

### Insert Track

```typescript
import { insertTestTrack, generateTestTrack } from './src/scripts/testUtils';

const track = generateTestTrack({
  isrc: 'USRC17607839',
  title: 'My Song',
  artist: 'Artist Name',
  album: 'Album Name',
  lyrics: 'Song lyrics...',
  interpretation: 'AI-generated interpretation...',
  // Audio features optional
  danceability: 0.75,
  energy: 0.8,
});

await insertTestTrack('tracks', track);
```

### Vector Similarity Search

```typescript
import { qdrantClient } from './src/client/qdrant';

const results = await qdrantClient.query('tracks', {
  query: embedding, // 4096-dim vector
  using: 'interpretation_embedding',
  limit: 10,
  with_payload: true,
});
```

### BM25 Keyword Search

```typescript
import { generateSparseVector } from './src/scripts/testUtils';

const sparseVector = generateSparseVector('love song');

const results = await qdrantClient.query('tracks', {
  query: sparseVector,
  using: 'text_sparse',
  limit: 10,
  with_payload: true,
});
```

### Hybrid Search (RRF)

```typescript
const results = await qdrantClient.query('tracks', {
  prefetch: [
    {
      query: embedding,
      using: 'interpretation_embedding',
      limit: 20,
    },
    {
      query: generateSparseVector('blues rock'),
      using: 'text_sparse',
      limit: 20,
    },
  ],
  query: { fusion: 'rrf' }, // Reciprocal Rank Fusion
  limit: 10,
  with_payload: true,
});
```

### Retrieve by ISRC

```typescript
import { retrieveTrackByIsrc } from './src/scripts/testUtils';

const track = await retrieveTrackByIsrc('tracks', 'USRC17607839');
```

## Testing

### Test Structure

- **Contract Tests** (`tests/contract/`): Schema validation, ISRC uniqueness, data types
- **Integration Tests** (`tests/integration/`): Docker connectivity, initialization, search operations

### Test Isolation

```typescript
import { createTestCollection, deleteTestCollection } from './src/scripts/testUtils';

// Create isolated test collection
const collectionName = await createTestCollection();

// Run tests...

// Cleanup (automatic in afterAll hooks)
await deleteTestCollection(collectionName);
```

### Safety Features

- Test collections must start with `tracks-test-` prefix
- Production collections cannot be deleted via `deleteTestCollection`
- Deterministic UUID generation prevents accidental duplicates

## Performance

### Targets (per spec.md)

- Vector search: <500ms for 10k documents
- Keyword search: <200ms for 10k documents
- ISRC lookup: <50ms

### Resource Constraints

- Docker container: 4GB RAM, 2 CPU cores
- Supported corpus: Up to 100k tracks

## Development

### Project Structure

```
services/search-index/
├── src/
│   ├── client/          # Qdrant client configuration
│   ├── schema/          # Collection and document schemas
│   ├── scripts/         # Utilities and init scripts
│   └── utils/           # ISRC hashing, helpers
├── tests/
│   ├── contract/        # Schema validation tests
│   └── integration/     # Search and operations tests
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### Key Files

- `src/schema/trackCollection.ts`: Qdrant collection configuration
- `src/schema/trackDocument.ts`: Zod schema for track documents
- `src/scripts/initIndex.ts`: Index initialization CLI
- `src/scripts/testUtils.ts`: Test helpers and search utilities

## Documentation

For detailed specifications, see:

- [Feature Spec](../../specs/004-vector-search-index/spec.md)
- [Implementation Plan](../../specs/004-vector-search-index/plan.md)
- [Data Model](../../specs/004-vector-search-index/data-model.md)
- [Contracts](../../specs/004-vector-search-index/contracts/)
- [Quickstart Guide](../../specs/004-vector-search-index/quickstart.md)

## License

Part of the algojuke project.
