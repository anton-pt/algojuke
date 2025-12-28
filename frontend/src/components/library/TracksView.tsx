import { useQuery, useMutation } from '@apollo/client';
import { GET_LIBRARY_TRACKS, REMOVE_TRACK_FROM_LIBRARY } from '../../graphql/library';
import { LibraryTrackCard, LibraryTrack } from './LibraryTrackCard';
import { useUndoDelete } from '../../hooks/useUndoDelete';
import './TracksView.css';

export function TracksView() {
  const { loading, error, data } = useQuery<{ getLibraryTracks: LibraryTrack[] }>(
    GET_LIBRARY_TRACKS
  );

  const [removeTrackMutation] = useMutation(REMOVE_TRACK_FROM_LIBRARY, {
    refetchQueries: [{ query: GET_LIBRARY_TRACKS }],
  });

  const { handleDelete, isDeleted } = useUndoDelete<LibraryTrack>({
    itemName: 'Track',
    getItemLabel: (track) => `${track.title} - ${track.artistName}`,
    onDelete: async (trackId) => {
      await removeTrackMutation({ variables: { id: trackId } });
    },
  });

  if (loading) {
    return (
      <div className="tracks-view">
        <div className="tracks-loading">Loading your library...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tracks-view">
        <div className="tracks-error">
          <p>Error loading tracks: {error.message}</p>
        </div>
      </div>
    );
  }

  const tracks = data?.getLibraryTracks || [];

  // Filter out deleted tracks
  const visibleTracks = tracks.filter((track) => !isDeleted(track.id));

  if (visibleTracks.length === 0) {
    return (
      <div className="tracks-view">
        <div className="tracks-empty">
          <h2>No tracks in your library yet</h2>
          <p>Search for music and add individual tracks to your library to see them here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tracks-view">
      <div className="tracks-list">
        {visibleTracks.map((track) => (
          <LibraryTrackCard
            key={track.id}
            track={track}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}
