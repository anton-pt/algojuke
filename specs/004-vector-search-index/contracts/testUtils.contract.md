# Contract: Test Utilities

**Module**: `src/scripts/testUtils.ts`
**Type**: Library
**Created**: 2025-12-29

## Purpose

Provide test lifecycle management for creating and cleaning up test collections in Qdrant. Ensures test isolation and prevents test data pollution.

## Exports

### Function: `createTestCollection`

Create a temporary test collection with unique name for test isolation.

#### Signature

```typescript
async function createTestCollection(): Promise<string>
```

#### Parameters

None

#### Returns

| Type | Description |
|------|-------------|
| `Promise<string>` | Name of the created test collection (format: `tracks-test-{uuid}`) |

#### Behavior

1. Generate unique collection name: `tracks-test-{randomUUID()}`
2. Call internal `initIndex` logic with test collection name
3. Verify collection created successfully
4. Return collection name

#### Errors

- Throws `Error` if collection creation fails
- Throws `Error` if Qdrant server unreachable

#### Example

```typescript
import { createTestCollection } from './testUtils';

describe('Track indexing', () => {
  let collectionName: string;

  beforeEach(async () => {
    collectionName = await createTestCollection();
    // collectionName = 'tracks-test-a1b2c3d4-e5f6-...'
  });
});
```

---

### Function: `deleteTestCollection`

Delete a test collection and all its data.

#### Signature

```typescript
async function deleteTestCollection(collectionName: string): Promise<void>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collectionName` | string | Yes | Name of test collection to delete (must start with `tracks-test-`) |

#### Returns

| Type | Description |
|------|-------------|
| `Promise<void>` | Resolves when collection deleted |

#### Behavior

1. **Safety Check**: Verify collection name starts with `tracks-test-`
   - If not: Throw error (prevent accidental production collection deletion)
2. Delete collection via Qdrant API
3. Verify deletion successful

#### Errors

- Throws `Error` if collection name doesn't match test pattern
- Throws `Error` if collection doesn't exist (safe to ignore in finally blocks)
- Throws `Error` if deletion fails due to permissions

#### Example

```typescript
import { deleteTestCollection } from './testUtils';

describe('Track indexing', () => {
  let collectionName: string;

  afterEach(async () => {
    await deleteTestCollection(collectionName);
  });
});
```

---

### Function: `insertTestTrack`

Insert a test track document with default/overridable values.

#### Signature

```typescript
async function insertTestTrack(
  collectionName: string,
  overrides?: Partial<TrackDocument>
): Promise<string>
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `collectionName` | string | Yes | - | Target collection name |
| `overrides` | `Partial<TrackDocument>` | No | `{}` | Fields to override in default test track |

#### Returns

| Type | Description |
|------|-------------|
| `Promise<string>` | ISRC of inserted track |

#### Behavior

1. Generate default test track document:
   ```typescript
   {
     isrc: 'USTEST{6-digit-random}',  // e.g., USTEST123456
     title: 'Test Track',
     artist: 'Test Artist',
     album: 'Test Album',
     lyrics: 'Test lyrics',
     interpretation: 'Test interpretation',
     interpretation_embedding: randomVector(4096),  // Normalized random
     // All audio features: null
   }
   ```
2. Merge with `overrides`
3. Validate document with Zod schema
4. Upsert to Qdrant (hash ISRC to UUID)
5. Return ISRC

#### Errors

- Throws `ValidationError` if merged document invalid
- Throws `Error` if upsert fails

#### Example

```typescript
import { insertTestTrack } from './testUtils';

test('Search by artist', async () => {
  const collectionName = await createTestCollection();

  await insertTestTrack(collectionName, {
    artist: 'The Beatles',
    title: 'Let It Be'
  });

  const results = await searchByKeyword(collectionName, 'Beatles');
  expect(results).toHaveLength(1);
  expect(results[0].artist).toBe('The Beatles');
});
```

---

### Function: `hashIsrcToUuid`

Convert ISRC to deterministic UUID for Qdrant point ID (exposed for testing).

#### Signature

```typescript
function hashIsrcToUuid(isrc: string): string
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `isrc` | string | Yes | 12-character ISRC code |

#### Returns

| Type | Description |
|------|-------------|
| `string` | UUID v5 (deterministic) |

#### Behavior

1. Validate ISRC format: 12 alphanumeric characters
2. Generate UUID v5 with namespace `6ba7b810-9dad-11d1-80b4-00c04fd430c8` (URL namespace)
3. Return UUID string

