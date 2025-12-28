import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResultsList } from '../../src/components/ResultsList';

const mockResults = {
  albums: [
    {
      id: '1',
      title: 'Album 1',
      artist: 'Artist 1',
      artists: ['Artist 1'],
      artworkUrl: 'https://test.com/art1.jpg',
      artworkThumbUrl: 'https://test.com/thumb1.jpg',
      explicit: false,
      trackCount: 10,
      duration: 2000,
      releaseDate: '2020-01-01',
      externalUrl: 'https://tidal.com/album/1',
      source: 'tidal' as const,
    },
    {
      id: '2',
      title: 'Album 2',
      artist: 'Artist 2',
      artists: ['Artist 2'],
      artworkUrl: 'https://test.com/art2.jpg',
      artworkThumbUrl: 'https://test.com/thumb2.jpg',
      explicit: false,
      trackCount: 12,
      duration: 2400,
      releaseDate: '2021-01-01',
      externalUrl: 'https://tidal.com/album/2',
      source: 'tidal' as const,
    },
  ],
  tracks: [
    {
      id: '10',
      title: 'Track 1',
      artist: 'Artist 1',
      artists: ['Artist 1'],
      albumTitle: 'Album 1',
      albumId: '1',
      artworkUrl: 'https://test.com/art1.jpg',
      artworkThumbUrl: 'https://test.com/thumb1.jpg',
      explicit: false,
      duration: 180,
      externalUrl: 'https://tidal.com/track/10',
      source: 'tidal' as const,
    },
    {
      id: '20',
      title: 'Track 2',
      artist: 'Artist 2',
      artists: ['Artist 2'],
      albumTitle: 'Album 2',
      albumId: '2',
      artworkUrl: 'https://test.com/art2.jpg',
      artworkThumbUrl: 'https://test.com/thumb2.jpg',
      explicit: false,
      duration: 200,
      externalUrl: 'https://tidal.com/track/20',
      source: 'tidal' as const,
    },
  ],
  total: {
    albums: 150,
    tracks: 1200,
  },
  query: 'rock',
  cached: false,
  timestamp: Date.now(),
};

