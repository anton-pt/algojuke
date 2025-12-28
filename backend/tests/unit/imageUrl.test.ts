import { describe, test, expect } from 'vitest';
import { getTidalImageUrl, buildImageUrls } from '../../src/utils/imageUrl.js';

describe('Image URL Utilities', () => {
  describe('getTidalImageUrl', () => {
    test('generates correct Tidal image URL with default parameters', () => {
      const uuid = 'abc123-def456-ghi789';
      const url = getTidalImageUrl(uuid);

      expect(url).toBe('https://images.tidal.com/im/im?uuid=abc123-def456-ghi789&w=320&h=320&q=80');
    });

    test('generates URL with custom dimensions', () => {
      const uuid = 'test-uuid';
      const url = getTidalImageUrl(uuid, 640, 640, 90);

      expect(url).toBe('https://images.tidal.com/im/im?uuid=test-uuid&w=640&h=640&q=90');
    });

    test('returns placeholder URL when uuid is null', () => {
      const url = getTidalImageUrl(null);
      expect(url).toBe('/images/placeholder-album.svg');
    });

    test('returns placeholder URL when uuid is undefined', () => {
      const url = getTidalImageUrl(undefined);
      expect(url).toBe('/images/placeholder-album.svg');
    });

    test('returns placeholder URL when uuid is empty string', () => {
      const url = getTidalImageUrl('');
      expect(url).toBe('/images/placeholder-album.svg');
    });

    test('accepts different image sizes', () => {
      const uuid = 'test';

      expect(getTidalImageUrl(uuid, 160, 160, 80)).toContain('w=160&h=160');
      expect(getTidalImageUrl(uuid, 320, 320, 80)).toContain('w=320&h=320');
      expect(getTidalImageUrl(uuid, 640, 640, 80)).toContain('w=640&h=640');
      expect(getTidalImageUrl(uuid, 1280, 1280, 80)).toContain('w=1280&h=1280');
    });

    test('accepts different quality settings', () => {
      const uuid = 'test';

      expect(getTidalImageUrl(uuid, 320, 320, 50)).toContain('q=50');
      expect(getTidalImageUrl(uuid, 320, 320, 80)).toContain('q=80');
      expect(getTidalImageUrl(uuid, 320, 320, 100)).toContain('q=100');
    });
  });

  describe('buildImageUrls', () => {
    test('generates both standard and thumbnail URLs', () => {
      const uuid = 'album-cover-uuid';
      const urls = buildImageUrls(uuid);

      expect(urls).toHaveProperty('artworkUrl');
      expect(urls).toHaveProperty('artworkThumbUrl');
    });

    test('artworkUrl uses 640x640 dimensions', () => {
      const uuid = 'test-uuid';
      const urls = buildImageUrls(uuid);

      expect(urls.artworkUrl).toContain('w=640&h=640');
    });

    test('artworkThumbUrl uses 320x320 dimensions', () => {
      const uuid = 'test-uuid';
      const urls = buildImageUrls(uuid);

      expect(urls.artworkThumbUrl).toContain('w=320&h=320');
    });

    test('returns placeholder URLs when uuid is null', () => {
      const urls = buildImageUrls(null);

      expect(urls.artworkUrl).toBe('/images/placeholder-album.svg');
      expect(urls.artworkThumbUrl).toBe('/images/placeholder-album.svg');
    });

    test('returns placeholder URLs when uuid is undefined', () => {
      const urls = buildImageUrls(undefined);

      expect(urls.artworkUrl).toBe('/images/placeholder-album.svg');
      expect(urls.artworkThumbUrl).toBe('/images/placeholder-album.svg');
    });

    test('both URLs have same quality setting', () => {
      const uuid = 'test-uuid';
      const urls = buildImageUrls(uuid);

      expect(urls.artworkUrl).toContain('q=80');
      expect(urls.artworkThumbUrl).toContain('q=80');
    });
  });
});
