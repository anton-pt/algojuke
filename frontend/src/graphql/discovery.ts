import { gql } from '@apollo/client';

/**
 * GraphQL queries for Semantic Discovery Search feature
 *
 * Feature: 009-semantic-discovery-search
 */

/**
 * Query to discover tracks using natural language search
 */
export const DISCOVER_TRACKS = gql`
  query DiscoverTracks($input: DiscoverySearchInput!) {
    discoverTracks(input: $input) {
      ... on DiscoverySearchResponse {
        results {
          id
          isrc
          title
          artist
          album
          score
          artworkUrl
        }
        query
        expandedQueries
        page
        pageSize
        totalResults
        hasMore
      }
      ... on DiscoverySearchError {
        message
        code
        retryable
      }
    }
  }
`;

/**
 * Query to get the count of indexed tracks available for discovery
 */
export const GET_DISCOVERY_INDEXED_COUNT = gql`
  query GetDiscoveryIndexedCount {
    discoveryIndexedCount
  }
`;

/**
 * TypeScript types for discovery search
 */

export interface DiscoveryResult {
  id: string;
  isrc: string;
  title: string;
  artist: string;
  album: string;
  score: number;
  artworkUrl: string | null;
}

export interface DiscoverySearchResponse {
  results: DiscoveryResult[];
  query: string;
  expandedQueries: string[];
  page: number;
  pageSize: number;
  totalResults: number;
  hasMore: boolean;
}

export type DiscoveryErrorCode =
  | 'EMPTY_QUERY'
  | 'LLM_UNAVAILABLE'
  | 'EMBEDDING_UNAVAILABLE'
  | 'INDEX_UNAVAILABLE'
  | 'TIMEOUT'
  | 'INTERNAL_ERROR';

export interface DiscoverySearchError {
  message: string;
  code: DiscoveryErrorCode;
  retryable: boolean;
}

export type DiscoverySearchResult = DiscoverySearchResponse | DiscoverySearchError;

export interface DiscoverySearchInput {
  query: string;
  page?: number;
  pageSize?: number;
}

export interface DiscoverTracksData {
  discoverTracks: DiscoverySearchResult;
}

export interface DiscoverTracksVars {
  input: DiscoverySearchInput;
}

/**
 * Type guard to check if result is an error
 */
export function isDiscoverySearchError(
  result: DiscoverySearchResult
): result is DiscoverySearchError {
  return 'code' in result && 'retryable' in result;
}

/**
 * Type guard to check if result is a success response
 */
export function isDiscoverySearchResponse(
  result: DiscoverySearchResult
): result is DiscoverySearchResponse {
  return 'results' in result && 'expandedQueries' in result;
}
