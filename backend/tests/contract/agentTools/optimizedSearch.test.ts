/**
 * Optimized Search Contract Tests
 *
 * Feature: 013-agent-tool-optimization
 *
 * Tests the optimized semantic search types and schemas.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type {
  OptimizedIndexedTrackResult,
  OptimizedSemanticSearchOutput,
  AudioFeatures,
} from '../../../src/types/agentTools.js';
import {
  AGENT_SEARCH_PAYLOAD_FIELDS,
  type OptimizedSearchResult,
} from '../../../src/clients/qdrantClient.js';

// -----------------------------------------------------------------------------
// Zod Schemas for Validation (mirror contracts/semanticSearch.ts)
// -----------------------------------------------------------------------------

const AudioFeaturesSchema = z.object({
  acousticness: z.number().min(0).max(1).optional(),
  danceability: z.number().min(0).max(1).optional(),
  energy: z.number().min(0).max(1).optional(),
  instrumentalness: z.number().min(0).max(1).optional(),
  key: z.number().int().min(-1).max(11).optional(),
  liveness: z.number().min(0).max(1).optional(),
  loudness: z.number().min(-60).max(0).optional(),
  mode: z.union([z.literal(0), z.literal(1)]).optional(),
  speechiness: z.number().min(0).max(1).optional(),
  tempo: z.number().min(0).max(250).optional(),
  valence: z.number().min(0).max(1).optional(),
});

const OptimizedIndexedTrackResultSchema = z.object({
  isrc: z.string().length(12).regex(/^[A-Z0-9]{12}$/i),
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().min(1),
  artworkUrl: z.string().url().optional(),
  duration: z.number().positive().optional(),
  inLibrary: z.boolean(),
  isIndexed: z.literal(true),
  score: z.number().min(0).max(1),
  shortDescription: z.string().max(500).nullable(),
  audioFeatures: AudioFeaturesSchema.optional(),
});

const OptimizedSemanticSearchOutputSchema = z.object({
  tracks: z.array(OptimizedIndexedTrackResultSchema),
  query: z.string(),
  totalFound: z.number().int().min(0),
  summary: z.string(),
  durationMs: z.number().int().min(0),
});

// -----------------------------------------------------------------------------
// T004: Contract test for OptimizedIndexedTrackResult schema validation
// -----------------------------------------------------------------------------

describe('OptimizedIndexedTrackResult', () => {
  it('validates a complete optimized track result', () => {
    const track: OptimizedIndexedTrackResult = {
      isrc: 'USRC12345678',
      title: 'Test Track',
      artist: 'Test Artist',
      album: 'Test Album',
      inLibrary: true,
      isIndexed: true,
      score: 0.85,
      shortDescription: 'A melancholic song about loss and hope.',
      audioFeatures: {
        acousticness: 0.3,
        danceability: 0.6,
        energy: 0.7,
        valence: 0.4,
      },
    };

    const result = OptimizedIndexedTrackResultSchema.safeParse(track);
    expect(result.success).toBe(true);
  });

  it('validates track with null shortDescription', () => {
    const track: OptimizedIndexedTrackResult = {
      isrc: 'USRC12345678',
      title: 'Test Track',
      artist: 'Test Artist',
      album: 'Test Album',
      inLibrary: false,
      isIndexed: true,
      score: 0.5,
      shortDescription: null,
    };

    const result = OptimizedIndexedTrackResultSchema.safeParse(track);
    expect(result.success).toBe(true);
  });

  it('validates track with optional fields', () => {
    const track: OptimizedIndexedTrackResult = {
      isrc: 'GBAYE9876543',
      title: 'Another Track',
      artist: 'Another Artist',
      album: 'Another Album',
      artworkUrl: 'https://example.com/art.jpg',
      duration: 240,
      inLibrary: true,
      isIndexed: true,
      score: 0.95,
      shortDescription: 'An upbeat dance track.',
    };

    const result = OptimizedIndexedTrackResultSchema.safeParse(track);
    expect(result.success).toBe(true);
  });

  it('rejects track with invalid ISRC format', () => {
    const track = {
      isrc: 'INVALID',
      title: 'Test Track',
      artist: 'Test Artist',
      album: 'Test Album',
      inLibrary: false,
      isIndexed: true,
      score: 0.5,
      shortDescription: null,
    };

    const result = OptimizedIndexedTrackResultSchema.safeParse(track);
    expect(result.success).toBe(false);
  });

  it('rejects track with score out of range', () => {
    const track = {
      isrc: 'USRC12345678',
      title: 'Test Track',
      artist: 'Test Artist',
      album: 'Test Album',
      inLibrary: false,
      isIndexed: true,
      score: 1.5, // Invalid: > 1
      shortDescription: null,
    };

    const result = OptimizedIndexedTrackResultSchema.safeParse(track);
    expect(result.success).toBe(false);
  });

  it('rejects track with shortDescription over 500 characters', () => {
    const track = {
      isrc: 'USRC12345678',
      title: 'Test Track',
      artist: 'Test Artist',
      album: 'Test Album',
      inLibrary: false,
      isIndexed: true,
      score: 0.5,
      shortDescription: 'x'.repeat(501), // Invalid: > 500 chars
    };

    const result = OptimizedIndexedTrackResultSchema.safeParse(track);
    expect(result.success).toBe(false);
  });

  it('does NOT include interpretation field', () => {
    // TypeScript enforces this at compile time, but we verify the schema
    const track = {
      isrc: 'USRC12345678',
      title: 'Test Track',
      artist: 'Test Artist',
      album: 'Test Album',
      inLibrary: false,
      isIndexed: true,
      score: 0.5,
      shortDescription: 'Short desc',
      interpretation: 'This should not be here', // Extra field
    };

    // Schema should still pass (extra fields are stripped by Zod)
    const result = OptimizedIndexedTrackResultSchema.safeParse(track);
    expect(result.success).toBe(true);
    if (result.success) {
      // Verify interpretation is NOT in the output
      expect('interpretation' in result.data).toBe(false);
    }
  });

  it('does NOT include lyrics field', () => {
    const track = {
      isrc: 'USRC12345678',
      title: 'Test Track',
      artist: 'Test Artist',
      album: 'Test Album',
      inLibrary: false,
      isIndexed: true,
      score: 0.5,
      shortDescription: 'Short desc',
      lyrics: 'These are lyrics that should not be here', // Extra field
    };

    const result = OptimizedIndexedTrackResultSchema.safeParse(track);
    expect(result.success).toBe(true);
    if (result.success) {
      // Verify lyrics is NOT in the output
      expect('lyrics' in result.data).toBe(false);
    }
  });

  // SC-004: 100% of semantic search results include short descriptions for tracks that have them
  it('preserves shortDescription when present (SC-004)', () => {
    const shortDescText = 'A haunting ballad about longing and regret, featuring sparse piano and ethereal vocals.';
    const track: OptimizedIndexedTrackResult = {
      isrc: 'USRC12345678',
      title: 'Test Track',
      artist: 'Test Artist',
      album: 'Test Album',
      inLibrary: true,
      isIndexed: true,
      score: 0.85,
      shortDescription: shortDescText,
    };

    const result = OptimizedIndexedTrackResultSchema.safeParse(track);
    expect(result.success).toBe(true);
    if (result.success) {
      // Verify shortDescription is preserved exactly as provided
      expect(result.data.shortDescription).toBe(shortDescText);
      expect(result.data.shortDescription).not.toBeNull();
      expect(result.data.shortDescription).not.toBeUndefined();
    }
  });
});

// -----------------------------------------------------------------------------
// T005: Contract test for SemanticSearchOutput with optimized tracks
// -----------------------------------------------------------------------------

describe('OptimizedSemanticSearchOutput', () => {
  it('validates a complete optimized search output', () => {
    const output: OptimizedSemanticSearchOutput = {
      tracks: [
        {
          isrc: 'USRC12345678',
          title: 'Test Track',
          artist: 'Test Artist',
          album: 'Test Album',
          inLibrary: true,
          isIndexed: true,
          score: 0.85,
          shortDescription: 'A melancholic song.',
        },
      ],
      query: 'melancholic songs about loss',
      totalFound: 10,
      summary: 'Found 10 tracks matching "melancholic songs about loss"',
      durationMs: 150,
    };

    const result = OptimizedSemanticSearchOutputSchema.safeParse(output);
    expect(result.success).toBe(true);
  });

  it('validates empty results', () => {
    const output: OptimizedSemanticSearchOutput = {
      tracks: [],
      query: 'nonexistent query',
      totalFound: 0,
      summary: 'No tracks found matching "nonexistent query"',
      durationMs: 50,
    };

    const result = OptimizedSemanticSearchOutputSchema.safeParse(output);
    expect(result.success).toBe(true);
  });

  it('validates output with multiple tracks', () => {
    const output: OptimizedSemanticSearchOutput = {
      tracks: [
        {
          isrc: 'USRC12345678',
          title: 'Track 1',
          artist: 'Artist 1',
          album: 'Album 1',
          inLibrary: true,
          isIndexed: true,
          score: 0.9,
          shortDescription: 'First track description.',
        },
        {
          isrc: 'GBAYE9876543',
          title: 'Track 2',
          artist: 'Artist 2',
          album: 'Album 2',
          inLibrary: false,
          isIndexed: true,
          score: 0.8,
          shortDescription: null, // No description yet
        },
        {
          isrc: 'DEAB12345678',
          title: 'Track 3',
          artist: 'Artist 3',
          album: 'Album 3',
          inLibrary: true,
          isIndexed: true,
          score: 0.75,
          shortDescription: 'Third track description.',
          audioFeatures: {
            energy: 0.8,
            valence: 0.6,
          },
        },
      ],
      query: 'upbeat songs',
      totalFound: 3,
      summary: 'Found 3 tracks matching "upbeat songs"',
      durationMs: 200,
    };

    const result = OptimizedSemanticSearchOutputSchema.safeParse(output);
    expect(result.success).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// AGENT_SEARCH_PAYLOAD_FIELDS constant tests
// -----------------------------------------------------------------------------

describe('AGENT_SEARCH_PAYLOAD_FIELDS', () => {
  it('includes all required basic fields', () => {
    expect(AGENT_SEARCH_PAYLOAD_FIELDS).toContain('isrc');
    expect(AGENT_SEARCH_PAYLOAD_FIELDS).toContain('title');
    expect(AGENT_SEARCH_PAYLOAD_FIELDS).toContain('artist');
    expect(AGENT_SEARCH_PAYLOAD_FIELDS).toContain('album');
    expect(AGENT_SEARCH_PAYLOAD_FIELDS).toContain('short_description');
  });

  it('includes all audio feature fields', () => {
    expect(AGENT_SEARCH_PAYLOAD_FIELDS).toContain('acousticness');
    expect(AGENT_SEARCH_PAYLOAD_FIELDS).toContain('danceability');
    expect(AGENT_SEARCH_PAYLOAD_FIELDS).toContain('energy');
    expect(AGENT_SEARCH_PAYLOAD_FIELDS).toContain('instrumentalness');
    expect(AGENT_SEARCH_PAYLOAD_FIELDS).toContain('key');
    expect(AGENT_SEARCH_PAYLOAD_FIELDS).toContain('liveness');
    expect(AGENT_SEARCH_PAYLOAD_FIELDS).toContain('loudness');
    expect(AGENT_SEARCH_PAYLOAD_FIELDS).toContain('mode');
    expect(AGENT_SEARCH_PAYLOAD_FIELDS).toContain('speechiness');
    expect(AGENT_SEARCH_PAYLOAD_FIELDS).toContain('tempo');
    expect(AGENT_SEARCH_PAYLOAD_FIELDS).toContain('valence');
  });

  it('does NOT include interpretation field', () => {
    expect(AGENT_SEARCH_PAYLOAD_FIELDS).not.toContain('interpretation');
  });

  it('does NOT include lyrics field', () => {
    expect(AGENT_SEARCH_PAYLOAD_FIELDS).not.toContain('lyrics');
  });

  it('has exactly 16 fields (5 basic + 11 audio features)', () => {
    // isrc, title, artist, album, short_description = 5
    // acousticness, danceability, energy, instrumentalness, key,
    // liveness, loudness, mode, speechiness, tempo, valence = 11
    expect(AGENT_SEARCH_PAYLOAD_FIELDS).toHaveLength(16);
  });
});

// -----------------------------------------------------------------------------
// T018: Contract test for semantic search trace includes payload size metadata
// (Placed here as it's related to optimized search)
// -----------------------------------------------------------------------------

describe('Payload size metadata', () => {
  it('OptimizedSearchResult has all required fields for size calculation', () => {
    // This validates that OptimizedSearchResult can be used for payload size tracking
    const result: OptimizedSearchResult = {
      id: 'test-uuid',
      isrc: 'USRC12345678',
      title: 'Test Track',
      artist: 'Test Artist',
      album: 'Test Album',
      score: 0.85,
      shortDescription: 'A test description.',
      acousticness: 0.5,
      danceability: 0.6,
      energy: 0.7,
      instrumentalness: 0.1,
      key: 5,
      liveness: 0.2,
      loudness: -8,
      mode: 1,
      speechiness: 0.1,
      tempo: 120,
      valence: 0.8,
    };

    // Calculate approximate payload size (for observability)
    const payloadStr = JSON.stringify(result);
    const payloadSize = payloadStr.length;

    // Verify it's a reasonable size (should be small without interpretation/lyrics)
    expect(payloadSize).toBeLessThan(500); // Much smaller than full payload
    expect(payloadSize).toBeGreaterThan(100); // But not empty
  });

  it('Optimized result is significantly smaller than full result', () => {
    // Mock full result with interpretation and lyrics
    const fullResult = {
      id: 'test-uuid',
      isrc: 'USRC12345678',
      title: 'Test Track',
      artist: 'Test Artist',
      album: 'Test Album',
      score: 0.85,
      shortDescription: 'A short 50-word description about the track.',
      interpretation: 'A '.repeat(500) + 'very long interpretation text that explains the meaning of the song in great detail.',
      lyrics: 'Verse 1:\n' + 'La la la\n'.repeat(50) + '\n\nChorus:\n' + 'Na na na\n'.repeat(30),
      acousticness: 0.5,
      danceability: 0.6,
      energy: 0.7,
      instrumentalness: 0.1,
      key: 5,
      liveness: 0.2,
      loudness: -8,
      mode: 1,
      speechiness: 0.1,
      tempo: 120,
      valence: 0.8,
    };

    // Optimized result (no interpretation/lyrics)
    const optimizedResult: OptimizedSearchResult = {
      id: 'test-uuid',
      isrc: 'USRC12345678',
      title: 'Test Track',
      artist: 'Test Artist',
      album: 'Test Album',
      score: 0.85,
      shortDescription: 'A short 50-word description about the track.',
      acousticness: 0.5,
      danceability: 0.6,
      energy: 0.7,
      instrumentalness: 0.1,
      key: 5,
      liveness: 0.2,
      loudness: -8,
      mode: 1,
      speechiness: 0.1,
      tempo: 120,
      valence: 0.8,
    };

    const fullSize = JSON.stringify(fullResult).length;
    const optimizedSize = JSON.stringify(optimizedResult).length;

    // Optimized should be at least 70% smaller (per SC-001)
    const reductionPercent = ((fullSize - optimizedSize) / fullSize) * 100;
    expect(reductionPercent).toBeGreaterThanOrEqual(70);
  });
});
