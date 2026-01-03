/**
 * Suggest Playlist Tool Contract Tests
 *
 * Feature: 015-playlist-suggestion
 *
 * Tests for schema validation and output structure.
 * Written FIRST per Constitution Principle I (Test-First Development).
 */

import { describe, it, expect } from 'vitest';
import {
  SuggestPlaylistInputSchema,
  PlaylistInputTrackSchema,
  ToolName,
} from '../../../src/schemas/agentTools.js';
import type {
  SuggestPlaylistOutput,
  EnrichedPlaylistTrack,
} from '../../../src/types/agentTools.js';

// -----------------------------------------------------------------------------
// T008: Contract test for SuggestPlaylistInputSchema validation
// -----------------------------------------------------------------------------

describe('PlaylistInputTrackSchema', () => {
  const validTrack = {
    isrc: 'USRC12345678',
    title: 'Test Track',
    artist: 'Test Artist',
    reasoning: 'This track fits the mood perfectly',
  };

  it('validates a complete valid track', () => {
    const result = PlaylistInputTrackSchema.safeParse(validTrack);
    expect(result.success).toBe(true);
  });

  it('rejects empty ISRC', () => {
    const result = PlaylistInputTrackSchema.safeParse({
      ...validTrack,
      isrc: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid ISRC format (too short)', () => {
    const result = PlaylistInputTrackSchema.safeParse({
      ...validTrack,
      isrc: 'ABC123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('ISRC');
    }
  });

  it('rejects invalid ISRC format (too long)', () => {
    const result = PlaylistInputTrackSchema.safeParse({
      ...validTrack,
      isrc: 'USRC1234567890',
    });
    expect(result.success).toBe(false);
  });

  it('rejects ISRC with special characters', () => {
    const result = PlaylistInputTrackSchema.safeParse({
      ...validTrack,
      isrc: 'USRC-1234567',
    });
    expect(result.success).toBe(false);
  });

  it('accepts lowercase ISRCs (case insensitive)', () => {
    const result = PlaylistInputTrackSchema.safeParse({
      ...validTrack,
      isrc: 'usrc12345678',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty title', () => {
    const result = PlaylistInputTrackSchema.safeParse({
      ...validTrack,
      title: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('empty');
    }
  });

  it('rejects title over 500 characters', () => {
    const result = PlaylistInputTrackSchema.safeParse({
      ...validTrack,
      title: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty artist', () => {
    const result = PlaylistInputTrackSchema.safeParse({
      ...validTrack,
      artist: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('empty');
    }
  });

  it('rejects artist over 500 characters', () => {
    const result = PlaylistInputTrackSchema.safeParse({
      ...validTrack,
      artist: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty reasoning', () => {
    const result = PlaylistInputTrackSchema.safeParse({
      ...validTrack,
      reasoning: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('empty');
    }
  });

  it('rejects reasoning over 1000 characters', () => {
    const result = PlaylistInputTrackSchema.safeParse({
      ...validTrack,
      reasoning: 'x'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it('accepts reasoning at exactly 1000 characters', () => {
    const result = PlaylistInputTrackSchema.safeParse({
      ...validTrack,
      reasoning: 'x'.repeat(1000),
    });
    expect(result.success).toBe(true);
  });
});

describe('SuggestPlaylistInputSchema', () => {
  const validTrack = {
    isrc: 'USRC12345678',
    title: 'Test Track',
    artist: 'Test Artist',
    reasoning: 'This track fits the mood perfectly',
  };

  const validInput = {
    title: 'My Awesome Playlist',
    tracks: [validTrack],
  };

  it('validates minimal valid input (1 track)', () => {
    const result = SuggestPlaylistInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('validates input with multiple tracks', () => {
    const result = SuggestPlaylistInputSchema.safeParse({
      title: 'Multi-Track Playlist',
      tracks: [
        validTrack,
        { ...validTrack, isrc: 'GBAYE9876543' },
        { ...validTrack, isrc: 'FRXYZ1234567' },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tracks).toHaveLength(3);
    }
  });

  it('rejects empty title', () => {
    const result = SuggestPlaylistInputSchema.safeParse({
      ...validInput,
      title: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('empty');
    }
  });

  it('rejects title over 200 characters', () => {
    const result = SuggestPlaylistInputSchema.safeParse({
      ...validInput,
      title: 'x'.repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it('accepts title at exactly 200 characters', () => {
    const result = SuggestPlaylistInputSchema.safeParse({
      ...validInput,
      title: 'x'.repeat(200),
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty tracks array', () => {
    const result = SuggestPlaylistInputSchema.safeParse({
      ...validInput,
      tracks: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('at least 1');
    }
  });

  it('accepts 50 tracks (maximum)', () => {
    const tracks = Array.from({ length: 50 }, (_, i) => ({
      ...validTrack,
      isrc: `USRC${String(i).padStart(8, '0')}`,
    }));
    const result = SuggestPlaylistInputSchema.safeParse({
      title: 'Big Playlist',
      tracks,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tracks).toHaveLength(50);
    }
  });

  it('rejects more than 50 tracks', () => {
    const tracks = Array.from({ length: 51 }, (_, i) => ({
      ...validTrack,
      isrc: `USRC${String(i).padStart(8, '0')}`,
    }));
    const result = SuggestPlaylistInputSchema.safeParse({
      title: 'Too Big Playlist',
      tracks,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('50');
    }
  });

  it('rejects tracks with invalid ISRC', () => {
    const result = SuggestPlaylistInputSchema.safeParse({
      ...validInput,
      tracks: [{ ...validTrack, isrc: 'invalid' }],
    });
    expect(result.success).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// T009: Contract test for SuggestPlaylistOutput structure
// -----------------------------------------------------------------------------

describe('SuggestPlaylistOutput structure', () => {
  // Type-level tests to ensure the interface is correctly defined
  it('has required fields for EnrichedPlaylistTrack', () => {
    const track: EnrichedPlaylistTrack = {
      isrc: 'USRC12345678',
      title: 'Test Track',
      artist: 'Test Artist',
      album: 'Test Album',
      artworkUrl: 'https://example.com/art.jpg',
      duration: 180,
      reasoning: 'Great track',
      enriched: true,
      tidalId: '12345678',
    };

    expect(track.isrc).toBe('USRC12345678');
    expect(track.enriched).toBe(true);
    expect(track.tidalId).toBe('12345678');
  });

  it('allows null values for optional enrichment fields', () => {
    const unenrichedTrack: EnrichedPlaylistTrack = {
      isrc: 'USRC12345678',
      title: 'Fallback Title',
      artist: 'Fallback Artist',
      album: null,
      artworkUrl: null,
      duration: null,
      reasoning: 'Track not found on Tidal',
      enriched: false,
      tidalId: null,
    };

    expect(unenrichedTrack.album).toBeNull();
    expect(unenrichedTrack.artworkUrl).toBeNull();
    expect(unenrichedTrack.duration).toBeNull();
    expect(unenrichedTrack.enriched).toBe(false);
    expect(unenrichedTrack.tidalId).toBeNull();
  });

  it('has required fields for SuggestPlaylistOutput', () => {
    const output: SuggestPlaylistOutput = {
      summary: "Created playlist 'Test' with 2 tracks",
      durationMs: 1500,
      title: 'Test Playlist',
      tracks: [
        {
          isrc: 'USRC12345678',
          title: 'Track 1',
          artist: 'Artist 1',
          album: 'Album 1',
          artworkUrl: 'https://example.com/art1.jpg',
          duration: 180,
          reasoning: 'Great opener',
          enriched: true,
          tidalId: '11111111',
        },
        {
          isrc: 'GBAYE9876543',
          title: 'Track 2',
          artist: 'Artist 2',
          album: null,
          artworkUrl: null,
          duration: null,
          reasoning: 'Hidden gem',
          enriched: false,
          tidalId: null,
        },
      ],
      stats: {
        totalTracks: 2,
        enrichedTracks: 1,
        failedTracks: 1,
      },
    };

    expect(output.summary).toContain('Test');
    expect(output.durationMs).toBeGreaterThan(0);
    expect(output.title).toBe('Test Playlist');
    expect(output.tracks).toHaveLength(2);
    expect(output.stats.totalTracks).toBe(2);
    expect(output.stats.enrichedTracks).toBe(1);
    expect(output.stats.failedTracks).toBe(1);
  });

  it('stats sum correctly', () => {
    const output: SuggestPlaylistOutput = {
      summary: 'Test',
      durationMs: 1000,
      title: 'Test',
      tracks: [],
      stats: {
        totalTracks: 5,
        enrichedTracks: 3,
        failedTracks: 2,
      },
    };

    expect(output.stats.enrichedTracks + output.stats.failedTracks).toBe(
      output.stats.totalTracks
    );
  });
});

// -----------------------------------------------------------------------------
// T042: Contract test for partial enrichment output structure (Phase 6)
// -----------------------------------------------------------------------------

describe('Partial enrichment output structure', () => {
  it('correctly represents partially enriched playlist', () => {
    const partialOutput: SuggestPlaylistOutput = {
      summary: "Created playlist 'Underground Gems' with 3 tracks (2 without artwork)",
      durationMs: 2456,
      title: 'Underground Gems',
      tracks: [
        {
          isrc: 'USRC12345678',
          title: 'Known Track',
          artist: 'Known Artist',
          album: 'Known Album',
          artworkUrl: 'https://resources.tidal.com/images/xyz/160x160.jpg',
          duration: 245,
          reasoning: 'Great indie vibes',
          enriched: true,
          tidalId: '45678901',
        },
        {
          isrc: 'ZZUN00000001',
          title: 'Obscure Track',
          artist: 'Underground Artist',
          album: null,
          artworkUrl: null,
          duration: null,
          reasoning: 'Hidden gem from the underground scene',
          enriched: false,
          tidalId: null,
        },
        {
          isrc: 'ZZUN00000002',
          title: 'Another Obscure Track',
          artist: 'Another Underground Artist',
          album: null,
          artworkUrl: null,
          duration: null,
          reasoning: 'Raw and authentic sound',
          enriched: false,
          tidalId: null,
        },
      ],
      stats: {
        totalTracks: 3,
        enrichedTracks: 1,
        failedTracks: 2,
      },
    };

    // Verify structure
    expect(partialOutput.stats.totalTracks).toBe(3);
    expect(partialOutput.stats.enrichedTracks).toBe(1);
    expect(partialOutput.stats.failedTracks).toBe(2);

    // Verify enriched track has all data
    const enrichedTrack = partialOutput.tracks.find((t) => t.enriched);
    expect(enrichedTrack).toBeDefined();
    expect(enrichedTrack?.album).not.toBeNull();
    expect(enrichedTrack?.artworkUrl).not.toBeNull();
    expect(enrichedTrack?.tidalId).not.toBeNull();

    // Verify unenriched tracks have null for optional fields
    const unenrichedTracks = partialOutput.tracks.filter((t) => !t.enriched);
    expect(unenrichedTracks).toHaveLength(2);
    unenrichedTracks.forEach((track) => {
      expect(track.album).toBeNull();
      expect(track.artworkUrl).toBeNull();
      expect(track.duration).toBeNull();
      expect(track.tidalId).toBeNull();
      // But still has required fields from agent input
      expect(track.title).toBeTruthy();
      expect(track.artist).toBeTruthy();
      expect(track.reasoning).toBeTruthy();
    });
  });

  it('summary reflects partial enrichment status', () => {
    const partialOutput: SuggestPlaylistOutput = {
      summary: "Created playlist 'Test' with 5 tracks (2 without artwork)",
      durationMs: 1000,
      title: 'Test',
      tracks: [],
      stats: {
        totalTracks: 5,
        enrichedTracks: 3,
        failedTracks: 2,
      },
    };

    expect(partialOutput.summary).toContain('without artwork');
    expect(partialOutput.stats.failedTracks).toBeGreaterThan(0);
  });
});

// -----------------------------------------------------------------------------
// ToolName enum extension verification
// -----------------------------------------------------------------------------

describe('ToolName enum includes suggestPlaylist', () => {
  it('includes suggestPlaylist in tool names', () => {
    const names = ToolName.options;
    expect(names).toContain('suggestPlaylist');
  });

  it('validates suggestPlaylist as valid tool name', () => {
    const result = ToolName.safeParse('suggestPlaylist');
    expect(result.success).toBe(true);
  });

  it('has correct total count of tool names', () => {
    const names = ToolName.options;
    expect(names).toHaveLength(5); // semanticSearch, tidalSearch, batchMetadata, albumTracks, suggestPlaylist
  });
});
