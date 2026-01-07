/**
 * PlaylistCard Component
 *
 * Feature: 015-playlist-suggestion, 017-tidal-playlist-export
 *
 * Displays a visual playlist with album artwork, track titles, and artist names.
 * Shows placeholder artwork for unenriched tracks.
 * Includes "Save to Tidal" button for playlist export.
 */

import { useState } from "react";
import type { TrackForExport } from "../../types/playlist";
import "./PlaylistCard.css";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Enriched track from backend
 */
export interface PlaylistTrack {
  isrc: string;
  title: string;
  artist: string;
  album: string | null;
  artworkUrl: string | null;
  duration: number | null;
  reasoning: string;
  enriched: boolean;
  tidalId: string | null;
}

// Re-export TrackForExport for consumers
export type { TrackForExport } from "../../types/playlist";

/**
 * PlaylistCard component props
 */
export interface PlaylistCardProps {
  title: string;
  tracks: PlaylistTrack[];
  /** Whether user has a Tidal connection */
  hasTidalConnection?: boolean;
  /** Callback when save button is clicked */
  onSaveClick?: (title: string, tracks: TrackForExport[]) => void;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/**
 * Placeholder artwork for unenriched tracks
 * Uses a neutral music note SVG data URI (80x80 to match Tidal API artwork size)
 */
const PLACEHOLDER_ARTWORK =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAiIGhlaWdodD0iODAiIGZpbGw9IiMyYTJhMmEiLz48cGF0aCBkPSJNNDAgMjBWNTBNNDAgNTBDMzcgNTAgMzQuNSA1Mi41IDM0LjUgNTUuNUMzNC41IDU4LjUgMzcgNjEgNDAgNjFDNDMgNjEgNDUuNSA1OC41IDQ1LjUgNTUuNUM0NS41IDUyLjUgNDMgNTAgNDAgNTBaIiBzdHJva2U9IiM2YjZiNmIiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHBhdGggZD0iTTQwIDIwTDU1IDE1VjM1IiBzdHJva2U9IiM2YjZiNmIiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+";

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Format duration in seconds to mm:ss
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

/**
 * Individual track row props
 */
interface TrackRowProps {
  track: PlaylistTrack;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  trackKey: string;
}

/**
 * Individual track row with accordion expand/collapse
 */
function TrackRow({
  track,
  index,
  isExpanded,
  onToggle,
  trackKey,
}: TrackRowProps) {
  const artworkSrc = track.artworkUrl || PLACEHOLDER_ARTWORK;
  const altText = track.enriched
    ? `${track.album} album artwork`
    : `${track.title} placeholder artwork`;
  const reasoningPanelId = `reasoning-${trackKey}`;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <>
      <div
        className={`playlist-card__track ${!track.enriched ? "playlist-card__track--unenriched" : ""} ${isExpanded ? "playlist-card__track--expanded" : ""}`}
        data-isrc={track.isrc}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-controls={reasoningPanelId}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
      >
        <span className="playlist-card__track-number">{index + 1}</span>
        <img
          className="playlist-card__artwork"
          src={artworkSrc}
          alt={altText}
          width={40}
          height={40}
          loading="lazy"
        />
        <div className="playlist-card__track-info">
          <span className="playlist-card__track-title">{track.title}</span>
          <span className="playlist-card__track-artist">{track.artist}</span>
        </div>
        {track.duration !== null && (
          <span className="playlist-card__track-duration">
            {formatDuration(track.duration)}
          </span>
        )}
        <span
          className={`playlist-card__chevron ${isExpanded ? "playlist-card__chevron--expanded" : ""}`}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
          </svg>
        </span>
      </div>
      {isExpanded && (
        <div id={reasoningPanelId} className="playlist-card__reasoning">
          {track.reasoning}
        </div>
      )}
    </>
  );
}

// -----------------------------------------------------------------------------
// Tidal Icon Component
// -----------------------------------------------------------------------------

function TidalIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12.012 3.992L8.008 7.996l4.004 4.004 4.004-4.004-4.004-4.004zm0 8.008L8.008 16l4.004 4.008L16.016 16l-4.004-4zm-8.008-4L.002 8l4.008 4.008L8.008 8 4.004 3.992zm16.024 0L16.016 8l4.012 4.008L24 8l-4.008-4.008z" />
    </svg>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

/**
 * Playlist card showing visual playlist with tracks
 * Supports accordion expand/collapse for track reasoning
 */
export function PlaylistCard({
  title,
  tracks,
  hasTidalConnection = false,
  onSaveClick,
}: PlaylistCardProps) {
  // T031: Track which ISRC is expanded (null = none expanded)
  const [expandedTrackIsrc, setExpandedTrackIsrc] = useState<string | null>(
    null,
  );

  const trackCount = tracks.length;
  const trackLabel = trackCount === 1 ? "1 track" : `${trackCount} tracks`;

  // T032-T033: Toggle expansion, only one track expanded at a time
  const handleToggle = (isrc: string) => {
    setExpandedTrackIsrc((current) => (current === isrc ? null : isrc));
  };

  // T015-T016: Handle save button click
  const handleSaveClick = () => {
    if (onSaveClick) {
      const tracksForExport: TrackForExport[] = tracks.map((t) => ({
        isrc: t.isrc,
        title: t.title,
        artist: t.artist,
      }));
      onSaveClick(title, tracksForExport);
    }
  };

  // T017-T018: Disabled button with tooltip
  const isDisabled = !hasTidalConnection;
  const tooltipText = isDisabled
    ? "Connect your Tidal account to save playlists"
    : undefined;

  return (
    <div className="playlist-card">
      <div className="playlist-card__header">
        <div className="playlist-card__header-text">
          <h3 className="playlist-card__title">{title}</h3>
          <span className="playlist-card__track-count">{trackLabel}</span>
        </div>
        <button
          className={`playlist-card__save-button ${isDisabled ? "playlist-card__save-button--disabled" : ""}`}
          onClick={handleSaveClick}
          disabled={isDisabled}
          title={tooltipText}
        >
          <TidalIcon className="playlist-card__save-icon" />
          <span>Save to Tidal</span>
        </button>
      </div>
      <div className="playlist-card__tracks">
        {tracks.map((track, index) => {
          const trackKey = `${track.isrc}-${index}`;
          return (
            <TrackRow
              key={trackKey}
              track={track}
              index={index}
              isExpanded={expandedTrackIsrc === trackKey}
              onToggle={() => handleToggle(trackKey)}
              trackKey={trackKey}
            />
          );
        })}
      </div>
    </div>
  );
}
