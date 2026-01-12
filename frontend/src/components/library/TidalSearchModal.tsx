/**
 * TidalSearchModal Component
 *
 * Feature: ALG-76 - Move Tidal Search under Library Management
 *
 * Modal for searching Tidal catalog and adding items to library.
 */

import { useState, useEffect, useRef } from "react";
import { useLazyQuery, useMutation, useQuery } from "@apollo/client";
import { SEARCH_QUERY } from "../../graphql/queries";
import {
  ADD_ALBUM_TO_LIBRARY,
  ADD_TRACK_TO_LIBRARY,
  GET_LIBRARY_ALBUMS,
  GET_LIBRARY_TRACKS,
} from "../../graphql/library";
import "./TidalSearchModal.css";

export interface TidalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = "albums" | "tracks";

interface SearchResults {
  albums: Array<{
    id: string;
    title: string;
    artist: string;
    artists: string[];
    artworkUrl: string;
    artworkThumbUrl: string;
    explicit: boolean;
    trackCount: number;
    duration: number;
    releaseDate: string;
    externalUrl: string;
    source: string;
  }>;
  tracks: Array<{
    id: string;
    title: string;
    artist: string;
    artists: string[];
    albumTitle: string;
    albumId: string;
    artworkUrl: string;
    artworkThumbUrl: string;
    explicit: boolean;
    duration: number;
    externalUrl: string;
    source: string;
  }>;
  total: {
    albums: number;
    tracks: number;
  };
  query: string;
  cached: boolean;
  timestamp: number;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export function TidalSearchModal({ isOpen, onClose }: TidalSearchModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalId = "tidal-search-modal";
  const titleId = `${modalId}-title`;

  // State
  const [activeTab, setActiveTab] = useState<Tab>("albums");
  const [searchQuery, setSearchQuery] = useState("");
  const [addingItems, setAddingItems] = useState<Set<string>>(new Set());
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());

  // GraphQL operations
  const [executeSearch, { loading, error, data }] = useLazyQuery<{
    search: SearchResults;
  }>(SEARCH_QUERY, {
    fetchPolicy: "network-only",
  });

  // Query library to check for existing items
  const { data: libraryAlbumsData } = useQuery<{
    getLibraryAlbums: Array<{ tidalAlbumId: string }>;
  }>(GET_LIBRARY_ALBUMS, { fetchPolicy: "cache-first" });

  const { data: libraryTracksData } = useQuery<{
    getLibraryTracks: Array<{ isrc: string }>;
  }>(GET_LIBRARY_TRACKS, { fetchPolicy: "cache-first" });

  const [addAlbumToLibrary] = useMutation(ADD_ALBUM_TO_LIBRARY, {
    refetchQueries: [{ query: GET_LIBRARY_ALBUMS }],
  });

