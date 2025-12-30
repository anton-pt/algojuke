import { useState } from 'react';
import type { DiscoveryResult } from '../../graphql/discovery';
import './DiscoveryTrackItem.css';

/**
 * Individual track item in discovery results
 *
 * Feature: 009-semantic-discovery-search
 */

interface DiscoveryTrackItemProps {
  /** Track data from discovery search */
  track: DiscoveryResult;
  /** Whether this track is expanded */
  isExpanded?: boolean;
  /** Called when track is clicked */
  onClick?: () => void;
  /** Optional children for expanded content (accordion) */
  children?: React.ReactNode;
}

export function DiscoveryTrackItem({
  track,
  isExpanded = false,
  onClick,
  children,
}: DiscoveryTrackItemProps) {
  const [imageError, setImageError] = useState(false);
  const showPlaceholder = imageError || !track.artworkUrl;

  return (
    <div className={`discovery-track-item ${isExpanded ? 'expanded' : ''}`}>
      <button
        className="discovery-track-header"
        onClick={onClick}
        type="button"
        aria-expanded={isExpanded}
      >
        <div className="discovery-track-artwork">
          {showPlaceholder ? (
            <div className="discovery-track-artwork-placeholder">
              <span>♪</span>
            </div>
          ) : (
            <img
              className="discovery-track-artwork-image"
              src={track.artworkUrl!}
              alt={`${track.title} by ${track.artist}`}
              onError={() => setImageError(true)}
              loading="lazy"
            />
          )}
        </div>

        <div className="discovery-track-info">
          <div className="discovery-track-title">{track.title}</div>
          <div className="discovery-track-artist">{track.artist}</div>
          <div className="discovery-track-album">{track.album}</div>
        </div>

        <div className="discovery-track-expand-icon" aria-hidden="true">
          {isExpanded ? '▲' : '▼'}
        </div>
      </button>

      {isExpanded && children && (
        <div className="discovery-track-content">{children}</div>
      )}
    </div>
  );
}
