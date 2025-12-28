import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { GET_LIBRARY_ALBUM, GET_LIBRARY_ALBUMS, REMOVE_ALBUM_FROM_LIBRARY } from '../../graphql/library';
import { useUndoDelete } from '../../hooks/useUndoDelete';
import './AlbumDetailView.css';

interface TrackInfo {
  position: number;
  title: string;
  duration: number;
  tidalId?: string;
  explicit?: boolean;
}

interface LibraryAlbumDetail {
  id: string;
  tidalAlbumId: string;
  title: string;
  artistName: string;
  coverArtUrl: string | null;
  releaseDate: string | null;
  trackCount: number;
  trackListing: TrackInfo[];
  createdAt: string;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTotalDuration(tracks: TrackInfo[]): string {
  const totalSeconds = tracks.reduce((sum, track) => sum + track.duration, 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours} hr ${minutes} min`;
  }
  return `${minutes} min`;
}

export function AlbumDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { loading, error, data } = useQuery<{ getLibraryAlbum: LibraryAlbumDetail }>(
    GET_LIBRARY_ALBUM,
    {
      variables: { id },
      skip: !id,
    }
  );

  const [removeAlbumMutation] = useMutation(REMOVE_ALBUM_FROM_LIBRARY, {
    refetchQueries: [{ query: GET_LIBRARY_ALBUMS }],
  });

  const { handleDelete } = useUndoDelete<LibraryAlbumDetail>({
    itemName: 'Album',
    getItemLabel: (album) => `${album.title} - ${album.artistName}`,
    onDelete: async (albumId) => {
      await removeAlbumMutation({ variables: { id: albumId } });
    },
  });

  if (loading) {
    return (
      <div className="album-detail-view">
        <div className="album-detail-loading">Loading album...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="album-detail-view">
        <div className="album-detail-error">
          <p>Error loading album: {error.message}</p>
          <button onClick={() => navigate('/library/albums')} className="back-button">
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  const album = data?.getLibraryAlbum;

  if (!album) {
    return (
      <div className="album-detail-view">
        <div className="album-detail-error">
          <p>Album not found</p>
          <button onClick={() => navigate('/library/albums')} className="back-button">
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  const releaseYear = album.releaseDate
    ? new Date(album.releaseDate).getFullYear()
    : null;

  return (
    <div className="album-detail-view">
      <button onClick={() => navigate('/library/albums')} className="back-button">
        ← Back to Albums
      </button>

      <div className="album-detail-header">
        <div className="album-detail-artwork">
          {album.coverArtUrl ? (
            <img src={album.coverArtUrl} alt={`${album.title} by ${album.artistName}`} />
          ) : (
            <div className="album-detail-artwork-placeholder">No Cover Art</div>
          )}
        </div>

        <div className="album-detail-info">
          <h1 className="album-detail-title">{album.title}</h1>
          <p className="album-detail-artist">{album.artistName}</p>
          <div className="album-detail-meta">
            {releaseYear && <span>{releaseYear}</span>}
            <span>{album.trackCount} tracks</span>
            <span>{formatTotalDuration(album.trackListing)}</span>
          </div>
          <button
            onClick={() => {
              handleDelete(album);
              navigate('/library/albums');
            }}
            className="remove-album-button"
          >
            Remove from Library
          </button>
        </div>
      </div>

      <div className="album-detail-tracks">
        <h2>Track Listing</h2>
        <table className="track-listing-table">
          <thead>
            <tr>
              <th className="track-number">#</th>
              <th className="track-title">Title</th>
              <th className="track-duration">Duration</th>
            </tr>
          </thead>
          <tbody>
            {album.trackListing.map((track) => (
              <tr key={track.position}>
                <td className="track-number">{track.position}</td>
                <td className="track-title">
                  {track.title}
                  {track.explicit && <span className="explicit-indicator">E</span>}
                </td>
                <td className="track-duration">{formatDuration(track.duration)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
