import { useQuery, useMutation } from '@apollo/client';
import { GET_LIBRARY_ALBUMS, REMOVE_ALBUM_FROM_LIBRARY } from '../../graphql/library';
import { LibraryAlbumCard, LibraryAlbum } from './LibraryAlbumCard';
import { useUndoDelete } from '../../hooks/useUndoDelete';
import './AlbumsView.css';

export function AlbumsView() {
  const { loading, error, data } = useQuery<{ getLibraryAlbums: LibraryAlbum[] }>(
    GET_LIBRARY_ALBUMS
  );

  const [removeAlbumMutation] = useMutation(REMOVE_ALBUM_FROM_LIBRARY, {
    refetchQueries: [{ query: GET_LIBRARY_ALBUMS }],
  });

  const { handleDelete, isDeleted } = useUndoDelete<LibraryAlbum>({
    itemName: 'Album',
    getItemLabel: (album) => `${album.title} - ${album.artistName}`,
    onDelete: async (albumId) => {
      await removeAlbumMutation({ variables: { id: albumId } });
    },
  });

  if (loading) {
    return (
      <div className="albums-view">
        <div className="albums-loading">Loading your library...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="albums-view">
        <div className="albums-error">
          <p>Error loading albums: {error.message}</p>
        </div>
      </div>
    );
  }

  const albums = data?.getLibraryAlbums || [];

  // Filter out deleted albums
  const visibleAlbums = albums.filter((album) => !isDeleted(album.id));

  if (visibleAlbums.length === 0) {
    return (
      <div className="albums-view">
        <div className="albums-empty">
          <h2>No albums in your library yet</h2>
          <p>Search for music and add albums to your library to see them here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="albums-view">
      <div className="albums-grid">
        {visibleAlbums.map((album) => (
          <LibraryAlbumCard
            key={album.id}
            album={album}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}
