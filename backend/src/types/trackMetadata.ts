/**
 * TypeScript types for Track Metadata Display feature
 *
 * Feature: 008-track-metadata-display
 * Date: 2025-12-30
 *
 * These types correspond to the GraphQL schema in trackMetadata.graphql
 */

/**
 * Audio analysis features from the track ingestion pipeline.
 * All fields are optional as they may not be available for every track.
 */
export interface AudioFeatures {
  /** Acoustic vs electronic character (0.0 = electronic, 1.0 = acoustic) */
  acousticness: number | null;

  /** Suitability for dancing based on tempo, rhythm, beat (0.0 to 1.0) */
  danceability: number | null;

  /** Intensity and liveliness (0.0 to 1.0) */
  energy: number | null;

  /** Likelihood of no vocals (0.0 to 1.0, >0.5 = likely instrumental) */
  instrumentalness: number | null;

  /** Pitch class notation (-1 = no key detected, 0 = C, 1 = C♯/D♭, ..., 11 = B) */
  key: number | null;

  /** Probability of live audience presence (0.0 to 1.0) */
  liveness: number | null;

  /** Average loudness in decibels (-60 to 0 dB) */
  loudness: number | null;

  /** Musical mode (0 = minor, 1 = major) */
  mode: number | null;

  /** Presence of spoken words (0.0 to 1.0, >0.66 = speech-like) */
  speechiness: number | null;

  /** Beats per minute (0 to 250) */
  tempo: number | null;

  /** Musical positivity (0.0 = sad/dark, 1.0 = happy/uplifting) */
  valence: number | null;
}

/**
 * Extended metadata for a track retrieved from the vector search index.
 * Contains lyrics, interpretation, and audio features populated by the
 * track ingestion pipeline.
 */
export interface ExtendedTrackMetadata {
  /** ISRC identifier for the track (ISO 3901, 12 characters) */
  isrc: string;

  /** Full lyrics text, null for instrumental tracks */
  lyrics: string | null;

  /**
   * LLM-generated natural language summary of lyric themes, mood, and content.
   * Null for instrumental tracks or if interpretation generation failed.
   */
  interpretation: string | null;

  /** Structured audio analysis features */
  audioFeatures: AudioFeatures | null;
}

/**
 * Raw track payload from Qdrant vector index.
 * Contains all fields stored in the payload, excluding the vector.
 */
export interface TrackPayload {
  /** ISRC identifier (12 alphanumeric characters) */
  isrc: string;

  /** Track title */
  title: string;

  /** Primary artist name */
  artist: string;

  /** Album name */
  album: string;

  /** Full lyrics text (nullable for instrumentals) */
  lyrics: string | null;

  /** LLM-generated interpretation (nullable) */
  interpretation: string | null;

  /** Audio features (all nullable) */
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

/**
 * Transform Qdrant TrackPayload to GraphQL ExtendedTrackMetadata
 */
export function transformPayloadToMetadata(
  payload: TrackPayload
): ExtendedTrackMetadata {
  // Check if any audio features are present
  const hasAudioFeatures =
    payload.acousticness !== null ||
    payload.danceability !== null ||
    payload.energy !== null ||
    payload.instrumentalness !== null ||
    payload.key !== null ||
    payload.liveness !== null ||
    payload.loudness !== null ||
    payload.mode !== null ||
    payload.speechiness !== null ||
    payload.tempo !== null ||
    payload.valence !== null;

  return {
    isrc: payload.isrc,
    lyrics: payload.lyrics,
    interpretation: payload.interpretation,
    audioFeatures: hasAudioFeatures
      ? {
          acousticness: payload.acousticness,
          danceability: payload.danceability,
          energy: payload.energy,
          instrumentalness: payload.instrumentalness,
          key: payload.key,
          liveness: payload.liveness,
          loudness: payload.loudness,
          mode: payload.mode,
          speechiness: payload.speechiness,
          tempo: payload.tempo,
          valence: payload.valence,
        }
      : null,
  };
}
