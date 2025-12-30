/**
 * Audio Feature Formatters
 *
 * Feature: 008-track-metadata-display
 *
 * Utilities for formatting audio feature values for human-readable display.
 */

/**
 * Key names mapping pitch class to musical notation
 * -1 = no key detected
 * 0-11 = C, C#/Db, D, D#/Eb, E, F, F#/Gb, G, G#/Ab, A, A#/Bb, B
 */
const KEY_NAMES = [
  'C',
  'C♯/D♭',
  'D',
  'D♯/E♭',
  'E',
  'F',
  'F♯/G♭',
  'G',
  'G♯/A♭',
  'A',
  'A♯/B♭',
  'B',
];

/**
 * Format musical key with mode (major/minor)
 */
export function formatKey(key: number | null, mode: number | null): string {
  if (key === null || key < 0 || key > 11) {
    return 'Unknown';
  }

  const keyName = KEY_NAMES[key];
  const modeName = mode === 1 ? 'major' : mode === 0 ? 'minor' : '';

  return modeName ? `${keyName} ${modeName}` : keyName;
}

/**
 * Format a 0-1 ratio as a percentage
 */
export function formatPercentage(value: number | null): string {
  if (value === null) {
    return '—';
  }
  return `${Math.round(value * 100)}%`;
}

/**
 * Format tempo in BPM
 */
export function formatTempo(tempo: number | null): string {
  if (tempo === null) {
    return '—';
  }
  return `${Math.round(tempo)} BPM`;
}

/**
 * Format loudness in decibels
 */
export function formatLoudness(loudness: number | null): string {
  if (loudness === null) {
    return '—';
  }
  return `${loudness.toFixed(1)} dB`;
}

/**
 * Format valence as a descriptive word
 */
export function formatValence(valence: number | null): string {
  if (valence === null) {
    return '—';
  }
  if (valence >= 0.7) {
    return 'Uplifting';
  }
  if (valence >= 0.4) {
    return 'Neutral';
  }
  return 'Melancholic';
}

/**
 * Get emoji for valence value
 */
export function getValenceEmoji(valence: number | null): string {
  if (valence === null) {
    return '';
  }
  if (valence >= 0.7) {
    return '☀️';
  }
  if (valence >= 0.4) {
    return '⛅';
  }
  return '🌧️';
}

/**
 * Audio feature display configuration
 */
export interface AudioFeatureConfig {
  label: string;
  formatter: (value: number | null, mode?: number | null) => string;
  description?: string;
}

/**
 * Configuration for all audio features
 */
export const AUDIO_FEATURE_CONFIGS: Record<string, AudioFeatureConfig> = {
  tempo: {
    label: 'Tempo',
    formatter: formatTempo,
    description: 'Beats per minute',
  },
  energy: {
    label: 'Energy',
    formatter: formatPercentage,
    description: 'Intensity and activity',
  },
  danceability: {
    label: 'Danceability',
    formatter: formatPercentage,
    description: 'Suitability for dancing',
  },
  valence: {
    label: 'Mood',
    formatter: formatValence,
    description: 'Musical positivity',
  },
  acousticness: {
    label: 'Acoustic',
    formatter: formatPercentage,
    description: 'Acoustic vs electronic',
  },
  instrumentalness: {
    label: 'Instrumental',
    formatter: formatPercentage,
    description: 'Likelihood of no vocals',
  },
  liveness: {
    label: 'Live',
    formatter: formatPercentage,
    description: 'Live audience presence',
  },
  speechiness: {
    label: 'Speech',
    formatter: formatPercentage,
    description: 'Spoken word presence',
  },
  loudness: {
    label: 'Loudness',
    formatter: formatLoudness,
    description: 'Average volume',
  },
};
