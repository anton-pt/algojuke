import { describe, test, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { TidalService } from '../../src/services/tidalService.js';
import { TidalTokenService } from '../../src/services/tidalTokenService.js';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('Batch API Integration Tests', () => {
  let tidalService: TidalService;
  let tokenService: TidalTokenService;

  beforeEach(() => {
    vi.clearAllMocks();

    process.env.TIDAL_CLIENT_ID = 'test-client-id';
    process.env.TIDAL_CLIENT_SECRET = 'test-client-secret';
    process.env.TIDAL_API_BASE_URL = 'https://openapi.tidal.com';
    process.env.TIDAL_REQUESTS_PER_SECOND = '3';

    tokenService = new TidalTokenService();
    tidalService = new TidalService(tokenService);

    // Mock token fetch
    mockedAxios.post.mockResolvedValue({
      data: { access_token: 'test-token', expires_in: 3600, token_type: 'Bearer' },
    });
  });

  describe('3-call batch optimization pattern', () => {
    test('uses exactly 3 API calls for search with albums and tracks', async () => {
      // Step 1: Initial search returns basic album and track data
      const mockSearchResponse = {
        data: {
          id: 'search-123',
          type: 'searchResults',
          relationships: {
            albums: {
              data: [
                { id: 'album-1', type: 'albums' },
                { id: 'album-2', type: 'albums' },
              ],
            },
            tracks: {
              data: [
                { id: 'track-1', type: 'tracks' },
                { id: 'track-2', type: 'tracks' },
              ],
            },
          },
        },
        included: [
          {
            id: 'album-1',
            type: 'albums',
            attributes: {
              title: 'Album 1',
              explicit: false,
              numberOfItems: 10,
              duration: 'PT30M0S',
              releaseDate: '2020-01-01',
              externalLinks: [],
            },
          },
          {
            id: 'album-2',
            type: 'albums',
            attributes: {
              title: 'Album 2',
              explicit: false,
              numberOfItems: 12,
              duration: 'PT35M0S',
              releaseDate: '2021-01-01',
              externalLinks: [],
            },
          },
          {
            id: 'track-1',
            type: 'tracks',
            attributes: {
              title: 'Track 1',
              isrc: 'USRC17607839',
              explicit: false,
              duration: 'PT3M20S',
              externalLinks: [],
            },
          },
          {
            id: 'track-2',
            type: 'tracks',
            attributes: {
              title: 'Track 2',
              isrc: 'GBUM71505478',
              explicit: false,
              duration: 'PT4M10S',
              externalLinks: [],
            },
          },
        ],
      };

      // Step 2: Batch tracks call returns album associations
      const mockBatchTracksResponse = {
        data: [
          {
            id: 'track-1',
            type: 'tracks',
            relationships: {
              albums: { data: [{ id: 'album-1', type: 'albums' }] },
            },
          },
          {
            id: 'track-2',
            type: 'tracks',
            relationships: {
              albums: { data: [{ id: 'album-2', type: 'albums' }] },
            },
          },
        ],
        included: [],
      };

      // Step 3: Batch albums call returns artist names and cover art
      const mockBatchAlbumsResponse = {
        data: [
          {
            id: 'album-1',
            type: 'albums',
            relationships: {
              artists: { data: [{ id: 'artist-1', type: 'artists' }] },
              coverArt: { data: [{ id: 'art-1', type: 'artworks' }] },
            },
          },
          {
            id: 'album-2',
            type: 'albums',
            relationships: {
              artists: { data: [{ id: 'artist-2', type: 'artists' }] },
              coverArt: { data: [{ id: 'art-2', type: 'artworks' }] },
            },
          },
        ],
        included: [
          { id: 'artist-1', type: 'artists', attributes: { name: 'Artist 1' } },
          { id: 'artist-2', type: 'artists', attributes: { name: 'Artist 2' } },
          {
            id: 'art-1',
            type: 'artworks',
            attributes: {
              files: [
                {
                  href: 'https://resources.tidal.com/images/art-1/640x640.jpg',
                  meta: { width: 640, height: 640 },
                },
              ],
            },
          },
          {
            id: 'art-2',
            type: 'artworks',
            attributes: {
              files: [
                {
                  href: 'https://resources.tidal.com/images/art-2/640x640.jpg',
                  meta: { width: 640, height: 640 },
                },
              ],
            },
          },
        ],
      };

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockSearchResponse }) // Call 1: Search
        .mockResolvedValueOnce({ data: mockBatchTracksResponse }) // Call 2: Batch tracks
        .mockResolvedValueOnce({ data: mockBatchAlbumsResponse }); // Call 3: Batch albums

      const result = await tidalService.search('test query');

      // Verify exactly 3 API calls were made
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);

      // Verify call 1: Initial search
      expect(mockedAxios.get).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('/v2/searchResults/test%20query'),
        expect.anything()
      );

      // Verify call 2: Batch tracks (URL-encoded)
      expect(mockedAxios.get).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('/v2/tracks'),
        expect.anything()
      );
      const batchTracksCall = mockedAxios.get.mock.calls[1][0];
      expect(batchTracksCall).toMatch(/filter%5Bisrc%5D=USRC17607839%2CGBUM71505478/);

      // Verify call 3: Batch albums (URL-encoded)
      expect(mockedAxios.get).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('/v2/albums'),
        expect.anything()
      );
      const batchAlbumsCall = mockedAxios.get.mock.calls[2][0];
      expect(batchAlbumsCall).toMatch(/filter%5Bid%5D=album-1%2Calbum-2/);

      // Verify results are fully enriched
      expect(result.albums).toHaveLength(2);
      expect(result.tracks).toHaveLength(2);

      // Verify albums have artist names and cover art
      expect(result.albums[0].artist).toBe('Artist 1');
      expect(result.albums[0].artworkUrl).toContain('art-1');
      expect(result.albums[1].artist).toBe('Artist 2');
      expect(result.albums[1].artworkUrl).toContain('art-2');

      // Verify tracks have artist names and cover art from associated albums
      expect(result.tracks[0].artist).toBe('Artist 1');
      expect(result.tracks[0].artworkUrl).toContain('art-1');
      expect(result.tracks[1].artist).toBe('Artist 2');
      expect(result.tracks[1].artworkUrl).toContain('art-2');
    });

    test('handles albums-only search with 2 API calls', async () => {
      const mockSearchResponse = {
        data: {
          id: 'search-123',
          type: 'searchResults',
          relationships: {
            albums: {
              data: [{ id: 'album-1', type: 'albums' }],
            },
            tracks: { data: [] },
          },
        },
        included: [
          {
            id: 'album-1',
            type: 'albums',
            attributes: {
              title: 'Album 1',
              explicit: false,
              numberOfItems: 10,
              duration: 'PT30M0S',
              releaseDate: '2020-01-01',
              externalLinks: [],
            },
          },
        ],
      };

      const mockBatchAlbumsResponse = {
        data: [
          {
            id: 'album-1',
            type: 'albums',
            relationships: {
              artists: { data: [{ id: 'artist-1', type: 'artists' }] },
              coverArt: { data: [{ id: 'art-1', type: 'artworks' }] },
            },
          },
        ],
        included: [
          { id: 'artist-1', type: 'artists', attributes: { name: 'Artist' } },
          {
            id: 'art-1',
            type: 'artworks',
            attributes: {
              files: [
                {
                  href: 'https://resources.tidal.com/images/art-1/640x640.jpg',
                  meta: { width: 640, height: 640 },
                },
              ],
            },
          },
        ],
      };

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockSearchResponse })
        .mockResolvedValueOnce({ data: mockBatchAlbumsResponse });

      await tidalService.search('album query');

      // Albums-only search: 1 search + 1 batch albums = 2 calls
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    test('verifies timing improvement over naive approach', async () => {
      // Create mock response with 10 albums
      const albumIds = Array.from({ length: 10 }, (_, i) => `album-${i + 1}`);

      const mockSearchResponse = {
        data: {
          id: 'search-123',
          type: 'searchResults',
          relationships: {
            albums: {
              data: albumIds.map((id) => ({ id, type: 'albums' })),
            },
            tracks: { data: [] },
          },
        },
        included: albumIds.map((id) => ({
          id,
          type: 'albums',
          attributes: {
            title: `Album ${id}`,
            explicit: false,
            numberOfItems: 10,
            duration: 'PT30M0S',
            releaseDate: '2020-01-01',
            externalLinks: [],
          },
        })),
      };

      const mockBatchAlbumsResponse = {
        data: albumIds.map((id) => ({
          id,
          type: 'albums',
          relationships: {
            artists: { data: [{ id: `artist-${id}`, type: 'artists' }] },
            coverArt: { data: [{ id: `art-${id}`, type: 'artworks' }] },
          },
        })),
        included: [
          ...albumIds.map((id) => ({
            id: `artist-${id}`,
            type: 'artists',
            attributes: { name: `Artist ${id}` },
          })),
          ...albumIds.map((id) => ({
            id: `art-${id}`,
            type: 'artworks',
            attributes: {
              files: [
                {
                  href: `https://resources.tidal.com/images/art-${id}/640x640.jpg`,
                  meta: { width: 640, height: 640 },
                },
              ],
            },
          })),
        ],
      };

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockSearchResponse })
        .mockResolvedValueOnce({ data: mockBatchAlbumsResponse });

      const startTime = Date.now();
      await tidalService.search('test');
      const duration = Date.now() - startTime;

      // Batch optimization: 1 search + 1 batch albums = 2 calls
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);

      // Naive approach would make: 1 search + 10 artists + 10 cover art = 21 calls
      // Improvement: 2 calls vs 21 calls = ~10.5x fewer API calls

      // Verify timing is reasonable (should complete quickly)
      expect(duration).toBeLessThan(100); // Should complete in <100ms
    });
  });

  describe('batch chunking for large result sets', () => {
    test('chunks batch albums requests when more than 20 albums', async () => {
      // Create 25 albums to test chunking (20 + 5)
      const albumIds = Array.from({ length: 25 }, (_, i) => `album-${i + 1}`);

      const mockSearchResponse = {
        data: {
          id: 'search-123',
          type: 'searchResults',
          relationships: {
            albums: {
              data: albumIds.map((id) => ({ id, type: 'albums' })),
            },
            tracks: { data: [] },
          },
        },
        included: albumIds.map((id) => ({
          id,
          type: 'albums',
          attributes: {
            title: `Album ${id}`,
            explicit: false,
            numberOfItems: 10,
            duration: 'PT30M0S',
            releaseDate: '2020-01-01',
            externalLinks: [],
          },
        })),
      };

      const mockBatchAlbumsResponse = {
        data: [],
        included: [],
      };

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockSearchResponse }) // Search call
        .mockResolvedValue({ data: mockBatchAlbumsResponse }); // All batch albums calls

      await tidalService.search('large result set');

      // Should make 3 calls total: 1 search + 2 batch albums (20 + 5)
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);

      // Verify first batch has 20 albums (URL-encoded: filter%5Bid%5D=...)
      const firstBatchCall = mockedAxios.get.mock.calls[1][0];
      const firstBatchIds = firstBatchCall.match(/filter%5Bid%5D=([^&]+)/)?.[1];
      expect(firstBatchIds?.split('%2C').length).toBe(20);

      // Verify second batch has 5 albums
      const secondBatchCall = mockedAxios.get.mock.calls[2][0];
      const secondBatchIds = secondBatchCall.match(/filter%5Bid%5D=([^&]+)/)?.[1];
      expect(secondBatchIds?.split('%2C').length).toBe(5);
    });
  });
});
