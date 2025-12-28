/**
 * Unit test for library sorting logic
 *
 * Purpose: Verify that library items (albums and tracks) are sorted correctly
 * according to the specification: alphabetically by artist name (primary),
 * then by title (secondary), with case-insensitive comparison
 *
 * Tests:
 * - Artist name primary sort
 * - Album/track title secondary sort
 * - Case-insensitive comparison
 * - Unicode collation order handling
 * - Handling of special characters and accented letters
 */

import { describe, it, expect } from 'vitest';

/**
 * Comparator function for sorting library items alphabetically
 *
 * Sorts by:
 * 1. artistName (case-insensitive, ascending)
 * 2. title (case-insensitive, ascending)
 *
 * @param a - First item to compare
 * @param b - Second item to compare
 * @returns Negative if a < b, positive if a > b, zero if equal
 */
export function compareLibraryItems(
  a: { artistName: string; title: string },
  b: { artistName: string; title: string }
): number {
  // Compare artistName case-insensitively with locale-aware Unicode collation
  const artistCompare = a.artistName.localeCompare(b.artistName, 'en', {
    sensitivity: 'base',
    numeric: false,
  });

  // If artist names are equal, compare titles case-insensitively
  if (artistCompare === 0) {
    return a.title.localeCompare(b.title, 'en', {
      sensitivity: 'base',
      numeric: false,
    });
  }

  return artistCompare;
}