  const [addTrackToLibrary] = useMutation(ADD_TRACK_TO_LIBRARY, {
    refetchQueries: [{ query: GET_LIBRARY_TRACKS }],
  });

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setActiveTab("albums");
      setAddingItems(new Set());
      setAddedItems(new Set());
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled])',
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modal.addEventListener("keydown", handleTab);
    return () => modal.removeEventListener("keydown", handleTab);
  }, [isOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return;

    executeSearch({
      variables: {
        query: trimmedQuery,
        limit: 20,
      },
    });
  };

  const handleAddAlbum = async (albumId: string) => {
    if (addingItems.has(albumId)) return;

    setAddingItems((prev) => new Set(prev).add(albumId));

    try {
      const result = await addAlbumToLibrary({
        variables: {
          input: { tidalAlbumId: albumId },
        },
      });

      if (result.data?.addAlbumToLibrary.__typename === "LibraryAlbum") {
        setAddedItems((prev) => new Set(prev).add(albumId));
        setTimeout(() => {
          setAddedItems((prev) => {
            const next = new Set(prev);
            next.delete(albumId);
            return next;
          });
        }, 3000);
      }
    } catch (err) {
      // Error handling - could add error state if needed
    } finally {
      setAddingItems((prev) => {
        const next = new Set(prev);
        next.delete(albumId);
        return next;
      });
    }
  };

  const handleAddTrack = async (trackId: string) => {
    if (addingItems.has(trackId)) return;

    setAddingItems((prev) => new Set(prev).add(trackId));

    try {
      const result = await addTrackToLibrary({
        variables: {
          input: { isrc: trackId },
        },
      });

      if (result.data?.addTrackToLibrary.__typename === "LibraryTrack") {
        setAddedItems((prev) => new Set(prev).add(trackId));
        setTimeout(() => {
          setAddedItems((prev) => {
            const next = new Set(prev);
            next.delete(trackId);
            return next;
          });
        }, 3000);
      }
    } catch (err) {
      // Error handling - could add error state if needed
    } finally {
      setAddingItems((prev) => {
        const next = new Set(prev);
        next.delete(trackId);
        return next;
      });
    }
  };

  if (!isOpen) return null;

  const results = data?.search;
  const hasResults =
    results && (results.albums.length > 0 || results.tracks.length > 0);

  return (
    <div className="tidal-search-modal__overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="tidal-search-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tidal-search-modal__header">
          <h2 id={titleId} className="tidal-search-modal__title">
            Search Tidal Catalog
          </h2>
          <button
            className="tidal-search-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {/* Search input */}
        <div className="tidal-search-modal__search">
          <form onSubmit={handleSearch}>
            <div className="tidal-search-modal__search-input-group">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for albums and tracks..."
                maxLength={200}
                disabled={loading}
                className="tidal-search-modal__search-input"
                aria-label="Search query"
              />
              <button
                type="submit"
                disabled={loading || !searchQuery.trim()}
                className="tidal-search-modal__search-button"
              >
                {loading ? "Searching..." : "Search"}
              </button>
            </div>
          </form>
        </div>

        {/* Tabs */}
        {hasResults && (
          <div className="tidal-search-modal__tabs" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === "albums"}
              className={`tidal-search-modal__tab ${activeTab === "albums" ? "tidal-search-modal__tab--active" : ""}`}
              onClick={() => setActiveTab("albums")}
            >
              Albums
              <span className="tidal-search-modal__tab-count">
                {results.total.albums}
              </span>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "tracks"}
              className={`tidal-search-modal__tab ${activeTab === "tracks" ? "tidal-search-modal__tab--active" : ""}`}
              onClick={() => setActiveTab("tracks")}
            >
              Tracks
              <span className="tidal-search-modal__tab-count">
                {results.total.tracks}
              </span>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="tidal-search-modal__content">
          {error && (
            <div className="tidal-search-modal__error" role="alert">
              {error.message || "Search failed. Please try again."}
            </div>
          )}

          {loading && (
            <div className="tidal-search-modal__loading">
              <span className="tidal-search-modal__spinner" />
              Searching...
            </div>
          )}

          {!loading && results && !hasResults && (
            <div className="tidal-search-modal__empty">
              <p>No results found for "{results.query}"</p>
              <p className="tidal-search-modal__empty-hint">
                Try different search terms or check your spelling.
              </p>
            </div>
          )}

          {!loading && hasResults && (
            <div className="tidal-search-modal__results">
              {activeTab === "albums" && results.albums.length > 0 && (
                <div className="tidal-search-modal__list">
                  {results.albums.map((album) => {
                    const isInLibrary =
                      libraryAlbumsData?.getLibraryAlbums.some(
                        (libAlbum) => libAlbum.tidalAlbumId === album.id,
                      );
                    const isAdding = addingItems.has(album.id);
                    const isAdded = addedItems.has(album.id);

                    return (
                      <div key={album.id} className="tidal-search-modal__item">
                        <img
                          className="tidal-search-modal__item-cover"
                          src={
                            album.artworkThumbUrl ||
                            "/images/placeholder-album.svg"
                          }
                          alt=""
                        />
                        <div className="tidal-search-modal__item-info">
                          <span className="tidal-search-modal__item-title">
                            {album.title}
                            {album.explicit && (
                              <span className="tidal-search-modal__explicit">
                                E
                              </span>
                            )}
                          </span>
                          <span className="tidal-search-modal__item-artist">
                            {album.artist}
                          </span>
                          <span className="tidal-search-modal__item-meta">
                            {album.trackCount} tracks
                            {album.releaseDate &&
                              ` • ${new Date(album.releaseDate).getFullYear()}`}
                          </span>
                        </div>
                        <button
                          className={`tidal-search-modal__add-button ${isInLibrary ? "in-library" : ""} ${isAdded ? "success" : ""}`}
                          onClick={() => handleAddAlbum(album.id)}
                          disabled={isInLibrary || isAdding}
                        >
                          {isAdding && "Adding..."}
                          {!isAdding && isAdded && "Added!"}
                          {!isAdding && !isAdded && isInLibrary && "In Library"}
                          {!isAdding &&
                            !isAdded &&
                            !isInLibrary &&
                            "Add to Library"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === "tracks" && results.tracks.length > 0 && (
                <div className="tidal-search-modal__list">
                  {results.tracks.map((track) => {
                    const isInLibrary =
                      libraryTracksData?.getLibraryTracks.some(
                        (libTrack) => libTrack.isrc === track.id,
                      );
                    const isAdding = addingItems.has(track.id);
                    const isAdded = addedItems.has(track.id);

                    return (
                      <div key={track.id} className="tidal-search-modal__item">
                        <img
                          className="tidal-search-modal__item-cover"
                          src={
                            track.artworkThumbUrl ||
                            "/images/placeholder-album.svg"
                          }
                          alt=""
                        />
                        <div className="tidal-search-modal__item-info">
                          <span className="tidal-search-modal__item-title">
                            {track.title}
                            {track.explicit && (
                              <span className="tidal-search-modal__explicit">
                                E
                              </span>
                            )}
                          </span>
                          <span className="tidal-search-modal__item-artist">
                            {track.artist}
                            {track.albumTitle && ` - ${track.albumTitle}`}
                          </span>
                          <span className="tidal-search-modal__item-meta">
                            {formatDuration(track.duration)}
                          </span>
                        </div>
                        <button
                          className={`tidal-search-modal__add-button ${isInLibrary ? "in-library" : ""} ${isAdded ? "success" : ""}`}
                          onClick={() => handleAddTrack(track.id)}
                          disabled={isInLibrary || isAdding}
                        >
                          {isAdding && "+"}
                          {!isAdding && isAdded && "✓"}
                          {!isAdding && !isAdded && isInLibrary && "✓"}
                          {!isAdding && !isAdded && !isInLibrary && "+"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
