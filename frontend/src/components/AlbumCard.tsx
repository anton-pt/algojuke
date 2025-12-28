import { useState } from 'react';
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

  const imageSrc = imageError ? '/images/placeholder-album.svg' : album.artworkThumbUrl;
  const releaseYear = album.releaseDate ? new Date(album.releaseDate).getFullYear() : '';

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
      </div>
    </div>
  );
}
