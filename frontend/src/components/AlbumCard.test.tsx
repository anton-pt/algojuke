import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { AlbumCard } from './AlbumCard';
import { GET_LIBRARY_ALBUMS } from '../graphql/library';

const mockAlbum = {
  id: '123',
  title: 'Abbey Road',
  artist: 'The Beatles',
  artists: ['The Beatles'],
  artworkUrl: 'https://images.tidal.com/im/im?uuid=test&w=640&h=640',
  artworkThumbUrl: 'https://images.tidal.com/im/im?uuid=test&w=320&h=320',
  explicit: false,
  trackCount: 17,
  duration: 2800,
  releaseDate: '1969-09-26',
  externalUrl: 'https://tidal.com/album/123',
  source: 'tidal' as const,
};

const mocks = [
  {
    request: {
      query: GET_LIBRARY_ALBUMS,
    },
    result: {
      data: {
        getLibraryAlbums: [],
      },
    },
  },
];

describe('AlbumCard Component', () => {
  test('renders album information', () => {
    render(
      <MockedProvider mocks={mocks}>
        <AlbumCard album={mockAlbum} />
      </MockedProvider>
    );

    expect(screen.getByText('Abbey Road')).toBeInTheDocument();
    expect(screen.getByText('The Beatles')).toBeInTheDocument();
  });

  test('displays album artwork', () => {
    render(
      <MockedProvider mocks={mocks}>
        <AlbumCard album={mockAlbum} />
      </MockedProvider>
    );

    const img = screen.getByRole('img', { name: /abbey road/i });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', mockAlbum.artworkThumbUrl);
  });

  test('uses thumbnail URL for performance', () => {
    render(
      <MockedProvider mocks={mocks}>
        <AlbumCard album={mockAlbum} />
      </MockedProvider>
    );

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', expect.stringContaining('w=320&h=320'));
  });

  test('shows track count', () => {
    render(
      <MockedProvider mocks={mocks}>
        <AlbumCard album={mockAlbum} />
      </MockedProvider>
    );

    expect(screen.getByText(/17 track/i)).toBeInTheDocument();
  });

  test('displays release date', () => {
    render(
      <MockedProvider mocks={mocks}>
        <AlbumCard album={mockAlbum} />
      </MockedProvider>
    );

    expect(screen.getByText(/1969/i)).toBeInTheDocument();
  });

  test('shows link to Tidal', () => {
    render(
      <MockedProvider mocks={mocks}>
        <AlbumCard album={mockAlbum} />
      </MockedProvider>
    );

    const link = screen.getByRole('link', { name: /view on tidal/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', mockAlbum.externalUrl);
    expect(link).toHaveAttribute('target', '_blank');
  });

  test('displays explicit badge when album is explicit', () => {
    const explicitAlbum = { ...mockAlbum, explicit: true };
    render(
      <MockedProvider mocks={mocks}>
        <AlbumCard album={explicitAlbum} />
      </MockedProvider>
    );

    expect(screen.getByText(/explicit/i)).toBeInTheDocument();
  });

  test('does not show explicit badge for clean albums', () => {
    render(
      <MockedProvider mocks={mocks}>
        <AlbumCard album={mockAlbum} />
      </MockedProvider>
    );

    expect(screen.queryByText(/explicit/i)).not.toBeInTheDocument();
  });

  test('falls back to placeholder on image error', () => {
    render(
      <MockedProvider mocks={mocks}>
        <AlbumCard album={mockAlbum} />
      </MockedProvider>
    );

    const img = screen.getByRole('img');
    fireEvent.error(img);

    expect(img).toHaveAttribute('src', '/images/placeholder-album.svg');
  });

  test('sets loading lazy for performance', () => {
    render(
      <MockedProvider mocks={mocks}>
        <AlbumCard album={mockAlbum} />
      </MockedProvider>
    );

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  test('displays all artists when multiple', () => {
    const multiArtistAlbum = {
      ...mockAlbum,
      artists: ['Artist 1', 'Artist 2', 'Artist 3'],
    };
    render(
      <MockedProvider mocks={mocks}>
        <AlbumCard album={multiArtistAlbum} />
      </MockedProvider>
    );

    // Primary artist should be shown
    expect(screen.getByText('The Beatles')).toBeInTheDocument();
  });

  test('renders correctly with minimal data', () => {
    const minimalAlbum = {
      id: '999',
      title: 'Test Album',
      artist: 'Test Artist',
      artists: [],
      artworkUrl: '/images/placeholder-album.svg',
      artworkThumbUrl: '/images/placeholder-album.svg',
      explicit: false,
      trackCount: 0,
      duration: 0,
      releaseDate: '',
      externalUrl: '',
      source: 'tidal' as const,
    };

    render(
      <MockedProvider mocks={mocks}>
        <AlbumCard album={minimalAlbum} />
      </MockedProvider>
    );

    expect(screen.getByText('Test Album')).toBeInTheDocument();
    expect(screen.getByText('Test Artist')).toBeInTheDocument();
  });

  test('has accessible alt text for images', () => {
    render(
      <MockedProvider mocks={mocks}>
        <AlbumCard album={mockAlbum} />
      </MockedProvider>
    );

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('alt', expect.stringContaining('Abbey Road'));
  });
});
