import { validateQuery, validateLimit, validateOffset, validateCountryCode } from '../utils/validation.js';
import { logger } from '../utils/logger.js';
import type { SearchArgs, SearchResults } from '../types/graphql.js';
import type { TidalService } from '../services/tidalService.js';
import type { CacheService } from '../services/cacheService.js';

export interface ResolverContext {
  tidalService: TidalService;
  cache: CacheService;
}

/**
 * GraphQL resolver for search query
 */
export const searchResolver = {
  Query: {
    search: async (
      _parent: unknown,
      args: SearchArgs,
      context: ResolverContext
    ): Promise<SearchResults> => {
      // Validate inputs
      const query = validateQuery(args.query);
      const limit = validateLimit(args.limit);
      const offset = validateOffset(args.offset);
      const countryCode = validateCountryCode(args.countryCode);

      logger.searchRequest(query, limit, offset);

      // Generate cache key
      const cacheKey = `search:${query}:${countryCode}:${limit}:${offset}`;

      // Check cache first
      const cachedResult = context.cache.get<SearchResults>(cacheKey);
      if (cachedResult) {
        logger.searchResponse(
          query,
          cachedResult.albums.length,
          cachedResult.tracks.length,
          true
        );
        return {
          ...cachedResult,
          cached: true,
        };
      }

      // Fetch from Tidal API
      const results = await context.tidalService.search(query, limit, offset, countryCode);

      // Cache the results (TTL from environment or default 3600 seconds)
      const cacheTTL = parseInt(process.env.SEARCH_CACHE_TTL || '3600');
      context.cache.set(cacheKey, results, cacheTTL);

      logger.searchResponse(
        query,
        results.albums.length,
        results.tracks.length,
        false
      );

      return {
        ...results,
        cached: false,
      };
    },
  },
};
