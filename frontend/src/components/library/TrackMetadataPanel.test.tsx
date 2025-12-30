import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrackMetadataPanel } from './TrackMetadataPanel';
import { ExtendedTrackMetadata } from '../../graphql/trackMetadata';

describe('TrackMetadataPanel', () => {
  const mockOnRetry = vi.fn();

  const fullMetadata: ExtendedTrackMetadata = {
    isrc: 'USRC12345678',
    lyrics: 'These are test lyrics\nWith multiple lines',
    interpretation: 'This song is about **testing software** and finding bugs.',
    audioFeatures: {
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
    },
  };

  beforeEach(() => {
    mockOnRetry.mockClear();
  });

  describe('loading state', () => {
    it('shows skeleton loader when loading', () => {
      render(
        <TrackMetadataPanel
          loading={true}
          error={null}
          metadata={null}
          hasIsrc={true}
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading track details...')).toBeInTheDocument();
    });

    it('has aria-busy attribute when loading', () => {
      const { container } = render(
        <TrackMetadataPanel
          loading={true}
          error={null}
          metadata={null}
          hasIsrc={true}
          onRetry={mockOnRetry}
        />
      );

      expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message and retry button', () => {
      render(
        <TrackMetadataPanel
          loading={false}
          error={new Error('Network error')}
          metadata={null}
          hasIsrc={true}
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText('Failed to load track details')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    it('calls onRetry when retry button is clicked', () => {
      render(
        <TrackMetadataPanel
          loading={false}
          error={new Error('Network error')}
          metadata={null}
          hasIsrc={true}
          onRetry={mockOnRetry}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });

    it('has role="alert" for error state', () => {
      const { container } = render(
        <TrackMetadataPanel
          loading={false}
          error={new Error('Network error')}
          metadata={null}
          hasIsrc={true}
          onRetry={mockOnRetry}
        />
      );

      expect(container.querySelector('[role="alert"]')).toBeInTheDocument();
    });
  });

  describe('no ISRC state', () => {
    it('shows unavailable message when track has no ISRC', () => {
      render(
        <TrackMetadataPanel
          loading={false}
          error={null}
          metadata={null}
          hasIsrc={false}
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText('Extended metadata not yet available')).toBeInTheDocument();
      expect(
        screen.getByText('This track needs to be processed before details are available.')
      ).toBeInTheDocument();
    });
  });

  describe('no metadata state', () => {
    it('shows processing message when metadata is null but has ISRC', () => {
      render(
        <TrackMetadataPanel
          loading={false}
          error={null}
          metadata={null}
          hasIsrc={true}
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText('Extended metadata not yet available')).toBeInTheDocument();
      expect(
        screen.getByText('This track is being processed. Check back soon.')
      ).toBeInTheDocument();
    });
  });

  describe('content display', () => {
    it('displays lyrics section with lyrics content', () => {
      render(
        <TrackMetadataPanel
          loading={false}
          error={null}
          metadata={fullMetadata}
          hasIsrc={true}
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText('Lyrics')).toBeInTheDocument();
      expect(screen.getByText(/These are test lyrics/)).toBeInTheDocument();
    });

    it('displays interpretation section with markdown content', () => {
      render(
        <TrackMetadataPanel
          loading={false}
          error={null}
          metadata={fullMetadata}
          hasIsrc={true}
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText('Interpretation')).toBeInTheDocument();
      // Markdown bold is rendered
      expect(screen.getByText('testing software')).toBeInTheDocument();
    });

    it('displays audio features section', () => {
      render(
        <TrackMetadataPanel
          loading={false}
          error={null}
          metadata={fullMetadata}
          hasIsrc={true}
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText('Audio Features')).toBeInTheDocument();
      expect(screen.getByText('Tempo')).toBeInTheDocument();
    });

    it('shows "No lyrics available" for instrumental tracks', () => {
      const instrumentalMetadata: ExtendedTrackMetadata = {
        ...fullMetadata,
        lyrics: null,
        interpretation: null,
      };

      render(
        <TrackMetadataPanel
          loading={false}
          error={null}
          metadata={instrumentalMetadata}
          hasIsrc={true}
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByText('No lyrics available')).toBeInTheDocument();
      expect(screen.getByText('No interpretation available')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has aria-live="polite" for content announcements', () => {
      const { container } = render(
        <TrackMetadataPanel
          loading={false}
          error={null}
          metadata={fullMetadata}
          hasIsrc={true}
          onRetry={mockOnRetry}
        />
      );

      expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
    });
  });
});
