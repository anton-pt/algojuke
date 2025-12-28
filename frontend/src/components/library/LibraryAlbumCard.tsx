import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LibraryAlbumCard.css';

export interface LibraryAlbum {
  id: string;
  tidalAlbumId: string;
  title: string;
  artistName: string;
  coverArtUrl: string | null;
  releaseDate: string | null;
  trackCount: number;
  createdAt: string;
}

interface LibraryAlbumCardProps {
  album: LibraryAlbum;
  onDelete?: (album: LibraryAlbum) => void;
}

export function LibraryAlbumCard({ album, onDelete }: LibraryAlbumCardProps) {
  const [imageError, setImageError] = useState(false);
  const navigate = useNavigate();

  const imageSrc = imageError || !album.coverArtUrl
    ? '/images/placeholder-album.svg'
    : album.coverArtUrl;

  const releaseYear = album.releaseDate
    ? new Date(album.releaseDate).getFullYear()
    : '';

  const handleClick = () => {
    navigate(`/library/albums/${album.id}`);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(album);
    }
  };

  return (
    <div className="library-album-card" onClick={handleClick}>
      <div className="library-album-artwork">
        <img
          src={imageSrc}
          alt={`${album.title} by ${album.artistName}`}
          onError={() => setImageError(true)}
          loading="lazy"
        />
      </div>

      <div className="library-album-info">
        <h3 className="library-album-title">{album.title}</h3>
        <p className="library-album-artist">{album.artistName}</p>

        <div className="library-album-meta">
          <span>{album.trackCount} tracks</span>
          {releaseYear && <span> • {releaseYear}</span>}
        </div>
      </div>

      {onDelete && (
        <button
          className="library-album-delete"
          onClick={handleDeleteClick}
          aria-label="Remove album from library"
        >
          ×
        </button>
      )}
    </div>
  );
}
