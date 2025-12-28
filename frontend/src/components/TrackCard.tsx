import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { ADD_TRACK_TO_LIBRARY, GET_LIBRARY_TRACKS } from '../graphql/library';
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
  const [addSuccess, setAddSuccess] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Query library tracks to check if this track is already in library
  const { data: libraryData } = useQuery<{ getLibraryTracks: Array<{ tidalTrackId: string }> }>(
    GET_LIBRARY_TRACKS,
    { fetchPolicy: 'cache-first' }
  );

  const [addTrackToLibrary, { loading: addLoading }] = useMutation(ADD_TRACK_TO_LIBRARY, {
    refetchQueries: [{ query: GET_LIBRARY_TRACKS }],
    onCompleted: (data) => {
      if (data.addTrackToLibrary.__typename === 'LibraryTrack') {
        setAddSuccess(true);
        setAddError(null);
        setTimeout(() => setAddSuccess(false), 3000);
      } else if (data.addTrackToLibrary.__typename === 'DuplicateLibraryItemError') {
        setAddError('Track already in library');
        setTimeout(() => setAddError(null), 3000);
      } else if (data.addTrackToLibrary.__typename === 'TidalApiUnavailableError') {
        setAddError(data.addTrackToLibrary.message);
        setTimeout(() => setAddError(null), 5000);
      }
    },
    onError: (error) => {
      setAddError(`Error: ${error.message}`);
      setTimeout(() => setAddError(null), 5000);
    },
  });

  const imageSrc = imageError ? '/images/placeholder-album.svg' : track.artworkThumbUrl;

  // Check if track is already in library
  const isInLibrary = libraryData?.getLibraryTracks.some(
    (libTrack) => libTrack.tidalTrackId === track.id
  );

  const handleAddToLibrary = async () => {
    if (isInLibrary || addLoading) return;

    try {
      await addTrackToLibrary({
        variables: {
          input: { tidalTrackId: track.id },
        },
      });
    } catch (err) {
      // Error handled by onError callback
    }
  };

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

      <button
        onClick={handleAddToLibrary}
        disabled={isInLibrary || addLoading}
        className={`add-to-library-btn-track ${isInLibrary ? 'in-library' : ''} ${addSuccess ? 'success' : ''} ${addError ? 'error' : ''}`}
        title={isInLibrary ? 'Already in library' : 'Add to library'}
      >
        {addLoading && '⏳'}
        {!addLoading && addSuccess && '✓'}
        {!addLoading && !addSuccess && isInLibrary && '✓'}
        {!addLoading && !addSuccess && !isInLibrary && '+'}
      </button>

      {addError && <div className="add-error-message-track">{addError}</div>}
    </div>
  );
}