#### Errors

- Throws `Error` if ISRC format invalid

#### Example

```typescript
import { hashIsrcToUuid } from './testUtils';

const uuid1 = hashIsrcToUuid('USRC17607839');
const uuid2 = hashIsrcToUuid('USRC17607839');

expect(uuid1).toBe(uuid2);  // Deterministic
expect(uuid1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
```

---

### Function: `generateRandomVector`

Generate random normalized 4096-dimensional vector for testing.

#### Signature

```typescript
function generateRandomVector(dimensions: number = 4096): number[]
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `dimensions` | number | No | 4096 | Vector dimensionality |

#### Returns

| Type | Description |
|------|-------------|
| `number[]` | Normalized random vector (L2 norm = 1.0) |

#### Behavior

1. Generate `dimensions` random values from N(0, 1) (normal distribution)
2. Compute L2 norm: `sqrt(sum(x_i^2))`
3. Normalize: divide each value by norm
4. Return array

#### Example

```typescript
import { generateRandomVector } from './testUtils';

const vector = generateRandomVector(4096);
expect(vector).toHaveLength(4096);

// Verify normalization
const norm = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0));
expect(norm).toBeCloseTo(1.0, 5);
```

---

## Usage Patterns

### Vitest Integration

```typescript
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { createTestCollection, deleteTestCollection, insertTestTrack } from './testUtils';

describe('Track Operations', () => {
  let collectionName: string;

  beforeEach(async () => {
    collectionName = await createTestCollection();
  });

  afterEach(async () => {
    await deleteTestCollection(collectionName);
  });

  it('should insert and retrieve track', async () => {
    const isrc = await insertTestTrack(collectionName, {
      title: 'Bohemian Rhapsody',
      artist: 'Queen'
    });

    const retrieved = await retrieveByIsrc(collectionName, isrc);
    expect(retrieved?.title).toBe('Bohemian Rhapsody');
  });
});
```

### Cleanup in Finally Block

```typescript
describe('Robust cleanup', () => {
  it('cleans up even on test failure', async () => {
    const collectionName = await createTestCollection();

    try {
      // Test operations that might throw
      await someOperationThatMightFail(collectionName);
    } finally {
      await deleteTestCollection(collectionName);
    }
  });
});
```

## Implementation Requirements

### Dependencies

- `qdrant-js`: Qdrant client
- `uuid`: UUID v5 generation
- `zod`: Schema validation

### Random Data Generation

- Use crypto-safe random for ISRC suffixes: `crypto.randomInt(0, 999999)`
- Use deterministic seeded random for vectors in specific tests (optional)

### Error Messages

Provide clear messages for safety checks:
```typescript
if (!collectionName.startsWith('tracks-test-')) {
  throw new Error(
    `Refusing to delete non-test collection: ${collectionName}. ` +
    `Test collections must start with 'tracks-test-'`
  );
}
```

## Testing Contract

### Test Scenarios

1. **Create and delete test collection** (integration)
   - Create collection
   - Verify it exists
   - Delete collection
   - Verify it doesn't exist

2. **Multiple test collections isolated** (integration)
   - Create collection A
   - Create collection B
   - Insert to A
   - Verify B is empty
   - Delete both

3. **Safety check prevents production deletion** (contract)
   - Attempt to delete 'tracks' (production name)
   - Expect error thrown

4. **ISRC hash determinism** (contract)
   - Hash same ISRC twice
   - Verify identical UUIDs

5. **Test track insertion** (integration)
   - Insert track with overrides
   - Retrieve by ISRC
   - Verify merged fields correct

6. **Vector normalization** (contract)
   - Generate random vector
   - Compute L2 norm
   - Verify ≈ 1.0

## Performance Characteristics

- **createTestCollection**: <5 seconds (collection creation overhead)
- **deleteTestCollection**: <1 second
- **insertTestTrack**: <100ms per track
- **hashIsrcToUuid**: <1ms (pure computation)
- **generateRandomVector**: <10ms (4096 random values + normalization)

## Security Considerations

- **Safety checks**: Prevent accidental deletion of non-test collections
- **Input validation**: ISRC format validated before hashing
- **Test data isolation**: Each test gets unique collection preventing cross-test interference

## Related Contracts

- [initIndex.contract.md](./initIndex.contract.md) - Reuses collection initialization logic
- [trackDocument.contract.md](./trackDocument.contract.md) - Uses upsert operations
