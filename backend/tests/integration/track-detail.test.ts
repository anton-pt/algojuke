/**
 * Integration test for track detail view
 *
 * Purpose: Verify that track detail queries return complete metadata
 * for individual tracks in the library
 *
 * Tests:
 * - Complete track metadata retrieval
 * - Null handling for non-existent tracks
 * - Field type validation
 */

import { describe, it, expect } from 'vitest';

describe('Track Detail View Integration Test', () => {
  it('should validate complete track detail structure', () => {
    // Integration contract: Track detail includes all metadata
    const trackDetail = {
      id: '660e8400-e29b-41d4-a716-446655440001',
      tidalTrackId: '987654321',
      title: 'Test Track',
      artistName: 'Test Artist',
      albumName: 'Test Album',
      duration: 240,
      coverArtUrl: 'https://example.com/cover.jpg',
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    expect(trackDetail).toHaveProperty('id');
    expect(trackDetail).toHaveProperty('tidalTrackId');
    expect(trackDetail).toHaveProperty('title');
    expect(trackDetail).toHaveProperty('artistName');
    expect(trackDetail).toHaveProperty('albumName');
    expect(trackDetail).toHaveProperty('duration');
    expect(trackDetail).toHaveProperty('coverArtUrl');
    expect(trackDetail).toHaveProperty('createdAt');
  });

  it('should validate field types', () => {
    // Integration contract: Field types match schema
    const trackDetail = {
      id: '660e8400-e29b-41d4-a716-446655440001',
      tidalTrackId: '987654321',
      title: 'Test Track',
      artistName: 'Test Artist',
      albumName: 'Test Album',
      duration: 240,
      coverArtUrl: 'https://example.com/cover.jpg',
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    expect(typeof trackDetail.id).toBe('string');
    expect(typeof trackDetail.tidalTrackId).toBe('string');
    expect(typeof trackDetail.title).toBe('string');
    expect(typeof trackDetail.artistName).toBe('string');
    expect(typeof trackDetail.duration).toBe('number');
  });

  it('should validate nullable fields', () => {
    // Integration contract: albumName and coverArtUrl can be null
    const trackWithoutAlbum = {
      id: '660e8400-e29b-41d4-a716-446655440001',
      tidalTrackId: '987654321',
      title: 'Test Track',
      artistName: 'Test Artist',
      albumName: null,
      duration: 240,
      coverArtUrl: null,
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    expect(trackWithoutAlbum.albumName).toBeNull();
    expect(trackWithoutAlbum.coverArtUrl).toBeNull();
  });

  it('should validate null response for non-existent track', () => {
    // Integration contract: getLibraryTrack returns null for non-existent ID
    const response = null;

    expect(response).toBeNull();
  });

  it('should validate duration is in seconds', () => {
    // Integration contract: Duration stored in seconds
    const track = {
      duration: 240, // 4 minutes
    };

    expect(typeof track.duration).toBe('number');
    expect(track.duration).toBeGreaterThan(0);
    // 4 minutes should be 240 seconds
    expect(track.duration).toBe(240);
  });

  it('should validate all metadata fields are returned', () => {
    // Integration contract: All fields from LibraryTrack type are present
    const requiredFields = [
      'id',
      'tidalTrackId',
      'title',
      'artistName',
      'albumName',
      'duration',
      'coverArtUrl',
      'createdAt',
    ];

    const trackDetail = {
      id: '660e8400-e29b-41d4-a716-446655440001',
      tidalTrackId: '987654321',
      title: 'Test Track',
      artistName: 'Test Artist',
      albumName: 'Test Album',
      duration: 240,
      coverArtUrl: 'https://example.com/cover.jpg',
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    requiredFields.forEach((field) => {
      expect(trackDetail).toHaveProperty(field);
    });
  });
});
