import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { ADD_ALBUM_TO_LIBRARY, GET_LIBRARY_ALBUMS } from '../graphql/library';
import './AlbumCard.css';

interface AlbumCardProps {
  album: {
    id: string;
    title: string;
    artist: string;
    artists: string[];
    artworkUrl: string;
    artworkThumbUrl: string;
    explicit: boolean;
    trackCount: number;
    duration: number;
    releaseDate: string;
    externalUrl: string;
    source: string;
  };
}

export function AlbumCard({ album }: AlbumCardProps) {
  const [imageError, setImageError] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Query library albums to check if this album is already in library
  const { data: libraryData } = useQuery<{ getLibraryAlbums: Array<{ tidalAlbumId: string }> }>(
    GET_LIBRARY_ALBUMS,
    { fetchPolicy: 'cache-first' }
  );

  const [addAlbumToLibrary, { loading: addLoading }] = useMutation(ADD_ALBUM_TO_LIBRARY, {
    refetchQueries: [{ query: GET_LIBRARY_ALBUMS }],
    onCompleted: (data) => {
      if (data.addAlbumToLibrary.__typename === 'LibraryAlbum') {
        setAddSuccess(true);
        setAddError(null);
        setTimeout(() => setAddSuccess(false), 3000);
      } else if (data.addAlbumToLibrary.__typename === 'DuplicateLibraryItemError') {
        setAddError('Album already in library');
        setTimeout(() => setAddError(null), 3000);
      } else if (data.addAlbumToLibrary.__typename === 'TidalApiUnavailableError') {
        setAddError(data.addAlbumToLibrary.message);
        setTimeout(() => setAddError(null), 5000);
      }
    },
    onError: (error) => {
      setAddError(`Error: ${error.message}`);
      setTimeout(() => setAddError(null), 5000);
    },
  });

  const imageSrc = imageError ? '/images/placeholder-album.svg' : album.artworkThumbUrl;
  const releaseYear = album.releaseDate ? new Date(album.releaseDate).getFullYear() : '';

  // Check if album is already in library
  const isInLibrary = libraryData?.getLibraryAlbums.some(
    (libAlbum) => libAlbum.tidalAlbumId === album.id
  );

  const handleAddToLibrary = async () => {
    if (isInLibrary || addLoading) return;

    try {
      await addAlbumToLibrary({
        variables: {
          input: { tidalAlbumId: album.id },
        },
      });
    } catch (err) {
      // Error handled by onError callback
    }
  };

  return (
    <div className="album-card">
      <div className="album-artwork">
        <img
          src={imageSrc}
          alt={`${album.title} by ${album.artist}`}
          onError={() => setImageError(true)}
          loading="lazy"
        />
        {album.explicit && <span className="explicit-badge">Explicit</span>}
      </div>

      <div className="album-info">
        <h3 className="album-title">{album.title}</h3>
        <p className="album-artist">{album.artist}</p>

        <div className="album-meta">
          <span>{album.trackCount} tracks</span>
          {releaseYear && <span> • {releaseYear}</span>}
        </div>

        {album.externalUrl && (
          <a
            href={album.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="tidal-link"
          >
            View on Tidal
          </a>
        )}

        <button
          onClick={handleAddToLibrary}
          disabled={isInLibrary || addLoading}
          className={`add-to-library-btn ${isInLibrary ? 'in-library' : ''} ${addSuccess ? 'success' : ''} ${addError ? 'error' : ''}`}
          title={isInLibrary ? 'Already in library' : 'Add to library'}
        >
          {addLoading && '⏳ Adding...'}
          {!addLoading && addSuccess && '✓ Added!'}
          {!addLoading && !addSuccess && isInLibrary && '✓ In Library'}
          {!addLoading && !addSuccess && !isInLibrary && '+ Add to Library'}
        </button>

        {addError && <div className="add-error-message">{addError}</div>}
      </div>
    </div>
  );
}
