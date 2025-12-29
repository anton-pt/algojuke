/**
 * Contract tests for Track Document schema
 *
 * Validates:
 * - Schema structure and field requirements
 * - ISRC format and uniqueness
 * - Data type constraints
 * - Audio feature validation
 */

import { describe, it, expect } from 'vitest';
import {
  TrackDocumentSchema,
  validateTrackDocument,
  safeValidateTrackDocument,
} from '../../src/schema/trackDocument.js';
import { hashIsrcToUuid, isValidIsrc } from '../../src/utils/isrcHash.js';
import { generateRandomVector, generateTestIsrc, generateTestTrack } from '../../src/scripts/testUtils.js';

describe('TrackDocument Schema Validation', () => {
  describe('Required Fields', () => {
    it('should validate a complete valid track document', () => {
      const track = generateTestTrack();
      expect(() => validateTrackDocument(track)).not.toThrow();
    });

    it('should require ISRC field', () => {
      const track = generateTestTrack();
      delete (track as any).isrc;
      const result = safeValidateTrackDocument(track);
      expect(result.success).toBe(false);
    });

    it('should require title field', () => {
      const track = generateTestTrack();
      delete (track as any).title;
      const result = safeValidateTrackDocument(track);
      expect(result.success).toBe(false);
    });

    it('should require artist field', () => {
      const track = generateTestTrack();
      delete (track as any).artist;
      const result = safeValidateTrackDocument(track);
      expect(result.success).toBe(false);
    });

    it('should require album field', () => {
      const track = generateTestTrack();
      delete (track as any).album;
      const result = safeValidateTrackDocument(track);
      expect(result.success).toBe(false);
    });

    it('should require interpretation_embedding field', () => {
      const track = generateTestTrack();
      delete (track as any).interpretation_embedding;
      const result = safeValidateTrackDocument(track);
      expect(result.success).toBe(false);
    });
  });

  describe('ISRC Format Validation', () => {
    it('should accept valid 12-character alphanumeric ISRC', () => {
      const track = generateTestTrack({ isrc: 'USRC17607839' });
      expect(() => validateTrackDocument(track)).not.toThrow();
    });

    it('should reject ISRC with less than 12 characters', () => {
      const track = generateTestTrack({ isrc: 'USRC1760' });
      const result = safeValidateTrackDocument(track);
      expect(result.success).toBe(false);
    });

    it('should reject ISRC with more than 12 characters', () => {
      const track = generateTestTrack({ isrc: 'USRC176078391' });
      const result = safeValidateTrackDocument(track);
      expect(result.success).toBe(false);
    });

    it('should reject ISRC with special characters', () => {
      const track = generateTestTrack({ isrc: 'USRC-1760783' });
      const result = safeValidateTrackDocument(track);
      expect(result.success).toBe(false);
    });

    it('should accept ISRC with mixed case', () => {
      const track = generateTestTrack({ isrc: 'UsRc17607839' });
      expect(() => validateTrackDocument(track)).not.toThrow();
    });
  });

  describe('Vector Dimensions', () => {
    it('should accept 4096-dimensional embedding', () => {
      const track = generateTestTrack();
      expect(track.interpretation_embedding).toHaveLength(4096);
      expect(() => validateTrackDocument(track)).not.toThrow();
    });

    it('should reject embedding with wrong dimensions', () => {
      const track = generateTestTrack({ interpretation_embedding: new Array(1536).fill(0.1) });
      const result = safeValidateTrackDocument(track);
      expect(result.success).toBe(false);
    });

    it('should reject non-numeric embedding values', () => {
      const track = generateTestTrack({ interpretation_embedding: new Array(4096).fill('invalid' as any) });
      const result = safeValidateTrackDocument(track);
      expect(result.success).toBe(false);
    });
  });

  describe('Optional Fields', () => {
    it('should allow null lyrics', () => {
      const track = generateTestTrack({ lyrics: null });
      expect(() => validateTrackDocument(track)).not.toThrow();
    });

    it('should allow missing lyrics', () => {
      const track = generateTestTrack();
      delete (track as any).lyrics;
      expect(() => validateTrackDocument(track)).not.toThrow();
    });

    it('should allow null interpretation', () => {
      const track = generateTestTrack({ interpretation: null });
      expect(() => validateTrackDocument(track)).not.toThrow();
    });

    it('should allow missing interpretation', () => {
      const track = generateTestTrack();
      delete (track as any).interpretation;
      expect(() => validateTrackDocument(track)).not.toThrow();
    });
  });

  describe('Audio Feature Validation', () => {
    it('should accept valid audio features in range', () => {
      const track = generateTestTrack({
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
      expect(() => validateTrackDocument(track)).not.toThrow();
    });

    it('should reject acousticness out of range', () => {
      const track = generateTestTrack({ acousticness: 1.5 });
      const result = safeValidateTrackDocument(track);
      expect(result.success).toBe(false);
    });

    it('should reject key out of range', () => {
      const track = generateTestTrack({ key: 12 });
      const result = safeValidateTrackDocument(track);
      expect(result.success).toBe(false);
    });

    it('should reject loudness out of range', () => {
      const track = generateTestTrack({ loudness: 5 });
      const result = safeValidateTrackDocument(track);
      expect(result.success).toBe(false);
    });

    it('should reject invalid mode value', () => {
      const track = generateTestTrack({ mode: 2 as any });
      const result = safeValidateTrackDocument(track);
      expect(result.success).toBe(false);
    });

    it('should allow null audio features', () => {
      const track = generateTestTrack({
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
      expect(() => validateTrackDocument(track)).not.toThrow();
    });

    it('should allow missing audio features', () => {
      const track = generateTestTrack();
      delete (track as any).acousticness;
      delete (track as any).danceability;
      delete (track as any).energy;
      expect(() => validateTrackDocument(track)).not.toThrow();
    });
  });
});

describe('ISRC Uniqueness and Hashing', () => {
  it('should generate same UUID for same ISRC', () => {
    const isrc = 'USRC17607839';
    const uuid1 = hashIsrcToUuid(isrc);
    const uuid2 = hashIsrcToUuid(isrc);
    expect(uuid1).toBe(uuid2);
  });

  it('should generate different UUIDs for different ISRCs', () => {
    const uuid1 = hashIsrcToUuid('USRC17607839');
    const uuid2 = hashIsrcToUuid('GBUM71600123');
    expect(uuid1).not.toBe(uuid2);
  });

  it('should normalize ISRC case before hashing', () => {
    const uuid1 = hashIsrcToUuid('USRC17607839');
    const uuid2 = hashIsrcToUuid('usrc17607839');
    expect(uuid1).toBe(uuid2);
  });

  it('should validate ISRC format', () => {
    expect(isValidIsrc('USRC17607839')).toBe(true);
    expect(isValidIsrc('GBUM71600123')).toBe(true);
    expect(isValidIsrc('usrc17607839')).toBe(true);
    expect(isValidIsrc('INVALID')).toBe(false);
    expect(isValidIsrc('USRC-1760783')).toBe(false);
    expect(isValidIsrc('')).toBe(false);
  });

  it('should throw error for invalid ISRC format', () => {
    expect(() => hashIsrcToUuid('INVALID')).toThrow('Invalid ISRC format');
    expect(() => hashIsrcToUuid('USRC-1760')).toThrow('Invalid ISRC format');
  });
});
