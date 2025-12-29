/**
 * Test utilities for vector search index
 *
 * Provides helper functions for creating test data, managing test collections,
 * and generating fixtures for contract and integration tests.
 */

import { randomBytes, randomUUID } from 'crypto';
import { qdrantClient } from '../client/qdrant.js';
import { hashIsrcToUuid } from '../utils/isrcHash.js';
import { getCollectionConfig } from '../schema/trackCollection.js';
import type { TrackDocument } from '../schema/trackDocument.js';

/**
 * Generate a random 4096-dimensional normalized vector
 *
 * Creates a random vector suitable for testing vector similarity search.
 * Vector is L2-normalized to unit length for cosine similarity compatibility.
 *
 * @returns 4096-dimensional Float32 array
 */
export function generateRandomVector(): number[] {
  const vector = new Float32Array(4096);

  // Fill with random values from normal distribution
  for (let i = 0; i < 4096; i++) {
    vector[i] = (Math.random() - 0.5) * 2; // Range: -1 to 1
  }

  // Normalize to unit length for cosine similarity
  const magnitude = Math.sqrt(
    vector.reduce((sum, val) => sum + val * val, 0)
  );

  if (magnitude > 0) {
    for (let i = 0; i < 4096; i++) {
      vector[i] /= magnitude;
    }
  }

  return Array.from(vector);
}

/**
 * Generate a random test ISRC
 *
 * Format: USTEST + 6 random digits (e.g., USTEST123456)
 * Uses "USTEST" prefix to clearly mark test data.
 *
 * @returns Valid ISRC string (12 characters)
 */
export function generateTestIsrc(): string {
  const randomDigits = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, '0');
  return `USTEST${randomDigits}`;
}

/**
 * Create a test collection with unique name
 *
 * Generates a collection name with pattern: tracks-test-{uuid}
 * Collection can be safely deleted after tests without affecting production data.
 *
 * @returns Test collection name
 */
export function generateTestCollectionName(): string {
  const uuid = randomUUID().split('-')[0]; // Use first segment for brevity
  return `tracks-test-${uuid}`;
}

/**
 * Create a test collection with full schema
 *
 * Creates a collection with the same configuration as production, but with
 * a unique test name. Useful for integration tests.
 *
 * @returns Test collection name
 */
export async function createTestCollection(): Promise<string> {
  const collectionName = generateTestCollectionName();
  const config = getCollectionConfig(collectionName);

  await qdrantClient.createCollection(collectionName, config);

  console.log(`[testUtils] INFO: Created test collection '${collectionName}'`);
  return collectionName;
}

/**
 * Delete a test collection
 *
 * Safety check: Only deletes collections with "tracks-test-" prefix to prevent
 * accidental deletion of production collections.
 *
 * @param collectionName - Name of test collection to delete
 * @throws Error if collection name doesn't have test prefix
 */
export async function deleteTestCollection(
  collectionName: string
): Promise<void> {
  // Safety check: only delete test collections
  if (!collectionName.startsWith('tracks-test-')) {
    throw new Error(
      `Refusing to delete collection '${collectionName}': not a test collection (must start with 'tracks-test-')`
    );
  }

  try {
    await qdrantClient.deleteCollection(collectionName);
    console.log(`[testUtils] INFO: Deleted test collection '${collectionName}'`);
  } catch (error) {
    // Ignore "not found" errors (collection already deleted)
    if (
      error instanceof Error &&
      error.message.includes('Not found')
    ) {
      console.log(
        `[testUtils] INFO: Collection '${collectionName}' already deleted`
      );
      return;
    }
    throw error;
  }
}

/**
 * Generate a test track document with default values
 *
 * Creates a valid track document with all required fields and optional
 * audio features. Useful for testing insert/update/search operations.
 *
 * @param overrides - Partial track document to override defaults
 * @returns Complete track document ready for insertion
 */
