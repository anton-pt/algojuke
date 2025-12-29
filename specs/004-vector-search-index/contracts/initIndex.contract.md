# Contract: Index Initialization

**Module**: `src/scripts/initIndex.ts`
**Type**: Script (CLI invocation)
**Created**: 2025-12-29

## Purpose

Initialize a Qdrant collection with the track document schema, vector configuration, and indexes. Idempotent operation safe to re-run.

## Interface

### Script Invocation

```bash
npx tsx src/scripts/initIndex.ts <collection-name>
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `collection-name` | string | Yes | - | Name of the Qdrant collection to create/verify (e.g., "tracks", "tracks-test-abc123") |

### Environment Variables

| Variable | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `QDRANT_URL` | string | No | `http://localhost:6333` | Qdrant server URL |
| `QDRANT_API_KEY` | string | No | - | API key for authentication (not needed for local Docker instance) |

## Behavior

### Preconditions

- Qdrant server is running and accessible at `QDRANT_URL`
- Network connectivity to Qdrant
- Collection name is valid (alphanumeric, hyphens, underscores)

### Success Path

1. **Check Collection Existence**
   - Query Qdrant for collection with given name
   - If exists: Verify schema matches expected configuration
   - If not exists: Proceed to creation

2. **Create Collection** (if needed)
   - Configure vector fields:
     - `interpretation_embedding`: dense 4096-dim, Cosine distance, int8 quantization
     - `text_sparse`: sparse vectors with IDF modifier (BM25)
   - Configure HNSW index: m=16, ef_construct=200
   - Configure optimizers for 100k scale

3. **Create Indexes**
   - Payload keyword index on `isrc` field
   - Text indexes on `title`, `artist`, `lyrics`, `interpretation` fields

4. **Verify Creation**
   - Retrieve collection info
   - Confirm vector config matches
   - Confirm indexes created

5. **Log Success**
   - Output collection name, vector count (0 for new), index status

### Failure Paths

| Error Condition | Behavior | Exit Code |
|-----------------|----------|-----------|
| Qdrant server unreachable | Log error "Failed to connect to Qdrant at {url}", exit | 1 |
| Invalid collection name | Log error "Invalid collection name: {name}", exit | 1 |
| Collection exists with incompatible schema | Log error "Collection exists with different schema", exit | 1 |
| Insufficient permissions | Log error "Permission denied creating collection", exit | 1 |
| Unknown error | Log error with stack trace, exit | 1 |

### Idempotency

- **Safe to re-run**: If collection exists with matching schema, script succeeds with message "Collection already exists"
- **Schema mismatch**: If existing collection has different schema, script exits with error (does not auto-migrate)

## Examples

### Example 1: Create Production Collection

```bash
$ npx tsx src/scripts/initIndex.ts tracks

Connecting to Qdrant at http://localhost:6333...
Collection 'tracks' does not exist. Creating...
Created collection 'tracks' with 4096-dim dense + sparse vectors
Created payload indexes: isrc (keyword), title/artist/lyrics/interpretation (text)
✓ Collection 'tracks' initialized successfully
  Vectors: 0
  Indexes: 5
```

### Example 2: Verify Existing Collection

```bash
$ npx tsx src/scripts/initIndex.ts tracks

Connecting to Qdrant at http://localhost:6333...
Collection 'tracks' already exists with matching schema
✓ Collection 'tracks' verified successfully
  Vectors: 42,531
  Indexes: 5
```

### Example 3: Connection Failure

```bash
$ npx tsx src/scripts/initIndex.ts tracks

Connecting to Qdrant at http://localhost:6333...
✗ Failed to connect to Qdrant at http://localhost:6333
  Error: connect ECONNREFUSED 127.0.0.1:6333

Ensure Qdrant is running: docker compose up qdrant -d

Exit code: 1
```

## Implementation Requirements

### Dependencies

- `qdrant-js`: Qdrant TypeScript client
- `uuid`: UUID generation for hashing
- Environment variable parsing

### Logging

All log messages to console (stdout for info, stderr for errors) using structured prefix format suitable for debugging:

**Format**: `[module] Level: Message {context}`

**Examples**:
```typescript
// Info messages to stdout
console.log('[initIndex] INFO: Connecting to Qdrant at', url);
console.log('[initIndex] INFO: Created collection', name, 'with', vectorCount, 'vectors');

// Error messages to stderr with stack trace for debugging
console.error('[initIndex] ERROR:', error.message);
console.error('[initIndex] Stack:', error.stack);

// Additional context as JSON for complex errors
console.error('[initIndex] ERROR: Schema mismatch', JSON.stringify({
  expected: expectedSchema,
  actual: actualSchema
}));
```

**Levels**:
- `INFO`: Successful operations, progress updates
- `ERROR`: Failures requiring user action or investigation

### Error Handling

- Wrap all Qdrant API calls in try-catch
- Provide actionable error messages
- Exit with non-zero code on failure

## Testing Contract

### Test Scenarios

1. **Fresh collection creation** (integration test)
   - Collection doesn't exist
   - Script creates collection
   - Verify all indexes created

2. **Idempotent re-run** (integration test)
   - Collection exists with correct schema
   - Script succeeds without modification
   - Existing data preserved

3. **Connection failure** (integration test)
   - Qdrant server not running
   - Script logs error and exits with code 1

4. **Invalid collection name** (contract test)
   - Name contains invalid characters
   - Script validates and rejects

5. **Schema verification** (contract test)
   - Existing collection has 1536-dim vectors (wrong)
   - Script detects mismatch and exits with error

### Test Data

```typescript
const validCollectionNames = ['tracks', 'tracks-test', 'tracks_v2'];
const invalidCollectionNames = ['', 'tracks!', 'tracks@test', 'tracks/v2'];
```

## Performance Characteristics

- **Execution time**: <30 seconds for fresh creation (per SC-007)
- **Memory usage**: <100MB (lightweight script)
- **Network**: 5-10 HTTP requests to Qdrant API

## Security Considerations

- **No authentication** for local Docker Qdrant (acceptable per security clarification)
- **Input validation**: Collection name sanitized to prevent injection
- **No sensitive data**: Script logs do not contain credentials

## Related Contracts

- [testUtils.contract.md](./testUtils.contract.md) - Test collection lifecycle management
- [trackDocument.contract.md](./trackDocument.contract.md) - Document insert/update operations
