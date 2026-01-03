/**
 * PlaylistCard Component Tests
 *
 * Feature: 015-playlist-suggestion
 *
 * Tests for visual playlist card display.
 * Written FIRST per Constitution Principle I (Test-First Development).
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlaylistCard, type PlaylistCardProps } from '../../../src/components/chat/PlaylistCard';

// Mock enriched track data
const mockEnrichedTrack = {
  isrc: 'USRC12345678',
  title: 'Someone Like You',
  artist: 'Adele',
  album: '21',
  artworkUrl: 'https://resources.tidal.com/images/abc/160x160.jpg',
  duration: 285,
  reasoning: 'A beautiful ballad about lost love that fits the melancholic mood.',
  enriched: true,
  tidalId: '12345678',
};

const mockUnenrichedTrack = {
  isrc: 'ZZUN00000001',
  title: 'Underground Hit',
  artist: 'Indie Artist',
  album: null,
  artworkUrl: null,
  duration: null,
  reasoning: 'A hidden gem from the underground scene.',
  enriched: false,
  tidalId: null,
};

const defaultProps: PlaylistCardProps = {
  title: 'Melancholic Evening Mix',
  tracks: [
    mockEnrichedTrack,
    {
      ...mockEnrichedTrack,
      isrc: 'GBAYE9876543',
      title: 'Fix You',
      artist: 'Coldplay',
      album: 'X&Y',
      tidalId: '87654321',
    },
  ],
};

describe('PlaylistCard', () => {
  describe('Title rendering (T024)', () => {
    it('renders playlist title', () => {
      render(<PlaylistCard {...defaultProps} />);
      expect(screen.getByText('Melancholic Evening Mix')).toBeInTheDocument();
    });

    it('renders long titles without truncation in header', () => {
      const longTitle = 'A Very Long Playlist Title That Should Not Be Truncated In The Header Section';
      render(<PlaylistCard {...defaultProps} title={longTitle} />);
      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });
  });

  describe('Track row rendering (T025)', () => {
    it('renders track titles', () => {
      render(<PlaylistCard {...defaultProps} />);
      expect(screen.getByText('Someone Like You')).toBeInTheDocument();
      expect(screen.getByText('Fix You')).toBeInTheDocument();
    });

    it('renders artist names', () => {
      render(<PlaylistCard {...defaultProps} />);
      expect(screen.getByText('Adele')).toBeInTheDocument();
      expect(screen.getByText('Coldplay')).toBeInTheDocument();
    });

    it('renders album artwork images', () => {
      render(<PlaylistCard {...defaultProps} />);
      const images = screen.getAllByRole('img');
      expect(images.length).toBeGreaterThanOrEqual(2);
      expect(images[0]).toHaveAttribute('src', mockEnrichedTrack.artworkUrl);
    });

    it('renders all tracks in order', () => {
      const manyTracks = Array.from({ length: 5 }, (_, i) => ({
        ...mockEnrichedTrack,
        isrc: `ISRC${String(i).padStart(8, '0')}`,
        title: `Track ${i + 1}`,
        artist: `Artist ${i + 1}`,
      }));
      render(<PlaylistCard {...defaultProps} tracks={manyTracks} />);

      for (let i = 0; i < 5; i++) {
        expect(screen.getByText(`Track ${i + 1}`)).toBeInTheDocument();
      }
    });
  });

  describe('Placeholder artwork (T026)', () => {
    it('shows placeholder for unenriched tracks', () => {
      render(<PlaylistCard {...defaultProps} tracks={[mockUnenrichedTrack]} />);

      // Should have an img element even for unenriched tracks
      const images = screen.getAllByRole('img');
      expect(images.length).toBeGreaterThanOrEqual(1);

      // The src should be a placeholder (not null/undefined)
      expect(images[0].getAttribute('src')).toBeTruthy();
    });

    it('renders fallback title and artist for unenriched tracks', () => {
      render(<PlaylistCard {...defaultProps} tracks={[mockUnenrichedTrack]} />);

      expect(screen.getByText('Underground Hit')).toBeInTheDocument();
      expect(screen.getByText('Indie Artist')).toBeInTheDocument();
    });
  });

  describe('Track count display', () => {
    it('shows track count in subtitle', () => {
      render(<PlaylistCard {...defaultProps} />);
      // Should show "2 tracks" or similar
      expect(screen.getByText(/2 tracks?/i)).toBeInTheDocument();
    });

    it('shows singular "track" for single track playlist', () => {
      render(<PlaylistCard {...defaultProps} tracks={[mockEnrichedTrack]} />);
      expect(screen.getByText(/1 track/i)).toBeInTheDocument();
    });
  });

  describe('Mixed enrichment states', () => {
    it('renders both enriched and unenriched tracks together', () => {
      const mixedTracks = [mockEnrichedTrack, mockUnenrichedTrack];
      render(<PlaylistCard {...defaultProps} tracks={mixedTracks} />);

      expect(screen.getByText('Someone Like You')).toBeInTheDocument();
      expect(screen.getByText('Underground Hit')).toBeInTheDocument();
    });

    it('visually differentiates unenriched tracks', () => {
      render(<PlaylistCard {...defaultProps} tracks={[mockUnenrichedTrack]} />);

      // The unenriched track row should have a distinct class
      const trackRow = screen.getByText('Underground Hit').closest('.playlist-card__track');
      expect(trackRow).toHaveClass('playlist-card__track--unenriched');
    });
  });

  describe('Duration display', () => {
    it('shows formatted duration for enriched tracks', () => {
      render(<PlaylistCard {...defaultProps} />);
      // 285 seconds = 4:45 - both tracks have same duration so use getAllByText
      const durations = screen.getAllByText('4:45');
      expect(durations.length).toBeGreaterThanOrEqual(1);
    });

    it('hides duration for unenriched tracks', () => {
      render(<PlaylistCard {...defaultProps} tracks={[mockUnenrichedTrack]} />);
      // Should not crash and should not show a duration
      expect(screen.queryByText('--:--')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has accessible track list structure', () => {
      render(<PlaylistCard {...defaultProps} />);

      // Should have a list structure
      const list = document.querySelector('.playlist-card__tracks');
      expect(list).toBeInTheDocument();
    });

    it('images have alt text', () => {
      render(<PlaylistCard {...defaultProps} />);

      const images = screen.getAllByRole('img');
      images.forEach((img) => {
        expect(img).toHaveAttribute('alt');
      });
    });
  });

  describe('Accordion expand/collapse (T030)', () => {
    it('reasoning is hidden by default', () => {
      render(<PlaylistCard {...defaultProps} />);

      // Reasoning text should not be visible initially
      expect(screen.queryByText(mockEnrichedTrack.reasoning)).not.toBeInTheDocument();
    });

    it('clicking a track expands to show reasoning', () => {
      render(<PlaylistCard {...defaultProps} />);

      // Click the first track
      const firstTrack = screen.getByText('Someone Like You').closest('.playlist-card__track');
      expect(firstTrack).toBeInTheDocument();
      fireEvent.click(firstTrack!);

      // Reasoning should now be visible
      expect(screen.getByText(mockEnrichedTrack.reasoning)).toBeInTheDocument();
    });

    it('clicking an expanded track collapses it', () => {
      render(<PlaylistCard {...defaultProps} />);

      const firstTrack = screen.getByText('Someone Like You').closest('.playlist-card__track');

      // Click to expand
      fireEvent.click(firstTrack!);
      expect(screen.getByText(mockEnrichedTrack.reasoning)).toBeInTheDocument();

      // Click again to collapse
      fireEvent.click(firstTrack!);
      expect(screen.queryByText(mockEnrichedTrack.reasoning)).not.toBeInTheDocument();
    });

    it('only one track can be expanded at a time (single expansion mode)', () => {
      const tracksWithDifferentReasoning = [
        { ...mockEnrichedTrack, isrc: 'TRACK1111111', reasoning: 'First track reasoning' },
        { ...mockEnrichedTrack, isrc: 'TRACK2222222', title: 'Second Track', reasoning: 'Second track reasoning' },
      ];
      render(<PlaylistCard {...defaultProps} tracks={tracksWithDifferentReasoning} />);

      // Click first track
      const firstTrack = screen.getByText('Someone Like You').closest('.playlist-card__track');
      fireEvent.click(firstTrack!);
      expect(screen.getByText('First track reasoning')).toBeInTheDocument();

      // Click second track - first should collapse
      const secondTrack = screen.getByText('Second Track').closest('.playlist-card__track');
      fireEvent.click(secondTrack!);
      expect(screen.queryByText('First track reasoning')).not.toBeInTheDocument();
      expect(screen.getByText('Second track reasoning')).toBeInTheDocument();
    });

    it('expanded track has aria-expanded="true"', () => {
      render(<PlaylistCard {...defaultProps} />);

      const firstTrack = screen.getByText('Someone Like You').closest('.playlist-card__track');

      // Initially not expanded
      expect(firstTrack).toHaveAttribute('aria-expanded', 'false');

      // Click to expand
      fireEvent.click(firstTrack!);
      expect(firstTrack).toHaveAttribute('aria-expanded', 'true');
    });

    it('expanded track has visual indicator class', () => {
      render(<PlaylistCard {...defaultProps} />);

      const firstTrack = screen.getByText('Someone Like You').closest('.playlist-card__track');
      fireEvent.click(firstTrack!);

      expect(firstTrack).toHaveClass('playlist-card__track--expanded');
    });

    it('keyboard Enter expands track', () => {
      render(<PlaylistCard {...defaultProps} />);

      const firstTrack = screen.getByText('Someone Like You').closest('.playlist-card__track');
      fireEvent.keyDown(firstTrack!, { key: 'Enter' });

      expect(screen.getByText(mockEnrichedTrack.reasoning)).toBeInTheDocument();
    });

    it('keyboard Space expands track', () => {
      render(<PlaylistCard {...defaultProps} />);

      const firstTrack = screen.getByText('Someone Like You').closest('.playlist-card__track');
      fireEvent.keyDown(firstTrack!, { key: ' ' });

      expect(screen.getByText(mockEnrichedTrack.reasoning)).toBeInTheDocument();
    });

    it('reasoning panel has aria-controls attribute', () => {
      render(<PlaylistCard {...defaultProps} />);

      const firstTrack = screen.getByText('Someone Like You').closest('.playlist-card__track');
      fireEvent.click(firstTrack!);

      // Track should have aria-controls pointing to reasoning panel
      expect(firstTrack).toHaveAttribute('aria-controls');
      const controlsId = firstTrack?.getAttribute('aria-controls');

      // Reasoning panel should have matching id
      const reasoningPanel = document.getElementById(controlsId!);
      expect(reasoningPanel).toBeInTheDocument();
      expect(reasoningPanel).toHaveTextContent(mockEnrichedTrack.reasoning);
    });
  });
});
