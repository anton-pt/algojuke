import { ReactNode } from 'react';
import { TrackMetadataPanel } from './TrackMetadataPanel';
import { ExtendedTrackMetadata } from '../../graphql/trackMetadata';
import './TrackAccordion.css';

interface TrackAccordionProps {
  /** Unique track ID */
  trackId: string;
  /** Track ISRC (null if not available) */
  isrc: string | null | undefined;
  /** Whether this accordion is currently expanded */
  isExpanded: boolean;
  /** Toggle callback */
  onToggle: () => void;
  /** Loading state for metadata */
  loading: boolean;
  /** Error from metadata fetch */
  error: Error | null;
  /** Fetched metadata */
  metadata: ExtendedTrackMetadata | null;
  /** Retry callback */
  onRetry: () => void;
  /** Track content (the regular track display) */
  children: ReactNode;
}

/**
 * Accordion wrapper for track cards
 * Handles expand/collapse animation and renders TrackMetadataPanel when expanded
 */
export function TrackAccordion({
  trackId,
  isrc,
  isExpanded,
  onToggle,
  loading,
  error,
  metadata,
  onRetry,
  children,
}: TrackAccordionProps) {
  return (
    <div
      className={`track-accordion ${isExpanded ? 'expanded' : ''}`}
      data-testid={`track-accordion-${trackId}`}
    >
      {/* Track content (clickable header) */}
      <div
        className="track-accordion-header"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-controls={`track-accordion-panel-${trackId}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        {children}
        <div className="track-accordion-indicator">
          <span className={`chevron ${isExpanded ? 'up' : 'down'}`}>▼</span>
        </div>
      </div>

      {/* Expandable panel */}
      {isExpanded && (
        <div
          id={`track-accordion-panel-${trackId}`}
          className="track-accordion-panel"
          role="region"
          aria-labelledby={`track-accordion-header-${trackId}`}
        >
          <TrackMetadataPanel
            loading={loading}
            error={error}
            metadata={metadata}
            hasIsrc={!!isrc}
            onRetry={onRetry}
          />
        </div>
      )}
    </div>
  );
}
