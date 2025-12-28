import axios from 'axios';
import { logger } from '../utils/logger.js';
import { buildImageUrls } from '../utils/imageUrl.js';
import { RateLimiter } from '../utils/rateLimiter.js';
import { TidalTokenService } from './tidalTokenService.js';
import type {
  TidalV2SearchResponse,
  TidalAlbumAttributes,
  TidalTrackAttributes,
  TidalArtistAttributes,
  TidalAlbumDetailsResponse,
  TidalCoverArtResponse,
  TidalTrackBatchResponse,
  TidalAlbumBatchResponse,
  TidalArtworkAttributes,
  JsonApiResource,
} from '../types/tidal.js';
import type { SearchResults, AlbumResult, TrackResult } from '../types/graphql.js';
import {
  RateLimitError,
  ApiUnavailableError,
  TimeoutError,
} from '../types/errors.js';

/**
 * Service for interacting with the Tidal API
 * Handles search requests, response transformation, and error handling
 */
export class TidalService {
  private readonly apiBaseUrl: string;
  private readonly tokenService: TidalTokenService;
  private readonly rateLimiter: RateLimiter;

  constructor(tokenService: TidalTokenService) {
    this.apiBaseUrl = process.env.TIDAL_API_BASE_URL || 'https://openapi.tidal.com';
    this.tokenService = tokenService;

    // Initialize rate limiter with configurable settings
    this.rateLimiter = new RateLimiter({
      requestsPerSecond: parseInt(process.env.TIDAL_REQUESTS_PER_SECOND || '2'),
      maxConcurrent: parseInt(process.env.TIDAL_MAX_CONCURRENT || '3'),
      maxRetries: parseInt(process.env.TIDAL_MAX_RETRIES || '3'),
      baseRetryDelay: parseInt(process.env.TIDAL_RETRY_DELAY_MS || '1000'),
    });
  }

  /**
   * Search for albums and tracks on Tidal using v2 API
   *
   * @param query - Search query string
   * @param limit - Number of results per type (max 50)
   * @param offset - Pagination offset (not used in v2, uses cursor-based pagination)
   * @param countryCode - ISO 3166-1 country code
   * @returns Transformed search results
   */
  async search(
    query: string,
    limit: number = 20,
    offset: number = 0,
    countryCode: string = 'US'
  ): Promise<SearchResults> {
    const token = await this.tokenService.getValidToken();

    // v2 API uses /v2/searchResults/{query}
    const url = `${this.apiBaseUrl}/v2/searchResults/${encodeURIComponent(query)}`;
    const params = {
      countryCode,
      explicitFilter: 'INCLUDE',
      include: 'albums,tracks', // Include both albums and tracks in response
      limit: String(limit),
    };

    logger.apiCall(url, 'GET');

    try {
      const response = await axios.get<TidalV2SearchResponse>(url, {
        headers: {
          'accept': 'application/vnd.api+json',
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/vnd.api+json',
        },
        params,
        timeout: 10000, // 10 second timeout
      });

      // STEP 1: Extract album IDs and track ISRCs from search results
      const included = response.data.included || [];
      const albumResources = included.filter(
        (resource): resource is JsonApiResource<TidalAlbumAttributes> =>
          resource.type === 'albums'
      );
      const trackResources = included.filter(
        (resource): resource is JsonApiResource<TidalTrackAttributes> =>
          resource.type === 'tracks'
      );

      // Collect all album IDs from search results
      const albumIdsFromSearch = new Set(albumResources.map(album => album.id));

      // Extract ISRCs from tracks for batch track fetch
      const trackIsrcs = trackResources
        .map(track => track.attributes?.isrc)
        .filter((isrc): isrc is string => !!isrc);

      logger.info('batch_optimization_start', {
        albumsFound: albumIdsFromSearch.size,
        tracksFound: trackResources.length,
        tracksWithIsrc: trackIsrcs.length,
      });

      // STEP 2: Batch fetch tracks to get their album IDs (if we have tracks with ISRCs)
      let trackToAlbumMap = new Map<string, string>();
      let albumIdsFromTracks = new Set<string>();
      if (trackIsrcs.length > 0) {
        const trackBatchResult = await this.batchFetchTracks(trackIsrcs, countryCode, token);
        albumIdsFromTracks = trackBatchResult.albumIds;
        trackToAlbumMap = trackBatchResult.trackToAlbumMap;
        logger.info('batch_tracks_complete', {
          additionalAlbums: albumIdsFromTracks.size,
          trackMappings: trackToAlbumMap.size,
        });
      }

      // STEP 3: Combine all album IDs and batch fetch album details (artists + cover art)
      const allAlbumIds = new Set([...albumIdsFromSearch, ...albumIdsFromTracks]);
      const albumDetailsMap = await this.batchFetchAlbums(Array.from(allAlbumIds), countryCode, token);

      logger.info('batch_albums_complete', {
        totalAlbums: allAlbumIds.size,
        enrichedAlbums: albumDetailsMap.size,
        totalApiCalls: trackIsrcs.length > 0 ? 3 : 2, // search + (tracks?) + albums
      });

      return this.transformV2Response(response.data, query, albumDetailsMap, trackToAlbumMap);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.apiError(url, error.response?.status ?? 0, error.message);

        // Handle timeout
        if (error.code === 'ECONNABORTED') {
          throw new TimeoutError();
        }

        // Handle rate limiting
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after']
            ? parseInt(error.response.headers['retry-after'] as string)
            : undefined;
          throw new RateLimitError(retryAfter);
        }

        // Handle API unavailability
        if (error.response?.status === 503) {
          throw new ApiUnavailableError();
        }

        // Handle unauthorized (token expired/invalid)
        if (error.response?.status === 401) {
          logger.warn('tidal_token_invalid', { status: 401 });
          // Clear token cache and retry once
          this.tokenService.clearCache();
          throw new ApiUnavailableError('Tidal authentication failed');
        }
      }