export function generateTestTrack(
  overrides?: Partial<TrackDocument>
): TrackDocument {
  const isrc = overrides?.isrc || generateTestIsrc();

  return {
    isrc,
    title: overrides?.title || 'Test Track',
    artist: overrides?.artist || 'Test Artist',
    album: overrides?.album || 'Test Album',
    lyrics: overrides?.lyrics !== undefined ? overrides.lyrics : 'Test lyrics content for searching',
    interpretation: overrides?.interpretation !== undefined
      ? overrides.interpretation
      : 'This is a test track for validating the vector search infrastructure',
    interpretation_embedding: overrides?.interpretation_embedding || generateRandomVector(),

    // Audio features (all optional)
    acousticness: overrides?.acousticness !== undefined ? overrides.acousticness : 0.5,
    danceability: overrides?.danceability !== undefined ? overrides.danceability : 0.7,
    energy: overrides?.energy !== undefined ? overrides.energy : 0.6,
    instrumentalness: overrides?.instrumentalness !== undefined ? overrides.instrumentalness : 0.1,
    key: overrides?.key !== undefined ? overrides.key : 5,
    liveness: overrides?.liveness !== undefined ? overrides.liveness : 0.2,
    loudness: overrides?.loudness !== undefined ? overrides.loudness : -8,
    mode: overrides?.mode !== undefined ? overrides.mode : 1,
    speechiness: overrides?.speechiness !== undefined ? overrides.speechiness : 0.05,
    tempo: overrides?.tempo !== undefined ? overrides.tempo : 120,
    valence: overrides?.valence !== undefined ? overrides.valence : 0.65,
  };
}

/**
 * Insert a test track into a collection
 *
 * Validates the track document, generates deterministic UUID from ISRC,
 * and upserts to Qdrant. Returns the ISRC for retrieval in tests.
 *
 * @param collectionName - Target collection name
 * @param track - Track document to insert
 * @returns ISRC of inserted track
 */
export async function insertTestTrack(
  collectionName: string,
  track: TrackDocument
): Promise<string> {
  const pointId = hashIsrcToUuid(track.isrc);
  const { interpretation_embedding, ...payload } = track;

  // Generate sparse vector from text fields for BM25 search
  const textContent = [
    track.title,
    track.artist,
    track.lyrics || '',
    track.interpretation || '',
  ]
    .filter((s) => s)
    .join(' ');

  const sparseVector = generateSparseVector(textContent);

  await qdrantClient.upsert(collectionName, {
    points: [
      {
        id: pointId,
        vector: {
          interpretation_embedding,
          text_sparse: sparseVector,
        },
        payload,
      },
    ],
  });

  return track.isrc;
}

/**
 * Retrieve track by ISRC from collection
 *
 * @param collectionName - Collection to search
 * @param isrc - ISRC of track to retrieve
 * @returns Track payload or null if not found
 */
export async function retrieveTrackByIsrc(
  collectionName: string,
  isrc: string
): Promise<Record<string, unknown> | null> {
  const pointId = hashIsrcToUuid(isrc);

  const result = await qdrantClient.retrieve(collectionName, {
    ids: [pointId],
    with_payload: true,
    with_vector: false,
  });

  if (result.length === 0) {
    return null;
  }

  return result[0].payload as Record<string, unknown>;
}

/**
 * Generate sparse vector from text for BM25 search
 *
 * Simple tokenization: lowercase, split on whitespace, remove punctuation
 * Creates sparse vector with word indices and weights
 *
 * @param text - Text to convert to sparse vector
 * @returns Sparse vector for Qdrant
 */
export function generateSparseVector(text: string): {
  indices: number[];
  values: number[];
} {
  // Simple tokenization: lowercase, remove punctuation, split on whitespace
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 0);

  // Create a simple sparse representation
  // Map each unique word to an index (hash-based)
  const wordMap = new Map<string, number>();
  words.forEach((word) => {
    const count = wordMap.get(word) || 0;
    wordMap.set(word, count + 1);
  });

  // Convert to sparse vector format
  const indices: number[] = [];
  const values: number[] = [];

  wordMap.forEach((count, word) => {
    // Simple hash to generate consistent indices
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    indices.push(Math.abs(hash) % 1000000); // Keep indices reasonable
    values.push(count);
  });

  return { indices, values };
}
