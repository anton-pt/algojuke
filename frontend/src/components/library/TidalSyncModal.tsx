/**
 * TidalSyncModal Component
 *
 * Feature: ALG-32 - Tidal Library Synchronisation Flow
 *
 * Modal for viewing Tidal library diff and importing items to AlgoJuke.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useLazyQuery, useMutation } from "@apollo/client";
import {
  GET_TIDAL_ALBUM_DIFF,
  GET_TIDAL_TRACK_DIFF,
  IMPORT_FROM_TIDAL,
  type TidalSyncAlbum,
  type TidalSyncTrack,
  type GetTidalAlbumDiffData,
  type GetTidalTrackDiffData,
  type ImportFromTidalData,
  type TidalImportItemInput,
} from "../../graphql/tidalSync";
import { GET_LIBRARY_ALBUMS, GET_LIBRARY_TRACKS } from "../../graphql/library";
import "./TidalSyncModal.css";

export interface TidalSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

type Tab = "albums" | "tracks";

interface AlbumTabState {
  items: TidalSyncAlbum[];
  selected: Set<string>;
  nextCursor: string | null;
  hasMore: boolean;
  loaded: boolean;
  loading: boolean;
  error: string | null;
  requiresReconnect: boolean;
}

interface TrackTabState {
  items: TidalSyncTrack[];
  selected: Set<string>;
  nextCursor: string | null;
  hasMore: boolean;
  loaded: boolean;
  loading: boolean;
  error: string | null;
  requiresReconnect: boolean;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export function TidalSyncModal({
  isOpen,
  onClose,
  onImportComplete,
}: TidalSyncModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const modalId = "tidal-sync-modal";
  const titleId = `${modalId}-title`;

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>("albums");

  // Albums state
  const [albumState, setAlbumState] = useState<AlbumTabState>({
    items: [],
    selected: new Set(),
    nextCursor: null,
    hasMore: false,
    loaded: false,
    loading: false,
    error: null,
    requiresReconnect: false,
  });

  // Tracks state
  const [tracksState, setTracksState] = useState<TrackTabState>({
    items: [],
    selected: new Set(),
    nextCursor: null,
    hasMore: false,
    loaded: false,
    loading: false,
    error: null,
    requiresReconnect: false,
  });

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    failed: number;
  } | null>(null);

  // GraphQL operations
  const [fetchAlbumDiff] = useLazyQuery<GetTidalAlbumDiffData>(
    GET_TIDAL_ALBUM_DIFF,
    { fetchPolicy: "network-only" },
  );
  const [fetchTrackDiff] = useLazyQuery<GetTidalTrackDiffData>(
    GET_TIDAL_TRACK_DIFF,
    { fetchPolicy: "network-only" },
  );
  const [importFromTidal] = useMutation<ImportFromTidalData>(
    IMPORT_FROM_TIDAL,
    {
      refetchQueries: [
        { query: GET_LIBRARY_ALBUMS },
        { query: GET_LIBRARY_TRACKS },
      ],
    },
  );

  // Load albums on modal open
  const loadAlbums = useCallback(
    async (cursor?: string) => {
      setAlbumState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const { data } = await fetchAlbumDiff({
          variables: { cursor, limit: 50 },
        });

        const result = data?.getTidalAlbumDiff;
        if (!result) {
          throw new Error("No response from server");
        }

        if (result.__typename === "TidalSyncConnectionError") {
          setAlbumState((prev) => ({
            ...prev,
            loading: false,
            error: result.message,
            requiresReconnect: result.requiresReconnect,
          }));
          return;
        }

        if (result.__typename === "TidalSyncApiError") {
          setAlbumState((prev) => ({
            ...prev,
            loading: false,
            error: result.message,
          }));
          return;
        }

        setAlbumState((prev) => ({
          ...prev,
          items: cursor
            ? [...prev.items, ...result.items]
            : (result.items as TidalSyncAlbum[]),
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
          loaded: true,
          loading: false,
        }));
      } catch (err) {
        setAlbumState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load albums",
        }));
      }
    },
    [fetchAlbumDiff],
  );

  // Load tracks
  const loadTracks = useCallback(
    async (cursor?: string) => {
      setTracksState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const { data } = await fetchTrackDiff({
          variables: { cursor, limit: 50 },
        });

        const result = data?.getTidalTrackDiff;
        if (!result) {
          throw new Error("No response from server");
        }

        if (result.__typename === "TidalSyncConnectionError") {
          setTracksState((prev) => ({
            ...prev,
            loading: false,
            error: result.message,
            requiresReconnect: result.requiresReconnect,
          }));
          return;
        }

        if (result.__typename === "TidalSyncApiError") {
          setTracksState((prev) => ({
            ...prev,
            loading: false,
            error: result.message,
          }));
          return;
        }

        setTracksState((prev) => ({
          ...prev,
          items: cursor
            ? [...prev.items, ...result.items]
            : (result.items as TidalSyncTrack[]),
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
          loaded: true,
          loading: false,
        }));
      } catch (err) {
        setTracksState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load tracks",
        }));
      }
    },
    [fetchTrackDiff],
  );

  // Load data on modal open
  useEffect(() => {
    if (isOpen && !albumState.loaded && !albumState.loading) {
      loadAlbums();
    }
  }, [isOpen, albumState.loaded, albumState.loading, loadAlbums]);

  // Load tracks when tab switches
  useEffect(() => {
    if (
      isOpen &&
      activeTab === "tracks" &&
      !tracksState.loaded &&
      !tracksState.loading
    ) {
      loadTracks();
    }
  }, [isOpen, activeTab, tracksState.loaded, tracksState.loading, loadTracks]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setAlbumState({
        items: [],
        selected: new Set(),
        nextCursor: null,
        hasMore: false,
        loaded: false,
        loading: false,
        error: null,
        requiresReconnect: false,
      });
      setTracksState({
        items: [],
        selected: new Set(),
        nextCursor: null,
        hasMore: false,
        loaded: false,
        loading: false,
        error: null,
        requiresReconnect: false,
      });
      setActiveTab("albums");
      setImportResult(null);
      setImportProgress(null);
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isImporting) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isImporting, onClose]);

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

  const currentState = activeTab === "albums" ? albumState : tracksState;

  // Toggle selection - use tab-specific setters to maintain type safety
  const toggleSelection = (tidalId: string) => {
    if (activeTab === "albums") {
      setAlbumState((prev) => {
        const newSelected = new Set(prev.selected);
        if (newSelected.has(tidalId)) {
          newSelected.delete(tidalId);
        } else {
          newSelected.add(tidalId);
        }
        return { ...prev, selected: newSelected };
      });
    } else {
      setTracksState((prev) => {
        const newSelected = new Set(prev.selected);
        if (newSelected.has(tidalId)) {
          newSelected.delete(tidalId);
        } else {
          newSelected.add(tidalId);
        }
        return { ...prev, selected: newSelected };
      });
    }
  };

  // Select all visible items
  const selectAll = () => {
    if (activeTab === "albums") {
      setAlbumState((prev) => {
        const allIds = prev.items.map((item) => item.tidalId);
        const allSelected = allIds.every((id) => prev.selected.has(id));
        return {
          ...prev,
          selected: allSelected ? new Set<string>() : new Set(allIds),
        };
      });
    } else {
      setTracksState((prev) => {
        const allIds = prev.items.map((item) => item.tidalId);
        const allSelected = allIds.every((id) => prev.selected.has(id));
        return {
          ...prev,
          selected: allSelected ? new Set<string>() : new Set(allIds),
        };
      });
    }
  };

  // Helper to update error state for current tab
  const setCurrentTabError = (
    error: string | null,
    requiresReconnect = false,
  ) => {
    if (activeTab === "albums") {
      setAlbumState((prev) => ({ ...prev, error, requiresReconnect }));
    } else {
      setTracksState((prev) => ({ ...prev, error, requiresReconnect }));
    }
  };

  // Import selected items
  const handleImportSelected = async () => {
    const items: TidalImportItemInput[] = Array.from(currentState.selected).map(
      (tidalId) => ({
        type: activeTab === "albums" ? "ALBUM" : "TRACK",
        tidalId,
      }),
    );

    if (items.length === 0) return;

    setIsImporting(true);
    setImportProgress({ current: 0, total: items.length });
    setImportResult(null);

    try {
      const { data } = await importFromTidal({ variables: { items } });
      const result = data?.importFromTidal;

      if (!result) {
        throw new Error("No response from server");
      }

      if (result.__typename === "TidalImportSuccess") {
        setImportResult({
          imported: result.imported,
          skipped: result.skipped,
          failed: result.failed,
        });

        // Remove imported items from the list
        const importedIds = new Set(
          result.results.filter((r) => r.success).map((r) => r.tidalId),
        );

        if (activeTab === "albums") {
          setAlbumState((prev) => ({
            ...prev,
            items: prev.items.filter((item) => !importedIds.has(item.tidalId)),
            selected: new Set<string>(),
          }));
        } else {
          setTracksState((prev) => ({
            ...prev,
            items: prev.items.filter((item) => !importedIds.has(item.tidalId)),
            selected: new Set<string>(),
          }));
        }

        onImportComplete?.();
      } else if (result.__typename === "TidalSyncConnectionError") {
        setCurrentTabError(result.message, result.requiresReconnect);
      } else {
        setCurrentTabError(result.message);
      }
    } catch (err) {
      setCurrentTabError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  // Handle load more
  const handleLoadMore = () => {
    if (activeTab === "albums" && albumState.nextCursor) {
      loadAlbums(albumState.nextCursor);
    } else if (activeTab === "tracks" && tracksState.nextCursor) {
      loadTracks(tracksState.nextCursor);
    }
  };

  if (!isOpen) return null;

  const isAllSelected =
    currentState.items.length > 0 &&
    currentState.items.every((item) =>
      currentState.selected.has((item as TidalSyncAlbum).tidalId),
    );

  return (
    <div className="tidal-sync-modal__overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="tidal-sync-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tidal-sync-modal__header">
          <h2 id={titleId} className="tidal-sync-modal__title">
            Sync with Tidal
          </h2>
          <button
            className="tidal-sync-modal__close"
            onClick={onClose}
            disabled={isImporting}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="tidal-sync-modal__tabs" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === "albums"}
            className={`tidal-sync-modal__tab ${activeTab === "albums" ? "tidal-sync-modal__tab--active" : ""}`}
            onClick={() => setActiveTab("albums")}
            disabled={isImporting}
          >
            Albums
            {albumState.loaded && (
              <span className="tidal-sync-modal__tab-count">
                {albumState.items.length}
              </span>
            )}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "tracks"}
            className={`tidal-sync-modal__tab ${activeTab === "tracks" ? "tidal-sync-modal__tab--active" : ""}`}
            onClick={() => setActiveTab("tracks")}
            disabled={isImporting}
          >
            Tracks
            {tracksState.loaded && (
              <span className="tidal-sync-modal__tab-count">
                {tracksState.items.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="tidal-sync-modal__content">
          {currentState.error && (
            <div className="tidal-sync-modal__error" role="alert">
              <span>{currentState.error}</span>
              {currentState.requiresReconnect && (
                <span className="tidal-sync-modal__reconnect-hint">
                  Please reconnect your Tidal account.
                </span>
              )}
            </div>
          )}

          {importResult && (
            <div className="tidal-sync-modal__success" role="status">
              <svg
                className="tidal-sync-modal__success-icon"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
              <span>
                Imported {importResult.imported} item
                {importResult.imported !== 1 ? "s" : ""}
                {importResult.skipped > 0 &&
                  ` (${importResult.skipped} already existed)`}
                {importResult.failed > 0 && ` (${importResult.failed} failed)`}
              </span>
            </div>
          )}

          {currentState.loading && !currentState.loaded ? (
            <div className="tidal-sync-modal__loading">
              <span className="tidal-sync-modal__spinner" />
              Loading your Tidal library...
            </div>
          ) : currentState.items.length === 0 ? (
            <div className="tidal-sync-modal__empty">
              <p>
                {activeTab === "albums"
                  ? "All your Tidal albums are already in AlgoJuke!"
                  : "All your Tidal tracks are already in AlgoJuke!"}
              </p>
            </div>
          ) : (
            <>
              {/* Select all header */}
              <div className="tidal-sync-modal__list-header">
                <label className="tidal-sync-modal__select-all">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={selectAll}
                    disabled={isImporting}
                  />
                  <span>Select all</span>
                </label>
                <span className="tidal-sync-modal__selected-count">
                  {currentState.selected.size} selected
                </span>
              </div>

              {/* Item list */}
              <div className="tidal-sync-modal__list">
                {activeTab === "albums"
                  ? (currentState.items as TidalSyncAlbum[]).map((album) => (
                      <label
                        key={album.tidalId}
                        className={`tidal-sync-modal__item ${currentState.selected.has(album.tidalId) ? "tidal-sync-modal__item--selected" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={currentState.selected.has(album.tidalId)}
                          onChange={() => toggleSelection(album.tidalId)}
                          disabled={isImporting}
                        />
                        <img
                          className="tidal-sync-modal__item-cover"
                          src={album.coverArtUrl || "/placeholder-album.png"}
                          alt=""
                        />
                        <div className="tidal-sync-modal__item-info">
                          <span className="tidal-sync-modal__item-title">
                            {album.title}
                          </span>
                          <span className="tidal-sync-modal__item-artist">
                            {album.artistName}
                          </span>
                        </div>
                        <span className="tidal-sync-modal__item-meta">
                          {album.trackCount} tracks
                        </span>
                      </label>
                    ))
                  : (currentState.items as TidalSyncTrack[]).map((track) => (
                      <label
                        key={track.tidalId}
                        className={`tidal-sync-modal__item ${currentState.selected.has(track.tidalId) ? "tidal-sync-modal__item--selected" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={currentState.selected.has(track.tidalId)}
                          onChange={() => toggleSelection(track.tidalId)}
                          disabled={isImporting}
                        />
                        <img
                          className="tidal-sync-modal__item-cover"
                          src={track.coverArtUrl || "/placeholder-album.png"}
                          alt=""
                        />
                        <div className="tidal-sync-modal__item-info">
                          <span className="tidal-sync-modal__item-title">
                            {track.title}
                          </span>
                          <span className="tidal-sync-modal__item-artist">
                            {track.artistName}
                            {track.albumName && ` - ${track.albumName}`}
                          </span>
                        </div>
                        <span className="tidal-sync-modal__item-meta">
                          {formatDuration(track.duration)}
                        </span>
                      </label>
                    ))}
              </div>

              {/* Load more button */}
              {currentState.hasMore && (
                <button
                  className="tidal-sync-modal__load-more"
                  onClick={handleLoadMore}
                  disabled={currentState.loading || isImporting}
                >
                  {currentState.loading ? (
                    <>
                      <span className="tidal-sync-modal__spinner" />
                      Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="tidal-sync-modal__footer">
          <button
            className="tidal-sync-modal__cancel-button"
            onClick={onClose}
            disabled={isImporting}
          >
            Cancel
          </button>
          <button
            className="tidal-sync-modal__import-button"
            onClick={handleImportSelected}
            disabled={isImporting || currentState.selected.size === 0}
          >
            {isImporting ? (
              <>
                <span className="tidal-sync-modal__spinner" />
                Importing...
                {importProgress && (
                  <span>
                    ({importProgress.current}/{importProgress.total})
                  </span>
                )}
              </>
            ) : (
              `Import ${currentState.selected.size} Selected`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
