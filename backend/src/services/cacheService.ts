import { logger } from '../utils/logger.js';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * In-memory cache service with TTL support
 * Used for caching search results and OAuth tokens
 */
export class CacheService {
  private cache: Map<string, CacheEntry<unknown>>;
  private defaultTTL: number;

  constructor(defaultTTL: number = 3600) {
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
  }

  /**
   * Store a value in the cache with optional TTL
   *
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttl - Time to live in seconds (defaults to constructor TTL)
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl ?? this.defaultTTL) * 1000;
    this.cache.set(key, { data, expiresAt });
    logger.cacheSet(key, ttl ?? this.defaultTTL);
  }

  /**
   * Retrieve a value from the cache
   *
   * @param key - Cache key
   * @returns Cached data or null if not found or expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      logger.cacheMiss(key);
      return null;
    }

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      logger.cacheMiss(key);
      return null;
    }

    logger.cacheHit(key);
    return entry.data as T;
  }

  /**
   * Check if a key exists and is not expired
   *
   * @param key - Cache key
   * @returns True if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Remove a specific key from the cache
   *
   * @param key - Cache key to delete
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    logger.info('cache_cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}
