import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IndexedBadge } from './IndexedBadge';
import './LibraryTrackCard.css';

export interface LibraryTrack {
  id: string;
  tidalTrackId: string;
  title: string;
  artistName: string;
  albumName: string | null;
  duration: number;
  coverArtUrl: string | null;
  createdAt: string;
  metadata?: {
    isrc?: string;
  } | null;
  isIndexed?: boolean;
}

interface LibraryTrackCardProps {
  track: LibraryTrack;
  onDelete?: (track: LibraryTrack) => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function LibraryTrackCard({ track, onDelete }: LibraryTrackCardProps) {
  const [imageError, setImageError] = useState(false);
  const navigate = useNavigate();

  const imageSrc = imageError || !track.coverArtUrl
    ? '/images/placeholder-album.svg'
    : track.coverArtUrl;

  const handleClick = () => {
    navigate(`/library/tracks/${track.id}`);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(track);
    }
  };

  return (
    <div className="library-track-card" onClick={handleClick}>
      <div className="library-track-artwork">
        <img
          src={imageSrc}
          alt={`${track.title} by ${track.artistName}`}
          onError={() => setImageError(true)}
          loading="lazy"
        />
      </div>
      <div className="library-track-info">
        <div className="library-track-main">
          <h3 className="library-track-title">
            {track.title}
            <IndexedBadge isIndexed={track.isIndexed} size="small" />
          </h3>
          <p className="library-track-artist">{track.artistName}</p>
        </div>
        <div className="library-track-meta">
          {track.albumName && (
            <span className="library-track-album">{track.albumName}</span>
          )}
          <span className="library-track-duration">
            {formatDuration(track.duration)}
          </span>
        </div>
      </div>

      {onDelete && (
        <button
          className="library-track-delete"
          onClick={handleDeleteClick}
          aria-label="Remove track from library"
        >
          ×
        </button>
      )}
    </div>
  );
}
