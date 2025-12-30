import { useState, useCallback } from 'react';
import { useLazyQuery } from '@apollo/client';
import {
  DISCOVER_TRACKS,
  DiscoverTracksData,
  DiscoverTracksVars,
  DiscoverySearchError,
  DiscoveryResult,
  isDiscoverySearchError,
  isDiscoverySearchResponse,
} from '../graphql/discovery';

/**
 * Hook for semantic discovery search
 *
 * Feature: 009-semantic-discovery-search
 *
 * Features:
 * - Natural language query search
 * - Loading and error state management
 * - Pagination support with accumulated results
 * - Retry functionality for failed searches
 */

interface UseDiscoverySearchReturn {
  /** Current search query */
  query: string;
  /** All accumulated results */
  results: DiscoveryResult[];
  /** LLM-generated expanded queries */
  expandedQueries: string[];
  /** Loading state for search */
  loading: boolean;
  /** Error from search (null if no error) */
  error: DiscoverySearchError | null;
  /** Whether more results are available */
  hasMore: boolean;
  /** Current page number (0-indexed) */
  page: number;
  /** Total results available */
  totalResults: number;
  /** Execute a new search (resets pagination) */
  search: (query: string) => void;
  /** Load more results (pagination) */
  loadMore: () => void;
  /** Retry failed search */
  retry: () => void;
  /** Clear search results */
  clear: () => void;
}

export function useDiscoverySearch(): UseDiscoverySearchReturn {
  // State for accumulated results (for pagination)
  const [accumulatedResults, setAccumulatedResults] = useState<DiscoveryResult[]>([]);
  const [expandedQueries, setExpandedQueries] = useState<string[]>([]);
  const [currentQuery, setCurrentQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [searchError, setSearchError] = useState<DiscoverySearchError | null>(null);

  // GraphQL lazy query
  const [executeSearch, { loading }] = useLazyQuery<
    DiscoverTracksData,
    DiscoverTracksVars
  >(DISCOVER_TRACKS, {
    fetchPolicy: 'network-only', // Always fetch fresh results
    onCompleted: (data) => {
      const result = data.discoverTracks;

      if (isDiscoverySearchError(result)) {
        setSearchError(result);
        return;
      }

      if (isDiscoverySearchResponse(result)) {
        setSearchError(null);
        setExpandedQueries(result.expandedQueries);
        setHasMore(result.hasMore);
        setTotalResults(result.totalResults);

        // If page 0, replace results; otherwise append
        if (result.page === 0) {
          setAccumulatedResults(result.results);
          setCurrentPage(0);
        } else {
          setAccumulatedResults((prev) => [...prev, ...result.results]);
          setCurrentPage(result.page);
        }
      }
    },
    onError: (error) => {
      setSearchError({
        message: error.message || 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
        retryable: true,
      });
    },
  });

  // Execute new search
  const search = useCallback(
    (query: string) => {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) {
        setSearchError({
          message: 'Please enter a search term',
          code: 'EMPTY_QUERY',
          retryable: false,
        });
        return;
      }

      // Reset state for new search
      setCurrentQuery(trimmedQuery);
      setAccumulatedResults([]);
      setExpandedQueries([]);
      setCurrentPage(0);
      setHasMore(false);
      setTotalResults(0);
      setSearchError(null);

      executeSearch({
        variables: {
          input: {
            query: trimmedQuery,
            page: 0,
            pageSize: 20,
          },
        },
      });
    },
    [executeSearch]
  );

  // Load more results
  const loadMore = useCallback(() => {
    if (!hasMore || loading || !currentQuery) return;

    const nextPage = currentPage + 1;
    executeSearch({
      variables: {
        input: {
          query: currentQuery,
          page: nextPage,
          pageSize: 20,
        },
      },
    });
  }, [hasMore, loading, currentQuery, currentPage, executeSearch]);

  // Retry failed search
  const retry = useCallback(() => {
    if (!currentQuery) return;

    setSearchError(null);
    executeSearch({
      variables: {
        input: {
          query: currentQuery,
          page: currentPage,
          pageSize: 20,
        },
      },
    });
  }, [currentQuery, currentPage, executeSearch]);

  // Clear search results
  const clear = useCallback(() => {
    setCurrentQuery('');
    setAccumulatedResults([]);
    setExpandedQueries([]);
    setCurrentPage(0);
    setHasMore(false);
    setTotalResults(0);
    setSearchError(null);
  }, []);

  return {
    query: currentQuery,
    results: accumulatedResults,
    expandedQueries,
    loading,
    error: searchError,
    hasMore,
    page: currentPage,
    totalResults,
    search,
    loadMore,
    retry,
    clear,
  };
}