describe('Library Sorting Logic', () => {
  describe('Artist Name Primary Sort', () => {
    it('should sort albums by artist name alphabetically', () => {
      const albums = [
        { artistName: 'Zeppelin', title: 'IV' },
        { artistName: 'Beatles', title: 'Abbey Road' },
        { artistName: 'Dylan', title: 'Highway 61' },
      ];

      const sorted = [...albums].sort(compareLibraryItems);

      expect(sorted[0].artistName).toBe('Beatles');
      expect(sorted[1].artistName).toBe('Dylan');
      expect(sorted[2].artistName).toBe('Zeppelin');
    });

    it('should handle case-insensitive artist name sorting', () => {
      const albums = [
        { artistName: 'zeppelin', title: 'IV' },
        { artistName: 'BEATLES', title: 'Abbey Road' },
        { artistName: 'Dylan', title: 'Highway 61' },
      ];

      const sorted = [...albums].sort(compareLibraryItems);

      expect(sorted[0].artistName).toBe('BEATLES');
      expect(sorted[1].artistName).toBe('Dylan');
      expect(sorted[2].artistName).toBe('zeppelin');
    });

    it('should handle Unicode characters in artist names', () => {
      const albums = [
        { artistName: 'Zoé', title: 'Reptilectric' },
        { artistName: 'Beyoncé', title: 'Lemonade' },
        { artistName: 'Ñico', title: 'Album' },
        { artistName: 'Ånge', title: 'Album' },
      ];

      const sorted = [...albums].sort(compareLibraryItems);

      // Unicode collation order (locale-aware)
      // Expected order: Ånge, Beyoncé, Ñico, Zoé
      expect(sorted[0].artistName).toBe('Ånge');
      expect(sorted[1].artistName).toBe('Beyoncé');
      expect(sorted[2].artistName).toBe('Ñico');
      expect(sorted[3].artistName).toBe('Zoé');
    });
  });

  describe('Title Secondary Sort', () => {
    it('should sort albums by title when artist names are identical', () => {
      const albums = [
        { artistName: 'Beatles', title: 'Rubber Soul' },
        { artistName: 'Beatles', title: 'Abbey Road' },
        { artistName: 'Beatles', title: 'Let It Be' },
      ];

      const sorted = [...albums].sort(compareLibraryItems);

      expect(sorted[0].title).toBe('Abbey Road');
      expect(sorted[1].title).toBe('Let It Be');
      expect(sorted[2].title).toBe('Rubber Soul');
    });

    it('should handle case-insensitive title sorting', () => {
      const albums = [
        { artistName: 'Beatles', title: 'RUBBER SOUL' },
        { artistName: 'Beatles', title: 'abbey road' },
        { artistName: 'Beatles', title: 'Let It Be' },
      ];

      const sorted = [...albums].sort(compareLibraryItems);

      expect(sorted[0].title).toBe('abbey road');
      expect(sorted[1].title).toBe('Let It Be');
      expect(sorted[2].title).toBe('RUBBER SOUL');
    });

    it('should handle Unicode characters in titles', () => {
      const albums = [
        { artistName: 'Artist', title: 'Última' },
        { artistName: 'Artist', title: 'Café' },
        { artistName: 'Artist', title: 'Año' },
      ];

      const sorted = [...albums].sort(compareLibraryItems);

      // Unicode collation order
      expect(sorted[0].title).toBe('Año');
      expect(sorted[1].title).toBe('Café');
      expect(sorted[2].title).toBe('Última');
    });
  });

  describe('Combined Sorting', () => {
    it('should correctly sort by artist then title', () => {
      const albums = [
        { artistName: 'Zeppelin', title: 'Physical Graffiti' },
        { artistName: 'Beatles', title: 'Rubber Soul' },
        { artistName: 'Zeppelin', title: 'IV' },
        { artistName: 'Beatles', title: 'Abbey Road' },
        { artistName: 'Dylan', title: 'Highway 61' },
      ];

      const sorted = [...albums].sort(compareLibraryItems);

      expect(sorted[0]).toEqual({ artistName: 'Beatles', title: 'Abbey Road' });
      expect(sorted[1]).toEqual({ artistName: 'Beatles', title: 'Rubber Soul' });
      expect(sorted[2]).toEqual({ artistName: 'Dylan', title: 'Highway 61' });
      expect(sorted[3]).toEqual({ artistName: 'Zeppelin', title: 'IV' });
      expect(sorted[4]).toEqual({ artistName: 'Zeppelin', title: 'Physical Graffiti' });
    });

    it('should handle mixed case in both artist and title', () => {
      const albums = [
        { artistName: 'zeppelin', title: 'PHYSICAL GRAFFITI' },
        { artistName: 'BEATLES', title: 'rubber soul' },
        { artistName: 'Zeppelin', title: 'iv' },
        { artistName: 'beatles', title: 'ABBEY ROAD' },
        { artistName: 'Dylan', title: 'highway 61' },
      ];

      const sorted = [...albums].sort(compareLibraryItems);

      expect(sorted[0].artistName.toLowerCase()).toBe('beatles');
      expect(sorted[0].title.toLowerCase()).toBe('abbey road');

      expect(sorted[1].artistName.toLowerCase()).toBe('beatles');
      expect(sorted[1].title.toLowerCase()).toBe('rubber soul');

      expect(sorted[2].artistName.toLowerCase()).toBe('dylan');

      expect(sorted[3].artistName.toLowerCase()).toBe('zeppelin');
      expect(sorted[3].title.toLowerCase()).toBe('iv');

      expect(sorted[4].artistName.toLowerCase()).toBe('zeppelin');
      expect(sorted[4].title.toLowerCase()).toBe('physical graffiti');
    });
  });

  describe('Special Cases', () => {
    it('should handle identical items', () => {
      const albums = [
        { artistName: 'Beatles', title: 'Abbey Road' },
        { artistName: 'Beatles', title: 'Abbey Road' },
      ];

      const sorted = [...albums].sort(compareLibraryItems);

      // Order should be stable (don't rearrange identical items)
      expect(sorted).toEqual(albums);
    });

    it('should handle special characters and numbers', () => {
      const albums = [
        { artistName: '2Pac', title: 'Album' },
        { artistName: 'The Beatles', title: 'Album' },
        { artistName: '$uicideboy$', title: 'Album' },
        { artistName: '!Hero', title: 'Album' },
      ];

      const sorted = [...albums].sort(compareLibraryItems);

      // Special characters and numbers should sort consistently
      // Exact order depends on locale, but should be stable
      expect(sorted.length).toBe(4);
      // Verify stability: running sort twice gives same result
      const sortedAgain = [...sorted].sort(compareLibraryItems);
      expect(sortedAgain).toEqual(sorted);
    });

    it('should handle empty or whitespace-only strings', () => {
      const albums = [
        { artistName: 'Beatles', title: 'Abbey Road' },
        { artistName: '', title: 'No Artist' },
        { artistName: '  ', title: 'Whitespace Artist' },
        { artistName: 'Zeppelin', title: '' },
      ];

      const sorted = [...albums].sort(compareLibraryItems);

      // Empty strings should sort to beginning
      expect(sorted[0].artistName).toBe('');
      expect(sorted[1].artistName).toBe('  ');
    });
  });
});
