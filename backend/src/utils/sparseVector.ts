/**
 * Sparse Vector Utility for BM25 Keyword Search
 *
 * Feature: 009-semantic-discovery-search
 * Date: 2025-12-30
 *
 * Generates client-side Term Frequency (TF) vectors for BM25 search.
 * Qdrant applies IDF weighting server-side (collection configured with modifier: 'idf').
 *
 * Based on research.md Section 3: BM25 Sparse Vector Generation
 */

import { createHash } from "crypto";
import type { SparseVector } from "../types/discovery.js";

/**
 * Tokenize text into normalized tokens for sparse vector generation.
 *
 * @param text - Input text to tokenize
 * @returns Array of lowercase tokens (length > 1)
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ") // Replace non-word chars with space
    .split(/\s+/) // Split on whitespace
    .filter((t) => t.length > 1); // Filter out single chars
}

/**
 * Hash a token to a 32-bit unsigned integer using MD5.
 * Uses the first 4 bytes of the MD5 hash as a uint32.
 *
 * @param token - Token to hash
 * @returns 32-bit unsigned integer hash
 */
export function hashToken(token: string): number {
  const hash = createHash("md5").update(token).digest();
  return hash.readUInt32BE(0);
}

/**
 * Convert text to a sparse vector for BM25 search.
 *
 * Generates Term Frequency (TF) vectors with BM25-style saturation.
 * The TF saturation formula: tf / (tf + k), where k = 1.2
 *
 * @param text - Input text to convert
 * @returns Sparse vector with indices (token hashes) and values (TF weights)
 */
export function textToSparseVector(text: string): SparseVector {
  const tokens = tokenize(text);

  // Count term frequencies
  const termFreq = new Map<number, number>();
  for (const token of tokens) {
    const hash = hashToken(token);
    termFreq.set(hash, (termFreq.get(hash) || 0) + 1);
  }

  // Convert to sparse vector format with BM25-style TF saturation
  const indices: number[] = [];
  const values: number[] = [];

  // BM25 k parameter for TF saturation
  const k = 1.2;

  for (const [hash, count] of termFreq) {
    indices.push(hash);
    // BM25-style TF saturation: tf / (tf + k)
    const tf = count / (count + k);
    values.push(tf);
  }

  return { indices, values };
}

/**
 * Combine multiple sparse vectors into one.
 * Used when merging vectors from multiple query expansions.
 *
 * @param vectors - Array of sparse vectors to combine
 * @returns Combined sparse vector with aggregated values
 */
export function combineSparseVectors(vectors: SparseVector[]): SparseVector {
  const combined = new Map<number, number>();

  for (const vector of vectors) {
    for (let i = 0; i < vector.indices.length; i++) {
      const index = vector.indices[i];
      const value = vector.values[i];
      combined.set(index, (combined.get(index) || 0) + value);
    }
  }

  const indices: number[] = [];
  const values: number[] = [];

  for (const [index, value] of combined) {
    indices.push(index);
    values.push(value);
  }

  return { indices, values };
}

/**
 * Check if a sparse vector is empty (no terms).
 *
 * @param vector - Sparse vector to check
 * @returns True if the vector has no terms
 */
export function isEmptySparseVector(vector: SparseVector): boolean {
  return vector.indices.length === 0;
}

/**
 * Get the number of unique terms in a sparse vector.
 *
 * @param vector - Sparse vector to check
 * @returns Number of unique terms
 */
export function getSparseVectorSize(vector: SparseVector): number {
  return vector.indices.length;
}
