import { gql } from '@apollo/client';

/**
 * GraphQL queries for Track Metadata Display feature
 *
 * Feature: 008-track-metadata-display
 */

/**
 * Query to get extended track metadata from Qdrant
 * Used when user expands the accordion to view lyrics, interpretation, and audio features
 */
export const GET_EXTENDED_TRACK_METADATA = gql`
  query GetExtendedTrackMetadata($isrc: String!) {
    getExtendedTrackMetadata(isrc: $isrc) {
      isrc
      lyrics
      interpretation
      audioFeatures {
        acousticness
        danceability
        energy
        instrumentalness
        key
        liveness
        loudness
        mode
        speechiness
        tempo
        valence
      }
    }
  }
`;

/**
 * TypeScript types for extended track metadata
 */
export interface AudioFeatures {
  acousticness: number | null;
  danceability: number | null;
  energy: number | null;
  instrumentalness: number | null;
  key: number | null;
  liveness: number | null;
  loudness: number | null;
  mode: number | null;
  speechiness: number | null;
  tempo: number | null;
  valence: number | null;
}

export interface ExtendedTrackMetadata {
  isrc: string;
  lyrics: string | null;
  interpretation: string | null;
  audioFeatures: AudioFeatures | null;
}

export interface GetExtendedTrackMetadataData {
  getExtendedTrackMetadata: ExtendedTrackMetadata | null;
}

export interface GetExtendedTrackMetadataVars {
  isrc: string;
}
