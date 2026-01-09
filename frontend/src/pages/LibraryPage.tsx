import { useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { LibraryNav } from "../components/library/LibraryNav";
import { AlbumsView } from "../components/library/AlbumsView";
import { TracksView } from "../components/library/TracksView";
import { AlbumDetailView } from "../components/library/AlbumDetailView";
import { TrackDetailView } from "../components/library/TrackDetailView";
import { TidalSyncModal } from "../components/library/TidalSyncModal";
import "./LibraryPage.css";

export function LibraryPage() {
  const location = useLocation();
  const { isSignedIn } = useAuth();
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Hide header and nav on detail views
  const isDetailView = location.pathname.match(
    /\/library\/(albums|tracks)\/[^/]+$/,
  );

  return (
    <div className="library-page">
      {!isDetailView && (
        <>
          <div className="library-header">
            <div className="library-header__content">
              <h1>My Library</h1>
              <p>Your personal collection of music</p>
            </div>
            {isSignedIn && (
              <button
                className="library-header__sync-button"
                onClick={() => setIsSyncModalOpen(true)}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
                </svg>
                Sync with Tidal
              </button>
            )}
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

      {/* Tidal Sync Modal */}
      <TidalSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
      />
    </div>
  );
}
