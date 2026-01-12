/**
 * TidalSearchModal Component Tests
 *
 * Feature: ALG-76 - Move Tidal Search under Library Management
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing";
import { TidalSearchModal } from "./TidalSearchModal";
import { SEARCH_QUERY } from "../../graphql/queries";
import { GET_LIBRARY_ALBUMS, GET_LIBRARY_TRACKS } from "../../graphql/library";

describe("TidalSearchModal Component", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  const mockLibraryAlbums = {
    request: {
      query: GET_LIBRARY_ALBUMS,
    },
    result: {
      data: {
        getLibraryAlbums: [],
      },
    },
  };

  const mockLibraryTracks = {
    request: {
      query: GET_LIBRARY_TRACKS,
    },
    result: {
      data: {
        getLibraryTracks: [],
      },
    },
  };

  test("does not render when isOpen is false", () => {
    render(
      <MockedProvider mocks={[mockLibraryAlbums, mockLibraryTracks]}>
        <TidalSearchModal isOpen={false} onClose={mockOnClose} />
      </MockedProvider>,
    );

    expect(
      screen.queryByRole("dialog", { name: /search tidal catalog/i }),
    ).not.toBeInTheDocument();
  });

  test("renders modal when isOpen is true", () => {
    render(
      <MockedProvider mocks={[mockLibraryAlbums, mockLibraryTracks]}>
        <TidalSearchModal isOpen={true} onClose={mockOnClose} />
      </MockedProvider>,
    );

    expect(
      screen.getByRole("dialog", { name: /search tidal catalog/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/search for albums and tracks/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^search$/i }),
    ).toBeInTheDocument();
  });

  test("closes modal when close button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <MockedProvider mocks={[mockLibraryAlbums, mockLibraryTracks]}>
        <TidalSearchModal isOpen={true} onClose={mockOnClose} />
      </MockedProvider>,
    );

    const closeButton = screen.getByRole("button", { name: /close/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test("closes modal when overlay is clicked", async () => {
    const user = userEvent.setup();

    render(
      <MockedProvider mocks={[mockLibraryAlbums, mockLibraryTracks]}>
        <TidalSearchModal isOpen={true} onClose={mockOnClose} />
      </MockedProvider>,
    );

    const overlay = screen.getByRole("dialog").parentElement!;
    await user.click(overlay);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test("closes modal when Escape key is pressed", async () => {
    const user = userEvent.setup();

    render(
      <MockedProvider mocks={[mockLibraryAlbums, mockLibraryTracks]}>
        <TidalSearchModal isOpen={true} onClose={mockOnClose} />
      </MockedProvider>,
    );

    await user.keyboard("{Escape}");

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test("does not submit empty search query", async () => {
    const user = userEvent.setup();

    render(
      <MockedProvider mocks={[mockLibraryAlbums, mockLibraryTracks]}>
        <TidalSearchModal isOpen={true} onClose={mockOnClose} />
      </MockedProvider>,
    );

    const searchButton = screen.getByRole("button", { name: /^search$/i });
    expect(searchButton).toBeDisabled();

    await user.click(searchButton);

    // No search results should appear
    expect(
      screen.queryByRole("tab", { name: /albums/i }),
    ).not.toBeInTheDocument();
  });

  test("executes search when form is submitted with query", async () => {
    const user = userEvent.setup();

    const mockSearch = {
      request: {
        query: SEARCH_QUERY,
        variables: {
          query: "radiohead",
          limit: 20,
        },
      },
      result: {
        data: {
          search: {
            albums: [
              {
                id: "album-1",
                title: "OK Computer",
                artist: "Radiohead",
                artists: ["Radiohead"],
                artworkUrl: "https://example.com/art.jpg",
                artworkThumbUrl: "https://example.com/thumb.jpg",
                explicit: false,
                trackCount: 12,
                duration: 3200,
                releaseDate: "1997-05-21",
                externalUrl: "https://tidal.com/album/1",
                source: "tidal",
              },
            ],
            tracks: [],
            total: {
              albums: 1,
              tracks: 0,
            },
            query: "radiohead",
            cached: false,
            timestamp: Date.now(),
          },
        },
      },
    };

    render(
      <MockedProvider
        mocks={[mockLibraryAlbums, mockLibraryTracks, mockSearch]}
      >
        <TidalSearchModal isOpen={true} onClose={mockOnClose} />
      </MockedProvider>,
    );

    const input = screen.getByPlaceholderText(/search for albums and tracks/i);
    await user.type(input, "radiohead");

    const searchButton = screen.getByRole("button", { name: /^search$/i });
    await user.click(searchButton);

    // Wait for search results to appear
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /albums/i })).toBeInTheDocument();
    });

    expect(screen.getByText("OK Computer")).toBeInTheDocument();
    expect(screen.getByText("Radiohead")).toBeInTheDocument();
  });

  test("displays loading state during search", async () => {
    const user = userEvent.setup();

    const mockSearch = {
      request: {
        query: SEARCH_QUERY,
        variables: {
          query: "beatles",
          limit: 20,
        },
      },
      result: {
        data: {
          search: {
            albums: [],
            tracks: [],
            total: {
              albums: 0,
              tracks: 0,
            },
            query: "beatles",
            cached: false,
            timestamp: Date.now(),
          },
        },
      },
      delay: 1000, // Simulate network delay
    };

    render(
      <MockedProvider
        mocks={[mockLibraryAlbums, mockLibraryTracks, mockSearch]}
      >
        <TidalSearchModal isOpen={true} onClose={mockOnClose} />
      </MockedProvider>,
    );

    const input = screen.getByPlaceholderText(/search for albums and tracks/i);
    await user.type(input, "beatles");

    const searchButton = screen.getByRole("button", { name: /^search$/i });
    await user.click(searchButton);

    // Loading state should be visible (use getAllByText since it appears in both button and content)
    const loadingTexts = screen.getAllByText(/searching/i);
    expect(loadingTexts.length).toBeGreaterThan(0);

    // Search button should show "Searching..."
    expect(
      screen.getByRole("button", { name: /searching/i }),
    ).toBeInTheDocument();
  });

  test("displays no results message when search returns empty", async () => {
    const user = userEvent.setup();

    const mockSearch = {
      request: {
        query: SEARCH_QUERY,
        variables: {
          query: "xyznotarealband123",
          limit: 20,
        },
      },
      result: {
        data: {
          search: {
            albums: [],
            tracks: [],
            total: {
              albums: 0,
              tracks: 0,
            },
            query: "xyznotarealband123",
            cached: false,
            timestamp: Date.now(),
          },
        },
      },
    };

    render(
      <MockedProvider
        mocks={[mockLibraryAlbums, mockLibraryTracks, mockSearch]}
      >
        <TidalSearchModal isOpen={true} onClose={mockOnClose} />
      </MockedProvider>,
    );

    const input = screen.getByPlaceholderText(/search for albums and tracks/i);
    await user.type(input, "xyznotarealband123");

    const searchButton = screen.getByRole("button", { name: /^search$/i });
    await user.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/try different search terms/i)).toBeInTheDocument();
  });

  test("displays error message when search fails", async () => {
    const user = userEvent.setup();

    const mockSearchError = {
      request: {
        query: SEARCH_QUERY,
        variables: {
          query: "error",
          limit: 20,
        },
      },
      error: new Error("Network error"),
    };

    render(
      <MockedProvider
        mocks={[mockLibraryAlbums, mockLibraryTracks, mockSearchError]}
      >
        <TidalSearchModal isOpen={true} onClose={mockOnClose} />
      </MockedProvider>,
    );

    const input = screen.getByPlaceholderText(/search for albums and tracks/i);
    await user.type(input, "error");

    const searchButton = screen.getByRole("button", { name: /^search$/i });
    await user.click(searchButton);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  test("switches between Albums and Tracks tabs", async () => {
    const user = userEvent.setup();

    const mockSearch = {
      request: {
        query: SEARCH_QUERY,
        variables: {
          query: "test",
          limit: 20,
        },
      },
      result: {
        data: {
          search: {
            albums: [
              {
                id: "album-1",
                title: "Test Album",
                artist: "Test Artist",
                artists: ["Test Artist"],
                artworkUrl: "https://example.com/art.jpg",
                artworkThumbUrl: "https://example.com/thumb.jpg",
                explicit: false,
                trackCount: 10,
                duration: 2400,
                releaseDate: "2020-01-01",
                externalUrl: "https://tidal.com/album/1",
                source: "tidal",
              },
            ],
            tracks: [
              {
                id: "track-1",
                title: "Test Track",
                artist: "Test Artist",
                artists: ["Test Artist"],
                albumTitle: "Test Album",
                albumId: "album-1",
                artworkUrl: "https://example.com/art.jpg",
                artworkThumbUrl: "https://example.com/thumb.jpg",
                explicit: false,
                duration: 240,
                externalUrl: "https://tidal.com/track/1",
                source: "tidal",
              },
            ],
            total: {
              albums: 1,
              tracks: 1,
            },
            query: "test",
            cached: false,
            timestamp: Date.now(),
          },
        },
      },
    };

    render(
      <MockedProvider
        mocks={[mockLibraryAlbums, mockLibraryTracks, mockSearch]}
      >
        <TidalSearchModal isOpen={true} onClose={mockOnClose} />
      </MockedProvider>,
    );

    const input = screen.getByPlaceholderText(/search for albums and tracks/i);
    await user.type(input, "test");

    const searchButton = screen.getByRole("button", { name: /^search$/i });
    await user.click(searchButton);

    // Wait for tabs to appear
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /albums/i })).toBeInTheDocument();
    });

    // Albums tab should be active by default
    const albumsTab = screen.getByRole("tab", { name: /albums/i });
    expect(albumsTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Test Album")).toBeInTheDocument();

    // Switch to Tracks tab
    const tracksTab = screen.getByRole("tab", { name: /tracks/i });
    await user.click(tracksTab);

    expect(tracksTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Test Track")).toBeInTheDocument();
  });

  test("displays result counts in tab badges", async () => {
    const user = userEvent.setup();

    const mockSearch = {
      request: {
        query: SEARCH_QUERY,
        variables: {
          query: "test",
          limit: 20,
        },
      },
      result: {
        data: {
          search: {
            albums: [
              {
                id: "album-1",
                title: "Album 1",
                artist: "Artist",
                artists: ["Artist"],
                artworkUrl: "",
                artworkThumbUrl: "",
                explicit: false,
                trackCount: 10,
                duration: 2400,
                releaseDate: "2020-01-01",
                externalUrl: "",
                source: "tidal",
              },
            ],
            tracks: [
              {
                id: "track-1",
                title: "Track 1",
                artist: "Artist",
                artists: ["Artist"],
                albumTitle: "Album",
                albumId: "album-1",
                artworkUrl: "",
                artworkThumbUrl: "",
                explicit: false,
                duration: 240,
                externalUrl: "",
                source: "tidal",
              },
              {
                id: "track-2",
                title: "Track 2",
                artist: "Artist",
                artists: ["Artist"],
                albumTitle: "Album",
                albumId: "album-1",
                artworkUrl: "",
                artworkThumbUrl: "",
                explicit: false,
                duration: 240,
                externalUrl: "",
                source: "tidal",
              },
            ],
            total: {
              albums: 1,
              tracks: 2,
            },
            query: "test",
            cached: false,
            timestamp: Date.now(),
          },
        },
      },
    };

    render(
      <MockedProvider
        mocks={[mockLibraryAlbums, mockLibraryTracks, mockSearch]}
      >
        <TidalSearchModal isOpen={true} onClose={mockOnClose} />
      </MockedProvider>,
    );

    const input = screen.getByPlaceholderText(/search for albums and tracks/i);
    await user.type(input, "test");

    const searchButton = screen.getByRole("button", { name: /^search$/i });
    await user.click(searchButton);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /albums/i })).toBeInTheDocument();
    });

    // Check for result counts
    expect(screen.getByText("1")).toBeInTheDocument(); // Albums count
    expect(screen.getByText("2")).toBeInTheDocument(); // Tracks count
  });

  test("focuses search input when modal opens", () => {
    const { rerender } = render(
      <MockedProvider mocks={[mockLibraryAlbums, mockLibraryTracks]}>
        <TidalSearchModal isOpen={false} onClose={mockOnClose} />
      </MockedProvider>,
    );

    rerender(
      <MockedProvider mocks={[mockLibraryAlbums, mockLibraryTracks]}>
        <TidalSearchModal isOpen={true} onClose={mockOnClose} />
      </MockedProvider>,
    );

    const input = screen.getByPlaceholderText(/search for albums and tracks/i);
    expect(input).toHaveFocus();
  });

  test("respects maxLength attribute on search input", () => {
    render(
      <MockedProvider mocks={[mockLibraryAlbums, mockLibraryTracks]}>
        <TidalSearchModal isOpen={true} onClose={mockOnClose} />
      </MockedProvider>,
    );

    const input = screen.getByPlaceholderText(
      /search for albums and tracks/i,
    ) as HTMLInputElement;
    expect(input.maxLength).toBe(200);
  });
});
