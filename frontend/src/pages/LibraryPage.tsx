import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LibraryNav } from '../components/library/LibraryNav';
import { AlbumsView } from '../components/library/AlbumsView';
import { TracksView } from '../components/library/TracksView';
import { AlbumDetailView } from '../components/library/AlbumDetailView';
import { TrackDetailView } from '../components/library/TrackDetailView';
import './LibraryPage.css';

export function LibraryPage() {
  const location = useLocation();

  // Hide header and nav on detail views
  const isDetailView = location.pathname.match(/\/library\/(albums|tracks)\/[^/]+$/);

  return (
    <div className="library-page">
      {!isDetailView && (
        <>
          <div className="library-header">
            <h1>My Library</h1>
            <p>Your personal collection of music</p>
          </div>

          <LibraryNav />
        </>
      )}

      <Routes>
        <Route path="albums" element={<AlbumsView />} />
        <Route path="albums/:id" element={<AlbumDetailView />} />
        <Route path="tracks" element={<TracksView />} />
        <Route path="tracks/:id" element={<TrackDetailView />} />
        <Route path="*" element={<Navigate to="albums" replace />} />
      </Routes>
    </div>
  );
}
