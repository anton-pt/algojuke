import { describe, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing';
import { SearchPage } from '../../src/pages/SearchPage';
import { SEARCH_QUERY } from '../../src/graphql/queries';

describe('No Results Flow Integration Tests', () => {
  test('displays no results message for non-existent query', async () => {
    const user = userEvent.setup();

    const emptyMocks = [
      {
        request: {
          query: SEARCH_QUERY,
          variables: {
            query: 'xyznotarealband123',
            limit: 20,
          },
        },
        result: {
          data: {
            search: {
              albums: [],
              tracks: [],
              total: { albums: 0, tracks: 0 },
              query: 'xyznotarealband123',
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

    // User enters a search query that won't return results
    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, 'xyznotarealband123');

    const searchButton = screen.getByRole('button', { name: /search/i });
    await user.click(searchButton);

    // User sees loading state
    expect(screen.getByText(/searching/i)).toBeInTheDocument();

    // User sees no results message
    await waitFor(() => {
      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });
  });

  test('shows helpful suggestions when no results found', async () => {
    const user = userEvent.setup();

    const emptyMocks = [
      {
        request: {
          query: SEARCH_QUERY,
          variables: {
            query: 'qwerty',
            limit: 20,
          },
        },
        result: {
          data: {
            search: {
              albums: [],
              tracks: [],
              total: { albums: 0, tracks: 0 },
              query: 'qwerty',
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
    await user.type(searchInput, 'qwerty');

    const searchButton = screen.getByRole('button', { name: /search/i });
    await user.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText(/try different search terms/i)).toBeInTheDocument();
    });
  });

  test('does not show album or track sections when no results', async () => {
    const user = userEvent.setup();

    const emptyMocks = [
      {
        request: {
          query: SEARCH_QUERY,
          variables: {
            query: 'empty',
            limit: 20,
          },
        },
        result: {
          data: {
            search: {
              albums: [],
              tracks: [],
              total: { albums: 0, tracks: 0 },
              query: 'empty',
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
    await user.type(searchInput, 'empty');

    const searchButton = screen.getByRole('button', { name: /search/i });
    await user.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });

    // Should not show Albums or Tracks sections
    expect(screen.queryByText(/Albums \(/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tracks \(/i)).not.toBeInTheDocument();
  });

  test('allows user to search again after no results', async () => {
    const user = userEvent.setup();

    const mocks = [
      {
        request: {
          query: SEARCH_QUERY,
          variables: {
            query: 'noresults',
            limit: 20,
          },
        },
        result: {
          data: {
            search: {
              albums: [],
              tracks: [],
              total: { albums: 0, tracks: 0 },
              query: 'noresults',
              cached: false,
              timestamp: Date.now(),
            },
          },
        },
      },
      {
        request: {
          query: SEARCH_QUERY,
          variables: {
            query: 'Beatles',
            limit: 20,
          },
        },
        result: {
          data: {
            search: {
              albums: [
                {
                  id: '123',
                  title: 'Abbey Road',
                  artist: 'The Beatles',
                  artists: ['The Beatles'],
                  artworkUrl: 'https://test.com/art.jpg',
                  artworkThumbUrl: 'https://test.com/thumb.jpg',
                  explicit: false,
                  trackCount: 17,
                  duration: 2800,
                  releaseDate: '1969-09-26',
                  externalUrl: 'https://tidal.com/album/123',
                  source: 'tidal',
                },
              ],
              tracks: [],
              total: { albums: 150, tracks: 0 },
              query: 'Beatles',
              cached: false,
              timestamp: Date.now(),
            },
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <SearchPage />
      </MockedProvider>
    );

    // First search with no results
    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.clear(searchInput);
    await user.type(searchInput, 'noresults');
    await user.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });

    // Second search with results
    await user.clear(searchInput);
    await user.type(searchInput, 'Beatles');
    await user.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText('Abbey Road')).toBeInTheDocument();
    });

    // No results message should be gone
    expect(screen.queryByText(/no results found/i)).not.toBeInTheDocument();
  });

  test('displays query that returned no results', async () => {
    const user = userEvent.setup();

    const emptyMocks = [
      {
        request: {
          query: SEARCH_QUERY,
          variables: {
            query: 'specificquery',
            limit: 20,
          },
        },
        result: {
          data: {
            search: {
              albums: [],
              tracks: [],
              total: { albums: 0, tracks: 0 },
              query: 'specificquery',
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
    await user.type(searchInput, 'specificquery');

    const searchButton = screen.getByRole('button', { name: /search/i });
    await user.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText(/specificquery/i)).toBeInTheDocument();
    });
  });

  test('no results message is accessible', async () => {
    const user = userEvent.setup();

    const emptyMocks = [
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
              albums: [],
              tracks: [],
              total: { albums: 0, tracks: 0 },
              query: 'test',
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
    await user.type(searchInput, 'test');
    await user.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      const message = screen.getByRole('status');
      expect(message).toBeInTheDocument();
    });
  });

  test('handles rapid searches with no results', async () => {
    const user = userEvent.setup();

    const emptyMocks = [
      {
        request: {
          query: SEARCH_QUERY,
          variables: {
            query: 'query1',
            limit: 20,
          },
        },
        result: {
          data: {
            search: {
              albums: [],
              tracks: [],
              total: { albums: 0, tracks: 0 },
              query: 'query1',
              cached: false,
              timestamp: Date.now(),
            },
          },
        },
      },
      {
        request: {
          query: SEARCH_QUERY,
          variables: {
            query: 'query2',
            limit: 20,
          },
        },
        result: {
          data: {
            search: {
              albums: [],
              tracks: [],
              total: { albums: 0, tracks: 0 },
              query: 'query2',
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

    // First search
    await user.type(searchInput, 'query1');
    await user.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });

    // Second search
    await user.clear(searchInput);
    await user.type(searchInput, 'query2');
    await user.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });
  });
});
