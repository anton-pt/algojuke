import { AudioFeatures } from '../../graphql/trackMetadata';
import {
  formatKey,
  formatPercentage,
  formatTempo,
  formatLoudness,
  formatValence,
  getValenceEmoji,
} from '../../utils/audioFeatureFormatters';
import './AudioFeaturesDisplay.css';

interface AudioFeaturesDisplayProps {
  audioFeatures: AudioFeatures | null;
}

/**
 * Display formatted audio features in a grid layout
 */
export function AudioFeaturesDisplay({ audioFeatures }: AudioFeaturesDisplayProps) {
  if (!audioFeatures) {
    return (
      <div className="audio-features-unavailable">
        <p>Audio features not available</p>
      </div>
    );
  }

  // Check if all features are null
  const hasAnyFeature = Object.values(audioFeatures).some((v) => v !== null);

  if (!hasAnyFeature) {
    return (
      <div className="audio-features-unavailable">
        <p>Audio features not available</p>
      </div>
    );
  }

  return (
    <div className="audio-features-display">
      <div className="audio-features-grid">
        {/* Key and Mode */}
        {(audioFeatures.key !== null || audioFeatures.mode !== null) && (
          <div className="audio-feature-item">
            <span className="audio-feature-label">Key</span>
            <span className="audio-feature-value">
              {formatKey(audioFeatures.key, audioFeatures.mode)}
            </span>
          </div>
        )}

        {/* Tempo */}
        {audioFeatures.tempo !== null && (
          <div className="audio-feature-item">
            <span className="audio-feature-label">Tempo</span>
            <span className="audio-feature-value">{formatTempo(audioFeatures.tempo)}</span>
          </div>
        )}

        {/* Energy */}
        {audioFeatures.energy !== null && (
          <div className="audio-feature-item">
            <span className="audio-feature-label">Energy</span>
            <span className="audio-feature-value">{formatPercentage(audioFeatures.energy)}</span>
          </div>
        )}

        {/* Danceability */}
        {audioFeatures.danceability !== null && (
          <div className="audio-feature-item">
            <span className="audio-feature-label">Danceability</span>
            <span className="audio-feature-value">
              {formatPercentage(audioFeatures.danceability)}
            </span>
          </div>
        )}

        {/* Mood/Valence */}
        {audioFeatures.valence !== null && (
          <div className="audio-feature-item">
            <span className="audio-feature-label">Mood</span>
            <span className="audio-feature-value">
              {formatValence(audioFeatures.valence)} {getValenceEmoji(audioFeatures.valence)}
            </span>
          </div>
        )}

        {/* Acousticness */}
        {audioFeatures.acousticness !== null && (
          <div className="audio-feature-item">
            <span className="audio-feature-label">Acoustic</span>
            <span className="audio-feature-value">
              {formatPercentage(audioFeatures.acousticness)}
            </span>
          </div>
        )}

        {/* Instrumentalness */}
        {audioFeatures.instrumentalness !== null && (
          <div className="audio-feature-item">
            <span className="audio-feature-label">Instrumental</span>
            <span className="audio-feature-value">
              {formatPercentage(audioFeatures.instrumentalness)}
            </span>
          </div>
        )}

        {/* Liveness */}
        {audioFeatures.liveness !== null && (
          <div className="audio-feature-item">
            <span className="audio-feature-label">Live</span>
            <span className="audio-feature-value">{formatPercentage(audioFeatures.liveness)}</span>
          </div>
        )}

        {/* Speechiness */}
        {audioFeatures.speechiness !== null && (
          <div className="audio-feature-item">
            <span className="audio-feature-label">Speech</span>
            <span className="audio-feature-value">
              {formatPercentage(audioFeatures.speechiness)}
            </span>
          </div>
        )}

        {/* Loudness */}
        {audioFeatures.loudness !== null && (
          <div className="audio-feature-item">
            <span className="audio-feature-label">Loudness</span>
            <span className="audio-feature-value">{formatLoudness(audioFeatures.loudness)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
