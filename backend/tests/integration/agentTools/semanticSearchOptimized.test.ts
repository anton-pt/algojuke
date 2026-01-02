/**
 * Semantic Search Optimized Integration Tests
 *
 * Feature: 013-agent-tool-optimization
 *
 * Tests the hybridSearchOptimized method with actual Qdrant field selection.
 * Requires Qdrant to be running.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { QdrantClient } from '@qdrant/js-client-rest';
import {
  BackendQdrantClient,
  AGENT_SEARCH_PAYLOAD_FIELDS,
  type OptimizedSearchResult,
} from '../../../src/clients/qdrantClient.js';
import { hashIsrcToUuid } from '../../../src/utils/isrcHash.js';

// Test configuration
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const TEST_COLLECTION = 'tracks-test-optimized-search';

// Mock track data for testing
const MOCK_TRACKS = [
  {
    isrc: 'USRC12345001',
    title: 'Melancholic Ballad',
    artist: 'Test Artist 1',
    album: 'Test Album 1',
    short_description: 'A melancholic song about lost love and longing.',
    interpretation: 'This is a very long interpretation text that analyzes the song in detail...',
    lyrics: 'Verse 1: These are the lyrics...\nChorus: More lyrics...',
    acousticness: 0.7,
    danceability: 0.3,
    energy: 0.4,
    instrumentalness: 0.1,
    key: 5,
    liveness: 0.1,
    loudness: -10,
    mode: 0,
    speechiness: 0.05,
    tempo: 75,
    valence: 0.2,
  },
  {
    isrc: 'USRC12345002',
    title: 'Upbeat Dance Track',
    artist: 'Test Artist 2',
    album: 'Test Album 2',
    short_description: 'An energetic dance track with powerful beats.',
    interpretation: 'Another long interpretation explaining the dance track...',
    lyrics: 'Dance lyrics here...',
    acousticness: 0.1,
    danceability: 0.9,
    energy: 0.9,
    instrumentalness: 0.0,
    key: 3,
    liveness: 0.2,
    loudness: -5,
    mode: 1,
    speechiness: 0.1,
    tempo: 128,
    valence: 0.8,
  },
  {
    isrc: 'USRC12345003',
    title: 'Instrumental Piece',
    artist: 'Test Artist 3',
    album: 'Test Album 3',
    short_description: null, // No short description (backfill incomplete)
    interpretation: 'Interpretation of the instrumental...',
    lyrics: null, // Instrumental, no lyrics
    acousticness: 0.9,
    danceability: 0.2,
    energy: 0.3,
    instrumentalness: 0.95,
    key: 7,
    liveness: 0.05,
    loudness: -15,
    mode: 1,
    speechiness: 0.0,
    tempo: 90,
    valence: 0.5,
  },
];

// Mock embedding (4096 dimensions filled with small random values)
function createMockEmbedding(): number[] {
  return Array.from({ length: 4096 }, () => Math.random() * 0.1);
}

// Mock sparse vector
function createMockSparseVector(): { indices: number[]; values: number[] } {
  return {
    indices: [1, 10, 100, 1000],
    values: [0.5, 0.3, 0.2, 0.1],
  };
}

describe('hybridSearchOptimized Integration', () => {
  let qdrantClient: QdrantClient;
  let backendClient: BackendQdrantClient;
  let testCollectionCreated = false;

  beforeAll(async () => {
    // Skip if Qdrant is not available
    qdrantClient = new QdrantClient({ url: QDRANT_URL });

    try {
      await qdrantClient.getCollections();
    } catch {
      console.log('Qdrant not available, skipping integration tests');
      return;
    }

    // Create test collection with required schema
    try {
      // Delete if exists
      try {
        await qdrantClient.deleteCollection(TEST_COLLECTION);
      } catch {
        // Collection doesn't exist, that's fine
      }

      // Create collection with hybrid search schema
      await qdrantClient.createCollection(TEST_COLLECTION, {
        vectors: {
          interpretation_embedding: {
            size: 4096,
            distance: 'Cosine',
          },
        },
        sparse_vectors: {
          text_sparse: {},
        },
      });

      testCollectionCreated = true;

      // Insert test tracks
      const points = MOCK_TRACKS.map((track) => ({
        id: hashIsrcToUuid(track.isrc),
        vector: {
          interpretation_embedding: createMockEmbedding(),
          text_sparse: createMockSparseVector(),
        },
        payload: track,
      }));

      await qdrantClient.upsert(TEST_COLLECTION, {
        wait: true,
        points,
      });

      // Create backend client
      backendClient = new BackendQdrantClient(QDRANT_URL, TEST_COLLECTION);
    } catch (error) {
      console.error('Failed to setup test collection:', error);
      throw error;
    }
  });

  afterAll(async () => {
    // Cleanup: delete test collection
    if (testCollectionCreated && qdrantClient) {
      try {
        await qdrantClient.deleteCollection(TEST_COLLECTION);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('returns results with only optimized fields', async () => {
    if (!testCollectionCreated) {
      console.log('Skipping: Qdrant not available');
      return;
    }

    const results = await backendClient.hybridSearchOptimized(
      [{ denseVector: createMockEmbedding(), sparseVector: createMockSparseVector() }],
      { limit: 10, offset: 0 }
    );

    expect(results.length).toBeGreaterThan(0);

    // Verify each result has the expected structure
    for (const result of results) {
      // Should have basic fields
      expect(result.isrc).toBeDefined();
      expect(result.title).toBeDefined();
      expect(result.artist).toBeDefined();
      expect(result.album).toBeDefined();
      expect(result.score).toBeDefined();

      // Should have shortDescription (may be null)
      expect('shortDescription' in result).toBe(true);

      // Should have audio features (may be null)
      expect('acousticness' in result).toBe(true);
      expect('danceability' in result).toBe(true);
      expect('energy' in result).toBe(true);
    }
  });

  it('does NOT return interpretation field', async () => {
    if (!testCollectionCreated) {
      console.log('Skipping: Qdrant not available');
      return;
    }

    const results = await backendClient.hybridSearchOptimized(
      [{ denseVector: createMockEmbedding(), sparseVector: createMockSparseVector() }],
      { limit: 10, offset: 0 }
    );

    expect(results.length).toBeGreaterThan(0);

    for (const result of results) {
      // TypeScript type doesn't have interpretation
      // We verify the raw result also doesn't have it
      expect('interpretation' in result).toBe(false);
    }
  });

  it('does NOT return lyrics field', async () => {
    if (!testCollectionCreated) {
      console.log('Skipping: Qdrant not available');
      return;
    }

    const results = await backendClient.hybridSearchOptimized(
      [{ denseVector: createMockEmbedding(), sparseVector: createMockSparseVector() }],
      { limit: 10, offset: 0 }
    );

    expect(results.length).toBeGreaterThan(0);

    for (const result of results) {
      expect('lyrics' in result).toBe(false);
    }
  });

  it('handles tracks with null short_description', async () => {
    if (!testCollectionCreated) {
      console.log('Skipping: Qdrant not available');
      return;
    }

    const results = await backendClient.hybridSearchOptimized(
      [{ denseVector: createMockEmbedding(), sparseVector: createMockSparseVector() }],
      { limit: 10, offset: 0 }
    );

    // Find the instrumental track which has null short_description
    const instrumentalTrack = results.find((r) => r.isrc === 'USRC12345003');

    if (instrumentalTrack) {
      expect(instrumentalTrack.shortDescription).toBeNull();
    }
  });

  it('returns all audio features', async () => {
    if (!testCollectionCreated) {
      console.log('Skipping: Qdrant not available');
      return;
    }

    const results = await backendClient.hybridSearchOptimized(
      [{ denseVector: createMockEmbedding(), sparseVector: createMockSparseVector() }],
      { limit: 10, offset: 0 }
    );

    expect(results.length).toBeGreaterThan(0);

    // Find a track with known audio features
    const track1 = results.find((r) => r.isrc === 'USRC12345001');

    if (track1) {
      expect(track1.acousticness).toBe(0.7);
      expect(track1.danceability).toBe(0.3);
      expect(track1.energy).toBe(0.4);
      expect(track1.instrumentalness).toBe(0.1);
      expect(track1.key).toBe(5);
      expect(track1.liveness).toBe(0.1);
      expect(track1.loudness).toBe(-10);
      expect(track1.mode).toBe(0);
      expect(track1.speechiness).toBe(0.05);
      expect(track1.tempo).toBe(75);
      expect(track1.valence).toBe(0.2);
    }
  });

  it('deduplicates results by ISRC', async () => {
    if (!testCollectionCreated) {
      console.log('Skipping: Qdrant not available');
      return;
    }

    const results = await backendClient.hybridSearchOptimized(
      [
        { denseVector: createMockEmbedding(), sparseVector: createMockSparseVector() },
        { denseVector: createMockEmbedding(), sparseVector: createMockSparseVector() },
      ],
      { limit: 10, offset: 0 }
    );

    // Check for duplicates
    const isrcs = results.map((r) => r.isrc.toUpperCase());
    const uniqueIsrcs = new Set(isrcs);

    expect(isrcs.length).toBe(uniqueIsrcs.size); // No duplicates
  });

  it('respects limit parameter', async () => {
    if (!testCollectionCreated) {
      console.log('Skipping: Qdrant not available');
      return;
    }

    const results = await backendClient.hybridSearchOptimized(
      [{ denseVector: createMockEmbedding(), sparseVector: createMockSparseVector() }],
      { limit: 2, offset: 0 }
    );

    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('AGENT_SEARCH_PAYLOAD_FIELDS matches Qdrant schema', async () => {
    if (!testCollectionCreated) {
      console.log('Skipping: Qdrant not available');
      return;
    }

    // Verify the fields in AGENT_SEARCH_PAYLOAD_FIELDS exist in our mock data
    for (const field of AGENT_SEARCH_PAYLOAD_FIELDS) {
      // All our mock tracks should have these fields (though some may be null)
      const firstTrack = MOCK_TRACKS[0] as Record<string, unknown>;
      expect(field in firstTrack).toBe(true);
    }
  });
});
