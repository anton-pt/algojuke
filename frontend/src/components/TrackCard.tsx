import { useState } from 'react';
import './TrackCard.css';

interface TrackCardProps {
  track: {
    id: string;
    title: string;
    artist: string;
    artists: string[];
    albumTitle: string;
    albumId: string;
    artworkUrl: string;
    artworkThumbUrl: string;
    explicit: boolean;
    duration: number;
    externalUrl: string;
    source: string;
  };
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function TrackCard({ track }: TrackCardProps) {
  const [imageError, setImageError] = useState(false);

  const imageSrc = imageError ? '/images/placeholder-album.svg' : track.artworkThumbUrl;

  return (
    <div className="track-card">
      <div className="track-artwork">
        <img
          src={imageSrc}
          alt={`${track.title} by ${track.artist}`}
          onError={() => setImageError(true)}
          loading="lazy"
        />
        {track.explicit && <span className="explicit-badge">Explicit</span>}
      </div>

      <div className="track-info">
        <h4 className="track-title">{track.title}</h4>
        <p className="track-artist">{track.artist}</p>
        <p className="track-album">{track.albumTitle}</p>
      </div>

      <div className="track-duration">{formatDuration(track.duration)}</div>

      {track.externalUrl && (
        <a
          href={track.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="tidal-link-small"
          aria-label="View on Tidal"
        >
          View on Tidal
        </a>
      )}
    </div>
  );
}
