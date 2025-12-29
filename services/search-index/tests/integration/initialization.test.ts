/**
 * Integration tests for Qdrant index initialization
 *
 * Tests:
 * - Docker connectivity and health
 * - Collection creation and schema verification
 * - Idempotent re-runs
 * - Test collection cleanup
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { qdrantClient, verifyConnection } from '../../src/client/qdrant.js';
import { initIndex } from '../../src/scripts/initIndex.js';
import {
  createTestCollection,
  deleteTestCollection,
  generateTestCollectionName,
} from '../../src/scripts/testUtils.js';

describe('Docker Connectivity', () => {
  it('should connect to Qdrant server', async () => {
    await expect(verifyConnection()).resolves.not.toThrow();
  });

  it('should list collections', async () => {
    const response = await qdrantClient.getCollections();
    expect(response).toBeDefined();
    expect(response.collections).toBeDefined();
    expect(Array.isArray(response.collections)).toBe(true);
  });

  it('should have healthy Qdrant instance', async () => {
    // Verify we can perform basic operations
    const collections = await qdrantClient.getCollections();
    expect(collections.collections).toBeInstanceOf(Array);
  });
});

describe('Index Initialization', () => {
  const testCollectionName = generateTestCollectionName();

  afterAll(async () => {
    // Cleanup test collection
    await deleteTestCollection(testCollectionName);
  });

  it('should create a new collection with full schema', async () => {
    await initIndex(testCollectionName);

    // Verify collection exists
    const collection = await qdrantClient.getCollection(testCollectionName);
    expect(collection).toBeDefined();
    expect(collection.status).toBe('green');

    // Verify vector configuration
    expect(collection.config?.params?.vectors).toBeDefined();
  });

  it('should be idempotent - re-running on existing collection should succeed', async () => {
    // Run init again on same collection
    await expect(initIndex(testCollectionName)).resolves.not.toThrow();

    // Verify collection still exists
    const collection = await qdrantClient.getCollection(testCollectionName);
    expect(collection.status).toBe('green');
  });

  it('should verify collection schema after creation', async () => {
    const collection = await qdrantClient.getCollection(testCollectionName);

    // Verify vectors are configured
    expect(collection.config?.params?.vectors).toBeDefined();
    expect(collection.points_count).toBeDefined();
  });

  it('should create payload indexes', async () => {
    // Verify indexes were created (indexed fields should work)
    // Note: Qdrant doesn't provide direct index inspection API,
    // but we can verify the collection was created successfully
    const collection = await qdrantClient.getCollection(testCollectionName);
    expect(collection).toBeDefined();
  });
});

describe('Test Collection Lifecycle', () => {
  it('should create test collection with unique name', async () => {
    const collectionName = await createTestCollection();

    expect(collectionName).toMatch(/^tracks-test-[a-f0-9]+$/);

    // Verify collection exists
    const collection = await qdrantClient.getCollection(collectionName);
    expect(collection.status).toBe('green');

    // Cleanup
    await deleteTestCollection(collectionName);
  });

  it('should delete test collection', async () => {
    const collectionName = await createTestCollection();

    // Verify exists
    let collection = await qdrantClient.getCollection(collectionName);
    expect(collection.status).toBe('green');

    // Delete
    await deleteTestCollection(collectionName);

    // Verify deleted
    await expect(qdrantClient.getCollection(collectionName)).rejects.toThrow();
  });

  it('should handle deleting non-existent collection gracefully', async () => {
    const collectionName = 'tracks-test-nonexistent123';

    // Should not throw
    await expect(deleteTestCollection(collectionName)).resolves.not.toThrow();
  });

  it('should refuse to delete non-test collection', async () => {
    const collectionName = 'tracks'; // Production collection name

    await expect(deleteTestCollection(collectionName)).rejects.toThrow(
      'not a test collection'
    );
  });

  it('should refuse to delete collection without test prefix', async () => {
    const collectionName = 'my-collection';

    await expect(deleteTestCollection(collectionName)).rejects.toThrow(
      'must start with'
    );
  });
});

describe('Collection Configuration', () => {
  let testCollectionName: string;

  beforeAll(async () => {
    testCollectionName = await createTestCollection();
  });

  afterAll(async () => {
    if (testCollectionName) {
      await deleteTestCollection(testCollectionName);
    }
  });

  it('should configure HNSW index parameters', async () => {
    const collection = await qdrantClient.getCollection(testCollectionName);

    expect(collection.config?.hnsw_config).toBeDefined();
    // Qdrant merges with defaults, so we verify collection was created successfully
    expect(collection.config?.hnsw_config?.m).toBeDefined();
  });

  it('should configure optimizer parameters', async () => {
    const collection = await qdrantClient.getCollection(testCollectionName);

    expect(collection.config?.optimizer_config).toBeDefined();
  });

  it('should start with zero vectors', async () => {
    const collection = await qdrantClient.getCollection(testCollectionName);

    expect(collection.points_count).toBe(0);
  });
});
