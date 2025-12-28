import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrackCard } from './TrackCard';

const mockTrack = {
  id: '456',
  title: 'Come Together',
  artist: 'The Beatles',
  artists: ['The Beatles'],
  albumTitle: 'Abbey Road',
  albumId: '123',
  artworkUrl: 'https://images.tidal.com/im/im?uuid=test&w=640&h=640',
  artworkThumbUrl: 'https://images.tidal.com/im/im?uuid=test&w=320&h=320',
  explicit: false,
  duration: 259,
  externalUrl: 'https://tidal.com/track/456',
  source: 'tidal' as const,
};

describe('TrackCard Component', () => {
  test('renders track information', () => {
    render(<TrackCard track={mockTrack} />);

    expect(screen.getByText('Come Together')).toBeInTheDocument();
    expect(screen.getByText('The Beatles')).toBeInTheDocument();
    expect(screen.getByText('Abbey Road')).toBeInTheDocument();
  });

  test('displays album artwork', () => {
    render(<TrackCard track={mockTrack} />);

    const img = screen.getByRole('img', { name: /come together/i });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', mockTrack.artworkThumbUrl);
  });

  test('uses thumbnail URL for artwork', () => {
    render(<TrackCard track={mockTrack} />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', expect.stringContaining('w=320&h=320'));
  });

  test('displays track duration', () => {
    render(<TrackCard track={mockTrack} />);

    // 259 seconds = 4:19
    expect(screen.getByText(/4:19/i)).toBeInTheDocument();
  });

  test('formats duration correctly', () => {
    const tests = [
      { duration: 59, expected: '0:59' },
      { duration: 60, expected: '1:00' },
      { duration: 125, expected: '2:05' },
      { duration: 259, expected: '4:19' },
      { duration: 3600, expected: '60:00' }, // 1 hour
    ];

    tests.forEach(({ duration, expected }) => {
      const track = { ...mockTrack, duration };
      const { unmount } = render(<TrackCard track={track} />);

      expect(screen.getByText(expected)).toBeInTheDocument();

      unmount();
    });
  });

  test('shows link to Tidal', () => {
    render(<TrackCard track={mockTrack} />);

    const link = screen.getByRole('link', { name: /view on tidal/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', mockTrack.externalUrl);
    expect(link).toHaveAttribute('target', '_blank');
  });

  test('displays explicit badge when track is explicit', () => {
    const explicitTrack = { ...mockTrack, explicit: true };
    render(<TrackCard track={explicitTrack} />);

    expect(screen.getByText(/explicit/i)).toBeInTheDocument();
  });

  test('does not show explicit badge for clean tracks', () => {
    render(<TrackCard track={mockTrack} />);

    expect(screen.queryByText(/explicit/i)).not.toBeInTheDocument();
  });

  test('falls back to placeholder on image error', () => {
    render(<TrackCard track={mockTrack} />);

    const img = screen.getByRole('img');
    fireEvent.error(img);

    expect(img).toHaveAttribute('src', '/images/placeholder-album.svg');
  });

  test('sets loading lazy for performance', () => {
    render(<TrackCard track={mockTrack} />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  test('displays featured artists', () => {
    const featuredTrack = {
      ...mockTrack,
      artists: ['The Beatles', 'Eric Clapton'],
    };
    render(<TrackCard track={featuredTrack} />);

    // Primary artist should be shown
    expect(screen.getByText('The Beatles')).toBeInTheDocument();
  });

  test('renders correctly with minimal data', () => {
    const minimalTrack = {
      id: '999',
      title: 'Test Track',
      artist: 'Test Artist',
      artists: [],
      albumTitle: 'Test Album',
      albumId: '888',
      artworkUrl: '/images/placeholder-album.svg',
      artworkThumbUrl: '/images/placeholder-album.svg',
      explicit: false,
      duration: 0,
      externalUrl: '',
      source: 'tidal' as const,
    };

    render(<TrackCard track={minimalTrack} />);

    expect(screen.getByText('Test Track')).toBeInTheDocument();
    expect(screen.getByText('Test Artist')).toBeInTheDocument();
    expect(screen.getByText('Test Album')).toBeInTheDocument();
  });

  test('has accessible alt text for images', () => {
    render(<TrackCard track={mockTrack} />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('alt', expect.stringContaining('Come Together'));
  });

  test('album title is clickable or informative', () => {
    render(<TrackCard track={mockTrack} />);

    const albumInfo = screen.getByText('Abbey Road');
    expect(albumInfo).toBeInTheDocument();
  });
});
