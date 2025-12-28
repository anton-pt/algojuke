import { describe, test, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { TidalService } from '../../src/services/tidalService.js';
import { TidalTokenService } from '../../src/services/tidalTokenService.js';
import { RateLimitError, ApiUnavailableError, TimeoutError } from '../../src/types/errors.js';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock token service
const mockTokenService = {
  getValidToken: vi.fn().mockResolvedValue('test-token'),
  clearCache: vi.fn(),
} as unknown as TidalTokenService;

describe('TidalService', () => {
  let tidalService: TidalService;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TIDAL_API_BASE_URL = 'https://openapi.tidal.com';
    process.env.TIDAL_REQUESTS_PER_SECOND = '3';

    tidalService = new TidalService(mockTokenService);
  });

  describe('search', () => {
    test('successfully searches and transforms results with batch optimization', async () => {
      // Step 1: Mock initial search response (v2 JSON:API format)
      const mockSearchResponse = {
        data: {
          id: 'search-123',
          type: 'searchResults',
          attributes: {
            trackingId: 'track-123',
          },
          relationships: {
            albums: {
              data: [{ id: '123', type: 'albums' }],
            },
            tracks: {
              data: [{ id: '456', type: 'tracks' }],
            },
          },
        },
        included: [
          {
            id: '123',
            type: 'albums',
            attributes: {
              title: 'Abbey Road',
              explicit: false,
              numberOfItems: 17,
              duration: 'PT46M40S', // ISO 8601 duration
              releaseDate: '1969-09-26',
              externalLinks: [
                {
                  href: 'https://tidal.com/album/123',
                  meta: { type: 'TIDAL_SHARING' },
                },
              ],
            },
          },
          {
            id: '456',
            type: 'tracks',
            attributes: {
              title: 'Come Together',
              explicit: false,
              duration: 'PT4M19S',
              isrc: 'GBAYE0601229',
              externalLinks: [
                {
                  href: 'https://tidal.com/track/456',
                  meta: { type: 'TIDAL_SHARING' },
                },
              ],
            },
          },
        ],
      };

      // Step 2: Mock batch tracks response
      const mockBatchTracksResponse = {
        data: [
          {
            id: '456',
            type: 'tracks',
            relationships: {
              albums: {
                data: [{ id: '123', type: 'albums' }],
              },
            },
          },
        ],
        included: [
          {
            id: '123',
            type: 'albums',
            attributes: {
              title: 'Abbey Road',
            },
          },
        ],
      };

      // Step 3: Mock batch albums response
      const mockBatchAlbumsResponse = {
        data: [
          {
            id: '123',
            type: 'albums',
            relationships: {
              artists: {
                data: [{ id: 'a1', type: 'artists' }],
              },
              coverArt: {
                data: [{ id: 'cover-123', type: 'artworks' }],
              },
            },
          },
        ],
        included: [
          {
            id: 'a1',
            type: 'artists',
            attributes: {
              name: 'The Beatles',
            },
          },
          {
            id: 'cover-123',
            type: 'artworks',
            attributes: {
              files: [
                {
                  href: 'https://resources.tidal.com/images/cover-123/640x640.jpg',
                  meta: { width: 640, height: 640 },
                },
              ],
            },
          },
        ],
      };

      // Mock the three API calls
      mockedAxios.get
        .mockResolvedValueOnce({ data: mockSearchResponse }) // Initial search
        .mockResolvedValueOnce({ data: mockBatchTracksResponse }) // Batch tracks
        .mockResolvedValueOnce({ data: mockBatchAlbumsResponse }); // Batch albums

      const results = await tidalService.search('Beatles', 20, 0, 'US');

      expect(results.albums).toHaveLength(1);
      expect(results.tracks).toHaveLength(1);
      expect(results.query).toBe('Beatles');
      expect(results.total.albums).toBe(1);
      expect(results.total.tracks).toBe(1);
      expect(results.cached).toBe(false);

      // Verify album has artist name and cover art from batch fetch
      expect(results.albums[0].artist).toBe('The Beatles');
      expect(results.albums[0].artworkUrl).toContain('cover-123');

      // Verify track has artist name and cover art from batch fetch
      expect(results.tracks[0].artist).toBe('The Beatles');
      expect(results.tracks[0].albumId).toBe('123');
      expect(results.tracks[0].artworkUrl).toContain('cover-123');
    });

    test('transforms album data correctly with batch details', async () => {
      const mockSearchResponse = {
        data: {
          id: 'search-123',
          type: 'searchResults',
          relationships: {
            albums: {
              data: [{ id: '123', type: 'albums' }],
            },
            tracks: {
              data: [],
            },
          },
        },
        included: [
          {
            id: '123',
            type: 'albums',
            attributes: {
              title: 'Test Album',
              explicit: true,
              numberOfItems: 12,
              duration: 'PT50M0S',
              releaseDate: '2020-01-01',
              externalLinks: [
                {
                  href: 'https://tidal.com/album/123',
                  meta: { type: 'TIDAL_SHARING' },
                },
              ],
            },
          },
        ],
      };

      const mockBatchAlbumsResponse = {
        data: [
          {
            id: '123',
            type: 'albums',
            relationships: {
              artists: {
                data: [
                  { id: 'a1', type: 'artists' },
                  { id: 'a2', type: 'artists' },
                ],
              },
              coverArt: {
                data: [{ id: 'cover-uuid', type: 'artworks' }],
              },
            },
          },
        ],
        included: [
          {
            id: 'a1',
            type: 'artists',
            attributes: { name: 'Test Artist' },
          },
          {
            id: 'a2',
            type: 'artists',
            attributes: { name: 'Featured Artist' },
          },
          {
            id: 'cover-uuid',
            type: 'artworks',
            attributes: {
              files: [
                {
                  href: 'https://resources.tidal.com/images/cover-uuid/640x640.jpg',
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

      const results = await tidalService.search('test');
      const album = results.albums[0];

      expect(album.id).toBe('123');
      expect(album.title).toBe('Test Album');
      expect(album.artist).toBe('Test Artist');
      expect(album.artists).toEqual(['Test Artist', 'Featured Artist']);
      expect(album.artworkUrl).toContain('cover-uuid');
      expect(album.artworkThumbUrl).toContain('cover-uuid');
      expect(album.explicit).toBe(true);
      expect(album.trackCount).toBe(12);
      expect(album.duration).toBe(3000); // 50 minutes in seconds
      expect(album.releaseDate).toBe('2020-01-01');
      expect(album.externalUrl).toBe('https://tidal.com/album/123');
      expect(album.source).toBe('tidal');
    });

    test('transforms track data correctly with batch details', async () => {
      const mockSearchResponse = {
        data: {
          id: 'search-123',
          type: 'searchResults',
          relationships: {
            albums: {
              data: [],
            },
            tracks: {
              data: [{ id: '456', type: 'tracks' }],
            },
          },
        },
        included: [
          {
            id: '456',
            type: 'tracks',
            attributes: {
              title: 'Test Track',
              explicit: false,
              duration: 'PT3M0S',
              isrc: 'TEST123456',
              externalLinks: [
                {
                  href: 'https://tidal.com/track/456',
                  meta: { type: 'TIDAL_SHARING' },
                },
              ],
            },
          },
        ],
      };

      const mockBatchTracksResponse = {
        data: [
          {
            id: '456',
            type: 'tracks',
            relationships: {
              albums: {
                data: [{ id: '789', type: 'albums' }],
              },
            },
          },
        ],
        included: [
          {
            id: '789',
            type: 'albums',
            attributes: {
              title: 'Parent Album',
            },
          },
        ],
      };

      const mockBatchAlbumsResponse = {
        data: [
          {
            id: '789',
            type: 'albums',
            relationships: {
              artists: {
                data: [
                  { id: 'a1', type: 'artists' },
                  { id: 'a2', type: 'artists' },
                ],
              },
              coverArt: {
                data: [{ id: 'track-cover-uuid', type: 'artworks' }],
              },
            },
          },
        ],
        included: [
          {
            id: 'a1',
            type: 'artists',
            attributes: { name: 'Track Artist' },
          },
          {
            id: 'a2',
            type: 'artists',
            attributes: { name: 'Featured' },
          },
          {
            id: 'track-cover-uuid',
            type: 'artworks',
            attributes: {
              files: [
                {
                  href: 'https://resources.tidal.com/images/track-cover/640x640.jpg',
                  meta: { width: 640, height: 640 },
                },
              ],
            },
          },
        ],
      };

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockSearchResponse })
        .mockResolvedValueOnce({ data: mockBatchTracksResponse })
        .mockResolvedValueOnce({ data: mockBatchAlbumsResponse });

      const results = await tidalService.search('test');
      const track = results.tracks[0];

      expect(track.id).toBe('456');
      expect(track.title).toBe('Test Track');
      expect(track.artist).toBe('Track Artist');
      expect(track.artists).toEqual(['Track Artist', 'Featured']);
      expect(track.albumTitle).toBe(''); // Album not in original search results
      expect(track.albumId).toBe('789');
      expect(track.artworkUrl).toContain('track-cover');
      expect(track.duration).toBe(180);
      expect(track.explicit).toBe(false);
      expect(track.source).toBe('tidal');
    });

    test('handles empty results gracefully', async () => {
      const mockSearchResponse = {
        data: {
          id: 'search-123',
          type: 'searchResults',
          relationships: {
            albums: {
              data: [],
            },
            tracks: {
              data: [],
            },
          },
        },
        included: [],
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockSearchResponse });

      const results = await tidalService.search('nonexistent');

      expect(results.albums).toEqual([]);
      expect(results.tracks).toEqual([]);
      expect(results.total.albums).toBe(0);
      expect(results.total.tracks).toBe(0);
    });

    test('uses placeholder for missing cover art', async () => {
      const mockSearchResponse = {
        data: {
          id: 'search-123',
          type: 'searchResults',
          relationships: {
            albums: {
              data: [{ id: '123', type: 'albums' }],
            },
            tracks: {
              data: [],
            },
          },
        },
        included: [
          {
            id: '123',
            type: 'albums',
            attributes: {
              title: 'No Cover Album',
              explicit: false,
              numberOfItems: 10,
              duration: 'PT33M20S',
              releaseDate: '2020-01-01',
              externalLinks: [],
            },
          },
        ],
      };

      const mockBatchAlbumsResponse = {
        data: [
          {
            id: '123',
            type: 'albums',
            relationships: {
              artists: {
                data: [{ id: 'a1', type: 'artists' }],
              },
              coverArt: {
                data: [], // No cover art
              },
            },
          },
        ],
        included: [
          {
            id: 'a1',
            type: 'artists',
            attributes: { name: 'Artist' },
          },
        ],
      };

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockSearchResponse })
        .mockResolvedValueOnce({ data: mockBatchAlbumsResponse });

      const results = await tidalService.search('test');
      const album = results.albums[0];

      expect(album.artworkUrl).toBe('/images/placeholder-album.svg');
      expect(album.artworkThumbUrl).toBe('/images/placeholder-album.svg');
    });

    test('sends correct API request for initial search', async () => {
      const mockSearchResponse = {
        data: {
          id: 'search-123',
          type: 'searchResults',
          relationships: {
            albums: { data: [] },
            tracks: { data: [] },
          },
        },
        included: [],
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockSearchResponse });

      await tidalService.search('Beatles', 25, 10, 'GB');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://openapi.tidal.com/v2/searchResults/Beatles',
        expect.objectContaining({
          headers: {
            'accept': 'application/vnd.api+json',
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/vnd.api+json',
          },
          params: {
            countryCode: 'GB',
            explicitFilter: 'INCLUDE',
            include: 'albums,tracks',
            limit: '25',
          },
          timeout: 10000,
        })
      );
    });

    test('chunks batch albums requests to max 20 per call', async () => {
      // Create 25 albums to test chunking
      const albumIds = Array.from({ length: 25 }, (_, i) => `album-${i}`);

      const mockSearchResponse = {
        data: {
          id: 'search-123',
          type: 'searchResults',
          relationships: {
            albums: {
              data: albumIds.map(id => ({ id, type: 'albums' })),
            },
            tracks: {
              data: [],
            },
          },
        },
        included: albumIds.map(id => ({
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
        .mockResolvedValueOnce({ data: mockSearchResponse })
        .mockResolvedValue({ data: mockBatchAlbumsResponse }); // All subsequent calls

      await tidalService.search('test');

      // Should make 3 API calls total: 1 search + 2 batch albums (20 + 5)
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling', () => {
    test('throws RateLimitError on 429 status', async () => {
      const axiosError = new Error('Too Many Requests') as any;
      axiosError.isAxiosError = true;
      axiosError.response = { status: 429, headers: { 'retry-after': '60' } };
      axiosError.message = 'Too Many Requests';

      mockedAxios.get.mockRejectedValueOnce(axiosError);
      mockedAxios.isAxiosError = vi.fn().mockReturnValue(true);

      await expect(tidalService.search('test')).rejects.toThrow(RateLimitError);
    });

    test('throws TimeoutError on connection timeout', async () => {
      const axiosError = new Error('timeout of 10000ms exceeded') as any;
      axiosError.isAxiosError = true;
      axiosError.code = 'ECONNABORTED';
      axiosError.message = 'timeout of 10000ms exceeded';

      mockedAxios.get.mockRejectedValueOnce(axiosError);
      mockedAxios.isAxiosError = vi.fn().mockReturnValue(true);

      await expect(tidalService.search('test')).rejects.toThrow(TimeoutError);
    });

    test('throws ApiUnavailableError on 503 status', async () => {
      const axiosError = new Error('Service Unavailable') as any;
      axiosError.isAxiosError = true;
      axiosError.response = { status: 503 };
      axiosError.message = 'Service Unavailable';

      mockedAxios.get.mockRejectedValueOnce(axiosError);
      mockedAxios.isAxiosError = vi.fn().mockReturnValue(true);

      await expect(tidalService.search('test')).rejects.toThrow(ApiUnavailableError);
    });

    test('throws ApiUnavailableError on 401 status and clears token cache', async () => {
      const axiosError = new Error('Unauthorized') as any;
      axiosError.isAxiosError = true;
      axiosError.response = { status: 401 };
      axiosError.message = 'Unauthorized';

      mockedAxios.get.mockRejectedValueOnce(axiosError);
      mockedAxios.isAxiosError = vi.fn().mockReturnValue(true);

      await expect(tidalService.search('test')).rejects.toThrow(ApiUnavailableError);
      expect(mockTokenService.clearCache).toHaveBeenCalled();
    });

    test('throws generic ApiUnavailableError for other errors', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(tidalService.search('test')).rejects.toThrow(ApiUnavailableError);
    });
  });

  describe('batch optimization', () => {
    test('constructs batch URL with comma-separated IDs and proper encoding', async () => {
      const mockSearchResponse = {
        data: {
          id: 'search-1',
          type: 'searchResults',
          relationships: {
            albums: {
              data: [
                { id: '123', type: 'albums' },
                { id: '456', type: 'albums' },
                { id: '789', type: 'albums' },
              ],
            },
            tracks: { data: [] },
          },
        },
        included: [
          {
            id: '123',
            type: 'albums',
            attributes: { title: 'Album 1', explicit: false, numberOfItems: 10, duration: 'PT30M0S', releaseDate: '2020-01-01', externalLinks: [] },
          },
          {
            id: '456',
            type: 'albums',
            attributes: { title: 'Album 2', explicit: false, numberOfItems: 10, duration: 'PT30M0S', releaseDate: '2020-01-01', externalLinks: [] },
          },
          {
            id: '789',
            type: 'albums',
            attributes: { title: 'Album 3', explicit: false, numberOfItems: 10, duration: 'PT30M0S', releaseDate: '2020-01-01', externalLinks: [] },
          },
        ],
      };

      const mockBatchAlbumsResponse = {
        data: [
          {
            id: '123',
            type: 'albums',
            relationships: {
              artists: { data: [{ id: 'artist-1', type: 'artists' }] },
              coverArt: { data: [{ id: 'art-1', type: 'artworks' }] },
            },
          },
        ],
        included: [
          { id: 'artist-1', type: 'artists', attributes: { name: 'Test Artist' } },
          {
            id: 'art-1',
            type: 'artworks',
            attributes: {
              files: [{ href: 'https://test.com/art.jpg', meta: { width: 640, height: 640 } }],
            },
          },
        ],
      };

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockSearchResponse })
        .mockResolvedValueOnce({ data: mockBatchAlbumsResponse });

      await tidalService.search('test');

      // Check that the batch albums call uses comma-separated IDs
      const batchAlbumsCall = mockedAxios.get.mock.calls.find((call) =>
        call[0].includes('/v2/albums')
      );
      expect(batchAlbumsCall).toBeDefined();
      // URL-encoded: filter[id]=123,456,789 -> filter%5Bid%5D=123%2C456%2C789
      expect(batchAlbumsCall![0]).toMatch(/filter%5Bid%5D=123%2C456%2C789/);
    });

    test('parses batch response with included array for artist and artwork data', async () => {
      const mockSearchResponse = {
        data: {
          id: 'search-1',
          type: 'searchResults',
          relationships: {
            albums: { data: [{ id: '999', type: 'albums' }] },
            tracks: { data: [] },
          },
        },
        included: [
          {
            id: '999',
            type: 'albums',
            attributes: { title: 'Test Album', explicit: false, numberOfItems: 10, duration: 'PT30M0S', releaseDate: '2020-01-01', externalLinks: [] },
          },
        ],
      };

      const mockBatchAlbumsResponse = {
        data: [
          {
            id: '999',
            type: 'albums',
            relationships: {
              artists: { data: [{ id: 'artist-999', type: 'artists' }] },
              coverArt: { data: [{ id: 'art-999', type: 'artworks' }] },
            },
          },
        ],
        included: [
          { id: 'artist-999', type: 'artists', attributes: { name: 'Batch Artist' } },
          {
            id: 'art-999',
            type: 'artworks',
            attributes: {
              files: [{ href: 'https://resources.tidal.com/images/art-999/640x640.jpg', meta: { width: 640, height: 640 } }],
            },
          },
        ],
      };

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockSearchResponse })
        .mockResolvedValueOnce({ data: mockBatchAlbumsResponse });

      const result = await tidalService.search('test');

      expect(result.albums).toHaveLength(1);
      expect(result.albums[0].artist).toBe('Batch Artist');
      expect(result.albums[0].artworkUrl).toContain('art-999');
    });

    test('extracts ISRCs from track results for batch fetching', async () => {
      const mockSearchResponse = {
        data: {
          id: 'search-1',
          type: 'searchResults',
          relationships: {
            albums: { data: [] },
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
            id: 'track-1',
            type: 'tracks',
            attributes: { title: 'Track 1', isrc: 'USRC17607839', explicit: false, duration: 'PT3M20S', externalLinks: [] },
          },
          {
            id: 'track-2',
            type: 'tracks',
            attributes: { title: 'Track 2', isrc: 'GBUM71505478', explicit: false, duration: 'PT3M20S', externalLinks: [] },
          },
        ],
      };

      const mockBatchTracksResponse = {
        data: [
          {
            id: 'track-1',
            type: 'tracks',
            relationships: { albums: { data: [{ id: 'album-1', type: 'albums' }] } },
          },
          {
            id: 'track-2',
            type: 'tracks',
            relationships: { albums: { data: [{ id: 'album-1', type: 'albums' }] } },
          },
        ],
        included: [],
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
          { id: 'artist-1', type: 'artists', attributes: { name: 'Track Artist' } },
          {
            id: 'art-1',
            type: 'artworks',
            attributes: {
              files: [{ href: 'https://test.com/art.jpg', meta: { width: 640, height: 640 } }],
            },
          },
        ],
      };

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockSearchResponse })
        .mockResolvedValueOnce({ data: mockBatchTracksResponse })
        .mockResolvedValueOnce({ data: mockBatchAlbumsResponse });

      await tidalService.search('test');

      // Check that the batch tracks call uses comma-separated ISRCs
      const batchTracksCall = mockedAxios.get.mock.calls.find((call) =>
        call[0].includes('/v2/tracks')
      );
      expect(batchTracksCall).toBeDefined();
      // URL-encoded: filter[isrc]=USRC17607839,GBUM71505478 -> filter%5Bisrc%5D=USRC17607839%2CGBUM71505478
      expect(batchTracksCall![0]).toMatch(/filter%5Bisrc%5D=USRC17607839%2CGBUM71505478/);
    });
  });
});