      logger.error('tidal_search_failed', { error: String(error) });
      throw new ApiUnavailableError('Music search service temporarily unavailable');
    }
  }

  /**
   * Batch fetch track details using ISRCs
   *
   * @param isrcs - Array of track ISRCs
   * @param countryCode - ISO 3166-1 country code
   * @param token - Tidal API access token
   * @returns Object with album IDs set and track-to-album mapping
   */
  private async batchFetchTracks(
    isrcs: string[],
    countryCode: string = 'US',
    token: string
  ): Promise<{ albumIds: Set<string>; trackToAlbumMap: Map<string, string> }> {
    if (isrcs.length === 0) {
      return { albumIds: new Set(), trackToAlbumMap: new Map() };
    }

    return this.rateLimiter.executeWithRetry(async () => {
      // Manually construct query string to ensure proper encoding
      const queryParams = new URLSearchParams({
        countryCode,
        include: 'albums',
        'filter[isrc]': isrcs.join(','),
      });
      const url = `${this.apiBaseUrl}/v2/tracks?${queryParams.toString()}`;

      logger.info('batch_tracks_request', { isrcsCount: isrcs.length });

      try {
        const response = await axios.get<TidalTrackBatchResponse>(url, {
          headers: {
            'accept': 'application/vnd.api+json',
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/vnd.api+json',
          },
          timeout: 5000,
        });

        // Extract album IDs from included resources
        const albumIds = new Set<string>();
        if (response.data.included) {
          const albums = response.data.included.filter(
            (resource): resource is JsonApiResource<TidalAlbumAttributes> =>
              resource.type === 'albums'
          );
          albums.forEach(album => albumIds.add(album.id));
        }

        // Build track ID -> album ID mapping from track relationships
        const trackToAlbumMap = new Map<string, string>();
        response.data.data.forEach(track => {
          const albumRelationship = track.relationships?.albums?.data;
          if (Array.isArray(albumRelationship) && albumRelationship.length > 0) {
            // Use first album relationship
            trackToAlbumMap.set(track.id, albumRelationship[0].id);
          } else if (albumRelationship && !Array.isArray(albumRelationship)) {
            // Single album relationship (not array)
            trackToAlbumMap.set(track.id, (albumRelationship as any).id);
          }
        });

        logger.info('batch_tracks_success', {
          albumIds: albumIds.size,
          trackMappings: trackToAlbumMap.size,
        });

        return { albumIds, trackToAlbumMap };
      } catch (error) {
        if (axios.isAxiosError(error)) {
          logger.warn('batch_tracks_fetch_failed', {
            isrcsCount: isrcs.length,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            error: error.message,
          });
        } else {
          logger.warn('batch_tracks_fetch_failed', { isrcsCount: isrcs.length, error: String(error) });
        }
        return { albumIds: new Set(), trackToAlbumMap: new Map() };
      }
    });
  }

  /**
   * Batch fetch album details with artists and cover art
   * Tidal API limits to 20 albums per request, so we chunk the requests
   *
   * @param albumIds - Array of album IDs
   * @param countryCode - ISO 3166-1 country code
   * @param token - Tidal API access token
   * @returns Map of album ID to enriched data (artist names, cover art URL)
   */
  private async batchFetchAlbums(
    albumIds: string[],
    countryCode: string = 'US',
    token: string
  ): Promise<Map<string, { artistNames: string[]; coverUrl: string | null }>> {
    if (albumIds.length === 0) {
      return new Map();
    }

    // Tidal API limit: max 20 albums per request
    const BATCH_SIZE = 20;
    const chunks: string[][] = [];

    // Split album IDs into chunks of 20
    for (let i = 0; i < albumIds.length; i += BATCH_SIZE) {
      chunks.push(albumIds.slice(i, i + BATCH_SIZE));
    }

    logger.info('batch_albums_chunking', {
      totalAlbums: albumIds.length,
      batchSize: BATCH_SIZE,
      numBatches: chunks.length,
    });

    // Fetch all chunks sequentially (rate limiter handles throttling)
    const allResults = new Map<string, { artistNames: string[]; coverUrl: string | null }>();

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkResults = await this.fetchAlbumBatch(chunk, countryCode, token, i + 1, chunks.length);

      // Merge chunk results into final map
      chunkResults.forEach((value, key) => {
        allResults.set(key, value);
      });
    }

    logger.info('batch_albums_complete_all_chunks', {
      totalAlbums: albumIds.length,
      enrichedAlbums: allResults.size,
      numBatches: chunks.length,
    });

    return allResults;
  }

  /**
   * Fetch a single batch of albums (max 20)
   */
  private async fetchAlbumBatch(
    albumIds: string[],
    countryCode: string,
    token: string,
    batchNumber: number,
    totalBatches: number
  ): Promise<Map<string, { artistNames: string[]; coverUrl: string | null }>> {
    return this.rateLimiter.executeWithRetry(async () => {
      // Manually construct query string to ensure proper encoding
      const queryParams = new URLSearchParams({
        countryCode,
        include: 'artists,coverArt',
        'filter[id]': albumIds.join(','),
      });
      const url = `${this.apiBaseUrl}/v2/albums?${queryParams.toString()}`;

      logger.info('batch_albums_request', {
        batchNumber,
        totalBatches,
        albumIdsCount: albumIds.length,
      });

      try {
        const response = await axios.get<TidalAlbumBatchResponse>(url, {
          headers: {
            'accept': 'application/vnd.api+json',
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/vnd.api+json',
          },
          timeout: 5000,
        });

        // Build lookup maps from included resources
        const lookupMaps = this.buildLookupMaps(response.data.included || []);

        // Build final album data map
        const albumDataMap = new Map<string, { artistNames: string[]; coverUrl: string | null }>();

        response.data.data.forEach(album => {
          // Get artist names
          const artistIds = album.relationships?.artists?.data;
          const artistNames: string[] = [];
          if (Array.isArray(artistIds)) {
            artistIds.forEach(artistRef => {
              const name = lookupMaps.artistMap.get(artistRef.id);
              if (name) artistNames.push(name);
            });
          }

          // Get cover art URL
          const coverArtData = album.relationships?.coverArt?.data;
          let coverUrl: string | null = null;
          if (Array.isArray(coverArtData) && coverArtData.length > 0) {
            coverUrl = lookupMaps.artworkMap.get(coverArtData[0].id) || null;
          }

          albumDataMap.set(album.id, {
            artistNames: artistNames.length > 0 ? artistNames : ['Unknown Artist'],
            coverUrl,
          });
        });

        logger.info('batch_albums_success', {
          batchNumber,
          totalBatches,
          enrichedAlbums: albumDataMap.size,
        });

        return albumDataMap;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          logger.warn('batch_albums_fetch_failed', {
            batchNumber,
            totalBatches,
            albumIdsCount: albumIds.length,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            error: error.message,
          });
        } else {
          logger.warn('batch_albums_fetch_failed', {
            batchNumber,
            totalBatches,
            albumIdsCount: albumIds.length,
            error: String(error),
          });
        }
        return new Map();
      }
    });
  }

  /**
   * Build lookup maps from JSON:API included resources
   *
   * @param included - Array of included resources (artists, artworks)
   * @returns Object with artistMap and artworkMap
   */
  private buildLookupMaps(
    included: Array<JsonApiResource<TidalArtistAttributes | TidalArtworkAttributes>>
  ): { artistMap: Map<string, string>; artworkMap: Map<string, string> } {
    const artistMap = new Map<string, string>();
    const artworkMap = new Map<string, string>();

    included.forEach(resource => {
      if (resource.type === 'artists') {
        const attrs = resource.attributes as TidalArtistAttributes;
        if (attrs?.name) {
          artistMap.set(resource.id, attrs.name);
        }
      } else if (resource.type === 'artworks') {
        const attrs = resource.attributes as TidalArtworkAttributes;
        if (attrs?.files && attrs.files.length > 0) {
          // Prefer 640x640, fallback to first available
          const image640 = attrs.files.find(f => f.meta.width === 640);
          const url = image640?.href || attrs.files[0].href;
          artworkMap.set(resource.id, url);
        }
      }
    });

    return { artistMap, artworkMap };
  }

  /**
   * Convert ISO 8601 duration to seconds
   * Example: "PT41M49S" -> 2509 seconds
   */
  private parseDuration(isoDuration: string): number {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Transform Tidal v2 JSON:API response to GraphQL format
   *
   * @param tidalResponse - Raw Tidal v2 API response
   * @param query - Original search query
   * @param albumDetailsMap - Map of album ID to fetched details (artist names, cover URL)
   * @param trackToAlbumMap - Map of track ID to album ID for track enrichment
   * @returns Transformed search results
   */
  private transformV2Response(
    tidalResponse: TidalV2SearchResponse,
    query: string,
    albumDetailsMap: Map<string, { artistNames: string[]; coverUrl: string | null }> = new Map(),
    trackToAlbumMap: Map<string, string> = new Map()
  ): SearchResults {
    const included = tidalResponse.included || [];
    const relationships = tidalResponse.data.relationships;

    // Extract albums from included resources
    const albumResources = included.filter(
      (resource): resource is JsonApiResource<TidalAlbumAttributes> =>
        resource.type === 'albums'
    );

    const albums: AlbumResult[] = albumResources.map((albumResource) => {
      const attrs = albumResource.attributes!;
      const externalUrl =
        attrs.externalLinks?.find((link) => link.meta?.type === 'TIDAL_SHARING')?.href || '';

      // Get album details (artist names, cover art URL) from batch fetch
      const albumDetails = albumDetailsMap.get(albumResource.id);
      const artistNames = albumDetails?.artistNames || ['Unknown Artist'];
      const coverUrl = albumDetails?.coverUrl || null;

      // Use actual cover art URL from batch fetch or fallback to placeholder
      const placeholderImages = buildImageUrls(null);
      const artworkUrl = coverUrl || placeholderImages.artworkUrl;
      const artworkThumbUrl = coverUrl || placeholderImages.artworkThumbUrl;

      return {
        id: albumResource.id,
        title: attrs.title,
        artist: artistNames[0], // Primary artist
        artists: artistNames, // All credited artists
        artworkUrl,
        artworkThumbUrl,
        explicit: attrs.explicit,
        trackCount: attrs.numberOfItems,
        duration: this.parseDuration(attrs.duration),
        releaseDate: attrs.releaseDate,
        externalUrl,
        source: 'tidal' as const,
      };
    });

    // Extract tracks from included resources
    const trackResources = included.filter(
      (resource): resource is JsonApiResource<TidalTrackAttributes> =>
        resource.type === 'tracks'
    );

    const tracks: TrackResult[] = trackResources.map((trackResource) => {
      const attrs = trackResource.attributes!;
      const externalUrl =
        attrs.externalLinks?.find((link) => link.meta?.type === 'TIDAL_SHARING')?.href || '';

      // Look up track's album ID from batch fetch
      const albumId = trackToAlbumMap.get(trackResource.id) || '';

      // Get album details (artist names, cover art) if we have the album
      let artistNames: string[] = ['Unknown Artist'];
      let albumTitle = '';
      let coverUrl: string | null = null;

      if (albumId) {
        const albumDetails = albumDetailsMap.get(albumId);
        if (albumDetails) {
          artistNames = albumDetails.artistNames;
          coverUrl = albumDetails.coverUrl;
        }

        // Try to find album title from the original search results
        const albumResource = albumResources.find(a => a.id === albumId);
        if (albumResource?.attributes?.title) {
          albumTitle = albumResource.attributes.title;
        }
      }

      // Use actual cover art URL from album or fallback to placeholder
      const placeholderImages = buildImageUrls(null);
      const artworkUrl = coverUrl || placeholderImages.artworkUrl;
      const artworkThumbUrl = coverUrl || placeholderImages.artworkThumbUrl;

      return {
        id: trackResource.id,
        title: attrs.title,
        artist: artistNames[0], // Primary artist
        artists: artistNames, // All credited artists
        albumTitle,
        albumId,
        artworkUrl,
        artworkThumbUrl,
        explicit: attrs.explicit,
        duration: this.parseDuration(attrs.duration),
        externalUrl,
        source: 'tidal' as const,
      };
    });

    // Get totals from relationship metadata
    const albumCount = relationships.albums?.data?.length || 0;
    const trackCount = relationships.tracks?.data?.length || 0;

    return {
      albums,
      tracks,
      query,
      total: {
        albums: albumCount,
        tracks: trackCount,
      },
      cached: false,
      timestamp: Date.now(),
    };
  }
}
