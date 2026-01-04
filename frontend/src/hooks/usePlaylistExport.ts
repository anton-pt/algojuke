/**
 * usePlaylistExport Hook
 *
 * Feature: 017-tidal-playlist-export
 *
 * Hook for exporting playlists to Tidal via GraphQL mutation.
 */

import { useState, useCallback } from 'react';
import { useMutation, gql } from '@apollo/client';
import type {
  TrackForExport,
  ExportPlaylistResult,
  PlaylistExportError,
} from '../types/playlist';

// Re-export types for consumers
export type { TrackForExport, SkippedTrack, ExportPlaylistResult, PlaylistExportError } from '../types/playlist';

export interface UsePlaylistExportReturn {
  exportPlaylist: (name: string, tracks: TrackForExport[]) => Promise<ExportPlaylistResult | null>;
  isLoading: boolean;
  error: PlaylistExportError | null;
  result: ExportPlaylistResult | null;
  clearError: () => void;
  reset: () => void;
}

// -----------------------------------------------------------------------------
// GraphQL Mutation
// -----------------------------------------------------------------------------

const EXPORT_PLAYLIST_MUTATION = gql`
  mutation ExportPlaylistToTidal($input: ExportPlaylistToTidalInput!) {
    exportPlaylistToTidal(input: $input) {
      __typename
      ... on ExportPlaylistSuccess {
        playlistId
        playlistName
        tracksAdded
        tracksSkipped
        skippedTracks {
          isrc
          title
          artist
        }
      }
      ... on NoTidalConnectionError {
        message
        code
      }
      ... on TokenRefreshFailedError {
        message
        code
      }
      ... on NoTracksAvailableError {
        message
        code
      }
      ... on PlaylistCreationFailedError {
        message
        code
        retryable
        retryAfter
      }
      ... on PlaylistValidationError {
        message
        code
        details
      }
    }
  }
`;

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function usePlaylistExport(): UsePlaylistExportReturn {
  const [error, setError] = useState<PlaylistExportError | null>(null);
  const [result, setResult] = useState<ExportPlaylistResult | null>(null);

  const [mutate, { loading: isLoading }] = useMutation(EXPORT_PLAYLIST_MUTATION);

  const exportPlaylist = useCallback(
    async (name: string, tracks: TrackForExport[]): Promise<ExportPlaylistResult | null> => {
      setError(null);
      setResult(null);

      try {
        const response = await mutate({
          variables: {
            input: {
              name,
              tracks: tracks.map((t) => ({
                isrc: t.isrc,
                title: t.title,
                artist: t.artist,
              })),
            },
          },
        });

        const data = response.data?.exportPlaylistToTidal;

        if (!data) {
          setError({
            code: 'unknown_error',
            message: 'No response from server',
          });
          return null;
        }

        // Use __typename for robust type discrimination
        if (data.__typename === 'ExportPlaylistSuccess') {
          const successResult: ExportPlaylistResult = {
            playlistId: data.playlistId,
            playlistName: data.playlistName,
            tracksAdded: data.tracksAdded,
            tracksSkipped: data.tracksSkipped,
            skippedTracks: data.skippedTracks,
          };
          setResult(successResult);
          return successResult;
        }

        // All error types have __typename, code, and message
        const errorTypename = data.__typename;
        if (
          errorTypename === 'NoTidalConnectionError' ||
          errorTypename === 'TokenRefreshFailedError' ||
          errorTypename === 'NoTracksAvailableError' ||
          errorTypename === 'PlaylistCreationFailedError' ||
          errorTypename === 'PlaylistValidationError'
        ) {
          const errorResult: PlaylistExportError = {
            code: data.code,
            message: data.message,
            retryable: data.retryable ?? false,
            retryAfter: data.retryAfter,
          };
          setError(errorResult);
          return null;
        }

        // Unexpected response type
        setError({
          code: 'unknown_error',
          message: `Unexpected response type: ${data.__typename}`,
        });
        return null;
      } catch (err) {
        // Network or GraphQL error
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError({
          code: 'network_error',
          message: errorMessage,
          retryable: true,
        });
        return null;
      }
    },
    [mutate]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  return {
    exportPlaylist,
    isLoading,
    error,
    result,
    clearError,
    reset,
  };
}
