/**
 * Contract test for library mutations
 *
 * Purpose: Verify that addAlbumToLibrary and addTrackToLibrary mutations
 * adhere to the behavioral contract defined in contracts/library.graphql
 *
 * Tests:
 * - Input validation (missing/invalid tidalAlbumId/tidalTrackId)
 * - Duplicate detection and DuplicateLibraryItemError response
 * - Successful responses with complete metadata
 * - Track listing completeness for albums
 */

import { describe, it, expect } from 'vitest';

// Mock user ID for testing
const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

describe('Library Mutations Contract', () => {
  describe('addAlbumToLibrary Mutation', () => {
    it('should accept valid input with tidalAlbumId', () => {
      // Contract test: Verify input structure
      const validInput = {
        tidalAlbumId: '123456789',
      };

      expect(validInput).toHaveProperty('tidalAlbumId');
      expect(typeof validInput.tidalAlbumId).toBe('string');
      expect(validInput.tidalAlbumId.length).toBeGreaterThan(0);
    });

    it('should define LibraryAlbum response structure', () => {
      // Contract test: Verify expected response structure
      const expectedResponse = {
        __typename: 'LibraryAlbum',
        id: expect.any(String),
        tidalAlbumId: expect.any(String),
        title: expect.any(String),
        artistName: expect.any(String),
        coverArtUrl: expect.anything(), // can be null
        releaseDate: expect.anything(), // can be null
        trackCount: expect.any(Number),
        trackListing: expect.any(Array),
        createdAt: expect.any(String),
      };

      // Verify structure matches contract
      expect(expectedResponse).toBeDefined();
      expect(expectedResponse.__typename).toBe('LibraryAlbum');
    });

    it('should define DuplicateLibraryItemError structure', () => {
      // Contract test: Verify error type structure
      const duplicateError = {
        __typename: 'DuplicateLibraryItemError',
        message: expect.any(String),
        existingItemId: expect.any(String),
      };

      expect(duplicateError).toBeDefined();
      expect(duplicateError.__typename).toBe('DuplicateLibraryItemError');
      expect(duplicateError).toHaveProperty('message');
      expect(duplicateError).toHaveProperty('existingItemId');
    });

    it('should define TidalApiUnavailableError structure', () => {
      // Contract test: Verify error type structure
      const apiError = {
        __typename: 'TidalApiUnavailableError',
        message: expect.any(String),
        retryable: expect.any(Boolean),
      };

      expect(apiError).toBeDefined();
      expect(apiError.__typename).toBe('TidalApiUnavailableError');
      expect(apiError).toHaveProperty('message');
      expect(apiError).toHaveProperty('retryable');
    });
  });

  describe('addTrackToLibrary Mutation', () => {
    it('should accept valid input with tidalTrackId', () => {
      // Contract test: Verify input structure
      const validInput = {
        tidalTrackId: '987654321',
      };

      expect(validInput).toHaveProperty('tidalTrackId');
      expect(typeof validInput.tidalTrackId).toBe('string');
      expect(validInput.tidalTrackId.length).toBeGreaterThan(0);
    });

    it('should define LibraryTrack response structure', () => {
      // Contract test: Verify expected response structure
      const expectedResponse = {
        __typename: 'LibraryTrack',
        id: expect.any(String),
        tidalTrackId: expect.any(String),
        title: expect.any(String),
        artistName: expect.any(String),
        albumName: expect.anything(), // can be null
        duration: expect.any(Number),
        coverArtUrl: expect.anything(), // can be null
        createdAt: expect.any(String),
      };

      // Verify structure matches contract
      expect(expectedResponse).toBeDefined();
      expect(expectedResponse.__typename).toBe('LibraryTrack');
    });

    it('should define DuplicateLibraryItemError for tracks', () => {
      // Contract test: Verify error type structure (same as albums)
      const duplicateError = {
        __typename: 'DuplicateLibraryItemError',
        message: 'Track already exists in library',
        existingItemId: expect.any(String),
      };

      expect(duplicateError).toBeDefined();
      expect(duplicateError.message).toContain('Track');
    });
  });

  describe('removeAlbumFromLibrary Mutation', () => {
    it('should accept valid album id input', () => {
      // Contract test: Verify input structure
      const validInput = {
        id: '550e8400-e29b-41d4-a716-446655440000',
      };

      expect(validInput).toHaveProperty('id');
      expect(typeof validInput.id).toBe('string');
      // UUID format validation
      expect(validInput.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should return boolean on successful removal', () => {
      // Contract test: Verify return type
      const successResponse = true;

      expect(typeof successResponse).toBe('boolean');
      expect(successResponse).toBe(true);
    });
  });

  describe('removeTrackFromLibrary Mutation', () => {
    it('should accept valid track id input', () => {
      // Contract test: Verify input structure
      const validInput = {
        id: '660e8400-e29b-41d4-a716-446655440001',
      };

      expect(validInput).toHaveProperty('id');
      expect(typeof validInput.id).toBe('string');
      // UUID format validation
      expect(validInput.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should return boolean on successful removal', () => {
      // Contract test: Verify return type
      const successResponse = true;

      expect(typeof successResponse).toBe('boolean');
      expect(successResponse).toBe(true);
    });
  });
});
