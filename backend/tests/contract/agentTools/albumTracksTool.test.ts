/**
 * Album Tracks Tool Contract Tests
 *
 * Feature: 011-agent-tools
 *
 * Tests the album tracks tool implementation contract.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeAlbumTracks, type AlbumTracksContext } from '../../../src/services/agentTools/albumTracksTool.js';
import type { AlbumTracksInput } from '../../../src/schemas/agentTools.js';

describe('executeAlbumTracks', () => {
  // Mock implementations
  const mockTidalService = {
    getAlbumById: vi.fn(),
    getAlbumTrackListing: vi.fn(),
    batchFetchTrackIsrcs: vi.fn(),
  };

  const mockQdrantClient = {
    checkTracksExist: vi.fn(),
  };

  const mockLibraryTrackRepository = {
    createQueryBuilder: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([]),
    }),
  };

  const mockLibraryAlbumRepository = {
    createQueryBuilder: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([]),
    }),
  };

  const mockContext: AlbumTracksContext = {
    tidalService: mockTidalService as any,
    qdrantClient: mockQdrantClient as any,
    libraryTrackRepository: mockLibraryTrackRepository as any,
    libraryAlbumRepository: mockLibraryAlbumRepository as any,
    userId: 'test-user-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default successful album response
    mockTidalService.getAlbumById.mockResolvedValue({
      id: 'album-123',
      title: 'OK Computer',
      artist: { id: 'artist-1', name: 'Radiohead' },
      cover: 'https://example.com/ok-computer.jpg',
      releaseDate: '1997-06-16',
      numberOfTracks: 12,
    });

    // Default track listing response
    mockTidalService.getAlbumTrackListing.mockResolvedValue([
      { position: 1, title: 'Airbag', duration: 284, tidalId: 'track-1', explicit: false },
      { position: 2, title: 'Paranoid Android', duration: 384, tidalId: 'track-2', explicit: false },
      { position: 3, title: 'Subterranean Homesick Alien', duration: 268, tidalId: 'track-3', explicit: false },
    ]);

    // Default ISRC batch response
    mockTidalService.batchFetchTrackIsrcs.mockResolvedValue(
      new Map([
        ['track-1', 'GBAYE9700001'],
        ['track-2', 'GBAYE9700002'],
        ['track-3', 'GBAYE9700003'],
      ])
    );

    mockQdrantClient.checkTracksExist.mockResolvedValue(new Map());
  });

  describe('input validation', () => {
    it('rejects empty album ID', async () => {
      const input: AlbumTracksInput = {
        albumId: '',
      };

      await expect(executeAlbumTracks(input, mockContext)).rejects.toMatchObject({
        message: expect.stringContaining('Album ID cannot be empty'),
        retryable: false,
      });
    });

    it('accepts valid album ID', async () => {
      const input: AlbumTracksInput = {
        albumId: 'album-123',
      };

      const result = await executeAlbumTracks(input, mockContext);

      expect(result).toBeDefined();
      expect(result.albumId).toBe('album-123');
    });
  });

  describe('album fetch', () => {
    it('fetches album metadata and tracks', async () => {
      const input: AlbumTracksInput = {
        albumId: 'album-123',
      };

      const result = await executeAlbumTracks(input, mockContext);

      expect(mockTidalService.getAlbumById).toHaveBeenCalledWith('album-123');
      expect(mockTidalService.getAlbumTrackListing).toHaveBeenCalledWith('album-123');
      expect(result.albumTitle).toBe('OK Computer');
      expect(result.artist).toBe('Radiohead');
    });

    it('fetches ISRCs for all tracks', async () => {
      const input: AlbumTracksInput = {
        albumId: 'album-123',
      };

      await executeAlbumTracks(input, mockContext);

      expect(mockTidalService.batchFetchTrackIsrcs).toHaveBeenCalledWith(
        ['track-1', 'track-2', 'track-3']
      );
    });

    it('handles albums with no tracks', async () => {
      mockTidalService.getAlbumTrackListing.mockResolvedValue([]);
      mockTidalService.batchFetchTrackIsrcs.mockResolvedValue(new Map());

      const input: AlbumTracksInput = {
        albumId: 'empty-album',
      };

      const result = await executeAlbumTracks(input, mockContext);

      expect(result.tracks).toEqual([]);
      expect(result.summary).toBe('OK Computer has 0 tracks');
    });
  });

  describe('track transformation', () => {
    it('transforms tracks correctly with ISRCs', async () => {
      const input: AlbumTracksInput = {
        albumId: 'album-123',
      };

      const result = await executeAlbumTracks(input, mockContext);

      expect(result.tracks).toHaveLength(3);
      expect(result.tracks[0]).toMatchObject({
        tidalId: 'track-1',
        isrc: 'GBAYE9700001',
        title: 'Airbag',
        artist: 'Radiohead',
        album: 'OK Computer',
        artworkUrl: 'https://example.com/ok-computer.jpg',
        duration: 284,
        explicit: false,
        inLibrary: false,
        isIndexed: false,
      });
    });

    it('handles tracks without ISRC', async () => {
      mockTidalService.batchFetchTrackIsrcs.mockResolvedValue(
        new Map([
          ['track-1', 'GBAYE9700001'],
          // track-2 and track-3 have no ISRC
        ])
      );

      const input: AlbumTracksInput = {
        albumId: 'album-123',
      };

      const result = await executeAlbumTracks(input, mockContext);

      expect(result.tracks[0].isrc).toBe('GBAYE9700001');
      expect(result.tracks[1].isrc).toBe('');
      expect(result.tracks[2].isrc).toBe('');
    });
  });

  describe('library status enrichment', () => {
    it('sets inLibrary=true for tracks in library', async () => {
      // Mock tracks in album track listing in library
      mockLibraryAlbumRepository.createQueryBuilder.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([
          {
            trackListing: [
              { isrc: 'GBAYE9700001' },
              { isrc: 'GBAYE9700002' },
            ],
          },
        ]),
      });

      const input: AlbumTracksInput = {
        albumId: 'album-123',
      };

      const result = await executeAlbumTracks(input, mockContext);

      expect(result.tracks[0].inLibrary).toBe(true);
      expect(result.tracks[1].inLibrary).toBe(true);
      expect(result.tracks[2].inLibrary).toBe(false);
    });

    it('handles library check failures gracefully', async () => {
      mockLibraryAlbumRepository.createQueryBuilder.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      const input: AlbumTracksInput = {
        albumId: 'album-123',
      };

      // Should not throw
      const result = await executeAlbumTracks(input, mockContext);
      expect(result.tracks).toBeDefined();
      expect(result.tracks.every(t => !t.inLibrary)).toBe(true);
    });
  });

  describe('index status enrichment', () => {
    it('sets isIndexed=true for tracks in vector index', async () => {
      mockQdrantClient.checkTracksExist.mockResolvedValue(
        new Map([
          ['GBAYE9700001', true],
          ['GBAYE9700003', true],
        ])
      );

      const input: AlbumTracksInput = {
        albumId: 'album-123',
      };

      const result = await executeAlbumTracks(input, mockContext);

      expect(result.tracks[0].isIndexed).toBe(true);
      expect(result.tracks[1].isIndexed).toBe(false);
      expect(result.tracks[2].isIndexed).toBe(true);
    });

    it('handles Qdrant check failure gracefully', async () => {
      mockQdrantClient.checkTracksExist.mockRejectedValue(new Error('Qdrant unavailable'));

      const input: AlbumTracksInput = {
        albumId: 'album-123',
      };

      // Should not throw
      const result = await executeAlbumTracks(input, mockContext);
      expect(result.tracks).toBeDefined();
      expect(result.tracks.every(t => !t.isIndexed)).toBe(true);
    });
  });

  describe('summary generation', () => {
    it('generates correct summary for multiple tracks', async () => {
      const input: AlbumTracksInput = {
        albumId: 'album-123',
      };

      const result = await executeAlbumTracks(input, mockContext);

      expect(result.summary).toBe('OK Computer has 3 tracks');
    });

    it('generates correct summary for single track', async () => {
      mockTidalService.getAlbumTrackListing.mockResolvedValue([
        { position: 1, title: 'Single Track', duration: 200, tidalId: 'track-1', explicit: false },
      ]);
      mockTidalService.batchFetchTrackIsrcs.mockResolvedValue(
        new Map([['track-1', 'GBAYE9700001']])
      );

      const input: AlbumTracksInput = {
        albumId: 'album-123',
      };

      const result = await executeAlbumTracks(input, mockContext);

      expect(result.summary).toBe('OK Computer has 1 track');
    });
  });

  describe('output structure', () => {
    it('includes durationMs in output', async () => {
      const input: AlbumTracksInput = {
        albumId: 'album-123',
      };

      const result = await executeAlbumTracks(input, mockContext);

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('includes all required fields', async () => {
      const input: AlbumTracksInput = {
        albumId: 'album-123',
      };

      const result = await executeAlbumTracks(input, mockContext);

      expect(result).toMatchObject({
        albumId: 'album-123',
        albumTitle: 'OK Computer',
        artist: 'Radiohead',
        tracks: expect.any(Array),
        summary: expect.any(String),
        durationMs: expect.any(Number),
      });
    });
  });

  describe('error handling', () => {
    it('throws non-retryable error for album not found', async () => {
      mockTidalService.getAlbumById.mockRejectedValue(new Error('Album not found on Tidal'));

      const input: AlbumTracksInput = {
        albumId: 'nonexistent-album',
      };

      await expect(executeAlbumTracks(input, mockContext)).rejects.toMatchObject({
        message: expect.stringContaining('Album not found'),
        retryable: false,
        code: 'NOT_FOUND',
      });
    });

    it('throws retryable error on rate limit', async () => {
      mockTidalService.getAlbumById.mockRejectedValue(new Error('Rate limit exceeded'));

      const input: AlbumTracksInput = {
        albumId: 'album-123',
      };

      await expect(executeAlbumTracks(input, mockContext)).rejects.toMatchObject({
        message: expect.stringContaining('Rate limit'),
        retryable: true,
        code: 'RATE_LIMIT',
      });
    });

    it('throws retryable error on timeout', async () => {
      mockTidalService.getAlbumById.mockRejectedValue(new Error('Request timeout'));

      const input: AlbumTracksInput = {
        albumId: 'album-123',
      };

      await expect(executeAlbumTracks(input, mockContext)).rejects.toMatchObject({
        message: expect.stringContaining('timed out'),
        retryable: true,
        code: 'TIMEOUT',
      });
    });

    it('handles ISRC fetch failure gracefully', async () => {
      mockTidalService.batchFetchTrackIsrcs.mockRejectedValue(new Error('ISRC fetch failed'));

      const input: AlbumTracksInput = {
        albumId: 'album-123',
      };

      // Should not throw - just return tracks without ISRCs
      const result = await executeAlbumTracks(input, mockContext);
      expect(result.tracks).toBeDefined();
      expect(result.tracks.every(t => t.isrc === '')).toBe(true);
    });
  });
});
