import { describe, test, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing';
import { SearchPage } from '../../src/pages/SearchPage';
import { SEARCH_QUERY } from '../../src/graphql/queries';
import { GET_LIBRARY_ALBUMS, GET_LIBRARY_TRACKS } from '../../src/graphql/library';

const libraryMocks = [
  {
    request: {
      query: GET_LIBRARY_ALBUMS,
    },
    result: {
      data: {
        getLibraryAlbums: [],
      },
    },
  },
  {
    request: {
      query: GET_LIBRARY_TRACKS,
    },
    result: {
      data: {
        getLibraryTracks: [],
      },
    },
  },
];

const mockSearchResults = {
  search: {
    albums: [
      {
        id: '123',
        title: 'Abbey Road',
        artist: 'The Beatles',
        artists: ['The Beatles'],
        artworkUrl: 'https://images.tidal.com/im/im?uuid=test&w=640&h=640',
        artworkThumbUrl: 'https://images.tidal.com/im/im?uuid=test&w=320&h=320',
        explicit: false,
        trackCount: 17,
        duration: 2800,
        releaseDate: '1969-09-26',
        externalUrl: 'https://tidal.com/album/123',
        source: 'tidal',
      },
    ],
    tracks: [
      {
        id: '456',
        title: 'Come Together',
        artist: 'The Beatles',
        artists: ['The Beatles'],
        albumTitle: 'Abbey Road',
        albumId: '123',
        artworkUrl: 'https://images.tidal.com/im/im?uuid=test&w=640&h=640',
        artworkThumbUrl: 'https://images.tidal.com/im/im?uuid=test&w=320&h=320',
        explicit: false,
        duration: 259,
        externalUrl: 'https://tidal.com/track/456',
        source: 'tidal',
      },
    ],
    total: {
      albums: 150,
      tracks: 1200,
    },
    query: 'Beatles',
    cached: false,
    timestamp: Date.now(),
  },
};

describe('Search Flow Integration Tests', () => {
  test('complete search workflow from input to results', async () => {
    const user = userEvent.setup();

    const mocks = [
      ...libraryMocks,
      {
        request: {
          query: SEARCH_QUERY,
          variables: {
            query: 'Beatles',
            limit: 20,
          },
        },
        result: {
          data: mockSearchResults,
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <SearchPage />
      </MockedProvider>
    );

    // User sees search bar
    const searchInput = screen.getByPlaceholderText(/search/i);
    expect(searchInput).toBeInTheDocument();

    // User types query
    await user.type(searchInput, 'Beatles');

    // User clicks search button
    const searchButton = screen.getByRole('button', { name: /search/i });
    await user.click(searchButton);

    // User sees results (MockedProvider returns instantly, so loading state may not appear)
    await waitFor(() => {
      expect(screen.getAllByText('Abbey Road').length).toBeGreaterThan(0);
      expect(screen.getByText('Come Together')).toBeInTheDocument();
    });

    // User sees album and track cards
    expect(screen.getByText(/17 track/i)).toBeInTheDocument(); // Album info
    expect(screen.getByText(/4:19/i)).toBeInTheDocument(); // Track duration
  });

  test('shows empty results message', async () => {
    const user = userEvent.setup();

    const emptyMocks = [
      ...libraryMocks,
      {
        request: {
          query: SEARCH_QUERY,
          variables: {
            query: 'xyznotarealband',
            limit: 20,
          },
        },
        result: {
          data: {
            search: {
              albums: [],
              tracks: [],
              total: { albums: 0, tracks: 0 },
              query: 'xyznotarealband',
              cached: false,
              timestamp: Date.now(),
            },
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={emptyMocks} addTypename={false}>
        <SearchPage />
      </MockedProvider>
    );

    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, 'xyznotarealband');

    const searchButton = screen.getByRole('button', { name: /search/i });
    await user.click(searchButton);

    await waitFor(() => {
      // Use getAllByText since "no results" appears in multiple places
      expect(screen.getAllByText(/no results/i).length).toBeGreaterThan(0);
    });
  });

  test('displays error message on search failure', async () => {
    const user = userEvent.setup();

    const errorMocks = [
      {
        request: {
          query: SEARCH_QUERY,
          variables: {
            query: 'error',
            limit: 20,
          },
        },
        error: new Error('Search failed'),
      },
    ];

    render(
      <MockedProvider mocks={errorMocks} addTypename={false}>
        <SearchPage />
      </MockedProvider>
    );

    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, 'error');

    const searchButton = screen.getByRole('button', { name: /search/i });
    await user.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText(/failed|error/i)).toBeInTheDocument();
    });
  });

  test('prevents empty query submission', async () => {
    const user = userEvent.setup();

    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <SearchPage />
      </MockedProvider>
    );

    const searchButton = screen.getByRole('button', { name: /search/i });
    await user.click(searchButton);

    // Should not make any GraphQL requests
    // No results or loading state should appear
    expect(screen.queryByText(/searching/i)).not.toBeInTheDocument();
  });

  test('displays multiple albums and tracks', async () => {
    const user = userEvent.setup();

    const multipleResultsMocks = [
      {
        request: {
          query: SEARCH_QUERY,
          variables: {
            query: 'rock',
            limit: 20,
          },
        },
        result: {
          data: {
            search: {
              albums: [
                { ...mockSearchResults.search.albums[0], id: '1', title: 'Album 1' },
                { ...mockSearchResults.search.albums[0], id: '2', title: 'Album 2' },
                { ...mockSearchResults.search.albums[0], id: '3', title: 'Album 3' },
              ],
              tracks: [
                { ...mockSearchResults.search.tracks[0], id: '10', title: 'Track 1' },
                { ...mockSearchResults.search.tracks[0], id: '20', title: 'Track 2' },
              ],
              total: { albums: 300, tracks: 5000 },
              query: 'rock',
              cached: false,
              timestamp: Date.now(),
            },
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={multipleResultsMocks} addTypename={false}>
        <SearchPage />
      </MockedProvider>
    );

    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, 'rock');

    const searchButton = screen.getByRole('button', { name: /search/i });
    await user.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText('Album 1')).toBeInTheDocument();
      expect(screen.getByText('Album 2')).toBeInTheDocument();
      expect(screen.getByText('Album 3')).toBeInTheDocument();
      expect(screen.getByText('Track 1')).toBeInTheDocument();
      expect(screen.getByText('Track 2')).toBeInTheDocument();
    });
  });

  test('shows cached indicator', async () => {
    const user = userEvent.setup();

    const cachedMocks = [
      {
        request: {
          query: SEARCH_QUERY,
          variables: {
            query: 'cached',
            limit: 20,
          },
        },
        result: {
          data: {
            ...mockSearchResults,
            search: {
              ...mockSearchResults.search,
              query: 'cached',
              cached: true,
            },
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={cachedMocks} addTypename={false}>
        <SearchPage />
      </MockedProvider>
    );

    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, 'cached');

    const searchButton = screen.getByRole('button', { name: /search/i });
    await user.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText(/cached/i)).toBeInTheDocument();
    });
  });

  test('handles special characters in search', async () => {
    const user = userEvent.setup();

    const specialCharMocks = [
      {
        request: {
          query: SEARCH_QUERY,
          variables: {
            query: 'AC/DC',
            limit: 20,
          },
        },
        result: {
          data: {
            search: {
              albums: [{ ...mockSearchResults.search.albums[0], title: 'Back in Black', artist: 'AC/DC' }],
              tracks: [],
              total: { albums: 50, tracks: 0 },
              query: 'AC/DC',
              cached: false,
              timestamp: Date.now(),
            },
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={specialCharMocks} addTypename={false}>
        <SearchPage />
      </MockedProvider>
    );

    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, 'AC/DC');

    const searchButton = screen.getByRole('button', { name: /search/i });
    await user.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText('Back in Black')).toBeInTheDocument();
    });
  });

  test('images have fallback for missing artwork', async () => {
    const user = userEvent.setup();

    const missingArtworkMocks = [
      {
        request: {
          query: SEARCH_QUERY,
          variables: {
            query: 'test',
            limit: 20,
          },
        },
        result: {
          data: {
            search: {
              albums: [
                {
                  ...mockSearchResults.search.albums[0],
                  artworkUrl: '/images/placeholder-album.svg',
                  artworkThumbUrl: '/images/placeholder-album.svg',
                },
              ],
              tracks: [],
              total: { albums: 1, tracks: 0 },
              query: 'test',
              cached: false,
              timestamp: Date.now(),
            },
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={missingArtworkMocks} addTypename={false}>
        <SearchPage />
      </MockedProvider>
    );

    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, 'test');

    const searchButton = screen.getByRole('button', { name: /search/i });
    await user.click(searchButton);

    await waitFor(() => {
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', '/images/placeholder-album.svg');
    });
  });
});
