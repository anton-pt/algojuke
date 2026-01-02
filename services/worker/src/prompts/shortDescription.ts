/**
 * Short Description Prompt Templates
 *
 * Generates prompts for Claude Haiku to create single-sentence
 * track descriptions for agent context in search results.
 */

/**
 * Audio feature descriptors for instrumental tracks
 */
export interface AudioFeatures {
  acousticness?: number | null;
  danceability?: number | null;
  energy?: number | null;
  instrumentalness?: number | null;
  liveness?: number | null;
  loudness?: number | null;
  speechiness?: number | null;
  tempo?: number | null;
  valence?: number | null;
  key?: number | null;
  mode?: number | null;
}

/**
 * Format a numeric audio feature as a human-readable descriptor
 */
function formatFeatureDescriptor(
  name: string,
  value: number | null | undefined,
  thresholds: { low: number; high: number },
  lowLabel: string,
  highLabel: string
): string | null {
  if (value === null || value === undefined) return null;

  if (value >= thresholds.high) {
    return highLabel;
  } else if (value <= thresholds.low) {
    return lowLabel;
  }
  return null;
}

/**
 * Format audio features as human-readable descriptors for instrumental tracks
 *
 * @param features - Audio features from ReccoBeats API
 * @returns Formatted string of audio characteristics
 */
export function formatAudioFeatures(features: AudioFeatures): string {
  const descriptors: string[] = [];

  // Energy descriptor
  const energy = formatFeatureDescriptor(
    "energy",
    features.energy,
    { low: 0.3, high: 0.7 },
    "low energy",
    "high energy"
  );
  if (energy) descriptors.push(energy);

  // Valence (mood) descriptor
  const valence = formatFeatureDescriptor(
    "valence",
    features.valence,
    { low: 0.3, high: 0.7 },
    "melancholic mood",
    "uplifting mood"
  );
  if (valence) descriptors.push(valence);

  // Acousticness descriptor
  if (features.acousticness !== null && features.acousticness !== undefined) {
    if (features.acousticness >= 0.7) {
      descriptors.push("acoustic");
    } else if (features.acousticness <= 0.2) {
      descriptors.push("electronic");
    }
  }

  // Danceability descriptor
  const danceability = formatFeatureDescriptor(
    "danceability",
    features.danceability,
    { low: 0.3, high: 0.7 },
    "ambient",
    "danceable"
  );
  if (danceability) descriptors.push(danceability);

  // Tempo descriptor
  if (features.tempo !== null && features.tempo !== undefined) {
    if (features.tempo >= 140) {
      descriptors.push(`fast tempo (${Math.round(features.tempo)} BPM)`);
    } else if (features.tempo <= 80) {
      descriptors.push(`slow tempo (${Math.round(features.tempo)} BPM)`);
    } else {
      descriptors.push(`${Math.round(features.tempo)} BPM`);
    }
  }

  // Liveness descriptor
  if (features.liveness !== null && features.liveness !== undefined) {
    if (features.liveness >= 0.8) {
      descriptors.push("live recording");
    }
  }

  // Instrumentalness descriptor (already implied for instrumentals)
  if (features.speechiness !== null && features.speechiness !== undefined) {
    if (features.speechiness >= 0.66) {
      descriptors.push("spoken word elements");
    }
  }

  if (descriptors.length === 0) {
    return "No distinctive audio characteristics available";
  }

  return descriptors.join(", ");
}

/**
 * Build prompt for tracks with interpretation (has lyrics)
 *
 * @param title - Track title
 * @param artist - Artist name
 * @param interpretation - LLM-generated interpretation text
 * @returns Formatted prompt for Claude Haiku
 */
export function buildShortDescriptionPrompt(
  title: string,
  artist: string,
  interpretation: string
): string {
  return `Summarize this track interpretation in exactly one sentence (max 50 words).
Focus on mood, theme, and emotional content. Output only the sentence.

Track: ${title} by ${artist}
Interpretation: ${interpretation}`;
}

/**
 * Build prompt for instrumental tracks (no lyrics)
 *
 * @param title - Track title
 * @param artist - Artist name
 * @param album - Album name
 * @param features - Audio features from ReccoBeats API
 * @returns Formatted prompt for Claude Haiku
 */
export function buildInstrumentalShortDescriptionPrompt(
  title: string,
  artist: string,
  album: string,
  features: AudioFeatures
): string {
  const formattedFeatures = formatAudioFeatures(features);

  return `Describe this instrumental track in exactly one sentence (max 50 words).
Use the audio features and metadata to convey its sonic character. Output only the sentence.

Track: ${title} by ${artist} from ${album}
Audio Features: ${formattedFeatures}`;
}

/**
 * Build prompt for tracks with no interpretation and no audio features
 *
 * @param title - Track title
 * @param artist - Artist name
 * @param album - Album name
 * @returns Formatted prompt for Claude Haiku
 */
export function buildMetadataOnlyShortDescriptionPrompt(
  title: string,
  artist: string,
  album: string
): string {
  return `Create a brief, neutral description for this track in exactly one sentence (max 50 words).
Use only the metadata provided. Output only the sentence.

Track: ${title} by ${artist} from ${album}`;
}
