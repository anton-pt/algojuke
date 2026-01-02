/**
 * Tidal Search Tool Contract Tests
 *
 * Feature: 011-agent-tools
 *
 * Tests the Tidal search tool implementation contract.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeTidalSearch, type TidalSearchContext } from '../../../src/services/agentTools/tidalSearchTool.js';
import type { TidalSearchInput } from '../../../src/schemas/agentTools.js';

describe('executeTidalSearch', () => {
  // Mock implementations
  const mockTidalService = {
    search: vi.fn(),
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

  const mockContext: TidalSearchContext = {
    tidalService: mockTidalService as any,
    qdrantClient: mockQdrantClient as any,
    libraryTrackRepository: mockLibraryTrackRepository as any,
    libraryAlbumRepository: mockLibraryAlbumRepository as any,
    userId: 'test-user-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default successful search response
    mockTidalService.search.mockResolvedValue({
      albums: [
        {
          id: 'album-1',
          title: 'OK Computer',
          artist: 'Radiohead',
          artists: ['Radiohead'],
          artworkUrl: 'https://example.com/ok-computer.jpg',
          artworkThumbUrl: 'https://example.com/ok-computer-thumb.jpg',
          explicit: false,
          trackCount: 12,
          duration: 3200,
          releaseDate: '1997-06-16',
          externalUrl: 'https://tidal.com/album/123',
          source: 'tidal',
        },
      ],
      tracks: [
        {
          id: 'track-1',
          title: 'Paranoid Android',
          artist: 'Radiohead',
          artists: ['Radiohead'],
          albumTitle: 'OK Computer',
          albumId: 'album-1',
          artworkUrl: 'https://example.com/ok-computer.jpg',
          artworkThumbUrl: 'https://example.com/ok-computer-thumb.jpg',
          explicit: false,
          duration: 384,
          externalUrl: 'https://tidal.com/track/456',
          source: 'tidal',
        },
      ],
      query: 'Radiohead',
      total: { albums: 1, tracks: 1 },
      cached: false,
      timestamp: Date.now(),
    });

    mockQdrantClient.checkTracksExist.mockResolvedValue(new Map());
  });

  describe('input validation', () => {
    it('rejects empty query', async () => {
      const input: TidalSearchInput = {
        query: '',
        searchType: 'both',
        limit: 20,
      };

      await expect(executeTidalSearch(input, mockContext)).rejects.toMatchObject({
        message: expect.stringContaining('Query cannot be empty'),
        retryable: false,
      });
    });

    it('rejects query exceeding 500 characters', async () => {
      const input: TidalSearchInput = {
        query: 'a'.repeat(501),
        searchType: 'both',
        limit: 20,
      };

      await expect(executeTidalSearch(input, mockContext)).rejects.toMatchObject({
        message: expect.stringContaining('too long'),
        retryable: false,
      });
    });

    it('rejects limit below 1', async () => {
      const input: TidalSearchInput = {
        query: 'Radiohead',
        searchType: 'both',
        limit: 0,
      };

      await expect(executeTidalSearch(input, mockContext)).rejects.toMatchObject({
        retryable: false,
      });
    });

    it('rejects limit above 100', async () => {
      const input: TidalSearchInput = {
        query: 'Radiohead',
        searchType: 'both',
        limit: 101,
      };

      await expect(executeTidalSearch(input, mockContext)).rejects.toMatchObject({
        retryable: false,
      });
    });

    it('accepts valid input', async () => {
      const input: TidalSearchInput = {
        query: 'Radiohead',
        searchType: 'both',
        limit: 20,
      };

      const result = await executeTidalSearch(input, mockContext);

      expect(result).toBeDefined();
      expect(result.query).toBe('Radiohead');
    });
  });

  describe('search execution', () => {
    it('returns tracks and albums for searchType "both"', async () => {
      const input: TidalSearchInput = {
        query: 'Radiohead',
        searchType: 'both',
        limit: 20,
      };

      const result = await executeTidalSearch(input, mockContext);

      expect(result.tracks).toBeDefined();
      expect(result.albums).toBeDefined();
      expect(result.tracks!.length).toBe(1);
      expect(result.albums!.length).toBe(1);
    });

    it('returns only tracks for searchType "tracks"', async () => {
      const input: TidalSearchInput = {
        query: 'Radiohead',
        searchType: 'tracks',
        limit: 20,
      };

      const result = await executeTidalSearch(input, mockContext);

      expect(result.tracks).toBeDefined();
      expect(result.albums).toBeUndefined();
      expect(result.tracks!.length).toBe(1);
    });

    it('returns only albums for searchType "albums"', async () => {
      const input: TidalSearchInput = {
        query: 'Radiohead',
        searchType: 'albums',
        limit: 20,
      };

      const result = await executeTidalSearch(input, mockContext);

      expect(result.tracks).toBeUndefined();
      expect(result.albums).toBeDefined();
      expect(result.albums!.length).toBe(1);
    });

    it('calls tidalService.search with correct parameters', async () => {
      const input: TidalSearchInput = {
        query: 'Björk Homogenic',
        searchType: 'albums',
        limit: 10,
      };

      await executeTidalSearch(input, mockContext);

      expect(mockTidalService.search).toHaveBeenCalledWith(
        'Björk Homogenic',
        10,
        0,
        'US'
      );
    });
  });

  describe('result transformation', () => {
    it('transforms track results correctly', async () => {
      const input: TidalSearchInput = {
        query: 'Radiohead',
        searchType: 'tracks',
        limit: 20,
      };

      const result = await executeTidalSearch(input, mockContext);

      expect(result.tracks![0]).toMatchObject({
        tidalId: 'track-1',
        title: 'Paranoid Android',
        artist: 'Radiohead',
        album: 'OK Computer',
        artworkUrl: 'https://example.com/ok-computer.jpg',
        duration: 384,
        explicit: false,
        inLibrary: false,
        isIndexed: false,
      });
    });

    it('transforms album results correctly', async () => {
      const input: TidalSearchInput = {
        query: 'Radiohead',
        searchType: 'albums',
        limit: 20,
      };

      const result = await executeTidalSearch(input, mockContext);

      expect(result.albums![0]).toMatchObject({
        tidalId: 'album-1',
        title: 'OK Computer',
        artist: 'Radiohead',
        artworkUrl: 'https://example.com/ok-computer.jpg',
        releaseDate: '1997-06-16',
        trackCount: 12,
        inLibrary: false,
      });
    });
  });

  describe('library status enrichment', () => {
    it('sets inLibrary=true for albums in library', async () => {
      // Mock album in library
      mockLibraryAlbumRepository.createQueryBuilder.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([{ tidalAlbumId: 'album-1' }]),
      });

      const input: TidalSearchInput = {
        query: 'Radiohead',
        searchType: 'albums',
        limit: 20,
      };

      const result = await executeTidalSearch(input, mockContext);

      expect(result.albums![0].inLibrary).toBe(true);
    });

    it('handles library check failures gracefully', async () => {
      // Mock library check failure
      mockLibraryAlbumRepository.createQueryBuilder.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      const input: TidalSearchInput = {
        query: 'Radiohead',
        searchType: 'albums',
        limit: 20,
      };

      // Should not throw, but all albums should have inLibrary=false
      const result = await executeTidalSearch(input, mockContext);

      expect(result.albums).toBeDefined();
      expect(result.albums![0].inLibrary).toBe(false);
    });
  });

  describe('summary generation', () => {
    it('generates correct summary for both tracks and albums', async () => {
      const input: TidalSearchInput = {
        query: 'Radiohead',
        searchType: 'both',
        limit: 20,
      };

      const result = await executeTidalSearch(input, mockContext);

      expect(result.summary).toBe('Found 1 track and 1 album for "Radiohead"');
    });

    it('generates correct summary for tracks only', async () => {
      const input: TidalSearchInput = {
        query: 'Radiohead',
        searchType: 'tracks',
        limit: 20,
      };

      const result = await executeTidalSearch(input, mockContext);

      expect(result.summary).toBe('Found 1 track for "Radiohead"');
    });

    it('generates correct summary for albums only', async () => {
      const input: TidalSearchInput = {
        query: 'Radiohead',
        searchType: 'albums',
        limit: 20,
      };

      const result = await executeTidalSearch(input, mockContext);

      expect(result.summary).toBe('Found 1 album for "Radiohead"');
    });

    it('generates correct summary for plural results', async () => {
      mockTidalService.search.mockResolvedValue({
        albums: [
          { id: 'a1', title: 'A1', artist: 'X', artists: [], artworkUrl: '', artworkThumbUrl: '', explicit: false, trackCount: 10, duration: 0, releaseDate: '', externalUrl: '', source: 'tidal' },
          { id: 'a2', title: 'A2', artist: 'X', artists: [], artworkUrl: '', artworkThumbUrl: '', explicit: false, trackCount: 10, duration: 0, releaseDate: '', externalUrl: '', source: 'tidal' },
        ],
        tracks: [
          { id: 't1', title: 'T1', artist: 'X', artists: [], albumTitle: '', albumId: '', artworkUrl: '', artworkThumbUrl: '', explicit: false, duration: 0, externalUrl: '', source: 'tidal' },
          { id: 't2', title: 'T2', artist: 'X', artists: [], albumTitle: '', albumId: '', artworkUrl: '', artworkThumbUrl: '', explicit: false, duration: 0, externalUrl: '', source: 'tidal' },
          { id: 't3', title: 'T3', artist: 'X', artists: [], albumTitle: '', albumId: '', artworkUrl: '', artworkThumbUrl: '', explicit: false, duration: 0, externalUrl: '', source: 'tidal' },
        ],
        query: 'Test',
        total: { albums: 2, tracks: 3 },
        cached: false,
        timestamp: Date.now(),
      });

      const input: TidalSearchInput = {
        query: 'Test',
        searchType: 'both',
        limit: 20,
      };

      const result = await executeTidalSearch(input, mockContext);

      expect(result.summary).toBe('Found 3 tracks and 2 albums for "Test"');
    });

    it('generates correct summary for no results', async () => {
      mockTidalService.search.mockResolvedValue({
        albums: [],
        tracks: [],
        query: 'NoResults',
        total: { albums: 0, tracks: 0 },
        cached: false,
        timestamp: Date.now(),
      });

      const input: TidalSearchInput = {
        query: 'NoResults',
        searchType: 'both',
        limit: 20,
      };

      const result = await executeTidalSearch(input, mockContext);

      expect(result.summary).toBe('No results found for "NoResults"');
    });
  });

  describe('output structure', () => {
    it('includes durationMs in output', async () => {
      const input: TidalSearchInput = {
        query: 'Radiohead',
        searchType: 'both',
        limit: 20,
      };

      const result = await executeTidalSearch(input, mockContext);

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('includes totalFound counts', async () => {
      const input: TidalSearchInput = {
        query: 'Radiohead',
        searchType: 'both',
        limit: 20,
      };

      const result = await executeTidalSearch(input, mockContext);

      expect(result.totalFound).toEqual({
        tracks: 1,
        albums: 1,
      });
    });

    it('returns zero tracks count when searchType is albums', async () => {
      const input: TidalSearchInput = {
        query: 'Radiohead',
        searchType: 'albums',
        limit: 20,
      };

      const result = await executeTidalSearch(input, mockContext);

      expect(result.totalFound.tracks).toBe(0);
      expect(result.totalFound.albums).toBe(1);
    });
  });

  describe('error handling', () => {
    it('throws retryable error on rate limit', async () => {
      mockTidalService.search.mockRejectedValue(new Error('Rate limit exceeded'));

      const input: TidalSearchInput = {
        query: 'Radiohead',
        searchType: 'both',
        limit: 20,
      };

      await expect(executeTidalSearch(input, mockContext)).rejects.toMatchObject({
        message: expect.stringContaining('Rate limit'),
        retryable: true,
        code: 'RATE_LIMIT',
      });
    });

    it('throws retryable error on timeout', async () => {
      mockTidalService.search.mockRejectedValue(new Error('Request timeout'));

      const input: TidalSearchInput = {
        query: 'Radiohead',
        searchType: 'both',
        limit: 20,
      };

      await expect(executeTidalSearch(input, mockContext)).rejects.toMatchObject({
        message: expect.stringContaining('timed out'),
        retryable: true,
        code: 'TIMEOUT',
      });
    });

    it('throws retryable error on service unavailable', async () => {
      mockTidalService.search.mockRejectedValue(new Error('Service unavailable'));

      const input: TidalSearchInput = {
        query: 'Radiohead',
        searchType: 'both',
        limit: 20,
      };

      await expect(executeTidalSearch(input, mockContext)).rejects.toMatchObject({
        retryable: true,
      });
    });

    it('handles Qdrant check failure gracefully', async () => {
      mockQdrantClient.checkTracksExist.mockRejectedValue(new Error('Qdrant unavailable'));

      const input: TidalSearchInput = {
        query: 'Radiohead',
        searchType: 'both',
        limit: 20,
      };

      // Should not throw - just return tracks with isIndexed=false
      const result = await executeTidalSearch(input, mockContext);
      expect(result.tracks).toBeDefined();
    });
  });
});