describe('ResultsList Organization', () => {
  describe('Section Headings', () => {
    test('displays Albums section heading', () => {
      render(<ResultsList results={mockResults} />);

      expect(screen.getByRole('heading', { name: /albums/i })).toBeInTheDocument();
    });

    test('displays Tracks section heading', () => {
      render(<ResultsList results={mockResults} />);

      expect(screen.getByRole('heading', { name: /tracks/i })).toBeInTheDocument();
    });

    test('shows album count in Albums heading', () => {
      render(<ResultsList results={mockResults} />);

      expect(screen.getByRole('heading', { name: /albums \(150\)/i })).toBeInTheDocument();
    });

    test('shows track count in Tracks heading', () => {
      render(<ResultsList results={mockResults} />);

      expect(screen.getByRole('heading', { name: /tracks \(1200\)/i })).toBeInTheDocument();
    });
  });

  describe('Visual Separation', () => {
    test('albums are in albums-section', () => {
      const { container } = render(<ResultsList results={mockResults} />);

      const albumsSection = container.querySelector('.albums-section');
      expect(albumsSection).toBeInTheDocument();
    });

    test('tracks are in tracks-section', () => {
      const { container } = render(<ResultsList results={mockResults} />);

      const tracksSection = container.querySelector('.tracks-section');
      expect(tracksSection).toBeInTheDocument();
    });

    test('albums use grid layout', () => {
      const { container } = render(<ResultsList results={mockResults} />);

      const albumsGrid = container.querySelector('.albums-grid');
      expect(albumsGrid).toBeInTheDocument();
    });

    test('tracks use list layout', () => {
      const { container } = render(<ResultsList results={mockResults} />);

      const tracksList = container.querySelector('.tracks-list');
      expect(tracksList).toBeInTheDocument();
    });

    test('sections are visually distinct', () => {
      const { container } = render(<ResultsList results={mockResults} />);

      const albumsSection = container.querySelector('.albums-section');
      const tracksSection = container.querySelector('.tracks-section');

      expect(albumsSection).not.toBe(tracksSection);
    });
  });

  describe('Section Content', () => {
    test('renders all albums in albums section', () => {
      render(<ResultsList results={mockResults} />);

      expect(screen.getByText('Album 1')).toBeInTheDocument();
      expect(screen.getByText('Album 2')).toBeInTheDocument();
    });

    test('renders all tracks in tracks section', () => {
      render(<ResultsList results={mockResults} />);

      expect(screen.getByText('Track 1')).toBeInTheDocument();
      expect(screen.getByText('Track 2')).toBeInTheDocument();
    });

    test('albums and tracks are not mixed', () => {
      const { container } = render(<ResultsList results={mockResults} />);

      const albumsSection = container.querySelector('.albums-section');
      const tracksSection = container.querySelector('.tracks-section');

      // Check that album titles are in albums section
      expect(albumsSection?.textContent).toContain('Album 1');
      expect(albumsSection?.textContent).toContain('Album 2');

      // Check that track titles are in tracks section
      expect(tracksSection?.textContent).toContain('Track 1');
      expect(tracksSection?.textContent).toContain('Track 2');
    });
  });

  describe('Conditional Rendering', () => {
    test('shows only albums section when no tracks', () => {
      const albumsOnly = { ...mockResults, tracks: [], total: { ...mockResults.total, tracks: 0 } };
      render(<ResultsList results={albumsOnly} />);

      expect(screen.getByRole('heading', { name: /albums/i })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /tracks/i })).not.toBeInTheDocument();
    });

    test('shows only tracks section when no albums', () => {
      const tracksOnly = { ...mockResults, albums: [], total: { ...mockResults.total, albums: 0 } };
      render(<ResultsList results={tracksOnly} />);

      expect(screen.getByRole('heading', { name: /tracks/i })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /albums/i })).not.toBeInTheDocument();
    });

    test('shows both sections when both have results', () => {
      render(<ResultsList results={mockResults} />);

      expect(screen.getByRole('heading', { name: /albums/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /tracks/i })).toBeInTheDocument();
    });
  });

  describe('Results Summary', () => {
    test('displays total count summary', () => {
      render(<ResultsList results={mockResults} />);

      expect(screen.getByText(/found 150 albums and 1200 tracks/i)).toBeInTheDocument();
    });

    test('shows cached indicator when results are cached', () => {
      const cachedResults = { ...mockResults, cached: true };
      render(<ResultsList results={cachedResults} />);

      expect(screen.getByText(/cached/i)).toBeInTheDocument();
    });

    test('does not show cached indicator for fresh results', () => {
      render(<ResultsList results={mockResults} />);

      expect(screen.queryByText(/cached/i)).not.toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    test('shows no results message when both sections empty', () => {
      const emptyResults = {
        ...mockResults,
        albums: [],
        tracks: [],
        total: { albums: 0, tracks: 0 },
      };
      render(<ResultsList results={emptyResults} />);

      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });

    test('returns null when results prop is null', () => {
      const { container } = render(<ResultsList results={null} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Layout Organization', () => {
    test('albums section appears before tracks section', () => {
      const { container } = render(<ResultsList results={mockResults} />);

      const sections = container.querySelectorAll('section');
      expect(sections[0]).toHaveClass('albums-section');
      expect(sections[1]).toHaveClass('tracks-section');
    });

    test('uses semantic HTML sections', () => {
      const { container } = render(<ResultsList results={mockResults} />);

      const albumsSection = container.querySelector('.albums-section');
      const tracksSection = container.querySelector('.tracks-section');

      expect(albumsSection?.tagName).toBe('SECTION');
      expect(tracksSection?.tagName).toBe('SECTION');
    });
  });
});
