/**
 * SavePlaylistModal Component
 *
 * Feature: 017-tidal-playlist-export
 *
 * Modal for saving AI-generated playlists to Tidal.
 * Allows users to rename the playlist before saving.
 */

import { useState, useEffect, useRef } from "react";
import type {
  TrackForExport,
  ExportPlaylistResult,
} from "../../types/playlist";
import "./SavePlaylistModal.css";

// Re-export for consumers
export type { TrackForExport } from "../../types/playlist";

// Alias for backward compatibility
export type ExportSuccessResult = ExportPlaylistResult;

export interface SavePlaylistModalProps {
  isOpen: boolean;
  defaultName: string;
  tracks: TrackForExport[];
  onSave: (name: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string | null;
  errorCode?: string;
  successResult?: ExportSuccessResult | null;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const MAX_NAME_LENGTH = 150;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function SavePlaylistModal({
  isOpen,
  defaultName,
  tracks,
  onSave,
  onCancel,
  isLoading = false,
  error = null,
  errorCode,
  successResult = null,
}: SavePlaylistModalProps) {
  const [name, setName] = useState(defaultName);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showCancelWarning, setShowCancelWarning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const modalId = "save-playlist-modal";
  const titleId = `${modalId}-title`;

  // Reset name and warning when modal opens or defaultName changes
  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
      setValidationError(null);
      setShowCancelWarning(false);
      // Focus input on open
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen, defaultName]);

  // Handle cancel attempt - show warning if saving
  const handleCancelAttempt = () => {
    if (isLoading) {
      setShowCancelWarning(true);
    } else {
      onCancel();
    }
  };

  // Confirm cancel during save
  const handleConfirmCancel = () => {
    setShowCancelWarning(false);
    onCancel();
  };

  // Dismiss warning and continue saving
  const handleDismissWarning = () => {
    setShowCancelWarning(false);
  };

  // Handle escape key - show warning if saving, otherwise close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancelAttempt();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onCancel]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

  if (!isOpen) {
    return null;
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.slice(0, MAX_NAME_LENGTH);
    setName(newValue);
    // Clear validation error when user types
    if (validationError) {
      setValidationError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationError("Playlist name is required");
      return;
    }

    onSave(trimmedName);
  };

  const handleBlur = () => {
    if (!name.trim()) {
      setValidationError("Playlist name is required");
    }
  };

  const isRetryableError =
    errorCode === "rate_limit_exceeded" || errorCode === "tidal_unavailable";
  const isAuthError =
    errorCode === "no_tidal_connection" || errorCode === "token_refresh_failed";
  const trackCount = tracks.length;
  const characterCount = name.length;
  const isApproachingLimit = characterCount >= 140;

  return (
    <div className="save-playlist-modal__overlay" onClick={handleCancelAttempt}>
      <div
        ref={modalRef}
        className="save-playlist-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="save-playlist-modal__title">
          Save to Tidal
        </h2>

        <p className="save-playlist-modal__track-count">
          {trackCount} {trackCount === 1 ? "track" : "tracks"}
        </p>

        <form onSubmit={handleSubmit} className="save-playlist-modal__form">
          <div className="save-playlist-modal__field">
            <label
              htmlFor="playlist-name"
              className="save-playlist-modal__label"
            >
              Playlist Name
            </label>
            <input
              ref={inputRef}
              id="playlist-name"
              type="text"
              className={`save-playlist-modal__input ${validationError ? "save-playlist-modal__input--error" : ""}`}
              value={name}
              onChange={handleNameChange}
              onBlur={handleBlur}
              disabled={isLoading}
              maxLength={MAX_NAME_LENGTH}
              placeholder="Enter playlist name"
              aria-describedby="name-hint name-error"
            />
            <div className="save-playlist-modal__input-meta">
              <span
                id="name-hint"
                className={`save-playlist-modal__char-count ${isApproachingLimit ? "save-playlist-modal__char-count--warning" : ""}`}
              >
                {characterCount} / {MAX_NAME_LENGTH}
              </span>
            </div>
            {validationError && (
              <span
                id="name-error"
                className="save-playlist-modal__error"
                role="alert"
              >
                {validationError}
              </span>
            )}
          </div>

          {error && !successResult && (
            <div className="save-playlist-modal__api-error" role="alert">
              <span className="save-playlist-modal__error-message">
                {error}
              </span>
              {isRetryableError && (
                <button
                  type="submit"
                  className="save-playlist-modal__retry-button"
                  disabled={isLoading}
                >
                  Retry
                </button>
              )}
              {isAuthError && (
                <span className="save-playlist-modal__reconnect-hint">
                  Please reconnect your Tidal account.
                </span>
              )}
            </div>
          )}

          {successResult && (
            <div className="save-playlist-modal__success" role="status">
              <svg
                className="save-playlist-modal__success-icon"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
              <span className="save-playlist-modal__success-message">
                Saved '{successResult.playlistName}' with{" "}
                {successResult.tracksAdded}{" "}
                {successResult.tracksAdded === 1 ? "track" : "tracks"}
                {successResult.tracksSkipped > 0 && (
                  <span className="save-playlist-modal__skipped-info">
                    {" "}
                    ({successResult.tracksSkipped} unavailable)
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Warning when trying to cancel during save (FR-097) */}
          {showCancelWarning && (
            <div className="save-playlist-modal__warning" role="alert">
              <span className="save-playlist-modal__warning-message">
                A save is in progress. Are you sure you want to cancel?
              </span>
              <div className="save-playlist-modal__warning-actions">
                <button
                  type="button"
                  className="save-playlist-modal__warning-stay"
                  onClick={handleDismissWarning}
                >
                  Keep saving
                </button>
                <button
                  type="button"
                  className="save-playlist-modal__warning-cancel"
                  onClick={handleConfirmCancel}
                >
                  Cancel anyway
                </button>
              </div>
            </div>
          )}

          <div className="save-playlist-modal__actions">
            <button
              type="button"
              className="save-playlist-modal__cancel-button"
              onClick={handleCancelAttempt}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="save-playlist-modal__save-button"
              disabled={isLoading || !name.trim()}
            >
              {isLoading ? (
                <>
                  <span
                    className="save-playlist-modal__spinner"
                    role="progressbar"
                    aria-label="Saving"
                  />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
