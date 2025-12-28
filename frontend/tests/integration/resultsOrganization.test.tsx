import { describe, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing';
import { SearchPage } from '../../src/pages/SearchPage';
import { SEARCH_QUERY } from '../../src/graphql/queries';

describe('Results Organization Integration Tests', () => {
  test('broad search shows albums and tracks in separate sections', async () => {
    const user = userEvent.setup();

    const mockResults = {
      search: {
        albums: [
          {
            id: '1',
            title: 'Rock Album 1',
            artist: 'Rock Artist 1',
            artists: ['Rock Artist 1'],
            artworkUrl: 'https://test.com/art1.jpg',
            artworkThumbUrl: 'https://test.com/thumb1.jpg',
            explicit: false,
            trackCount: 12,
            duration: 2800,
            releaseDate: '2020-01-01',
            externalUrl: 'https://tidal.com/album/1',
            source: 'tidal',
          },
          {
            id: '2',
            title: 'Rock Album 2',
            artist: 'Rock Artist 2',
            artists: ['Rock Artist 2'],
            artworkUrl: 'https://test.com/art2.jpg',
            artworkThumbUrl: 'https://test.com/thumb2.jpg',
            explicit: false,
            trackCount: 10,
            duration: 2400,
            releaseDate: '2021-01-01',
            externalUrl: 'https://tidal.com/album/2',
            source: 'tidal',
          },
        ],
        tracks: [
          {
            id: '10',
            title: 'Rock Track 1',
            artist: 'Rock Artist 1',
            artists: ['Rock Artist 1'],
            albumTitle: 'Rock Album 1',
            albumId: '1',
            artworkUrl: 'https://test.com/art1.jpg',
            artworkThumbUrl: 'https://test.com/thumb1.jpg',
            explicit: false,
            duration: 240,
            externalUrl: 'https://tidal.com/track/10',
            source: 'tidal',
          },
          {
            id: '20',
            title: 'Rock Track 2',
            artist: 'Rock Artist 2',
            artists: ['Rock Artist 2'],
            albumTitle: 'Rock Album 2',
            albumId: '2',
            artworkUrl: 'https://test.com/art2.jpg',
            artworkThumbUrl: 'https://test.com/thumb2.jpg',
            explicit: false,
            duration: 220,
            externalUrl: 'https://tidal.com/track/20',
            source: 'tidal',
          },
        ],
        total: {
          albums: 500,
          tracks: 5000,
        },
        query: 'rock',
        cached: false,
        timestamp: Date.now(),
      },
    };

    const mocks = [
      {
        request: {
          query: SEARCH_QUERY,
          variables: {
            query: 'rock',
            limit: 20,
          },
        },
        result: {
          data: mockResults,
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <SearchPage />
      </MockedProvider>
    );

    // User searches for "rock"
    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, 'rock');

    const searchButton = screen.getByRole('button', { name: /search/i });
    await user.click(searchButton);

    // Wait for results
    await waitFor(() => {
      expect(screen.getByText('Rock Album 1')).toBeInTheDocument();
    });

    // Verify Albums section exists with heading
    expect(screen.getByRole('heading', { name: /albums \(500\)/i })).toBeInTheDocument();

    // Verify Tracks section exists with heading
    expect(screen.getByRole('heading', { name: /tracks \(5000\)/i })).toBeInTheDocument();

    // Verify albums are displayed
    expect(screen.getByText('Rock Album 1')).toBeInTheDocument();
    expect(screen.getByText('Rock Album 2')).toBeInTheDocument();

    // Verify tracks are displayed
    expect(screen.getByText('Rock Track 1')).toBeInTheDocument();
    expect(screen.getByText('Rock Track 2')).toBeInTheDocument();
  });

  test('sections show correct result counts', async () => {
    const user = userEvent.setup();

    const mockResults = {
      search: {
        albums: [
          {
            id: '1',
            title: 'Album',
            artist: 'Artist',
            artists: ['Artist'],
            artworkUrl: 'https://test.com/art.jpg',
            artworkThumbUrl: 'https://test.com/thumb.jpg',
            explicit: false,
            trackCount: 10,
            duration: 2000,
            releaseDate: '2020-01-01',
            externalUrl: 'https://tidal.com/album/1',
            source: 'tidal',
          },
        ],
        tracks: [
          {
            id: '10',
            title: 'Track',
            artist: 'Artist',
            artists: ['Artist'],
            albumTitle: 'Album',
            albumId: '1',
            artworkUrl: 'https://test.com/art.jpg',
            artworkThumbUrl: 'https://test.com/thumb.jpg',
            explicit: false,
            duration: 200,
            externalUrl: 'https://tidal.com/track/10',
            source: 'tidal',
          },
        ],
        total: {
          albums: 250,
          tracks: 3000,
        },
        query: 'test',
        cached: false,
        timestamp: Date.now(),
      },
    };

    const mocks = [
      {
        request: {
          query: SEARCH_QUERY,
          variables: { query: 'test', limit: 20 },
        },
        result: { data: mockResults },
      },
    ];

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <SearchPage />
      </MockedProvider>
    );

    await user.type(screen.getByPlaceholderText(/search/i), 'test');
    await user.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /albums \(250\)/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /tracks \(3000\)/i })).toBeInTheDocument();
    });
  });

  test('shows only albums section when query returns no tracks', async () => {
    const user = userEvent.setup();

    const mockResults = {
      search: {
        albums: [
          {
            id: '1',
            title: 'Album Only',
            artist: 'Artist',
            artists: ['Artist'],
            artworkUrl: 'https://test.com/art.jpg',
            artworkThumbUrl: 'https://test.com/thumb.jpg',
            explicit: false,
            trackCount: 10,
            duration: 2000,
            releaseDate: '2020-01-01',
            externalUrl: 'https://tidal.com/album/1',
            source: 'tidal',
          },
        ],
        tracks: [],
        total: { albums: 100, tracks: 0 },
        query: 'album',
        cached: false,
        timestamp: Date.now(),
      },
    };

    const mocks = [
      {
        request: {
          query: SEARCH_QUERY,
          variables: { query: 'album', limit: 20 },
        },
        result: { data: mockResults },
      },
    ];

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <SearchPage />
      </MockedProvider>
    );

    await user.type(screen.getByPlaceholderText(/search/i), 'album');
    await user.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /albums/i })).toBeInTheDocument();
    });

    // Tracks section should not be visible
    expect(screen.queryByRole('heading', { name: /^tracks/i })).not.toBeInTheDocument();

    // Album should be visible
    expect(screen.getByText('Album Only')).toBeInTheDocument();
  });

  test('shows only tracks section when query returns no albums', async () => {
    const user = userEvent.setup();

    const mockResults = {
      search: {
        albums: [],
        tracks: [
          {
            id: '10',
            title: 'Track Only',
            artist: 'Artist',
            artists: ['Artist'],
            albumTitle: 'Some Album',
            albumId: '999',
            artworkUrl: 'https://test.com/art.jpg',
            artworkThumbUrl: 'https://test.com/thumb.jpg',
            explicit: false,
            duration: 200,
            externalUrl: 'https://tidal.com/track/10',
            source: 'tidal',
          },
        ],
        total: { albums: 0, tracks: 1500 },
        query: 'track',
        cached: false,
        timestamp: Date.now(),
      },
    };

    const mocks = [
      {
        request: {
          query: SEARCH_QUERY,
          variables: { query: 'track', limit: 20 },
        },
        result: { data: mockResults },
      },
    ];

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <SearchPage />
      </MockedProvider>
    );

    await user.type(screen.getByPlaceholderText(/search/i), 'track');
    await user.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /tracks/i })).toBeInTheDocument();
    });

    // Albums section should not be visible
    expect(screen.queryByRole('heading', { name: /^albums/i })).not.toBeInTheDocument();

    // Track should be visible
    expect(screen.getByText('Track Only')).toBeInTheDocument();
  });

  test('sections remain organized after multiple searches', async () => {
    const user = userEvent.setup();

    const firstResults = {
      search: {
        albums: [
          {
            id: '1',
            title: 'First Album',
            artist: 'Artist 1',
            artists: ['Artist 1'],
            artworkUrl: 'https://test.com/art1.jpg',
            artworkThumbUrl: 'https://test.com/thumb1.jpg',
            explicit: false,
            trackCount: 10,
            duration: 2000,
            releaseDate: '2020-01-01',
            externalUrl: 'https://tidal.com/album/1',
            source: 'tidal',
          },
        ],
        tracks: [
          {
            id: '10',
            title: 'First Track',
            artist: 'Artist 1',
            artists: ['Artist 1'],
            albumTitle: 'First Album',
            albumId: '1',
            artworkUrl: 'https://test.com/art1.jpg',
            artworkThumbUrl: 'https://test.com/thumb1.jpg',
            explicit: false,
            duration: 200,
            externalUrl: 'https://tidal.com/track/10',
            source: 'tidal',
          },
        ],
        total: { albums: 100, tracks: 500 },
        query: 'first',
        cached: false,
        timestamp: Date.now(),
      },
    };

    const secondResults = {
      search: {
        albums: [
          {
            id: '2',
            title: 'Second Album',
            artist: 'Artist 2',
            artists: ['Artist 2'],
            artworkUrl: 'https://test.com/art2.jpg',
            artworkThumbUrl: 'https://test.com/thumb2.jpg',
            explicit: false,
            trackCount: 12,
            duration: 2400,
            releaseDate: '2021-01-01',
            externalUrl: 'https://tidal.com/album/2',
            source: 'tidal',
          },
        ],
        tracks: [
          {
            id: '20',
            title: 'Second Track',
            artist: 'Artist 2',
            artists: ['Artist 2'],
            albumTitle: 'Second Album',
            albumId: '2',
            artworkUrl: 'https://test.com/art2.jpg',
            artworkThumbUrl: 'https://test.com/thumb2.jpg',
            explicit: false,
            duration: 220,
            externalUrl: 'https://tidal.com/track/20',
            source: 'tidal',
          },
        ],
        total: { albums: 200, tracks: 1000 },
        query: 'second',
        cached: false,
        timestamp: Date.now(),
      },
    };

    const mocks = [
      {
        request: {
          query: SEARCH_QUERY,
          variables: { query: 'first', limit: 20 },
        },
        result: { data: firstResults },
      },
      {
        request: {
          query: SEARCH_QUERY,
          variables: { query: 'second', limit: 20 },
        },
        result: { data: secondResults },
      },
    ];

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <SearchPage />
      </MockedProvider>
    );

    const searchInput = screen.getByPlaceholderText(/search/i);
    const searchButton = screen.getByRole('button', { name: /search/i });

    // First search
    await user.type(searchInput, 'first');
    await user.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText('First Album')).toBeInTheDocument();
      expect(screen.getByText('First Track')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: /albums \(100\)/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /tracks \(500\)/i })).toBeInTheDocument();

    // Second search
    await user.clear(searchInput);
    await user.type(searchInput, 'second');
    await user.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText('Second Album')).toBeInTheDocument();
      expect(screen.getByText('Second Track')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: /albums \(200\)/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /tracks \(1000\)/i })).toBeInTheDocument();

    // First results should be replaced
    expect(screen.queryByText('First Album')).not.toBeInTheDocument();
    expect(screen.queryByText('First Track')).not.toBeInTheDocument();
  });

  test('visual layout is appropriate for organized display', async () => {
    const user = userEvent.setup();

    const mockResults = {
      search: {
        albums: [
          {
            id: '1',
            title: 'Album',
            artist: 'Artist',
            artists: ['Artist'],
            artworkUrl: 'https://test.com/art.jpg',
            artworkThumbUrl: 'https://test.com/thumb.jpg',
            explicit: false,
            trackCount: 10,
            duration: 2000,
            releaseDate: '2020-01-01',
            externalUrl: 'https://tidal.com/album/1',
            source: 'tidal',
          },
        ],
        tracks: [
          {
            id: '10',
            title: 'Track',
            artist: 'Artist',
            artists: ['Artist'],
            albumTitle: 'Album',
            albumId: '1',
            artworkUrl: 'https://test.com/art.jpg',
            artworkThumbUrl: 'https://test.com/thumb.jpg',
            explicit: false,
            duration: 200,
            externalUrl: 'https://tidal.com/track/10',
            source: 'tidal',
          },
        ],
        total: { albums: 100, tracks: 500 },
        query: 'test',
        cached: false,
        timestamp: Date.now(),
      },
    };

    const mocks = [
      {
        request: {
          query: SEARCH_QUERY,
          variables: { query: 'test', limit: 20 },
        },
        result: { data: mockResults },
      },
    ];

    const { container } = render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <SearchPage />
      </MockedProvider>
    );

    await user.type(screen.getByPlaceholderText(/search/i), 'test');
    await user.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText('Album')).toBeInTheDocument();
    });

    // Verify grid layout for albums
    const albumsGrid = container.querySelector('.albums-grid');
    expect(albumsGrid).toBeInTheDocument();

    // Verify list layout for tracks
    const tracksList = container.querySelector('.tracks-list');
    expect(tracksList).toBeInTheDocument();
  });
});
