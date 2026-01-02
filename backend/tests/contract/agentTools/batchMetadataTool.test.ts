/**
 * Batch Metadata Tool Contract Tests
 *
 * Feature: 011-agent-tools
 *
 * Tests the batch metadata tool implementation contract.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeBatchMetadata, type BatchMetadataContext } from '../../../src/services/agentTools/batchMetadataTool.js';
import type { BatchMetadataInput } from '../../../src/schemas/agentTools.js';

describe('executeBatchMetadata', () => {
  // Mock implementations
  const mockQdrantClient = {
    getTrackPayload: vi.fn(),
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
      getMany: vi.fn().mockResolvedValue([]),
    }),
  };

  const mockContext: BatchMetadataContext = {
    qdrantClient: mockQdrantClient as any,
    libraryTrackRepository: mockLibraryTrackRepository as any,
    libraryAlbumRepository: mockLibraryAlbumRepository as any,
    userId: 'test-user-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default successful payload response
    mockQdrantClient.getTrackPayload.mockImplementation((isrc: string) => {
      if (isrc === 'USRC17607839') {
        return Promise.resolve({
          isrc: 'USRC17607839',
          title: 'Paranoid Android',
          artist: 'Radiohead',
          album: 'OK Computer',
          lyrics: 'Please could you stop the noise...',
          interpretation: 'A song about alienation and technology.',
          acousticness: 0.02,
          danceability: 0.35,
          energy: 0.65,
          instrumentalness: 0.0,
          key: 7,
          liveness: 0.1,
          loudness: -8.5,
          mode: 0,
          speechiness: 0.05,
          tempo: 128.5,
          valence: 0.25,
        });
      }
      return Promise.resolve(null);
    });
  });

  describe('input validation', () => {
    it('handles empty ISRC array without error', async () => {
      const input: BatchMetadataInput = {
        isrcs: [],
      };

      const result = await executeBatchMetadata(input, mockContext);

      expect(result.tracks).toEqual([]);
      expect(result.found).toEqual([]);
      expect(result.notFound).toEqual([]);
      expect(result.summary).toBe('No ISRCs provided');
    });

    it('rejects more than 100 ISRCs', async () => {
      const input: BatchMetadataInput = {
        isrcs: Array(101).fill('USRC17607839'),
      };

      await expect(executeBatchMetadata(input, mockContext)).rejects.toMatchObject({
        retryable: false,
      });
    });

    it('accepts up to 100 ISRCs', async () => {
      const input: BatchMetadataInput = {
        isrcs: Array(100).fill('USRC17607839'),
      };

      const result = await executeBatchMetadata(input, mockContext);

      expect(result).toBeDefined();
    });

    it('normalizes ISRCs to uppercase', async () => {
      const input: BatchMetadataInput = {
        isrcs: ['usrc17607839'],
      };

      await executeBatchMetadata(input, mockContext);

      expect(mockQdrantClient.getTrackPayload).toHaveBeenCalledWith('USRC17607839');
    });

    it('reports specific malformed ISRCs in error message', async () => {
      const input: BatchMetadataInput = {
        isrcs: ['INVALID', 'USRC17607839', 'TOO-SHORT'],
      };

      await expect(executeBatchMetadata(input, mockContext)).rejects.toMatchObject({
        message: expect.stringContaining('"INVALID"'),
        retryable: false,
        code: 'VALIDATION_ERROR',
      });
    });

    it('limits number of malformed ISRCs shown in error', async () => {
      const input: BatchMetadataInput = {
        isrcs: ['X', 'XX', 'XXX', 'XXXX', 'XXXXX', 'XXXXXX', 'XXXXXXX'],
      };

      const error = await executeBatchMetadata(input, mockContext).catch((e) => e);

      // Should show max 5 examples and indicate there are more
      expect(error.message).toContain('and 2 more');
      expect(error.message).toContain('"X"');
      expect(error.message).not.toContain('"XXXXXXX"'); // Should be in "and X more"
    });

    it('provides helpful error message for malformed ISRCs', async () => {
      const input: BatchMetadataInput = {
        isrcs: ['INVALID-ISRC'],
      };

      const error = await executeBatchMetadata(input, mockContext).catch((e) => e);

      expect(error.message).toContain('12 alphanumeric characters');
      expect(error.message).toContain('"INVALID-ISRC"');
    });

    it('provides helpful error message when exceeding 100 ISRCs', async () => {
      const input: BatchMetadataInput = {
        isrcs: Array(150).fill('USRC17607839'),
      };

      const error = await executeBatchMetadata(input, mockContext).catch((e) => e);

      expect(error.message).toContain('Maximum 100 ISRCs');
      expect(error.message).toContain('received 150');
    });
  });

  describe('metadata retrieval', () => {
    it('retrieves metadata for found ISRCs', async () => {
      const input: BatchMetadataInput = {
        isrcs: ['USRC17607839'],
      };

      const result = await executeBatchMetadata(input, mockContext);

      expect(result.found).toContain('USRC17607839');
      expect(result.tracks).toHaveLength(1);
      expect(result.tracks[0]).toMatchObject({
        isrc: 'USRC17607839',
        title: 'Paranoid Android',
        artist: 'Radiohead',
        album: 'OK Computer',
        isIndexed: true,
        score: 1.0,
      });
    });

    it('tracks not found ISRCs', async () => {
      const input: BatchMetadataInput = {
        isrcs: ['GBDCA1234567'], // Valid format but not in index
      };

      const result = await executeBatchMetadata(input, mockContext);

      expect(result.found).toHaveLength(0);
      expect(result.notFound).toContain('GBDCA1234567');
      expect(result.tracks).toHaveLength(0);
    });

    it('handles mixed found and not found ISRCs', async () => {
      const input: BatchMetadataInput = {
        isrcs: ['USRC17607839', 'GBDCA1234567'],
      };

      const result = await executeBatchMetadata(input, mockContext);

      expect(result.found).toContain('USRC17607839');
      expect(result.notFound).toContain('GBDCA1234567');
      expect(result.tracks).toHaveLength(1);
    });
  });

  describe('audio features', () => {
    it('includes audio features when available', async () => {
      const input: BatchMetadataInput = {
        isrcs: ['USRC17607839'],
      };

      const result = await executeBatchMetadata(input, mockContext);

      expect(result.tracks[0].audioFeatures).toMatchObject({
        acousticness: 0.02,
        danceability: 0.35,
        energy: 0.65,
        tempo: 128.5,
        valence: 0.25,
      });
    });

    it('omits audio features when all are null', async () => {
      mockQdrantClient.getTrackPayload.mockResolvedValue({
        isrc: 'USRC17607839',
        title: 'Test Track',
        artist: 'Test Artist',
        album: 'Test Album',
        lyrics: null,
        interpretation: null,
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

      const input: BatchMetadataInput = {
        isrcs: ['USRC17607839'],
      };

      const result = await executeBatchMetadata(input, mockContext);

      expect(result.tracks[0].audioFeatures).toBeUndefined();
    });
  });

  describe('lyrics and interpretation', () => {
    it('includes lyrics and interpretation when available', async () => {
      const input: BatchMetadataInput = {
        isrcs: ['USRC17607839'],
      };

      const result = await executeBatchMetadata(input, mockContext);

      expect(result.tracks[0].lyrics).toBe('Please could you stop the noise...');
      expect(result.tracks[0].interpretation).toBe('A song about alienation and technology.');
    });

    it('omits lyrics and interpretation when null', async () => {
      mockQdrantClient.getTrackPayload.mockResolvedValue({
        isrc: 'USRC17607839',
        title: 'Test Track',
        artist: 'Test Artist',
        album: 'Test Album',
        lyrics: null,
        interpretation: null,
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

      const input: BatchMetadataInput = {
        isrcs: ['USRC17607839'],
      };

      const result = await executeBatchMetadata(input, mockContext);

      expect(result.tracks[0].lyrics).toBeUndefined();
      expect(result.tracks[0].interpretation).toBeUndefined();
    });
  });

  describe('library status', () => {
    it('sets inLibrary=true for tracks in library', async () => {
      // Mock track in library
      mockLibraryTrackRepository.createQueryBuilder.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([{ metadata: { isrc: 'USRC17607839' } }]),
      });

      const input: BatchMetadataInput = {
        isrcs: ['USRC17607839'],
      };

      const result = await executeBatchMetadata(input, mockContext);

      expect(result.tracks[0].inLibrary).toBe(true);
    });

    it('sets inLibrary=false for tracks not in library', async () => {
      // Reset mocks to ensure empty library
      mockLibraryTrackRepository.createQueryBuilder.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
      });
      mockLibraryAlbumRepository.createQueryBuilder.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
      });

      const input: BatchMetadataInput = {
        isrcs: ['USRC17607839'],
      };

      const result = await executeBatchMetadata(input, mockContext);

      expect(result.tracks[0].inLibrary).toBe(false);
    });

    it('handles library check failures gracefully', async () => {
      mockLibraryTrackRepository.createQueryBuilder.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      const input: BatchMetadataInput = {
        isrcs: ['USRC17607839'],
      };

      // Should not throw, but all tracks should have inLibrary=false
      const result = await executeBatchMetadata(input, mockContext);

      expect(result.tracks).toBeDefined();
      expect(result.tracks[0].inLibrary).toBe(false);
    });
  });

  describe('summary generation', () => {
    it('generates correct summary for all found', async () => {
      const input: BatchMetadataInput = {
        isrcs: ['USRC17607839'],
      };

      const result = await executeBatchMetadata(input, mockContext);

      expect(result.summary).toBe('Found metadata for all 1 track');
    });

    it('generates correct summary for none found', async () => {
      const input: BatchMetadataInput = {
        isrcs: ['GBDCA1234567'],
      };

      const result = await executeBatchMetadata(input, mockContext);

      expect(result.summary).toBe('No tracks found for 1 ISRC');
    });

    it('generates correct summary for partial found', async () => {
      const input: BatchMetadataInput = {
        isrcs: ['USRC17607839', 'GBDCA1234567'],
      };

      const result = await executeBatchMetadata(input, mockContext);

      expect(result.summary).toBe('Found 1 of 2 tracks (1 not indexed)');
    });

    it('uses plural for multiple tracks', async () => {
      mockQdrantClient.getTrackPayload.mockImplementation((isrc: string) => {
        if (isrc.startsWith('FOUND')) {
          return Promise.resolve({
            isrc,
            title: 'Test',
            artist: 'Test',
            album: 'Test',
            lyrics: null,
            interpretation: null,
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
        }
        return Promise.resolve(null);
      });

      const input: BatchMetadataInput = {
        isrcs: ['FOUND1234567', 'FOUND2345678'],
      };

      const result = await executeBatchMetadata(input, mockContext);

      expect(result.summary).toBe('Found metadata for all 2 tracks');
    });
  });

  describe('output structure', () => {
    it('includes durationMs in output', async () => {
      const input: BatchMetadataInput = {
        isrcs: ['USRC17607839'],
      };

      const result = await executeBatchMetadata(input, mockContext);

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('sets isIndexed=true for all found tracks', async () => {
      const input: BatchMetadataInput = {
        isrcs: ['USRC17607839'],
      };

      const result = await executeBatchMetadata(input, mockContext);

      expect(result.tracks[0].isIndexed).toBe(true);
    });

    it('sets score=1.0 for direct lookups', async () => {
      const input: BatchMetadataInput = {
        isrcs: ['USRC17607839'],
      };

      const result = await executeBatchMetadata(input, mockContext);

      expect(result.tracks[0].score).toBe(1.0);
    });
  });

  describe('error handling', () => {
    it('throws retryable error on service failure', async () => {
      mockQdrantClient.getTrackPayload.mockRejectedValue(new Error('Service unavailable'));

      const input: BatchMetadataInput = {
        isrcs: ['USRC17607839'],
      };

      await expect(executeBatchMetadata(input, mockContext)).rejects.toMatchObject({
        message: expect.stringContaining('temporarily unavailable'),
        retryable: true,
        code: 'INTERNAL_ERROR',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Feature 013-agent-tool-optimization: Short Description Support
  // ---------------------------------------------------------------------------

  describe('short description (feature 013)', () => {
    it('T011: preserves interpretation and lyrics in output', async () => {
      // Verifies that batch metadata still returns full interpretation/lyrics
      // This is critical for the two-tier metadata approach
      const input: BatchMetadataInput = {
        isrcs: ['USRC17607839'],
      };

      const result = await executeBatchMetadata(input, mockContext);

      // Full interpretation and lyrics MUST be present
      expect(result.tracks[0].interpretation).toBe('A song about alienation and technology.');
      expect(result.tracks[0].lyrics).toBe('Please could you stop the noise...');
    });

    it('T012: includes shortDescription when available', async () => {
      // Mock response with short_description
      mockQdrantClient.getTrackPayload.mockResolvedValue({
        isrc: 'USRC17607839',
        title: 'Paranoid Android',
        artist: 'Radiohead',
        album: 'OK Computer',
        lyrics: 'Please could you stop the noise...',
        interpretation: 'A song about alienation and technology.',
        short_description: 'Epic 6-minute alt-rock masterpiece about alienation and dystopia.',
        acousticness: 0.02,
        danceability: 0.35,
        energy: 0.65,
        instrumentalness: 0.0,
        key: 7,
        liveness: 0.1,
        loudness: -8.5,
        mode: 0,
        speechiness: 0.05,
        tempo: 128.5,
        valence: 0.25,
      });

      const input: BatchMetadataInput = {
        isrcs: ['USRC17607839'],
      };

      const result = await executeBatchMetadata(input, mockContext);

      // Short description should be included when available
      expect(result.tracks[0].shortDescription).toBe('Epic 6-minute alt-rock masterpiece about alienation and dystopia.');
    });

    it('T012: shortDescription is undefined when not in payload', async () => {
      // Original payload without short_description (pre-feature-012 track)
      const input: BatchMetadataInput = {
        isrcs: ['USRC17607839'],
      };

      const result = await executeBatchMetadata(input, mockContext);

      // Short description should be undefined (not null) when not available
      expect(result.tracks[0].shortDescription).toBeUndefined();
    });

    it('returns full data for on-demand metadata retrieval', async () => {
      // This validates the two-tier approach:
      // - semanticSearch returns shortDescription only
      // - batchMetadata returns full interpretation + lyrics + shortDescription
      mockQdrantClient.getTrackPayload.mockResolvedValue({
        isrc: 'USRC17607839',
        title: 'Paranoid Android',
        artist: 'Radiohead',
        album: 'OK Computer',
        lyrics: 'Please could you stop the noise...',
        interpretation: 'A song about alienation and technology.',
        short_description: 'Epic alt-rock masterpiece.',
        acousticness: 0.02,
        danceability: 0.35,
        energy: 0.65,
        instrumentalness: 0.0,
        key: 7,
        liveness: 0.1,
        loudness: -8.5,
        mode: 0,
        speechiness: 0.05,
        tempo: 128.5,
        valence: 0.25,
      });

      const input: BatchMetadataInput = {
        isrcs: ['USRC17607839'],
      };

      const result = await executeBatchMetadata(input, mockContext);
      const track = result.tracks[0];

      // All three text fields should be present for on-demand retrieval
      expect(track.interpretation).toBeDefined();
      expect(track.lyrics).toBeDefined();
      expect(track.shortDescription).toBeDefined();

      // Full content should be available (not truncated)
      expect(track.interpretation).toBe('A song about alienation and technology.');
      expect(track.lyrics).toBe('Please could you stop the noise...');
    });
  });
});
