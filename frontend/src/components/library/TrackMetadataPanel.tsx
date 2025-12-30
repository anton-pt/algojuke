import ReactMarkdown from 'react-markdown';
import { ExtendedTrackMetadata } from '../../graphql/trackMetadata';
import { AudioFeaturesDisplay } from './AudioFeaturesDisplay';
import './TrackMetadataPanel.css';

interface TrackMetadataPanelProps {
  /** Loading state */
  loading: boolean;
  /** Error from fetch */
  error: Error | null;
  /** Fetched metadata (null if not loaded or not found) */
  metadata: ExtendedTrackMetadata | null;
  /** Whether track has ISRC (determines if metadata is possible) */
  hasIsrc: boolean;
  /** Retry callback for error state */
  onRetry: () => void;
}

/**
 * Panel content for expanded track accordion
 * Shows lyrics, interpretation, and handles loading/error states
 *
 * Uses aria-live="polite" to announce content changes to screen readers
 * when the panel transitions between loading, error, and content states.
 */
export function TrackMetadataPanel({
  loading,
  error,
  metadata,
  hasIsrc,
  onRetry,
}: TrackMetadataPanelProps) {
  // Loading state - show skeleton
  if (loading) {
    return (
      <div className="track-metadata-panel" aria-live="polite" aria-busy="true">
        <div className="track-metadata-skeleton" role="status">
          <span className="visually-hidden">Loading track details...</span>
          <div className="skeleton-line skeleton-title" aria-hidden="true" />
          <div className="skeleton-line skeleton-text" aria-hidden="true" />
          <div className="skeleton-line skeleton-text" aria-hidden="true" />
          <div className="skeleton-line skeleton-text short" aria-hidden="true" />
        </div>
      </div>
    );
  }

  // Error state - show retry button
  if (error) {
    return (
      <div className="track-metadata-panel" aria-live="polite" role="alert">
        <div className="track-metadata-error">
          <p>Failed to load track details</p>
          <button onClick={onRetry} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No ISRC - track cannot have extended metadata
  if (!hasIsrc) {
    return (
      <div className="track-metadata-panel" aria-live="polite">
        <div className="track-metadata-unavailable" role="status">
          <p>Extended metadata not yet available</p>
          <p className="track-metadata-hint">
            This track needs to be processed before details are available.
          </p>
        </div>
      </div>
    );
  }

  // No metadata found - track not indexed
  if (!metadata) {
    return (
      <div className="track-metadata-panel" aria-live="polite">
        <div className="track-metadata-unavailable" role="status">
          <p>Extended metadata not yet available</p>
          <p className="track-metadata-hint">
            This track is being processed. Check back soon.
          </p>
        </div>
      </div>
    );
  }

  // Show metadata content
  return (
    <div className="track-metadata-panel" aria-live="polite">
      {/* Lyrics section */}
      <div className="track-metadata-section">
        <h4 className="track-metadata-section-title">Lyrics</h4>
        {metadata.lyrics ? (
          <div className="track-metadata-lyrics">
            <pre>{metadata.lyrics}</pre>
          </div>
        ) : (
          <p className="track-metadata-empty">No lyrics available</p>
        )}
      </div>

      {/* Interpretation section */}
      <div className="track-metadata-section">
        <h4 className="track-metadata-section-title">Interpretation</h4>
        {metadata.interpretation ? (
          <div className="track-metadata-interpretation">
            <ReactMarkdown>{metadata.interpretation}</ReactMarkdown>
          </div>
        ) : (
          <p className="track-metadata-empty">No interpretation available</p>
        )}
      </div>

      {/* Audio Features section */}
      <div className="track-metadata-section">
        <h4 className="track-metadata-section-title">Audio Features</h4>
        <AudioFeaturesDisplay audioFeatures={metadata.audioFeatures} />
      </div>
    </div>
  );
}
