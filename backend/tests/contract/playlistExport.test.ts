/**
 * Contract tests for Playlist Export API schemas
 *
 * Feature: 017-tidal-playlist-export
 *
 * Tests the Zod schemas for PlaylistExportRequest and PlaylistExportResponse
 * to ensure they match the contracts/playlist-export-api.md specification.
 */

import { describe, it, expect } from 'vitest';
import {
  PlaylistExportRequestSchema,
  PlaylistExportResponseSchema,
  PlaylistExportErrorSchema,
  TrackForExportSchema,
  SkippedTrackSchema,
  PlaylistExportErrorCode,
  type PlaylistExportRequest,
  type PlaylistExportResponse,
  type PlaylistExportError,
  type TrackForExport,
  type SkippedTrack,
} from '../../src/schemas/playlist.js';

describe('Playlist Export Schemas Contract', () => {
  describe('TrackForExportSchema', () => {
    it('should accept valid track with uppercase ISRC', () => {
      const track = {
        isrc: 'USUM71900765',
        title: 'Blinding Lights',
        artist: 'The Weeknd',
      };
      const result = TrackForExportSchema.safeParse(track);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isrc).toBe('USUM71900765');
        expect(result.data.title).toBe('Blinding Lights');
        expect(result.data.artist).toBe('The Weeknd');
      }
    });

    it('should accept valid track with lowercase ISRC (case-insensitive)', () => {
      const track = {
        isrc: 'usug11902288',
        title: "Don't Start Now",
        artist: 'Dua Lipa',
      };
      const result = TrackForExportSchema.safeParse(track);

      expect(result.success).toBe(true);
    });

    it('should reject ISRC shorter than 12 characters', () => {
      const track = {
        isrc: 'USUM719007',
        title: 'Blinding Lights',
        artist: 'The Weeknd',
      };
      const result = TrackForExportSchema.safeParse(track);

      expect(result.success).toBe(false);
    });

    it('should reject ISRC longer than 12 characters', () => {
      const track = {
        isrc: 'USUM7190076512',
        title: 'Blinding Lights',
        artist: 'The Weeknd',
      };
      const result = TrackForExportSchema.safeParse(track);

      expect(result.success).toBe(false);
    });

    it('should reject ISRC with special characters', () => {
      const track = {
        isrc: 'USUM-719-076',
        title: 'Blinding Lights',
        artist: 'The Weeknd',
      };
      const result = TrackForExportSchema.safeParse(track);

      expect(result.success).toBe(false);
    });

    it('should reject empty title', () => {
      const track = {
        isrc: 'USUM71900765',
        title: '',
        artist: 'The Weeknd',
      };
      const result = TrackForExportSchema.safeParse(track);

      expect(result.success).toBe(false);
    });

    it('should reject empty artist', () => {
      const track = {
        isrc: 'USUM71900765',
        title: 'Blinding Lights',
        artist: '',
      };
      const result = TrackForExportSchema.safeParse(track);

      expect(result.success).toBe(false);
    });
  });

  describe('PlaylistExportRequestSchema', () => {
    it('should accept valid request with single track', () => {
      const request = {
        name: 'Chill Vibes',
        tracks: [
          {
            isrc: 'USUM71900765',
            title: 'Blinding Lights',
            artist: 'The Weeknd',
          },
        ],
      };
      const result = PlaylistExportRequestSchema.safeParse(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Chill Vibes');
        expect(result.data.tracks).toHaveLength(1);
      }
    });

    it('should accept valid request with multiple tracks', () => {
      const request = {
        name: 'Party Mix',
        tracks: [
          { isrc: 'USUM71900765', title: 'Track 1', artist: 'Artist 1' },
          { isrc: 'USUG11902288', title: 'Track 2', artist: 'Artist 2' },
          { isrc: 'GBARL2000123', title: 'Track 3', artist: 'Artist 3' },
        ],
      };
      const result = PlaylistExportRequestSchema.safeParse(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tracks).toHaveLength(3);
      }
    });

    it('should trim whitespace from name', () => {
      const request = {
        name: '  My Playlist  ',
        tracks: [{ isrc: 'USUM71900765', title: 'Track', artist: 'Artist' }],
      };
      const result = PlaylistExportRequestSchema.safeParse(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('My Playlist');
      }
    });

    it('should reject empty name', () => {
      const request = {
        name: '',
        tracks: [{ isrc: 'USUM71900765', title: 'Track', artist: 'Artist' }],
      };
      const result = PlaylistExportRequestSchema.safeParse(request);

      expect(result.success).toBe(false);
    });

    it('should reject whitespace-only name', () => {
      const request = {
        name: '   ',
        tracks: [{ isrc: 'USUM71900765', title: 'Track', artist: 'Artist' }],
      };
      const result = PlaylistExportRequestSchema.safeParse(request);

      expect(result.success).toBe(false);
    });

    it('should reject name exceeding 150 characters', () => {
      const request = {
        name: 'a'.repeat(151),
        tracks: [{ isrc: 'USUM71900765', title: 'Track', artist: 'Artist' }],
      };
      const result = PlaylistExportRequestSchema.safeParse(request);

      expect(result.success).toBe(false);
    });

    it('should accept name at exactly 150 characters', () => {
      const request = {
        name: 'a'.repeat(150),
        tracks: [{ isrc: 'USUM71900765', title: 'Track', artist: 'Artist' }],
      };
      const result = PlaylistExportRequestSchema.safeParse(request);

      expect(result.success).toBe(true);
    });

    it('should reject empty tracks array', () => {
      const request = {
        name: 'My Playlist',
        tracks: [],
      };
      const result = PlaylistExportRequestSchema.safeParse(request);

      expect(result.success).toBe(false);
    });

    it('should reject more than 50 tracks', () => {
      const tracks = Array.from({ length: 51 }, (_, i) => ({
        isrc: `USUM7190076${i.toString().padStart(1, '0')}`,
        title: `Track ${i + 1}`,
        artist: `Artist ${i + 1}`,
      }));
      // Generate unique valid ISRCs for 51 tracks
      const validTracks = tracks.map((t, i) => ({
        ...t,
        isrc: `ISRC${i.toString().padStart(8, '0')}`,
      }));
      const request = {
        name: 'Too Many Tracks',
        tracks: validTracks,
      };
      const result = PlaylistExportRequestSchema.safeParse(request);

      expect(result.success).toBe(false);
    });

    it('should accept exactly 50 tracks', () => {
      const tracks = Array.from({ length: 50 }, (_, i) => ({
        isrc: `ISRC${i.toString().padStart(8, '0')}`,
        title: `Track ${i + 1}`,
        artist: `Artist ${i + 1}`,
      }));
      const request = {
        name: 'Max Tracks',
        tracks,
      };
      const result = PlaylistExportRequestSchema.safeParse(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tracks).toHaveLength(50);
      }
    });
  });

  describe('PlaylistExportResponseSchema', () => {
    it('should accept valid success response without skipped tracks', () => {
      const response = {
        success: true as const,
        playlistId: '550e8400-e29b-41d4-a716-446655440000',
        playlistName: 'Chill Vibes',
        tracksAdded: 10,
        tracksSkipped: 0,
      };
      const result = PlaylistExportResponseSchema.safeParse(response);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(true);
        expect(result.data.playlistId).toBe('550e8400-e29b-41d4-a716-446655440000');
        expect(result.data.tracksAdded).toBe(10);
        expect(result.data.tracksSkipped).toBe(0);
        expect(result.data.skippedTracks).toBeUndefined();
      }
    });

    it('should accept valid success response with skipped tracks', () => {
      const response = {
        success: true as const,
        playlistId: '550e8400-e29b-41d4-a716-446655440000',
        playlistName: 'Party Mix',
        tracksAdded: 8,
        tracksSkipped: 2,
        skippedTracks: [
          { isrc: 'USRC00000001', title: 'Unavailable Track 1', artist: 'Unknown Artist' },
          { isrc: 'USRC00000002', title: 'Unavailable Track 2', artist: 'Another Artist' },
        ],
      };
      const result = PlaylistExportResponseSchema.safeParse(response);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tracksSkipped).toBe(2);
        expect(result.data.skippedTracks).toHaveLength(2);
      }
    });

    it('should reject invalid UUID for playlistId', () => {
      const response = {
        success: true as const,
        playlistId: 'not-a-uuid',
        playlistName: 'My Playlist',
        tracksAdded: 10,
        tracksSkipped: 0,
      };
      const result = PlaylistExportResponseSchema.safeParse(response);

      expect(result.success).toBe(false);
    });

    it('should reject negative tracksAdded', () => {
      const response = {
        success: true as const,
        playlistId: '550e8400-e29b-41d4-a716-446655440000',
        playlistName: 'My Playlist',
        tracksAdded: -1,
        tracksSkipped: 0,
      };
      const result = PlaylistExportResponseSchema.safeParse(response);

      expect(result.success).toBe(false);
    });

    it('should reject negative tracksSkipped', () => {
      const response = {
        success: true as const,
        playlistId: '550e8400-e29b-41d4-a716-446655440000',
        playlistName: 'My Playlist',
        tracksAdded: 10,
        tracksSkipped: -1,
      };
      const result = PlaylistExportResponseSchema.safeParse(response);

      expect(result.success).toBe(false);
    });
  });

  describe('PlaylistExportErrorSchema', () => {
    it('should accept valid validation_error response', () => {
      const response = {
        error: {
          code: 'validation_error' as const,
          message: 'Invalid request body',
          retryable: false,
          details: [{ path: ['name'], message: 'String must be at least 1 character' }],
        },
      };
      const result = PlaylistExportErrorSchema.safeParse(response);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.error.code).toBe('validation_error');
        expect(result.data.error.retryable).toBe(false);
      }
    });

    it('should accept valid no_tidal_connection error', () => {
      const response = {
        error: {
          code: 'no_tidal_connection' as const,
          message: 'Tidal account not connected. Please connect your Tidal account to save playlists.',
          retryable: false,
        },
      };
      const result = PlaylistExportErrorSchema.safeParse(response);

      expect(result.success).toBe(true);
    });

    it('should accept valid rate_limit_exceeded error with retryAfter', () => {
      const response = {
        error: {
          code: 'rate_limit_exceeded' as const,
          message: 'Tidal API rate limit reached. Please try again in a few seconds.',
          retryable: true,
          retryAfter: 5,
        },
      };
      const result = PlaylistExportErrorSchema.safeParse(response);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.error.retryable).toBe(true);
        expect(result.data.error.retryAfter).toBe(5);
      }
    });

    it('should accept valid tidal_unavailable error', () => {
      const response = {
        error: {
          code: 'tidal_unavailable' as const,
          message: 'Tidal is temporarily unavailable. Please try again later.',
          retryable: true,
        },
      };
      const result = PlaylistExportErrorSchema.safeParse(response);

      expect(result.success).toBe(true);
    });

    it('should reject unknown error code', () => {
      const response = {
        error: {
          code: 'unknown_error',
          message: 'Something went wrong',
          retryable: false,
        },
      };
      const result = PlaylistExportErrorSchema.safeParse(response);

      expect(result.success).toBe(false);
    });

    it('should validate all defined error codes', () => {
      const errorCodes: Array<PlaylistExportErrorCode> = [
        'validation_error',
        'no_tidal_connection',
        'token_refresh_failed',
        'no_tracks_available',
        'playlist_creation_failed',
        'rate_limit_exceeded',
        'tidal_unavailable',
      ];

      for (const code of errorCodes) {
        const response = {
          error: {
            code,
            message: `Error: ${code}`,
            retryable: ['rate_limit_exceeded', 'tidal_unavailable', 'playlist_creation_failed'].includes(code),
          },
        };
        const result = PlaylistExportErrorSchema.safeParse(response);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Type exports', () => {
    it('should export PlaylistExportRequest type', () => {
      const request: PlaylistExportRequest = {
        name: 'Test Playlist',
        tracks: [{ isrc: 'USUM71900765', title: 'Track', artist: 'Artist' }],
      };
      expect(request.name).toBe('Test Playlist');
    });

    it('should export PlaylistExportResponse type', () => {
      const response: PlaylistExportResponse = {
        success: true,
        playlistId: '550e8400-e29b-41d4-a716-446655440000',
        playlistName: 'Test',
        tracksAdded: 1,
        tracksSkipped: 0,
      };
      expect(response.success).toBe(true);
    });

    it('should export TrackForExport type', () => {
      const track: TrackForExport = {
        isrc: 'USUM71900765',
        title: 'Test Track',
        artist: 'Test Artist',
      };
      expect(track.isrc).toBe('USUM71900765');
    });

    it('should export SkippedTrack type', () => {
      const skipped: SkippedTrack = {
        isrc: 'USUM71900765',
        title: 'Skipped Track',
        artist: 'Unknown',
      };
      expect(skipped.isrc).toBe('USUM71900765');
    });
  });
});
