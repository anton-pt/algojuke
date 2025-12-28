import { describe, test, expect, beforeEach, vi } from 'vitest';
import { CacheService } from '../../src/services/cacheService.js';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService(3600); // 1 hour TTL
  });

  describe('set and get', () => {
    test('stores and retrieves values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    test('stores different data types', () => {
      cache.set('string', 'test');
      cache.set('number', 42);
      cache.set('object', { foo: 'bar' });
      cache.set('array', [1, 2, 3]);
      cache.set('boolean', true);

      expect(cache.get('string')).toBe('test');
      expect(cache.get('number')).toBe(42);
      expect(cache.get('object')).toEqual({ foo: 'bar' });
      expect(cache.get('array')).toEqual([1, 2, 3]);
      expect(cache.get('boolean')).toBe(true);
    });

    test('returns null for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    test('overwrites existing keys', () => {
      cache.set('key', 'value1');
      cache.set('key', 'value2');
      expect(cache.get('key')).toBe('value2');
    });
  });

  describe('TTL expiration', () => {
    test('respects custom TTL', () => {
      vi.useFakeTimers();

      cache.set('key', 'value', 10); // 10 seconds TTL
      expect(cache.get('key')).toBe('value');

      // Advance time by 9 seconds - should still be valid
      vi.advanceTimersByTime(9000);
      expect(cache.get('key')).toBe('value');

      // Advance time by 2 more seconds - should be expired
      vi.advanceTimersByTime(2000);
      expect(cache.get('key')).toBeNull();

      vi.useRealTimers();
    });

    test('uses default TTL when not specified', () => {
      vi.useFakeTimers();

      cache.set('key', 'value'); // Uses default 3600 seconds
      expect(cache.get('key')).toBe('value');

      // Advance time by 3599 seconds - should still be valid
      vi.advanceTimersByTime(3599000);
      expect(cache.get('key')).toBe('value');

      // Advance time by 2 more seconds - should be expired
      vi.advanceTimersByTime(2000);
      expect(cache.get('key')).toBeNull();

      vi.useRealTimers();
    });

    test('expired entries are removed from cache', () => {
      vi.useFakeTimers();

      cache.set('key', 'value', 1);
      expect(cache.has('key')).toBe(true);

      vi.advanceTimersByTime(2000);
      expect(cache.has('key')).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('has', () => {
    test('returns true for existing keys', () => {
      cache.set('key', 'value');
      expect(cache.has('key')).toBe(true);
    });

    test('returns false for non-existent keys', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });

    test('returns false for expired keys', () => {
      vi.useFakeTimers();

      cache.set('key', 'value', 1);
      expect(cache.has('key')).toBe(true);

      vi.advanceTimersByTime(2000);
      expect(cache.has('key')).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('delete', () => {
    test('removes specific keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.delete('key1');

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBe('value2');
    });

    test('does not throw for non-existent keys', () => {
      expect(() => cache.delete('nonexistent')).not.toThrow();
    });
  });

  describe('clear', () => {
    test('removes all cache entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.clear();

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBeNull();
    });

    test('cache is empty after clear', () => {
      cache.set('key', 'value');
      cache.clear();

      const stats = cache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.keys).toEqual([]);
    });
  });

  describe('getStats', () => {
    test('returns correct cache size', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
    });

    test('returns list of cache keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.getStats();
      expect(stats.keys).toContain('key1');
      expect(stats.keys).toContain('key2');
      expect(stats.keys).toHaveLength(2);
    });

    test('returns empty stats for empty cache', () => {
      const stats = cache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.keys).toEqual([]);
    });
  });

  describe('cache key uniqueness', () => {
    test('different keys store different values', () => {
      cache.set('search:beatles', { results: 'beatles' });
      cache.set('search:stones', { results: 'stones' });

      expect(cache.get('search:beatles')).toEqual({ results: 'beatles' });
      expect(cache.get('search:stones')).toEqual({ results: 'stones' });
    });

    test('supports cache key patterns', () => {
      cache.set('search:query:beatles:US', 'result1');
      cache.set('search:query:beatles:GB', 'result2');
      cache.set('search:query:stones:US', 'result3');

      expect(cache.get('search:query:beatles:US')).toBe('result1');
      expect(cache.get('search:query:beatles:GB')).toBe('result2');
      expect(cache.get('search:query:stones:US')).toBe('result3');
    });
  });
});
