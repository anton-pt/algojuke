/**
 * Integration tests for track document operations
 *
 * Tests:
 * - Audio feature storage and retrieval
 * - Vector similarity search
 * - BM25 keyword search
 * - ISRC retrieval
 * - Upsert behavior
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestCollection,
  deleteTestCollection,
  generateTestTrack,
  generateRandomVector,
  generateSparseVector,
  insertTestTrack,
  retrieveTrackByIsrc,
} from '../../src/scripts/testUtils.js';
import { qdrantClient } from '../../src/client/qdrant.js';
import { hashIsrcToUuid } from '../../src/utils/isrcHash.js';

describe('Audio Feature Storage', () => {
  let collectionName: string;

  beforeAll(async () => {
    collectionName = await createTestCollection();
  });

  afterAll(async () => {
    await deleteTestCollection(collectionName);
  });

  it('should store track with all audio features', async () => {
    const track = generateTestTrack({
      isrc: 'USTEST000001',
      acousticness: 0.5,
      danceability: 0.75,
      energy: 0.6,
      instrumentalness: 0.1,
      key: 5,
      liveness: 0.2,
      loudness: -8,
      mode: 1,
      speechiness: 0.05,
      tempo: 120,
      valence: 0.65,
    });

    await insertTestTrack(collectionName, track);

    // Retrieve and verify
    const retrieved = await retrieveTrackByIsrc(collectionName, 'USTEST000001');
    expect(retrieved).toBeDefined();
    expect(retrieved?.acousticness).toBe(0.5);
    expect(retrieved?.danceability).toBe(0.75);
    expect(retrieved?.energy).toBe(0.6);
    expect(retrieved?.instrumentalness).toBe(0.1);
    expect(retrieved?.key).toBe(5);
    expect(retrieved?.liveness).toBe(0.2);
    expect(retrieved?.loudness).toBe(-8);
    expect(retrieved?.mode).toBe(1);
    expect(retrieved?.speechiness).toBe(0.05);
    expect(retrieved?.tempo).toBe(120);
    expect(retrieved?.valence).toBe(0.65);
  });

  it('should store track with partial audio features', async () => {
    const track = generateTestTrack({
      isrc: 'USTEST000002',
      acousticness: 0.3,
      danceability: 0.8,
      // Other features omitted
    });

    await insertTestTrack(collectionName, track);

    const retrieved = await retrieveTrackByIsrc(collectionName, 'USTEST000002');
    expect(retrieved).toBeDefined();
    expect(retrieved?.acousticness).toBe(0.3);
    expect(retrieved?.danceability).toBe(0.8);
  });

  it('should store track with no audio features', async () => {
    const track = generateTestTrack({
      isrc: 'USTEST000003',
      acousticness: null,
      danceability: null,
      energy: null,
      instrumentalness: null,
      key: null,
      liveness: null,
      loudness: null,
      mode: null,
      speechiness: null,
      tempo: null,
      valence: null,
    });

    await insertTestTrack(collectionName, track);

    const retrieved = await retrieveTrackByIsrc(collectionName, 'USTEST000003');
    expect(retrieved).toBeDefined();
    expect(retrieved?.isrc).toBe('USTEST000003');
  });

  it('should preserve audio feature data types', async () => {
    const track = generateTestTrack({
      isrc: 'USTEST000004',
      acousticness: 0.123456,
      key: 7,
      mode: 0,
      loudness: -12.5,
    });

    await insertTestTrack(collectionName, track);

    const retrieved = await retrieveTrackByIsrc(collectionName, 'USTEST000004');
    expect(retrieved).toBeDefined();

    // Floats should be preserved
    expect(typeof retrieved?.acousticness).toBe('number');
    expect(retrieved?.acousticness).toBeCloseTo(0.123456, 5);

    // Integers should be preserved
    expect(typeof retrieved?.key).toBe('number');
    expect(retrieved?.key).toBe(7);
    expect(retrieved?.mode).toBe(0);

    // Negative floats should be preserved
    expect(retrieved?.loudness).toBeCloseTo(-12.5, 1);
  });

  it('should handle edge case values for audio features', async () => {
    const track = generateTestTrack({
      isrc: 'USTEST000005',
      acousticness: 0.0,
      danceability: 1.0,
      key: -1, // No key detected
      loudness: -60, // Min loudness
      mode: 1, // Major
    });

    await insertTestTrack(collectionName, track);

    const retrieved = await retrieveTrackByIsrc(collectionName, 'USTEST000005');
    expect(retrieved).toBeDefined();
    expect(retrieved?.acousticness).toBe(0.0);
    expect(retrieved?.danceability).toBe(1.0);
    expect(retrieved?.key).toBe(-1);
    expect(retrieved?.loudness).toBe(-60);
    expect(retrieved?.mode).toBe(1);
  });
});

describe('ISRC Retrieval', () => {
  let collectionName: string;

  beforeAll(async () => {
    collectionName = await createTestCollection();
  });

  afterAll(async () => {
    await deleteTestCollection(collectionName);
  });

  it('should retrieve track by ISRC', async () => {
    const track = generateTestTrack({ isrc: 'USTEST100001' });
    await insertTestTrack(collectionName, track);

    const retrieved = await retrieveTrackByIsrc(collectionName, 'USTEST100001');
    expect(retrieved).toBeDefined();
    expect(retrieved?.isrc).toBe('USTEST100001');
    expect(retrieved?.title).toBe(track.title);
    expect(retrieved?.artist).toBe(track.artist);
  });

  it('should return null for non-existent ISRC', async () => {
    const retrieved = await retrieveTrackByIsrc(collectionName, 'USTEST999999');
    expect(retrieved).toBeNull();
  });

  it('should normalize ISRC case for retrieval', async () => {
    const track = generateTestTrack({ isrc: 'USTEST200001' });
    await insertTestTrack(collectionName, track);

    // Retrieve with lowercase
    const retrieved = await retrieveTrackByIsrc(collectionName, 'ustest200001');
    expect(retrieved).toBeDefined();
    expect(retrieved?.isrc).toBe('USTEST200001');
  });
});

describe('Upsert Behavior', () => {
  let collectionName: string;

  beforeAll(async () => {
    collectionName = await createTestCollection();
  });

  afterAll(async () => {
    await deleteTestCollection(collectionName);
  });

  it('should update track when inserting same ISRC', async () => {
    const isrc = 'USTEST300001';

    // Insert original
    const track1 = generateTestTrack({
      isrc,
      title: 'Original Title',
      acousticness: 0.3,
    });
    await insertTestTrack(collectionName, track1);

    // Verify original
    let retrieved = await retrieveTrackByIsrc(collectionName, isrc);
    expect(retrieved?.title).toBe('Original Title');
    expect(retrieved?.acousticness).toBe(0.3);

    // Update with same ISRC
    const track2 = generateTestTrack({
      isrc,
      title: 'Updated Title',
      acousticness: 0.7,
    });
    await insertTestTrack(collectionName, track2);

    // Verify update
    retrieved = await retrieveTrackByIsrc(collectionName, isrc);
    expect(retrieved?.title).toBe('Updated Title');
    expect(retrieved?.acousticness).toBe(0.7);

    // Verify no duplicate - check collection count
    const collection = await qdrantClient.getCollection(collectionName);
    expect(collection.points_count).toBe(1);
  });

  it('should create separate tracks for different ISRCs', async () => {
    await insertTestTrack(collectionName, generateTestTrack({ isrc: 'USTEST300002' }));
    await insertTestTrack(collectionName, generateTestTrack({ isrc: 'USTEST300003' }));

    const collection = await qdrantClient.getCollection(collectionName);
    expect(collection.points_count).toBeGreaterThanOrEqual(2);
  });
});

describe('Vector Similarity Search', () => {
  let collectionName: string;
  const queryVector = generateRandomVector();

  beforeAll(async () => {
    collectionName = await createTestCollection();

    // Insert test tracks with known vectors
    await insertTestTrack(
      collectionName,
      generateTestTrack({
        isrc: 'USTEST400001',
        title: 'Similar Track',
        interpretation: 'This track is about testing vector similarity',
        interpretation_embedding: queryVector, // Identical vector
      })
    );

    await insertTestTrack(
      collectionName,
      generateTestTrack({
        isrc: 'USTEST400002',
        title: 'Different Track',
        interpretation: 'This track has completely different content',
      })
    );
  });

  afterAll(async () => {
    await deleteTestCollection(collectionName);
  });

  it('should perform vector similarity search', async () => {
    const results = await qdrantClient.query(collectionName, {
      query: queryVector,
      using: 'interpretation_embedding',
      limit: 10,
      with_payload: true,
    });

    expect(results.points).toBeDefined();
    expect(results.points.length).toBeGreaterThan(0);

    // First result should be the identical vector
    const topResult = results.points[0];
    expect(topResult.payload?.isrc).toBe('USTEST400001');
  });

  it('should rank results by cosine similarity', async () => {
    const results = await qdrantClient.query(collectionName, {
      query: queryVector,
      using: 'interpretation_embedding',
      limit: 10,
      with_payload: true,
    });

    expect(results.points.length).toBeGreaterThanOrEqual(2);

    // Scores should be in descending order
    for (let i = 1; i < results.points.length; i++) {
      const prevScore = results.points[i - 1].score || 0;
      const currScore = results.points[i].score || 0;
      expect(prevScore).toBeGreaterThanOrEqual(currScore);
    }
  });

  it('should return payload with search results', async () => {
    const results = await qdrantClient.query(collectionName, {
      query: queryVector,
      using: 'interpretation_embedding',
      limit: 1,
      with_payload: true,
    });

    expect(results.points.length).toBeGreaterThan(0);
    const result = results.points[0];
    expect(result.payload).toBeDefined();
    expect(result.payload?.title).toBeDefined();
    expect(result.payload?.artist).toBeDefined();
  });
});

describe('BM25 Keyword Search', () => {
  let collectionName: string;

  beforeAll(async () => {
    collectionName = await createTestCollection();

    // Insert tracks with specific lyrics for keyword matching
    await insertTestTrack(
      collectionName,
      generateTestTrack({
        isrc: 'USTEST500001',
        title: 'Love Song',
        artist: 'The Beatles',
        lyrics: 'All you need is love, love is all you need',
        interpretation: 'A classic song about love',
      })
    );

    await insertTestTrack(
      collectionName,
      generateTestTrack({
        isrc: 'USTEST500002',
        title: 'Rock Anthem',
        artist: 'Queen',
        lyrics: 'We will rock you, rock rock rock',
        interpretation: 'An energetic rock song',
      })
    );

    await insertTestTrack(
      collectionName,
      generateTestTrack({
        isrc: 'USTEST500003',
        title: 'Love Ballad',
        artist: 'Adele',
        lyrics: 'Someone like you, I love you',
        interpretation: 'A heartfelt love ballad',
      })
    );
  });

  afterAll(async () => {
    await deleteTestCollection(collectionName);
  });

  it('should perform BM25 keyword search on text fields', async () => {
    // Search for "love" - should match tracks with love in lyrics/title/interpretation
    const loveVector = generateSparseVector('love');

    const results = await qdrantClient.query(collectionName, {
      query: loveVector,
      using: 'text_sparse',
      limit: 10,
      with_payload: true,
    });

    expect(results.points).toBeDefined();
    expect(results.points.length).toBeGreaterThan(0);

    // Should include tracks with "love" in their content
    const isrcs = results.points.map((p) => p.payload?.isrc);
    expect(isrcs).toContain('USTEST500001'); // Love Song
    expect(isrcs).toContain('USTEST500003'); // Love Ballad
  });

  it('should rank keyword results by BM25 relevance', async () => {
    const rockVector = generateSparseVector('rock');

    const results = await qdrantClient.query(collectionName, {
      query: rockVector,
      using: 'text_sparse',
      limit: 10,
      with_payload: true,
    });

    expect(results.points.length).toBeGreaterThan(0);

    // "Rock Anthem" should be highly ranked (has "rock" multiple times)
    const topResults = results.points.slice(0, 2);
    const topIsrcs = topResults.map((p) => p.payload?.isrc);
    expect(topIsrcs).toContain('USTEST500002');
  });

  it('should search across multiple text fields', async () => {
    // Search for "Beatles" which appears in artist field
    const beatlesVector = generateSparseVector('Beatles');

    const results = await qdrantClient.query(collectionName, {
      query: beatlesVector,
      using: 'text_sparse',
      limit: 10,
      with_payload: true,
    });

    expect(results.points.length).toBeGreaterThan(0);
    expect(results.points[0].payload?.isrc).toBe('USTEST500001');
  });

  it('should handle searches with no matches', async () => {
    const noMatchVector = generateSparseVector('xyzzyzxqwerty12345');

    const results = await qdrantClient.query(collectionName, {
      query: noMatchVector,
      using: 'text_sparse',
      limit: 10,
      with_payload: true,
    });

    // Should return empty or low-scored results
    expect(results.points).toBeDefined();
  });
});

describe('Hybrid Search (RRF)', () => {
  let collectionName: string;
  const testVector = generateRandomVector();

  beforeAll(async () => {
    collectionName = await createTestCollection();

    // Insert tracks for hybrid search testing
    await insertTestTrack(
      collectionName,
      generateTestTrack({
        isrc: 'USTEST600001',
        title: 'Jazz Blues',
        lyrics: 'Playing the blues on a rainy night',
        interpretation: 'A melancholic jazz song',
        interpretation_embedding: testVector,
      })
    );

    await insertTestTrack(
      collectionName,
      generateTestTrack({
        isrc: 'USTEST600002',
        title: 'Blues Rock',
        lyrics: 'Electric blues with heavy guitars',
        interpretation: 'An energetic blues rock fusion',
      })
    );
  });

  afterAll(async () => {
    await deleteTestCollection(collectionName);
  });

  it('should support Reciprocal Rank Fusion for hybrid search', async () => {
    // Hybrid search combining vector similarity and keyword match
    const bluesVector = generateSparseVector('blues');

    const results = await qdrantClient.query(collectionName, {
      prefetch: [
        {
          query: testVector,
          using: 'interpretation_embedding',
          limit: 20,
        },
        {
          query: bluesVector,
          using: 'text_sparse',
          limit: 20,
        },
      ],
      query: { fusion: 'rrf' },
      limit: 10,
      with_payload: true,
    });

    expect(results.points).toBeDefined();
    expect(results.points.length).toBeGreaterThan(0);

    // Results should combine both vector similarity and keyword relevance
    const isrcs = results.points.map((p) => p.payload?.isrc);
    expect(isrcs.length).toBeGreaterThan(0);
  });
});
