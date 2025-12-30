import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AudioFeaturesDisplay } from './AudioFeaturesDisplay';
import { AudioFeatures } from '../../graphql/trackMetadata';

describe('AudioFeaturesDisplay', () => {
  const fullAudioFeatures: AudioFeatures = {
    acousticness: 0.5,
    danceability: 0.75,
    energy: 0.8,
    instrumentalness: 0.1,
    key: 5,
    liveness: 0.2,
    loudness: -5.5,
    mode: 1,
    speechiness: 0.15,
    tempo: 120,
    valence: 0.7,
  };

  describe('when audioFeatures is null', () => {
    it('shows unavailable message', () => {
      render(<AudioFeaturesDisplay audioFeatures={null} />);
      expect(screen.getByText('Audio features not available')).toBeInTheDocument();
    });
  });

  describe('when all features are null', () => {
    it('shows unavailable message', () => {
      const emptyFeatures: AudioFeatures = {
        acousticness: null,
        danceability: null,
        energy: null,
        instrumentalness: null,
        key: null,
        liveness: null,
        loudness: null,
        mode: null,
        speechiness: null,
        tempo: null,
        valence: null,
      };
      render(<AudioFeaturesDisplay audioFeatures={emptyFeatures} />);
      expect(screen.getByText('Audio features not available')).toBeInTheDocument();
    });
  });

  describe('when features are present', () => {
    it('displays key with mode formatted correctly', () => {
      render(<AudioFeaturesDisplay audioFeatures={fullAudioFeatures} />);
      expect(screen.getByText('Key')).toBeInTheDocument();
      expect(screen.getByText('F major')).toBeInTheDocument(); // key 5 = F, mode 1 = major
    });

    it('displays tempo formatted with BPM', () => {
      render(<AudioFeaturesDisplay audioFeatures={fullAudioFeatures} />);
      expect(screen.getByText('Tempo')).toBeInTheDocument();
      expect(screen.getByText('120 BPM')).toBeInTheDocument();
    });

    it('displays energy as percentage', () => {
      render(<AudioFeaturesDisplay audioFeatures={fullAudioFeatures} />);
      expect(screen.getByText('Energy')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
    });

    it('displays danceability as percentage', () => {
      render(<AudioFeaturesDisplay audioFeatures={fullAudioFeatures} />);
      expect(screen.getByText('Danceability')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('displays mood/valence with descriptive text', () => {
      render(<AudioFeaturesDisplay audioFeatures={fullAudioFeatures} />);
      expect(screen.getByText('Mood')).toBeInTheDocument();
      // valence 0.7 = "Uplifting"
      expect(screen.getByText(/Uplifting/)).toBeInTheDocument();
    });

    it('displays loudness with dB unit', () => {
      render(<AudioFeaturesDisplay audioFeatures={fullAudioFeatures} />);
      expect(screen.getByText('Loudness')).toBeInTheDocument();
      expect(screen.getByText('-5.5 dB')).toBeInTheDocument();
    });
  });

  describe('partial features', () => {
    it('only displays features that are present', () => {
      const partialFeatures: AudioFeatures = {
        acousticness: null,
        danceability: null,
        energy: 0.5,
        instrumentalness: null,
        key: null,
        liveness: null,
        loudness: null,
        mode: null,
        speechiness: null,
        tempo: 100,
        valence: null,
      };
      render(<AudioFeaturesDisplay audioFeatures={partialFeatures} />);

      // Present features
      expect(screen.getByText('Energy')).toBeInTheDocument();
      expect(screen.getByText('Tempo')).toBeInTheDocument();

      // Absent features should not be rendered
      expect(screen.queryByText('Danceability')).not.toBeInTheDocument();
      expect(screen.queryByText('Key')).not.toBeInTheDocument();
      expect(screen.queryByText('Mood')).not.toBeInTheDocument();
    });
  });

  describe('key formatting edge cases', () => {
    it('formats minor key correctly', () => {
      const minorKey: AudioFeatures = {
        ...fullAudioFeatures,
        key: 0,
        mode: 0,
      };
      render(<AudioFeaturesDisplay audioFeatures={minorKey} />);
      expect(screen.getByText('C minor')).toBeInTheDocument();
    });

    it('shows Unknown for invalid key', () => {
      const invalidKey: AudioFeatures = {
        ...fullAudioFeatures,
        key: -1,
        mode: 1,
      };
      render(<AudioFeaturesDisplay audioFeatures={invalidKey} />);
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });
});
