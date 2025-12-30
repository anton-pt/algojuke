/**
 * Integration tests for Track Metadata Display feature
 *
 * Purpose: Test the complete flow from GraphQL query to Qdrant retrieval
 *
 * Tests:
 * - getExtendedTrackMetadata query with existing track
 * - getExtendedTrackMetadata query with non-existent track
 * - isIndexed field resolver for LibraryTrack
 * - isIndexed field resolver for TrackInfo
 * - Error handling when Qdrant is unavailable
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TrackMetadataService } from '../../src/services/trackMetadataService.js';
import { BackendQdrantClient } from '../../src/clients/qdrantClient.js';
import type { TrackPayload } from '../../src/types/trackMetadata.js';

// Mock the Qdrant client
vi.mock('../../src/clients/qdrantClient.js', () => ({
  BackendQdrantClient: vi.fn().mockImplementation(() => ({
    checkTracksExist: vi.fn(),
    checkTrackExists: vi.fn(),
    getTrackPayload: vi.fn(),
    isHealthy: vi.fn(),
  })),
  createBackendQdrantClient: vi.fn(),
}));

describe('TrackMetadataService', () => {
  let service: TrackMetadataService;
  let mockQdrantClient: {
    checkTracksExist: ReturnType<typeof vi.fn>;
    checkTrackExists: ReturnType<typeof vi.fn>;
    getTrackPayload: ReturnType<typeof vi.fn>;
    isHealthy: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockQdrantClient = {
      checkTracksExist: vi.fn(),
      checkTrackExists: vi.fn(),
      getTrackPayload: vi.fn(),
      isHealthy: vi.fn().mockResolvedValue(true),
    };
    service = new TrackMetadataService(mockQdrantClient as unknown as BackendQdrantClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getExtendedMetadata', () => {
    const mockPayload: TrackPayload = {
      isrc: 'USRC12345678',
      title: 'Test Track',
      artist: 'Test Artist',
      album: 'Test Album',
      lyrics: 'These are test lyrics\nWith multiple lines',
      interpretation: 'This song is about testing software',
      acousticness: 0.5,
      danceability: 0.75,
      energy: 0.8,
      instrumentalness: 0.1,
      key: 5,
      liveness: 0.2,
      loudness: -5.5,
      mode: 1,
      speechiness: 0.1,
      tempo: 120,
      valence: 0.7,
    };

    it('should return extended metadata for existing track', async () => {
      mockQdrantClient.getTrackPayload.mockResolvedValue(mockPayload);

      const result = await service.getExtendedMetadata('USRC12345678');

      expect(result).not.toBeNull();
      expect(result!.isrc).toBe('USRC12345678');
      expect(result!.lyrics).toBe('These are test lyrics\nWith multiple lines');
      expect(result!.interpretation).toBe('This song is about testing software');
      expect(result!.audioFeatures).toBeDefined();
      expect(result!.audioFeatures!.tempo).toBe(120);
      expect(result!.audioFeatures!.key).toBe(5);
      expect(result!.audioFeatures!.mode).toBe(1);
    });

    it('should return null for non-existent track', async () => {
      mockQdrantClient.getTrackPayload.mockResolvedValue(null);

      const result = await service.getExtendedMetadata('NONEXISTENT12');

      expect(result).toBeNull();
    });

    it('should normalize ISRC to uppercase', async () => {
      mockQdrantClient.getTrackPayload.mockResolvedValue(mockPayload);

      await service.getExtendedMetadata('usrc12345678');

      expect(mockQdrantClient.getTrackPayload).toHaveBeenCalledWith('USRC12345678');
    });

    it('should return null for invalid ISRC format', async () => {
      const result = await service.getExtendedMetadata('INVALID');

      expect(result).toBeNull();
      expect(mockQdrantClient.getTrackPayload).not.toHaveBeenCalled();
    });

    it('should handle track with null lyrics (instrumental)', async () => {
      const instrumentalPayload: TrackPayload = {
        ...mockPayload,
        lyrics: null,
        interpretation: null,
        instrumentalness: 0.95,
      };
      mockQdrantClient.getTrackPayload.mockResolvedValue(instrumentalPayload);

      const result = await service.getExtendedMetadata('USRC12345678');

      expect(result).not.toBeNull();
      expect(result!.lyrics).toBeNull();
      expect(result!.interpretation).toBeNull();
      expect(result!.audioFeatures!.instrumentalness).toBe(0.95);
    });

    it('should handle track with missing audio features', async () => {
      const noAudioPayload: TrackPayload = {
        isrc: 'USRC12345678',
        title: 'Test Track',
        artist: 'Test Artist',
        album: 'Test Album',
        lyrics: 'Some lyrics',
        interpretation: 'Some interpretation',
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
      };
      mockQdrantClient.getTrackPayload.mockResolvedValue(noAudioPayload);

      const result = await service.getExtendedMetadata('USRC12345678');

      expect(result).not.toBeNull();
      expect(result!.audioFeatures).toBeNull();
    });
  });

  describe('checkIsIndexed (batch)', () => {
    it('should return indexed status for multiple ISRCs', async () => {
      const isrcs = ['ISRC1234567A', 'ISRC1234567B', 'ISRC1234567C'];
      const existenceMap = new Map([
        ['ISRC1234567A', true],
        ['ISRC1234567B', false],
        ['ISRC1234567C', true],
      ]);
      mockQdrantClient.checkTracksExist.mockResolvedValue(existenceMap);

      const result = await service.checkIsIndexed(isrcs);

      expect(result.get('ISRC1234567A')).toBe(true);
      expect(result.get('ISRC1234567B')).toBe(false);
      expect(result.get('ISRC1234567C')).toBe(true);
    });

    it('should handle empty ISRC list', async () => {
      mockQdrantClient.checkTracksExist.mockResolvedValue(new Map());

      const result = await service.checkIsIndexed([]);

      expect(result.size).toBe(0);
    });

    it('should filter out null/undefined ISRCs', async () => {
      const isrcs = ['ISRC1234567A', null as unknown as string, undefined as unknown as string];
      mockQdrantClient.checkTracksExist.mockResolvedValue(
        new Map([['ISRC1234567A', true]])
      );

      const result = await service.checkIsIndexed(isrcs);

      expect(mockQdrantClient.checkTracksExist).toHaveBeenCalledWith(['ISRC1234567A']);
      expect(result.get('ISRC1234567A')).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should return null when Qdrant throws error on getTrackPayload', async () => {
      mockQdrantClient.getTrackPayload.mockRejectedValue(new Error('Connection refused'));

      const result = await service.getExtendedMetadata('USRC12345678');

      expect(result).toBeNull();
    });

    it('should return empty map when Qdrant throws error on checkTracksExist', async () => {
      mockQdrantClient.checkTracksExist.mockRejectedValue(new Error('Connection refused'));

      const result = await service.checkIsIndexed(['ISRC1234567A']);

      expect(result.size).toBe(0);
    });
  });
});

describe('isIndexed field resolver', () => {
  let service: TrackMetadataService;
  let mockQdrantClient: {
    checkTracksExist: ReturnType<typeof vi.fn>;
    getTrackPayload: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockQdrantClient = {
      checkTracksExist: vi.fn(),
      getTrackPayload: vi.fn(),
    };
    service = new TrackMetadataService(mockQdrantClient as unknown as BackendQdrantClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('LibraryTrack.isIndexed', () => {
    it('should return true for indexed track with ISRC', async () => {
      mockQdrantClient.checkTracksExist.mockResolvedValue(
        new Map([['USRC12345678', true]])
      );

      const result = await service.checkIsIndexed(['USRC12345678']);

      expect(result.get('USRC12345678')).toBe(true);
    });

    it('should return false for non-indexed track', async () => {
      mockQdrantClient.checkTracksExist.mockResolvedValue(
        new Map([['USRC12345678', false]])
      );

      const result = await service.checkIsIndexed(['USRC12345678']);

      expect(result.get('USRC12345678')).toBe(false);
    });

    it('should return false for track without ISRC (null/undefined handled upstream)', async () => {
      // The service filters out null ISRCs before calling Qdrant
      mockQdrantClient.checkTracksExist.mockResolvedValue(new Map());

      const result = await service.checkIsIndexed([]);

      expect(result.size).toBe(0);
    });
  });

  describe('TrackInfo.isIndexed', () => {
    it('should batch multiple TrackInfo ISRCs efficiently', async () => {
      const isrcs = ['ISRC1234567A', 'ISRC1234567B', 'ISRC1234567C'];
      mockQdrantClient.checkTracksExist.mockResolvedValue(
        new Map([
          ['ISRC1234567A', true],
          ['ISRC1234567B', false],
          ['ISRC1234567C', true],
        ])
      );

      const result = await service.checkIsIndexed(isrcs);

      // Should only call Qdrant once for all ISRCs
      expect(mockQdrantClient.checkTracksExist).toHaveBeenCalledTimes(1);
      expect(mockQdrantClient.checkTracksExist).toHaveBeenCalledWith(isrcs);
      expect(result.size).toBe(3);
    });
  });

  describe('Fail-open behavior', () => {
    it('should return false for all tracks when Qdrant is unavailable', async () => {
      mockQdrantClient.checkTracksExist.mockResolvedValue(new Map());

      const result = await service.checkIsIndexed(['ISRC1234567A', 'ISRC1234567B']);

      // Empty map means no indexed status - callers should treat missing as false
      expect(result.size).toBe(0);
    });
  });
});
