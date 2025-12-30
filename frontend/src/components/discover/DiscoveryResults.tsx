import type { DiscoveryResult } from '../../graphql/discovery';
import { DiscoveryTrackItem } from './DiscoveryTrackItem';
import './DiscoveryResults.css';

/**
 * Results list for semantic discovery search
 *
 * Feature: 009-semantic-discovery-search
 */

interface DiscoveryResultsProps {
  /** Search results */
  results: DiscoveryResult[];
  /** Expanded queries from LLM */
  expandedQueries: string[];
  /** Whether more results are available */
  hasMore: boolean;
  /** Loading state for load more */
  loading?: boolean;
  /** Currently expanded track ID */
  expandedTrackId: string | null;
  /** Called when a track is clicked */
  onTrackClick: (trackId: string, isrc: string) => void;
  /** Called when load more is clicked */
  onLoadMore: () => void;
  /** Children render function for track accordion content */
  renderAccordionContent?: (track: DiscoveryResult) => React.ReactNode;
}

export function DiscoveryResults({
  results,
  expandedQueries,
  hasMore,
  loading = false,
  expandedTrackId,
  onTrackClick,
  onLoadMore,
  renderAccordionContent,
}: DiscoveryResultsProps) {
  return (
    <div className="discovery-results">
      <div className="discovery-results-header">
        <div className="discovery-results-info">
          <span className="discovery-results-count">
            {results.length} results{hasMore ? ' (more available)' : ''}
          </span>
          {expandedQueries.length > 0 && (
            <div className="discovery-results-queries">
              <span className="discovery-results-queries-label">
                Searched for:
              </span>
              {expandedQueries.map((q, i) => (
                <span key={i} className="discovery-results-query-chip">
                  {q}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="discovery-results-list">
        {results.map((track) => (
          <DiscoveryTrackItem
            key={track.id}
            track={track}
            isExpanded={expandedTrackId === track.id}
            onClick={() => onTrackClick(track.id, track.isrc)}
          >
            {expandedTrackId === track.id && renderAccordionContent?.(track)}
          </DiscoveryTrackItem>
        ))}
      </div>

      {hasMore && (
        <div className="discovery-results-load-more">
          <button
            className="discovery-load-more-button"
            onClick={onLoadMore}
            disabled={loading}
          >
            {loading ? 'Loading more...' : 'Load More Results'}
          </button>
          <span className="discovery-load-more-hint">
            Max 100 results
          </span>
        </div>
      )}

      {!hasMore && results.length > 0 && (
        <div className="discovery-results-end">
          End of results
        </div>
      )}
    </div>
  );
}
