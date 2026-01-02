/**
 * Semantic Search Tool Contract Tests
 *
 * Feature: 011-agent-tools
 *
 * Tests schema validation and output structure for the semantic search tool.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SemanticSearchInputSchema } from '../../../src/schemas/agentTools.js';
import type { SemanticSearchOutput, IndexedTrackResult } from '../../../src/types/agentTools.js';

describe('SemanticSearchInputSchema', () => {
  describe('query validation', () => {
    it('accepts valid query', () => {
      const result = SemanticSearchInputSchema.safeParse({
        query: 'melancholic songs about lost love',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query).toBe('melancholic songs about lost love');
        expect(result.data.limit).toBe(20); // default
      }
    });

    it('rejects empty query', () => {
      const result = SemanticSearchInputSchema.safeParse({ query: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('empty');
      }
    });

    it('rejects query longer than 2000 characters', () => {
      const longQuery = 'a'.repeat(2001);
      const result = SemanticSearchInputSchema.safeParse({ query: longQuery });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('2000');
      }
    });

    it('accepts query at exactly 2000 characters', () => {
      const maxQuery = 'a'.repeat(2000);
      const result = SemanticSearchInputSchema.safeParse({ query: maxQuery });
      expect(result.success).toBe(true);
    });
  });

  describe('limit validation', () => {
    it('uses default limit of 20 when not provided', () => {
      const result = SemanticSearchInputSchema.safeParse({
        query: 'test query',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
      }
    });

    it('accepts limit of 1', () => {
      const result = SemanticSearchInputSchema.safeParse({
        query: 'test query',
        limit: 1,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(1);
      }
    });

    it('accepts limit of 50', () => {
      const result = SemanticSearchInputSchema.safeParse({
        query: 'test query',
        limit: 50,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
      }
    });

    it('rejects limit of 0', () => {
      const result = SemanticSearchInputSchema.safeParse({
        query: 'test query',
        limit: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rejects limit greater than 50', () => {
      const result = SemanticSearchInputSchema.safeParse({
        query: 'test query',
        limit: 51,
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-integer limit', () => {
      const result = SemanticSearchInputSchema.safeParse({
        query: 'test query',
        limit: 10.5,
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('SemanticSearchOutput structure', () => {
  const mockOutput: SemanticSearchOutput = {
    tracks: [
      {
        isrc: 'USRC12345678',
        title: 'Someone Like You',
        artist: 'Adele',
        album: '21',
        artworkUrl: 'https://example.com/cover.jpg',
        duration: 285,
        inLibrary: true,
        isIndexed: true,
        score: 0.92,
        lyrics: 'Never mind, I\'ll find someone like you...',
        interpretation: 'A song about longing and acceptance after heartbreak',
        audioFeatures: {
          energy: 0.35,
          valence: 0.25,
          danceability: 0.52,
          acousticness: 0.78,
        },
      },
    ],
    query: 'melancholic songs about lost love',
    totalFound: 15,
    summary: 'Found 15 tracks matching "melancholic songs about lost love"',
    durationMs: 1234,
  };

  it('has required fields', () => {
    expect(mockOutput.tracks).toBeDefined();
    expect(mockOutput.query).toBeDefined();
    expect(mockOutput.totalFound).toBeDefined();
    expect(mockOutput.summary).toBeDefined();
    expect(mockOutput.durationMs).toBeDefined();
  });

  it('tracks array contains IndexedTrackResult items', () => {
    const track = mockOutput.tracks[0];
    expect(track.isrc).toBe('USRC12345678');
    expect(track.title).toBe('Someone Like You');
    expect(track.artist).toBe('Adele');
    expect(track.album).toBe('21');
    expect(track.inLibrary).toBe(true);
    expect(track.isIndexed).toBe(true);
    expect(track.score).toBe(0.92);
  });

  it('track has optional extended metadata fields', () => {
    const track = mockOutput.tracks[0];
    expect(track.lyrics).toBeDefined();
    expect(track.interpretation).toBeDefined();
    expect(track.audioFeatures).toBeDefined();
  });

  it('audio features has expected structure', () => {
    const audioFeatures = mockOutput.tracks[0].audioFeatures;
    expect(audioFeatures?.energy).toBe(0.35);
    expect(audioFeatures?.valence).toBe(0.25);
    expect(audioFeatures?.danceability).toBe(0.52);
    expect(audioFeatures?.acousticness).toBe(0.78);
  });

  it('summary follows expected format for results', () => {
    expect(mockOutput.summary).toContain('Found');
    expect(mockOutput.summary).toContain('15');
    expect(mockOutput.summary).toContain('tracks');
    expect(mockOutput.summary).toContain('melancholic songs about lost love');
  });
});

describe('SemanticSearchOutput edge cases', () => {
  it('handles empty results', () => {
    const emptyOutput: SemanticSearchOutput = {
      tracks: [],
      query: 'nonexistent weird query xyz',
      totalFound: 0,
      summary: 'No tracks found matching "nonexistent weird query xyz"',
      durationMs: 500,
    };

    expect(emptyOutput.tracks).toHaveLength(0);
    expect(emptyOutput.totalFound).toBe(0);
    expect(emptyOutput.summary).toContain('No tracks found');
  });

  it('handles track without optional fields', () => {
    const minimalTrack: IndexedTrackResult = {
      isrc: 'GBAYE0000123',
      title: 'Minimal Track',
      artist: 'Unknown Artist',
      album: 'Unknown Album',
      inLibrary: false,
      isIndexed: true,
      score: 0.5,
    };

    expect(minimalTrack.artworkUrl).toBeUndefined();
    expect(minimalTrack.duration).toBeUndefined();
    expect(minimalTrack.lyrics).toBeUndefined();
    expect(minimalTrack.interpretation).toBeUndefined();
    expect(minimalTrack.audioFeatures).toBeUndefined();
  });

  it('singular track summary', () => {
    const singleOutput: SemanticSearchOutput = {
      tracks: [{
        isrc: 'USRC12345678',
        title: 'Only One',
        artist: 'Artist',
        album: 'Album',
        inLibrary: false,
        isIndexed: true,
        score: 0.9,
      }],
      query: 'specific song query',
      totalFound: 1,
      summary: 'Found 1 track matching "specific song query"',
      durationMs: 800,
    };

    expect(singleOutput.summary).toContain('1 track');
    expect(singleOutput.summary).not.toContain('tracks');
  });
});
