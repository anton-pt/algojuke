import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { GET_LIBRARY_TRACK, GET_LIBRARY_TRACKS, REMOVE_TRACK_FROM_LIBRARY } from '../../graphql/library';
import { useUndoDelete } from '../../hooks/useUndoDelete';
import './TrackDetailView.css';

interface LibraryTrackDetail {
  id: string;
  tidalTrackId: string;
  title: string;
  artistName: string;
  albumName: string | null;
  duration: number;
  coverArtUrl: string | null;
  createdAt: string;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function TrackDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { loading, error, data } = useQuery<{ getLibraryTrack: LibraryTrackDetail }>(
    GET_LIBRARY_TRACK,
    {
      variables: { id },
      skip: !id,
    }
  );

  const [removeTrackMutation] = useMutation(REMOVE_TRACK_FROM_LIBRARY, {
    refetchQueries: [{ query: GET_LIBRARY_TRACKS }],
  });

  const { handleDelete } = useUndoDelete<LibraryTrackDetail>({
    itemName: 'Track',
    getItemLabel: (track) => `${track.title} - ${track.artistName}`,
    onDelete: async (trackId) => {
      await removeTrackMutation({ variables: { id: trackId } });
    },
  });

  if (loading) {
    return (
      <div className="track-detail-view">
        <div className="track-detail-loading">Loading track...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="track-detail-view">
        <div className="track-detail-error">
          <p>Error loading track: {error.message}</p>
          <button onClick={() => navigate('/library/tracks')} className="back-button">
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  const track = data?.getLibraryTrack;

  if (!track) {
    return (
      <div className="track-detail-view">
        <div className="track-detail-error">
          <p>Track not found</p>
          <button onClick={() => navigate('/library/tracks')} className="back-button">
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  const addedDate = new Date(track.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="track-detail-view">
      <button onClick={() => navigate('/library/tracks')} className="back-button">
        ← Back to Tracks
      </button>

      <div className="track-detail-content">
        <div className="track-detail-artwork">
          {track.coverArtUrl ? (
            <img src={track.coverArtUrl} alt={`${track.title} by ${track.artistName}`} />
          ) : (
            <div className="track-detail-artwork-placeholder">No Cover Art</div>
          )}
        </div>

        <div className="track-detail-info">
          <h1 className="track-detail-title">{track.title}</h1>
          <p className="track-detail-artist">{track.artistName}</p>

          <div className="track-detail-metadata">
            {track.albumName && (
              <div className="track-detail-field">
                <span className="track-detail-label">Album</span>
                <span className="track-detail-value">{track.albumName}</span>
              </div>
            )}

            <div className="track-detail-field">
              <span className="track-detail-label">Duration</span>
              <span className="track-detail-value">{formatDuration(track.duration)}</span>
            </div>

            <div className="track-detail-field">
              <span className="track-detail-label">Added to Library</span>
              <span className="track-detail-value">{addedDate}</span>
            </div>
          </div>

          <button
            onClick={() => {
              handleDelete(track);
              navigate('/library/tracks');
            }}
            className="remove-track-button"
          >
            Remove from Library
          </button>
        </div>
      </div>
    </div>
  );
}
