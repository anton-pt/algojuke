import { describe, test, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { CacheService } from '../../src/services/cacheService.js';
import { TidalTokenService } from '../../src/services/tidalTokenService.js';
import { TidalService } from '../../src/services/tidalService.js';
import { searchResolver } from '../../src/resolvers/searchResolver.js';
import type { ResolverContext } from '../../src/resolvers/searchResolver.js';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Helper to create v2 JSON:API mock responses
function createMockV2SearchResponse(options: {
  albums?: Array<{ id: string; title: string }>;
  tracks?: Array<{ id: string; title: string; isrc?: string }>;
} = {}) {
  const { albums = [], tracks = [] } = options;

  return {
    data: {
      id: 'search-123',
      type: 'searchResults',
      relationships: {
        albums: {
          data: albums.map(a => ({ id: a.id, type: 'albums' })),
        },
        tracks: {
          data: tracks.map(t => ({ id: t.id, type: 'tracks' })),
        },
      },
    },
    included: [
      ...albums.map(a => ({
        id: a.id,
        type: 'albums',
        attributes: {
          title: a.title,
          explicit: false,
          numberOfItems: 10,
          duration: 'PT33M20S',
          releaseDate: '2020-01-01',
          externalLinks: [],
        },
      })),
      ...tracks.map(t => ({
        id: t.id,
        type: 'tracks',
        attributes: {
          title: t.title,
          explicit: false,
          duration: 'PT3M20S',
          isrc: t.isrc || `ISRC${t.id}`,
          externalLinks: [],
        },
      })),
    ],
  };
}

function createMockBatchAlbumsResponse(albumIds: string[]) {
  return {
    data: albumIds.map(id => ({
      id,
      type: 'albums',
      relationships: {
        artists: {
          data: [{ id: `artist-${id}`, type: 'artists' }],
        },
        coverArt: {
          data: [{ id: `cover-${id}`, type: 'artworks' }],
        },
      },
    })),
    included: [
      ...albumIds.map(id => ({
        id: `artist-${id}`,
        type: 'artists',
        attributes: { name: 'Test Artist' },
      })),
      ...albumIds.map(id => ({
        id: `cover-${id}`,
        type: 'artworks',
        attributes: {
          files: [
            {
              href: `https://resources.tidal.com/images/cover-${id}/640x640.jpg`,
              meta: { width: 640, height: 640 },
            },
          ],
        },
      })),
    ],
  };
}

describe('Search Integration Tests', () => {
  let context: ResolverContext;

  beforeEach(() => {
    vi.clearAllMocks();

    process.env.TIDAL_CLIENT_ID = 'test-client-id';
    process.env.TIDAL_CLIENT_SECRET = 'test-client-secret';
    process.env.TIDAL_API_BASE_URL = 'https://openapi.tidal.com';
    process.env.SEARCH_CACHE_TTL = '3600';
    process.env.TIDAL_REQUESTS_PER_SECOND = '3';

    // Set up services
    const cache = new CacheService(3600);
    const tokenService = new TidalTokenService();
    const tidalService = new TidalService(tokenService);

    context = { cache, tidalService };

    // Mock token fetch
    mockedAxios.post.mockResolvedValue({
      data: { access_token: 'test-token', expires_in: 3600, token_type: 'Bearer' },
    });
  });

  describe('End-to-end search flow', () => {
    test('completes full search workflow', async () => {
      const mockSearchResponse = createMockV2SearchResponse({
        albums: [{ id: '123', title: 'Test Album' }],
        tracks: [{ id: '456', title: 'Test Track', isrc: 'TEST123' }],
      });

      const mockBatchTracksResponse = {
        data: [
          {
            id: '456',
            type: 'tracks',
            relationships: {
              albums: { data: [{ id: '123', type: 'albums' }] },
            },
          },
        ],
        included: [],
      };

      const mockBatchAlbumsResponse = createMockBatchAlbumsResponse(['123']);

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockSearchResponse })
        .mockResolvedValueOnce({ data: mockBatchTracksResponse })
        .mockResolvedValueOnce({ data: mockBatchAlbumsResponse });

      const result = await searchResolver.Query.search(
        {},
        { query: 'test query', limit: 20 },
        context
      );

      expect(result.albums).toHaveLength(1);
      expect(result.tracks).toHaveLength(1);
      expect(result.total.albums).toBe(1);
      expect(result.total.tracks).toBe(1);
      expect(result.cached).toBe(false);
      expect(result.query).toBe('test query');
    });

    test('uses cache on second identical query', async () => {
      const mockSearchResponse = createMockV2SearchResponse();

      mockedAxios.get.mockResolvedValue({ data: mockSearchResponse });

      // First query - should hit Tidal API
      const result1 = await searchResolver.Query.search(
        {},
        { query: 'cached query' },
        context
      );

      // Second query - should use cache
      const result2 = await searchResolver.Query.search(
        {},
        { query: 'cached query' },
        context
      );

      expect(result1.cached).toBe(false);
      expect(result2.cached).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1); // Only one API call
    });

    test('cache keys are unique per query and country', async () => {
      const mockSearchResponse = createMockV2SearchResponse();

      mockedAxios.get.mockResolvedValue({ data: mockSearchResponse });

      // First query with default country
      await searchResolver.Query.search({}, { query: 'test' }, context);

      // Second query with different country - should NOT use cache
      await searchResolver.Query.search(
        {},
        { query: 'test', countryCode: 'GB' },
        context
      );

      expect(mockedAxios.get).toHaveBeenCalledTimes(2); // Two separate API calls
    });

    test('validates query input', async () => {
      await expect(
        searchResolver.Query.search({}, { query: '' }, context)
      ).rejects.toThrow();

      await expect(
        searchResolver.Query.search({}, { query: '   ' }, context)
      ).rejects.toThrow();

      await expect(
        searchResolver.Query.search({}, { query: 'a'.repeat(201) }, context)
      ).rejects.toThrow();
    });

    test('handles API errors gracefully', async () => {
      const axiosError = new Error('Network error') as any;
      axiosError.isAxiosError = true;
      axiosError.response = { status: 500 };

      mockedAxios.get.mockRejectedValueOnce(axiosError);
      mockedAxios.isAxiosError = vi.fn().mockReturnValue(true);

      await expect(
        searchResolver.Query.search({}, { query: 'test' }, context)
      ).rejects.toThrow();
    });

    test('applies default pagination values', async () => {
      const mockSearchResponse = createMockV2SearchResponse();
      mockedAxios.get.mockResolvedValue({ data: mockSearchResponse });

      await searchResolver.Query.search({}, { query: 'test' }, context);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('searchResults/test'),
        expect.objectContaining({
          params: expect.objectContaining({
            limit: '20', // Default limit
          }),
        })
      );
    });

    test('respects custom pagination values', async () => {
      const mockSearchResponse = createMockV2SearchResponse();
      mockedAxios.get.mockResolvedValue({ data: mockSearchResponse });

      await searchResolver.Query.search(
        {},
        { query: 'test', limit: 50, offset: 20 },
        context
      );

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('searchResults/test'),
        expect.objectContaining({
          params: expect.objectContaining({
            limit: '50',
          }),
        })
      );
    });

    test('trims whitespace from queries', async () => {
      const mockSearchResponse = createMockV2SearchResponse();
      mockedAxios.get.mockResolvedValue({ data: mockSearchResponse });

      const result = await searchResolver.Query.search(
        {},
        { query: '  trimmed  ' },
        context
      );

      expect(result.query).toBe('trimmed');
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('searchResults/trimmed'),
        expect.anything()
      );
    });
  });

  describe('Cache behavior', () => {
    test('cache respects TTL', async () => {
      // Set short TTL in environment
      const originalTTL = process.env.SEARCH_CACHE_TTL;
      process.env.SEARCH_CACHE_TTL = '1'; // 1 second TTL

      // Create a cache with 1 second TTL
      const shortCache = new CacheService(1);
      const tokenService = new TidalTokenService();
      const tidalService = new TidalService(tokenService);
      const shortContext = { cache: shortCache, tidalService };

      const mockSearchResponse = createMockV2SearchResponse();
      mockedAxios.get.mockResolvedValue({ data: mockSearchResponse });

      // First query
      const result1 = await searchResolver.Query.search(
        {},
        { query: 'ttl test' },
        shortContext
      );

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Second query after TTL - should hit API again
      const result2 = await searchResolver.Query.search(
        {},
        { query: 'ttl test' },
        shortContext
      );

      expect(result1.cached).toBe(false);
      expect(result2.cached).toBe(false);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2); // Two separate API calls

      // Restore original TTL
      process.env.SEARCH_CACHE_TTL = originalTTL;
    });

    test('returns timestamps in results', async () => {
      const mockSearchResponse = createMockV2SearchResponse();
      mockedAxios.get.mockResolvedValue({ data: mockSearchResponse });

      const result = await searchResolver.Query.search(
        {},
        { query: 'test' },
        context
      );

      expect(result.timestamp).toBeGreaterThan(0);
      expect(typeof result.timestamp).toBe('number');
    });

    test('cached results have original timestamp', async () => {
      const mockSearchResponse = createMockV2SearchResponse();
      mockedAxios.get.mockResolvedValue({ data: mockSearchResponse });

      const result1 = await searchResolver.Query.search(
        {},
        { query: 'timestamp test' },
        context
      );

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 10));

      const result2 = await searchResolver.Query.search(
        {},
        { query: 'timestamp test' },
        context
      );

      expect(result2.timestamp).toBe(result1.timestamp); // Same timestamp from cache
      expect(result2.cached).toBe(true);
    });
  });
});
