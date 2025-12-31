import { useQuery } from '@apollo/client';
import { useDiscoverySearch } from '../hooks/useDiscoverySearch';
import { useTrackMetadata } from '../hooks/useTrackMetadata';
import { GET_DISCOVERY_INDEXED_COUNT } from '../graphql/discovery';
import { DiscoverySearchBar } from '../components/discover/DiscoverySearchBar';
import { DiscoveryResults } from '../components/discover/DiscoveryResults';
import { TrackMetadataPanel } from '../components/library/TrackMetadataPanel';

/**
 * Discover search view for semantic music search
 *
 * Feature: 009-semantic-discovery-search
 *
 * Extracted from DiscoverPage to support tabbed navigation.
 */

export function DiscoverSearchView() {
  // Check indexed track count
  const { data: indexedCountData } = useQuery<{ discoveryIndexedCount: number }>(
    GET_DISCOVERY_INDEXED_COUNT
  );
  const indexedCount = indexedCountData?.discoveryIndexedCount ?? null;
  const isCollectionEmpty = indexedCount === 0;

  // Discovery search hook
  const {
    query,
    results,
    expandedQueries,
    loading,
    error,
    hasMore,
    search,
    loadMore,
    retry,
  } = useDiscoverySearch();

  // Track metadata hook for accordion
  const {
    expandedTrackId,
    loading: metadataLoading,
    error: metadataError,
    metadata,
    toggleTrack,
    retry: retryMetadata,
  } = useTrackMetadata();

  // Handle track click for accordion
  const handleTrackClick = (trackId: string, isrc: string) => {
    toggleTrack(trackId, isrc);
  };

  // Render accordion content using shared TrackMetadataPanel
  const renderAccordionContent = (track: { isrc: string }) => {
    return (
      <TrackMetadataPanel
        loading={metadataLoading}
        error={metadataError}
        metadata={metadata}
        hasIsrc={!!track.isrc}
        onRetry={retryMetadata}
      />
    );
  };

  return (
    <div className="discover-search-view">
      {/* Empty collection message */}
      {isCollectionEmpty && (
        <div className="discover-empty-collection">
          <h3>No tracks indexed yet</h3>
          <p>
            Add albums or tracks to your library and wait for them to be indexed
            before using semantic discovery search.
          </p>
        </div>
      )}

      {!isCollectionEmpty && (
        <DiscoverySearchBar
          onSearch={search}
          loading={loading && results.length === 0}
          error={error?.message}
          initialQuery={query}
        />
      )}

      {/* Loading skeleton for initial search */}
      {loading && results.length === 0 && (
        <div className="discover-loading">
          <div className="discover-loading-skeleton" />
          <div className="discover-loading-skeleton" />
          <div className="discover-loading-skeleton" />
          <div className="discover-loading-text">
            Expanding your query and searching...
          </div>
        </div>
      )}

      {/* Results - show whenever we have results (even while loading more) */}
      {results.length > 0 && (
        <DiscoveryResults
          results={results}
          expandedQueries={expandedQueries}
          hasMore={hasMore}
          loading={loading}
          expandedTrackId={expandedTrackId}
          onTrackClick={handleTrackClick}
          onLoadMore={loadMore}
          renderAccordionContent={renderAccordionContent}
        />
      )}

      {/* No results */}
      {!loading && query && results.length === 0 && !error && (
        <div className="discover-no-results">
          <h3>No tracks found</h3>
          <p>
            No indexed tracks match your description. Try different terms or
            broaden your search.
          </p>
        </div>
      )}

      {/* Error with retry */}
      {error && error.retryable && (
        <div className="discover-error-retry">
          <p>{error.message}</p>
          <button onClick={retry} className="discover-retry-button">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
