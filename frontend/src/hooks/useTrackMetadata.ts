import { useState, useCallback, useRef } from 'react';
import { useLazyQuery } from '@apollo/client';
import {
  GET_EXTENDED_TRACK_METADATA,
  GetExtendedTrackMetadataData,
  GetExtendedTrackMetadataVars,
  ExtendedTrackMetadata,
} from '../graphql/trackMetadata';

/**
 * Hook for managing accordion state and extended track metadata fetching
 *
 * Features:
 * - Single-expansion behavior (only one accordion open at a time)
 * - Lazy loading of metadata on accordion expand
 * - Request ID tracking to handle rapid clicks (stale response rejection)
 * - Loading and error state management
 */

interface UseTrackMetadataOptions {
  /** Called when accordion state changes */
  onExpandChange?: (trackId: string | null) => void;
}

interface UseTrackMetadataReturn {
  /** Currently expanded track ID (null if none) */
  expandedTrackId: string | null;
  /** Loading state for metadata fetch */
  loading: boolean;
  /** Error from metadata fetch */
  error: Error | null;
  /** Fetched metadata for expanded track */
  metadata: ExtendedTrackMetadata | null;
  /** Toggle accordion for a track */
  toggleTrack: (trackId: string, isrc: string | null | undefined) => void;
  /** Check if a specific track is expanded */
  isExpanded: (trackId: string) => boolean;
  /** Retry failed metadata fetch */
  retry: () => void;
}

export function useTrackMetadata(
  options: UseTrackMetadataOptions = {}
): UseTrackMetadataReturn {
  const { onExpandChange } = options;

  // Track currently expanded accordion
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);
  const [currentIsrc, setCurrentIsrc] = useState<string | null>(null);

  // Request ID ref to track which request is current (handles rapid clicks)
  // When a new request starts, we increment this; stale responses are ignored
  const requestIdRef = useRef(0);
  const lastCompletedRequestIdRef = useRef(0);

  // GraphQL lazy query for metadata
  const [fetchMetadata, { loading, error, data }] = useLazyQuery<
    GetExtendedTrackMetadataData,
    GetExtendedTrackMetadataVars
  >(GET_EXTENDED_TRACK_METADATA, {
    fetchPolicy: 'cache-first',
  });

  // Toggle accordion for a track
  const toggleTrack = useCallback(
    (trackId: string, isrc: string | null | undefined) => {
      // If clicking the same track, collapse it
      if (expandedTrackId === trackId) {
        setExpandedTrackId(null);
        setCurrentIsrc(null);
        onExpandChange?.(null);
        return;
      }

      // Increment request ID to invalidate any pending requests
      requestIdRef.current += 1;

      // Expand new track
      setExpandedTrackId(trackId);
      onExpandChange?.(trackId);

      // Fetch metadata if ISRC is available
      if (isrc) {
        setCurrentIsrc(isrc);
        const thisRequestId = requestIdRef.current;

        fetchMetadata({
          variables: { isrc },
        }).then(() => {
          // Track which request completed for potential stale check
          lastCompletedRequestIdRef.current = thisRequestId;
        });
      } else {
        setCurrentIsrc(null);
      }
    },
    [expandedTrackId, fetchMetadata, onExpandChange]
  );

  // Check if a specific track is expanded
  const isExpanded = useCallback(
    (trackId: string) => expandedTrackId === trackId,
    [expandedTrackId]
  );

  // Retry failed metadata fetch
  const retry = useCallback(() => {
    if (currentIsrc) {
      requestIdRef.current += 1;
      fetchMetadata({
        variables: { isrc: currentIsrc },
      });
    }
  }, [currentIsrc, fetchMetadata]);

  // Only return metadata if it matches the current ISRC
  // This prevents showing stale data from a previous request
  const currentMetadata = data?.getExtendedTrackMetadata;
  const metadataMatchesCurrent =
    currentMetadata && currentIsrc && currentMetadata.isrc === currentIsrc.toUpperCase();

  return {
    expandedTrackId,
    loading,
    error: error || null,
    metadata: metadataMatchesCurrent ? currentMetadata : null,
    toggleTrack,
    isExpanded,
    retry,
  };
}
