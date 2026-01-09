/**
 * GraphQL operations for Tidal Library Sync
 *
 * Feature: ALG-32 - Tidal Library Synchronisation Flow
 */

import { gql } from "@apollo/client";

/**
 * Query to get albums in Tidal library that are not in AlgoJuke
 */
export const GET_TIDAL_ALBUM_DIFF = gql`
  query GetTidalAlbumDiff($cursor: String, $limit: Int) {
    getTidalAlbumDiff(cursor: $cursor, limit: $limit) {
      __typename
      ... on TidalAlbumDiffResult {
        items {
          tidalId
          title
          artistName
          coverArtUrl
          trackCount
          releaseDate
          addedToTidal
        }
        nextCursor
        hasMore
      }
      ... on TidalSyncConnectionError {
        message
        requiresReconnect
      }
      ... on TidalSyncApiError {
        message
        retryable
      }
    }
  }
`;

/**
 * Query to get tracks in Tidal library that are not in AlgoJuke
 */
export const GET_TIDAL_TRACK_DIFF = gql`
  query GetTidalTrackDiff($cursor: String, $limit: Int) {
    getTidalTrackDiff(cursor: $cursor, limit: $limit) {
      __typename
      ... on TidalTrackDiffResult {
        items {
          tidalId
          title
          artistName
          albumName
          coverArtUrl
          duration
          addedToTidal
        }
        nextCursor
        hasMore
      }
      ... on TidalSyncConnectionError {
        message
        requiresReconnect
      }
      ... on TidalSyncApiError {
        message
        retryable
      }
    }
  }
`;

/**
 * Mutation to import selected items from Tidal to AlgoJuke library
 */
export const IMPORT_FROM_TIDAL = gql`
  mutation ImportFromTidal($items: [TidalImportItemInput!]!) {
    importFromTidal(items: $items) {
      __typename
      ... on TidalImportSuccess {
        imported
        skipped
        failed
        results {
          tidalId
          type
          success
          error
        }
      }
      ... on TidalSyncConnectionError {
        message
        requiresReconnect
      }
      ... on TidalSyncApiError {
        message
        retryable
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// TypeScript Types
// ---------------------------------------------------------------------------

export interface TidalSyncAlbum {
  tidalId: string;
  title: string;
  artistName: string;
  coverArtUrl: string | null;
  trackCount: number;
  releaseDate: string | null;
  addedToTidal: string;
}

export interface TidalSyncTrack {
  tidalId: string;
  title: string;
  artistName: string;
  albumName: string | null;
  coverArtUrl: string | null;
  duration: number;
  addedToTidal: string;
}

export interface TidalAlbumDiffResult {
  __typename: "TidalAlbumDiffResult";
  items: TidalSyncAlbum[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface TidalTrackDiffResult {
  __typename: "TidalTrackDiffResult";
  items: TidalSyncTrack[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface TidalSyncConnectionError {
  __typename: "TidalSyncConnectionError";
  message: string;
  requiresReconnect: boolean;
}

export interface TidalSyncApiError {
  __typename: "TidalSyncApiError";
  message: string;
  retryable: boolean;
}

export type TidalAlbumDiffUnion =
  | TidalAlbumDiffResult
  | TidalSyncConnectionError
  | TidalSyncApiError;

export type TidalTrackDiffUnion =
  | TidalTrackDiffResult
  | TidalSyncConnectionError
  | TidalSyncApiError;

export interface TidalImportItemInput {
  type: "ALBUM" | "TRACK";
  tidalId: string;
}

export interface TidalImportItemResult {
  tidalId: string;
  type: "ALBUM" | "TRACK";
  success: boolean;
  error?: string;
}

export interface TidalImportSuccess {
  __typename: "TidalImportSuccess";
  imported: number;
  skipped: number;
  failed: number;
  results: TidalImportItemResult[];
}

export type TidalImportResult =
  | TidalImportSuccess
  | TidalSyncConnectionError
  | TidalSyncApiError;

// Query response types
export interface GetTidalAlbumDiffData {
  getTidalAlbumDiff: TidalAlbumDiffUnion;
}

export interface GetTidalTrackDiffData {
  getTidalTrackDiff: TidalTrackDiffUnion;
}

export interface ImportFromTidalData {
  importFromTidal: TidalImportResult;
}

// Query variables types
export interface GetTidalAlbumDiffVariables {
  cursor?: string | null;
  limit?: number;
}

export interface GetTidalTrackDiffVariables {
  cursor?: string | null;
  limit?: number;
}

export interface ImportFromTidalVariables {
  items: TidalImportItemInput[];
}
